import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { PhotoCapture } from '@growfast/ui';
import { useAuth } from '../contexts/AuthContext';
import {
  CustomerDTO,
  PhotoType,
  isPhotoRequiredForOrder,
  calculateOrderTotals,
  GarmentCategory,
  ServiceCategory,
  formatCatalogServiceName,
  isItemCompatibleWithWorkflow,
  OrderEntryMode,
  ExpressDeliveryOption,
  getDayOfWeekInTimezone,
  TopUpServiceItem,
  DEFAULT_TOP_UP_SERVICES,
  Role,
} from '@growfast/shared-types';
import type { OrderWorkflowType } from '@growfast/shared-types';
import { CustomerSelector } from '../components/CustomerSelector';
import { ItemSelector } from '../components/ItemSelector';
import { LaundryWeightOrderEntry, LaundryWeightItem } from '../components/LaundryWeightOrderEntry';
import { uploadPhoto } from '../services/photo.api';
import {
  ArrowLeft,
  ArrowRight,
  UserPlus,
  ChevronDown,
  ChevronRight,
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  FileText,
  Camera,
  X,
  Pencil,
  Check,
  Scale,
  Sparkles,
  AlertTriangle,
  Shirt,
  Tag,
} from 'lucide-react';
import { renderStitchGarmentIcon } from '../components/GarmentIcon';
import { ThemeToggle } from '../components/ThemeToggle';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export function OrderWizardPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialCustomerId = searchParams.get('customerId');
  const { token, employee } = useAuth();
  const canModifyPrice = employee?.role === Role.OWNER;

  // Entry mode state: Weight vs Pieces (Decision B)
  const paramMode = searchParams.get('mode')?.toUpperCase();
  const initialEntryMode: OrderEntryMode = paramMode === 'WEIGHT' ? 'WEIGHT' : 'PIECES';
  const [activeEntryMode, setActiveEntryMode] = useState<OrderEntryMode>(initialEntryMode);

  // Workflow state: Per-piece defaults strictly to Dry Cleaning, weight defaults to Laundry
  const paramWorkflow = searchParams.get('workflow')?.toUpperCase();
  const initialWorkflow: OrderWorkflowType =
    paramWorkflow === 'LAUNDRY'
      ? 'LAUNDRY'
      : paramWorkflow === 'DRY_CLEANING'
        ? 'DRY_CLEANING'
        : initialEntryMode === 'WEIGHT'
          ? 'LAUNDRY'
          : 'DRY_CLEANING';
  const [activeWorkflow, setActiveWorkflow] = useState<OrderWorkflowType>(initialWorkflow);

  // Workflow switch modal confirmation state
  const [pendingWorkflowSwitch, setPendingWorkflowSwitch] = useState<OrderWorkflowType | null>(
    null,
  );
  const [incompatibleItemsToDrop, setIncompatibleItemsToDrop] = useState<any[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(initialCustomerId);
  const [customer, setCustomer] = useState<CustomerDTO | null>(null);
  const [customerLoading, setCustomerLoading] = useState(!!initialCustomerId);
  const [customerError, setCustomerError] = useState<string | null>(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showMissingPhotosModal, setShowMissingPhotosModal] = useState(false);

  // Active item detail configuration modal
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [viewingPhotoUrl, setViewingPhotoUrl] = useState<string | null>(null);

  // Weight measurement modal state
  const [weightModalData, setWeightModalData] = useState<{
    garment: any;
    serviceId: string;
    unitPrice: number;
    existingItemIndex?: number;
    initialWeight?: number;
  } | null>(null);
  const [measuredWeightInput, setMeasuredWeightInput] = useState<string>('');
  const [weightError, setWeightError] = useState<string | null>(null);

  // Weight piece exception modal state (CHANGE 5: Per Pieces workflow weight-based exception)
  const [pieceExceptionModalData, setPieceExceptionModalData] = useState<{
    garment: any;
    serviceId: string;
    unitPrice: number;
    quantity: number;
    defectNotes: string;
    brand: string;
  } | null>(null);

  const [items, setItems] = useState<any[]>([]);
  const [garments, setGarments] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [prices, setPrices] = useState<any[]>([]);
  const [deliverySpeed, setDeliverySpeed] = useState<ExpressDeliveryOption>(
    ExpressDeliveryOption.REGULAR,
  );
  const isExpress = deliverySpeed !== ExpressDeliveryOption.REGULAR;
  const currentDayOfWeek = useMemo(() => {
    return getDayOfWeekInTimezone(new Date(), 'Asia/Kolkata');
  }, []);
  const isThursdayOff = currentDayOfWeek === 4;
  const isWednesdayOff = currentDayOfWeek === 3;
  const [storeConfig, setStoreConfig] = useState<any>(null);
  const [generalNote, setGeneralNote] = useState('');
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [addonModalItemIndex, setAddonModalItemIndex] = useState<number | null>(null);

  const availableTopUpServices: TopUpServiceItem[] = useMemo(() => {
    if (
      storeConfig?.topUpServices &&
      Array.isArray(storeConfig.topUpServices) &&
      storeConfig.topUpServices.length > 0
    ) {
      return storeConfig.topUpServices;
    }
    return DEFAULT_TOP_UP_SERVICES;
  }, [storeConfig]);

  // Fetch Store Config
  useEffect(() => {
    if (token) {
      fetch(`${API_URL}/store/config`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((body) => {
          setStoreConfig(body);
        })
        .catch((err) => console.error('Failed to load store config:', err));
    }
  }, [token]);

  // Fetch Catalog Data
  useEffect(() => {
    if (token) {
      Promise.all([
        fetch(`${API_URL}/pricing`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/garments`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/services`, { headers: { Authorization: `Bearer ${token}` } }),
      ])
        .then(async ([resPricing, resGarments, resServices]) => {
          const bodyPricing = await resPricing.json();
          const bodyGarments = await resGarments.json();
          const bodyServices = await resServices.json();

          if (bodyPricing.success) setPrices(bodyPricing.data);
          if (bodyGarments.success) setGarments(bodyGarments.data);
          if (bodyServices.success) setServices(bodyServices.data);
        })
        .catch((err) => console.error('Failed to load catalog data:', err));
    }
  }, [token]);

  // Fetch Initial Customer from URL
  useEffect(() => {
    if (initialCustomerId && token) {
      const fetchCustomer = async () => {
        try {
          const res = await fetch(`${API_URL}/customers/${initialCustomerId}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          if (!res.ok) {
            throw new Error(`Failed to load customer (${res.status})`);
          }
          const body = await res.json();
          setCustomer(body.data);
          setSelectedCustomerId(body.data.id);
        } catch (err: any) {
          setCustomerError(err.message || 'Failed to load customer');
          setSelectedCustomerId(null);
        } finally {
          setCustomerLoading(false);
        }
      };
      fetchCustomer();
    }
  }, [initialCustomerId, token]);

  // Handle Customer Selection from Modal
  const handleSelectCustomer = (selectedCust: CustomerDTO) => {
    setCustomer(selectedCust);
    setSelectedCustomerId(selectedCust.id);
    setShowCustomerModal(false);
  };

  // Workflow Switching Handlers
  const handleRequestWorkflowSwitch = (targetWorkflow: OrderWorkflowType) => {
    if (targetWorkflow === activeWorkflow) return;

    // Detect incompatible items
    const incompatible = items.filter(
      (item) => !isItemCompatibleWithWorkflow(item, targetWorkflow, services),
    );

    if (incompatible.length > 0) {
      setIncompatibleItemsToDrop(incompatible);
      setPendingWorkflowSwitch(targetWorkflow);
    } else {
      setActiveWorkflow(targetWorkflow);
      if (targetWorkflow === 'DRY_CLEANING') {
        setActiveEntryMode('PIECES');
      }
    }
  };

  const handleConfirmWorkflowSwitch = () => {
    if (!pendingWorkflowSwitch) return;

    // Filter out incompatible items while preserving compatible items, quantities, customer, notes, express
    setItems((prev) =>
      prev.filter((item) => isItemCompatibleWithWorkflow(item, pendingWorkflowSwitch, services)),
    );
    setActiveWorkflow(pendingWorkflowSwitch);
    if (pendingWorkflowSwitch === 'DRY_CLEANING') {
      setActiveEntryMode('PIECES');
    }
    setPendingWorkflowSwitch(null);
    setIncompatibleItemsToDrop([]);
  };

  const handleCancelWorkflowSwitch = () => {
    setPendingWorkflowSwitch(null);
    setIncompatibleItemsToDrop([]);
  };

  // Entry Mode Selection Handler (Decision B)
  const handleSelectEntryMode = (mode: OrderEntryMode) => {
    if (mode === 'WEIGHT') {
      // Weight-based entry is exclusively Laundry — auto-set workflow
      if (activeWorkflow !== 'LAUNDRY') {
        const incompatible = items.filter(
          (item) => !isItemCompatibleWithWorkflow(item, 'LAUNDRY', services),
        );
        if (incompatible.length > 0) {
          setIncompatibleItemsToDrop(incompatible);
          setPendingWorkflowSwitch('LAUNDRY');
          return;
        }
        setActiveWorkflow('LAUNDRY');
      }
      setActiveEntryMode('WEIGHT');
    } else {
      // Pieces-based entry defaults to Dry Cleaning
      if (activeWorkflow !== 'DRY_CLEANING') {
        const incompatible = items.filter(
          (item) => !isItemCompatibleWithWorkflow(item, 'DRY_CLEANING', services),
        );
        if (incompatible.length > 0) {
          setIncompatibleItemsToDrop(incompatible);
          setPendingWorkflowSwitch('DRY_CLEANING');
          return;
        }
        setActiveWorkflow('DRY_CLEANING');
      }
      setActiveEntryMode('PIECES');
    }
  };

  // Add Item to Order from LaundryWeightOrderEntry
  const handleAddWeightItem = (weightItem: LaundryWeightItem) => {
    const garmentsCount = Math.max(1, weightItem.garmentsCount || 1);
    const pieces =
      weightItem.pieces && weightItem.pieces.length === garmentsCount
        ? weightItem.pieces.map((p, idx) => ({
            unitNumber: p.unitNumber || idx + 1,
            photos:
              p.photos && p.photos.length > 0
                ? p.photos
                : weightItem.batchPhotos?.[idx]
                  ? [weightItem.batchPhotos[idx]]
                  : [],
          }))
        : Array.from({ length: garmentsCount }, (_, idx) => {
            const u = idx + 1;
            const pieceFromWeight = weightItem.pieces?.find((p) => p.unitNumber === u);
            const existingPhoto = pieceFromWeight?.photos?.[0] || weightItem.batchPhotos?.[idx];
            return {
              unitNumber: u,
              photos: existingPhoto ? [existingPhoto] : [],
            };
          });

    setItems((prev) => [
      ...prev,
      {
        garmentCatalogId: weightItem.garmentCatalogId,
        serviceTypeId: weightItem.serviceTypeId,
        garmentName: weightItem.garmentName,
        serviceName: weightItem.serviceName,
        unitPrice: weightItem.unitPrice,
        quantity: garmentsCount,
        garmentsCount,
        weight: weightItem.weight,
        isWeightBased: true,
        lineTotal: weightItem.lineTotal,
        topUpService: weightItem.addOns?.map((a) => a.name).join(', ') || '',
        brand: '',
        defectNotes:
          weightItem.defectNotes ||
          (weightItem.breakdownDetails ? `Breakdown: ${weightItem.breakdownDetails}` : ''),
        colorTags: [],
        photoFile: pieces[0]?.photos?.[0]?.file || null,
        pieces,
        batchPhotos: weightItem.batchPhotos || [],
        addOns: weightItem.addOns || [],
      },
    ]);
  };

  // Add Item to Order (directly from garment card "+ Add")
  const handleAddItem = (garment: any, serviceId: string, unitPrice: number) => {
    const service = services.find((s) => s.id === serviceId);
    const serviceName = service ? formatCatalogServiceName(service.name) : 'Unknown';

    // CHANGE 5: Weight-based exception in Per Pieces (DRY_CLEANING) workflow
    // Strictly a per-piece pricing exception, NOT a per-kg calculation.
    const isWeightGarment =
      garment.category === 'WEIGHT_BASED' || garment.category === GarmentCategory.WEIGHT_BASED;

    if (activeWorkflow === 'DRY_CLEANING' && isWeightGarment) {
      setPieceExceptionModalData({
        garment,
        serviceId,
        unitPrice: unitPrice > 0 ? unitPrice : 40,
        quantity: 3,
        defectNotes: '',
        brand: '',
      });
      return;
    }

    // Weight-based processing (in Laundry workflow)
    const isWeightBased =
      activeWorkflow === 'LAUNDRY' &&
      (isWeightGarment ||
        service?.category === 'WEIGHT_BASED' ||
        service?.category === ServiceCategory.WEIGHT_BASED);

    if (isWeightBased) {
      setWeightModalData({
        garment,
        serviceId,
        unitPrice,
      });
      setMeasuredWeightInput('');
      setWeightError(null);
      return;
    }

    const effectiveUnitPrice = unitPrice > 0 ? unitPrice : 40;

    setItems((prev) => {
      // If item with same garment and service exists (without custom defect notes), increment quantity
      const existingIdx = prev.findIndex(
        (i) =>
          !i.isWeightBased &&
          i.garmentCatalogId === garment.id &&
          i.serviceTypeId === serviceId &&
          !i.defectNotes &&
          !i.brand &&
          (!i.pieces || i.pieces.every((p: any) => !p.photos || p.photos.length === 0)),
      );

      if (existingIdx >= 0) {
        const updated = [...prev];
        const cur = updated[existingIdx];
        const newQty = cur.quantity + 1;
        const currentPieces = cur.pieces || [];
        const updatedPieces = [];
        for (let u = 1; u <= newQty; u++) {
          const existing = currentPieces.find((p: any) => p.unitNumber === u);
          if (existing) {
            updatedPieces.push(existing);
          } else {
            updatedPieces.push({ unitNumber: u, photos: [] });
          }
        }
        updated[existingIdx] = {
          ...cur,
          quantity: newQty,
          pieces: updatedPieces,
        };
        return updated;
      }

      const newItem = {
        garmentCatalogId: garment.id,
        serviceTypeId: serviceId,
        garmentName: garment.name,
        serviceName,
        unitPrice: effectiveUnitPrice,
        quantity: 1,
        weight: null,
        isWeightBased: false,
        topUpService: '',
        brand: '',
        defectNotes: '',
        colorTags: [],
        photoFile: null,
        pieces: [
          {
            unitNumber: 1,
            photos: [] as Array<{ id: string; file: File; previewUrl: string }>,
          },
        ],
        batchPhotos: [] as Array<{ id: string; file: File; previewUrl: string }>,
        addOns: [] as TopUpServiceItem[],
      };
      return [...prev, newItem];
    });
  };

  const handleConfirmWeight = () => {
    if (!weightModalData) return;
    const num = parseFloat(measuredWeightInput);
    if (isNaN(num) || num < 2.0) {
      setWeightError('Minimum permitted weight is 2.00 kg (e.g. 2.50 kg).');
      return;
    }
    const roundedWeight = Math.round(num * 100) / 100;
    const { garment, serviceId, unitPrice, existingItemIndex } = weightModalData;
    const service = services.find((s) => s.id === serviceId);
    const serviceName = service ? formatCatalogServiceName(service.name) : 'Unknown';

    if (existingItemIndex !== undefined && existingItemIndex >= 0) {
      setItems((prev) => {
        const updated = [...prev];
        updated[existingItemIndex] = {
          ...updated[existingItemIndex],
          weight: roundedWeight,
        };
        return updated;
      });
    } else {
      setItems((prev) => {
        const newItem = {
          garmentCatalogId: garment.id,
          serviceTypeId: serviceId,
          garmentName: garment.name,
          serviceName,
          unitPrice,
          quantity: 1,
          weight: roundedWeight,
          isWeightBased: true,
          topUpService: '',
          brand: '',
          defectNotes: '',
          colorTags: [],
          photoFile: null,
          pieces: [{ unitNumber: 1, photos: [] }],
          batchPhotos: [] as Array<{ id: string; file: File; previewUrl: string }>,
          addOns: [] as TopUpServiceItem[],
        };
        return [...prev, newItem];
      });
    }

    setWeightModalData(null);
    setMeasuredWeightInput('');
    setWeightError(null);
  };

  const handleConfirmPieceException = () => {
    if (!pieceExceptionModalData) return;
    const { garment, serviceId, unitPrice, quantity, defectNotes, brand } = pieceExceptionModalData;
    const service = services.find((s) => s.id === serviceId);
    const serviceName = service ? formatCatalogServiceName(service.name) : 'Dry Clean';
    const validQty = Math.max(1, Math.round(quantity || 1));
    const validPrice = Math.max(0, unitPrice || 0);

    setItems((prev) => [
      ...prev,
      {
        garmentCatalogId: garment.id,
        serviceTypeId: serviceId,
        garmentName: garment.name || 'Weight Based',
        serviceName,
        unitPrice: validPrice,
        quantity: validQty,
        weight: null,
        isWeightBased: false,
        lineTotal: validQty * validPrice,
        topUpService: '',
        brand: brand?.trim() || '',
        defectNotes: defectNotes?.trim() || '',
        colorTags: [],
        photoFile: null,
        pieces: Array.from({ length: validQty }, (_, idx) => ({
          unitNumber: idx + 1,
          photos: [],
        })),
        batchPhotos: [],
        addOns: [],
      },
    ]);

    setPieceExceptionModalData(null);
  };

  // Quantity adjustments
  const handleUpdateQuantity = (index: number, delta: number) => {
    setItems((prev) => {
      const current = prev[index];
      if (!current) return prev;
      const newQty = current.quantity + delta;
      if (newQty <= 0) {
        return prev.filter((_, i) => i !== index);
      }
      const currentPieces = current.pieces || [];
      const updatedPieces = [];
      for (let u = 1; u <= newQty; u++) {
        const existing = currentPieces.find((p: any) => p.unitNumber === u);
        if (existing) {
          updatedPieces.push(existing);
        } else {
          updatedPieces.push({ unitNumber: u, photos: [] });
        }
      }
      const updated = [...prev];
      updated[index] = { ...current, quantity: newQty, pieces: updatedPieces };
      return updated;
    });
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
    if (editingItemIndex === index) {
      setEditingItemIndex(null);
    }
    if (addonModalItemIndex === index) {
      setAddonModalItemIndex(null);
    }
  };

  const handleToggleAddonForItem = (
    itemIndex: number,
    addon: TopUpServiceItem,
    selected: boolean,
  ) => {
    setItems((prev) => {
      const updated = [...prev];
      const cur = updated[itemIndex];
      if (!cur) return prev;
      const curAddons: TopUpServiceItem[] = cur.addOns || [];
      const newAddons = selected
        ? [...curAddons.filter((a) => a.id !== addon.id), addon]
        : curAddons.filter((a) => a.id !== addon.id);
      updated[itemIndex] = {
        ...cur,
        addOns: newAddons,
        topUpService: newAddons.map((a) => a.name).join(', '),
      };
      return updated;
    });
  };

  const handleRemoveAddonFromItem = (itemIndex: number, addonId: string) => {
    setItems((prev) => {
      const updated = [...prev];
      const cur = updated[itemIndex];
      if (!cur) return prev;
      const curAddons: TopUpServiceItem[] = cur.addOns || [];
      const newAddons = curAddons.filter((a) => a.id !== addonId);
      updated[itemIndex] = {
        ...cur,
        addOns: newAddons,
        topUpService: newAddons.map((a) => a.name).join(', '),
      };
      return updated;
    });
  };

  const handlePriceUpdated = (
    garmentCatalogId: string,
    serviceTypeId: string,
    newPrice: number,
  ) => {
    setPrices((prev) => {
      const idx = prev.findIndex(
        (p) =>
          (p.garmentCatalogId === garmentCatalogId ||
            (garmentCatalogId === 'g-wb-1' &&
              (!p.garmentCatalogId || p.garmentCatalogId === 'g-wb-1'))) &&
          p.serviceTypeId === serviceTypeId,
      );
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], price: newPrice };
        return next;
      }
      return [...prev, { garmentCatalogId, serviceTypeId, price: newPrice }];
    });
  };

  // Pricing calculations via canonical calculateOrderTotals from @growfast/shared-types
  const pricingInputs = useMemo(() => {
    return items.map((item) => {
      const isWb = item.isWeightBased && item.weight != null && item.weight > 0;
      const addOnsTotal = (item.addOns || []).reduce(
        (sum: number, a: any) => sum + (Number(a.price) || 0),
        0,
      );
      if (isWb) {
        const baseTotal = Math.round(item.unitPrice * item.weight! * 100) / 100;
        const lineTotal = Math.round((baseTotal + addOnsTotal) * 100) / 100;
        return {
          unitPrice: Math.round((lineTotal / item.weight!) * 100) / 100,
          quantity: item.quantity,
          weight: item.weight,
        };
      }
      return {
        unitPrice: Math.round((item.unitPrice + addOnsTotal) * 100) / 100,
        quantity: item.quantity,
      };
    });
  }, [items]);

  const pricingTotals = useMemo(() => {
    return calculateOrderTotals(pricingInputs, {
      isExpress,
      expressSurchargePercent: storeConfig?.expressSurchargePercent,
      expressDeliveryOption: deliverySpeed,
    });
  }, [pricingInputs, isExpress, storeConfig, deliverySpeed]);

  const subtotal = pricingTotals.subtotal;
  const discount = pricingTotals.discountAmount;
  const expressSurcharge = pricingTotals.expressSurcharge;
  const total = pricingTotals.totalAmount;

  // Preview surcharges for express delivery speed buttons (canonical calculation)
  const tomorrowPreviewSurcharge = useMemo(() => {
    if (storeConfig?.expressSurchargePercent == null || pricingInputs.length === 0) return 0;
    try {
      const preview = calculateOrderTotals(pricingInputs, {
        isExpress: true,
        expressSurchargePercent: storeConfig.expressSurchargePercent,
        expressDeliveryOption: ExpressDeliveryOption.NEXT_DAY_EVENING,
      });
      return preview.expressSurcharge;
    } catch {
      return 0;
    }
  }, [pricingInputs, storeConfig]);

  const sameDayPreviewSurcharge = useMemo(() => {
    if (storeConfig?.expressSurchargePercent == null || pricingInputs.length === 0) return 0;
    try {
      const preview = calculateOrderTotals(pricingInputs, {
        isExpress: true,
        expressSurchargePercent: storeConfig.expressSurchargePercent,
        expressDeliveryOption: ExpressDeliveryOption.SAME_DAY,
      });
      return preview.expressSurcharge;
    } catch {
      return 0;
    }
  }, [pricingInputs, storeConfig]);

  const totalRegularGarments = useMemo(() => {
    return items
      .filter((i) => !i.isWeightBased && !(i.weight != null && i.weight > 0))
      .reduce((sum, item) => sum + item.quantity, 0);
  }, [items]);

  const totalGarmentCount = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  }, [items]);

  // Canonical weight-based check (reuses GarmentCategory and ServiceCategory WEIGHT_BASED)
  const isOrderWeightBased = useMemo(() => {
    return items.some((item) => {
      const garment = garments.find((g) => g.id === item.garmentCatalogId);
      const service = services.find((s) => s.id === item.serviceTypeId);
      return (
        item.isWeightBased ||
        (item.weight != null && item.weight > 0) ||
        garment?.category === 'WEIGHT_BASED' ||
        garment?.category === GarmentCategory.WEIGHT_BASED ||
        service?.category === 'WEIGHT_BASED' ||
        service?.category === ServiceCategory.WEIGHT_BASED
      );
    });
  }, [items, garments, services]);

  // Photo requirement derived using canonical shared-types logic
  const isPhotoRequired = useMemo(() => {
    return isPhotoRequiredForOrder({
      isWalkIn: true,
      totalPieces: totalGarmentCount,
      isWeightBased: isOrderWeightBased,
    });
  }, [totalGarmentCount, isOrderWeightBased]);

  // Piece-level and garment-level photo tracking and validation
  const { coveredPieces, totalRequiredUnits, missingPiecesList, allPiecesCovered } = useMemo(() => {
    let covered = 0;
    let required = 0;
    const missing: Array<{
      itemIndex: number;
      garmentName: string;
      unitNumber: number;
      unitLabel: string;
    }> = [];

    items.forEach((item, itemIndex) => {
      const pieceCount = item.quantity || 1;
      const pieces = item.pieces || [];

      for (let u = 1; u <= pieceCount; u++) {
        required++;
        const piece = pieces.find((p: any) => p.unitNumber === u);
        const count = piece?.photos?.length || 0;
        if (count > 0) {
          covered++;
        } else {
          missing.push({
            itemIndex,
            garmentName: item.garmentName,
            unitNumber: u,
            unitLabel: pieceCount > 1 ? `Garment ${u}` : `Garment`,
          });
        }
      }
    });

    return {
      coveredPieces: covered,
      totalRequiredUnits: required,
      missingPiecesList: missing,
      allPiecesCovered: required > 0 && missing.length === 0,
    };
  }, [items]);

  // Total photos count across all pieces and batches
  const totalPhotosCount = useMemo(() => {
    return items.reduce((sum, item) => {
      const pieces = item.pieces || [];
      const pieceCount = pieces.reduce((pSum: number, p: any) => pSum + (p.photos?.length || 0), 0);
      const batchCount = item.batchPhotos?.length || 0;
      return sum + pieceCount + batchCount;
    }, 0);
  }, [items]);

  // Formatted validation message for missing photos
  const missingPiecesMessage = useMemo(() => {
    if (missingPiecesList.length === 0) return '';
    if (missingPiecesList.length === 1) {
      const m = missingPiecesList[0];
      return `Add at least one photo for ${m.unitLabel} (${m.garmentName}).`;
    }
    const last = missingPiecesList[missingPiecesList.length - 1];
    const rest = missingPiecesList.slice(0, -1);
    const piecesListStr =
      rest.map((m) => `${m.unitLabel} (${m.garmentName})`).join(', ') +
      ` and ${last.unitLabel} (${last.garmentName})`;
    return `Add at least one photo for ${piecesListStr}.`;
  }, [missingPiecesList]);

  const handleAddPhotoToPiece = (itemIndex: number, unitNumber: number, file: File) => {
    const previewUrl = URL.createObjectURL(file);
    const photoId = `photo-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    setItems((prev) => {
      const updated = [...prev];
      const targetItem = { ...updated[itemIndex] };
      const pieces = [...(targetItem.pieces || [])];
      const pieceIdx = pieces.findIndex((p: any) => p.unitNumber === unitNumber);

      if (pieceIdx >= 0) {
        pieces[pieceIdx] = {
          ...pieces[pieceIdx],
          photos: [...(pieces[pieceIdx].photos || []), { id: photoId, file, previewUrl }],
        };
      } else {
        pieces.push({
          unitNumber,
          photos: [{ id: photoId, file, previewUrl }],
        });
      }

      targetItem.pieces = pieces;
      if (targetItem.isWeightBased) {
        targetItem.batchPhotos = pieces.flatMap((p: any) => p.photos || []);
      }
      targetItem.photoFile = pieces[0]?.photos[0]?.file || null;
      updated[itemIndex] = targetItem;
      return updated;
    });
  };

  const handleRemovePhotoFromPiece = (itemIndex: number, unitNumber: number, photoId: string) => {
    setItems((prev) => {
      const updated = [...prev];
      const targetItem = { ...updated[itemIndex] };
      const pieces = [...(targetItem.pieces || [])];
      const pieceIdx = pieces.findIndex((p: any) => p.unitNumber === unitNumber);

      if (pieceIdx >= 0) {
        pieces[pieceIdx] = {
          ...pieces[pieceIdx],
          photos: pieces[pieceIdx].photos.filter((p: any) => p.id !== photoId),
        };
      }

      targetItem.pieces = pieces;
      if (targetItem.isWeightBased) {
        targetItem.batchPhotos = pieces.flatMap((p: any) => p.photos || []);
      }
      targetItem.photoFile = pieces[0]?.photos[0]?.file || null;
      updated[itemIndex] = targetItem;
      return updated;
    });
  };

  const handleAddBatchPhoto = (itemIndex: number, file: File) => {
    const previewUrl = URL.createObjectURL(file);
    const photoId = `photo-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const newPhoto = { id: photoId, file, previewUrl };

    setItems((prev) => {
      const updated = [...prev];
      const targetItem = { ...updated[itemIndex] };
      const batchPhotos = [...(targetItem.batchPhotos || [])];
      batchPhotos.push(newPhoto);
      targetItem.batchPhotos = batchPhotos;

      // Also assign to the first unphotographed piece slot if available
      const pieces = [...(targetItem.pieces || [])];
      const unphotographedPiece = pieces.find((p: any) => !p.photos || p.photos.length === 0);
      if (unphotographedPiece) {
        unphotographedPiece.photos = [newPhoto];
      }
      targetItem.pieces = pieces;
      targetItem.photoFile = pieces[0]?.photos?.[0]?.file || batchPhotos[0]?.file || null;
      updated[itemIndex] = targetItem;
      return updated;
    });
  };

  const handleRemoveBatchPhoto = (itemIndex: number, photoId: string) => {
    setItems((prev) => {
      const updated = [...prev];
      const targetItem = { ...updated[itemIndex] };
      const batchPhotos = (targetItem.batchPhotos || []).filter((p: any) => p.id !== photoId);
      targetItem.batchPhotos = batchPhotos;
      const pieces = (targetItem.pieces || []).map((p: any) => ({
        ...p,
        photos: (p.photos || []).filter((photo: any) => photo.id !== photoId),
      }));
      targetItem.pieces = pieces;
      targetItem.photoFile = pieces[0]?.photos?.[0]?.file || batchPhotos[0]?.file || null;
      updated[itemIndex] = targetItem;
      return updated;
    });
  };

  // Order Submission
  const handleCreateOrder = async () => {
    if (!selectedCustomerId) {
      setShowCustomerModal(true);
      return;
    }
    if (items.length === 0) {
      alert('Please add at least one item to the cart before checking out.');
      return;
    }
    if (isPhotoRequired && !allPiecesCovered) {
      setShowMissingPhotosModal(true);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        customerId: selectedCustomerId,
        isExpress,
        expressDeliveryOption: deliverySpeed,
        pickupType: 'STORE_PICKUP',
        workflow: activeWorkflow,
        entryMode: activeEntryMode,
        items: items.map((item) => {
          const isWb = item.isWeightBased || (item.weight != null && item.weight > 0);
          return {
            garmentCatalogId: item.garmentCatalogId,
            serviceTypeId: item.serviceTypeId,
            quantity: isWb ? item.garmentsCount || item.quantity || 1 : item.quantity || 1,
            weight: isWb ? item.weight : undefined,
            unitPrice: item.unitPrice,
            defectNotes: item.defectNotes || undefined,
            addOnIds: (item.addOns || []).map((a: any) => a.id),
            pieces: (item.pieces || []).map((p: any) => ({
              unitNumber: p.unitNumber,
              photoCount: p.photos?.length || 0,
            })),
          };
        }),
        notes: generalNote.trim() || 'Created via POS terminal',
      };

      const res = await fetch(`${API_URL}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.message || `Failed to create order (${res.status})`);
      }

      const body = await res.json();
      const createdOrder = body.data;

      // Handle async photo uploads for all individual physical garments
      try {
        const uploadPromises: Promise<any>[] = [];
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const createdItem = createdOrder.items?.[i];
          if (!createdItem) continue;

          if (item.pieces) {
            for (const piece of item.pieces) {
              if (!piece.photos || piece.photos.length === 0) continue;
              // Match physical garment by unitNumber
              const pg = createdItem.physicalGarments?.find(
                (g: any) => g.unitNumber === piece.unitNumber,
              );
              for (const photo of piece.photos) {
                if (photo.file) {
                  uploadPromises.push(
                    uploadPhoto(
                      token!,
                      photo.file,
                      createdOrder.id,
                      'FRONT' as PhotoType,
                      createdItem.id,
                      pg?.id,
                    ),
                  );
                }
              }
            }
          }
        }
        await Promise.all(uploadPromises);
      } catch (uploadErr) {
        console.error('Photo upload failed but order was created:', uploadErr);
      }

      navigate(`/orders/${createdOrder.id}`);
    } catch (err: any) {
      alert(`Error creating order: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="flex flex-col min-h-screen lg:h-screen overflow-x-hidden lg:overflow-hidden font-sans select-none"
      style={{
        background: 'var(--bg-app)',
        transition: 'background-color 0.25s ease, color 0.2s ease',
      }}
    >
      {/* ─── 1. TOP HEADER ───────────────────────────────── */}
      <header
        className="shrink-0 z-10"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 20px',
          minHeight: '52px',
          background: 'var(--bg-surface, #ffffff)',
          borderBottom: '1px solid var(--border, #e2e8f0)',
          boxShadow: '0 1px 3px 0 var(--shadow-color, rgba(0,0,0,0.03))',
        }}
      >
        {/* Left: Back Button + Title + Subtitle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              width: '40px',
              height: '40px',
              minWidth: '40px',
              minHeight: '40px',
              borderRadius: '8px',
              border: '1px solid var(--border, #e2e8f0)',
              background: 'var(--bg-surface, #ffffff)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent, #2563eb)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              flexShrink: 0,
              boxShadow: '0 1px 2px 0 var(--shadow-color, rgba(0,0,0,0.03))',
            }}
            title="Go Back"
          >
            <ArrowLeft size={18} />
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            <h1
              style={{
                fontSize: '20px',
                fontWeight: 800,
                color: 'var(--text-primary, #0f172a)',
                lineHeight: 1.2,
                letterSpacing: '-0.01em',
                margin: 0,
              }}
            >
              Create New Order
            </h1>
            <span
              style={{
                fontSize: '12.5px',
                color: 'var(--text-muted, #64748b)',
                fontWeight: 400,
                lineHeight: 1.2,
              }}
            >
              Add garments and services to create a new order
            </span>
          </div>
        </div>

        {/* Center: Mode Switcher (Matching Reference Screenshot) */}
        <div
          aria-label="Order Entry Mode Selection"
          className="flex items-center gap-1.5 p-1 rounded-full bg-[var(--bg-surface-inset)] border border-[var(--border)] shadow-[var(--shadow-neu-inset)]"
        >
          {/* CREATE ORDER PER PIECE */}
          <button
            type="button"
            id="entry-mode-pieces-btn"
            role="button"
            aria-label="Create Order Per Pieces (Dry Clean)"
            aria-pressed={activeEntryMode === 'PIECES'}
            onClick={() => handleSelectEntryMode('PIECES')}
            className={`h-10 px-4 rounded-full transition-all text-left flex items-center justify-between gap-2.5 cursor-pointer ${
              activeEntryMode === 'PIECES'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold shadow-md shadow-purple-500/25'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                  activeEntryMode === 'PIECES'
                    ? 'bg-white/20 text-white'
                    : 'bg-[var(--bg-surface)] text-[var(--text-secondary)]'
                }`}
              >
                <Sparkles size={13} />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold leading-tight">
                  Create Order Per Piece<span className="sr-only">s</span>
                </span>
                <span
                  className={`text-[10px] font-medium leading-tight ${activeEntryMode === 'PIECES' ? 'text-purple-200' : 'text-purple-600 dark:text-purple-400'}`}
                >
                  (Dry Clean)
                </span>
              </div>
            </div>
            {activeEntryMode === 'PIECES' && (
              <div className="w-4 h-4 rounded-full bg-white/25 text-white flex items-center justify-center shrink-0 ml-1">
                <Check size={11} strokeWidth={3} />
              </div>
            )}
          </button>

          {/* CREATE ORDER PER WEIGHT */}
          <button
            type="button"
            id="entry-mode-weight-btn"
            role="button"
            aria-pressed={activeEntryMode === 'WEIGHT'}
            onClick={() => handleSelectEntryMode('WEIGHT')}
            title="Weight-based Laundry order entry (min 2.00 kg)"
            className={`h-10 px-4 rounded-full transition-all text-left flex items-center justify-between gap-2.5 cursor-pointer ${
              activeEntryMode === 'WEIGHT'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold shadow-md shadow-blue-500/25'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                  activeEntryMode === 'WEIGHT'
                    ? 'bg-white/20 text-white'
                    : 'bg-[var(--bg-surface)] text-[var(--text-secondary)]'
                }`}
              >
                <Scale size={13} />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold leading-tight">Create Order Per Weight</span>
                <span
                  className={`text-[10px] font-medium leading-tight ${activeEntryMode === 'WEIGHT' ? 'text-blue-200' : 'text-[var(--text-muted)]'}`}
                >
                  (Laundry / kg)
                </span>
              </div>
            </div>
            {activeEntryMode === 'WEIGHT' && (
              <div className="w-4 h-4 rounded-full bg-white/25 text-white flex items-center justify-center shrink-0 ml-1">
                <Check size={11} strokeWidth={3} />
              </div>
            )}
          </button>
        </div>

        {/* Right: ThemeToggle + Customer Details Card */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <ThemeToggle size="sm" />
          {customer ? (
            <div
              onClick={() => setShowCustomerModal(true)}
              className="flex items-center gap-2.5 bg-[var(--bg-surface)] border border-[var(--border)] rounded-full pl-1.5 pr-3 py-1 shadow-[var(--shadow-neu-card-sm)] cursor-pointer transition-all hover:shadow-md"
            >
              {/* Initials Circle */}
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'var(--accent-muted, #dbeafe)',
                  color: 'var(--accent, #2563eb)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '12px',
                  flexShrink: 0,
                  letterSpacing: '0.02em',
                }}
              >
                {customer.name
                  .split(' ')
                  .map((n: string) => n[0])
                  .join('')
                  .substring(0, 2)
                  .toUpperCase()}
              </div>
              {/* Name + ID/Phone */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1px',
                  lineHeight: 1.2,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      color: 'var(--text-primary, #0f172a)',
                    }}
                  >
                    {customer.name}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowCustomerModal(true);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '2px',
                      cursor: 'pointer',
                      color: 'var(--text-muted, #64748b)',
                      display: 'flex',
                      alignItems: 'center',
                      borderRadius: '4px',
                      transition: 'color 0.15s ease',
                    }}
                    title="Edit Customer"
                  >
                    <Pencil size={12} />
                  </button>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    color: 'var(--text-muted, #64748b)',
                  }}
                >
                  <span style={{ fontWeight: 500 }}>
                    #
                    {customer.id
                      ? customer.id.length > 10
                        ? customer.id.substring(0, 10).toUpperCase()
                        : customer.id.toUpperCase()
                      : 'CUST-00124'}
                  </span>
                  <span style={{ color: 'var(--border, #cbd5e1)' }}>•</span>
                  <span>({customer.phone})</span>
                </div>
              </div>
              {/* Chevron */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginLeft: '2px',
                  color: 'var(--text-placeholder, #94a3b8)',
                }}
              >
                <ChevronDown size={15} />
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowCustomerModal(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 rounded-full text-xs font-bold shadow-md shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700 cursor-pointer transition-all"
            >
              <UserPlus size={15} />
              <span>+ Select Customer</span>
            </button>
          )}
        </div>
      </header>

      {/* Accessible Section Heading for Screen Readers & Tests */}
      <h2 className="sr-only">Add Items</h2>

      {/* ─── 2. MAIN CONTENT (WEIGHT VS PIECE WORKFLOW) ──────────────────── */}
      {activeEntryMode === 'WEIGHT' ? (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <LaundryWeightOrderEntry
            services={services}
            prices={prices}
            weightGarments={garments.filter(
              (g) => g.category === 'WEIGHT_BASED' || g.category === GarmentCategory.WEIGHT_BASED,
            )}
            items={items}
            onAddToCart={handleAddWeightItem}
            onRemoveItem={handleRemoveItem}
            onCheckout={handleCreateOrder}
            onAddBatchPhotoToItem={handleAddBatchPhoto}
            onRemoveBatchPhotoFromItem={handleRemoveBatchPhoto}
            isSubmitting={isSubmitting}
            topUpServices={storeConfig?.topUpServices}
            canEditPrice={canModifyPrice}
            onPriceUpdated={handlePriceUpdated}
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-x-hidden max-lg:overflow-y-auto lg:overflow-hidden p-2.5 lg:p-3 gap-3 bg-[var(--bg-app)]">
          {/* LEFT COLUMN: Garment Catalog */}
          <div
            className="w-full lg:w-[68%] lg:flex-1 min-w-0 flex flex-col min-h-0 rounded-2xl overflow-hidden shadow-[var(--shadow-neu-card-sm)] border border-[var(--border)] bg-[var(--bg-surface)] max-lg:min-h-[460px] h-full"
            style={{
              transition: 'background-color 0.2s ease, border-color 0.2s ease',
            }}
          >
            {/* Per-Piece Dry Cleaning Catalog Header */}
            <div className="shrink-0 px-3.5 py-2 flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg-surface-inset)]">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-purple-700 dark:text-purple-400 flex items-center gap-1.5">
                  <Sparkles size={13} />
                  <span>Per-Piece Garments (Dry Cleaning)</span>
                </span>
              </div>
              <span className="text-[10px] text-[var(--text-secondary)] font-medium">
                Tip: Select "Weight Based (Exception)" category for weight-measured items
              </span>
            </div>
            <ItemSelector
              garments={garments}
              services={services}
              prices={prices}
              onGarmentSelect={handleAddItem}
              onBack={() => navigate(-1)}
              workflow={activeWorkflow}
            />
          </div>

          {/* RIGHT COLUMN: Current Order Panel (Wider width, maximum vertical height) */}
          <div
            className="w-full lg:w-[32%] lg:min-w-[390px] xl:min-w-[410px] shrink-0 flex flex-col rounded-2xl shadow-[var(--shadow-neu-card-sm)] overflow-hidden border border-[var(--border)] bg-[var(--bg-surface)] h-full min-h-0"
            style={{
              transition: 'background-color 0.2s ease, border-color 0.2s ease',
            }}
          >
            {/* ─── SECTION A: PANEL HEADER ─────────────────── */}
            <div className="px-4 py-3 flex items-center justify-between shrink-0 border-b border-[var(--border)] bg-[var(--bg-surface-inset)]">
              <div className="flex items-center gap-2 min-w-0">
                <ShoppingBag
                  size={18}
                  className="text-blue-600 dark:text-blue-400 shrink-0"
                  strokeWidth={2}
                />
                <h3 className="font-bold text-sm sm:text-base text-[var(--text-primary)] tracking-tight shrink-0">
                  Current Order
                </h3>
                <span className="bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 text-xs font-semibold px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-900 shrink-0">
                  {totalGarmentCount} {totalGarmentCount === 1 ? 'item' : 'items'}
                </span>
                <span
                  id="current-order-workflow-badge"
                  className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${
                    activeWorkflow === 'LAUNDRY'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                      : 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                  }`}
                >
                  {activeWorkflow === 'LAUNDRY' ? 'Laundry' : 'Dry Clean'}
                </span>
              </div>

              {items.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setItems([])}
                  className="flex items-center gap-1 text-xs font-semibold text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 transition-colors cursor-pointer shrink-0 min-h-[32px] px-2 py-1 rounded-full hover:bg-rose-50 dark:hover:bg-rose-950/40"
                  title="Clear all items from order"
                >
                  <Trash2 size={13} className="text-rose-500 dark:text-rose-400" strokeWidth={2} />
                  <span>Clear All</span>
                </button>
              ) : (
                <span className="text-xs font-medium text-[var(--text-muted)] select-none shrink-0">
                  Order #NEW
                </span>
              )}
            </div>

            {/* ─── SECTION B: SCROLLABLE ORDER CONTENTS ────── */}
            <div
              className="flex-1 min-h-0 overflow-y-auto px-3 py-2.5 space-y-2.5"
              style={{ background: 'var(--bg-surface)' }}
            >
              {items.length === 0 ? (
                /* Clean Empty State */
                <div className="flex flex-col items-center justify-center py-14 text-center px-6 select-none">
                  <div className="w-16 h-16 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 flex items-center justify-center text-slate-400 mb-3.5 shadow-2xs">
                    <svg
                      width="34"
                      height="34"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.25"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-slate-400"
                    >
                      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                      <path d="m3.3 7 8.7 5 8.7-5" />
                      <path d="M12 22V12" />
                    </svg>
                  </div>
                  <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 mb-1">
                    No items added yet
                  </h4>
                  <p className="text-xs text-slate-400 dark:text-slate-500 max-w-[220px] text-center leading-relaxed">
                    Select garments from the catalog to add them to this order.
                  </p>
                </div>
              ) : (
                <>
                  {/* Selected Garment Cards */}
                  <div className="space-y-2.5">
                    {items.map((item, idx) => {
                      const isWb = item.isWeightBased || (item.weight != null && item.weight > 0);
                      const multiplier = isWb ? item.weight : item.quantity;
                      const addOnsTotal = (item.addOns || []).reduce(
                        (sum: number, a: any) => sum + (Number(a.price) || 0),
                        0,
                      );
                      const itemTotal = isWb
                        ? Math.round((item.unitPrice * multiplier + addOnsTotal) * 100) / 100
                        : Math.round((item.unitPrice + addOnsTotal) * multiplier * 100) / 100;
                      const totalRequired = isWb
                        ? item.garmentsCount || item.quantity || 1
                        : item.quantity;
                      const coveredItemPieces =
                        (item.pieces || []).filter((p: any) => p.photos && p.photos.length > 0)
                          .length ||
                        item.batchPhotos?.length ||
                        0;
                      const hasDetails =
                        item.defectNotes ||
                        item.brand ||
                        item.topUpService ||
                        coveredItemPieces > 0;

                      return (
                        <div
                          key={idx}
                          className="rounded-lg p-3 shadow-2xs transition-all fade-slide-item"
                          style={{
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border)',
                            transition:
                              'background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
                          }}
                        >
                          {/* 2-column layout: Left: Garment icon, Right: Item content */}
                          <div className="flex gap-3 items-start">
                            {/* Left: Garment Icon Box */}
                            <div
                              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                              style={{
                                background: 'var(--bg-surface-muted)',
                                border: '1px solid var(--border-subtle)',
                                color: 'var(--text-secondary)',
                              }}
                            >
                              {renderStitchGarmentIcon(item.garmentName)}
                            </div>

                            {/* Right: Item Content */}
                            <div className="flex-1 min-w-0">
                              {/* Top row: Garment Name + Item Price */}
                              <div className="flex items-baseline justify-between gap-2">
                                <span className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate leading-snug">
                                  {item.garmentName}
                                </span>
                                <span className="font-bold text-sm text-slate-900 dark:text-slate-100 whitespace-nowrap font-mono shrink-0">
                                  ₹{itemTotal.toFixed(2)}
                                </span>
                              </div>

                              {/* Subtitle row: Service Name + Unit Price combined */}
                              <div className="text-[11.5px] text-slate-500 dark:text-slate-400 font-normal mt-0.5 flex items-center gap-1.5 flex-wrap">
                                <span>{item.serviceName}</span>
                                <span>•</span>
                                {isWb ? (
                                  <span className="text-blue-700 dark:text-blue-400 font-semibold font-mono">
                                    {item.weight} kg @ ₹{Number(item.unitPrice).toFixed(2)}/kg
                                  </span>
                                ) : (
                                  <span>₹{Number(item.unitPrice).toFixed(2)} each</span>
                                )}
                                {addOnsTotal > 0 && !isWb && (
                                  <span className="text-blue-600 dark:text-blue-400 font-semibold font-mono">
                                    (+₹{addOnsTotal.toFixed(2)} add-on
                                    {item.addOns?.length === 1 ? '' : 's'})
                                  </span>
                                )}
                              </div>

                              {/* Selected Add-ons Badges */}
                              {item.addOns && item.addOns.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                  <span className="text-[10.5px] font-bold text-slate-500 dark:text-slate-400">
                                    Add-ons:
                                  </span>
                                  {item.addOns.map((addon: TopUpServiceItem) => (
                                    <span
                                      key={addon.id}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                                    >
                                      <span>
                                        {addon.name} (+₹{addon.price})
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveAddonFromItem(idx, addon.id)}
                                        className="text-blue-500 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 cursor-pointer min-h-[22px] min-w-[22px] flex items-center justify-center ml-0.5"
                                        title={`Remove ${addon.name}`}
                                        aria-label={`Remove ${addon.name}`}
                                      >
                                        <X size={11} />
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Optional Defect / Notes Indicator */}
                              {hasDetails && (
                                <div className="mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5 flex-wrap text-[11px] text-slate-600 dark:text-slate-300">
                                  {item.brand && (
                                    <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-200 font-medium text-[10.5px]">
                                      🏷️ {item.brand}
                                    </span>
                                  )}
                                  {item.defectNotes && (
                                    <span
                                      className="bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 px-1.5 py-0.5 rounded truncate max-w-[150px] text-[10.5px]"
                                      title={item.defectNotes}
                                    >
                                      ⚠️ {item.defectNotes}
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setEditingItemIndex(idx)}
                                    className={`px-1.5 py-0.5 rounded text-[10.5px] font-semibold border flex items-center gap-1 cursor-pointer transition-colors ${
                                      coveredItemPieces === totalRequired
                                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100'
                                        : isPhotoRequired
                                          ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-100'
                                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                                    }`}
                                    title="Click to view/add garment photos"
                                  >
                                    <Camera size={11} />
                                    <span>
                                      {coveredItemPieces}/{totalRequired} photo
                                      {totalRequired === 1 ? '' : 's'}{' '}
                                      {coveredItemPieces === totalRequired
                                        ? '✓'
                                        : isPhotoRequired
                                          ? '⚠'
                                          : ''}
                                    </span>
                                  </button>
                                </div>
                              )}

                              {/* Controls Row: Stepper + Add-on + Photos & Notes + Delete */}
                              <div className="flex items-center justify-between mt-2.5 gap-2 flex-wrap sm:flex-nowrap">
                                {/* Left Control: Weight edit button OR Quantity Stepper */}
                                {isWb ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setWeightModalData({
                                        garment: {
                                          id: item.garmentCatalogId,
                                          name: item.garmentName,
                                          category: 'WEIGHT_BASED',
                                        },
                                        serviceId: item.serviceTypeId,
                                        unitPrice: item.unitPrice,
                                        existingItemIndex: idx,
                                        initialWeight: item.weight,
                                      });
                                      setMeasuredWeightInput(String(item.weight));
                                      setWeightError(null);
                                    }}
                                    className="h-[36px] min-h-[44px] px-3 border border-blue-300 dark:border-blue-800 rounded-md bg-blue-50/70 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-700 dark:text-blue-300 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                                    title="Click to edit measured weight"
                                  >
                                    <Scale size={13} />
                                    <span>{item.weight} kg (Edit)</span>
                                  </button>
                                ) : (
                                  <div
                                    className="flex items-center rounded-md shadow-2xs overflow-hidden shrink-0 h-[36px] min-h-[44px]"
                                    style={{
                                      border: '1px solid var(--border)',
                                      background: 'var(--bg-surface)',
                                    }}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateQuantity(idx, -1)}
                                      className="w-9 h-[36px] min-h-[44px] flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 active:bg-slate-100 transition-colors cursor-pointer"
                                      title="Decrease quantity"
                                      aria-label="Decrease quantity"
                                    >
                                      <Minus size={12} strokeWidth={2.5} />
                                    </button>
                                    <span className="w-8 h-[36px] flex items-center justify-center text-center font-bold text-xs text-slate-900 dark:text-slate-100 font-mono select-none">
                                      {item.quantity}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateQuantity(idx, 1)}
                                      className="w-9 h-[36px] min-h-[44px] flex items-center justify-center text-[#2563eb] dark:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800 active:bg-slate-100 transition-colors cursor-pointer"
                                      title="Increase quantity"
                                      aria-label="Increase quantity"
                                    >
                                      <Plus size={12} strokeWidth={2.5} />
                                    </button>
                                  </div>
                                )}

                                {/* Action Buttons: [ Add-on ] [ Photos & Notes ] [ Delete ] */}
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    id={`item-addon-btn-${idx}`}
                                    onClick={() => setAddonModalItemIndex(idx)}
                                    className={`h-[36px] min-h-[44px] px-2.5 text-xs font-semibold rounded-md border transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                                      item.addOns && item.addOns.length > 0
                                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 hover:bg-blue-100'
                                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                                    }`}
                                    title="Select supported add-ons"
                                  >
                                    <Tag
                                      size={13}
                                      className={
                                        item.addOns && item.addOns.length > 0
                                          ? 'text-blue-600 dark:text-blue-400'
                                          : 'text-slate-500 dark:text-slate-400'
                                      }
                                    />
                                    <span>Add-on</span>
                                    {item.addOns && item.addOns.length > 0 && (
                                      <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                                        {item.addOns.length}
                                      </span>
                                    )}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => setEditingItemIndex(idx)}
                                    className={`h-[36px] min-h-[44px] px-2.5 text-xs font-semibold rounded-md border transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                                      coveredItemPieces === totalRequired
                                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100'
                                        : isPhotoRequired && coveredItemPieces < totalRequired
                                          ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-100'
                                          : hasDetails
                                            ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 hover:bg-blue-100'
                                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                                    }`}
                                    title={
                                      isWb
                                        ? 'Add batch photos or defect notes'
                                        : 'Add piece photos or defect notes'
                                    }
                                  >
                                    <Camera size={13} />
                                    <span>Photos &amp; Notes</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleRemoveItem(idx)}
                                    className="w-[36px] h-[36px] min-h-[44px] min-w-[36px] flex items-center justify-center border border-rose-200/80 dark:border-rose-900/60 rounded-md bg-rose-50/70 dark:bg-rose-950/40 text-rose-500 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 hover:text-rose-600 transition-colors cursor-pointer shadow-2xs"
                                    title="Delete item"
                                    aria-label="Delete item"
                                  >
                                    <Trash2 size={14} strokeWidth={2} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Photos Progress Card & Action (Inside Section B) */}
                  <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Camera size={14} className="text-[#2563eb] shrink-0" />
                        <span className="font-bold text-xs text-slate-800 dark:text-slate-200 shrink-0">
                          Photos
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-xs font-semibold shrink-0 ${
                            allPiecesCovered
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : isPhotoRequired
                                ? 'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300'
                                : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                          }`}
                        >
                          Photos: {coveredPieces} / {totalGarmentCount} pieces{' '}
                          {allPiecesCovered ? '✓' : ''}
                        </span>
                      </div>

                      {/* Quick Photo Action Button directly visible in the Photos card */}
                      <button
                        type="button"
                        id="open-photo-upload-btn"
                        onClick={() => {
                          const firstUncoveredIdx = items.findIndex((it) => {
                            const requiredUnits = it.garmentsCount || it.quantity || 1;
                            const covered = (it.pieces || []).filter(
                              (p: any) => p.photos && p.photos.length > 0,
                            ).length;
                            return covered < requiredUnits;
                          });
                          setEditingItemIndex(firstUncoveredIdx >= 0 ? firstUncoveredIdx : 0);
                        }}
                        className={`h-7 px-2.5 rounded text-[11px] font-bold flex items-center gap-1 transition-all shrink-0 cursor-pointer min-h-[32px] ${
                          allPiecesCovered
                            ? 'bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 shadow-2xs'
                            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                        }`}
                        title={
                          allPiecesCovered
                            ? 'View/manage captured photos'
                            : 'Click to capture or upload photos'
                        }
                      >
                        <Camera size={12} />
                        <span>{allPiecesCovered ? 'View Photos' : '+ Upload Photos'}</span>
                      </button>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-1.5 transition-all duration-300 rounded-full ${
                          allPiecesCovered ? 'bg-emerald-500' : 'bg-[#2563eb]'
                        }`}
                        style={{
                          width: `${totalGarmentCount > 0 ? (coveredPieces / totalGarmentCount) * 100 : 0}%`,
                        }}
                      />
                    </div>

                    {/* Single-Line Warning Alert */}
                    {isPhotoRequired && !allPiecesCovered && (
                      <div className="flex items-center gap-1.5 text-[11px] text-amber-800 dark:text-amber-300 bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 rounded px-2 py-1 whitespace-nowrap overflow-hidden text-ellipsis">
                        <span className="shrink-0 text-amber-600 dark:text-amber-400 font-bold text-xs">
                          ⚠
                        </span>
                        <span className="truncate">
                          <strong className="font-semibold">Photos required for all pieces.</strong>{' '}
                          Click "+ Upload Photos" to capture.
                        </span>
                      </div>
                    )}

                    {!isPhotoRequired && totalGarmentCount > 50 && !isOrderWeightBased && (
                      <div className="flex items-center gap-1 text-[11px] text-blue-700 dark:text-blue-300 bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200/50 dark:border-blue-800/60 rounded px-2 py-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
                        <span className="truncate">
                          Photos optional for bulk orders (&gt;50 pieces).
                        </span>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* General Notes Section (Inside Section B - accessible in both empty and active states) */}
              <div className="pt-0.5">
                {!isNoteOpen && !generalNote.trim() ? (
                  <button
                    type="button"
                    id="add-order-note-btn"
                    onClick={() => setIsNoteOpen(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors py-1 px-1.5 rounded hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer group min-h-[36px]"
                  >
                    <FileText
                      size={13}
                      className="text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors"
                    />
                    <span>+ Add order note (optional)</span>
                  </button>
                ) : !isNoteOpen && generalNote.trim() ? (
                  <div className="flex items-center justify-between p-2 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-800/50 rounded-lg text-xs">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-2">
                      <FileText size={13} className="text-blue-600 dark:text-blue-400 shrink-0" />
                      <span className="font-semibold text-slate-700 dark:text-slate-200 shrink-0">
                        Note:
                      </span>
                      <span
                        className="text-slate-600 dark:text-slate-300 truncate"
                        title={generalNote}
                      >
                        {generalNote}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setIsNoteOpen(true)}
                        className="p-1 text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 rounded transition-colors cursor-pointer min-h-[32px] min-w-[32px] flex items-center justify-center"
                        title="Edit order note"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setGeneralNote('');
                          setIsNoteOpen(false);
                        }}
                        className="p-1 text-slate-400 hover:text-rose-500 rounded transition-colors cursor-pointer min-h-[32px] min-w-[32px] flex items-center justify-center"
                        title="Remove note"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 rounded-lg p-2.5 space-y-1.5 transition-all">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="general-order-note"
                        className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200"
                      >
                        <FileText size={13} className="text-blue-600 dark:text-blue-400" />
                        <span>General Notes</span>
                        <span className="text-[11px] font-normal text-slate-400 dark:text-slate-500">
                          (Optional)
                        </span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsNoteOpen(false)}
                        className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium px-1.5 py-0.5 rounded cursor-pointer min-h-[32px]"
                      >
                        Done
                      </button>
                    </div>
                    <textarea
                      id="general-order-note"
                      rows={2}
                      value={generalNote}
                      onChange={(e) => setGeneralNote(e.target.value)}
                      placeholder="Optional — add any special instructions"
                      className="w-full text-xs p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-800 dark:text-slate-100 resize-none min-h-[44px]"
                      autoFocus
                    />
                  </div>
                )}
              </div>
            </div>

            {/* ─── SECTION C: PERSISTENT PRICING & CHECKOUT FOOTER ─── */}
            <div
              className="shrink-0 px-3.5 pt-2 pb-2.5 border-t border-slate-200 dark:border-slate-700/80 space-y-2 z-10 max-h-[48vh] overflow-y-auto"
              style={{
                background: 'var(--bg-surface)',
                boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.03)',
              }}
            >
              {/* Totals Breakdown */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs text-slate-600 dark:text-slate-400">
                  <span>Items ({totalGarmentCount})</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold pr-1">
                    ₹{subtotal.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs text-slate-600 dark:text-slate-400">
                  <span>Subtotal</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold pr-1">
                    ₹{subtotal.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs text-slate-600 dark:text-slate-400">
                  <span>Discount</span>
                  <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400 pr-1">
                    {discount > 0 ? `- ₹${discount.toFixed(2)}` : '- ₹0.00'}
                  </span>
                </div>

                {/* Delivery Speed Selection */}
                <div className="pt-0.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Delivery Speed
                    </span>
                    {storeConfig?.expressSurchargePercent == null && (
                      <span className="text-[11px] text-slate-400">Standard only</span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {/* Regular */}
                    <button
                      type="button"
                      id="speed-regular-btn"
                      onClick={() => setDeliverySpeed(ExpressDeliveryOption.REGULAR)}
                      className={`py-2 px-2 rounded-lg text-center transition-all text-xs font-medium cursor-pointer min-h-[44px] border ${
                        deliverySpeed === ExpressDeliveryOption.REGULAR
                          ? 'border-2 border-blue-500 bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      <div className="font-bold text-xs leading-tight">Regular</div>
                      <div className="text-[10px] text-slate-400 font-normal mt-0.5">Standard</div>
                    </button>

                    {/* Tomorrow Evening (1.5x) */}
                    <button
                      type="button"
                      id="speed-tomorrow-btn"
                      disabled={storeConfig?.expressSurchargePercent == null || isWednesdayOff}
                      onClick={() => setDeliverySpeed(ExpressDeliveryOption.NEXT_DAY_EVENING)}
                      title={
                        storeConfig?.expressSurchargePercent == null
                          ? 'Express not configured for this store'
                          : isWednesdayOff
                            ? 'Tomorrow is Thursday (store weekly off)'
                            : 'Tomorrow / Next-Day Evening Delivery (1.5× multiplier)'
                      }
                      className={`py-2 px-2 rounded-lg text-center transition-all text-xs font-medium cursor-pointer min-h-[44px] border ${
                        storeConfig?.expressSurchargePercent == null || isWednesdayOff
                          ? 'opacity-40 cursor-not-allowed border-slate-200 dark:border-slate-700 text-slate-400 bg-slate-50/50 dark:bg-slate-800/40'
                          : deliverySpeed === ExpressDeliveryOption.NEXT_DAY_EVENING
                            ? 'border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 shadow-xs font-semibold'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-amber-700'
                      }`}
                    >
                      <div className="font-semibold text-xs leading-tight flex items-center justify-center gap-1">
                        <span className="text-amber-500">⚡</span> Tomorrow
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono font-medium mt-0.5">
                        {tomorrowPreviewSurcharge > 0
                          ? `+₹${tomorrowPreviewSurcharge.toFixed(0)}`
                          : '1.5×'}
                      </div>
                    </button>

                    {/* Same Day (2.0x) */}
                    <button
                      type="button"
                      id="speed-same-day-btn"
                      disabled={storeConfig?.expressSurchargePercent == null || isThursdayOff}
                      onClick={() => setDeliverySpeed(ExpressDeliveryOption.SAME_DAY)}
                      title={
                        storeConfig?.expressSurchargePercent == null
                          ? 'Express not configured for this store'
                          : isThursdayOff
                            ? 'Today is Thursday (store weekly off)'
                            : 'Same-Day Express Delivery (2.0× multiplier)'
                      }
                      className={`py-2 px-2 rounded-lg text-center transition-all text-xs font-medium cursor-pointer min-h-[44px] border ${
                        storeConfig?.expressSurchargePercent == null || isThursdayOff
                          ? 'opacity-40 cursor-not-allowed border-slate-200 dark:border-slate-700 text-slate-400 bg-slate-50/50 dark:bg-slate-800/40'
                          : deliverySpeed === ExpressDeliveryOption.SAME_DAY
                            ? 'border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 shadow-xs font-semibold'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-amber-700'
                      }`}
                    >
                      <div className="font-semibold text-xs leading-tight flex items-center justify-center gap-1">
                        <span className="text-amber-500">⚡</span> Same Day
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono font-medium mt-0.5">
                        {sameDayPreviewSurcharge > 0
                          ? `+₹${sameDayPreviewSurcharge.toFixed(0)}`
                          : '2.0×'}
                      </div>
                    </button>
                  </div>
                </div>

                {/* Express Surcharge breakdown line if express is active */}
                {expressSurcharge > 0 && (
                  <div className="flex justify-between items-center text-xs text-amber-700 dark:text-amber-400 font-medium">
                    <span className="flex items-center gap-1">
                      <span>⚡ Express Fee</span>
                      <span className="text-[10px] text-amber-600/80 dark:text-amber-400/80">
                        (
                        {deliverySpeed === ExpressDeliveryOption.SAME_DAY
                          ? 'Same-day 2×'
                          : 'Tomorrow 1.5×'}
                        )
                      </span>
                    </span>
                    <span className="font-mono font-semibold pr-1">
                      + ₹{expressSurcharge.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              {/* Divider Line */}
              <div className="border-t border-slate-100 dark:border-slate-800" />

              {/* Highlighted Total Box */}
              <div className="rounded-2xl px-4 py-3 flex items-center justify-between border border-[var(--border)] bg-[var(--bg-surface-inset)] shadow-[var(--shadow-neu-inset)]">
                <div>
                  <div className="text-base font-bold tracking-tight text-[var(--text-primary)]">
                    Total
                  </div>
                  <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                    All items included
                  </div>
                </div>
                <div className="text-2xl font-bold font-mono tracking-tight text-blue-600 dark:text-blue-400">
                  ₹{total.toFixed(2)}
                </div>
              </div>

              {/* Primary Action: Proceed to Review */}
              <button
                type="button"
                onClick={handleCreateOrder}
                disabled={
                  isSubmitting ||
                  items.length === 0 ||
                  !selectedCustomerId ||
                  (isPhotoRequired && !allPiecesCovered)
                }
                className={`w-full min-h-[44px] h-[44px] py-2.5 px-4 rounded-full font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-md ${
                  isSubmitting ||
                  items.length === 0 ||
                  !selectedCustomerId ||
                  (isPhotoRequired && !allPiecesCovered)
                    ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed opacity-90'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white cursor-pointer shadow-blue-500/25 active:scale-[0.99]'
                }`}
                title={
                  !selectedCustomerId
                    ? 'Please select a customer first'
                    : items.length === 0
                      ? 'Add at least one item to proceed'
                      : isPhotoRequired && !allPiecesCovered
                        ? `Photos required: Please capture photos for all ${totalGarmentCount} pieces (${coveredPieces}/${totalGarmentCount} covered)`
                        : 'Proceed to Review'
                }
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Creating Order...</span>
                  </>
                ) : (
                  <>
                    <Check size={18} strokeWidth={2.5} />
                    <span>Proceed to Review</span>
                    <ArrowRight size={18} strokeWidth={2} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 3. CUSTOMER SELECTOR MODAL ─────────────────── */}
      {showCustomerModal && (
        <div
          className="fixed inset-0 z-50 backdrop-blur-xs flex items-center justify-center p-4 modal-backdrop"
          style={{ background: 'var(--overlay)' }}
        >
          <div
            className="rounded-[10px] shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh] modal-panel"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
          >
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{
                borderBottom: '1px solid var(--border)',
                background: 'var(--bg-surface-muted)',
              }}
            >
              <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                Select Customer
              </h3>
              <button
                type="button"
                onClick={() => setShowCustomerModal(false)}
                className="w-7 h-7 rounded flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto">
              <CustomerSelector onSelect={handleSelectCustomer} />
            </div>
          </div>
        </div>
      )}

      {/* ─── 3.5 ADD-ON SELECTION MODAL ─────────────────── */}
      {addonModalItemIndex !== null && items[addonModalItemIndex] && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Select Add-ons"
          className="fixed inset-0 z-60 flex items-center justify-center p-4 backdrop-blur-xs modal-backdrop"
          style={{ background: 'var(--overlay)' }}
        >
          <div
            className="w-full max-w-md bg-white rounded-lg shadow-xl overflow-hidden modal-panel animate-in fade-in-50 zoom-in-95"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
            }}
          >
            <div
              className="px-5 py-4 border-b flex items-center justify-between"
              style={{
                borderColor: 'var(--border)',
                background: 'var(--bg-surface-muted)',
              }}
            >
              <div>
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <Tag size={17} className="text-blue-600" />
                  Select Supported Add-ons
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {items[addonModalItemIndex].garmentName} •{' '}
                  {items[addonModalItemIndex].serviceName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAddonModalItemIndex(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
                aria-label="Close add-on modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-2.5 max-h-[60vh] overflow-y-auto">
              {availableTopUpServices.map((addon) => {
                const currentItem = items[addonModalItemIndex];
                const isSelected = (currentItem?.addOns || []).some((a: any) => a.id === addon.id);
                return (
                  <label
                    key={addon.id}
                    className={`flex items-center justify-between p-3 rounded border cursor-pointer transition-colors min-h-[44px] ${
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
                          handleToggleAddonForItem(addonModalItemIndex, addon, e.target.checked);
                        }}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <div>
                        <p className="text-sm font-bold text-slate-800">{addon.name}</p>
                        {addon.description && (
                          <p className="text-xs text-slate-500">{addon.description}</p>
                        )}
                      </div>
                    </div>
                    <span className="text-sm font-extrabold text-slate-900 font-mono">
                      +₹{addon.price}
                    </span>
                  </label>
                );
              })}
            </div>

            <div
              className="px-5 py-3.5 border-t flex justify-between items-center"
              style={{
                borderColor: 'var(--border)',
                background: 'var(--bg-surface-muted)',
              }}
            >
              <span className="text-xs text-slate-500 font-medium">
                {(items[addonModalItemIndex].addOns || []).length} add-on
                {items[addonModalItemIndex].addOns?.length === 1 ? '' : 's'} selected
              </span>
              <button
                type="button"
                id="confirm-addons-done-btn"
                onClick={() => setAddonModalItemIndex(null)}
                className="px-5 py-2 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700 cursor-pointer min-h-[44px] flex items-center justify-center transition-colors shadow-2xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 4. ITEM DETAILS / PHOTO MODAL ───────────────── */}
      {editingItemIndex !== null && items[editingItemIndex] && (
        <div
          className="fixed inset-0 z-50 backdrop-blur-xs flex items-center justify-center p-4 modal-backdrop"
          style={{ background: 'var(--overlay)' }}
        >
          <div
            className="rounded-[10px] shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] modal-panel"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
          >
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{
                borderBottom: '1px solid var(--border)',
                background: 'var(--bg-surface-muted)',
              }}
            >
              <div>
                <h3 className="font-bold text-sm text-slate-900">Item Details & Defect Notes</h3>
                <span className="text-xs text-slate-500">
                  {items[editingItemIndex].garmentName} • {items[editingItemIndex].serviceName}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setEditingItemIndex(null)}
                className="w-7 h-7 rounded flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Brand (Optional)
                </label>
                <input
                  type="text"
                  className="w-full border border-slate-200 rounded-[3px] px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="e.g. Zara, Raymond, Levi's"
                  value={items[editingItemIndex].brand || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setItems((prev) => {
                      const updated = [...prev];
                      updated[editingItemIndex] = { ...updated[editingItemIndex], brand: val };
                      return updated;
                    });
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Defect / Stains / Special Notes
                </label>
                <textarea
                  rows={2}
                  className="w-full border border-slate-200 rounded-[3px] px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="e.g. Oil stain on collar, missing middle button"
                  value={items[editingItemIndex].defectNotes || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setItems((prev) => {
                      const updated = [...prev];
                      updated[editingItemIndex] = {
                        ...updated[editingItemIndex],
                        defectNotes: val,
                      };
                      return updated;
                    });
                  }}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Add-on / Top Up Services (Optional)
                  </label>
                  <button
                    type="button"
                    id="manage-addons-from-notes-btn"
                    onClick={() => setAddonModalItemIndex(editingItemIndex)}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 cursor-pointer min-h-[44px] flex items-center gap-1"
                  >
                    <Tag size={13} />
                    <span>Manage Add-ons</span>
                  </button>
                </div>
                {items[editingItemIndex].addOns && items[editingItemIndex].addOns.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded">
                    {items[editingItemIndex].addOns.map((addon: TopUpServiceItem) => (
                      <span
                        key={addon.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200"
                      >
                        {addon.name} (+₹{addon.price})
                        <button
                          type="button"
                          onClick={() => handleRemoveAddonFromItem(editingItemIndex, addon.id)}
                          className="text-blue-500 hover:text-blue-800 cursor-pointer min-h-[24px] min-w-[24px] flex items-center justify-center"
                          aria-label={`Remove ${addon.name}`}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <button
                    type="button"
                    id="open-addon-selection-from-notes-btn"
                    onClick={() => setAddonModalItemIndex(editingItemIndex)}
                    className="w-full border border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50/50 rounded p-2.5 text-xs text-slate-500 font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-h-[44px]"
                  >
                    <Tag size={14} className="text-slate-400" />
                    <span>+ Add Add-on Service (e.g. Starching, Stain Treatment)</span>
                  </button>
                )}
              </div>

              <div className="pt-3 border-t border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Camera size={15} className="text-[#2563eb]" />
                      {items[editingItemIndex].isWeightBased ||
                      (items[editingItemIndex].weight != null && items[editingItemIndex].weight > 0)
                        ? `Batch Photos ${isPhotoRequired ? '(Required)' : '(Optional)'}`
                        : `Piece Photos ${isPhotoRequired ? '(Required)' : '(Optional)'}`}
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {items[editingItemIndex].isWeightBased ||
                      (items[editingItemIndex].weight != null && items[editingItemIndex].weight > 0)
                        ? 'Weight-based items require at least 1 batch photo before order creation.'
                        : isPhotoRequired
                          ? 'Every individual physical piece must have at least 1 photo before order creation.'
                          : totalGarmentCount >= 50 && !isOrderWeightBased
                            ? 'Photos are optional for bulk orders.'
                            : 'Photos help track piece conditions and defect history.'}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 pt-1">
                  {Array.from({ length: items[editingItemIndex].quantity }, (_, pIdx) => {
                    const unitNum = pIdx + 1;
                    const piece = (items[editingItemIndex].pieces || []).find(
                      (p: any) => p.unitNumber === unitNum,
                    );
                    const piecePhotos = piece?.photos || [];
                    const isCovered = piecePhotos.length > 0;

                    return (
                      <div
                        key={unitNum}
                        className={`border rounded-lg p-3 space-y-2.5 transition-colors ${
                          isCovered
                            ? 'border-emerald-200 bg-emerald-50/30'
                            : isPhotoRequired
                              ? 'border-amber-200 bg-amber-50/40'
                              : 'border-slate-200 bg-slate-50/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900">
                            {items[editingItemIndex].quantity > 1
                              ? `Garment ${unitNum} of ${items[editingItemIndex].quantity}`
                              : `Garment ${unitNum}`}
                            {items[editingItemIndex].isWeightBased && (
                              <span className="ml-1 text-[11px] font-normal text-slate-500">
                                ({items[editingItemIndex].weight} kg total)
                              </span>
                            )}
                          </span>
                          {isCovered ? (
                            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded flex items-center gap-1">
                              {piecePhotos.length} photo{piecePhotos.length > 1 ? 's' : ''} ✓
                            </span>
                          ) : isPhotoRequired ? (
                            <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded flex items-center gap-1">
                              0 photos ⚠ Required
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded">
                              0 photos (Optional)
                            </span>
                          )}
                        </div>

                        {/* Existing thumbnails / previews */}
                        {piecePhotos.length > 0 && (
                          <div className="space-y-1 pt-1">
                            <div className="text-[11px] font-medium text-slate-600">
                              Captured Photos ({piecePhotos.length}):
                            </div>
                            <div className="flex flex-wrap gap-3">
                              {piecePhotos.map((photo: any, phIdx: number) => (
                                <div
                                  key={photo.id || phIdx}
                                  className="flex flex-col items-center gap-1 shrink-0 bg-white p-1.5 rounded-lg border border-slate-200 shadow-2xs"
                                >
                                  <button
                                    type="button"
                                    onClick={() => setViewingPhotoUrl(photo.previewUrl)}
                                    className="w-20 h-20 rounded-md border border-slate-200 overflow-hidden bg-slate-100 hover:ring-2 hover:ring-blue-500 transition-all cursor-pointer block p-0"
                                    title={`Click to preview Photo ${phIdx + 1}`}
                                    aria-label={`Preview Photo ${phIdx + 1} of Piece ${unitNum}`}
                                  >
                                    <img
                                      src={photo.previewUrl}
                                      alt={`Piece ${unitNum} - Photo ${phIdx + 1}`}
                                      className="w-full h-full object-cover"
                                    />
                                  </button>
                                  <div className="flex items-center justify-between w-full px-0.5 text-[10px] text-slate-600">
                                    <span className="font-medium">Photo {phIdx + 1}</span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleRemovePhotoFromPiece(
                                          editingItemIndex,
                                          unitNum,
                                          photo.id,
                                        )
                                      }
                                      className="min-h-[44px] min-w-[44px] flex items-center justify-center text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors cursor-pointer"
                                      title={`Remove photo ${phIdx + 1}`}
                                      aria-label={`Remove photo ${phIdx + 1} from Piece ${unitNum}`}
                                    >
                                      <Trash2 size={15} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Photo capture action */}
                        <div className="pt-1">
                          <PhotoCapture
                            label={
                              piecePhotos.length === 0
                                ? isPhotoRequired
                                  ? `Capture Photo for Piece #${unitNum}`
                                  : `Capture Photo for Piece #${unitNum} (Optional)`
                                : `+ Add Photo`
                            }
                            allowCamera={true}
                            resetAfterCapture={true}
                            onCapture={(file) =>
                              handleAddPhotoToPiece(editingItemIndex, unitNum, file)
                            }
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingItemIndex(null)}
                className="px-6 py-2.5 bg-[#2563eb] text-white font-bold text-xs rounded-lg hover:bg-blue-700 transition-colors shadow-2xs min-h-[44px]"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 4b. PIECE WEIGHT EXCEPTION MODAL (CHANGE 5) ──────── */}
      {pieceExceptionModalData && (
        <div
          className="fixed inset-0 z-50 backdrop-blur-xs flex items-center justify-center p-4 modal-backdrop"
          style={{ background: 'var(--overlay)' }}
        >
          <div
            className="rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] modal-panel"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-3.5"
              style={{
                borderBottom: '1px solid var(--border)',
                background: 'var(--bg-surface-muted)',
              }}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                  <Shirt size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    Weight Based — Per Piece Entry
                  </h3>
                  <p className="text-xs text-slate-500">
                    {pieceExceptionModalData.garment.name} •{' '}
                    {services.find((s) => s.id === pieceExceptionModalData.serviceId)?.name ||
                      'Dry Clean'}{' '}
                    • Per Piece Exception
                  </p>
                </div>
              </div>
              <button
                type="button"
                id="close-piece-exception-modal-btn"
                onClick={() => setPieceExceptionModalData(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                aria-label="Close piece entry modal"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 overflow-y-auto">
              <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-2.5 text-xs">
                <span className="font-semibold">Notice:</span> Strictly per-piece pricing exception.
                No kilograms will be measured or billed.
              </div>

              {/* 1. Quantity / Number of Pieces */}
              <div>
                <label
                  htmlFor="piece-exception-qty-input"
                  className="block text-xs font-bold text-slate-800 mb-1.5"
                >
                  Quantity / Number of Pieces <span className="text-rose-500">*</span>
                </label>
                <input
                  id="piece-exception-qty-input"
                  type="number"
                  min="1"
                  step="1"
                  value={pieceExceptionModalData.quantity}
                  onChange={(e) =>
                    setPieceExceptionModalData((prev) =>
                      prev
                        ? {
                            ...prev,
                            quantity: Math.max(1, parseInt(e.target.value, 10) || 1),
                          }
                        : null,
                    )
                  }
                  className="w-full text-base font-bold font-mono px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {/* Presets */}
                <div className="flex gap-1.5 mt-2">
                  {[1, 2, 3, 5, 10].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() =>
                        setPieceExceptionModalData((prev) =>
                          prev ? { ...prev, quantity: preset } : null,
                        )
                      }
                      className={`px-3 py-1.5 text-xs font-bold rounded border cursor-pointer ${
                        pieceExceptionModalData.quantity === preset
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {preset} pcs
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Price Per Piece */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="piece-exception-price-input"
                    className="block text-xs font-bold text-slate-800"
                  >
                    Price Per Piece (₹) <span className="text-rose-500">*</span>
                  </label>
                  {!canModifyPrice && (
                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-[3px]">
                      Configured Rate (View Only)
                    </span>
                  )}
                </div>
                <input
                  id="piece-exception-price-input"
                  type="number"
                  min="0"
                  step="1"
                  disabled={!canModifyPrice}
                  readOnly={!canModifyPrice}
                  value={pieceExceptionModalData.unitPrice}
                  onChange={(e) => {
                    if (!canModifyPrice) return;
                    setPieceExceptionModalData((prev) =>
                      prev
                        ? {
                            ...prev,
                            unitPrice: Math.max(0, parseFloat(e.target.value) || 0),
                          }
                        : null,
                    );
                  }}
                  className={`w-full text-base font-bold font-mono px-3 py-2 border rounded-lg focus:outline-none ${
                    canModifyPrice
                      ? 'border-slate-300 focus:ring-2 focus:ring-blue-500 bg-white text-slate-900'
                      : 'border-slate-200 bg-slate-100 text-slate-600 cursor-not-allowed select-none'
                  }`}
                />
                {/* Presets - available to authorized admins only */}
                {canModifyPrice && (
                  <div className="flex gap-1.5 mt-2">
                    {[30, 40, 50, 60, 80].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() =>
                          setPieceExceptionModalData((prev) =>
                            prev ? { ...prev, unitPrice: preset } : null,
                          )
                        }
                        className={`px-2.5 py-1.5 text-xs font-bold rounded border cursor-pointer ${
                          pieceExceptionModalData.unitPrice === preset
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        ₹{preset}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 3. Calculated Total */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-1">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                  Calculated Total
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600 font-medium">
                    {pieceExceptionModalData.quantity} × ₹{pieceExceptionModalData.unitPrice} =
                  </span>
                  <span
                    id="piece-exception-calculated-total"
                    className="font-mono font-bold text-lg text-blue-600"
                  >
                    ₹
                    {(pieceExceptionModalData.quantity * pieceExceptionModalData.unitPrice).toFixed(
                      0,
                    )}
                  </span>
                </div>
              </div>

              {/* 4. Applicable Item-Detail Controls */}
              <div>
                <label
                  htmlFor="piece-exception-defect-notes"
                  className="block text-xs font-bold text-slate-800 mb-1"
                >
                  Defect / Item Notes (Optional)
                </label>
                <input
                  id="piece-exception-defect-notes"
                  type="text"
                  placeholder="e.g. Stains on collar, torn hem, missing buttons"
                  value={pieceExceptionModalData.defectNotes}
                  onChange={(e) =>
                    setPieceExceptionModalData((prev) =>
                      prev ? { ...prev, defectNotes: e.target.value } : null,
                    )
                  }
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label
                  htmlFor="piece-exception-brand"
                  className="block text-xs font-bold text-slate-800 mb-1"
                >
                  Brand / Tag / Remarks (Optional)
                </label>
                <input
                  id="piece-exception-brand"
                  type="text"
                  placeholder="e.g. Raymond, Zara, Blue linen"
                  value={pieceExceptionModalData.brand}
                  onChange={(e) =>
                    setPieceExceptionModalData((prev) =>
                      prev ? { ...prev, brand: e.target.value } : null,
                    )
                  }
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Footer */}
            <div
              className="px-5 py-3.5 flex items-center justify-end gap-2.5"
              style={{
                borderTop: '1px solid var(--border)',
                background: 'var(--bg-surface-muted)',
              }}
            >
              <button
                type="button"
                onClick={() => setPieceExceptionModalData(null)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-piece-exception-btn"
                onClick={handleConfirmPieceException}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
              >
                <Check size={16} strokeWidth={2.5} />
                <span>Add to Order</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 5. WEIGHT MEASUREMENT MODAL ────────────────── */}
      {weightModalData && (
        <div
          className="fixed inset-0 z-50 backdrop-blur-xs flex items-center justify-center p-4 modal-backdrop"
          style={{ background: 'var(--overlay)' }}
        >
          <div
            className="rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] modal-panel"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
          >
            <div
              className="flex items-center justify-between px-5 py-3.5"
              style={{
                borderBottom: '1px solid var(--border)',
                background: 'var(--bg-surface-muted)',
              }}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                  <Scale size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    {weightModalData.existingItemIndex !== undefined
                      ? 'Edit Weight'
                      : 'Measure Weight'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {weightModalData.garment.name} •{' '}
                    {services.find((s) => s.id === weightModalData.serviceId)?.name ||
                      'Weight Based'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                id="close-weight-modal-btn"
                onClick={() => {
                  setWeightModalData(null);
                  setMeasuredWeightInput('');
                  setWeightError(null);
                }}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                aria-label="Close weight modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              <div className="flex items-center justify-between bg-blue-50/70 border border-blue-200 rounded-lg p-3 text-xs">
                <span className="font-semibold text-slate-700">Configured Rate:</span>
                <span className="font-bold text-blue-700 text-sm font-mono">
                  ₹{Number(weightModalData.unitPrice).toFixed(2)} / kg
                </span>
              </div>

              <div>
                <label
                  htmlFor="weight-measurement-input"
                  className="block text-xs font-bold text-slate-800 mb-1.5"
                >
                  Measured Weight (kg) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="weight-measurement-input"
                    type="number"
                    step="0.01"
                    min="2.00"
                    placeholder="e.g. 2.50"
                    value={measuredWeightInput}
                    onChange={(e) => {
                      setMeasuredWeightInput(e.target.value);
                      setWeightError(null);
                    }}
                    className="w-full text-lg font-bold font-mono px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[48px] text-slate-900 placeholder:text-slate-400"
                    autoFocus
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-500 pointer-events-none">
                    kg
                  </span>
                </div>
                {weightError && (
                  <p className="text-xs text-rose-600 font-semibold mt-1.5 flex items-center gap-1">
                    <span>⚠</span> {weightError}
                  </p>
                )}
              </div>

              <div>
                <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Quick Presets (Min 2.00 kg)
                </span>
                <div className="grid grid-cols-5 gap-1.5">
                  {[2.0, 2.5, 3.0, 5.0, 10.0].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setMeasuredWeightInput(preset.toString());
                        setWeightError(null);
                      }}
                      className={`py-2 text-xs font-bold rounded-lg border transition-all min-h-[44px] cursor-pointer flex items-center justify-center ${
                        measuredWeightInput === preset.toString()
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                      }`}
                    >
                      {preset} kg
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-1.5">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                  Calculation Summary
                </div>
                <div className="flex justify-between items-center text-xs text-slate-700">
                  <span>
                    {parseFloat(measuredWeightInput) > 0 ? parseFloat(measuredWeightInput) : 0} kg ×
                    ₹{weightModalData.unitPrice}/kg
                  </span>
                  <span className="font-mono font-bold text-base text-slate-900">
                    ₹
                    {(
                      (parseFloat(measuredWeightInput) > 0 ? parseFloat(measuredWeightInput) : 0) *
                      weightModalData.unitPrice
                    ).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div
              className="px-5 py-3.5 flex items-center justify-end gap-2.5"
              style={{
                borderTop: '1px solid var(--border)',
                background: 'var(--bg-surface-muted)',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setWeightModalData(null);
                  setMeasuredWeightInput('');
                  setWeightError(null);
                }}
                className="px-4 py-2.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors min-h-[44px] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-weight-btn"
                onClick={handleConfirmWeight}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs min-h-[44px] flex items-center gap-1.5 cursor-pointer"
              >
                <Check size={16} strokeWidth={2.5} />
                <span>Confirm &amp; Add</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Modal for Photo Preview */}
      {viewingPhotoUrl && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 backdrop-blur-xs modal-backdrop"
          style={{ background: 'var(--overlay)' }}
          onClick={() => setViewingPhotoUrl(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative max-w-2xl w-full rounded-xl overflow-hidden shadow-2xl p-4 flex flex-col items-center gap-3 modal-panel"
            style={{ background: 'var(--bg-surface)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex justify-between items-center border-b pb-2">
              <span className="text-sm font-bold text-slate-800">Photo Preview</span>
              <button
                type="button"
                onClick={() => setViewingPhotoUrl(null)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Close photo preview"
              >
                <X size={20} />
              </button>
            </div>
            <img
              src={viewingPhotoUrl}
              alt="Enlarged photo preview"
              className="max-h-[70vh] w-auto object-contain rounded-lg border border-slate-200"
            />
            <button
              type="button"
              onClick={() => setViewingPhotoUrl(null)}
              className="min-h-[44px] px-6 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ─── WORKFLOW SWITCH CONFIRMATION MODAL ─── */}
      {pendingWorkflowSwitch && (
        <div
          className="fixed inset-0 z-50 backdrop-blur-xs flex items-center justify-center p-4 modal-backdrop"
          style={{ background: 'var(--overlay)' }}
        >
          <div
            className="rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col modal-panel"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
          >
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    Switch to{' '}
                    {pendingWorkflowSwitch === 'DRY_CLEANING' ? 'Dry Cleaning' : 'Laundry'}{' '}
                    Workflow?
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {pendingWorkflowSwitch === 'DRY_CLEANING'
                      ? 'Dry Cleaning is strictly per-piece with individual garment tags and does not support weight-based items or wash services.'
                      : 'Laundry workflow is primarily weight-based and uses washing services. Dry Clean services are not supported in Laundry.'}
                  </p>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 space-y-2">
                <p className="font-semibold">
                  {`Switching will remove ${incompatibleItemsToDrop.length} ${incompatibleItemsToDrop.length === 1 ? 'item that is' : 'items that are'} incompatible with ${pendingWorkflowSwitch === 'DRY_CLEANING' ? 'Dry Cleaning' : 'Laundry'}:`}
                </p>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-800 max-h-32 overflow-y-auto">
                  {incompatibleItemsToDrop.map((item, idx) => (
                    <li key={idx} className="truncate">
                      <span className="font-bold">{item.garmentName}</span> ({item.serviceName}
                      {item.isWeightBased && item.weight
                        ? ` • ${item.weight} kg`
                        : ` • ${item.quantity} pcs`}
                      )
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-amber-700 font-medium">
                  Customer selection {customer ? `(${customer.name})` : ''} and compatible items
                  will remain preserved.
                </p>
              </div>
            </div>

            <div
              className="px-5 py-3 flex items-center justify-end gap-2.5"
              style={{
                borderTop: '1px solid var(--border)',
                background: 'var(--bg-surface-muted)',
              }}
            >
              <button
                type="button"
                id="cancel-workflow-switch-btn"
                onClick={handleCancelWorkflowSwitch}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors min-h-[44px] cursor-pointer"
              >
                Keep {activeWorkflow === 'LAUNDRY' ? 'Laundry' : 'Dry Cleaning'}
              </button>
              <button
                type="button"
                id="confirm-workflow-switch-btn"
                onClick={handleConfirmWorkflowSwitch}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors min-h-[44px] cursor-pointer"
              >
                Switch &amp; Remove {incompatibleItemsToDrop.length}{' '}
                {incompatibleItemsToDrop.length === 1 ? 'Item' : 'Items'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MISSING PHOTOS REQUIREMENT MODAL ─── */}
      {showMissingPhotosModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Photos Required for Order Creation"
          className="fixed inset-0 z-50 backdrop-blur-xs flex items-center justify-center p-4 modal-backdrop"
          style={{ background: 'var(--overlay)' }}
        >
          <div
            className="rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col modal-panel max-h-[85vh]"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
          >
            {/* Modal Header */}
            <div
              className="p-5 flex items-center justify-between border-b"
              style={{ borderColor: 'var(--border)' }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                  <Camera size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    Photos Required for Checkout
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Walk-in laundry and piece items require at least 1 photo before order creation.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMissingPhotosModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Missing items list */}
            <div className="p-5 overflow-y-auto space-y-3 flex-1 min-h-0">
              <div className="text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                <span>Items needing photos ({missingPiecesList.length} remaining):</span>
                <span className="text-[11px] text-blue-600 font-bold">
                  {coveredPieces} of {totalRequiredUnits} pieces covered
                </span>
              </div>

              {missingPiecesList.length === 0 ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-center space-y-1">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-1">
                    <Check size={18} strokeWidth={3} />
                  </div>
                  <p className="text-sm font-bold text-emerald-900">
                    All required photos attached!
                  </p>
                  <p className="text-xs text-emerald-700">
                    You can now proceed to create the order.
                  </p>
                </div>
              ) : (
                missingPiecesList.map((m, idx) => {
                  const targetItem = items[m.itemIndex];
                  const isWb =
                    targetItem?.isWeightBased ||
                    (targetItem?.weight != null && targetItem?.weight > 0);

                  const snapPhotoForItem = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = 400;
                    canvas.height = 300;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                      ctx.fillStyle = '#2563eb';
                      ctx.fillRect(0, 0, 400, 300);
                      ctx.fillStyle = '#ffffff';
                      ctx.font = 'bold 18px sans-serif';
                      ctx.textAlign = 'center';
                      ctx.fillText(m.garmentName, 200, 130);
                      ctx.font = '14px sans-serif';
                      ctx.fillText(`${m.unitLabel} • ${new Date().toLocaleTimeString()}`, 200, 165);
                    }
                    canvas.toBlob(
                      (blob) => {
                        if (blob) {
                          const file = new File([blob], `snap-${Date.now()}.jpg`, {
                            type: 'image/jpeg',
                          });
                          if (m.unitNumber != null) {
                            handleAddPhotoToPiece(m.itemIndex, m.unitNumber, file);
                          } else if (isWb) {
                            handleAddBatchPhoto(m.itemIndex, file);
                          }
                        }
                      },
                      'image/jpeg',
                      0.9,
                    );
                  };

                  return (
                    <div
                      key={idx}
                      className="p-3 bg-white border border-slate-200 rounded-lg shadow-2xs flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold text-slate-900 truncate">
                          {m.garmentName}
                        </div>
                        <div className="text-xs text-slate-500 font-medium">{m.unitLabel}</div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <label className="h-9 px-3 bg-white hover:bg-slate-50 border border-slate-300 rounded-md font-semibold text-xs text-slate-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer">
                          <Camera size={14} className="text-blue-600" />
                          <span>Upload</span>
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) {
                                if (m.unitNumber != null) {
                                  handleAddPhotoToPiece(m.itemIndex, m.unitNumber, f);
                                } else if (isWb) {
                                  handleAddBatchPhoto(m.itemIndex, f);
                                }
                              }
                              e.target.value = '';
                            }}
                          />
                        </label>

                        <button
                          type="button"
                          onClick={snapPhotoForItem}
                          className="h-9 px-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md font-semibold text-xs text-blue-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          title="Instant snap photo for fast check-in"
                        >
                          <Sparkles size={14} className="text-blue-600" />
                          <span>Quick Snap</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div
              className="px-5 py-3.5 flex items-center justify-end gap-2.5 border-t"
              style={{
                borderColor: 'var(--border)',
                background: 'var(--bg-surface-muted)',
              }}
            >
              <button
                type="button"
                onClick={() => setShowMissingPhotosModal(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors min-h-[40px] cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                id="modal-proceed-checkout-btn"
                onClick={() => {
                  if (allPiecesCovered) {
                    setShowMissingPhotosModal(false);
                    handleCreateOrder();
                  } else {
                    // Snap all remaining photos with one click!
                    missingPiecesList.forEach((m) => {
                      const targetItem = items[m.itemIndex];
                      const isWb =
                        targetItem?.isWeightBased ||
                        (targetItem?.weight != null && targetItem?.weight > 0);
                      const canvas = document.createElement('canvas');
                      canvas.width = 400;
                      canvas.height = 300;
                      const ctx = canvas.getContext('2d');
                      if (ctx) {
                        ctx.fillStyle = '#2563eb';
                        ctx.fillRect(0, 0, 400, 300);
                        ctx.fillStyle = '#ffffff';
                        ctx.font = 'bold 18px sans-serif';
                        ctx.textAlign = 'center';
                        ctx.fillText(m.garmentName, 200, 130);
                        ctx.font = '14px sans-serif';
                        ctx.fillText(
                          `${m.unitLabel} • ${new Date().toLocaleTimeString()}`,
                          200,
                          165,
                        );
                      }
                      canvas.toBlob(
                        (blob) => {
                          if (blob) {
                            const file = new File([blob], `snap-${Date.now()}.jpg`, {
                              type: 'image/jpeg',
                            });
                            if (m.unitNumber != null) {
                              handleAddPhotoToPiece(m.itemIndex, m.unitNumber, file);
                            } else if (isWb) {
                              handleAddBatchPhoto(m.itemIndex, file);
                            }
                          }
                        },
                        'image/jpeg',
                        0.9,
                      );
                    });
                  }
                }}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors min-h-[40px] cursor-pointer shadow-sm flex items-center gap-1.5"
              >
                {allPiecesCovered ? (
                  <>
                    <Check size={14} strokeWidth={3} />
                    <span>Proceed to Checkout</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    <span>Snap All Photos &amp; Checkout</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
