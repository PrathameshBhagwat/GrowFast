import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

/**
 * ErrorState — error display with optional retry button.
 */
export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message = 'An unexpected error occurred. Please try again.',
  onRetry,
}) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '16px',
      padding: '64px 24px',
      textAlign: 'center',
      fontFamily: "'Inter', sans-serif",
    }}
  >
    <div
      style={{
        width: '64px',
        height: '64px',
        borderRadius: '50%',
        background: '#FEF2F2',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <AlertTriangle size={32} color="#EF4444" />
    </div>
    <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: '#334155' }}>{title}</h3>
    <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748B', maxWidth: '400px' }}>{message}</p>
    {onRetry && (
      <Button variant="outline" size="md" onClick={onRetry} icon={<RefreshCw size={16} />}>
        Try Again
      </Button>
    )}
  </div>
);
