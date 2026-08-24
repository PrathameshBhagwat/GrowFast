import React, { useRef, useState } from 'react';
import { Camera, Upload, X, RotateCcw } from 'lucide-react';
import { Button } from './Button';

export interface PhotoCaptureProps {
  /** Called when a photo is captured or selected */
  onCapture: (file: File) => void;
  /** Optional: called when a captured photo is removed */
  onRemove?: () => void;
  /** Whether to show camera option vs file-only */
  allowCamera?: boolean;
  /** Accept filter for file input */
  accept?: string;
  /** Optional label */
  label?: string;
}

/**
 * PhotoCapture — reusable component contract for photo capture.
 *
 * Supports:
 * - Camera capture (via media capture)
 * - File selection from gallery
 * - Preview with retake/remove
 *
 * NOTE: Actual cloud upload integration is NOT implemented.
 * Developer C will implement the upload service later.
 * This component only handles capture and provides the File
 * to the parent via onCapture callback.
 */
export const PhotoCapture: React.FC<PhotoCaptureProps> = ({
  onCapture,
  onRemove,
  allowCamera = true,
  accept = 'image/*',
  label = 'Add Photo',
}) => {
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      const url = URL.createObjectURL(file);
      setPreview(url);
      onCapture(file);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    setFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    onRemove?.();
  };

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    fontFamily: "'Inter', sans-serif",
  };

  if (preview) {
    return (
      <div style={containerStyle}>
        {label && (
          <span style={{ fontSize: '0.84rem', fontWeight: 500, color: '#334155' }}>{label}</span>
        )}
        <div
          style={{
            position: 'relative',
            borderRadius: '12px',
            overflow: 'hidden',
            border: '1px solid #E2E8F0',
          }}
        >
          <img
            src={preview}
            alt="Captured"
            style={{ width: '100%', maxHeight: '240px', objectFit: 'cover', display: 'block' }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '8px',
              right: '8px',
              display: 'flex',
              gap: '8px',
            }}
          >
            <Button
              variant="secondary"
              size="sm"
              icon={<RotateCcw size={14} />}
              onClick={() => fileInputRef.current?.click()}
            >
              Retake
            </Button>
            <Button variant="danger" size="sm" icon={<X size={14} />} onClick={handleRemove}>
              Remove
            </Button>
          </div>
        </div>
        {fileName && <span style={{ fontSize: '0.75rem', color: '#64748B' }}>{fileName}</span>}
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {label && (
        <span style={{ fontSize: '0.84rem', fontWeight: 500, color: '#334155' }}>{label}</span>
      )}
      <div style={{ display: 'flex', gap: '10px' }}>
        {allowCamera && (
          <>
            <Button
              variant="outline"
              size="md"
              icon={<Camera size={18} />}
              onClick={() => cameraInputRef.current?.click()}
            >
              Camera
            </Button>
            <input
              ref={cameraInputRef}
              type="file"
              accept={accept}
              capture="environment"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
          </>
        )}
        <Button
          variant="secondary"
          size="md"
          icon={<Upload size={18} />}
          onClick={() => fileInputRef.current?.click()}
        >
          Gallery
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
      </div>
    </div>
  );
};
