import React, { useState } from 'react';
import { useStore } from '../store';
import { DeliveryTask } from '../types';
import { 
  Truck, 
  MapPin, 
  Phone, 
  CheckCircle2, 
  Clock, 
  Navigation, 
  ShoppingBag, 
  IndianRupee, 
  Plus, 
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { Modal } from '../components/common/Modal';

export const DeliveryDispatchView: React.FC = () => {
  const { deliveryTasks, updateDeliveryTaskStatus, setActiveView, setSelectedOrderId } = useStore();
  const [activeTab, setActiveTab] = useState<string>('all');
  const [completePodTask, setCompletePodTask] = useState<DeliveryTask | null>(null);
  const [collectedAmount, setCollectedAmount] = useState<number>(0);
  const [podNote, setPodNote] = useState<string>('Handed over in sealed garment bag to customer.');

  const filteredTasks = deliveryTasks.filter(t => 
    activeTab === 'all' || t.status === activeTab
  );

  const handleOpenPOD = (task: DeliveryTask) => {
    setCompletePodTask(task);
    setCollectedAmount(task.amountToCollect || 0);
  };

  const handleConfirmPOD = (e: React.FormEvent) => {
    e.preventDefault();
    if (completePodTask) {
      updateDeliveryTaskStatus(completePodTask.id, 'completed');
      setCompletePodTask(null);
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">Fleet Dispatch & Delivery Board</h1>
          <p className="page-subtitle">
            Manage doorstep customer pickups, delivery routes, payment collection & proof of delivery
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="metric-grid">
        <div className="metric-card">
          <div className="metric-top">
            <span className="metric-label">Today's Dispatch Tasks</span>
            <div className="metric-icon-box" style={{ backgroundColor: 'var(--primary-50)', color: 'var(--primary-600)' }}>
              <Truck size={20} />
            </div>
          </div>
          <div className="metric-value">{deliveryTasks.length} Tasks</div>
          <div style={{ fontSize: '11px', color: 'var(--slate-500)' }}>
            Koregaon Park & Hadapsar routes
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-top">
            <span className="metric-label">Cash on Delivery Pending</span>
            <div className="metric-icon-box" style={{ backgroundColor: 'var(--warning-bg)', color: 'var(--warning-text)' }}>
              <IndianRupee size={20} />
            </div>
          </div>
          <div className="metric-value" style={{ color: 'var(--warning-text)' }}>
            ₹{deliveryTasks.reduce((acc, t) => acc + (t.amountToCollect || 0), 0)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--slate-500)' }}>
            To be collected at doorstep
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div className="tabs-nav" style={{ border: 'none', padding: 0 }}>
          <button 
            className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            All Tasks ({deliveryTasks.length})
          </button>
          <button 
            className={`tab-btn ${activeTab === 'assigned' ? 'active' : ''}`}
            onClick={() => setActiveTab('assigned')}
          >
            In Transit / Assigned
          </button>
          <button 
            className={`tab-btn ${activeTab === 'completed' ? 'active' : ''}`}
            onClick={() => setActiveTab('completed')}
          >
            Completed
          </button>
        </div>
      </div>

      {/* Tasks Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.25rem' }}>
        {filteredTasks.map(task => {
          const isCompleted = task.status === 'completed';
          const isPickup = task.type === 'pickup';

          return (
            <div
              key={task.id}
              className="card"
              style={{
                borderLeft: isPickup ? '4px solid var(--info)' : '4px solid var(--primary)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div className="card-header" style={{ padding: '0.85rem 1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className={`badge ${isPickup ? 'badge-info' : 'badge-purple'}`}>
                    {isPickup ? '📦 PICKUP' : '🚚 DELIVERY'}
                  </span>
                  {task.orderNumber && (
                    <span className="tag-mono">{task.orderNumber}</span>
                  )}
                </div>
                <span className={`badge ${isCompleted ? 'badge-success' : 'badge-warning'}`}>
                  {task.status.toUpperCase()}
                </span>
              </div>

              <div className="card-body" style={{ padding: '1rem' }}>
                <div style={{ fontWeight: 800, fontSize: 'var(--text-base)', color: 'var(--slate-900)', marginBottom: '2px' }}>
                  {task.customerName}
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--slate-500)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '0.5rem' }}>
                  <Phone size={12} /> {task.customerPhone}
                </div>

                <div style={{
                  backgroundColor: 'var(--slate-50)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.65rem 0.85rem',
                  fontSize: '11.5px',
                  marginBottom: '0.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', color: 'var(--slate-800)' }}>
                    <MapPin size={14} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--primary)' }} />
                    <span>{task.address}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--slate-500)', fontSize: '10.5px' }}>
                    <Clock size={12} /> Slot: {task.scheduledTime}
                  </div>
                </div>

                {task.notes && (
                  <div style={{ fontSize: '11px', color: 'var(--slate-600)', fontStyle: 'italic', marginBottom: '0.5rem' }}>
                    💬 Note: {task.notes}
                  </div>
                )}

                {task.amountToCollect && task.amountToCollect > 0 ? (
                  <div style={{
                    padding: '0.4rem 0.65rem',
                    backgroundColor: 'var(--warning-bg)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    color: 'var(--warning-text)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span>Cash on Delivery to Collect:</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>₹{task.amountToCollect}</span>
                  </div>
                ) : null}
              </div>

              <div className="card-footer" style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                <a
                  href={`tel:${task.customerPhone.replace(/[^0-9]/g, '')}`}
                  className="btn btn-outline btn-sm"
                  style={{ textDecoration: 'none' }}
                >
                  <Phone size={12} /> Call Customer
                </a>

                {isCompleted ? (
                  <span className="badge badge-success" style={{ padding: '0.4rem 0.75rem' }}>
                    ✓ Completed & Verified
                  </span>
                ) : (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleOpenPOD(task)}
                  >
                    <CheckCircle2 size={13} /> Confirm Proof of Delivery
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Proof of Delivery Modal */}
      <Modal
        isOpen={!!completePodTask}
        onClose={() => setCompletePodTask(null)}
        title={`Confirm Doorstep Handover — ${completePodTask?.customerName}`}
        subtitle={`Address: ${completePodTask?.address}`}
        size="md"
      >
        <form onSubmit={handleConfirmPOD}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {completePodTask?.amountToCollect && completePodTask.amountToCollect > 0 ? (
              <div className="form-group">
                <label className="form-label">
                  <span>Amount Collected (₹)</span>
                  <span className="form-helper">Cash or Doorstep UPI</span>
                </label>
                <input
                  type="number"
                  className="form-input form-input-mono"
                  style={{ fontSize: 'var(--text-lg)', fontWeight: 800 }}
                  value={collectedAmount}
                  onChange={(e) => setCollectedAmount(parseInt(e.target.value) || 0)}
                  required
                />
              </div>
            ) : null}

            <div className="form-group">
              <label className="form-label">Proof of Delivery Note</label>
              <input
                type="text"
                className="form-input"
                value={podNote}
                onChange={(e) => setPodNote(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setCompletePodTask(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Confirm Handover & Complete Task
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};
