import React from 'react';
import { IndividualGarmentTag, ProcessingStage } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { 
  Sparkles, 
  ArrowRight, 
  CheckSquare, 
  Camera, 
  ShieldAlert, 
  User, 
  MapPin, 
  RotateCcw,
  CheckCircle2
} from 'lucide-react';

interface GarmentProcessingCardProps {
  garment: IndividualGarmentTag & {
    orderNumber?: string;
    customerName?: string;
    priority?: 'standard' | 'express' | 'vip';
    specialInstructions?: string;
  };
  onAdvanceStage: (garmentTag: string, nextStage: ProcessingStage) => void;
  onOpenQC: (garment: IndividualGarmentTag) => void;
}

const stageProgression: Record<ProcessingStage, ProcessingStage> = {
  received: 'sorting',
  sorting: 'processing',
  processing: 'drying',
  drying: 'ironing',
  ironing: 'quality_check',
  quality_check: 'packed',
  packed: 'ready',
  ready: 'delivered',
  out_for_delivery: 'delivered',
  delivered: 'delivered'
};

export const GarmentProcessingCard: React.FC<GarmentProcessingCardProps> = ({
  garment,
  onAdvanceStage,
  onOpenQC
}) => {
  const nextStage = stageProgression[garment.stage];
  const isQCStage = garment.stage === 'quality_check' || garment.stage === 'ironing';

  return (
    <div 
      className="card"
      style={{
        padding: '0.85rem 1rem',
        marginBottom: '0.75rem',
        borderLeft: garment.priority === 'express' ? '4px solid var(--warning)' : '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-xs)',
        transition: 'transform var(--transition-fast)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="tag-mono">{garment.garmentTag}</span>
          {garment.priority === 'express' && (
            <span className="badge badge-warning" style={{ fontSize: '9px' }}>EXPRESS</span>
          )}
        </div>
        <StatusBadge status={garment.stage} />
      </div>

      <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--slate-900)', marginBottom: '2px' }}>
        {garment.garmentName}
      </div>

      <div style={{ fontSize: '11px', color: 'var(--primary-700)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.35rem' }}>
        {garment.service.replace('_', ' ')}
      </div>

      {/* Customer & Order info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '11px', color: 'var(--slate-500)', marginBottom: '0.5rem' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          <User size={11} /> {garment.customerName || 'Customer'}
        </span>
        <span>•</span>
        <span>{garment.orderNumber}</span>
        {garment.rackLocation && (
          <>
            <span>•</span>
            <span style={{ color: 'var(--primary-700)', fontWeight: 700 }}>Rack: {garment.rackLocation}</span>
          </>
        )}
      </div>

      {/* Defects / Photo Indicators */}
      {(garment.damages?.length || garment.photoUrls?.length || garment.specialInstructions) && (
        <div style={{
          backgroundColor: 'var(--slate-50)',
          borderRadius: 'var(--radius-sm)',
          padding: '0.4rem 0.6rem',
          fontSize: '11px',
          marginBottom: '0.65rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px'
        }}>
          {garment.damages && garment.damages.length > 0 && (
            <div style={{ color: 'var(--danger-text)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ShieldAlert size={12} /> {garment.damages[0].description}
            </div>
          )}
          {garment.photoUrls && garment.photoUrls.length > 0 && (
            <div style={{ color: 'var(--primary-700)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Camera size={12} /> {garment.photoUrls.length} Before Photo(s) Attached
            </div>
          )}
          {garment.specialInstructions && (
            <div style={{ color: 'var(--slate-600)', fontStyle: 'italic' }}>
              💬 {garment.specialInstructions}
            </div>
          )}
        </div>
      )}

      {/* Stage Actions */}
      <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem' }}>
        {garment.stage === 'quality_check' ? (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => onOpenQC(garment)}
          >
            <CheckSquare size={13} /> Perform QC
          </button>
        ) : (
          <>
            <button
              className="btn btn-outline btn-sm"
              style={{ fontSize: '11px', padding: '0.25rem 0.5rem' }}
              onClick={() => onOpenQC(garment)}
            >
              Inspect
            </button>
            <button
              className="btn btn-primary btn-sm"
              style={{ fontSize: '11px', padding: '0.25rem 0.65rem' }}
              onClick={() => onAdvanceStage(garment.garmentTag, nextStage)}
            >
              <span>Move to {nextStage.toUpperCase()}</span>
              <ArrowRight size={12} />
            </button>
          </>
        )}
      </div>
    </div>
  );
};
