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
    <div className="flex flex-col h-full bg-slate-50 min-h-0 select-none overflow-hidden">
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
                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>Sort:</span>
                <div style={{ position: 'relative' }}>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    aria-label="Sort garments"
                    style={{
                      appearance: 'none',
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '3px',
                      padding: '5px 24px 5px 8px',
                      fontSize: '12px',
                      fontWeight: 500,
                      color: '#334155',
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
                      color: '#64748b',
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
                  color: '#1e293b',
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
                className={`border rounded-[3px] bg-white p-2 flex flex-col justify-between group transition-all shadow-2xs cursor-pointer ${
                  isSelected
                    ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-50/20 shadow-xs'
                    : 'border-slate-200 hover:border-blue-300 hover:shadow-xs'
                }`}
                style={{
                  background: isSelected ? '#f8faff' : '#ffffff',
                  border: isSelected ? '1px solid #2563eb' : '1px solid #e2e8f0',
                  borderRadius: '3px',
                  padding: '8px 8px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: '180px',
                  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.04)',
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
                    className="text-[10px] font-mono text-slate-400 font-medium tracking-wide select-none"
                    style={{
                      fontSize: '10px',
                      fontFamily: 'monospace',
                      color: '#94a3b8',
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
                        className="bg-[#eff6ff] text-[#2563eb] font-bold text-xs px-1.5 py-0.5 rounded-[2px] border border-[#bfdbfe] whitespace-nowrap shrink-0"
                        style={{
                          background: '#eff6ff',
                          color: '#2563eb',
                          fontWeight: 700,
                          fontSize: '11px',
                          padding: '1px 6px',
                          borderRadius: '2px',
                          border: '1px solid #bfdbfe',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                        }}
                      >
                        ₹{Number(price).toFixed(0)}
                      </span>
                    ) : (
                      <span
                        className="bg-slate-50 text-slate-400 text-[10px] font-medium px-1.5 py-0.5 rounded-[2px] border border-slate-200 whitespace-nowrap shrink-0"
                        style={{
                          background: '#f8fafc',
                          color: '#94a3b8',
                          fontSize: '10px',
                          fontWeight: 500,
                          padding: '1px 5px',
                          borderRadius: '2px',
                          border: '1px solid #e2e8f0',
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
                  className="w-11 h-11 min-w-[44px] min-h-[44px] mx-auto rounded-[3px] bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 group-hover:text-blue-600 group-hover:bg-blue-50/60 transition-colors my-1 shrink-0"
                  style={{
                    width: '44px',
                    height: '44px',
                    minWidth: '44px',
                    minHeight: '44px',
                    margin: '4px auto',
                    borderRadius: '3px',
                    background: '#f8fafc',
                    border: '1px solid #f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#64748b',
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
                    className="text-xs font-bold text-slate-900 truncate leading-tight"
                    style={{
                      fontSize: '11.5px',
                      fontWeight: 700,
                      color: '#0f172a',
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
                    className="text-[10px] text-slate-400 truncate mt-0.5"
                    style={{
                      fontSize: '10px',
                      color: '#94a3b8',
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
                  className="w-full mt-1.5 py-1 px-2 rounded-[2px] border border-blue-600 bg-blue-50 text-blue-700 hover:bg-[#2563eb] hover:text-white text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer shadow-2xs active:scale-[0.98]"
                  style={{
                    height: '28px',
                    minHeight: '28px',
                    borderRadius: '2px',
                    fontSize: '11.5px',
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
          <div className="flex flex-col items-center justify-center h-48 text-slate-400 text-sm">
            <Shirt size={40} strokeWidth={1} className="mb-2 opacity-40" />
            <p className="font-medium text-slate-600">
              {searchQuery
                ? `No garments matching "${searchQuery}"`
                : 'No garments found in this category.'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Try another category or clear your search.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
