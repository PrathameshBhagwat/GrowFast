import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Shirt, Plus, ChevronDown } from 'lucide-react';
import {
  GarmentCategory,
  filterServicesForCategory,
  resolveCatalogSelectionOnCategoryChange,
  resolveCatalogSelectionOnServiceChange,
} from '@growfast/shared-types';
import {
  CatalogNavFilter,
  DEFAULT_CATEGORIES,
  DEFAULT_CATEGORY_LABELS,
  CATALOG_SORT_OPTIONS,
  sortCatalogGarments,
} from './CatalogNavFilter';
import { renderStitchGarmentIcon } from './GarmentIcon';

interface ItemSelectorProps {
  garments: any[];
  services: any[];
  prices: any[];
  onGarmentSelect: (garment: any, serviceId: string, price: number) => void;
  selectedGarmentId?: string;
  onBack?: () => void;
}

const CATEGORIES = DEFAULT_CATEGORIES;
const CATEGORY_LABELS = DEFAULT_CATEGORY_LABELS;

export const ItemSelector: React.FC<ItemSelectorProps> = ({
  garments,
  services,
  prices,
  onGarmentSelect,
  selectedGarmentId,
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const activeServices = useMemo(() => services.filter((s) => s.isActive), [services]);
  const activeGarments = useMemo(() => garments.filter((g) => g.isActive), [garments]);

  const [selectedServiceId, setSelectedServiceId] = useState<string>(activeServices[0]?.id || '');
  const [selectedCategory, setSelectedCategory] = useState<string>(CATEGORIES[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<string>('name-asc');
  const [activeOnly, setActiveOnly] = useState<boolean>(true);

  // Keep first active service selected when loaded
  useEffect(() => {
    if (!selectedServiceId && activeServices.length > 0) {
      setSelectedServiceId(activeServices[0].id);
    }
  }, [activeServices, selectedServiceId]);

  // Keyboard shortcut: F2 focuses search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Visible services based on current category (Shoe hides 3 services)
  const visibleServices = useMemo(() => {
    return filterServicesForCategory(activeServices, selectedCategory);
  }, [activeServices, selectedCategory]);

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
    const newServiceId = resolveCatalogSelectionOnCategoryChange(
      category,
      selectedServiceId,
      activeServices,
    );
    if (newServiceId !== selectedServiceId) {
      setSelectedServiceId(newServiceId);
    }
  };

  const handleServiceSelect = (serviceId: string) => {
    setSelectedServiceId(serviceId);
    const newCategory = resolveCatalogSelectionOnServiceChange(
      serviceId,
      selectedCategory,
      activeServices,
    );
    if (newCategory !== selectedCategory) {
      setSelectedCategory(newCategory as string);
    }
  };

  const filteredGarments = useMemo(() => {
    const sourceList = activeOnly ? activeGarments : garments;
    const list = sourceList.filter((g) => {
      const matchesCategory = g.category === selectedCategory;
      const matchesSearch =
        !searchQuery ||
        g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (CATEGORY_LABELS[g.category] || g.category)
          .toLowerCase()
          .includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });

    return sortCatalogGarments(list, sortBy, (garmentId) => {
      return (
        prices.find(
          (p) => p.garmentCatalogId === garmentId && p.serviceTypeId === selectedServiceId,
        )?.price || 0
      );
    });
  }, [
    activeGarments,
    garments,
    activeOnly,
    selectedCategory,
    searchQuery,
    sortBy,
    prices,
    selectedServiceId,
  ]);

  const handleGarmentClick = (garment: any) => {
    if (!selectedServiceId) return;

    const priceRecord = prices.find(
      (p) => p.garmentCatalogId === garment.id && p.serviceTypeId === selectedServiceId,
    );

    const unitPrice = priceRecord ? priceRecord.price : 0;
    onGarmentSelect(garment, selectedServiceId, unitPrice);
  };

  return (
    <div
      className="flex flex-col h-full min-h-0 select-none overflow-hidden"
      style={{ background: 'var(--bg-surface-inset)' }}
    >
      {/* ─── CATALOG NAV & FILTERS (SERVICE + CATEGORY + SEARCH) ── */}
      <div
        className="shrink-0"
        style={{
          padding: '8px 12px 6px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}
      >
        <CatalogNavFilter
          services={visibleServices}
          activeServiceId={selectedServiceId}
          onServiceChange={handleServiceSelect}
          categories={CATEGORIES}
          categoryLabels={CATEGORY_LABELS}
          activeCategory={selectedCategory}
          onCategoryChange={handleCategorySelect}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchRef={searchInputRef}
          searchPlaceholder={`Search in ${CATEGORY_LABELS[selectedCategory] || selectedCategory} by name, SKU or barcode (e.g. Kurta, Coat, Dhoti)...`}
          rightToolbarContent={
            <div className="flex items-center gap-3">
              {/* Sort: Dropdown */}
              <div className="flex items-center gap-1.5">
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                  Sort:
                </span>
                <div style={{ position: 'relative' }}>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    aria-label="Sort garments"
                    style={{
                      appearance: 'none',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '3px',
                      padding: '5px 24px 5px 8px',
                      fontSize: '12px',
                      fontWeight: 500,
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03)',
                      outline: 'none',
                    }}
                  >
                    {CATALOG_SORT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={13}
                    style={{
                      position: 'absolute',
                      right: '7px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-secondary)',
                      pointerEvents: 'none',
                    }}
                  />
                </div>
              </div>

              {/* Active Only Checkbox */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <input
                  type="checkbox"
                  checked={activeOnly}
                  onChange={(e) => setActiveOnly(e.target.checked)}
                  style={{
                    width: '14px',
                    height: '14px',
                    borderRadius: '3px',
                    accentColor: '#2563eb',
                    cursor: 'pointer',
                  }}
                />
                <span>Active Only</span>
              </label>
            </div>
          }
        />
      </div>

      {/* ─── GARMENT GRID CONTAINER (SCROLLABLE) ─── */}
      <div className="flex-1 overflow-y-auto px-2 pb-2.5 pt-0.5 min-h-0">
        <style>{`
          .order-garment-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
          }
          @media (min-width: 480px) {
            .order-garment-grid {
              grid-template-columns: repeat(3, minmax(0, 1fr));
            }
          }
          @media (min-width: 768px) {
            .order-garment-grid {
              grid-template-columns: repeat(4, minmax(0, 1fr));
            }
          }
          @media (min-width: 1024px) {
            .order-garment-grid {
              grid-template-columns: repeat(5, minmax(0, 1fr));
            }
          }
          @media (min-width: 1200px) {
            .order-garment-grid {
              grid-template-columns: repeat(7, minmax(0, 1fr));
            }
          }
          @media (min-width: 1550px) {
            .order-garment-grid {
              grid-template-columns: repeat(8, minmax(0, 1fr));
            }
          }
          @media (min-width: 1800px) {
            .order-garment-grid {
              grid-template-columns: repeat(9, minmax(0, 1fr));
            }
          }
        `}</style>

        <div className="order-garment-grid w-full">
          {filteredGarments.map((garment, idx) => {
            const priceRecord = prices.find(
              (p) => p.garmentCatalogId === garment.id && p.serviceTypeId === selectedServiceId,
            );
            const hasPrice = priceRecord !== undefined && priceRecord !== null;
            const price = hasPrice ? priceRecord.price : null;
            const isSelected = selectedGarmentId === garment.id;

            const categoryPrefix = (CATEGORY_LABELS[garment.category] || garment.category)
              .substring(0, 3)
              .toUpperCase();
            const sku = `${categoryPrefix}-${String(idx + 1).padStart(2, '0')}`;
            const subtitle = garment.section || garment.description || 'Standard Wear';

            return (
              <div
                key={garment.id}
                onClick={() => handleGarmentClick(garment)}
                className={`border rounded-[3px] p-2 flex flex-col justify-between group transition-all shadow-2xs cursor-pointer ${
                  isSelected
                    ? 'ring-2 ring-blue-500 border-blue-500 shadow-xs'
                    : 'hover:border-blue-300 hover:shadow-xs'
                }`}
                style={{
                  background: isSelected ? 'var(--bg-surface-hover)' : 'var(--bg-surface)',
                  border: isSelected ? '1px solid var(--color-primary)' : '1px solid var(--border)',
                  borderRadius: '3px',
                  padding: '8px 8px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: '180px',
                  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.04)',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                {/* Top Row: SKU + Price Badge */}
                <div
                  className="flex items-center justify-between w-full mb-1"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    marginBottom: '4px',
                  }}
                >
                  <span
                    className="text-[10px] font-mono font-medium tracking-wide select-none"
                    style={{
                      fontSize: '10px',
                      fontFamily: 'monospace',
                      color: 'var(--text-muted)',
                      fontWeight: 500,
                      userSelect: 'none',
                    }}
                  >
                    {sku}
                  </span>
                  <div
                    className="flex items-center gap-1 shrink-0"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      flexShrink: 0,
                    }}
                  >
                    {hasPrice ? (
                      <span
                        className="font-bold text-xs px-1.5 py-0.5 rounded-[2px] whitespace-nowrap shrink-0"
                        style={{
                          background: 'var(--color-primary-light, #eff6ff)',
                          color: 'var(--color-primary, #2563eb)',
                          fontWeight: 700,
                          fontSize: '11px',
                          padding: '1px 6px',
                          borderRadius: '2px',
                          border: '1px solid var(--border)',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                        }}
                      >
                        ₹{Number(price).toFixed(0)}
                        {garment.category === 'WEIGHT_BASED' || selectedCategory === 'WEIGHT_BASED'
                          ? '/kg'
                          : ''}
                      </span>
                    ) : (
                      <span
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded-[2px] whitespace-nowrap shrink-0"
                        style={{
                          background: 'var(--bg-surface-inset)',
                          color: 'var(--text-muted)',
                          fontSize: '10px',
                          fontWeight: 500,
                          padding: '1px 5px',
                          borderRadius: '2px',
                          border: '1px solid var(--border)',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                        }}
                      >
                        No Price
                      </span>
                    )}
                  </div>
                </div>

                {/* Center Icon Box */}
                <div
                  className="w-11 h-11 min-w-[44px] min-h-[44px] mx-auto rounded-[3px] flex items-center justify-center group-hover:text-blue-600 transition-colors my-1 shrink-0"
                  style={{
                    width: '44px',
                    height: '44px',
                    minWidth: '44px',
                    minHeight: '44px',
                    margin: '4px auto',
                    borderRadius: '3px',
                    background: 'var(--bg-surface-inset)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-secondary)',
                    flexShrink: 0,
                  }}
                >
                  {renderStitchGarmentIcon(garment.name)}
                </div>

                {/* Garment Title & Subtitle */}
                <div
                  className="text-center w-full mb-1"
                  style={{ textAlign: 'center', width: '100%', marginBottom: '4px' }}
                >
                  <h3
                    className="text-xs font-bold truncate leading-tight"
                    style={{
                      fontSize: '11.5px',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      lineHeight: 1.25,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={garment.name}
                  >
                    {garment.name}
                  </h3>
                  <p
                    className="text-[10px] truncate mt-0.5"
                    style={{
                      fontSize: '10px',
                      color: 'var(--text-secondary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      marginTop: '1px',
                    }}
                    title={subtitle}
                  >
                    {subtitle}
                  </p>
                </div>

                {/* Bottom Action: + Add (One plus icon and text 'Add') */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleGarmentClick(garment);
                  }}
                  className="w-full mt-1.5 py-1 px-2 rounded-[2px] border text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer shadow-2xs active:scale-[0.98]"
                  style={{
                    height: '28px',
                    minHeight: '28px',
                    borderRadius: '2px',
                    fontSize: '11.5px',
                    border: '1px solid var(--color-primary)',
                    background: 'var(--color-primary-light, #eff6ff)',
                    color: 'var(--color-primary, #2563eb)',
                  }}
                >
                  <Plus size={13} strokeWidth={2.5} />
                  <span>Add</span>
                </button>
              </div>
            );
          })}
        </div>

        {filteredGarments.length === 0 && (
          <div
            className="flex flex-col items-center justify-center h-48 text-sm"
            style={{ color: 'var(--text-secondary)' }}
          >
            <Shirt size={40} strokeWidth={1} className="mb-2 opacity-40" />
            <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
              {searchQuery
                ? `No garments matching "${searchQuery}"`
                : 'No garments found in this category.'}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Try another category or clear your search.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
