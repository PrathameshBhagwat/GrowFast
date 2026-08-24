import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
}

/**
 * Input — form text input with label, error, and helper text.
 * Mobile-friendly with large touch targets.
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, fullWidth = true, style, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    const containerStyle: React.CSSProperties = {
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      width: fullWidth ? '100%' : 'auto',
    };

    const labelStyle: React.CSSProperties = {
      fontSize: '0.84rem',
      fontWeight: 500,
      color: '#334155',
      fontFamily: "'Inter', sans-serif",
    };

    const inputStyle: React.CSSProperties = {
      padding: '10px 14px',
      fontSize: '0.925rem',
      fontFamily: "'Inter', sans-serif",
      border: `1px solid ${error ? '#EF4444' : '#E2E8F0'}`,
      borderRadius: '8px',
      outline: 'none',
      transition: 'border-color 200ms ease',
      background: '#FFFFFF',
      color: '#0F172A',
      minHeight: '44px',
      width: '100%',
      boxSizing: 'border-box',
      ...style,
    };

    const helperStyle: React.CSSProperties = {
      fontSize: '0.75rem',
      color: error ? '#EF4444' : '#64748B',
      fontFamily: "'Inter', sans-serif",
    };

    return (
      <div style={containerStyle}>
        {label && (
          <label htmlFor={inputId} style={labelStyle}>
            {label}
          </label>
        )}
        <input ref={ref} id={inputId} style={inputStyle} {...props} />
        {(error || helperText) && <span style={helperStyle}>{error || helperText}</span>}
      </div>
    );
  },
);

Input.displayName = 'Input';
