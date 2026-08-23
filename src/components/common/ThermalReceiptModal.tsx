import React from 'react';
import { Modal } from './Modal';
import { Printer, Share2, CheckCircle2, MessageSquare, Download } from 'lucide-react';
import { Order } from '../../types';

interface ThermalReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
}

export const ThermalReceiptModal: React.FC<ThermalReceiptModalProps> = ({
  isOpen,
  onClose,
  order
}) => {
  if (!order) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(
      `Hello ${order.customerName}! Your TumbleDry order #${order.orderNumber} (Total: ₹${order.totalAmount}, Paid: ₹${order.paidAmount}, Bal: ₹${order.balanceAmount}) is confirmed. Track status online anytime.`
    );
    window.open(`https://wa.me/${order.customerPhone.replace(/[^0-9]/g, '')}?text=${text}`, '_blank');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Printer size={20} color="var(--primary)" />
          <span>Thermal POS Invoice Receipt — {order.orderNumber}</span>
        </div>
      }
      subtitle="Standard 80mm high-speed thermal receipt printer format"
      size="md"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          <button className="btn btn-outline" onClick={handleWhatsAppShare} style={{ color: '#059669', borderColor: '#A7F3D0' }}>
            <MessageSquare size={16} /> Send on WhatsApp
          </button>
          <button className="btn btn-primary" onClick={handlePrint}>
            <Printer size={16} /> Print Receipt (ESC/POS)
          </button>
        </>
      }
    >
      <div className="printable-area" style={{ display: 'flex', justifyContent: 'center', padding: '0.5rem 0' }}>
        <div className="thermal-receipt">
          {/* Header */}
          <div className="receipt-header">
            <div className="receipt-store-title">TUMBLEDRY STORE</div>
            <div style={{ fontSize: '10px', color: '#444', marginTop: '2px' }}>Koregaon Park Branch, Pune</div>
            <div style={{ fontSize: '10px', color: '#444' }}>Phone: +91 20 6712 9000 • GST: 27AABCU9603R1ZM</div>
            <div style={{ margin: '8px 0', borderTop: '1px dashed #000' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
              <span>INVOICE #{order.orderNumber}</span>
              <span>{new Date(order.createdAt).toLocaleDateString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
              <span>Customer: {order.customerName}</span>
              <span>{order.customerPhone}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginTop: '2px' }}>
              <span>Delivery by:</span>
              <span style={{ fontWeight: 'bold' }}>{new Date(order.promisedDeliveryDate).toLocaleDateString()}</span>
            </div>
          </div>

          {/* Items Table */}
          <table className="receipt-table">
            <thead>
              <tr style={{ borderBottom: '1px solid #000', textAlign: 'left', fontSize: '10px' }}>
                <th style={{ paddingBottom: '4px' }}>ITEM & SERVICE</th>
                <th style={{ paddingBottom: '4px', textAlign: 'center' }}>QTY</th>
                <th style={{ paddingBottom: '4px', textAlign: 'right' }}>AMT (₹)</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, idx) => (
                <tr key={idx} style={{ verticalAlign: 'top' }}>
                  <td style={{ padding: '3px 0' }}>
                    <div style={{ fontWeight: 'bold' }}>{item.garmentName}</div>
                    <div style={{ fontSize: '9.5px', color: '#555' }}>
                      {item.serviceName} {item.weightKg ? `(${item.weightKg}kg)` : ''}
                      {item.color ? ` • ${item.color}` : ''}
                    </div>
                  </td>
                  <td style={{ textAlign: 'center', padding: '3px 0' }}>{item.quantity}</td>
                  <td style={{ textAlign: 'right', padding: '3px 0', fontWeight: 'bold' }}>
                    ₹{item.totalPrice}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Financial Breakdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11px', marginBottom: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Item Subtotal ({order.itemCount} garments):</span>
              <span>₹{order.subtotal}</span>
            </div>
            {order.discountAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#000' }}>
                <span>Discount Applied:</span>
                <span>-₹{order.discountAmount}</span>
              </div>
            )}
            {order.expressSurcharge > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Express Surcharge:</span>
                <span>+₹{order.expressSurcharge}</span>
              </div>
            )}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontWeight: '900',
              fontSize: '14px',
              borderTop: '1px dashed #000',
              paddingTop: '4px',
              marginTop: '4px'
            }}>
              <span>TOTAL AMOUNT:</span>
              <span>₹{order.totalAmount}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Amount Paid ({order.paymentMethod?.toUpperCase() || 'N/A'}):</span>
              <span>₹{order.paidAmount}</span>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontWeight: 'bold',
              color: order.balanceAmount > 0 ? '#000' : '#444'
            }}>
              <span>BALANCE DUE:</span>
              <span>₹{order.balanceAmount}</span>
            </div>
          </div>

          {/* Garment Tag Identifiers */}
          <div style={{ borderTop: '1px dashed #000', paddingTop: '6px', marginBottom: '8px', fontSize: '9px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>GARMENT TRACKING TAGS:</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {order.items.flatMap(i => i.individualGarments).map(g => (
                <span key={g.garmentTag} style={{ background: '#F1F5F9', padding: '1px 3px', border: '1px solid #CCC' }}>
                  {g.garmentTag}
                </span>
              ))}
            </div>
          </div>

          {/* Footer Note */}
          <div style={{ textAlign: 'center', fontSize: '9.5px', borderTop: '1px dashed #000', paddingTop: '6px' }}>
            <div>*** THANK YOU FOR YOUR TRUST ***</div>
            <div style={{ marginTop: '2px', color: '#666' }}>Garments not claimed within 30 days are subject to store policy.</div>
            <div style={{ marginTop: '4px', fontFamily: 'monospace', fontWeight: 'bold' }}>WWW.TUMBLEDRY.IN</div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
