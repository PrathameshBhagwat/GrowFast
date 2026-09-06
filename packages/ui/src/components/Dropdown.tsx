import React, { useState, useRef, useEffect, useCallback } from 'react';

export interface DropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface DropdownProps {
  label?: string;
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  fullWidth?: boolean;
  id?: string;
  name?: string;
  required?: boolean;
  className?: string;
  optionClassName?: string;
}

const Dropdown = React.forwardRef<HTMLDivElement, DropdownProps>(
  (
    {
      label,
      options,
      value,
      onChange,
      placeholder,
      disabled,
      error,
      fullWidth = true,
      id,
      name,
      required,
      className = '',
      optionClassName = '',
    },
    ref,
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const optionsRef = useRef<HTMLDivElement>(null);
    const selectId = id || `dropdown-${Math.random().toString(36).slice(2, 9)}`;

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setIsOpen(false);
          setHighlightedIndex(-1);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
      setHighlightedIndex(-1);
    }, [isOpen]);

    const handleKeyDown = useCallback(
      (event: React.KeyboardEvent) => {
        const enabledOptions = options.filter((opt) => !opt.disabled);
        const maxIndex = enabledOptions.length - 1;

        switch (event.key) {
          case 'ArrowDown':
            event.preventDefault();
            if (!isOpen) {
              setIsOpen(true);
            } else {
              setHighlightedIndex((prev) => (prev < maxIndex ? prev + 1 : 0));
            }
            break;
          case 'ArrowUp':
            event.preventDefault();
            if (isOpen) {
              setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : maxIndex));
            }
            break;
          case 'Enter':
            event.preventDefault();
            if (isOpen && highlightedIndex >= 0) {
              const enabledOptions = options.filter((opt) => !opt.disabled);
              onChange(enabledOptions[highlightedIndex]?.value ?? '');
              setIsOpen(false);
              setHighlightedIndex(-1);
            } else {
              setIsOpen(true);
            }
            break;
          case 'Escape':
            setIsOpen(false);
            setHighlightedIndex(-1);
            buttonRef.current?.focus();
            break;
          case 'Tab':
            setIsOpen(false);
            setHighlightedIndex(-1);
            break;
          default:
            break;
        }
      },
      [isOpen, highlightedIndex, options, onChange],
    );

    const handleOptionClick = (optionValue: string, optionDisabled: boolean) => {
      if (optionDisabled) return;
      onChange(optionValue);
      setIsOpen(false);
      setHighlightedIndex(-1);
      buttonRef.current?.focus();
    };

    const handleButtonClick = () => {
      if (disabled) return;
      setIsOpen(!isOpen);
      setHighlightedIndex(-1);
    };

    const selectedOption = options.find((opt) => opt.value === value);
    const displayValue = selectedOption?.label || placeholder || 'Select an option';

    const containerStyle: React.CSSProperties = {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      width: fullWidth ? '100%' : 'auto',
    };

    const labelStyle: React.CSSProperties = {
      fontSize: '0.875rem',
      fontWeight: 600,
      color: '#1e293b',
      fontFamily: "'Inter', sans-serif",
    };

    const buttonStyle: React.CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      minHeight: '58px',
      padding: '0 22px',
      fontSize: '0.95rem',
      fontWeight: 500,
      fontFamily: "'Inter', sans-serif",
      color: value ? '#0f172a' : '#94a3b8',
      backgroundColor: disabled ? '#f1f5f9' : isOpen ? '#ffffff' : '#f8fafc',
      border: `1px solid ${error ? '#ef4444' : isOpen ? '#3b82f6' : disabled ? '#e2e8f0' : '#e2e8f0'}`,
      borderRadius: '16px',
      cursor: disabled ? 'not-allowed' : 'pointer',
      outline: 'none',
      boxShadow: isOpen ? '0 0 0 4px rgba(59, 130, 246, 0.1)' : 'none',
      transition: 'all 150ms ease',
      boxSizing: 'border-box',
      position: 'relative',
      zIndex: 10,
    };

    const iconStyle: React.CSSProperties = {
      width: '20px',
      height: '20px',
      flexShrink: 0,
      color: '#3b82f6',
      transition: 'transform 150ms ease',
      transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
      marginLeft: '12px',
    };

    const optionsContainerStyle: React.CSSProperties = {
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      marginTop: '6px',
      backgroundColor: '#ffffff',
      border: '1px solid #e2e8f0',
      borderRadius: '12px',
      boxShadow: '0 10px 40px -10px rgba(15, 23, 42, 0.15), 0 4px 20px -4px rgba(15, 23, 42, 0.08)',
      maxHeight: '280px',
      overflowY: 'auto',
      zIndex: 50,
      opacity: isOpen ? 1 : 0,
      visibility: isOpen ? 'visible' : 'hidden',
      transform: isOpen ? 'translateY(0)' : 'translateY(-8px)',
      transition: 'all 150ms ease',
      pointerEvents: isOpen ? 'auto' : 'none',
    };

    const optionStyle: React.CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      padding: '12px 16px',
      fontSize: '0.95rem',
      fontWeight: 500,
      fontFamily: "'Inter', sans-serif",
      color: '#1e293b',
      cursor: 'pointer',
      transition: 'background-color 100ms ease',
      borderRadius: '8px',
      margin: '4px',
      ...(optionClassName ? {} : {}),
    };

    return (
      <div ref={dropdownRef} className={className} style={containerStyle}>
        {label && (
          <label htmlFor={selectId} style={labelStyle}>
            {label}
          </label>
        )}
        <div style={{ position: 'relative' }}>
          <button
            ref={buttonRef}
            type="button"
            id={selectId}
            name={name}
            data-required={required}
            disabled={disabled}
            onClick={handleButtonClick}
            onKeyDown={handleKeyDown}
            style={buttonStyle}
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            aria-labelledby={label ? selectId : undefined}
            aria-disabled={disabled}
          >
            <span
              style={{
                flex: 1,
                textAlign: 'left',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {displayValue}
            </span>
            <svg
              width="12"
              height="8"
              viewBox="0 0 12 8"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={iconStyle}
              aria-hidden="true"
            >
              <path
                d="M1.5 1.5L6 6L10.5 1.5"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {isOpen && (
            <div
              ref={optionsRef}
              role="listbox"
              aria-activedescendant={
                highlightedIndex >= 0 ? `${selectId}-option-${highlightedIndex}` : undefined
              }
              style={optionsContainerStyle}
            >
              {options.map((option, index) => {
                const isHighlighted = highlightedIndex === index;
                const isSelected = option.value === value;
                const enabledOptions = options.filter((opt) => !opt.disabled);
                const enabledIndex = enabledOptions.findIndex((opt) => opt.value === option.value);

                return (
                  <div
                    key={option.value}
                    id={`${selectId}-option-${enabledIndex}`}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={option.disabled}
                    onClick={() => handleOptionClick(option.value, option.disabled || false)}
                    onMouseEnter={() => !option.disabled && setHighlightedIndex(enabledIndex)}
                    style={{
                      ...optionStyle,
                      backgroundColor: isHighlighted ? '#eff6ff' : 'transparent',
                      color: option.disabled ? '#94a3b8' : isSelected ? '#3b82f6' : '#1e293b',
                      fontWeight: isSelected ? 600 : 500,
                    }}
                  >
                    {option.label}
                    {isSelected && (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ marginLeft: 'auto', color: '#3b82f6', flexShrink: 0 }}
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                );
              })}
              {options.length === 0 && (
                <div
                  style={{
                    padding: '16px',
                    textAlign: 'center',
                    color: '#94a3b8',
                    fontSize: '0.9rem',
                  }}
                >
                  No options available
                </div>
              )}
            </div>
          )}
        </div>
        {error && (
          <span
            style={{
              fontSize: '0.75rem',
              color: '#ef4444',
              fontFamily: "'Inter', sans-serif",
              marginTop: '2px',
            }}
          >
            {error}
          </span>
        )}
      </div>
    );
  },
);

Dropdown.displayName = 'Dropdown';

export { Dropdown };
