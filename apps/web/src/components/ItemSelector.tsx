import React, { useState, useMemo } from 'react';
import { Shirt, Search } from 'lucide-react';
import { GarmentCategory } from '@growfast/shared-types';

interface ItemSelectorProps {
  garments: any[];
  services: any[];
  prices: any[];
  onGarmentSelect: (garment: any, serviceId: string, price: number) => void;
  selectedGarmentId?: string;
}

const CATEGORIES = [
  GarmentCategory.MEN,
  GarmentCategory.WOMEN,
  GarmentCategory.KIDS,
  GarmentCategory.HOUSEHOLD,
  GarmentCategory.HOME_CLEANING,
  GarmentCategory.SHOES,
  GarmentCategory.OTHERS,
  GarmentCategory.WEIGHT_BASED,
];
const CATEGORY_LABELS: Record<string, string> = {
  MEN: 'Men',
  WOMEN: 'Women',
  KIDS: 'Kids',
  HOUSEHOLD: 'Household',
  SHOES: 'Shoes',
  SPECIAL: 'Special',
  WEIGHT_BASED: 'Weight Based',
  OTHERS: 'Others',
  HOME_CLEANING: 'Home Cleaning',
};

export const ItemSelector: React.FC<ItemSelectorProps> = ({
  garments,
  services,
  prices,
  onGarmentSelect,
  selectedGarmentId,
}) => {
  const activeServices = useMemo(() => services.filter((s) => s.isActive), [services]);
  const activeGarments = useMemo(() => garments.filter((g) => g.isActive), [garments]);

  const [selectedServiceId, setSelectedServiceId] = useState<string>(activeServices[0]?.id || '');
  const [selectedCategory, setSelectedCategory] = useState<string>(CATEGORIES[0]);
  const [searchQuery, setSearchQuery] = useState('');

  // Update selected service if it's not in the active services
  React.useEffect(() => {
    if (!selectedServiceId && activeServices.length > 0) {
      setSelectedServiceId(activeServices[0].id);
    }
  }, [activeServices, selectedServiceId]);

  // Determine if a shoe service is currently selected
  const isShoeServiceSelected = activeServices
    .find((s) => s.id === selectedServiceId)
    ?.name.toLowerCase()
    .includes('shoe');

  // Determine if the shoe category is currently selected
  const isShoeCategorySelected = selectedCategory === GarmentCategory.SHOES;

  // Enforce valid combinations if state becomes mismatched
  React.useEffect(() => {
    if (isShoeCategorySelected && !isShoeServiceSelected) {
      const shoeService = activeServices.find((s) => s.name.toLowerCase().includes('shoe'));
      if (shoeService) setSelectedServiceId(shoeService.id);
    } else if (!isShoeCategorySelected && isShoeServiceSelected) {
      const nonShoeService = activeServices.find((s) => !s.name.toLowerCase().includes('shoe'));
      if (nonShoeService) setSelectedServiceId(nonShoeService.id);
    }
  }, [isShoeCategorySelected, isShoeServiceSelected, activeServices]);

  const filteredGarments = useMemo(() => {
    return activeGarments.filter((g) => {
      const matchesCategory = g.category === selectedCategory;
      const matchesSearch = !searchQuery || g.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [activeGarments, selectedCategory, searchQuery]);

  const handleGarmentClick = (garment: any) => {
    if (!selectedServiceId) return;

    const priceRecord = prices.find(
      (p) => p.garmentCatalogId === garment.id && p.serviceTypeId === selectedServiceId,
    );

    const unitPrice = priceRecord ? priceRecord.price : 0;
    onGarmentSelect(garment, selectedServiceId, unitPrice);
  };

  return (
    <div className="flex flex-col h-full bg-white min-h-0 select-none">
      {/* BAR 1: Service Selector Bar */}
      <div className="w-full bg-slate-50 border-b border-slate-200 px-5 py-4 shrink-0 mb-6 shadow-xs">
        <div className="flex flex-col xl:flex-row xl:items-center gap-4">
          <span className="text-sm font-bold text-slate-800 w-20 shrink-0 uppercase tracking-wider">Service</span>
          <div className="flex-1 flex flex-wrap gap-4 w-full">
            {activeServices.map((service) => {
              const isShoeService = service.name.toLowerCase().includes('shoe');
              const isVisuallyDisabled = isShoeCategorySelected ? !isShoeService : false;

              return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => setSelectedServiceId(service.id)}
                  className={`flex-1 min-w-[120px] px-[22px] py-3 rounded-sm text-sm font-bold transition-all whitespace-normal text-center leading-tight break-words min-h-[48px] flex items-center justify-center cursor-pointer border shadow-sm ${
                    selectedServiceId === service.id
                      ? 'bg-primary-600 text-white border-primary-600'
                      : isVisuallyDisabled
                      ? 'bg-gray-50 text-gray-400 border-gray-200 opacity-60'
                      : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400 hover:bg-slate-50'
                  }`}
                >
                  {service.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* BAR 2: Category Selector Bar */}
      <div className="w-full border-y border-slate-200 bg-white px-5 py-4 shrink-0 mt-4 mb-4 shadow-xs">
        <div className="flex flex-col xl:flex-row xl:items-center gap-4">
          <span className="text-sm font-bold text-slate-800 w-20 shrink-0 uppercase tracking-wider">Category</span>
          <div className="flex-1 flex flex-wrap gap-4 w-full">
            {CATEGORIES.map((category) => {
              const isShoeCat = category === GarmentCategory.SHOES;
              const isVisuallyDisabled = isShoeServiceSelected ? !isShoeCat : false;

              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setSelectedCategory(category)}
                  className={`flex-1 min-w-[120px] px-[22px] py-3 whitespace-normal text-center leading-tight break-words text-sm font-bold transition-all min-h-[48px] flex items-center justify-center cursor-pointer rounded-sm border shadow-sm ${
                    selectedCategory === category
                      ? 'bg-primary-600 text-white border-primary-600'
                      : isVisuallyDisabled
                      ? 'bg-gray-50 text-gray-400 border-gray-200 opacity-60'
                      : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400 hover:bg-slate-50'
                  }`}
                >
                  {CATEGORY_LABELS[category] || category}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-5 py-3 border-b border-slate-200 bg-white shrink-0 mb-3">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search size={18} />
          </div>
          <input
            type="text"
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-sm text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
            placeholder="🔍 Search garment to add..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Garment Grid (Scrollable) — 4-column desktop */}
      <div className="flex-1 overflow-y-auto p-4 md:p-5 bg-slate-50 min-h-0">
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
          {filteredGarments.map((garment) => {
            const priceRecord = prices.find(
              (p) => p.garmentCatalogId === garment.id && p.serviceTypeId === selectedServiceId,
            );
            const hasPrice = priceRecord !== undefined && priceRecord !== null;
            const price = hasPrice ? priceRecord.price : null;
            const isSelected = selectedGarmentId === garment.id;

            return (
              <button
                key={garment.id}
                type="button"
                onClick={() => handleGarmentClick(garment)}
                className={`relative flex flex-col items-center justify-between p-4 bg-white rounded-[2px] border transition-all text-left group min-h-[140px] cursor-pointer ${
                  isSelected
                    ? 'border-primary-600 ring-2 ring-primary-500 bg-primary-50/30 shadow-md'
                    : 'border-slate-200 shadow-xs hover:shadow-md hover:border-primary-400 hover:bg-slate-50/50'
                }`}
                title={garment.name}
              >
                {/* Price Badge */}
                {hasPrice ? (
                  <div className="absolute top-0 right-0 bg-slate-900 text-white text-xs font-bold px-2.5 py-1 rounded-bl-[2px] rounded-tr-[2px] shadow-xs">
                    ₹{price}
                  </div>
                ) : (
                  <div className="absolute top-0 right-0 bg-amber-50 text-amber-800 border-l border-b border-amber-200 text-[10px] font-semibold px-2 py-0.5 rounded-bl-[2px] rounded-tr-[2px]">
                    Not Configured
                  </div>
                )}

                <div className="w-14 h-14 rounded-[2px] bg-slate-100 flex items-center justify-center text-slate-500 group-hover:text-primary-600 group-hover:bg-primary-50 transition-colors mt-2 mb-2">
                  <Shirt size={28} strokeWidth={1.5} />
                </div>

                <span className="text-sm text-center font-medium text-slate-800 line-clamp-2 leading-tight px-1 w-full">
                  {garment.name}
                </span>
              </button>
            );
          })}
        </div>

        {filteredGarments.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400 text-sm">
            <Shirt size={40} strokeWidth={1} className="mb-2 opacity-50" />
            <p className="font-medium text-slate-600">
              {searchQuery ? `No garments matching "${searchQuery}"` : 'No garments found in this category.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
