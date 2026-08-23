import React, { useState } from 'react';
import { Modal } from './Modal';
import { Camera, Image as ImageIcon, CheckCircle2, RotateCcw } from 'lucide-react';
import { OrderItemPhoto } from '../../types';

interface PhotoCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  garmentName: string;
  onPhotoCaptured: (photo: OrderItemPhoto) => void;
}

const sampleGarmentPhotos = [
  'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=500&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=500&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=500&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1578932750294-f5075e85f44a?w=500&auto=format&fit=crop&q=80'
];

export const PhotoCaptureModal: React.FC<PhotoCaptureModalProps> = ({
  isOpen,
  onClose,
  garmentName,
  onPhotoCaptured
}) => {
  const [photoType, setPhotoType] = useState<'front' | 'back' | 'damage' | 'stain' | 'tag'>('damage');
  const [selectedPresetIndex, setSelectedPresetIndex] = useState<number>(0);
  const [captured, setCaptured] = useState<boolean>(false);
  const [flash, setFlash] = useState<boolean>(false);

  const handleCapture = () => {
    setFlash(true);
    setTimeout(() => setFlash(false), 200);
    setCaptured(true);
  };

  const handleConfirm = () => {
    const photo: OrderItemPhoto = {
      id: `ph-${Date.now()}`,
      type: photoType,
      url: sampleGarmentPhotos[selectedPresetIndex % sampleGarmentPhotos.length],
      timestamp: new Date().toISOString()
    };
    onPhotoCaptured(photo);
    setCaptured(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Camera size={20} color="var(--primary)" />
          <span>Capture Garment Condition — {garmentName}</span>
        </div>
      }
      subtitle="Before-cleaning visual record for customer dispute prevention & QC tracking"
      size="lg"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          {captured ? (
            <>
              <button className="btn btn-outline" onClick={() => setCaptured(false)}>
                <RotateCcw size={16} /> Retake
              </button>
              <button className="btn btn-primary" onClick={handleConfirm}>
                <CheckCircle2 size={16} /> Save Photo to Item
              </button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={handleCapture}>
              <Camera size={16} /> Snap Photo
            </button>
          )}
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Photo Category Selector */}
        <div>
          <label className="form-label">Photo Classification</label>
          <div className="chip-row">
            {(['damage', 'stain', 'front', 'back', 'tag'] as const).map(type => (
              <button
                key={type}
                className={`chip-btn ${photoType === type ? 'active' : ''}`}
                onClick={() => setPhotoType(type)}
                style={{ textTransform: 'capitalize' }}
              >
                {type === 'damage' && '⚠️ Existing Damage'}
                {type === 'stain' && '🎯 Pre-existing Stain'}
                {type === 'front' && '👔 Full Front View'}
                {type === 'back' && '🔄 Back View'}
                {type === 'tag' && '🏷️ Brand / Care Tag'}
              </button>
            ))}
          </div>
        </div>

        {/* Camera Viewport Simulation */}
        <div style={{
          position: 'relative',
          height: '320px',
          backgroundColor: '#0F172A',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '2px solid var(--border-color)'
        }}>
          {flash && (
            <div style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: '#FFFFFF',
              zIndex: 30,
              opacity: 0.8
            }} />
          )}

          <img
            src={sampleGarmentPhotos[selectedPresetIndex]}
            alt="Camera Preview"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: captured ? 'none' : 'brightness(0.95)'
            }}
          />

          {/* Camera UI Overlay */}
          <div style={{
            position: 'absolute',
            inset: '16px',
            border: '1.5px dashed rgba(255,255,255,0.4)',
            borderRadius: 'var(--radius-md)',
            pointerEvents: 'none',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '12px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#FFFFFF', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
              <span>HD CAMERA 1080P • F/1.8</span>
              <span>AUTO FOCUS: LOCKED</span>
            </div>
            <div style={{ textAlign: 'center', color: '#FFFFFF', fontSize: '12px', background: 'rgba(0,0,0,0.5)', padding: '4px 10px', borderRadius: '4px', alignSelf: 'center' }}>
              {captured ? '✓ Photo captured — Ready to attach' : 'Align garment defect inside target box'}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#FFFFFF', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
              <span>TAG: {photoType.toUpperCase()}</span>
              <span>{new Date().toLocaleTimeString()}</span>
            </div>
          </div>
        </div>

        {/* Alternate Photo Presets */}
        <div>
          <label className="form-label" style={{ marginBottom: '0.4rem' }}>
            <span>Simulate Alternate Garment Angles</span>
            <span className="form-helper">Click angle thumbnail to switch camera target</span>
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {sampleGarmentPhotos.map((url, idx) => (
              <div
                key={idx}
                onClick={() => {
                  setSelectedPresetIndex(idx);
                  setCaptured(false);
                }}
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  border: selectedPresetIndex === idx ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                  opacity: selectedPresetIndex === idx ? 1 : 0.65
                }}
              >
                <img src={url} alt="Preset" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
};
