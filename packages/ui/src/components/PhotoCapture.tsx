import React, { useRef, useState, useEffect } from 'react';
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
 * - Camera capture (via WebRTC/getUserMedia for laptop/desktop, fallback to file input)
 * - File selection from gallery
 * - Preview with retake/remove
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
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Bind the stream to the video element once both are ready
  useEffect(() => {
    if (isWebcamActive && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [isWebcamActive, stream]);

  // Cleanup webcam stream on unmount
  useEffect(() => {
    return () => {
      // Direct cleanup to avoid stale closure issues
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  const startWebcam = async () => {
    try {
      // Use ideal: 'environment' so it falls back to the user-facing camera on laptops
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
      });
      setStream(mediaStream);
      setIsWebcamActive(true);
    } catch (err) {
      console.error('Camera access failed, falling back to native file capture', err);
      cameraInputRef.current?.click();
    }
  };

  const stopWebcam = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const activeStream = videoRef.current.srcObject as MediaStream;
      activeStream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    setStream(null);
    setIsWebcamActive(false);
  };

  const captureFrame = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
              setFileName(file.name);
              const url = URL.createObjectURL(file);
              setPreview(url);
              onCapture(file);
              stopWebcam();
            }
          },
          'image/jpeg',
          0.8,
        );
      }
    }
  };

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

  if (isWebcamActive) {
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
            backgroundColor: '#000',
          }}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            style={{ width: '100%', maxHeight: '240px', objectFit: 'cover', display: 'block' }}
          />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
          <div
            style={{
              position: 'absolute',
              bottom: '8px',
              right: '8px',
              display: 'flex',
              gap: '8px',
            }}
          >
            <Button variant="secondary" size="sm" onClick={stopWebcam}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" icon={<Camera size={14} />} onClick={captureFrame}>
              Capture
            </Button>
          </div>
        </div>
      </div>
    );
  }

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
            <Button variant="outline" size="md" icon={<Camera size={18} />} onClick={startWebcam}>
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
