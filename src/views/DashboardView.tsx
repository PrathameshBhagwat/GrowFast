import React from 'react';
import { useStore } from '../store';
import { 
  ShoppingBag, 
  IndianRupee, 
  Clock, 
  AlertTriangle, 
  Sparkles, 
  CheckCircle2, 
  PlusCircle, 
  TrendingUp, 
  Users, 
  Boxes, 
  ArrowUpRight,
  Package,
  Truck
} from 'lucide-react';
import { RevenueBarChart, ServiceDonutChart } from '../components/charts/RevenueBarChart';
import { StatusBadge } from '../components/common/StatusBadge';

export const DashboardView: React.FC = () => {
  const { currentRole, orders, inventory, expenses, setActiveView, setSelectedOrderId } = useStore();

  const totalOrders = orders.length;
  const delayedOrders = orders.filter(o => o.isDelayed);
  const readyOrders = orders.filter(o => o.overallStage === 'ready');
  const inProcessOrders = orders.filter(o => ['received', 'sorting', 'processing', 'drying', 'ironing', 'quality_check'].includes(o.overallStage));
  const unpaidOrders = orders.filter(o => o.paymentStatus !== 'paid');

  const todayRevenue = orders.reduce((acc, o) => acc + o.paidAmount, 0);
  const pendingRevenue = orders.reduce((acc, o) => acc + o.balanceAmount, 0);
  const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);
  const lowStockItems = inventory.filter(i => i.currentStock <= i.lowStockThreshold);

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">
            {currentRole === 'manager' && 'Store Executive Command Dashboard'}
            {currentRole === 'counter' && 'Counter Operations Overview'}
            {currentRole === 'processing' && 'Workshop & Plant Status'}
            {currentRole === 'rider' && 'Fleet & Dispatch Dashboard'}
          </h1>
          <p className="page-subtitle">
            Koregaon Park Main Hub • Live operations & bottleneck telemetry
          </p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setActiveView('pos')}>
            <PlusCircle size={16} /> New Order POS
          </button>
        </div>
      </div>

      {/* Actionable KPIs */}
      <div className="metric-grid">
        <div className="metric-card">
          <div className="metric-top">
            <span className="metric-label">Today's Revenue</span>
            <div className="metric-icon-box" style={{ backgroundColor: 'var(--primary-50)', color: 'var(--primary-600)' }}>
              <IndianRupee size={20} />
            </div>
          </div>
          <div className="metric-value">₹{todayRevenue.toLocaleString('en-IN')}</div>
          <div className="metric-trend positive">
            <TrendingUp size={14} /> +18.4% vs last Saturday
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-top">
            <span className="metric-label">Active Work In-Store</span>
            <div className="metric-icon-box" style={{ backgroundColor: 'var(--purple-bg)', color: 'var(--purple-text)' }}>
              <Sparkles size={20} />
            </div>
          </div>
          <div className="metric-value">{inProcessOrders.length} Orders</div>
          <div style={{ fontSize: '11px', color: 'var(--slate-500)' }}>
            {orders.flatMap(o => o.items.flatMap(i => i.individualGarments)).length} Total Garments in cycle
          </div>
        </div>

        <div className="metric-card" style={{ borderLeft: '3px solid var(--success)' }}>
          <div className="metric-top">
            <span className="metric-label">Ready for Pickup / Bagged</span>
            <div className="metric-icon-box" style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success-text)' }}>
              <CheckCircle2 size={20} />
            </div>
          </div>
          <div className="metric-value" style={{ color: 'var(--success-text)' }}>
            {readyOrders.length} Orders
          </div>
          <div style={{ fontSize: '11px', color: 'var(--slate-500)' }}>
            Stored on customer racks
          </div>
        </div>

        <div className="metric-card" style={{ borderLeft: delayedOrders.length > 0 ? '3px solid var(--danger)' : undefined }}>
          <div className="metric-top">
            <span className="metric-label">Delayed Deliveries</span>
            <div className="metric-icon-box" style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger-text)' }}>
              <AlertTriangle size={20} />
            </div>
          </div>
          <div className="metric-value" style={{ color: delayedOrders.length > 0 ? 'var(--danger-text)' : 'var(--slate-900)' }}>
            {delayedOrders.length}
          </div>
          <div className="metric-trend negative" style={{ color: 'var(--danger-text)' }}>
            Requires priority dispatch
          </div>
        </div>
      </div>

      {/* Main Grid: Charts & Operations Feed */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Weekly Revenue & Volume Chart */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">7-Day Store Revenue Velocity</h3>
              <p className="form-helper">Daily collections across Walk-in & Pickups</p>
            </div>
            <span className="badge badge-info">₹1,44,150 Week Total</span>
          </div>
          <div className="card-body">
            <RevenueBarChart />
          </div>
        </div>

        {/* Service Volume Split Donut */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Service Revenue Distribution</h3>
              <p className="form-helper">Product mix across dry cleaning & washes</p>
            </div>
          </div>
          <div className="card-body">
            <ServiceDonutChart />
          </div>
        </div>
      </div>

      {/* Bottom Section: Urgent Orders & Actionable Operational Feed */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1.5rem' }}>
        {/* Recent Orders Priority Table */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Recent Customer Orders</h3>
            <button className="btn btn-outline btn-sm" onClick={() => setActiveView('orders')}>
              View All ({totalOrders})
            </button>
          </div>
          <div className="data-table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Customer</th>
                  <th>Garments</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {orders.slice(0, 5).map(o => (
                  <tr
                    key={o.id}
                    onClick={() => {
                      setSelectedOrderId(o.id);
                      setActiveView('order-detail');
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <td><span className="tag-mono">{o.orderNumber}</span></td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{o.customerName}</div>
                      <div style={{ fontSize: '10.5px', color: 'var(--slate-500)' }}>{o.customerPhone}</div>
                    </td>
                    <td>{o.itemCount} pcs</td>
                    <td><StatusBadge status={o.overallStage} /></td>
                    <td><StatusBadge status={o.paymentStatus} type="payment" /></td>
                    <td style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>₹{o.totalAmount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Store Health & Alerts */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Bottleneck & Inventory Telemetry</h3>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {lowStockItems.map(item => (
              <div 
                key={item.id}
                style={{
                  padding: '0.75rem',
                  backgroundColor: 'var(--warning-bg)',
                  border: '1px solid var(--warning-border)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 'var(--text-xs)', color: 'var(--warning-text)' }}>
                    ⚠️ Low Stock: {item.name}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--slate-600)' }}>
                    Remaining: {item.currentStock} {item.unit} (Threshold: {item.lowStockThreshold})
                  </div>
                </div>
                <button 
                  className="btn btn-secondary btn-sm" 
                  style={{ fontSize: '10.5px' }}
                  onClick={() => setActiveView('inventory')}
                >
                  Restock
                </button>
              </div>
            ))}

            <div style={{
              padding: '0.85rem',
              backgroundColor: 'var(--slate-50)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem',
              fontSize: 'var(--text-xs)'
            }}>
              <div style={{ fontWeight: 700, color: 'var(--slate-900)' }}>Financial Summary (MTD)</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--slate-600)' }}>
                <span>Total Month Revenue:</span>
                <strong style={{ fontFamily: 'var(--font-mono)' }}>₹5,82,400</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--slate-600)' }}>
                <span>Operating Expenses:</span>
                <strong style={{ fontFamily: 'var(--font-mono)' }}>₹69,650</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success-text)', borderTop: '1px solid var(--border-color)', paddingTop: '4px', fontWeight: 700 }}>
                <span>Estimated Operating Margin:</span>
                <span>88.0%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
