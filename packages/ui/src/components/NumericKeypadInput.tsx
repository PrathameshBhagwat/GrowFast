import React, { useState, useCallback, useEffect } from 'react';
import { Delete } from 'lucide-react';

export interface NumericKeypadInputProps {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  label?: string;
  masked?: boolean;
  onSubmit?: () => void;
}

/**
 * NumericKeypadInput — large tap-target numeric keypad for PIN entry.
 * Supports both on-screen touch keypad and physical keyboard input.
 * Each key is 64×56px minimum for easy touch targeting.
 */
export const NumericKeypadInput: React.FC<NumericKeypadInputProps> = ({
  value,
  onChange,
  maxLength = 6,
  label,
  masked = true,
  onSubmit,
}) => {
  const [, setInternalValue] = useState(value);

  const handleKeyPress = useCallback(
    (key: string) => {
      if (value.length < maxLength) {
        const newValue = value + key;
        setInternalValue(newValue);
        onChange(newValue);
      }
    },
    [value, maxLength, onChange],
  );

  const handleDelete = useCallback(() => {
    const newValue = value.slice(0, -1);
    setInternalValue(newValue);
    onChange(newValue);
  }, [value, onChange]);

  const handleClear = useCallback(() => {
    setInternalValue('');
    onChange('');
  }, [onChange]);

  // Physical keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If user is focused on an input element, ignore
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleDelete();
      } else if (e.key === 'Escape' || e.key === 'Delete') {
        e.preventDefault();
        handleClear();
      } else if (e.key === 'Enter') {
        if (value.length === maxLength && onSubmit) {
          e.preventDefault();
          onSubmit();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyPress, handleDelete, handleClear, value.length, maxLength, onSubmit]);

  const displayValue = masked ? '●'.repeat(value.length) : value;

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'del'];

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px',
    width: '100%',
    maxWidth: '320px',
  };

  const displayStyle: React.CSSProperties = {
    fontSize: '2rem',
    fontFamily: "'JetBrains Mono', monospace",
    fontWeight: 600,
    color: '#0F172A',
    letterSpacing: '0.5em',
    textAlign: 'center',
    minHeight: '48px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
  };

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '10px',
    width: '100%',
  };

  const getKeyStyle = (key: string): React.CSSProperties => ({
    minHeight: '56px',
    minWidth: '64px',
    fontSize: key === 'clear' || key === 'del' ? '0.8rem' : '1.25rem',
    fontWeight: 600,
    fontFamily: "'Inter', sans-serif",
    border: '1px solid #E2E8F0',
    borderRadius: '12px',
    background: key === 'clear' ? '#FEF2F2' : key === 'del' ? '#F1F5F9' : '#FFFFFF',
    color: key === 'clear' ? '#991B1B' : '#0F172A',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 120ms ease-out',
    userSelect: 'none',
  });

  return (
    <div style={containerStyle}>
      {label && (
        <span
          style={{
            fontSize: '0.84rem',
            fontWeight: 500,
            color: '#475569',
            fontFamily: "'Inter', sans-serif",
          }}
        >
          {label}
        </span>
      )}

      {/* PIN dots display */}
      <div style={displayStyle}>
        {Array.from({ length: maxLength }).map((_, i) => (
          <span
            key={i}
            style={{
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              background: i < value.length ? '#2563EB' : '#E2E8F0',
              transition: 'background 150ms ease',
            }}
          />
        ))}
      </div>

      {displayValue && !masked && (
        <span
          style={{
            fontSize: '1.25rem',
            fontFamily: "'JetBrains Mono', monospace",
            color: '#334155',
          }}
        >
          {displayValue}
        </span>
      )}

      {/* Keypad grid */}
      <div style={gridStyle}>
        {keys.map((key) => (
          <button
            key={key}
            type="button"
            style={getKeyStyle(key)}
            onClick={() => {
              if (key === 'del') handleDelete();
              else if (key === 'clear') handleClear();
              else handleKeyPress(key);
            }}
          >
            {key === 'del' ? <Delete size={20} /> : key === 'clear' ? 'Clear' : key}
          </button>
        ))}
      </div>

      {onSubmit && value.length === maxLength && (
        <button
          type="button"
          onClick={onSubmit}
          style={{
            width: '100%',
            padding: '14px',
            fontSize: '1rem',
            fontWeight: 700,
            fontFamily: "'Inter', sans-serif",
            background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            minHeight: '52px',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
          }}
        >
          Unlock
        </button>
      )}
    </div>
  );
};
