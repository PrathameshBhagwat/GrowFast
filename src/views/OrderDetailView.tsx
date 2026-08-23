import React, { useState } from 'react';
import { useStore } from '../store';
import { StatusBadge } from '../components/common/StatusBadge';
import { ThermalReceiptModal } from '../components/common/ThermalReceiptModal';
import { QCHandlerModal } from '../components/processing/QCHandlerModal';
import { PackingStationModal } from '../components/processing/PackingStationModal';
import { IndividualGarmentTag, PaymentMethod, ProcessingStage } from '../types';
import { 
  ArrowLeft, 
  Printer, 
  Share2, 
  MessageSquare, 
  IndianRupee, 
  Clock, 
  User, 
  CheckCircle2, 
  Sparkles, 
  Camera, 
  ShieldAlert, 
  CheckSquare, 
  Package, 
  Scan,
  CreditCard,
  History
} from 'lucide-react';
import { Modal } from '../components/common/Modal';

export const OrderDetailView: React.FC = () => {
  const { 
    selectedOrderId, 
    orders, 
    auditLogs, 
    setActiveView, 
    updateGarmentStatus, 
    recordQCResult, 
    packOrder, 
    recordPayment,
    setSelectedGarmentTag
  } = useStore();

  const order = orders.find(o => o.id === selectedOrderId || o.orderNumber === selectedOrderId) || orders[0];

  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false);
  const [selectedQCQCgarment, setSelectedQCQCgarment] = useState<IndividualGarmentTag | null>(null);
  const [isPackingModalOpen, setIsPackingModalOpen] = useState<boolean>(false);
  
  // Payment Collection Modal state
  const [isCollectPayModalOpen, setIsCollectPayModalOpen] = useState<boolean>(false);
  const [collectAmount, setCollectAmount] = useState<number>(order?.balanceAmount || 0);
  const [collectMethod, setCollectMethod] = useState<PaymentMethod>('cash');
  const [collectRef, setCollectRef] = useState<string>('');

  if (!order) {
    return (
      <div className="page-container">
        <button className="btn btn-secondary btn-sm" onClick={() => setActiveView('orders')}>
          <ArrowLeft size={14} /> Back to Orders
        </button>
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--slate-500)' }}>
          Order not found.
        </div>
      </div>
    );
  }

  const allGarments = order.items.flatMap(i => i.individualGarments);
  const relatedLogs = auditLogs.filter(l => l.orderNumber === order.orderNumber);

  const handleCollectPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (collectAmount > 0) {
      recordPayment(order.id, collectAmount, collectMethod, collectRef);
      setIsCollectPayModalOpen(false);
    }
  };

  const handleWhatsAppAlert = () => {
    const msg = encodeURIComponent(
      `Hello ${order.customerName}! Your TumbleDry order #${order.orderNumber} status is currently: ${order.overallStage.toUpperCase()}. Total: ₹${order.totalAmount} (Bal: ₹${order.balanceAmount}). Track anytime online.`
    );
    window.open(`https://wa.me/${order.customerPhone.replace(/[^0-9]/g, '')}?text=${msg}`, '_blank');
  };

  return (
    <div className="page-container">
      {/* Top Breadcrumb & Action Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <button className="btn btn-outline btn-sm" onClick={() => setActiveView('orders')}>
          <ArrowLeft size={14} /> Back to Orders
        </button>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button className="btn btn-outline btn-sm" onClick={handleWhatsAppAlert} style={{ color: '#059669', borderColor: '#A7F3D0' }}>
            <MessageSquare size={14} /> WhatsApp Update
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => setIsReceiptModalOpen(true)}>
            <Printer size={14} /> Print Receipt (Thermal)
          </button>
          {order.overallStage !== 'ready' && (
            <button className="btn btn-primary btn-sm" onClick={() => setIsPackingModalOpen(true)}>
              <Package size={14} /> Pack & Racking Station
            </button>
          )}
        </div>
      </div>

      {/* Main Order Info Banner */}
      <div className="card" style={{ marginBottom: '1.5rem', backgroundColor: '#FFFFFF' }}>
        <div className="card-body">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.25rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem' }}>
                <span className="tag-mono" style={{ fontSize: 'var(--text-base)', padding: '0.25rem 0.6rem' }}>
                  {order.orderNumber}
                </span>
                <StatusBadge status={order.overallStage} />
                <StatusBadge status={order.paymentStatus} type="payment" />
                {order.priority === 'express' && (
                  <span className="badge badge-warning">EXPRESS ORDER</span>
                )}
              </div>
              <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--slate-900)' }}>
                {order.customerName}
              </h2>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--slate-500)', display: 'flex', gap: '1rem', marginTop: '4px' }}>
                <span>📞 {order.customerPhone}</span>
                <span>📍 {order.customerAddress || 'Koregaon Park'}</span>
                <span>📅 Created: {new Date(order.createdAt).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Financial Summary Pill Box */}
            <div style={{
              backgroundColor: 'var(--slate-50)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-lg)',
              padding: '0.85rem 1.25rem',
              display: 'flex',
              gap: '1.5rem',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: '10.5px', color: 'var(--slate-500)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Order Total
                </div>
                <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--slate-900)', fontFamily: 'var(--font-mono)' }}>
                  ₹{order.totalAmount}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10.5px', color: 'var(--slate-500)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Paid Amount
                </div>
                <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--success-text)', fontFamily: 'var(--font-mono)' }}>
                  ₹{order.paidAmount}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10.5px', color: 'var(--slate-500)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Balance Due
                </div>
                <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: order.balanceAmount > 0 ? 'var(--danger-text)' : 'var(--slate-400)', fontFamily: 'var(--font-mono)' }}>
                  ₹{order.balanceAmount}
                </div>
              </div>

              {order.balanceAmount > 0 && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => setIsCollectPayModalOpen(true)}
                >
                  <CreditCard size={14} /> Settle Balance
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2-Column Section: Garment Items & Audit Timeline */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '1.5rem' }}>
        {/* Left: Garment-Level Tracking Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">Garment-Level Tracking Tags ({allGarments.length} Pcs)</h3>
                <p className="form-helper">Every garment has unique optical barcode & stage lifecycle</p>
              </div>
              {order.rackLocation && (
                <span className="badge badge-purple" style={{ fontSize: '11px' }}>
                  Rack Storage: {order.rackLocation} • {order.bagId}
                </span>
              )}
            </div>

            <div className="card-body" style={{ padding: '0.85rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {allGarments.map((g, idx) => (
                  <div
                    key={g.garmentTag}
                    style={{
                      padding: '0.85rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      backgroundColor: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '1rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span 
                        className="tag-mono"
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                          setSelectedGarmentTag(g.garmentTag);
                          setActiveView('garment-tracking');
                        }}
                        title="Click to open single garment track view"
                      >
                        {g.garmentTag}
                      </span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--slate-900)' }}>
                          {g.garmentName}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--primary-700)', fontWeight: 600, textTransform: 'uppercase' }}>
                          {g.service.replace('_', ' ')}
                        </div>
                      </div>
                    </div>

                    {/* Defect / Photo status */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {g.damages && g.damages.length > 0 && (
                        <span className="badge badge-danger" style={{ fontSize: '10px' }}>
                          ⚠️ {g.damages[0].type}
                        </span>
                      )}
                      {g.photoUrls && g.photoUrls.length > 0 && (
                        <span className="badge badge-info" style={{ fontSize: '10px' }}>
                          <Camera size={11} /> Photo
                        </span>
                      )}
                      {g.qcStatus && (
                        <StatusBadge status={g.qcStatus} type="qc" />
                      )}
                      <StatusBadge status={g.stage} />
                    </div>

                    {/* Stage advance / QC button */}
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <button
                        className="btn btn-outline btn-sm"
                        style={{ fontSize: '10.5px', padding: '0.25rem 0.5rem' }}
                        onClick={() => setSelectedQCQCgarment(g)}
                      >
                        <CheckSquare size={12} /> QC Inspect
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Itemized Service & Price Details */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Order Line Items & Pricing Breakdown</h3>
            </div>
            <div className="data-table-container" style={{ border: 'none', borderRadius: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Item & Treatment</th>
                    <th>Color / Fabric</th>
                    <th>Qty / Wt</th>
                    <th>Unit Rate</th>
                    <th style={{ textAlign: 'right' }}>Total (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item, i) => (
                    <tr key={i}>
                      <td>
                        <div style={{ fontWeight: 700 }}>{item.garmentName}</div>
                        <div style={{ fontSize: '11px', color: 'var(--primary-700)' }}>{item.serviceName}</div>
                      </td>
                      <td style={{ fontSize: '11px', color: 'var(--slate-600)' }}>
                        {item.color || 'Standard'} {item.fabric ? `• ${item.fabric}` : ''}
                      </td>
                      <td>
                        {item.quantity} pcs {item.weightKg ? `(${item.weightKg} kg)` : ''}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>₹{item.unitPrice}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                        ₹{item.totalPrice}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: Payment Ledger & Audit Timeline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Payment Receipts Ledger */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Payment History Ledger</h3>
              <StatusBadge status={order.paymentStatus} type="payment" />
            </div>
            <div className="card-body" style={{ padding: '0.85rem' }}>
              {order.paymentHistory.length === 0 ? (
                <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--slate-400)', fontSize: 'var(--text-xs)' }}>
                  No payment recorded yet. Balance pending.
                </div>
              ) : (
                order.paymentHistory.map(pay => (
                  <div
                    key={pay.id}
                    style={{
                      padding: '0.65rem 0.85rem',
                      backgroundColor: 'var(--slate-50)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      marginBottom: '0.4rem',
                      fontSize: 'var(--text-xs)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                      <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--success-text)', fontFamily: 'var(--font-mono)' }}>
                        ₹{pay.amount}
                      </strong>
                      <span className="badge badge-success" style={{ fontSize: '9.5px', textTransform: 'uppercase' }}>
                        {pay.method}
                      </span>
                    </div>
                    <div style={{ fontSize: '10.5px', color: 'var(--slate-500)' }}>
                      Ref: {pay.reference || 'N/A'} • Rec by {pay.recordedBy}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Operational Timeline / Audit Log */}
          <div className="card">
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <History size={16} color="var(--primary)" />
                <h3 className="card-title">Order Audit Log</h3>
              </div>
            </div>
            <div className="card-body" style={{ padding: '1rem', maxHeight: '350px', overflowY: 'auto' }}>
              {relatedLogs.length === 0 ? (
                <div style={{ fontSize: '11px', color: 'var(--slate-400)', textAlign: 'center', padding: '1rem' }}>
                  No historical logs recorded.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', position: 'relative', paddingLeft: '1rem', borderLeft: '2px solid var(--border-color)' }}>
                  {relatedLogs.map(log => (
                    <div key={log.id} style={{ position: 'relative' }}>
                      <div style={{
                        position: 'absolute',
                        left: '-1.35rem',
                        top: '2px',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--primary-600)'
                      }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: 'var(--slate-400)', marginBottom: '1px' }}>
                        <span>{log.timestamp} • {log.staffName}</span>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 'var(--text-xs)', color: 'var(--slate-900)' }}>
                        {log.action}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--slate-600)', marginTop: '2px' }}>
                        {log.details}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Thermal Receipt Modal */}
      <ThermalReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        order={order}
      />

      {/* QC Modal */}
      <QCHandlerModal
        isOpen={!!selectedQCQCgarment}
        onClose={() => setSelectedQCQCgarment(null)}
        garment={selectedQCQCgarment}
        onQCSubmit={recordQCResult}
      />

      {/* Packing Modal */}
      <PackingStationModal
        isOpen={isPackingModalOpen}
        onClose={() => setIsPackingModalOpen(false)}
        order={order}
        onConfirmPacking={packOrder}
      />

      {/* Settle Balance Modal */}
      <Modal
        isOpen={isCollectPayModalOpen}
        onClose={() => setIsCollectPayModalOpen(false)}
        title="Settle Order Outstanding Balance"
        subtitle={`Collect remaining balance of ₹${order.balanceAmount} from ${order.customerName}`}
        size="sm"
      >
        <form onSubmit={handleCollectPayment}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div className="form-group">
              <label className="form-label">Payment Amount (₹)</label>
              <input
                type="number"
                max={order.balanceAmount}
                min="1"
                className="form-input form-input-mono"
                value={collectAmount}
                onChange={(e) => setCollectAmount(parseInt(e.target.value) || 0)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Payment Mode</label>
              <select
                className="form-select"
                value={collectMethod}
                onChange={(e) => setCollectMethod(e.target.value as PaymentMethod)}
              >
                <option value="cash">Cash</option>
                <option value="upi">UPI (GPay / PhonePe / Paytm)</option>
                <option value="card">Card (POS Machine)</option>
                <option value="online">Online Payment Link</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Transaction Reference #</label>
              <input
                type="text"
                className="form-input form-input-mono"
                placeholder="e.g. UPI-TXN-981245"
                value={collectRef}
                onChange={(e) => setCollectRef(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsCollectPayModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Record Payment
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};
