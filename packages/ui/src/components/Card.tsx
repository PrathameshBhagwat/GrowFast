import React from 'react';

export interface CardProps {
  children: React.ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  elevated?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
  className?: string;
  id?: string;
  tabIndex?: number;
  onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
  role?: string;
  'aria-label'?: string;
}

const paddingMap = {
  none: '0',
  sm: '12px',
  md: '20px',
  lg: '28px',
};

/**
 * Card — elevated surface container for grouping content.
 * Supports padding variants and optional click behavior.
 */
export const Card: React.FC<CardProps> = ({
  children,
  padding = 'md',
  elevated = false,
  onClick,
  style,
  className,
  id,
  tabIndex,
  onKeyDown,
  role,
  'aria-label': ariaLabel,
}) => {
  const cardStyle: React.CSSProperties = {
    background: 'var(--bg-surface)',
    borderRadius: '16px',
    border: '1px solid var(--border)',
    padding: paddingMap[padding],
    boxShadow: elevated
      ? 'var(--shadow-neu-card, 0 10px 30px -5px rgba(160, 175, 200, 0.25))'
      : 'var(--shadow-neu-card-sm, 0 4px 14px -2px rgba(160, 175, 200, 0.15))',
    transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
    cursor: onClick ? 'pointer' : 'default',
    ...style,
  };

  return (
    <div
      id={id}
      style={cardStyle}
      className={className}
      onClick={onClick}
      role={role ?? (onClick ? 'button' : undefined)}
      tabIndex={tabIndex}
      onKeyDown={onKeyDown}
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
};
