import React from 'react';
import { Inbox } from 'lucide-react';

export interface EmptyStateProps {
  title?: string;
  message?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

/**
 * EmptyState — placeholder for empty lists/views.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No items found',
  message = 'There are no items to display right now.',
  icon,
  action,
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
    <div style={{ color: '#CBD5E1' }}>{icon || <Inbox size={56} strokeWidth={1.5} />}</div>
    <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: '#334155' }}>{title}</h3>
    <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748B', maxWidth: '360px' }}>{message}</p>
    {action && <div style={{ marginTop: '8px' }}>{action}</div>}
  </div>
);
