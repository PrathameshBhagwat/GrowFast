import React, { useState } from 'react';
import { Customer, OrderItem } from '../../types';
import { 
  ShoppingBag, 
  Trash2, 
  Tag, 
  Zap, 
  ArrowRight, 
  AlertCircle, 
  Sparkles, 
  Camera, 
  ShieldAlert,
  Percent,
  IndianRupee
} from 'lucide-react';

interface OrderSummarySidebarProps {
  customer: Customer | null;
  items: OrderItem[];
  onRemoveItem: (itemId: string) => void;
  onClearDraft: () => void;
  onProceedToPayment: (summary: {
    subtotal: number;
    discountAmount: number;
    discountType: 'flat' | 'percentage';
    expressSurcharge: number;
    taxAmount: number;
    totalAmount: number;
  }) => void;
}

export const OrderSummarySidebar: React.FC<OrderSummarySidebarProps> = ({
  customer,
  items,
  onRemoveItem,
  onClearDraft,
  onProceedToPayment
}) => {
  const [discountValue, setDiscountValue] = useState<number>(50); // Default ₹50 promo as per demo spec
  const [discountType, setDiscountType] = useState<'flat' | 'percentage'>('flat');
  const [isExpressOrder, setIsExpressOrder] = useState<boolean>(false);

  // Calculations
  const totalGarmentCount = items.reduce((acc, item) => acc + item.quantity, 0);
  const subtotal = items.reduce((acc, item) => acc + item.totalPrice, 0);

  const discountAmount = discountType === 'flat' 
    ? Math.min(subtotal, discountValue) 
    : Math.round((subtotal * discountValue) / 100);

  const expressSurcharge = isExpressOrder ? Math.round(subtotal * 0.25) : 0;
  const taxAmount = 0; // Laundry standard retail exempt/composite
  const totalAmount = Math.max(0, subtotal - discountAmount + expressSurcharge + taxAmount);

  const handlePaymentClick = () => {
    onProceedToPayment({
      subtotal,
      discountAmount,
      discountType,
      expressSurcharge,
      taxAmount,
      totalAmount
    });
  };

  return (
    <div className="pos-sidebar-summary">
      {/* Header */}
      <div className="pos-summary-header">
        <div className="pos-summary-title">
          <ShoppingBag size={18} color="var(--primary)" />
          <span>Current Order Summary</span>
        </div>
        <span className="badge badge-neutral" style={{ fontWeight: 700 }}>
          {totalGarmentCount} {totalGarmentCount === 1 ? 'Garment' : 'Garments'}
        </span>
      </div>

      {/* Items List */}
      <div className="pos-items-list">
        {items.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            textAlign: 'center',
            color: 'var(--slate-400)',
            padding: '2rem 1rem'
          }}>
            <ShoppingBag size={48} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
            <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--slate-600)' }}>
              No garments added yet
            </div>
            <p style={{ fontSize: '11px', marginTop: '4px' }}>
              Select garments from the left catalog to configure services & condition
            </p>
          </div>
        ) : (
          items.map((item, idx) => (
            <div key={item.id} className="pos-summary-item">
              <div className="pos-item-top">
                <div>
                  <div className="pos-item-title">
                    {item.garmentName}
                    <span style={{ fontWeight: 500, color: 'var(--slate-500)', fontSize: '11px', marginLeft: '6px' }}>
                      × {item.quantity}{item.weightKg ? ` (${item.weightKg}kg)` : ''}
                    </span>
                  </div>
                  <div className="pos-item-service">{item.serviceName}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div className="pos-item-price">₹{item.totalPrice}</div>
                  <button
                    className="btn-icon-sm btn-ghost"
                    onClick={() => onRemoveItem(item.id)}
                    title="Remove item"
                  >
                    <Trash2 size={13} color="var(--slate-400)" />
                  </button>
                </div>
              </div>

              {/* Badges / condition tags */}
              <div className="pos-item-details">
                {item.color && <span>🎨 {item.color}</span>}
                {item.fabric && <span>🧵 {item.fabric}</span>}
                {item.damages && item.damages.length > 0 && (
                  <span style={{ color: 'var(--danger-text)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                    <ShieldAlert size={11} /> {item.damages.length} Damage{item.damages.length > 1 ? 's' : ''}
                  </span>
                )}
                {item.photos && item.photos.length > 0 && (
                  <span style={{ color: 'var(--primary-700)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                    <Camera size={11} /> {item.photos.length} Photo{item.photos.length > 1 ? 's' : ''}
                  </span>
                )}
                {item.specialInstructions && (
                  <span style={{ color: 'var(--slate-600)', fontStyle: 'italic' }}>
                    💬 {item.specialInstructions}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Bill Calculations & Actions */}
      <div className="pos-summary-footer">
        {/* Discount & Express quick inputs */}
        {items.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '11.5px', color: 'var(--slate-700)', fontWeight: 600 }}>
                <Tag size={13} color="var(--primary)" />
                <span>Store Discount</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <input
                  type="number"
                  min="0"
                  style={{ width: '65px', padding: '0.25rem 0.4rem', fontSize: '11px', textAlign: 'right' }}
                  className="form-input form-input-mono"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(Math.max(0, parseInt(e.target.value) || 0))}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '0.25rem 0.45rem', fontSize: '10px' }}
                  onClick={() => setDiscountType(discountType === 'flat' ? 'percentage' : 'flat')}
                >
                  {discountType === 'flat' ? '₹ Flat' : '% Off'}
                </button>
              </div>
            </div>

            {/* Express surcharge toggle */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.35rem 0.5rem',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: isExpressOrder ? 'var(--warning-bg)' : 'transparent',
              fontSize: '11px'
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontWeight: 600, color: 'var(--slate-700)' }}>
                <input
                  type="checkbox"
                  checked={isExpressOrder}
                  onChange={(e) => setIsExpressOrder(e.target.checked)}
                />
                <span>Express Order (+25%)</span>
              </label>
              {isExpressOrder && (
                <span style={{ fontWeight: 700, color: 'var(--warning-text)', fontFamily: 'var(--font-mono)' }}>
                  +₹{expressSurcharge}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Totals Breakdown */}
        <div className="bill-calc-row">
          <span>Subtotal ({totalGarmentCount} items):</span>
          <span className="bill-calc-value">₹{subtotal}</span>
        </div>

        {discountAmount > 0 && (
          <div className="bill-calc-row" style={{ color: 'var(--success-text)' }}>
            <span>Discount Applied:</span>
            <span className="bill-calc-value">-₹{discountAmount}</span>
          </div>
        )}

        {expressSurcharge > 0 && (
          <div className="bill-calc-row" style={{ color: 'var(--warning-text)' }}>
            <span>Express Surcharge:</span>
            <span className="bill-calc-value">+₹{expressSurcharge}</span>
          </div>
        )}

        <div className="bill-calc-row total-row">
          <span>Total Payable:</span>
          <span className="bill-calc-value">₹{totalAmount}</span>
        </div>

        {/* Action CTAs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
          {items.length > 0 && (
            <button 
              className="btn btn-outline" 
              style={{ flex: 1, fontSize: '11.5px' }}
              onClick={onClearDraft}
            >
              Clear
            </button>
          )}
          <button
            className="btn btn-primary"
            style={{ flex: 2, padding: '0.75rem 1rem' }}
            disabled={items.length === 0 || !customer}
            onClick={handlePaymentClick}
          >
            <span>Proceed to Payment</span>
            <ArrowRight size={16} />
          </button>
        </div>

        {!customer && items.length > 0 && (
          <div style={{ fontSize: '11px', color: 'var(--danger)', textAlign: 'center', marginTop: '2px' }}>
            ⚠️ Please select or register a customer first
          </div>
        )}
      </div>
    </div>
  );
};
