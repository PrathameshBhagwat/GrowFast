import React, { useState } from 'react';
import { IndividualGarmentTag } from '../../types';
import { Modal } from '../common/Modal';
import { 
  CheckSquare, 
  CheckCircle2, 
  RotateCcw, 
  AlertTriangle, 
  Camera, 
  ShieldAlert, 
  User,
  Image as ImageIcon
} from 'lucide-react';

interface QCHandlerModalProps {
  isOpen: boolean;
  onClose: () => void;
  garment: IndividualGarmentTag | null;
  onQCSubmit: (garmentTag: string, status: 'passed' | 'rework' | 'issue', notes?: string, reason?: string) => void;
}

export const QCHandlerModal: React.FC<QCHandlerModalProps> = ({
  isOpen,
  onClose,
  garment,
  onQCSubmit
}) => {
  if (!garment) return null;

  const [decision, setDecision] = useState<'passed' | 'rework' | 'issue'>('passed');
  const [issueReason, setIssueReason] = useState<string>('Stain remains after cycle');
  const [qcNotes, setQcNotes] = useState<string>('Visual inspection complete. Clean, pressed, and tag verified.');

  const handleConfirm = () => {
    onQCSubmit(garment.garmentTag, decision, qcNotes, decision !== 'passed' ? issueReason : undefined);
    onClose();
  };

  const defectReasons = [
    'Stain remains after standard cycle',
    'Pressing / Crease alignment issue',
    'Missing button noticed during finishing',
    'Color fading / bleeding risk',
    'Fabric tear / damage requires customer consent',
    'Wrong service / missing tag'
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckSquare size={20} color="var(--primary)" />
          <span>Quality Control (QC) & Inspection — {garment.garmentTag}</span>
        </div>
      }
      subtitle={`Garment: ${garment.garmentName} • Service: ${garment.service.toUpperCase()}`}
      size="lg"
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div>
            <span style={{ fontSize: '11px', color: 'var(--slate-500)' }}>
              Action: <strong style={{ textTransform: 'uppercase', color: decision === 'passed' ? 'var(--success)' : (decision === 'rework' ? 'var(--warning)' : 'var(--danger)') }}>{decision}</strong>
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button 
              className={`btn ${decision === 'passed' ? 'btn-success' : (decision === 'rework' ? 'btn-primary' : 'btn-danger')}`}
              onClick={handleConfirm}
            >
              <CheckCircle2 size={16} /> Submit QC Decision
            </button>
          </div>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Garment Verification Header */}
        <div style={{
          backgroundColor: 'var(--slate-50)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '1rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '1rem',
          fontSize: 'var(--text-xs)'
        }}>
          <div>
            <span style={{ color: 'var(--slate-500)', display: 'block', marginBottom: '2px' }}>Garment & Color</span>
            <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--slate-900)' }}>{garment.garmentName}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--slate-500)', display: 'block', marginBottom: '2px' }}>Required Service</span>
            <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--primary-700)', textTransform: 'uppercase' }}>
              {garment.service.replace('_', ' ')}
            </strong>
          </div>
          <div>
            <span style={{ color: 'var(--slate-500)', display: 'block', marginBottom: '2px' }}>Rack / Bag Target</span>
            <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--slate-900)' }}>{garment.rackLocation || 'R-12-B'}</strong>
          </div>
        </div>

        {/* Before Intake Condition & Counter Photos */}
        <div>
          <label className="form-label" style={{ marginBottom: '0.4rem' }}>
            <span>Counter Intake Condition & Before Photos</span>
            <span className="form-helper">Dispute prevention record</span>
          </label>

          <div style={{
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '0.85rem',
            backgroundColor: '#FFFFFF',
            display: 'flex',
            gap: '1rem',
            alignItems: 'center'
          }}>
            {/* Photo preview */}
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: 'var(--radius-sm)',
              overflow: 'hidden',
              backgroundColor: '#0F172A',
              border: '1px solid var(--border-color)',
              flexShrink: 0
            }}>
              {garment.photoUrls && garment.photoUrls.length > 0 ? (
                <img src={garment.photoUrls[0]} alt="Before photo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8' }}>
                  <ImageIcon size={24} />
                </div>
              )}
            </div>

            <div style={{ flex: 1, fontSize: '11.5px', color: 'var(--slate-700)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {garment.damages && garment.damages.length > 0 ? (
                garment.damages.map(d => (
                  <div key={d.id} style={{ color: 'var(--danger-text)', fontWeight: 600 }}>
                    ⚠️ Noted Damage at counter: {d.description} ({d.severity} severity)
                  </div>
                ))
              ) : (
                <div style={{ color: 'var(--slate-500)' }}>No existing defects were logged at counter intake.</div>
              )}
              {garment.stains && garment.stains.length > 0 && (
                <div style={{ color: 'var(--warning-text)', fontWeight: 600 }}>
                  🎯 Pre-cleaning Stains: {garment.stains.join(', ')}
                </div>
              )}
              <div style={{ color: 'var(--slate-500)', fontSize: '10.5px' }}>
                Verify that existing defects are preserved and no new damage has occurred.
              </div>
            </div>
          </div>
        </div>

        {/* 3 QC Decision Buttons */}
        <div>
          <label className="form-label">
            <span>Inspection Decision</span>
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
            <button
              type="button"
              className="btn"
              style={{
                padding: '1rem',
                flexDirection: 'column',
                gap: '0.35rem',
                border: decision === 'passed' ? '2px solid var(--success)' : '1px solid var(--border-color)',
                backgroundColor: decision === 'passed' ? 'var(--success-bg)' : '#FFFFFF',
                color: decision === 'passed' ? 'var(--success-text)' : 'var(--slate-800)'
              }}
              onClick={() => {
                setDecision('passed');
                setQcNotes('QC Passed. Spotting cleared, pressed, ready for customer bag.');
              }}
            >
              <CheckCircle2 size={24} color={decision === 'passed' ? 'var(--success)' : 'var(--slate-400)'} />
              <strong style={{ fontSize: 'var(--text-sm)' }}>PASS INSPECTION</strong>
              <span style={{ fontSize: '10.5px', color: 'var(--slate-500)', textAlign: 'center' }}>
                Meets premium store standard
              </span>
            </button>

            <button
              type="button"
              className="btn"
              style={{
                padding: '1rem',
                flexDirection: 'column',
                gap: '0.35rem',
                border: decision === 'rework' ? '2px solid var(--warning)' : '1px solid var(--border-color)',
                backgroundColor: decision === 'rework' ? 'var(--warning-bg)' : '#FFFFFF',
                color: decision === 'rework' ? 'var(--warning-text)' : 'var(--slate-800)'
              }}
              onClick={() => {
                setDecision('rework');
                setQcNotes('Needs secondary steam press touchup on creases.');
              }}
            >
              <RotateCcw size={24} color={decision === 'rework' ? 'var(--warning)' : 'var(--slate-400)'} />
              <strong style={{ fontSize: 'var(--text-sm)' }}>SEND FOR REWORK</strong>
              <span style={{ fontSize: '10.5px', color: 'var(--slate-500)', textAlign: 'center' }}>
                Re-iron / Re-wash required
              </span>
            </button>

            <button
              type="button"
              className="btn"
              style={{
                padding: '1rem',
                flexDirection: 'column',
                gap: '0.35rem',
                border: decision === 'issue' ? '2px solid var(--danger)' : '1px solid var(--border-color)',
                backgroundColor: decision === 'issue' ? 'var(--danger-bg)' : '#FFFFFF',
                color: decision === 'issue' ? 'var(--danger-text)' : 'var(--slate-800)'
              }}
              onClick={() => {
                setDecision('issue');
                setQcNotes('Flagged for manager dispute review.');
              }}
            >
              <AlertTriangle size={24} color={decision === 'issue' ? 'var(--danger)' : 'var(--slate-400)'} />
              <strong style={{ fontSize: 'var(--text-sm)' }}>FLAG ISSUE</strong>
              <span style={{ fontSize: '10.5px', color: 'var(--slate-500)', textAlign: 'center' }}>
                Damage / Stain dispute risk
              </span>
            </button>
          </div>
        </div>

        {/* Defect Reason if Rework or Issue */}
        {decision !== 'passed' && (
          <div className="form-group">
            <label className="form-label">
              <span>Specific Issue Classification</span>
            </label>
            <select
              className="form-select"
              value={issueReason}
              onChange={(e) => setIssueReason(e.target.value)}
            >
              {defectReasons.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        )}

        {/* QC Notes */}
        <div className="form-group">
          <label className="form-label">
            <span>Inspector Notes & Accountability Log</span>
          </label>
          <textarea
            className="form-textarea"
            rows={2}
            value={qcNotes}
            onChange={(e) => setQcNotes(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
};
