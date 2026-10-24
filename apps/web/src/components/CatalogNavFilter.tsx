import React, { useRef, useMemo } from 'react';
import { Search, Sparkles, Layers, Scale } from 'lucide-react';
import {
  GarmentCategory,
  filterCategoriesForService,
  filterServicesForCategory,
  formatCatalogServiceName,
  OrderWorkflowType,
} from '@growfast/shared-types';

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
  WEIGHT_BASED: 'Weight Based (Exception)',
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
  workflow?: OrderWorkflowType;
  showStepNumbers?: boolean;
  singleRow?: boolean;
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
  workflow,
  showStepNumbers = false,
  singleRow = false,
  className = '',
  style,
}) => {
  const currentCategoryLabel = categoryLabels[activeCategory] || activeCategory;
  const placeholderText =
    searchPlaceholder ||
    `Search in ${currentCategoryLabel} by name, SKU or barcode (e.g. Kurta, Coat, Dhoti)...`;

  const serviceScrollRef = useRef<HTMLDivElement>(null);
  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const singleRowScrollRef = useRef<HTMLDivElement>(null);

  const handleServiceWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (serviceScrollRef.current && e.deltaY !== 0 && !e.deltaX) {
      serviceScrollRef.current.scrollLeft += e.deltaY;
    }
  };

  const handleCategoryWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (categoryScrollRef.current && e.deltaY !== 0 && !e.deltaX) {
      categoryScrollRef.current.scrollLeft += e.deltaY;
    }
  };

  const handleSingleRowWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (singleRowScrollRef.current && e.deltaY !== 0 && !e.deltaX) {
      singleRowScrollRef.current.scrollLeft += e.deltaY;
    }
  };

  // Filter visible services:
  // When workflow is present (Order Creation), enforce workflow and category restrictions.
  // When no workflow is present (Catalog settings/browsing), display the configured services,
  // excluding internal/non-catalog services like Free Shoe and Reprocess Cleaning.
  const visibleServices = useMemo(() => {
    if (workflow) {
      return filterServicesForCategory(services, activeCategory, workflow);
    }
    return services.filter((s) => {
      const lower = s.name.trim().toLowerCase();
      return lower !== 'free shoe' && lower !== 'reprocess cleaning';
    });
  }, [services, activeCategory, workflow]);

  // When "Starching" is selected, show ONLY Men, Women, Kids; when Dry Cleaning workflow, hide Weight Based
  const visibleCategories = useMemo(() => {
    return filterCategoriesForService(categories, activeServiceId, services, workflow);
  }, [categories, activeServiceId, services, workflow]);

  const renderServicePills = () => (
    <div className="flex items-center gap-2 shrink-0">
      {visibleServices.map((service) => {
        const isActive = activeServiceId === service.id;
        const displayName = formatCatalogServiceName(service.name);

        return (
          <button
            key={service.id}
            type="button"
            onClick={() => onServiceChange(service.id)}
            className="flex items-center justify-center text-center cursor-pointer select-none active:scale-[0.97] transition-all duration-200"
            style={{
              height: '34px',
              minHeight: '34px',
              paddingLeft: '16px',
              paddingRight: '16px',
              borderRadius: '9999px',
              fontSize: '12.5px',
              fontWeight: isActive ? 600 : 500,
              whiteSpace: 'nowrap',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              border: isActive ? '1px solid #2563eb' : '1px solid var(--border)',
              background: isActive
                ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
                : 'var(--bg-surface)',
              color: isActive ? '#ffffff' : 'var(--text-primary)',
              boxShadow: isActive
                ? '0 3px 10px rgba(37, 99, 235, 0.35)'
                : 'var(--shadow-neu-card-sm, 0 1px 2px rgba(0,0,0,0.05))',
              flexShrink: 0,
            }}
          >
            <span>{displayName}</span>
          </button>
        );
      })}
    </div>
  );

  const renderCategoryPills = () => (
    <div className="flex items-center gap-2 shrink-0">
      {visibleCategories.map((cat) => {
        const isActive = activeCategory === cat;
        const label = categoryLabels[cat] || cat;
        const isWeightException = cat === GarmentCategory.WEIGHT_BASED || cat === 'WEIGHT_BASED';

        return (
          <button
            key={cat}
            type="button"
            onClick={() => onCategoryChange(cat)}
            className="flex items-center justify-center text-center cursor-pointer select-none active:scale-[0.97] transition-all duration-200"
            style={{
              height: '34px',
              minHeight: '34px',
              paddingLeft: '16px',
              paddingRight: '16px',
              borderRadius: '9999px',
              fontSize: '12.5px',
              fontWeight: isActive ? 600 : 500,
              whiteSpace: 'nowrap',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              border: isActive
                ? '1px solid #2563eb'
                : isWeightException
                  ? '1px dashed #d97706'
                  : '1px solid var(--border)',
              background: isActive
                ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
                : isWeightException
                  ? 'rgba(245, 158, 11, 0.08)'
                  : 'var(--bg-surface)',
              color: isActive ? '#ffffff' : isWeightException ? '#b45309' : 'var(--text-primary)',
              boxShadow: isActive
                ? '0 3px 10px rgba(37, 99, 235, 0.35)'
                : 'var(--shadow-neu-card-sm, 0 1px 2px rgba(0,0,0,0.05))',
              flexShrink: 0,
            }}
          >
            {isWeightException ? (
              <span className="flex items-center gap-1.5">
                <Scale size={13} className={isActive ? 'text-white' : 'text-amber-600'} />
                <span>{label}</span>
              </span>
            ) : (
              <span>{label}</span>
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <div
      className={`flex flex-col w-full box-border ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        width: '100%',
        ...style,
      }}
    >
      {singleRow ? (
        /* ─── COMBINED SERVICE & CATEGORY SINGLE ROW ─── */
        <div
          ref={singleRowScrollRef}
          onWheel={handleSingleRowWheel}
          className="w-full flex items-center overflow-x-auto select-none no-scrollbar"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '6px 10px',
            boxShadow: 'var(--shadow-neu-card-sm)',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            whiteSpace: 'nowrap',
            transition: 'background-color 0.2s ease, border-color 0.2s ease',
          }}
        >
          {/* Service Section */}
          {showStepNumbers && (
            <div className="flex items-center gap-2 shrink-0 mr-1 select-none">
              <span className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100 whitespace-nowrap">
                Select Service
              </span>
            </div>
          )}

          {renderServicePills()}

          {/* Vertical Divider */}
          <div
            className="w-[1px] h-6 mx-1 shrink-0 bg-slate-200 dark:bg-slate-700"
            style={{ background: 'var(--border, #e2e8f0)' }}
            aria-hidden="true"
          />

          {/* Category Section */}
          {showStepNumbers && (
            <div className="flex items-center gap-2 shrink-0 mr-1 select-none">
              <span className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100 whitespace-nowrap">
                Select Category
              </span>
            </div>
          )}

          {renderCategoryPills()}
        </div>
      ) : (
        /* ─── TWO SEPARATE ROWS ─── */
        <>
          {/* ─── 1. SERVICE ROW (TOP) ─── */}
          <div
            ref={serviceScrollRef}
            onWheel={handleServiceWheel}
            className="w-full flex items-center overflow-x-auto select-none no-scrollbar"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: '6px 10px',
              boxShadow: 'var(--shadow-neu-card-sm)',
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              whiteSpace: 'nowrap',
              transition: 'background-color 0.2s ease, border-color 0.2s ease',
            }}
          >
            {/* Optional Step 1 Indicator */}
            {showStepNumbers && (
              <div className="flex items-center gap-2 shrink-0 mr-1 select-none">
                <span className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100 whitespace-nowrap">
                  Select Service
                </span>
              </div>
            )}

            {renderServicePills()}
          </div>

          {/* ─── 2. CATEGORY ROW (DIRECTLY BELOW) ─── */}
          <div
            ref={categoryScrollRef}
            onWheel={handleCategoryWheel}
            className="w-full flex items-center overflow-x-auto select-none no-scrollbar"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: '6px 10px',
              boxShadow: 'var(--shadow-neu-card-sm)',
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              whiteSpace: 'nowrap',
              transition: 'background-color 0.2s ease, border-color 0.2s ease',
            }}
          >
            {/* Optional Step 2 Indicator */}
            {showStepNumbers && (
              <div className="flex items-center gap-2 shrink-0 mr-1 select-none">
                <span className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100 whitespace-nowrap">
                  Select Category
                </span>
              </div>
            )}

            {renderCategoryPills()}
          </div>
        </>
      )}

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
          className="relative flex-1"
          style={{
            position: 'relative',
            flex: 1,
            minWidth: '180px',
            background: 'var(--bg-surface-inset)',
            border: '1px solid var(--border)',
            borderRadius: '14px',
            boxShadow: 'var(--shadow-neu-inset)',
            transition: 'background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: '12px',
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
              height: '38px',
              paddingLeft: '38px',
              paddingRight: '44px',
              borderRadius: '14px',
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
