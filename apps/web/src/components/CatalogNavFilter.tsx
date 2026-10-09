import React, { useRef } from 'react';
import { Search, Sparkles, Layers } from 'lucide-react';
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

export type CatalogSortOption = 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc';

export interface CatalogSortOptionItem {
  value: CatalogSortOption;
  label: string;
}

export const CATALOG_SORT_OPTIONS: CatalogSortOptionItem[] = [
  { value: 'name-asc', label: 'Name (A to Z)' },
  { value: 'name-desc', label: 'Name (Z to A)' },
  { value: 'price-asc', label: 'Price (Low to High)' },
  { value: 'price-desc', label: 'Price (High to Low)' },
];

/**
 * Shared sorting logic for catalog garments across Create Order and Outer Catalog view
 */
export function sortCatalogGarments<T extends { id: string; name: string }>(
  garments: T[],
  sortBy: string,
  getPrice: (garmentId: string) => number | null | undefined,
): T[] {
  return [...garments].sort((a, b) => {
    if (sortBy === 'name-asc' || sortBy === 'name_asc') {
      return a.name.localeCompare(b.name);
    }
    if (sortBy === 'name-desc' || sortBy === 'name_desc') {
      return b.name.localeCompare(a.name);
    }
    if (
      sortBy === 'price-asc' ||
      sortBy === 'price_asc' ||
      sortBy === 'price-desc' ||
      sortBy === 'price_desc'
    ) {
      const priceA = getPrice(a.id) ?? 0;
      const priceB = getPrice(b.id) ?? 0;
      return sortBy.includes('asc') ? priceA - priceB : priceB - priceA;
    }
    return 0;
  });
}

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

  const navScrollRef = useRef<HTMLDivElement>(null);

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (navScrollRef.current && e.deltaY !== 0 && !e.deltaX) {
      navScrollRef.current.scrollLeft += e.deltaY;
    }
  };

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
      {/* ─── UNIFIED SCENIC NAVIGATION BAR ─── */}
      <div
        ref={navScrollRef}
        onWheel={handleWheel}
        className="rounded-xl w-full flex items-center overflow-x-auto select-none no-scrollbar"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          padding: '4px 6px',
          boxShadow: '0 1px 3px 0 var(--shadow-color)',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          whiteSpace: 'nowrap',
          transition: 'background-color 0.2s ease, border-color 0.2s ease',
        }}
      >
        {/* ── 1. SERVICE LABEL ── */}
        <div
          className="flex items-center gap-1 shrink-0 px-2 py-1 rounded-md"
          style={{
            background: 'var(--bg-surface-inset)',
            border: '1px solid var(--border)',
            transition: 'background-color 0.2s ease, border-color 0.2s ease',
          }}
        >
          <Sparkles size={13} className="text-blue-500 shrink-0" />
          <span
            className="uppercase tracking-wider select-none font-bold text-[11px]"
            style={{ color: 'var(--text-secondary)', letterSpacing: '0.04em' }}
          >
            Service
          </span>
        </div>

        {/* ── SERVICE PILLS ── */}
        <div className="flex items-center gap-1.5 shrink-0">
          {services.map((service) => {
            const isActive = activeServiceId === service.id;
            const isPromo = service.name.toLowerCase().includes('free');

            return (
              <button
                key={service.id}
                type="button"
                onClick={() => onServiceChange(service.id)}
                className="rounded-lg flex items-center justify-center text-center cursor-pointer select-none active:scale-[0.97]"
                style={{
                  height: '36px',
                  minHeight: '36px',
                  paddingLeft: '12px',
                  paddingRight: '12px',
                  borderRadius: '8px',
                  fontSize: '12.5px',
                  fontWeight: isActive ? 600 : 500,
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  border: isActive ? '1px solid var(--accent)' : '1px solid var(--border)',
                  background: isActive ? 'var(--accent)' : 'var(--bg-surface-inset)',
                  color: isActive ? '#ffffff' : 'var(--text-primary)',
                  boxShadow: isActive ? '0 2px 6px -1px rgba(37, 99, 235, 0.3)' : 'none',
                  flexShrink: 0,
                }}
              >
                <span>{service.name}</span>
                {isPromo && (
                  <span
                    style={{
                      marginLeft: '5px',
                      fontSize: '9px',
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      padding: '1px 4px',
                      borderRadius: '3px',
                      background: isActive ? 'rgba(255, 255, 255, 0.25)' : 'var(--warning-bg)',
                      color: isActive ? '#ffffff' : 'var(--warning-text)',
                      border: isActive
                        ? '1px solid rgba(255, 255, 255, 0.3)'
                        : '1px solid var(--warning-border)',
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

        {/* ── SCENIC SEPARATOR ── */}
        <div
          className="h-5 w-[1.5px] shrink-0 mx-1.5 rounded-full"
          style={{
            background: 'var(--border)',
            transition: 'background-color 0.2s ease',
          }}
          aria-hidden="true"
        />

        {/* ── 2. CATEGORY LABEL ── */}
        <div
          className="flex items-center gap-1 shrink-0 px-2 py-1 rounded-md"
          style={{
            background: 'var(--bg-surface-inset)',
            border: '1px solid var(--border)',
            transition: 'background-color 0.2s ease, border-color 0.2s ease',
          }}
        >
          <Layers size={13} className="text-indigo-500 shrink-0" />
          <span
            className="uppercase tracking-wider select-none font-bold text-[11px]"
            style={{ color: 'var(--text-secondary)', letterSpacing: '0.04em' }}
          >
            Category
          </span>
        </div>

        {/* ── CATEGORY PILLS ── */}
        <div className="flex items-center gap-1.5 shrink-0">
          {categories.map((cat) => {
            const isActive = activeCategory === cat;
            const label = categoryLabels[cat] || cat;

            return (
              <button
                key={cat}
                type="button"
                onClick={() => onCategoryChange(cat)}
                className="rounded-lg flex items-center justify-center text-center cursor-pointer select-none active:scale-[0.97]"
                style={{
                  height: '36px',
                  minHeight: '36px',
                  paddingLeft: '12px',
                  paddingRight: '12px',
                  borderRadius: '8px',
                  fontSize: '12.5px',
                  fontWeight: isActive ? 600 : 500,
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  border: isActive ? '1px solid var(--accent)' : '1px solid var(--border)',
                  background: isActive ? 'var(--accent)' : 'var(--bg-surface-inset)',
                  color: isActive ? '#ffffff' : 'var(--text-primary)',
                  boxShadow: isActive ? '0 2px 6px -1px rgba(37, 99, 235, 0.3)' : 'none',
                  flexShrink: 0,
                }}
              >
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── 3. SEARCH & TOOLBAR BAR ──────────────────── */}
      <div
        className="flex items-center gap-2.5"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          width: '100%',
          flexWrap: 'nowrap',
        }}
      >
        {/* Left: Search Input Box */}
        <div
          className="relative flex-1 rounded-lg"
          style={{
            position: 'relative',
            flex: 1,
            minWidth: '180px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            boxShadow: '0 1px 2px 0 var(--shadow-color)',
            transition: 'background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: '10px',
              display: 'flex',
              alignItems: 'center',
              pointerEvents: 'none',
              color: 'var(--text-muted)',
            }}
          >
            <Search size={16} />
          </div>
          <input
            ref={searchRef}
            type="text"
            className="w-full bg-transparent focus:outline-none"
            style={{
              width: '100%',
              height: '36px',
              paddingLeft: '34px',
              paddingRight: '40px',
              borderRadius: '8px',
              border: 'none',
              background: 'transparent',
              fontSize: '13px',
              color: 'var(--text-primary)',
              outline: 'none',
              transition: 'color 0.2s ease',
            }}
            placeholder={placeholderText}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          <span
            style={{
              position: 'absolute',
              right: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '10px',
              fontWeight: 600,
              color: 'var(--text-muted)',
              background: 'var(--bg-surface-inset)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              padding: '1px 5px',
              pointerEvents: 'none',
              userSelect: 'none',
              transition: 'background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease',
            }}
          >
            F2
          </span>
        </div>

        {/* Right Toolbar Content (Sort, Filter, Action Buttons) */}
        {rightToolbarContent && (
          <div
            className="flex items-center gap-2.5 shrink-0"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              flexShrink: 0,
              flexWrap: 'nowrap',
            }}
          >
            {rightToolbarContent}
          </div>
        )}
      </div>
    </div>
  );
};
