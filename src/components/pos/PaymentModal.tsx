import React, { useState } from 'react';
import { Customer, OrderItem, PaymentMethod, PaymentRecord } from '../../types';
import { Modal } from '../common/Modal';
import { 
  CheckCircle2, 
  CreditCard, 
  QrCode, 
  Banknote, 
  Smartphone, 
  Wallet, 
  ArrowRight,
  ShieldCheck,
  RotateCcw
} from 'lucide-react';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
  items: OrderItem[];
  subtotal: number;
  discountAmount: number;
  discountType: 'flat' | 'percentage';
  expressSurcharge: number;
  taxAmount: number;
  totalAmount: number;
  onConfirmOrder: (paymentDetails: {
    paidAmount: number;
    balanceAmount: number;
    paymentMethod: PaymentMethod;
    paymentStatus: 'paid' | 'partial' | 'pending';
    reference?: string;
  }) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  customer,
  items,
  subtotal,
  discountAmount,
  discountType,
  expressSurcharge,
  taxAmount,
  totalAmount,
  onConfirmOrder
}) => {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('upi');
  const [paidAmount, setPaidAmount] = useState<number>(500); // Default to ₹500 partial payment as per prompt demo
  const [reference, setReference] = useState<string>('UPI/623489110023');

  const balanceAmount = Math.max(0, totalAmount - paidAmount);
  const paymentStatus = balanceAmount === 0 ? 'paid' : (paidAmount > 0 ? 'partial' : 'pending');

  const handleQuickAmount = (amount: number) => {
    setPaidAmount(amount);
  };

  const handleComplete = () => {
    onConfirmOrder({
      paidAmount,
      balanceAmount,
      paymentMethod,
      paymentStatus,
      reference: reference.trim() || undefined
    });
  };

  const paymentOptions = [
    { id: 'upi', label: 'UPI / Dynamic QR', icon: QrCode, desc: 'Google Pay, PhonePe, Paytm' },
    { id: 'cash', label: 'Counter Cash', icon: Banknote, desc: 'Physical currency collected' },
    { id: 'card', label: 'Card (EDC POS)', icon: CreditCard, desc: 'Visa, Mastercard, RuPay' },
    { id: 'store_credit', label: 'Store Credit / Pay Later', icon: Wallet, desc: 'Post-delivery collection' }
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ShieldCheck size={20} color="var(--primary)" />
          <span>Collect Payment & Confirm Order</span>
        </div>
      }
      subtitle={`Customer: ${customer.name} (${customer.phone})`}
      size="lg"
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div>
            <span style={{ fontSize: '11px', color: 'var(--slate-500)' }}>
              Status: <strong style={{ textTransform: 'uppercase', color: paymentStatus === 'paid' ? 'var(--success)' : 'var(--warning)' }}>{paymentStatus}</strong>
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary btn-lg" onClick={handleComplete}>
              <CheckCircle2 size={18} /> Confirm & Generate Invoice
            </button>
          </div>
        </div>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem' }}>
        {/* Left Column: Payment Methods & Split Amount */}
        <div>
          <label className="form-label" style={{ marginBottom: '0.5rem' }}>
            <span>Select Payment Mode</span>
          </label>
          <div className="payment-methods-grid">
            {paymentOptions.map(opt => {
              const Icon = opt.icon;
              const isSelected = paymentMethod === opt.id;
              return (
                <div
                  key={opt.id}
                  className={`payment-method-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => setPaymentMethod(opt.id as PaymentMethod)}
                >
                  <Icon size={24} color={isSelected ? 'var(--primary-600)' : 'var(--slate-600)'} />
                  <div style={{ fontWeight: 700, fontSize: 'var(--text-xs)', textAlign: 'center' }}>
                    {opt.label}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--slate-400)', textAlign: 'center' }}>
                    {opt.desc}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Amount Paid Stepper / Quick Presets */}
          <div className="form-group">
            <label className="form-label">
              <span>Amount Collected Now</span>
              <span className="form-helper">Supports full or partial payment</span>
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input
                type="number"
                min="0"
                max={totalAmount}
                className="form-input form-input-mono"
                style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--slate-900)' }}
                value={paidAmount}
                onChange={(e) => setPaidAmount(Math.min(totalAmount, Math.max(0, parseInt(e.target.value) || 0)))}
              />
            </div>

            {/* Quick Presets */}
            <div className="chip-row">
              <button
                type="button"
                className={`chip-btn ${paidAmount === totalAmount ? 'active' : ''}`}
                onClick={() => handleQuickAmount(totalAmount)}
              >
                Full Amount (₹{totalAmount})
              </button>
              <button
                type="button"
                className={`chip-btn ${paidAmount === 500 ? 'active' : ''}`}
                onClick={() => handleQuickAmount(500)}
              >
                ₹500 (Advance)
              </button>
              <button
                type="button"
                className={`chip-btn ${paidAmount === Math.round(totalAmount / 2) ? 'active' : ''}`}
                onClick={() => handleQuickAmount(Math.round(totalAmount / 2))}
              >
                50% (₹{Math.round(totalAmount / 2)})
              </button>
              <button
                type="button"
                className={`chip-btn ${paidAmount === 0 ? 'active' : ''}`}
                onClick={() => handleQuickAmount(0)}
              >
                ₹0 (Pay on Pickup)
              </button>
            </div>
          </div>

          {/* Reference ID */}
          <div className="form-group" style={{ marginTop: '0.75rem' }}>
            <label className="form-label">
              <span>Transaction Reference / Note</span>
            </label>
            <input
              type="text"
              className="form-input form-input-mono"
              placeholder="e.g. UPI Ref / Cash register bill #"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>
        </div>

        {/* Right Column: Live Bill Card & Simulated Dynamic QR */}
        <div style={{
          backgroundColor: 'var(--slate-50)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--slate-500)', marginBottom: '0.75rem' }}>
              Final Order Breakdown
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: 'var(--text-xs)', color: 'var(--slate-600)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Item Subtotal ({items.reduce((a, b) => a + b.quantity, 0)} pcs):</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>₹{subtotal}</span>
              </div>
              {discountAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success-text)' }}>
                  <span>Discount Applied:</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>-₹{discountAmount}</span>
                </div>
              )}
              {expressSurcharge > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--warning-text)' }}>
                  <span>Express Surcharge:</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>+₹{expressSurcharge}</span>
                </div>
              )}

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 'var(--text-base)',
                fontWeight: 800,
                color: 'var(--slate-900)',
                borderTop: '1px dashed var(--border-color)',
                paddingTop: '0.5rem',
                marginTop: '0.25rem'
              }}>
                <span>Total Amount:</span>
                <span style={{ color: 'var(--primary-700)', fontFamily: 'var(--font-mono)' }}>₹{totalAmount}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success-text)', fontWeight: 600 }}>
                <span>Paid Now:</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>₹{paidAmount}</span>
              </div>

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontWeight: 800,
                color: balanceAmount > 0 ? 'var(--danger-text)' : 'var(--slate-500)',
                fontSize: 'var(--text-sm)',
                borderTop: '1px solid var(--border-color)',
                paddingTop: '0.35rem'
              }}>
                <span>Balance Remaining:</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>₹{balanceAmount}</span>
              </div>
            </div>
          </div>

          {/* If UPI is selected: show QR Preview */}
          {paymentMethod === 'upi' && (
            <div style={{
              marginTop: '1rem',
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--primary-200)',
              borderRadius: 'var(--radius-md)',
              padding: '0.85rem',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.35rem'
            }}>
              <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--primary-800)' }}>
                DYNAMIC STORE UPI QR CODE
              </div>
              <div style={{
                width: '100px',
                height: '100px',
                background: '#FFFFFF',
                border: '1px solid var(--slate-300)',
                padding: '6px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <QrCode size={80} color="#0F172A" />
              </div>
              <div style={{ fontSize: '10px', color: 'var(--slate-500)', fontFamily: 'var(--font-mono)' }}>
                upi://pay?pa=tumbledry.pune@icici&am={paidAmount}
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
