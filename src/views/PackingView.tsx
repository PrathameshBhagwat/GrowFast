import React, { useState } from 'react';
import { useStore } from '../store';
import { PackingStationModal } from '../components/processing/PackingStationModal';
import { StatusBadge } from '../components/common/StatusBadge';
import { Order } from '../types';
import { 
  Package, 
  CheckCircle2, 
  MapPin, 
  ShoppingBag, 
  Sparkles, 
  ArrowRight,
  Boxes
} from 'lucide-react';

export const PackingView: React.FC = () => {
  const { orders, packOrder, setActiveView, setSelectedOrderId } = useStore();
  const [selectedPackingOrder, setSelectedPackingOrder] = useState<Order | null>(null);

  // Orders that are ready for packing or in QC/ironing
  const packableOrders = orders.filter(o => 
    ['quality_check', 'ironing', 'packed', 'ready'].includes(o.overallStage)
  );

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">Packing & Customer Racking Station</h1>
          <p className="page-subtitle">
            Verify all line items, assemble order bags & assign physical store rack slots
          </p>
        </div>
      </div>

      {/* Grid of Orders for Packing */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.25rem' }}>
        {packableOrders.map(order => {
          const isAlreadyPacked = order.overallStage === 'ready' || order.overallStage === 'packed';
          const totalPcs = order.items.flatMap(i => i.individualGarments).length;

          return (
            <div 
              key={order.id}
              className="card"
              style={{
                borderTop: isAlreadyPacked ? '4px solid var(--success)' : '4px solid var(--primary)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div className="card-header" style={{ padding: '0.85rem 1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="tag-mono">{order.orderNumber}</span>
                  <StatusBadge status={order.overallStage} />
                </div>
                <span style={{ fontSize: '11px', color: 'var(--slate-500)' }}>
                  {totalPcs} Garments
                </span>
              </div>

              <div className="card-body" style={{ padding: '1rem' }}>
                <div style={{ fontWeight: 800, fontSize: 'var(--text-base)', color: 'var(--slate-900)', marginBottom: '2px' }}>
                  {order.customerName}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--slate-500)', marginBottom: '0.75rem' }}>
                  📞 {order.customerPhone}
                </div>

                {/* Storage Info */}
                {order.rackLocation ? (
                  <div style={{
                    backgroundColor: 'var(--primary-50)',
                    border: '1px solid var(--primary-200)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.5rem 0.75rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.75rem'
                  }}>
                    <div>
                      <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--primary-800)', fontWeight: 700 }}>
                        Assigned Storage Slot
                      </div>
                      <div style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: 'var(--primary-700)', fontFamily: 'var(--font-mono)' }}>
                        {order.rackLocation}
                      </div>
                    </div>
                    <span className="badge badge-purple">{order.bagId || 'BAG-DEFAULT'}</span>
                  </div>
                ) : (
                  <div style={{
                    backgroundColor: 'var(--warning-bg)',
                    border: '1px solid var(--warning-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.5rem 0.75rem',
                    fontSize: '11.5px',
                    color: 'var(--warning-text)',
                    marginBottom: '0.75rem'
                  }}>
                    ⚠️ Awaiting item assembly & rack assignment
                  </div>
                )}

                {/* Item List Preview */}
                <div style={{ fontSize: '11px', color: 'var(--slate-600)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {order.items.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>• {item.garmentName} ({item.serviceName})</span>
                      <strong>×{item.quantity}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card-footer" style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button 
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    setSelectedOrderId(order.id);
                    setActiveView('order-detail');
                  }}
                >
                  Inspect Order
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => setSelectedPackingOrder(order)}
                >
                  <Package size={14} /> {isAlreadyPacked ? 'Re-assign Rack' : 'Pack Order'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Packing Modal */}
      <PackingStationModal
        isOpen={!!selectedPackingOrder}
        onClose={() => setSelectedPackingOrder(null)}
        order={selectedPackingOrder}
        onConfirmPacking={packOrder}
      />
    </div>
  );
};
