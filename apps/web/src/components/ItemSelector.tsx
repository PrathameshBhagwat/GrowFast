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

const CATEGORIES = Object.values(GarmentCategory);
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
      {/* BAR 1: Service Tabs — horizontally scrollable row */}
      <div className="flex items-center overflow-x-auto gap-2 p-3 bg-slate-50 border-b border-slate-200 hide-scrollbar shrink-0">
        {activeServices.map((service) => (
          <button
            key={service.id}
            type="button"
            onClick={() => setSelectedServiceId(service.id)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap min-h-[44px] flex items-center justify-center cursor-pointer ${
              selectedServiceId === service.id
                ? 'bg-primary-600 text-white shadow-sm border border-primary-600'
                : 'bg-white text-slate-700 border border-slate-200 hover:border-primary-300 hover:bg-primary-50/50'
            }`}
          >
            {service.name}
          </button>
        ))}
      </div>

      {/* BAR 2: Category Tabs — horizontally scrollable row */}
      <div className="flex items-center overflow-x-auto border-b border-slate-200 bg-white hide-scrollbar shrink-0 px-2">
        {CATEGORIES.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setSelectedCategory(category)}
            className={`px-4 py-3 whitespace-nowrap text-sm font-semibold transition-colors min-h-[44px] flex items-center justify-center cursor-pointer ${
              selectedCategory === category
                ? 'text-primary-700 border-b-2 border-primary-600 bg-primary-50/50'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            {CATEGORY_LABELS[category] || category}
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <div className="p-3 border-b border-slate-200 bg-white shrink-0">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search size={18} />
          </div>
          <input
            type="text"
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
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
                className={`relative flex flex-col items-center justify-between p-4 bg-white rounded-2xl border transition-all text-left group min-h-[140px] cursor-pointer ${
                  isSelected
                    ? 'border-primary-600 ring-2 ring-primary-500 bg-primary-50/30 shadow-md'
                    : 'border-slate-200 shadow-xs hover:shadow-md hover:border-primary-400 hover:bg-slate-50/50'
                }`}
                title={garment.name}
              >
                {/* Price Badge */}
                {hasPrice ? (
                  <div className="absolute top-0 right-0 bg-slate-900 text-white text-xs font-bold px-2.5 py-1 rounded-bl-xl rounded-tr-2xl shadow-xs">
                    ₹{price}
                  </div>
                ) : (
                  <div className="absolute top-0 right-0 bg-amber-50 text-amber-800 border-l border-b border-amber-200 text-[10px] font-semibold px-2 py-0.5 rounded-bl-xl rounded-tr-2xl">
                    Not Configured
                  </div>
                )}

                <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500 group-hover:text-primary-600 group-hover:bg-primary-50 transition-colors mt-2 mb-2">
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
