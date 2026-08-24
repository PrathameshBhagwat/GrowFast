import React, { useEffect, useState } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ConfirmToastProps {
  type?: ToastType;
  message: string;
  visible: boolean;
  onClose: () => void;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const typeConfig: Record<
  ToastType,
  { icon: React.ReactNode; bg: string; border: string; color: string }
> = {
  success: { icon: <CheckCircle size={18} />, bg: '#ECFDF5', border: '#A7F3D0', color: '#065F46' },
  error: { icon: <AlertCircle size={18} />, bg: '#FEF2F2', border: '#FECACA', color: '#991B1B' },
  info: { icon: <Info size={18} />, bg: '#F0F9FF', border: '#BAE6FD', color: '#075985' },
  warning: { icon: <AlertCircle size={18} />, bg: '#FFFBEB', border: '#FDE68A', color: '#92400E' },
};

/**
 * ConfirmToast — action confirmation overlay that auto-dismisses.
 * Supports success, error, info, and warning types with optional action button.
 */
export const ConfirmToast: React.FC<ConfirmToastProps> = ({
  type = 'success',
  message,
  visible,
  onClose,
  duration = 4000,
  action,
}) => {
  const [show, setShow] = useState(visible);

  useEffect(() => {
    setShow(visible);
    if (visible && duration > 0) {
      const timer = setTimeout(() => {
        setShow(false);
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [visible, duration, onClose]);

  if (!show) return null;

  const config = typeConfig[type];

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '14px 20px',
        background: config.bg,
        border: `1px solid ${config.border}`,
        borderRadius: '12px',
        color: config.color,
        fontFamily: "'Inter', sans-serif",
        fontSize: '0.9rem',
        fontWeight: 500,
        boxShadow: '0 10px 15px -3px rgba(15, 23, 42, 0.08)',
        animation: 'slideUp 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        maxWidth: '420px',
      }}
      role="alert"
    >
      {config.icon}
      <span style={{ flex: 1 }}>{message}</span>
      {action && (
        <button
          onClick={action.onClick}
          style={{
            background: 'transparent',
            border: 'none',
            color: config.color,
            fontWeight: 700,
            fontSize: '0.84rem',
            cursor: 'pointer',
            textDecoration: 'underline',
            fontFamily: "'Inter', sans-serif",
          }}
        >
          {action.label}
        </button>
      )}
      <button
        onClick={() => {
          setShow(false);
          onClose();
        }}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: config.color,
          padding: '2px',
          display: 'flex',
        }}
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
    </div>
  );
};
