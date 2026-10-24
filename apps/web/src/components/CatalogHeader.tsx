import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

export interface CatalogHeaderProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  statusBadge?: React.ReactNode;
  onBack?: () => void;
  showLogo?: boolean;
  showThemeToggle?: boolean;
  rightContent?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const CatalogHeader: React.FC<CatalogHeaderProps> = ({
  title = 'Garment Catalog',
  subtitle = 'Downtown Connaught Place #102',
  statusBadge,
  onBack,
  showLogo = true,
  showThemeToggle = false,
  rightContent,
  className = '',
  style,
}) => {
  return (
    <header
      className={`flex items-center justify-between shrink-0 box-border ${className}`}
      style={{
        background: 'var(--bg-surface, #ffffff)',
        border: '1px solid var(--border, #e2e8f0)',
        borderRadius: '16px',
        padding: '12px 20px',
        minHeight: '56px',
        boxShadow: 'var(--shadow-neu-card-sm)',
        transition: 'background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
        ...style,
      }}
    >
      {/* Left: Back Button + Logo + Title & Subtitle */}
      <div
        className="flex items-center gap-3"
        style={{ display: 'flex', alignItems: 'center', gap: '14px' }}
      >
        {onBack && (
          <button
            type="button"
            id="catalog-back-btn"
            aria-label="Back"
            onClick={onBack}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              border: '1px solid var(--border, #e2e8f0)',
              background: 'var(--bg-surface, #ffffff)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary, #475569)',
              cursor: 'pointer',
              flexShrink: 0,
              boxShadow: 'var(--shadow-neu-card-sm)',
              transition: 'all 0.15s ease',
            }}
            title="Go back"
          >
            <ArrowLeft size={16} />
          </button>
        )}

        {showLogo && (
          <div
            className="flex items-center select-none shrink-0"
            style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}
          >
            <span
              style={{
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: 900,
                padding: '4px 9px',
                borderRadius: '6px',
                letterSpacing: '0.06em',
                userSelect: 'none',
                boxShadow: '0 2px 6px rgba(37, 99, 235, 0.3)',
              }}
            >
              GROWFAST
            </span>
          </div>
        )}

        <div className="flex flex-col justify-center">
          <div className="flex items-center gap-2">
            <h1
              className="text-slate-900 leading-none tracking-tight select-none"
              style={{
                fontSize: '18px',
                fontWeight: 800,
                color: 'var(--text-primary, #0f172a)',
                lineHeight: 1.2,
                letterSpacing: '-0.02em',
                margin: 0,
              }}
            >
              {title}
            </h1>
            {statusBadge && <div className="flex items-center select-none">{statusBadge}</div>}
          </div>
          {subtitle && (
            <p
              className="text-slate-500 truncate select-none"
              style={{
                fontSize: '12px',
                color: 'var(--text-muted, #64748b)',
                lineHeight: 1.2,
                marginTop: '2px',
                margin: '2px 0 0 0',
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Right: Custom actions + ThemeToggle */}
      <div
        className="flex items-center gap-2.5 shrink-0"
        style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}
      >
        {showThemeToggle && <ThemeToggle size="sm" />}
        {rightContent}
      </div>
    </header>
  );
};
