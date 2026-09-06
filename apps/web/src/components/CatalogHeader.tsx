import React from 'react';
import { ArrowLeft } from 'lucide-react';

export interface CatalogHeaderProps {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  showLogo?: boolean;
  rightContent?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const CatalogHeader: React.FC<CatalogHeaderProps> = ({
  title = 'Garment Catalog',
  subtitle = 'Downtown Connaught Place #102 • Active Master Catalog',
  onBack,
  showLogo = true,
  rightContent,
  className = '',
  style,
}) => {
  return (
    <header
      className={`bg-white border-b border-slate-200 shadow-xs flex items-center justify-between shrink-0 z-10 box-border ${className}`}
      style={{
        background: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        padding: '8px 16px',
        minHeight: '52px',
        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        ...style,
      }}
    >
      {/* Left: Back Button + Logo + Title & Subtitle */}
      <div
        className="flex items-center gap-3"
        style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
      >
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="w-8 h-8 rounded-[3px] border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 flex items-center justify-center text-slate-600 transition-colors cursor-pointer shadow-xs shrink-0"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '3px',
              border: '1px solid #e2e8f0',
              background: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#475569',
              cursor: 'pointer',
              flexShrink: 0,
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
              className="bg-[#2563eb] text-white text-[11px] font-black px-2 py-0.5 rounded-[3px] tracking-wider uppercase shadow-xs select-none"
              style={{
                background: '#2563eb',
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: 900,
                padding: '2px 7px',
                borderRadius: '3px',
                letterSpacing: '0.06em',
                userSelect: 'none',
              }}
            >
              GROWFAST
            </span>
          </div>
        )}

        <div className="flex flex-col justify-center">
          <h1
            className="text-slate-900 leading-none tracking-tight select-none"
            style={{
              fontSize: '18px',
              fontWeight: 800,
              color: '#0f172a',
              lineHeight: 1.2,
              letterSpacing: '-0.02em',
              margin: 0,
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              className="text-slate-500 truncate select-none"
              style={{
                fontSize: '12px',
                color: '#64748b',
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

      {/* Right: Custom actions (tabs, export, add button, etc.) */}
      {rightContent && (
        <div
          className="flex items-center gap-2.5 shrink-0"
          style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}
        >
          {rightContent}
        </div>
      )}
    </header>
  );
};
