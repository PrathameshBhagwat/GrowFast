import React from 'react';
import { OrderStatus, ORDER_STATUS_COLORS } from '@growfast/shared-types';

export interface StatusChipProps {
  status: OrderStatus;
  size?: 'sm' | 'md';
  style?: React.CSSProperties;
}

/** Human-readable labels for each order status */
const STATUS_LABELS: Record<OrderStatus, string> = {
  [OrderStatus.RECEIVED]: 'Received',
  [OrderStatus.SORTING]: 'Sorting',
  [OrderStatus.PROCESSING]: 'Processing',
  [OrderStatus.DRYING]: 'Drying',
  [OrderStatus.IRONING]: 'Ironing',
  [OrderStatus.QUALITY_CHECK]: 'Quality Check',
  [OrderStatus.PACKED]: 'Packed',
  [OrderStatus.READY]: 'Ready',
  [OrderStatus.OUT_FOR_DELIVERY]: 'Out for Delivery',
  [OrderStatus.DELIVERED]: 'Delivered',
  [OrderStatus.CANCELLED]: 'Cancelled',
};

/**
 * StatusChip — displays order status with consistent color coding.
 * Uses the ORDER_STATUS_COLORS from shared-types as the single source of truth.
 */
export const StatusChip: React.FC<StatusChipProps> = ({ status, size = 'md', style }) => {
  const colors = ORDER_STATUS_COLORS[status];
  const label = STATUS_LABELS[status] || status;

  const chipStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: size === 'sm' ? '2px 8px' : '4px 12px',
    fontSize: size === 'sm' ? '0.7rem' : '0.8rem',
    fontWeight: 600,
    fontFamily: "'Inter', sans-serif",
    borderRadius: '9999px',
    background: colors.bg,
    color: colors.text,
    border: `1px solid ${colors.border}`,
    letterSpacing: '0.02em',
    whiteSpace: 'nowrap',
    ...style,
  };

  return (
    <span style={chipStyle}>
      <span
        style={{
          width: size === 'sm' ? '5px' : '6px',
          height: size === 'sm' ? '5px' : '6px',
          borderRadius: '50%',
          background: colors.text,
          flexShrink: 0,
        }}
      />
      {label}
    </span>
  );
};
