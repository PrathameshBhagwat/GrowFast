import React, { useState } from 'react';
import { Modal } from './Modal';
import { QrCode, Scan, Search, ArrowRight, Sparkles } from 'lucide-react';
import { useStore } from '../../store';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanResult: (scannedText: string) => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  isOpen,
  onClose,
  onScanResult
}) => {
  const { orders } = useStore();
  const [manualInput, setManualInput] = useState('');
  const [scanning, setScanning] = useState(true);

  // Extract real garment tags from current orders
  const allGarmentTags = orders.flatMap(o => 
    o.items.flatMap(i => i.individualGarments.map(g => ({
      tag: g.garmentTag,
      name: g.garmentName,
      stage: g.stage,
      customer: o.customerName
    })))
  ).slice(0, 6);

  const handleTriggerScan = (tag: string) => {
    onScanResult(tag);
    onClose();
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      onScanResult(manualInput.trim());
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Scan size={20} color="var(--primary)" />
          <span>Optical Scanner (Garment Tag / Barcode)</span>
        </div>
      }
      subtitle="Scan garment tag (e.g. GAR-8721-03) or order receipt barcode"
      size="md"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Animated Scanner Viewport */}
        <div style={{
          position: 'relative',
          height: '220px',
          backgroundColor: '#0F172A',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '2px solid var(--border-color)'
        }}>
          {/* Laser line animation */}
          <div style={{
            position: 'absolute',
            left: '15%',
            right: '15%',
            height: '2px',
            background: 'linear-gradient(90deg, transparent, #3B82F6, #60A5FA, transparent)',
            boxShadow: '0 0 12px #3B82F6',
            animation: 'laserScan 2s infinite linear'
          }} />

          <div style={{
            width: '140px',
            height: '140px',
            border: '2px solid #3B82F6',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#60A5FA',
            position: 'relative',
            background: 'rgba(59, 130, 246, 0.05)'
          }}>
            <QrCode size={64} style={{ opacity: 0.7 }} />
            <div style={{
              position: 'absolute',
              bottom: '-28px',
              color: '#FFFFFF',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              whiteSpace: 'nowrap'
            }}>
              ALIGN TAG INSIDE FRAME
            </div>
          </div>
        </div>

        <style>{`
          @keyframes laserScan {
            0% { top: 20%; opacity: 0.2; }
            50% { top: 80%; opacity: 1; }
            100% { top: 20%; opacity: 0.2; }
          }
        `}</style>

        {/* Manual Input Fallback */}
        <form onSubmit={handleManualSubmit}>
          <div className="form-group" style={{ marginBottom: '0.75rem' }}>
            <label className="form-label">
              <span>Manual Garment / Barcode Entry</span>
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                className="form-input form-input-mono"
                placeholder="e.g. GAR-8721-03 or ORD-8721"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                autoFocus
              />
              <button type="submit" className="btn btn-primary">
                Lookup <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </form>

        {/* Quick Demo Scan Tags */}
        <div>
          <label className="form-label" style={{ marginBottom: '0.4rem' }}>
            <span>Quick-Scan Active Garments (Test Simulators)</span>
            <span className="form-helper">Click tag to simulate optical read</span>
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {allGarmentTags.map(item => (
              <div
                key={item.tag}
                onClick={() => handleTriggerScan(item.tag)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.55rem 0.85rem',
                  backgroundColor: 'var(--slate-50)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--primary-50)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--slate-50)'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <span className="tag-mono">{item.tag}</span>
                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--slate-800)' }}>
                    {item.name}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '11px', color: 'var(--slate-500)' }}>
                  <span>{item.customer}</span>
                  <span className="badge badge-neutral" style={{ fontSize: '10px' }}>{item.stage}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
};
