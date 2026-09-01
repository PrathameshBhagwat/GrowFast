import React, { useState, useMemo } from 'react';
import { Shirt } from 'lucide-react';
import { GarmentCategory } from '@growfast/shared-types';

interface ItemSelectorProps {
  garments: any[];
  services: any[];
  prices: any[];
  onAddItem: (item: any) => void;
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

export const ItemSelector: React.FC<ItemSelectorProps> = ({ garments, services, prices, onAddItem }) => {
  const activeServices = useMemo(() => services.filter(s => s.isActive), [services]);
  const activeGarments = useMemo(() => garments.filter(g => g.isActive), [garments]);

  const [selectedServiceId, setSelectedServiceId] = useState<string>(activeServices[0]?.id || '');
  const [selectedCategory, setSelectedCategory] = useState<string>(CATEGORIES[0]);

  // Update selected service if it's not in the active services
  React.useEffect(() => {
    if (!selectedServiceId && activeServices.length > 0) {
      setSelectedServiceId(activeServices[0].id);
    }
  }, [activeServices, selectedServiceId]);

  const filteredGarments = useMemo(() => {
    return activeGarments.filter(g => g.category === selectedCategory);
  }, [activeGarments, selectedCategory]);

  const handleGarmentClick = (garment: any) => {
    if (!selectedServiceId) return;

    const service = activeServices.find(s => s.id === selectedServiceId);
    const priceRecord = prices.find(
      p => p.garmentCatalogId === garment.id && p.serviceTypeId === selectedServiceId
    );
    
    // Default to 0 if no price found, though ideally shouldn't happen or should be disabled
    const unitPrice = priceRecord ? priceRecord.price : 0;

    onAddItem({
      garmentCatalogId: garment.id,
      serviceTypeId: selectedServiceId,
      quantity: 1, // Default add 1
      garmentName: garment.name,
      serviceName: service?.name || 'Unknown',
      unitPrice,
    });
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Service Tabs */}
      <div className="flex overflow-x-auto border-b bg-gray-50 hide-scrollbar shrink-0">
        {activeServices.map(service => (
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
        {CATEGORIES.map(category => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-4 py-2 whitespace-nowrap text-xs font-semibold transition-colors ${
              selectedCategory === category 
                ? 'text-gray-900 border-b-2 border-gray-900' 
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {CATEGORY_LABELS[category] || category}
          </button>
        ))}
      </div>

      {/* Garment Grid (Scrollable) */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-100">
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {filteredGarments.map(garment => {
            const priceRecord = prices.find(
              p => p.garmentCatalogId === garment.id && p.serviceTypeId === selectedServiceId
            );
            const price = priceRecord ? priceRecord.price : 0;

            return (
              <button
                key={garment.id}
                onClick={() => handleGarmentClick(garment)}
                className="relative flex flex-col items-center justify-center p-3 bg-white rounded-lg border shadow-sm hover:shadow-md hover:border-primary-300 transition-all active:scale-95 group"
                title={garment.name}
              >
                {/* Price Badge */}
                <div className="absolute top-0 right-0 bg-gray-800 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-bl-lg rounded-tr-lg">
                  ₹{price}
                </div>
                
                <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:text-primary-500 transition-colors mb-2">
                  <Shirt size={24} strokeWidth={1.5} />
                </div>
                
                <span className="text-xs text-center font-medium text-gray-800 line-clamp-2 leading-tight">
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
