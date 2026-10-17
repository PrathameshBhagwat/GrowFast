import React, { useState, useMemo, useRef } from 'react';
import {
  X,
  Plus,
  Minus,
  Sparkles,
  Check,
  Trash2,
  Tag,
  FileText,
  AlertCircle,
  Shirt,
  Scale,
  ShoppingBag,
  Camera,
  Upload,
} from 'lucide-react';
import { formatCatalogServiceName } from '@growfast/shared-types';

export interface LaundryWeightItem {
  id: string;
  garmentCatalogId: string;
  garmentName: string;
  serviceTypeId: string;
  serviceName: string;
  weight: number;
  garmentsCount: number;
  unitPrice: number;
  lineTotal: number;
  addOns?: Array<{ id: string; name: string; price: number }>;
  defectNotes?: string;
  breakdownDetails?: string;
  batchPhotos?: Array<{ id: string; file: File; previewUrl: string }>;
}

export interface LaundryWeightOrderEntryProps {
  services: Array<{
    id: string;
    name: string;
    category?: string;
    isActive?: boolean;
    estimatedDays?: number;
  }>;
  prices: Array<{
    garmentCatalogId: string;
    serviceTypeId: string;
    price: number;
    storeId?: string | null;
  }>;
  weightGarments: Array<{
    id: string;
    name: string;
    category: string;
    isActive?: boolean;
  }>;
  items: any[];
  onAddToCart: (item: LaundryWeightItem) => void;
  onRemoveItem: (index: number) => void;
  onCheckout: () => void;
  onAddBatchPhotoToItem?: (itemIndex: number, file: File) => void;
  onRemoveBatchPhotoFromItem?: (itemIndex: number, photoId: string) => void;
  isSubmitting?: boolean;
  pendingPickupsCount?: number;
  className?: string;
}

export const AVAILABLE_ADDONS = [
  { id: 'addon-starch', name: 'Starching', price: 30, description: 'Crisp starch finish per kg' },
  { id: 'addon-stain', name: 'Stain Treatment', price: 50, description: 'Spot stain removal' },
  {
    id: 'addon-fragrance',
    name: 'Fragrance Booster',
    price: 20,
    description: 'Long-lasting fresh scent',
  },
  {
    id: 'addon-antiseptic',
    name: 'Antiseptic Hygiene Wash',
    price: 25,
    description: 'Disinfectant sanitization',
  },
];

export const LaundryWeightOrderEntry: React.FC<LaundryWeightOrderEntryProps> = ({
  services,
  prices,
  weightGarments,
  items,
  onAddToCart,
  onRemoveItem,
  onCheckout,
  onAddBatchPhotoToItem,
  onRemoveBatchPhotoFromItem,
  isSubmitting = false,
  pendingPickupsCount = 164,
  className = '',
}) => {
  const [showBanner, setShowBanner] = useState(true);

  // Available Laundry Services: Strictly wash-related services
  const laundryServices = useMemo(() => {
    const validWeightServiceNames = [
      'wash and steam iron',
      'wash + steam iron',
      'wash and fold',
      'premium laundry',
      'woolen laundry',
      'laundry for white',
      'standard wash',
    ];
    return services.filter((s) => {
      const name = s.name.trim().toLowerCase();
      return (
        s.isActive !== false &&
        (validWeightServiceNames.includes(name) ||
          s.category === 'WASH' ||
          s.category === 'WASH_IRON') &&
        name !== 'dry clean' &&
        s.category !== 'DRY_CLEAN' &&
        name !== 'free shoe' &&
        name !== 'reprocess cleaning' &&
        name !== 'shoe cleaning' &&
        s.category !== 'SHOE_CLEAN' &&
        s.category !== 'LEATHER_CLEAN' &&
        s.category !== 'STAIN_REMOVAL' &&
        s.category !== 'STEAM_PRESS' &&
        !name.includes('starch')
      );
    });
  }, [services]);

  // Selected Service state (default to first available)
  const [selectedServiceId, setSelectedServiceId] = useState<string>(() => {
    // Prefer Wash and Steam Iron or Wash and Fold
    const preferred = laundryServices.find((s) =>
      ['wash and steam iron', 'wash + steam iron', 'wash and fold'].includes(
        s.name.trim().toLowerCase(),
      ),
    );
    return preferred?.id || laundryServices[0]?.id || '';
  });

  // Ensure valid selectedServiceId
  const activeService = useMemo(() => {
    return (
      laundryServices.find((s) => s.id === selectedServiceId) ||
      laundryServices[0] || { id: '', name: 'Standard Wash' }
    );
  }, [laundryServices, selectedServiceId]);

  // Bulk Laundry / Weight Garment
  const activeWeightGarment = useMemo(() => {
    return (
      weightGarments.find((g) => g.name.toLowerCase().includes('bulk')) ||
      weightGarments[0] || {
        id: 'g-wb-10',
        name: 'Bulk Laundry',
        category: 'WEIGHT_BASED',
      }
    );
  }, [weightGarments]);

  // Price per KG for the active service
  const pricePerKg = useMemo(() => {
    const match = prices.find(
      (p) =>
        p.serviceTypeId === activeService.id &&
        (p.garmentCatalogId === activeWeightGarment?.id || !p.garmentCatalogId),
    );
    if (match && match.price > 0) return match.price;

    // Fallbacks based on standard initial services
    const name = activeService.name.trim().toLowerCase();
    if (name.includes('woolen')) return 140;
    if (name.includes('premium')) return 120;
    if (name.includes('white')) return 110;
    if (name.includes('iron') || name.includes('steam')) return 95;
    return 80;
  }, [prices, activeService, activeWeightGarment]);

  // Form states matching Screenshot 1
  const [weightInput, setWeightInput] = useState<string>('2.00');
  const [garmentsCountInput, setGarmentsCountInput] = useState<number>(1);
  const [selectedAddOns, setSelectedAddOns] = useState<
    Array<{ id: string; name: string; price: number }>
  >([]);
  const [garmentBreakdown, setGarmentBreakdown] = useState<string>('');
  const [defectNotes, setDefectNotes] = useState<string>('');
  const [weightValidationMsg, setWeightValidationMsg] = useState<string | null>(null);

  // Batch Photos state (Walk-in order requirement)
  const [batchPhotos, setBatchPhotos] = useState<
    Array<{ id: string; file: File; previewUrl: string }>
  >([]);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newPhotos = Array.from(files).map((f) => ({
      id: `photo-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      file: f,
      previewUrl: URL.createObjectURL(f),
    }));
    setBatchPhotos((prev) => [...prev, ...newPhotos]);
  };

  const handleQuickSnapPhoto = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#2563eb';
      ctx.fillRect(0, 0, 400, 300);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`Batch Photo: ${activeWeightGarment.name}`, 200, 130);
      ctx.font = '14px sans-serif';
      ctx.fillText(`${weightInput} kg • ${new Date().toLocaleTimeString()}`, 200, 170);
    }
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], `batch-${Date.now()}.jpg`, { type: 'image/jpeg' });
          const previewUrl = URL.createObjectURL(file);
          setBatchPhotos((prev) => [
            ...prev,
            {
              id: `photo-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
              file,
              previewUrl,
            },
          ]);
        }
      },
      'image/jpeg',
      0.9,
    );
  };

  // Modals for Add-on and Garment Details
  const [isAddonModalOpen, setIsAddonModalOpen] = useState(false);
  const [isGarmentDetailsModalOpen, setIsGarmentDetailsModalOpen] = useState(false);

  const parsedWeight = parseFloat(weightInput);
  const isWeightValid = !isNaN(parsedWeight) && parsedWeight >= 2.0;

  // Handle Weight Input Change
  const handleWeightChange = (val: string) => {
    setWeightInput(val);
    const num = parseFloat(val);
    if (val.trim() === '' || isNaN(num) || num < 2.0) {
      setWeightValidationMsg('Minimum permitted weight is 2.00 kg.');
    } else {
      setWeightValidationMsg(null);
    }
  };

  // Preset Weight quick-buttons
  const setPresetWeight = (kg: number) => {
    setWeightInput(kg.toFixed(2));
    setWeightValidationMsg(null);
  };

  const adjustWeight = (delta: number) => {
    const cur = parseFloat(weightInput) || 2.0;
    const next = Math.max(2.0, Math.round((cur + delta) * 100) / 100);
    setWeightInput(next.toFixed(2));
    setWeightValidationMsg(null);
  };

  // Add to Cart handler
  const handleAddToCart = () => {
    const wt = parseFloat(weightInput);
    if (isNaN(wt) || wt < 2.0) {
      setWeightValidationMsg('Minimum permitted weight is 2.00 kg.');
      return;
    }

    const addOnsTotal = selectedAddOns.reduce((sum, a) => sum + a.price, 0);
    const baseTotal = Math.round(wt * pricePerKg * 100) / 100;
    const lineTotal = Math.round((baseTotal + addOnsTotal) * 100) / 100;

    const newItem: LaundryWeightItem = {
      id: `w-item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      garmentCatalogId: activeWeightGarment.id,
      garmentName: activeWeightGarment.name,
      serviceTypeId: activeService.id,
      serviceName: activeService.name,
      weight: wt,
      garmentsCount: Math.max(1, garmentsCountInput || 1),
      unitPrice: pricePerKg,
      lineTotal,
      addOns: [...selectedAddOns],
      defectNotes: defectNotes.trim() || undefined,
      breakdownDetails: garmentBreakdown.trim() || undefined,
      batchPhotos: [...batchPhotos],
    };

    onAddToCart(newItem);

    // Reset details for next item while keeping a clean state
    setSelectedAddOns([]);
    setGarmentBreakdown('');
    setDefectNotes('');
    setBatchPhotos([]);
    setWeightValidationMsg(null);
  };

  // Total Summary
  const { totalWeight, totalGarments, totalAmount } = useMemo(() => {
    let w = 0;
    let g = 0;
    let amt = 0;

    for (const item of items) {
      if (item.weight != null && item.weight > 0) {
        w += item.weight;
      }
      g += item.garmentsCount || item.quantity || 1;
      amt += item.lineTotal || (item.unitPrice || 0) * (item.weight || item.quantity || 1);
    }

    return {
      totalWeight: Math.round(w * 100) / 100,
      totalGarments: g,
      totalAmount: Math.round(amt * 100) / 100,
    };
  }, [items]);

  // Render Service Card Icon matching Screenshot 1
  const renderServiceIcon = (serviceName: string) => {
    const name = serviceName.trim().toLowerCase();
    if (name.includes('iron') || name.includes('steam')) {
      return (
        <div className="w-12 h-12 rounded-full border border-pink-200 bg-pink-50 flex items-center justify-center text-pink-600 transition-transform group-hover:scale-105">
          <svg
            className="w-6 h-6 stroke-current"
            viewBox="0 0 24 24"
            fill="none"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Iron / Ironing Board illustration */}
            <path d="M4 18h16" />
            <path d="M7 18l5-8h6a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H7z" />
            <circle cx="15" cy="14" r="1" fill="currentColor" />
          </svg>
        </div>
      );
    }
    if (name.includes('fold')) {
      return (
        <div className="w-12 h-12 rounded-full border border-pink-200 bg-pink-50 flex items-center justify-center text-pink-600 transition-transform group-hover:scale-105">
          <Shirt size={24} strokeWidth={1.8} />
        </div>
      );
    }
    // Washing Machine for Premium, Woolen, and Whites
    return (
      <div className="w-12 h-12 rounded-full border border-slate-300 bg-slate-100 flex items-center justify-center text-slate-600 transition-transform group-hover:scale-105">
        <svg
          className="w-6 h-6 stroke-current"
          viewBox="0 0 24 24"
          fill="none"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="12" cy="13" r="5" />
          <path d="M12 10a3 3 0 0 1 3 3" />
          <circle cx="7" cy="6" r="1" fill="currentColor" />
          <circle cx="10" cy="6" r="1" fill="currentColor" />
        </svg>
      </div>
    );
  };

  return (
    <div
      className={`flex flex-col w-full h-full min-h-0 bg-white font-sans ${className}`}
      style={{ background: 'var(--bg-surface, #ffffff)' }}
    >
      {/* ─── 1. TOP NOTIFICATION BANNER (Matching Screenshot 1) ─── */}
      {showBanner && (
        <div
          id="laundry-weight-notification-banner"
          className="shrink-0 flex items-center justify-between px-4 py-2 text-xs sm:text-sm font-medium transition-all"
          style={{
            background: '#e0f2fe',
            color: '#0369a1',
            borderBottom: '1px solid #bae6fd',
          }}
        >
          <div className="flex-1 text-center font-normal">
            You have <strong className="font-bold text-[#0284c7]">{pendingPickupsCount}</strong>{' '}
            pending pick up requests.
          </div>
          <button
            type="button"
            onClick={() => setShowBanner(false)}
            className="text-[#0369a1] hover:text-[#075985] p-1 rounded-sm cursor-pointer ml-2"
            title="Dismiss notification"
            aria-label="Dismiss notification"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ─── 2. MAIN SPLIT INTERFACE ─── */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        {/* LEFT PANEL: Service Cards + Weight Form Controls */}
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-4 sm:p-6 border-r border-slate-200">
          {/* Service Cards Row */}
          <div className="mb-6">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">
              Select Laundry Service:
            </label>
            <div
              className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2.5 sm:gap-3"
              role="radiogroup"
              aria-label="Laundry Services"
            >
              {laundryServices.map((svc) => {
                const isSelected = svc.id === activeService.id;
                const formattedName = formatCatalogServiceName(svc.name);
                return (
                  <button
                    key={svc.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => setSelectedServiceId(svc.id)}
                    className={`group relative flex flex-col items-center justify-between p-3 rounded-sm border transition-all text-center min-h-[110px] cursor-pointer select-none ${
                      isSelected
                        ? 'border-2 border-slate-800 bg-slate-50 shadow-xs'
                        : 'border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50/50'
                    }`}
                  >
                    {/* Service Name */}
                    <span
                      className={`text-xs font-semibold leading-tight line-clamp-2 h-8 flex items-center justify-center ${
                        isSelected ? 'text-slate-900 font-bold' : 'text-slate-700'
                      }`}
                    >
                      {formattedName}
                    </span>

                    {/* Circular Icon */}
                    <div className="my-1.5">{renderServiceIcon(svc.name)}</div>

                    {/* Selection Indicator Dot/Tag */}
                    {isSelected && (
                      <span className="inline-block w-2 h-2 rounded-full bg-blue-600 mt-1" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dual-Cell Form Entry (Matching Screenshot 1) */}
          <div className="flex-1 flex flex-col items-center justify-center max-w-xl mx-auto w-full my-auto py-2">
            <div className="w-full space-y-3.5">
              {/* Row 1: Weight Input */}
              <div>
                <div className="flex items-stretch shadow-2xs">
                  <div className="w-36 sm:w-44 bg-slate-200 text-slate-700 font-semibold text-sm sm:text-base flex items-center justify-center border border-slate-300 rounded-l-sm select-none">
                    Weight
                  </div>
                  <div className="relative flex-1">
                    <input
                      id="laundry-weight-input"
                      type="number"
                      step="0.1"
                      min="2.00"
                      value={weightInput}
                      onChange={(e) => handleWeightChange(e.target.value)}
                      aria-label="Measured Weight in kilograms"
                      placeholder="2.00"
                      className={`w-full h-13 px-4 bg-white border border-l-0 border-slate-300 rounded-r-sm text-2xl sm:text-3xl font-extrabold text-center text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        weightValidationMsg ? 'border-red-400 text-red-600 ring-1 ring-red-400' : ''
                      }`}
                    />
                  </div>
                </div>

                {/* Validation and Quick Steppers */}
                <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => adjustWeight(-0.5)}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-xs font-semibold text-slate-700 cursor-pointer"
                      title="Minus 0.5 kg"
                    >
                      -0.5 kg
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustWeight(0.5)}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-xs font-semibold text-slate-700 cursor-pointer"
                      title="Plus 0.5 kg"
                    >
                      +0.5 kg
                    </button>
                    <span className="text-slate-300 mx-1">|</span>
                    {[2.0, 3.0, 5.0, 10.0].map((kg) => (
                      <button
                        key={kg}
                        type="button"
                        onClick={() => setPresetWeight(kg)}
                        className={`px-2 py-1 rounded text-xs font-semibold transition-colors cursor-pointer border ${
                          parseFloat(weightInput) === kg
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200'
                        }`}
                      >
                        {kg.toFixed(0)} kg
                      </button>
                    ))}
                  </div>
                  {weightValidationMsg ? (
                    <span className="text-xs font-bold text-red-600 flex items-center gap-1">
                      <AlertCircle size={13} /> {weightValidationMsg}
                    </span>
                  ) : (
                    <span className="text-[11px] font-medium text-slate-500">Min: 2.00 kg</span>
                  )}
                </div>
              </div>

              {/* Row 2: Price/ KG */}
              <div className="flex items-stretch shadow-2xs">
                <div className="w-36 sm:w-44 bg-slate-200 text-slate-700 font-semibold text-sm sm:text-base flex items-center justify-center border border-slate-300 rounded-l-sm select-none">
                  Price/ KG
                </div>
                <div className="flex-1 h-13 px-4 bg-white border border-l-0 border-slate-300 rounded-r-sm text-2xl sm:text-3xl font-extrabold text-center text-slate-800 flex items-center justify-center select-all">
                  {pricePerKg}
                </div>
              </div>

              {/* Row 3: No. of Garments */}
              <div className="flex items-stretch shadow-2xs">
                <div className="w-36 sm:w-44 bg-slate-200 text-slate-700 font-semibold text-sm sm:text-base flex items-center justify-center border border-slate-300 rounded-l-sm select-none">
                  No. of Garments
                </div>
                <div className="relative flex-1">
                  <input
                    id="laundry-garment-count-input"
                    type="number"
                    min="1"
                    step="1"
                    value={garmentsCountInput || ''}
                    onChange={(e) =>
                      setGarmentsCountInput(Math.max(1, parseInt(e.target.value, 10) || 1))
                    }
                    aria-label="Number of garments in laundry batch"
                    className="w-full h-13 px-4 bg-white border border-l-0 border-slate-300 rounded-r-sm text-2xl sm:text-3xl font-extrabold text-center text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Row 4: Two Action Buttons [Add on] and [Garment Details] */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  id="laundry-addon-btn"
                  onClick={() => setIsAddonModalOpen(true)}
                  className="h-11 px-4 bg-white hover:bg-slate-50 border border-slate-300 rounded-sm font-semibold text-xs sm:text-sm text-slate-800 flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-h-[44px]"
                >
                  <Tag size={15} className="text-slate-500" />
                  <span>Add on</span>
                  {selectedAddOns.length > 0 && (
                    <span className="bg-blue-600 text-white text-[11px] font-bold px-1.5 py-0.2 rounded-full ml-1">
                      {selectedAddOns.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  id="laundry-garment-details-btn"
                  onClick={() => setIsGarmentDetailsModalOpen(true)}
                  className="h-11 px-4 bg-white hover:bg-slate-50 border border-slate-300 rounded-sm font-semibold text-xs sm:text-sm text-slate-800 flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-h-[44px]"
                >
                  <FileText size={15} className="text-slate-500" />
                  <span>Garment Details</span>
                  {(garmentBreakdown.trim() || defectNotes.trim()) && (
                    <span className="w-2 h-2 rounded-full bg-blue-600 ml-1" />
                  )}
                </button>
              </div>

              {/* Selected Add-ons Badges */}
              {selectedAddOns.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] font-bold text-slate-500">Selected Add-ons:</span>
                  {selectedAddOns.map((addon) => (
                    <span
                      key={addon.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200"
                    >
                      {addon.name} (+₹{addon.price})
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedAddOns(selectedAddOns.filter((a) => a.id !== addon.id))
                        }
                        className="hover:text-blue-900 cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Row 4.5: Batch Photos (Walk-in Requirement) */}
              <div className="pt-2 border-t border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Camera size={15} className="text-slate-700" />
                    <span className="text-xs font-bold text-slate-800">Batch Photo</span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      (Mandatory for walk-in laundry)
                    </span>
                  </div>
                  {batchPhotos.length > 0 ? (
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Check size={11} strokeWidth={3} /> {batchPhotos.length} Attached
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <AlertCircle size={11} /> 1 Photo Required
                    </span>
                  )}
                </div>

                {/* Photo Action Buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      handlePhotoFiles(e.target.files);
                      e.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    id="laundry-take-batch-photo-btn"
                    onClick={() => photoInputRef.current?.click()}
                    className="h-10 px-3 bg-white hover:bg-slate-50 border border-slate-300 rounded-sm font-semibold text-xs text-slate-800 flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-h-[40px]"
                  >
                    <Camera size={14} className="text-blue-600" />
                    <span>Upload / Snap</span>
                  </button>

                  <button
                    type="button"
                    id="laundry-quick-photo-btn"
                    onClick={handleQuickSnapPhoto}
                    className="h-10 px-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-sm font-semibold text-xs text-blue-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-h-[40px]"
                    title="Quick snap photo for counter speed"
                  >
                    <Sparkles size={14} className="text-blue-600" />
                    <span>Quick Snap</span>
                  </button>
                </div>

                {/* Photo Thumbnails */}
                {batchPhotos.length > 0 && (
                  <div className="flex items-center gap-2 overflow-x-auto py-1">
                    {batchPhotos.map((photo) => (
                      <div
                        key={photo.id}
                        className="relative w-14 h-14 rounded-md border border-slate-300 overflow-hidden shrink-0 group bg-slate-100"
                      >
                        <img
                          src={photo.previewUrl}
                          alt="Batch preview"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setBatchPhotos((prev) => prev.filter((p) => p.id !== photo.id))
                          }
                          className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black transition-colors cursor-pointer"
                          title="Remove photo"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Row 5: Add to Cart Button */}
              <div className="pt-2">
                <button
                  type="button"
                  id="laundry-add-to-cart-btn"
                  onClick={handleAddToCart}
                  disabled={!isWeightValid}
                  className={`w-full h-12 rounded-sm font-bold text-base tracking-wide flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer min-h-[44px] ${
                    isWeightValid
                      ? 'bg-[#2563eb] hover:bg-blue-700 text-white active:scale-[0.99]'
                      : 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-80'
                  }`}
                >
                  <Plus size={18} strokeWidth={2.5} />
                  <span>Add to Cart</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Selected Garments & Checkout (Matching Screenshot 1) */}
        <div
          className="w-full lg:w-[420px] xl:w-[450px] shrink-0 flex flex-col bg-slate-50 border-t lg:border-t-0 lg:border-l border-slate-200 h-full min-h-0"
          style={{ background: '#f8fafc' }}
        >
          {/* Header */}
          <div className="px-5 pt-4 pb-2">
            <h3 className="text-base font-bold text-slate-900 tracking-tight">Selected Garments</h3>
            <hr className="mt-2.5 border-slate-200" />
          </div>

          {/* Item List Container */}
          <div className="flex-1 overflow-y-auto px-5 py-2 space-y-2.5 min-h-[160px]">
            {items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                <ShoppingBag size={40} className="mb-2 text-slate-300 stroke-[1.2]" />
                <p className="text-sm font-medium text-slate-500">No garments added yet</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Select a service, enter weight (min 2.00 kg), attach photo, and click Add to Cart
                </p>
              </div>
            ) : (
              items.map((item, idx) => {
                const isWeightItem = item.weight != null && item.weight > 0;
                return (
                  <div
                    key={item.id || idx}
                    className="p-3 bg-white border border-slate-200 rounded-sm shadow-2xs relative flex items-start justify-between gap-3 group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-bold text-slate-900">
                          {formatCatalogServiceName(
                            item.serviceName || item.serviceType?.name || 'Laundry',
                          )}
                        </span>
                        {isWeightItem && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded">
                            {item.weight} kg
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                        {isWeightItem ? (
                          <>
                            <span>Rate: ₹{item.unitPrice}/kg</span>
                            <span>•</span>
                            <span>{item.garmentsCount || item.quantity || 1} Garments</span>
                          </>
                        ) : (
                          <>
                            <span>Qty: {item.quantity}</span>
                            <span>•</span>
                            <span>Rate: ₹{item.unitPrice}</span>
                          </>
                        )}
                      </div>

                      {item.addOns && item.addOns.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {item.addOns.map((ad: any) => (
                            <span
                              key={ad.id}
                              className="text-[10px] font-semibold px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded"
                            >
                              +{ad.name}
                            </span>
                          ))}
                        </div>
                      )}

                      {item.breakdownDetails && (
                        <p className="text-[11px] text-slate-600 italic mt-1 line-clamp-2">
                          Breakdown: {item.breakdownDetails}
                        </p>
                      )}

                      {/* Batch Photo Status on Item Card */}
                      {isWeightItem && (
                        <div className="mt-1.5 flex items-center gap-2">
                          {item.batchPhotos && item.batchPhotos.length > 0 ? (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                              📸 {item.batchPhotos.length} Photo Attached
                            </span>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                                ⚠️ Photo Needed
                              </span>
                              {onAddBatchPhotoToItem && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const canvas = document.createElement('canvas');
                                    canvas.width = 400;
                                    canvas.height = 300;
                                    const ctx = canvas.getContext('2d');
                                    if (ctx) {
                                      ctx.fillStyle = '#2563eb';
                                      ctx.fillRect(0, 0, 400, 300);
                                      ctx.fillStyle = '#ffffff';
                                      ctx.font = 'bold 20px sans-serif';
                                      ctx.textAlign = 'center';
                                      ctx.fillText(`Batch: ${item.weight} kg`, 200, 150);
                                    }
                                    canvas.toBlob(
                                      (blob) => {
                                        if (blob) {
                                          const file = new File([blob], `batch-${Date.now()}.jpg`, {
                                            type: 'image/jpeg',
                                          });
                                          onAddBatchPhotoToItem(idx, file);
                                        }
                                      },
                                      'image/jpeg',
                                      0.9,
                                    );
                                  }}
                                  className="text-[10px] font-bold text-blue-600 hover:text-blue-800 underline cursor-pointer"
                                >
                                  + Quick Attach
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end justify-between shrink-0 h-full min-h-[50px]">
                      <span className="text-sm font-extrabold text-slate-900">
                        ₹
                        {(
                          item.lineTotal ||
                          (item.unitPrice || 0) * (item.weight || item.quantity || 1)
                        ).toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => onRemoveItem(idx)}
                        className="text-slate-400 hover:text-red-600 p-1 rounded transition-colors cursor-pointer"
                        title="Remove item"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Bottom Summary Box (Dual cell matching Screenshot 1) */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 shrink-0 space-y-3">
            {/* Boxed Summary Table */}
            <div className="border border-slate-300 rounded-sm bg-white grid grid-cols-2 divide-x divide-slate-300 overflow-hidden shadow-2xs">
              {/* Left Cell: Weight & Garments */}
              <div className="p-3 flex flex-col justify-center space-y-1 text-xs sm:text-sm font-bold text-slate-800">
                <div>
                  Weight (KG) : <span className="font-extrabold text-blue-600">{totalWeight}</span>
                </div>
                <div>
                  Garments : <span className="font-extrabold text-slate-900">{totalGarments}</span>
                </div>
              </div>

              {/* Right Cell: Total Amount in INR */}
              <div className="p-3 flex items-center justify-center font-extrabold text-xl sm:text-2xl text-slate-900 select-all">
                INR {totalAmount.toFixed(0)}
              </div>
            </div>

            {/* Checkout Button */}
            <button
              type="button"
              id="laundry-weight-checkout-btn"
              onClick={onCheckout}
              disabled={items.length === 0 || isSubmitting}
              className={`w-full h-12 rounded-sm font-bold text-base text-white tracking-wide transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer min-h-[44px] ${
                items.length > 0 && !isSubmitting
                  ? 'bg-[#2563eb] hover:bg-blue-700 active:scale-[0.99]'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-80'
              }`}
            >
              {isSubmitting ? (
                <span>Creating Order...</span>
              ) : (
                <>
                  <span>Checkout</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ─── 3. ADD-ON SELECTION MODAL ─── */}
      {isAddonModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Select Add-ons"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-md bg-white rounded-lg shadow-xl overflow-hidden animate-in fade-in-50 zoom-in-95">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Tag size={17} className="text-blue-600" />
                Select Supported Add-ons
              </h3>
              <button
                type="button"
                onClick={() => setIsAddonModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-2.5 max-h-[60vh] overflow-y-auto">
              {AVAILABLE_ADDONS.map((addon) => {
                const isSelected = selectedAddOns.some((a) => a.id === addon.id);
                return (
                  <label
                    key={addon.id}
                    className={`flex items-center justify-between p-3 rounded border cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/70'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedAddOns([...selectedAddOns, addon]);
                          } else {
                            setSelectedAddOns(selectedAddOns.filter((a) => a.id !== addon.id));
                          }
                        }}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <p className="text-sm font-bold text-slate-800">{addon.name}</p>
                        <p className="text-xs text-slate-500">{addon.description}</p>
                      </div>
                    </div>
                    <span className="text-sm font-extrabold text-slate-900">+₹{addon.price}</span>
                  </label>
                );
              })}
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAddonModalOpen(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded font-semibold text-sm hover:bg-blue-700 cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 4. GARMENT DETAILS & DEFECT NOTES MODAL ─── */}
      {isGarmentDetailsModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Garment Details & Notes"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-md bg-white rounded-lg shadow-xl overflow-hidden animate-in fade-in-50 zoom-in-95">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <FileText size={17} className="text-blue-600" />
                Garment Details &amp; Notes
              </h3>
              <button
                type="button"
                onClick={() => setIsGarmentDetailsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Item Breakdown (e.g. 3 Shirts, 2 Pants, 1 Kurta)
                </label>
                <textarea
                  rows={2}
                  value={garmentBreakdown}
                  onChange={(e) => setGarmentBreakdown(e.target.value)}
                  placeholder="Note specific garments inside this laundry bag..."
                  className="w-full p-2.5 text-xs sm:text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Fabric Condition / Defect Notes
                </label>
                <textarea
                  rows={2}
                  value={defectNotes}
                  onChange={(e) => setDefectNotes(e.target.value)}
                  placeholder="E.g. Color bleed risk, collar stain, missing button..."
                  className="w-full p-2.5 text-xs sm:text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsGarmentDetailsModalOpen(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded font-semibold text-sm hover:bg-blue-700 cursor-pointer"
              >
                Save Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
