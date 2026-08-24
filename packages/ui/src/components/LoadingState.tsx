import React from 'react';
import { Loader2 } from 'lucide-react';

export interface LoadingStateProps {
  message?: string;
  fullPage?: boolean;
}

/**
 * LoadingState — spinner with optional message.
 */
export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading...',
  fullPage = false,
}) => {
  const style: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    padding: '48px 24px',
    fontFamily: "'Inter', sans-serif",
    ...(fullPage ? { minHeight: '100vh' } : { minHeight: '200px' }),
  };

  return (
    <div style={style}>
      <Loader2 size={36} color="#2563EB" style={{ animation: 'spin 1s linear infinite' }} />
      <span style={{ fontSize: '0.9rem', color: '#64748B', fontWeight: 500 }}>{message}</span>
    </div>
  );
};
