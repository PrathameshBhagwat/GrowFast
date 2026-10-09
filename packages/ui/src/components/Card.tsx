import React from 'react';

export interface CardProps {
  children: React.ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  elevated?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
  className?: string;
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
}) => {
  const cardStyle: React.CSSProperties = {
    background: 'var(--bg-surface)',
    borderRadius: '12px',
    border: '1px solid var(--border)',
    padding: paddingMap[padding],
    boxShadow: elevated
      ? `0 4px 6px -1px var(--shadow-color), 0 2px 4px -2px var(--shadow-color)`
      : `0 1px 2px 0 var(--shadow-color)`,
    transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
    cursor: onClick ? 'pointer' : 'default',
    ...style,
  };

  return (
    <div
      style={cardStyle}
      className={className}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      {children}
    </div>
  );
};
