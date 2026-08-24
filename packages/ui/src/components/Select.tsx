import React from 'react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  'children'
> {
  label?: string;
  options: SelectOption[];
  placeholder?: string;
  error?: string;
  fullWidth?: boolean;
}

/**
 * Select — dropdown with mobile-friendly sizing and plain-language labels.
 */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, placeholder, error, fullWidth = true, style, id, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');

    const containerStyle: React.CSSProperties = {
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      width: fullWidth ? '100%' : 'auto',
    };

    const selectStyle: React.CSSProperties = {
      padding: '10px 14px',
      fontSize: '0.925rem',
      fontFamily: "'Inter', sans-serif",
      border: `1px solid ${error ? '#EF4444' : '#E2E8F0'}`,
      borderRadius: '8px',
      outline: 'none',
      background: '#FFFFFF',
      color: '#0F172A',
      minHeight: '44px',
      width: '100%',
      boxSizing: 'border-box',
      cursor: 'pointer',
      appearance: 'none',
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2364748B' d='M2 4l4 4 4-4'/%3E%3C/svg%3E")`,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'right 12px center',
      paddingRight: '36px',
      ...style,
    };

    return (
      <div style={containerStyle}>
        {label && (
          <label
            htmlFor={selectId}
            style={{
              fontSize: '0.84rem',
              fontWeight: 500,
              color: '#334155',
              fontFamily: "'Inter', sans-serif",
            }}
          >
            {label}
          </label>
        )}
        <select ref={ref} id={selectId} style={selectStyle} {...props}>
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && (
          <span
            style={{ fontSize: '0.75rem', color: '#EF4444', fontFamily: "'Inter', sans-serif" }}
          >
            {error}
          </span>
        )}
      </div>
    );
  },
);

Select.displayName = 'Select';
