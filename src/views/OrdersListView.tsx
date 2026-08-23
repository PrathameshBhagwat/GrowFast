import React, { useState } from 'react';
import { useStore } from '../store';
import { StatusBadge } from '../components/common/StatusBadge';
import { 
  ShoppingBag, 
  Search, 
  Filter, 
  PlusCircle, 
  Printer, 
  ArrowRight, 
  AlertTriangle, 
  Eye,
  IndianRupee,
  Clock
} from 'lucide-react';
import { Order } from '../types';
import { ThermalReceiptModal } from '../components/common/ThermalReceiptModal';

export const OrdersListView: React.FC = () => {
  const { orders, setActiveView, setSelectedOrderId } = useStore();
  const [filterTab, setFilterTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedReceiptOrder, setSelectedReceiptOrder] = useState<Order | null>(null);

  const filteredOrders = orders.filter(o => {
    const matchesSearch = 
      o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customerPhone.includes(searchQuery);

    if (!matchesSearch) return false;

    switch (filterTab) {
      case 'delayed': return o.isDelayed;
      case 'in_progress': return ['received', 'sorting', 'processing', 'drying', 'ironing', 'quality_check'].includes(o.overallStage);
      case 'ready': return o.overallStage === 'ready' || o.overallStage === 'packed';
      case 'unpaid': return o.paymentStatus !== 'paid';
      default: return true;
    }
  });

  const delayedCount = orders.filter(o => o.isDelayed).length;
  const unpaidCount = orders.filter(o => o.paymentStatus !== 'paid').length;
  const readyCount = orders.filter(o => o.overallStage === 'ready').length;

  const handleRowClick = (orderId: string) => {
    setSelectedOrderId(orderId);
    setActiveView('order-detail');
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">Store Orders Master Ledger</h1>
          <p className="page-subtitle">
            Manage customer intake, tracking, stage transitions & financial settlement
          </p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setActiveView('pos')}>
            <PlusCircle size={16} /> New Order POS
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <div className="tabs-nav" style={{ border: 'none', padding: 0 }}>
          <button 
            className={`tab-btn ${filterTab === 'all' ? 'active' : ''}`}
            onClick={() => setFilterTab('all')}
          >
            All Orders ({orders.length})
          </button>
          <button 
            className={`tab-btn ${filterTab === 'in_progress' ? 'active' : ''}`}
            onClick={() => setFilterTab('in_progress')}
          >
            In Workshop Cycle
          </button>
          <button 
            className={`tab-btn ${filterTab === 'ready' ? 'active' : ''}`}
            onClick={() => setFilterTab('ready')}
          >
            Ready for Pickup ({readyCount})
          </button>
          <button 
            className={`tab-btn ${filterTab === 'delayed' ? 'active' : ''}`}
            onClick={() => setFilterTab('delayed')}
            style={delayedCount > 0 ? { color: 'var(--danger)' } : {}}
          >
            Delayed ({delayedCount})
          </button>
          <button 
            className={`tab-btn ${filterTab === 'unpaid' ? 'active' : ''}`}
            onClick={() => setFilterTab('unpaid')}
          >
            Unpaid / Partial ({unpaidCount})
          </button>
        </div>

        <div style={{ position: 'relative', width: '280px' }}>
          <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)' }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '2.2rem', fontSize: 'var(--text-sm)' }}
            placeholder="Search order #, customer, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Orders Table */}
      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Order Number</th>
              <th>Customer</th>
              <th>Garments & Services</th>
              <th>Promised Date</th>
              <th>Current Stage</th>
              <th>Payment Status</th>
              <th>Total (₹)</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: 'var(--slate-400)' }}>
                  No orders found matching the selected filter.
                </td>
              </tr>
            ) : (
              filteredOrders.map(order => (
                <tr
                  key={order.id}
                  onClick={() => handleRowClick(order.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span className="tag-mono">{order.orderNumber}</span>
                      {order.priority === 'express' && (
                        <span className="badge badge-warning" style={{ fontSize: '9px' }}>EXPRESS</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 700, color: 'var(--slate-900)' }}>{order.customerName}</div>
                    <div style={{ fontSize: '11px', color: 'var(--slate-500)' }}>{order.customerPhone}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 'var(--text-xs)' }}>
                      {order.itemCount} Garments
                    </div>
                    <div style={{ fontSize: '10.5px', color: 'var(--slate-500)', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {order.items.map(i => i.garmentName).join(', ')}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '4px', color: order.isDelayed ? 'var(--danger-text)' : 'var(--slate-700)', fontWeight: order.isDelayed ? 700 : 500 }}>
                      <Clock size={12} />
                      {new Date(order.promisedDeliveryDate).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </td>
                  <td>
                    <StatusBadge status={order.overallStage} />
                    {order.rackLocation && (
                      <div style={{ fontSize: '10px', color: 'var(--primary-700)', fontWeight: 700, marginTop: '2px' }}>
                        Rack: {order.rackLocation}
                      </div>
                    )}
                  </td>
                  <td>
                    <StatusBadge status={order.paymentStatus} type="payment" />
                    {order.balanceAmount > 0 && (
                      <div style={{ fontSize: '10px', color: 'var(--danger)', fontWeight: 700, marginTop: '2px' }}>
                        Bal: ₹{order.balanceAmount}
                      </div>
                    )}
                  </td>
                  <td>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 'var(--text-sm)', color: 'var(--slate-900)' }}>
                      ₹{order.totalAmount}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
                      <button
                        className="btn-icon-sm btn-outline"
                        title="Print Receipt"
                        onClick={() => setSelectedReceiptOrder(order)}
                      >
                        <Printer size={13} />
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '11px', padding: '0.25rem 0.5rem' }}
                        onClick={() => handleRowClick(order.id)}
                      >
                        Details <ArrowRight size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Thermal Receipt Modal */}
      <ThermalReceiptModal
        isOpen={!!selectedReceiptOrder}
        onClose={() => setSelectedReceiptOrder(null)}
        order={selectedReceiptOrder}
      />
    </div>
  );
};
