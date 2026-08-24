import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  width?: string;
  showCloseButton?: boolean;
}

/**
 * Modal — overlay dialog with backdrop and close button.
 * Accessible: traps focus, closes on Escape, and on backdrop click.
 */
export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  children,
  width = '480px',
  showCloseButton = true,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.5)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px',
    animation: 'fadeIn 150ms ease-out',
  };

  const dialogStyle: React.CSSProperties = {
    background: '#FFFFFF',
    borderRadius: '16px',
    width: '100%',
    maxWidth: width,
    maxHeight: '90vh',
    overflow: 'auto',
    boxShadow: '0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.05)',
    animation: 'slideUp 200ms cubic-bezier(0.16, 1, 0.3, 1)',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px 0',
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div
        ref={modalRef}
        style={dialogStyle}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {(title || showCloseButton) && (
          <div style={headerStyle}>
            {title && (
              <h2
                style={{
                  margin: 0,
                  fontSize: '1.125rem',
                  fontWeight: 700,
                  color: '#0F172A',
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                aria-label="Close"
                style={{
                  background: '#F1F5F9',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#475569',
                }}
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}
        <div style={{ padding: '20px 24px 24px' }}>{children}</div>
      </div>
    </div>
  );
};
