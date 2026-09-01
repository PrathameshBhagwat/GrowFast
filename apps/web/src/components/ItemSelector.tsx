import React, { useState } from 'react';
import { Button } from '@growfast/ui';

interface ItemSelectorProps {
  garments: any[];
  services: any[];
  prices: any[];
  onAddItem: (item: any) => void;
}

export const ItemSelector: React.FC<ItemSelectorProps> = ({ garments, services, prices, onAddItem }) => {
  const [selectedGarmentId, setSelectedGarmentId] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [quantity, setQuantity] = useState(1);

  const activeGarments = garments.filter(g => g.isActive);
  const activeServices = services.filter(s => s.isActive);

  const currentPrice = prices.find(
    (p) => p.garmentCatalogId === selectedGarmentId && p.serviceTypeId === selectedServiceId
  );

  const handleAdd = () => {
    if (!selectedGarmentId || !selectedServiceId || quantity < 1) return;
    
    const garment = garments.find((g) => g.id === selectedGarmentId);
    const service = services.find((s) => s.id === selectedServiceId);

    onAddItem({
      garmentCatalogId: selectedGarmentId,
      serviceTypeId: selectedServiceId,
      quantity,
      garmentName: garment?.name || 'Unknown',
      serviceName: service?.name || 'Unknown',
      unitPrice: currentPrice?.price || 0,
    });

    // Reset selection after adding
    setSelectedGarmentId('');
    setSelectedServiceId('');
    setQuantity(1);
  };

  return (
    <div className="p-4 border rounded-lg bg-white space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Garment</label>
          <select
            className="w-full border-gray-300 rounded-md shadow-sm p-2 border"
            value={selectedGarmentId}
            onChange={(e) => setSelectedGarmentId(e.target.value)}
          >
            <option value="">Select Garment...</option>
            {activeGarments.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Service</label>
          <select
            className="w-full border-gray-300 rounded-md shadow-sm p-2 border"
            value={selectedServiceId}
            onChange={(e) => setSelectedServiceId(e.target.value)}
            disabled={!selectedGarmentId}
          >
            <option value="">Select Service...</option>
            {activeServices.map((s) => {
              // Only show services that have a price for the selected garment
              const hasPrice = prices.some(
                (p) => p.garmentCatalogId === selectedGarmentId && p.serviceTypeId === s.id
              );
              return hasPrice ? (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ) : null;
            })}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
          <div className="flex gap-2">
            <input
              type="number"
              min="1"
              className="w-full border-gray-300 rounded-md shadow-sm p-2 border"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
            />
            <Button
              onClick={handleAdd}
              disabled={!selectedGarmentId || !selectedServiceId || quantity < 1}
            >
              Add
            </Button>
          </div>
        </div>
      </div>
      
      {selectedGarmentId && selectedServiceId && currentPrice && (
        <div className="text-sm text-gray-600">
          Unit Price: <span className="font-semibold text-gray-900">₹{currentPrice.price.toFixed(2)}</span>
        </div>
      )}
    </div>
  );
};
