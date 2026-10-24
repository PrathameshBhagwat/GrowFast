import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Plus,
  Minus,
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
  RefreshCw,
  Lock,
  Save,
} from 'lucide-react';
import {
  formatCatalogServiceName,
  DEFAULT_TOP_UP_SERVICES,
  GarmentCategory,
  Role,
} from '@growfast/shared-types';
import type { TopUpServiceItem } from '@growfast/shared-types';
import { useAuth } from '../contexts/AuthContext';

export interface GarmentPhotoSlot {
  unitNumber: number;
  photo?: { id: string; file: File; previewUrl: string };
  status: 'pending' | 'uploaded' | 'error';
  error?: string;
}

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
  pieces?: Array<{
    unitNumber: number;
    photos: Array<{ id: string; file: File; previewUrl: string }>;
  }>;
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
  topUpServices?: TopUpServiceItem[];
  canEditPrice?: boolean;
  onPriceUpdated?: (garmentCatalogId: string, serviceTypeId: string, newPrice: number) => void;
  className?: string;
}

export const AVAILABLE_ADDONS: TopUpServiceItem[] = DEFAULT_TOP_UP_SERVICES;

export const CANONICAL_WEIGHT_SERVICES = [
  {
    id: 'svc-wash-iron',
    name: 'Wash and Steam Iron',
    category: 'WASH_IRON',
    estimatedDays: 2,
    isActive: true,
  },
  {
    id: 'svc-wash-fold',
    name: 'Wash and Fold',
    category: 'WASH',
    estimatedDays: 2,
    isActive: true,
  },
  {
    id: 'svc-laundry-white',
    name: 'Laundry for White',
    category: 'WASH',
    estimatedDays: 2,
    isActive: true,
  },
  {
    id: 'svc-laundry-premium',
    name: 'Premium Laundry',
    category: 'WASH',
    estimatedDays: 2,
    isActive: true,
  },
  {
    id: 'svc-laundry-woolen',
    name: 'Woolen Laundry',
    category: 'WASH',
    estimatedDays: 3,
    isActive: true,
  },
] as const;

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
  className = '',
  topUpServices,
  canEditPrice,
  onPriceUpdated,
}) => {
  // Canonical priority for Per-Weight Laundry service selection display:
  // 1. Wash and Steam Iron
  // 2. Wash and Fold
  // 3. Laundry for White
  // 4. Premium Laundry
  // 5. Woolen Laundry
  const getWeightServicePriority = (svc: { id?: string; name: string }): number => {
    const id = svc.id?.toLowerCase() || '';
    const name = svc.name.trim().toLowerCase();

    // 1. Wash and Steam Iron
    if (
      id === 'svc-wash-iron' ||
      name === 'wash and steam iron' ||
      name === 'wash & steam iron' ||
      name === 'wash + steam iron'
    ) {
      return 1;
    }
    // 2. Wash and Fold
    if (id === 'svc-wash-fold' || name === 'wash and fold' || name === 'wash & fold') {
      return 2;
    }
    // 3. Laundry for White
    if (id === 'svc-laundry-white' || name === 'laundry for white' || name.includes('white')) {
      return 3;
    }
    // 4. Premium Laundry
    if (id === 'svc-laundry-premium' || name === 'premium laundry' || name.includes('premium')) {
      return 4;
    }
    // 5. Woolen Laundry
    if (id === 'svc-laundry-woolen' || name === 'woolen laundry' || name.includes('woolen')) {
      return 5;
    }
    return 999;
  };

  // Available Laundry Services: All 5 canonical services guaranteed in specified order
  const laundryServices = useMemo(() => {
    return CANONICAL_WEIGHT_SERVICES.map((canonical) => {
      const match = services.find((s) => {
        const sId = (s.id || '').toLowerCase();
        const sName = (s.name || '').trim().toLowerCase();

        // Standard Wash is never a match
        if (sId === 'svc-wash' || sName === 'standard wash') return false;

        if (canonical.id === 'svc-wash-iron') {
          return (
            sId === 'svc-wash-iron' ||
            sName === 'wash and steam iron' ||
            sName === 'wash & steam iron' ||
            sName === 'wash + steam iron' ||
            (sName.includes('steam') && sName.includes('iron'))
          );
        }
        if (canonical.id === 'svc-wash-fold') {
          return (
            sId === 'svc-wash-fold' ||
            sName === 'wash and fold' ||
            sName === 'wash & fold' ||
            (sName.includes('fold') && !sName.includes('iron'))
          );
        }
        if (canonical.id === 'svc-laundry-white') {
          return sId === 'svc-laundry-white' || sName.includes('white');
        }
        if (canonical.id === 'svc-laundry-premium') {
          return sId === 'svc-laundry-premium' || sName.includes('premium');
        }
        if (canonical.id === 'svc-laundry-woolen') {
          return sId === 'svc-laundry-woolen' || sName.includes('woolen');
        }
        return false;
      });

      if (match) {
        return {
          ...match,
          name: match.name || canonical.name,
        };
      }
      return { ...canonical };
    });
  }, [services]);

  // Selected Service state (default to first available: Wash and Steam Iron)
  const [selectedServiceId, setSelectedServiceId] = useState<string>(() => {
    return laundryServices[0]?.id || 'svc-wash-iron';
  });

  // Ensure valid selectedServiceId
  const activeService = useMemo(() => {
    return (
      laundryServices.find((s) => s.id === selectedServiceId) ||
      laundryServices[0] ||
      CANONICAL_WEIGHT_SERVICES[0]
    );
  }, [laundryServices, selectedServiceId]);

  let authContext: any = null;
  try {
    authContext = useAuth();
  } catch {
    authContext = null;
  }
  const employee = authContext?.employee;
  const token = authContext?.token;
  const isRoleAuthorized = employee?.role === Role.OWNER;
  const isPriceEditable = canEditPrice !== undefined ? canEditPrice : isRoleAuthorized;

  // Canonical Authoritative Weight Garment (Weight Based, g-wb-1)
  const activeWeightGarment = useMemo(() => {
    return (
      weightGarments.find(
        (g) =>
          (g.category === 'WEIGHT_BASED' || g.category === GarmentCategory.WEIGHT_BASED) &&
          (g.id === 'g-wb-1' || g.name === 'Weight Based'),
      ) ||
      weightGarments.find((g) => g.id === 'g-wb-1' || g.name === 'Weight Based') ||
      weightGarments.find(
        (g) => g.category === 'WEIGHT_BASED' || g.category === GarmentCategory.WEIGHT_BASED,
      ) ||
      weightGarments[0] || {
        id: 'g-wb-1',
        name: 'Weight Based',
        category: 'WEIGHT_BASED',
      }
    );
  }, [weightGarments]);

  // Configured price per KG from authoritative store pricing
  const configuredPricePerKg = useMemo(() => {
    const targetGarmentId = activeWeightGarment?.id || 'g-wb-1';
    const match = prices.find(
      (p) =>
        p.serviceTypeId === activeService.id &&
        (p.garmentCatalogId === targetGarmentId ||
          p.garmentCatalogId === 'g-wb-1' ||
          !p.garmentCatalogId),
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

  // Track session overrides and editable rate state
  const [rateOverrides, setRateOverrides] = useState<Record<string, number>>({});
  const [rateInput, setRateInput] = useState<string>(() => String(configuredPricePerKg));
  const [rateError, setRateError] = useState<string | null>(null);
  const [isSavingRate, setIsSavingRate] = useState<boolean>(false);
  const [rateSaveSuccess, setRateSaveSuccess] = useState<boolean>(false);

  // Price per KG for the active service (effective unit rate)
  const pricePerKg = useMemo(() => {
    if (
      rateOverrides[activeService.id] !== undefined &&
      rateOverrides[activeService.id] > 0
    ) {
      return rateOverrides[activeService.id];
    }
    return configuredPricePerKg;
  }, [rateOverrides, activeService.id, configuredPricePerKg]);

  // Synchronize rate input when active service changes
  useEffect(() => {
    const currentRate =
      rateOverrides[activeService.id] !== undefined && rateOverrides[activeService.id] > 0
        ? rateOverrides[activeService.id]
        : configuredPricePerKg;
    setRateInput(String(currentRate));
    setRateError(null);
    setRateSaveSuccess(false);
  }, [activeService.id, configuredPricePerKg]);

  const handleSaveRate = async (rateToPersist?: number) => {
    if (!isPriceEditable) return;
    const num = rateToPersist !== undefined ? rateToPersist : parseFloat(rateInput);
    if (isNaN(num) || num <= 0) {
      setRateError('Rate must be greater than 0');
      return;
    }
    setRateError(null);
    setIsSavingRate(true);
    setRateSaveSuccess(false);

    try {
      const authToken =
        token || localStorage.getItem('token') || localStorage.getItem('growfast_token');
      const apiUrl = import.meta.env.VITE_API_URL || '/api';
      const targetGarmentId = activeWeightGarment?.id || 'g-wb-1';

      const res = await fetch(`${apiUrl}/pricing/${targetGarmentId}/${activeService.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ price: num }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Failed to save pricing (${res.status})`);
      }

      setRateOverrides((prev) => ({ ...prev, [activeService.id]: num }));
      setRateSaveSuccess(true);
      if (onPriceUpdated) {
        onPriceUpdated(targetGarmentId, activeService.id, num);
      }
      setTimeout(() => setRateSaveSuccess(false), 3000);
    } catch (err: any) {
      setRateError(err.message || 'Failed to persist pricing update');
    } finally {
      setIsSavingRate(false);
    }
  };

  const handleRateInputChange = (val: string) => {
    setRateInput(val);
    const num = parseFloat(val);
    if (val.trim() === '' || isNaN(num) || num <= 0) {
      setRateError('Rate must be greater than 0');
    } else {
      setRateError(null);
      setRateOverrides((prev) => ({ ...prev, [activeService.id]: num }));
    }
  };

  // Dynamic Top Up Services
  const [availableAddons, setAvailableAddons] = useState<TopUpServiceItem[]>(
    topUpServices && topUpServices.length > 0 ? topUpServices : DEFAULT_TOP_UP_SERVICES,
  );

  useEffect(() => {
    if (topUpServices && topUpServices.length > 0) {
      setAvailableAddons(topUpServices);
      return;
    }
    const token = localStorage.getItem('token');
    const apiUrl = import.meta.env.VITE_API_URL || '/api';
    fetch(`${apiUrl}/store/top-up-services`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.data && Array.isArray(data.data) && data.data.length > 0) {
          setAvailableAddons(data.data);
        } else if (Array.isArray(data) && data.length > 0) {
          setAvailableAddons(data);
        }
      })
      .catch(() => {
        // Fallback to default
      });
  }, [topUpServices]);

  // Form states matching Screenshot 1
  const [weightInput, setWeightInput] = useState<string>('2.00');
  const [garmentsCountInput, setGarmentsCountInput] = useState<number>(1);
  const [selectedAddOns, setSelectedAddOns] = useState<
    Array<{ id: string; name: string; price: number }>
  >([]);
  const [garmentBreakdown, setGarmentBreakdown] = useState<string>('');
  const [defectNotes, setDefectNotes] = useState<string>('');
  const [weightValidationMsg, setWeightValidationMsg] = useState<string | null>(null);

  // Individual Garment Photo Slots state
  const [garmentPhotos, setGarmentPhotos] = useState<GarmentPhotoSlot[]>([
    { unitNumber: 1, status: 'pending' },
  ]);
  const [activeSlotForUpload, setActiveSlotForUpload] = useState<number | null>(null);
  const singleSlotInputRef = useRef<HTMLInputElement>(null);
  const multiPhotoInputRef = useRef<HTMLInputElement>(null);

  // Synchronize garment photo slots with garmentsCountInput
  useEffect(() => {
    const target = Math.max(1, garmentsCountInput || 1);
    setGarmentPhotos((prev) => {
      if (prev.length === target) return prev;
      if (prev.length < target) {
        const newSlots: GarmentPhotoSlot[] = [];
        for (let u = prev.length + 1; u <= target; u++) {
          newSlots.push({ unitNumber: u, status: 'pending' });
        }
        return [...prev, ...newSlots];
      }
      // Decreasing count: slice excess from end without reassigning
      return prev.slice(0, target);
    });
  }, [garmentsCountInput]);

  const targetCount = Math.max(1, garmentsCountInput || 1);
  const isPhotosMandatory = targetCount <= 50;
  const uploadedSlots = garmentPhotos.filter((s) => s.status === 'uploaded' && s.photo);
  const uploadedCount = uploadedSlots.length;
  const remainingCount = Math.max(0, targetCount - uploadedCount);

  const progressMessage = isPhotosMandatory
    ? `${uploadedCount} of ${targetCount} garment photos uploaded — ${remainingCount} remaining.`
    : `${uploadedCount} of ${targetCount} garment photos uploaded (optional).`;

  const handleFileForGarment = (unitNumber: number, file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setGarmentPhotos((prev) =>
        prev.map((s) =>
          s.unitNumber === unitNumber
            ? { ...s, status: 'error', error: 'Invalid image file. Please select an image.' }
            : s,
        ),
      );
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setGarmentPhotos((prev) =>
        prev.map((s) =>
          s.unitNumber === unitNumber
            ? { ...s, status: 'error', error: 'File exceeds 15MB limit.' }
            : s,
        ),
      );
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    const photoId = `photo-${unitNumber}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    setGarmentPhotos((prev) =>
      prev.map((s) =>
        s.unitNumber === unitNumber
          ? {
              ...s,
              photo: { id: photoId, file, previewUrl },
              status: 'uploaded',
              error: undefined,
            }
          : s,
      ),
    );
  };

  const handleTriggerUploadForSlot = (unitNumber: number) => {
    setActiveSlotForUpload(unitNumber);
    singleSlotInputRef.current?.click();
  };

  const handleReplaceGarmentPhoto = (unitNumber: number) => {
    setActiveSlotForUpload(unitNumber);
    singleSlotInputRef.current?.click();
  };

  const handleRemoveGarmentPhoto = (unitNumber: number) => {
    setGarmentPhotos((prev) =>
      prev.map((s) =>
        s.unitNumber === unitNumber
          ? { ...s, photo: undefined, status: 'pending', error: undefined }
          : s,
      ),
    );
  };

  const handleRetryGarmentPhoto = (unitNumber: number) => {
    setActiveSlotForUpload(unitNumber);
    singleSlotInputRef.current?.click();
  };

  const handleMultiFilesUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    let fileIdx = 0;

    setGarmentPhotos((prev) => {
      return prev.map((slot) => {
        if (slot.status !== 'uploaded' && fileIdx < fileArray.length) {
          const file = fileArray[fileIdx++];
          if (!file.type.startsWith('image/')) {
            return { ...slot, status: 'error', error: 'Invalid image file.' };
          }
          const previewUrl = URL.createObjectURL(file);
          const photoId = `photo-${slot.unitNumber}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          return {
            ...slot,
            photo: { id: photoId, file, previewUrl },
            status: 'uploaded',
            error: undefined,
          };
        }
        return slot;
      });
    });
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

    if (isPriceEditable) {
      const currentInputRate = parseFloat(rateInput);
      if (isNaN(currentInputRate) || currentInputRate <= 0) {
        setRateError('Please enter a valid rate greater than 0.');
        return;
      }
      if (currentInputRate !== configuredPricePerKg) {
        handleSaveRate(currentInputRate);
      }
    }

    const count = Math.max(1, garmentsCountInput || 1);
    const addOnsTotal = selectedAddOns.reduce((sum, a) => sum + a.price, 0);
    const baseTotal = Math.round(wt * pricePerKg * 100) / 100;
    const lineTotal = Math.round((baseTotal + addOnsTotal) * 100) / 100;

    const pieces = Array.from({ length: count }, (_, idx) => {
      const u = idx + 1;
      const slot = garmentPhotos.find(
        (s) => s.unitNumber === u && s.status === 'uploaded' && s.photo,
      );
      return {
        unitNumber: u,
        photos: slot?.photo ? [slot.photo] : [],
      };
    });

    const allUploadedPhotos = pieces
      .flatMap((p) => p.photos)
      .filter((p): p is { id: string; file: File; previewUrl: string } => !!p);

    const newItem: LaundryWeightItem = {
      id: `w-item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      garmentCatalogId: activeWeightGarment.id,
      garmentName: activeWeightGarment.name,
      serviceTypeId: activeService.id,
      serviceName: activeService.name,
      weight: wt,
      garmentsCount: count,
      unitPrice: pricePerKg,
      lineTotal,
      addOns: [...selectedAddOns],
      defectNotes: defectNotes.trim() || undefined,
      breakdownDetails: garmentBreakdown.trim() || undefined,
      batchPhotos: allUploadedPhotos,
      pieces,
    };

    onAddToCart(newItem);

    // Reset details for next item while keeping a clean state
    setSelectedAddOns([]);
    setGarmentBreakdown('');
    setDefectNotes('');
    setGarmentPhotos([{ unitNumber: 1, status: 'pending' }]);
    setGarmentsCountInput(1);
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
        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full border border-pink-100 bg-pink-50 flex items-center justify-center text-pink-500 transition-transform group-hover:scale-105">
          <svg
            className="w-5 h-5 sm:w-6 sm:h-6 stroke-current"
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
        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full border border-pink-100 bg-pink-50 flex items-center justify-center text-pink-500 transition-transform group-hover:scale-105">
          <Shirt className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={1.8} />
        </div>
      );
    }
    // Washing Machine for Premium, Woolen, and Whites
    return (
      <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full border border-slate-200 bg-slate-100 flex items-center justify-center text-slate-500 transition-transform group-hover:scale-105">
        <svg
          className="w-5 h-5 sm:w-6 sm:h-6 stroke-current"
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
      className={`flex flex-col w-full h-full min-h-0 font-sans ${className}`}
      style={{ background: 'var(--bg-app)' }}
    >
      {/* ─── MAIN SPLIT INTERFACE ─── */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        {/* LEFT PANEL: Service Cards + Weight Form Controls */}
        <div
          className="flex-1 flex flex-col min-h-0 overflow-y-auto p-4 sm:p-6 border-r"
          style={{
            background: 'var(--bg-surface)',
            borderColor: 'var(--border)',
          }}
        >
          {/* Service Cards Row */}
          <div className="mb-6">
            <label
              className="block text-xs font-bold uppercase tracking-wider mb-2.5"
              style={{ color: 'var(--text-muted)' }}
            >
              Select Laundry Service:
            </label>
            <div
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3"
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
                    className="group relative flex flex-col items-center justify-between p-2.5 sm:p-3 transition-all text-center min-h-[115px] sm:min-h-[120px] cursor-pointer select-none"
                    style={{
                      borderRadius: '16px',
                      background: 'var(--bg-surface)',
                      border: isSelected ? '2px solid #2563eb' : '1px solid var(--border)',
                      boxShadow: isSelected
                        ? '0 4px 14px rgba(37, 99, 235, 0.25)'
                        : 'var(--shadow-neu-card-sm)',
                    }}
                  >
                    {/* Service Name */}
                    <span
                      className="text-xs font-semibold leading-tight line-clamp-2 h-8 flex items-center justify-center"
                      style={{
                        color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                        fontWeight: isSelected ? 700 : 600,
                      }}
                    >
                      {formattedName}
                    </span>

                    {/* Circular Icon */}
                    <div className="my-1.5 flex items-center justify-center">
                      {renderServiceIcon(svc.name)}
                    </div>

                    {/* Selection Indicator Dot/Tag */}
                    {isSelected ? (
                      <span className="inline-block w-2 h-2 rounded-full bg-blue-600 mt-1" />
                    ) : (
                      <span
                        className="inline-block w-2 h-2 mt-1 opacity-0 pointer-events-none"
                        aria-hidden="true"
                      />
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
              {isPriceEditable ? (
                <div className="flex flex-col gap-1">
                  <div className="flex items-stretch shadow-2xs">
                    <div className="w-36 sm:w-44 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-sm sm:text-base flex items-center justify-center border border-slate-300 dark:border-slate-700 rounded-l-sm select-none gap-1.5">
                      <span>Price/ KG</span>
                      <span className="text-[10px] font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded tracking-wide">
                        Admin
                      </span>
                    </div>
                    <div className="relative flex-1 flex items-center">
                      <input
                        id="laundry-price-per-kg-input"
                        type="number"
                        min="1"
                        step="any"
                        value={rateInput}
                        onChange={(e) => handleRateInputChange(e.target.value)}
                        onBlur={() => {
                          const num = parseFloat(rateInput);
                          if (!isNaN(num) && num > 0 && num !== configuredPricePerKg) {
                            handleSaveRate(num);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSaveRate();
                          }
                        }}
                        aria-label="Price per kilogram (Admin editable)"
                        className="w-full h-13 px-4 bg-white dark:bg-slate-900 border border-l-0 border-slate-300 dark:border-slate-700 rounded-r-sm text-2xl sm:text-3xl font-extrabold text-center text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 pr-16"
                      />
                      <div className="absolute right-2 flex items-center gap-1">
                        {isSavingRate ? (
                          <RefreshCw size={16} className="text-blue-500 animate-spin" />
                        ) : rateSaveSuccess ? (
                          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                            <Check size={13} /> Saved
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSaveRate()}
                            title="Save updated rate to store catalog pricing"
                            className="h-8 px-2 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/50 rounded border border-transparent hover:border-blue-200 dark:hover:border-blue-800 transition-colors cursor-pointer"
                          >
                            Save
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  {rateError && (
                    <span className="text-xs font-bold text-red-600 flex items-center gap-1 pl-1">
                      <AlertCircle size={13} /> {rateError}
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex items-stretch shadow-2xs">
                  <div className="w-36 sm:w-44 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-sm sm:text-base flex items-center justify-center border border-slate-300 dark:border-slate-700 rounded-l-sm select-none gap-1.5">
                    <Lock size={14} className="text-slate-500" />
                    <span>Price/ KG</span>
                  </div>
                  <div
                    id="laundry-price-per-kg-display"
                    className="flex-1 h-13 px-4 bg-slate-50 dark:bg-slate-800/60 border border-l-0 border-slate-300 dark:border-slate-700 rounded-r-sm text-2xl sm:text-3xl font-extrabold text-center text-slate-800 dark:text-slate-100 flex items-center justify-center select-all relative"
                  >
                    <span>{pricePerKg}</span>
                    <span className="absolute right-3 text-[11px] font-medium text-slate-500 hidden sm:inline-block">
                      (Configured Rate)
                    </span>
                  </div>
                </div>
              )}

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

              {/* Row 4.5: Individual Garment Photos (Determined from entered garment count) */}
              <div className="pt-2 border-t border-slate-200 space-y-2.5">
                {/* Header row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Camera size={15} className="text-slate-700" />
                    <span className="text-xs font-bold text-slate-800">
                      Individual Garment Photos
                    </span>
                  </div>
                  {isPhotosMandatory ? (
                    remainingCount === 0 ? (
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Check size={11} strokeWidth={3} /> {uploadedCount}/{targetCount} Complete
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <AlertCircle size={11} /> {remainingCount} Needed
                      </span>
                    )
                  ) : (
                    <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                      Optional (&gt;50)
                    </span>
                  )}
                </div>

                {/* Progress message and bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                    <span id="laundry-photo-progress-text">{progressMessage}</span>
                    <span className="font-mono text-[11px] text-slate-500">
                      {uploadedCount}/{targetCount}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        remainingCount === 0 ? 'bg-emerald-600' : 'bg-blue-600'
                      }`}
                      style={{ width: `${Math.min(100, (uploadedCount / targetCount) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Global action button: Upload Multiple */}
                <div className="flex items-center gap-2 pt-0.5">
                  <button
                    type="button"
                    id="laundry-upload-multi-photos-btn"
                    onClick={() => multiPhotoInputRef.current?.click()}
                    className="h-9 px-3 bg-white hover:bg-slate-50 border border-slate-300 rounded-sm font-semibold text-xs text-slate-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-h-[44px]"
                    title="Upload files for multiple garments at once"
                  >
                    <Upload size={14} className="text-slate-600" />
                    <span>Upload Multiple</span>
                  </button>
                </div>

                {/* Hidden File Inputs */}
                <input
                  ref={singleSlotInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && activeSlotForUpload != null) {
                      handleFileForGarment(activeSlotForUpload, file);
                    }
                    e.target.value = '';
                  }}
                />
                <input
                  ref={multiPhotoInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    handleMultiFilesUpload(e.target.files);
                    e.target.value = '';
                  }}
                />

                {/* Individual Garment Photo Slots */}
                <div
                  className="max-h-72 overflow-y-auto space-y-2 pr-1"
                  id="laundry-garment-photo-slots"
                >
                  {garmentPhotos.map((slot) => {
                    const isUploaded = slot.status === 'uploaded' && !!slot.photo;
                    const isError = slot.status === 'error';

                    return (
                      <div
                        key={slot.unitNumber}
                        data-slot-unit={slot.unitNumber}
                        data-slot-status={slot.status}
                        className={`p-2.5 rounded-md border flex items-center justify-between gap-3 min-h-[44px] transition-colors ${
                          isUploaded
                            ? 'bg-white border-emerald-200 shadow-2xs'
                            : isError
                              ? 'bg-rose-50/70 border-rose-300'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {/* Left: Thumbnail & Garment label */}
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          {isUploaded ? (
                            <img
                              src={slot.photo!.previewUrl}
                              alt={`Garment ${slot.unitNumber}`}
                              className="w-10 h-10 object-cover rounded border border-emerald-300 shrink-0"
                            />
                          ) : isError ? (
                            <div className="w-10 h-10 rounded border border-rose-300 flex items-center justify-center bg-rose-100/60 text-rose-600 shrink-0">
                              <AlertCircle size={18} />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded border border-dashed border-slate-300 flex items-center justify-center bg-slate-50 text-slate-400 shrink-0">
                              <Camera size={18} />
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-bold text-slate-800">
                                {isUploaded
                                  ? `Garment ${slot.unitNumber}`
                                  : `Garment ${slot.unitNumber} — Add Photo`}
                              </span>
                              {isUploaded && (
                                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded inline-flex items-center gap-0.5">
                                  <Check size={9} strokeWidth={3} /> Uploaded
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-500 truncate mt-0.5">
                              {isUploaded
                                ? slot.photo!.file.name
                                : isError
                                  ? slot.error || 'Upload failed'
                                  : isPhotosMandatory
                                    ? 'Photo required'
                                    : 'Optional'}
                            </p>
                          </div>
                        </div>

                        {/* Right: Slot Action Buttons */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <input
                            data-testid={`garment-photo-input-${slot.unitNumber}`}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleFileForGarment(slot.unitNumber, file);
                              }
                              e.target.value = '';
                            }}
                          />
                          <input
                            data-testid={`garment-replace-input-${slot.unitNumber}`}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleFileForGarment(slot.unitNumber, file);
                              }
                              e.target.value = '';
                            }}
                          />
                          <input
                            data-testid={`garment-retry-input-${slot.unitNumber}`}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleFileForGarment(slot.unitNumber, file);
                              }
                              e.target.value = '';
                            }}
                          />
                          {isUploaded ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleReplaceGarmentPhoto(slot.unitNumber)}
                                className="h-8 px-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-700 rounded text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer min-h-[44px]"
                                title={`Replace Garment ${slot.unitNumber} photo`}
                                aria-label={`Replace Garment ${slot.unitNumber} photo`}
                              >
                                <Upload size={12} />
                                <span>Replace</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveGarmentPhoto(slot.unitNumber)}
                                className="h-8 w-8 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded flex items-center justify-center transition-colors cursor-pointer min-h-[44px] min-w-[44px]"
                                title={`Remove Garment ${slot.unitNumber} photo`}
                                aria-label={`Remove Garment ${slot.unitNumber} photo`}
                              >
                                <Trash2 size={13} />
                              </button>
                            </>
                          ) : isError ? (
                            <button
                              type="button"
                              onClick={() => handleRetryGarmentPhoto(slot.unitNumber)}
                              className="h-8 px-3 bg-rose-100 hover:bg-rose-200 border border-rose-300 text-rose-800 rounded text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer min-h-[44px]"
                              title={`Retry upload for garment ${slot.unitNumber}`}
                              aria-label={`Retry Garment ${slot.unitNumber} photo`}
                            >
                              <RefreshCw size={12} />
                              <span>Retry</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleTriggerUploadForSlot(slot.unitNumber)}
                              className="h-8 px-2.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer min-h-[44px]"
                              title={`Upload photo for garment ${slot.unitNumber}`}
                              aria-label={`Upload photo for Garment ${slot.unitNumber}`}
                            >
                              <Camera size={13} className="text-blue-600" />
                              <span>Upload</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Row 5: Add to Cart Button */}
              <div className="pt-2">
                <button
                  type="button"
                  id="laundry-add-to-cart-btn"
                  onClick={handleAddToCart}
                  disabled={!isWeightValid}
                  className="w-full h-12 font-bold text-base tracking-wide flex items-center justify-center gap-2 transition-all cursor-pointer min-h-[44px] active:scale-[0.99]"
                  style={{
                    borderRadius: '9999px',
                    background: isWeightValid
                      ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
                      : 'var(--border)',
                    boxShadow: isWeightValid
                      ? '0 4px 12px rgba(37, 99, 235, 0.35)'
                      : 'none',
                    color: isWeightValid ? '#ffffff' : 'var(--text-muted)',
                    border: 'none',
                  }}
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
          className="w-full lg:w-[420px] xl:w-[450px] shrink-0 flex flex-col border-t lg:border-t-0 lg:border-l h-full min-h-0"
          style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
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

                      {/* Garment Photo Status on Item Card */}
                      {isWeightItem &&
                        (() => {
                          const count = item.garmentsCount || item.quantity || 1;
                          const covered = item.pieces
                            ? item.pieces.filter((p: any) => p.photos && p.photos.length > 0).length
                            : item.batchPhotos?.length || 0;
                          const isMandatory = count <= 50;
                          const isComplete = covered >= count;

                          return (
                            <div className="mt-1.5 flex items-center gap-2">
                              {isComplete ? (
                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                                  📸 {covered}/{count} Photos Attached
                                </span>
                              ) : isMandatory ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                                    ⚠️ Photo Needed ({covered}/{count} Attached)
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
                                          ctx.fillText(`Garment Photo`, 200, 150);
                                        }
                                        canvas.toBlob(
                                          (blob) => {
                                            if (blob) {
                                              const file = new File(
                                                [blob],
                                                `garment-${Date.now()}.jpg`,
                                                {
                                                  type: 'image/jpeg',
                                                },
                                              );
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
                              ) : (
                                <span className="text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                                  📸 {covered}/{count} Photos Attached (Optional)
                                </span>
                              )}
                            </div>
                          );
                        })()}
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
          <div className="p-4 bg-[var(--bg-surface)] border-t border-[var(--border)] shrink-0 space-y-3">
            {/* Boxed Summary Table */}
            <div className="border border-[var(--border)] rounded-2xl bg-[var(--bg-surface-inset)] grid grid-cols-2 divide-x divide-[var(--border)] overflow-hidden shadow-[var(--shadow-neu-inset)]">
              {/* Left Cell: Weight & Garments */}
              <div className="p-3.5 flex flex-col justify-center space-y-1 text-xs sm:text-sm font-bold text-[var(--text-secondary)]">
                <div>
                  Weight (KG) : <span className="font-extrabold text-blue-600 dark:text-blue-400">{totalWeight}</span>
                </div>
                <div>
                  Garments : <span className="font-extrabold text-[var(--text-primary)]">{totalGarments}</span>
                </div>
              </div>

              {/* Right Cell: Total Amount in INR */}
              <div className="p-3.5 flex items-center justify-center font-extrabold text-xl sm:text-2xl text-[var(--text-primary)] select-all">
                INR {totalAmount.toFixed(0)}
              </div>
            </div>

            {/* Checkout Button */}
            <button
              type="button"
              id="laundry-weight-checkout-btn"
              onClick={onCheckout}
              disabled={items.length === 0 || isSubmitting}
              className={`w-full h-12 rounded-full font-bold text-base text-white tracking-wide transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer min-h-[44px] ${
                items.length > 0 && !isSubmitting
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-[0.99] shadow-blue-500/25'
                  : 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed opacity-80'
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-md bg-[var(--bg-surface)] rounded-2xl shadow-[var(--shadow-neu-card)] border border-[var(--border)] overflow-hidden animate-in fade-in-50 zoom-in-95">
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
              <h3 className="font-bold text-base text-[var(--text-primary)] flex items-center gap-2">
                <Tag size={17} className="text-blue-600 dark:text-blue-400" />
                Select Supported Add-ons
              </h3>
              <button
                type="button"
                onClick={() => setIsAddonModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-surface-inset)] transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-2.5 max-h-[60vh] overflow-y-auto">
              {availableAddons.map((addon) => {
                const isSelected = selectedAddOns.some((a) => a.id === addon.id);
                return (
                  <label
                    key={addon.id}
                    className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-950/40 shadow-xs'
                        : 'border-[var(--border)] hover:bg-[var(--bg-surface-inset)]'
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
                        <p className="text-sm font-bold text-[var(--text-primary)]">{addon.name}</p>
                        <p className="text-xs text-[var(--text-secondary)]">{addon.description}</p>
                      </div>
                    </div>
                    <span className="text-sm font-extrabold text-[var(--text-primary)]">+₹{addon.price}</span>
                  </label>
                );
              })}
            </div>

            <div className="px-5 py-3.5 bg-[var(--bg-surface-inset)] border-t border-[var(--border)] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAddonModalOpen(false)}
                className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full font-semibold text-sm hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-500/20 cursor-pointer"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-md bg-[var(--bg-surface)] rounded-2xl shadow-[var(--shadow-neu-card)] border border-[var(--border)] overflow-hidden animate-in fade-in-50 zoom-in-95">
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
              <h3 className="font-bold text-base text-[var(--text-primary)] flex items-center gap-2">
                <FileText size={17} className="text-blue-600 dark:text-blue-400" />
                Garment Details &amp; Notes
              </h3>
              <button
                type="button"
                onClick={() => setIsGarmentDetailsModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-surface-inset)] transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">
                  Item Breakdown (e.g. 3 Shirts, 2 Pants, 1 Kurta)
                </label>
                <textarea
                  rows={2}
                  value={garmentBreakdown}
                  onChange={(e) => setGarmentBreakdown(e.target.value)}
                  placeholder="Note specific garments inside this laundry bag..."
                  className="w-full p-3 text-xs sm:text-sm border border-[var(--border)] rounded-xl bg-[var(--bg-surface-inset)] text-[var(--text-primary)] focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-[var(--shadow-neu-inset)]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">
                  Fabric Condition / Defect Notes
                </label>
                <textarea
                  rows={2}
                  value={defectNotes}
                  onChange={(e) => setDefectNotes(e.target.value)}
                  placeholder="E.g. Color bleed risk, collar stain, missing button..."
                  className="w-full p-3 text-xs sm:text-sm border border-[var(--border)] rounded-xl bg-[var(--bg-surface-inset)] text-[var(--text-primary)] focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-[var(--shadow-neu-inset)]"
                />
              </div>
            </div>

            <div className="px-5 py-3.5 bg-[var(--bg-surface-inset)] border-t border-[var(--border)] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsGarmentDetailsModalOpen(false)}
                className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full font-semibold text-sm hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-500/20 cursor-pointer"
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
