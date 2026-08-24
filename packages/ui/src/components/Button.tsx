import React from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
    color: '#FFFFFF',
    border: 'none',
    boxShadow: '0 1px 3px rgba(37, 99, 235, 0.3)',
  },
  secondary: {
    background: '#F1F5F9',
    color: '#334155',
    border: '1px solid #E2E8F0',
  },
  danger: {
    background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
    color: '#FFFFFF',
    border: 'none',
    boxShadow: '0 1px 3px rgba(239, 68, 68, 0.3)',
  },
  ghost: {
    background: 'transparent',
    color: '#475569',
    border: 'none',
  },
  outline: {
    background: 'transparent',
    color: '#2563EB',
    border: '1px solid #2563EB',
  },
};

const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
  sm: { padding: '6px 12px', fontSize: '0.8rem', borderRadius: '6px', minHeight: '32px' },
  md: { padding: '10px 20px', fontSize: '0.9rem', borderRadius: '8px', minHeight: '40px' },
  lg: { padding: '14px 28px', fontSize: '1rem', borderRadius: '10px', minHeight: '48px' },
};

/**
 * Button — primary interactive element.
 * Supports variants, sizes, loading states, icons, and full-width.
 * Designed for large tap targets on mobile.
 */
export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  icon,
  children,
  disabled,
  style,
  ...props
}) => {
  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    fontFamily: "'Inter', sans-serif",
    fontWeight: 600,
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    opacity: disabled || loading ? 0.6 : 1,
    transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
    width: fullWidth ? '100%' : 'auto',
    whiteSpace: 'nowrap',
    ...variantStyles[variant],
    ...sizeStyles[size],
    ...style,
  };

  return (
    <button style={baseStyle} disabled={disabled || loading} {...props}>
      {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : icon}
      {children}
    </button>
  );
};
