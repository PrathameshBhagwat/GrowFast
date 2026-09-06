import React from 'react';
import { Search } from 'lucide-react';
import { GarmentCategory } from '@growfast/shared-types';

export interface CatalogServiceItem {
  id: string;
  name: string;
  isActive?: boolean;
}

export const DEFAULT_CATEGORIES: string[] = [
  GarmentCategory.MEN,
  GarmentCategory.WOMEN,
  GarmentCategory.KIDS,
  GarmentCategory.HOUSEHOLD,
  GarmentCategory.HOME_CLEANING,
  GarmentCategory.SHOES,
  GarmentCategory.OTHERS,
  GarmentCategory.WEIGHT_BASED,
];

export const DEFAULT_CATEGORY_LABELS: Record<string, string> = {
  MEN: 'Men',
  WOMEN: 'Women',
  KIDS: 'Kids',
  HOUSEHOLD: 'Household',
  HOME_CLEANING: 'Home Cleaning',
  SHOES: 'Shoe',
  OTHERS: 'Other',
  WEIGHT_BASED: 'Weight Based',
};

export interface CatalogNavFilterProps {
  services: CatalogServiceItem[];
  activeServiceId: string;
  onServiceChange: (serviceId: string) => void;
  categories?: string[];
  categoryLabels?: Record<string, string>;
  activeCategory: string;
  onCategoryChange: (category: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchPlaceholder?: string;
  searchRef?: React.RefObject<HTMLInputElement | null>;
  rightToolbarContent?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const CatalogNavFilter: React.FC<CatalogNavFilterProps> = ({
  services,
  activeServiceId,
  onServiceChange,
  categories = DEFAULT_CATEGORIES,
  categoryLabels = DEFAULT_CATEGORY_LABELS,
  activeCategory,
  onCategoryChange,
  searchQuery,
  onSearchChange,
  searchPlaceholder,
  searchRef,
  rightToolbarContent,
  className = '',
  style,
}) => {
  const currentCategoryLabel = categoryLabels[activeCategory] || activeCategory;
  const placeholderText =
    searchPlaceholder ||
    `Search in ${currentCategoryLabel} by name, SKU or barcode (e.g. Kurta, Coat, Dhoti)...`;

  return (
    <div
      className={`flex flex-col w-full box-border ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        width: '100%',
        ...style,
      }}
    >
      {/* ─── 1. SERVICE NAVIGATION BAR ─────────────────── */}
      <style>{`
        .catalog-nav-scroll::-webkit-scrollbar {
          display: none;
          width: 0;
          height: 0;
        }
      `}</style>
      <div
        className="bg-white border border-slate-200 rounded-[3px] shadow-2xs w-full"
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '3px',
          padding: '5px 12px',
          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
          width: '100%',
        }}
      >
        <div
          className="flex items-center w-full min-w-0"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            width: '100%',
            minWidth: 0,
          }}
        >
          {/* SERVICE Label */}
          <div
            className="uppercase tracking-wider shrink-0 select-none flex items-center"
            style={{
              fontSize: '12.5px',
              fontWeight: 700,
              color: '#64748b',
              letterSpacing: '0.05em',
              minWidth: '78px',
              flexShrink: 0,
            }}
          >
            <span>SERVICE</span>
          </div>

          {/* Service Buttons: full available width */}
          <div
            className="flex-1 flex items-center min-w-0"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flex: '1 1 0%',
              width: '100%',
              minWidth: 0,
            }}
          >
            {services.map((service) => {
              const isActive = activeServiceId === service.id;
              const isPromo = service.name.toLowerCase().includes('free');

              return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => onServiceChange(service.id)}
                  className={`rounded-[3px] transition-all flex items-center justify-center text-center cursor-pointer border select-none ${
                    isActive
                      ? 'bg-[#2563eb] text-white border-[#2563eb] shadow-2xs font-semibold'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50 font-medium'
                  }`}
                  style={{
                    flex: '1 1 auto',
                    minWidth: 0,
                    height: '44px',
                    minHeight: '44px',
                    paddingLeft: '6px',
                    paddingRight: '6px',
                    borderRadius: '3px',
                    fontSize: '13.5px',
                    fontWeight: isActive ? 600 : 500,
                    whiteSpace: 'nowrap',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    border: isActive ? '1px solid #2563eb' : '1px solid #e2e8f0',
                    background: isActive ? '#2563eb' : '#ffffff',
                    color: isActive ? '#ffffff' : '#334155',
                    boxShadow: isActive ? '0 1px 2px 0 rgba(37, 99, 235, 0.15)' : 'none',
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {service.name}
                  </span>
                  {isPromo && (
                    <span
                      style={{
                        marginLeft: '5px',
                        fontSize: '9px',
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        padding: '1px 3px',
                        borderRadius: '2px',
                        background: isActive ? 'rgba(255, 255, 255, 0.25)' : '#fef3c7',
                        color: isActive ? '#ffffff' : '#92400e',
                        border: isActive ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid #fde68a',
                        flexShrink: 0,
                      }}
                    >
                      PROMO
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── 2. CATEGORY NAVIGATION BAR ───────────────── */}
      <div
        className="bg-white border border-slate-200 rounded-[3px] shadow-2xs w-full"
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '3px',
          padding: '5px 12px',
          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
          width: '100%',
        }}
      >
        <div
          className="flex items-center w-full min-w-0"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            width: '100%',
            minWidth: 0,
          }}
        >
          {/* CATEGORY Label */}
          <div
            className="uppercase tracking-wider shrink-0 select-none flex items-center"
            style={{
              fontSize: '12.5px',
              fontWeight: 700,
              color: '#64748b',
              letterSpacing: '0.05em',
              minWidth: '78px',
              flexShrink: 0,
            }}
          >
            <span>CATEGORY</span>
          </div>

          {/* Category Buttons: full available width */}
          <div
            className="flex-1 flex items-center min-w-0"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flex: '1 1 0%',
              width: '100%',
              minWidth: 0,
            }}
          >
            {categories.map((cat) => {
              const isActive = activeCategory === cat;
              const label = categoryLabels[cat] || cat;

              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => onCategoryChange(cat)}
                  className={`rounded-[3px] transition-all flex items-center justify-center text-center cursor-pointer border select-none ${
                    isActive
                      ? 'bg-[#2563eb] text-white border-[#2563eb] shadow-2xs font-semibold'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50 font-medium'
                  }`}
                  style={{
                    flex: '1 1 auto',
                    minWidth: 0,
                    height: '44px',
                    minHeight: '44px',
                    paddingLeft: '6px',
                    paddingRight: '6px',
                    borderRadius: '3px',
                    fontSize: '13.5px',
                    fontWeight: isActive ? 600 : 500,
                    whiteSpace: 'nowrap',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    border: isActive ? '1px solid #2563eb' : '1px solid #e2e8f0',
                    background: isActive ? '#2563eb' : '#ffffff',
                    color: isActive ? '#ffffff' : '#334155',
                    boxShadow: isActive ? '0 1px 2px 0 rgba(37, 99, 235, 0.15)' : 'none',
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── 3. SEARCH & TOOLBAR BAR ──────────────────── */}
      <div
        className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          width: '100%',
        }}
      >
        {/* Left: Search Input Box */}
        <div
          className="relative flex-1 bg-white border border-slate-200 rounded-[3px] shadow-2xs"
          style={{
            position: 'relative',
            flex: 1,
            minWidth: '220px',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '3px',
            boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
          }}
        >
          <div
            className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400"
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: '10px',
              display: 'flex',
              alignItems: 'center',
              pointerEvents: 'none',
              color: '#94a3b8',
            }}
          >
            <Search size={16} />
          </div>
          <input
            ref={searchRef}
            type="text"
            className="w-full bg-transparent text-slate-900 placeholder:text-slate-400 focus:outline-none"
            style={{
              width: '100%',
              height: '36px',
              paddingLeft: '34px',
              paddingRight: '40px',
              borderRadius: '3px',
              border: 'none',
              background: 'transparent',
              fontSize: '13px',
              color: '#0f172a',
              outline: 'none',
            }}
            placeholder={placeholderText}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          <span
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-400 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 pointer-events-none select-none"
            style={{
              position: 'absolute',
              right: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '10px',
              fontWeight: 600,
              color: '#94a3b8',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '2px',
              padding: '1px 4px',
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            F2
          </span>
        </div>

        {/* Right Toolbar Content (Sort, Filter, Action Buttons) */}
        {rightToolbarContent && (
          <div
            className="flex items-center gap-3 shrink-0 flex-wrap justify-end"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              flexShrink: 0,
            }}
          >
            {rightToolbarContent}
          </div>
        )}
      </div>
    </div>
  );
};
