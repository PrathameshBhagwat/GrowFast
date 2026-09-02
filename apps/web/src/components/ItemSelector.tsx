import React, { useState, useMemo } from 'react';
import { Shirt, Search } from 'lucide-react';
import { GarmentCategory } from '@growfast/shared-types';

interface ItemSelectorProps {
  garments: any[];
  services: any[];
  prices: any[];
  onGarmentSelect: (garment: any, serviceId: string, price: number) => void;
}

const CATEGORIES = Object.values(GarmentCategory);
const CATEGORY_LABELS: Record<string, string> = {
  MEN: 'Men',
  WOMEN: 'Women',
  KIDS: 'Kids',
  HOUSEHOLD: 'Household',
  SHOES: 'Shoes',
  SPECIAL: 'Special',
};

export const ItemSelector: React.FC<ItemSelectorProps> = ({
  garments,
  services,
  prices,
  onGarmentSelect,
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
      const matchesSearch = g.name.toLowerCase().includes(searchQuery.toLowerCase());
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
    <div className="flex flex-col h-full bg-white">
      {/* Service Tabs */}
      <div className="flex overflow-x-auto border-b bg-gray-50 hide-scrollbar shrink-0">
        {activeServices.map((service) => (
          <button
            key={service.id}
            onClick={() => setSelectedServiceId(service.id)}
            className={`px-4 py-3 whitespace-nowrap text-sm font-medium border-b-2 transition-colors ${
              selectedServiceId === service.id
                ? 'border-primary-600 text-primary-700 bg-white'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            {service.name}
          </button>
        ))}
      </div>

      {/* Category Tabs */}
      <div className="flex overflow-x-auto border-b bg-white hide-scrollbar shrink-0">
        {CATEGORIES.map((category) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-4 py-3 whitespace-nowrap text-sm font-semibold transition-colors ${
              selectedCategory === category
                ? 'text-gray-900 border-b-2 border-gray-900'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {CATEGORY_LABELS[category] || category}
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <div className="p-3 border-b bg-white shrink-0">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
            <Search size={18} />
          </div>
          <input
            type="text"
            className="w-full pl-10 pr-4 py-2 border rounded-md min-h-[44px] text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Search garment to add..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Garment Grid (Scrollable) */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-9 gap-3">
          {filteredGarments.map((garment) => {
            const priceRecord = prices.find(
              (p) => p.garmentCatalogId === garment.id && p.serviceTypeId === selectedServiceId,
            );
            const price = priceRecord ? priceRecord.price : 0;

            return (
              <button
                key={garment.id}
                onClick={() => handleGarmentClick(garment)}
                className="relative flex flex-col items-center justify-center p-3 bg-white rounded-md border shadow-sm hover:shadow-md hover:border-primary-300 transition-all active:scale-95 group"
                title={garment.name}
              >
                {/* Price Badge inside Tile */}
                <div className="absolute top-0 right-0 bg-gray-900 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-bl-md rounded-tr-md">
                  ₹{price}
                </div>

                <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:text-primary-500 transition-colors mb-2 mt-2">
                  <Shirt size={22} strokeWidth={1.5} />
                </div>

                <span className="text-[11px] text-center font-medium text-gray-800 line-clamp-2 leading-tight px-1">
                  {garment.name}
                </span>
              </button>
            );
          })}
        </div>

        {filteredGarments.length === 0 && (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            No garments found in this category.
          </div>
        )}
      </div>
    </div>
  );
};
