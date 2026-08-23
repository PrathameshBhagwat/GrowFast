import React, { useState } from 'react';
import { Order } from '../../types';
import { Modal } from '../common/Modal';
import { 
  Package, 
  CheckCircle2, 
  Check, 
  Layers, 
  MapPin, 
  ShoppingBag,
  Sparkles,
  QrCode
} from 'lucide-react';

interface PackingStationModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  onConfirmPacking: (orderId: string, rackLocation: string, bagId: string) => void;
}

export const PackingStationModal: React.FC<PackingStationModalProps> = ({
  isOpen,
  onClose,
  order,
  onConfirmPacking
}) => {
  if (!order) return null;

  const [rackLocation, setRackLocation] = useState<string>(order.rackLocation || 'R-12-B');
  const [bagId, setBagId] = useState<string>(order.bagId || `BAG-${order.orderNumber.replace('ORD-', '')}`);
  
  // Checklist for individual garments
  const allGarments = order.items.flatMap(i => i.individualGarments);
  const [checkedTags, setCheckedTags] = useState<string[]>(allGarments.map(g => g.garmentTag));

  const handleToggleGarment = (tag: string) => {
    setCheckedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleVerifyAll = () => {
    setCheckedTags(allGarments.map(g => g.garmentTag));
  };

  const handleComplete = () => {
    onConfirmPacking(order.id, rackLocation, bagId);
    onClose();
  };

  const rackPresets = ['R-12-B', 'R-04-A', 'R-02-C', 'R-08-D', 'R-15-E', 'HANG-01'];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Package size={20} color="var(--primary)" />
          <span>Packing & Racking Station — {order.orderNumber}</span>
        </div>
      }
      subtitle={`Customer: ${order.customerName} (${order.customerPhone}) • ${order.itemCount} Garments`}
      size="lg"
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div>
            <span style={{ fontSize: '11px', color: 'var(--slate-500)' }}>
              Verified: <strong>{checkedTags.length} / {allGarments.length}</strong> items in bag
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button 
              className="btn btn-primary btn-lg" 
              onClick={handleComplete}
              disabled={checkedTags.length < allGarments.length}
            >
              <CheckCircle2 size={18} /> Pack & Mark Ready (Notify Customer)
            </button>
          </div>
        </div>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '1.5rem' }}>
        {/* Left: Garment Checklist */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <label className="form-label" style={{ margin: 0 }}>
              <span>Itemized Garment Checklist</span>
            </label>
            <button 
              type="button" 
              className="btn btn-outline btn-sm" 
              style={{ fontSize: '10.5px' }}
              onClick={handleVerifyAll}
            >
              Verify All ({allGarments.length})
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '300px', overflowY: 'auto' }}>
            {allGarments.map(g => {
              const isChecked = checkedTags.includes(g.garmentTag);
              return (
                <div
                  key={g.garmentTag}
                  onClick={() => handleToggleGarment(g.garmentTag)}
                  style={{
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid',
                    borderColor: isChecked ? 'var(--success-border)' : 'var(--border-color)',
                    backgroundColor: isChecked ? 'var(--success-bg)' : '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '4px',
                      border: '1.5px solid',
                      borderColor: isChecked ? 'var(--success)' : 'var(--slate-300)',
                      backgroundColor: isChecked ? 'var(--success)' : '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#FFFFFF'
                    }}>
                      {isChecked && <Check size={14} />}
                    </div>
                    <div>
                      <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--slate-900)' }}>
                        {g.garmentName}
                      </div>
                      <div style={{ fontSize: '10.5px', color: 'var(--slate-500)' }}>
                        {g.service.replace('_', ' ').toUpperCase()} {g.color ? `• ${g.color}` : ''}
                      </div>
                    </div>
                  </div>
                  <span className="tag-mono">{g.garmentTag}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Packaging & Rack Storage */}
        <div style={{
          backgroundColor: 'var(--slate-50)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          <div>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--slate-500)', marginBottom: '0.5rem' }}>
              Packaging Details
            </div>
            
            {/* Bag barcode */}
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '11px' }}>
                <span>Store Bag Barcode Tag</span>
              </label>
              <input
                type="text"
                className="form-input form-input-mono"
                value={bagId}
                onChange={(e) => setBagId(e.target.value)}
              />
            </div>

            {/* Rack slot */}
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '11px' }}>
                <span>Storage Rack Slot</span>
              </label>
              <input
                type="text"
                className="form-input form-input-mono"
                style={{ fontWeight: 800, color: 'var(--primary-700)', fontSize: 'var(--text-base)' }}
                value={rackLocation}
                onChange={(e) => setRackLocation(e.target.value)}
              />
              <div className="chip-row" style={{ marginTop: '0.35rem' }}>
                {rackPresets.map(r => (
                  <button
                    key={r}
                    type="button"
                    className={`chip-btn ${rackLocation === r ? 'active' : ''}`}
                    style={{ fontSize: '10.5px' }}
                    onClick={() => setRackLocation(r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Packaging Note & Customer Preferences */}
          <div style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '0.75rem',
            fontSize: '11px',
            color: 'var(--slate-700)'
          }}>
            <div style={{ fontWeight: 700, color: 'var(--slate-900)', marginBottom: '2px' }}>
              Customer Packaging Preference:
            </div>
            <div>• Fold / Hanger preference applied</div>
            <div>• Standard eco-friendly dust cover</div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
