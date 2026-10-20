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
} from 'lucide-react';
import { renderStitchGarmentIcon } from '../components/GarmentIcon';
import { ThemeToggle } from '../components/ThemeToggle';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export function OrderWizardPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialCustomerId = searchParams.get('customerId');
  const { token } = useAuth();

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
    const pieces = Array.from({ length: garmentsCount }, (_, idx) => {
      const u = idx + 1;
      const existingBatchPhoto = weightItem.batchPhotos?.[idx];
      return {
        unitNumber: u,
        photos: existingBatchPhoto ? [existingBatchPhoto] : [],
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
    const isWeightPieceException =
      activeWorkflow === 'DRY_CLEANING' &&
      (garment.category === 'WEIGHT_BASED' ||
        garment.category === GarmentCategory.WEIGHT_BASED ||
        service?.category === 'WEIGHT_BASED' ||
        service?.category === ServiceCategory.WEIGHT_BASED);

    if (isWeightPieceException) {
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
      garment.category === 'WEIGHT_BASED' ||
      garment.category === GarmentCategory.WEIGHT_BASED ||
      service?.category === 'WEIGHT_BASED' ||
      service?.category === ServiceCategory.WEIGHT_BASED;

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
        unitPrice,
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
  };

  // Pricing calculations via canonical calculateOrderTotals from @growfast/shared-types
  const pricingInputs = useMemo(() => {
    return items.map((item) => ({
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      weight:
        item.isWeightBased && item.weight != null && item.weight > 0 ? item.weight : undefined,
    }));
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
      targetItem.photoFile = pieces[0]?.photos[0]?.file || null;
      updated[itemIndex] = targetItem;
      return updated;
    });
  };

  const handleAddBatchPhoto = (itemIndex: number, file: File) => {
    const previewUrl = URL.createObjectURL(file);
    const photoId = `photo-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    setItems((prev) => {
      const updated = [...prev];
      const targetItem = { ...updated[itemIndex] };
      const batchPhotos = [...(targetItem.batchPhotos || [])];
      batchPhotos.push({ id: photoId, file, previewUrl });
      targetItem.batchPhotos = batchPhotos;
      targetItem.photoFile = batchPhotos[0]?.file || null;
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
      targetItem.photoFile = batchPhotos[0]?.file || null;
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
          padding: '12px 24px',
          minHeight: '64px',
          background: 'var(--bg-surface, #ffffff)',
          borderBottom: '1px solid var(--border, #e2e8f0)',
          boxShadow: '0 1px 3px 0 var(--shadow-color, rgba(0,0,0,0.03))',
        }}
      >
        {/* Left: Back Button + Title + Subtitle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              width: '44px',
              height: '44px',
              minWidth: '44px',
              minHeight: '44px',
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
            <ArrowLeft size={19} />
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <h1
              style={{
                fontSize: '22px',
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
                fontSize: '13px',
                color: 'var(--text-muted, #64748b)',
                fontWeight: 400,
                lineHeight: 1.3,
              }}
            >
              Add garments and services to create a new order
            </span>
          </div>
        </div>

        {/* Right: ThemeToggle + Customer Details Card */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ThemeToggle size="sm" />
          {customer ? (
            <div
              onClick={() => setShowCustomerModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                background: 'var(--bg-surface, #ffffff)',
                border: '1px solid var(--border, #e2e8f0)',
                borderRadius: '14px',
                padding: '6px 14px 6px 8px',
                boxShadow: '0 1px 2px 0 var(--shadow-color, rgba(0,0,0,0.04))',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {/* Initials Circle */}
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  background: 'var(--accent-muted, #dbeafe)',
                  color: 'var(--accent, #2563eb)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '14px',
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
                  gap: '2px',
                  lineHeight: 1.25,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    style={{
                      fontSize: '14px',
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
                    <Pencil size={13} />
                  </button>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '12px',
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
                  marginLeft: '4px',
                  color: 'var(--text-placeholder, #94a3b8)',
                }}
              >
                <ChevronDown size={17} />
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowCustomerModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'var(--accent-muted, #eff6ff)',
                border: '1px solid var(--accent, #bfdbfe)',
                color: 'var(--accent, #2563eb)',
                padding: '8px 16px',
                borderRadius: '10px',
                fontSize: '13.5px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: '0 1px 2px 0 var(--shadow-color, rgba(37, 99, 235, 0.08))',
              }}
            >
              <UserPlus size={16} />
              <span>+ Select Customer</span>
            </button>
          )}
        </div>
      </header>

      {/* ─── PRIMARY ENTRY MODE DECISION BAR (Compact & Space-Optimized) ─── */}
      <section
        aria-label="Order Entry Mode Selection"
        className="shrink-0 px-3 sm:px-4 py-1.5 z-5"
        style={{
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div className="flex items-center justify-center">
          <div className="grid grid-cols-2 gap-2 w-full max-w-xl mx-auto">
            {/* CREATE ORDER PER PIECES */}
            <button
              type="button"
              id="entry-mode-pieces-btn"
              role="button"
              aria-pressed={activeEntryMode === 'PIECES'}
              onClick={() => handleSelectEntryMode('PIECES')}
              className={`h-9 px-3 rounded-lg border transition-all text-left flex items-center justify-between gap-2 cursor-pointer ${
                activeEntryMode === 'PIECES'
                  ? 'bg-purple-50 border-purple-600 shadow-2xs text-purple-950 font-bold ring-1 ring-purple-600/20'
                  : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                    activeEntryMode === 'PIECES'
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <Sparkles size={13} />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider truncate">
                  Create Order Per Pieces
                </span>
                <span className="text-[10px] text-purple-600 font-medium hidden sm:inline">
                  (Dry Clean)
                </span>
              </div>
              {activeEntryMode === 'PIECES' && (
                <div className="w-4 h-4 rounded-full bg-purple-600 text-white flex items-center justify-center shrink-0">
                  <Check size={10} strokeWidth={3} />
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
              className={`h-9 px-3 rounded-lg border transition-all text-left flex items-center justify-between gap-2 cursor-pointer ${
                activeEntryMode === 'WEIGHT'
                  ? 'bg-blue-50 border-blue-600 shadow-2xs text-blue-950 font-bold ring-1 ring-blue-600/20'
                  : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                    activeEntryMode === 'WEIGHT'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <Scale size={13} />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider truncate">
                  Create Order Per Weight
                </span>
                <span className="text-[10px] text-blue-600 font-medium hidden sm:inline">
                  (Laundry / kg)
                </span>
              </div>
              {activeEntryMode === 'WEIGHT' && (
                <div className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                  <Check size={10} strokeWidth={3} />
                </div>
              )}
            </button>
          </div>
        </div>
      </section>

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
            pendingPickupsCount={164}
            topUpServices={storeConfig?.topUpServices}
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-x-hidden max-lg:overflow-y-auto lg:overflow-hidden p-2 sm:p-2.5 gap-2.5">
          {/* LEFT COLUMN: Garment Catalog (Takes all remaining width) */}
          <div
            className="flex-1 min-w-0 flex flex-col min-h-0 rounded-[3px] shadow-2xs overflow-hidden max-lg:min-h-[420px]"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              transition: 'background-color 0.2s ease, border-color 0.2s ease',
            }}
          >
            {/* Per-Piece Dry Cleaning Catalog Header */}
            <div
              className="shrink-0 px-3 py-2 flex items-center justify-between"
              style={{
                background: 'var(--bg-surface-muted, #f8fafc)',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-purple-700 flex items-center gap-1.5">
                  <Sparkles size={13} />
                  <span>Per-Piece Garments (Dry Cleaning)</span>
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-medium">
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

          {/* RIGHT COLUMN: Current Order Panel matching IMAGE 1 */}
          <div
            className="w-full lg:w-[440px] xl:w-[460px] shrink-0 flex flex-col rounded-xl shadow-xs overflow-hidden lg:h-full"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              transition: 'background-color 0.2s ease, border-color 0.2s ease',
            }}
          >
            {/* 1. Panel Header */}
            <div
              className="px-4 pt-4 pb-3 flex items-center justify-between shrink-0"
              style={{ background: 'var(--bg-surface)', transition: 'background-color 0.2s ease' }}
            >
              <div className="flex items-center gap-2.5">
                <ShoppingBag size={22} className="text-[#2563eb]" strokeWidth={2} />
                <h3 className="font-bold text-lg text-slate-900 tracking-tight">Current Order</h3>
                <span className="bg-[#eff6ff] text-[#2563eb] text-xs font-semibold px-2.5 py-0.5 rounded-full border border-[#dbeafe]">
                  {totalGarmentCount} {totalGarmentCount === 1 ? 'item' : 'items'}
                </span>
                <span
                  id="current-order-workflow-badge"
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    activeWorkflow === 'LAUNDRY'
                      ? 'bg-blue-100 text-blue-800 border border-blue-200'
                      : 'bg-purple-100 text-purple-800 border border-purple-200'
                  }`}
                >
                  {activeWorkflow === 'LAUNDRY' ? 'Laundry' : 'Dry Clean'}
                </span>
              </div>

              {items.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setItems([])}
                  className="flex items-center gap-1.5 text-xs font-semibold text-rose-500 hover:text-rose-600 transition-colors cursor-pointer"
                  title="Clear all items from order"
                >
                  <Trash2 size={15} className="text-rose-500" strokeWidth={2} />
                  <span>Clear All</span>
                </button>
              ) : (
                <span className="text-xs font-medium text-slate-400 select-none">Order #NEW</span>
              )}
            </div>

            {/* 2. Added Items List (Compact & Clear Spacing) */}
            <div
              className="flex-1 min-h-0 overflow-y-auto px-3.5 py-2 space-y-2.5"
              style={{ background: 'var(--bg-surface)' }}
            >
              {items.length === 0 ? (
                /* Clean Empty State */
                <div className="flex flex-col items-center justify-center py-12 text-center px-6 text-slate-400 select-none">
                  <div className="w-14 h-14 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center text-slate-400 mb-3 shadow-2xs">
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m7.5 4.27 9 5.15" />
                      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                      <path d="m3.3 7 8.7 5 8.7-5" />
                      <path d="M12 22V12" />
                    </svg>
                  </div>
                  <h4 className="font-bold text-xs text-slate-800 mb-1.5">No items added yet</h4>
                  <p className="text-[11px] text-slate-400 max-w-[210px] leading-relaxed">
                    Select garments from the catalog to add them to this order.
                  </p>
                </div>
              ) : (
                items.map((item, idx) => {
                  const isWb = item.isWeightBased || (item.weight != null && item.weight > 0);
                  const multiplier = isWb ? item.weight : item.quantity;
                  const itemTotal = Math.round(item.unitPrice * multiplier * 100) / 100;
                  const coveredItemPieces = isWb
                    ? item.batchPhotos && item.batchPhotos.length > 0
                      ? 1
                      : 0
                    : (item.pieces || []).filter((p: any) => p.photos && p.photos.length > 0)
                        .length;
                  const totalRequired = isWb ? 1 : item.quantity;
                  const hasDetails =
                    item.defectNotes || item.brand || item.topUpService || coveredItemPieces > 0;

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
                            <span className="font-bold text-sm text-slate-900 truncate leading-snug">
                              {item.garmentName}
                            </span>
                            <span className="font-bold text-sm text-slate-900 whitespace-nowrap font-mono shrink-0">
                              ₹{itemTotal.toFixed(2)}
                            </span>
                          </div>

                          {/* Subtitle row: Service Name + Unit Price combined */}
                          <div className="text-[11.5px] text-slate-500 font-normal mt-0.5 flex items-center gap-1.5 flex-wrap">
                            <span>{item.serviceName}</span>
                            <span>•</span>
                            {isWb ? (
                              <span className="text-blue-700 font-semibold font-mono">
                                {item.weight} kg @ ₹{Number(item.unitPrice).toFixed(2)}/kg
                              </span>
                            ) : (
                              <span>₹{Number(item.unitPrice).toFixed(2)} each</span>
                            )}
                          </div>

                          {/* Optional Defect / Notes Indicator */}
                          {hasDetails && (
                            <div className="mt-1.5 pt-1.5 border-t border-slate-100 flex items-center gap-1.5 flex-wrap text-[11px] text-slate-600">
                              {item.brand && (
                                <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-medium text-[10.5px]">
                                  🏷️ {item.brand}
                                </span>
                              )}
                              {item.defectNotes && (
                                <span
                                  className="bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded truncate max-w-[150px] text-[10.5px]"
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
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                    : isPhotoRequired
                                      ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                                      : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
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

                          {/* Controls Row: Compact & Clean */}
                          <div className="flex items-center justify-between mt-2.5 gap-2">
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
                                className="h-[34px] min-h-[34px] px-3 border border-blue-300 rounded-md bg-blue-50/70 hover:bg-blue-100 text-blue-700 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                                title="Click to edit measured weight"
                              >
                                <Scale size={13} />
                                <span>{item.weight} kg (Edit)</span>
                              </button>
                            ) : (
                              <div
                                className="flex items-center rounded-md shadow-2xs overflow-hidden shrink-0 h-[34px]"
                                style={{
                                  border: '1px solid var(--border)',
                                  background: 'var(--bg-surface)',
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={() => handleUpdateQuantity(idx, -1)}
                                  className="w-8 h-[34px] min-h-[34px] flex items-center justify-center text-slate-600 hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer"
                                  title="Decrease quantity"
                                >
                                  <Minus size={12} strokeWidth={2.5} />
                                </button>
                                <span className="w-8 h-[34px] flex items-center justify-center text-center font-bold text-xs text-slate-900 font-mono select-none">
                                  {item.quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateQuantity(idx, 1)}
                                  className="w-8 h-[34px] min-h-[34px] flex items-center justify-center text-[#2563eb] hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer"
                                  title="Increase quantity"
                                >
                                  <Plus size={12} strokeWidth={2.5} />
                                </button>
                              </div>
                            )}

                            {/* Action Buttons: [ Photos & Notes ] [ Delete ] */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => setEditingItemIndex(idx)}
                                className={`h-[34px] min-h-[34px] px-2.5 text-xs font-semibold rounded-md border transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                                  coveredItemPieces === totalRequired
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                    : isPhotoRequired && coveredItemPieces < totalRequired
                                      ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                                      : hasDetails
                                        ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
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
                                className="w-[34px] h-[34px] min-h-[34px] flex items-center justify-center border border-rose-200/80 rounded-md bg-rose-50/70 text-rose-500 hover:bg-rose-100 hover:text-rose-600 transition-colors cursor-pointer shadow-2xs"
                                title="Delete item"
                              >
                                <Trash2 size={13} strokeWidth={2} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* 3. General Notes Section (Collapsible & Compact) */}
            <div className="px-4 py-1.5 shrink-0">
              {!isNoteOpen && !generalNote.trim() ? (
                <button
                  type="button"
                  id="add-order-note-btn"
                  onClick={() => setIsNoteOpen(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors py-1 px-1.5 rounded hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer group"
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
                      className="p-1 text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 rounded transition-colors cursor-pointer"
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
                      className="p-1 text-slate-400 hover:text-rose-500 rounded transition-colors cursor-pointer"
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
                      className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium px-1.5 py-0.5 rounded cursor-pointer"
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

            {/* 4. Totals Breakdown, Highlighted Total & Proceed Button */}
            <div className="px-4 pt-1 pb-4 space-y-2.5 shrink-0">
              {/* Photos Progress Card & Action (Compact & Space-Optimized) */}
              {items.length > 0 && (
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
                          const isWb = it.isWeightBased || (it.weight != null && it.weight > 0);
                          if (isWb) return !it.batchPhotos || it.batchPhotos.length === 0;
                          const covered = (it.pieces || []).filter(
                            (p: any) => p.photos && p.photos.length > 0,
                          ).length;
                          return covered < it.quantity;
                        });
                        setEditingItemIndex(firstUncoveredIdx >= 0 ? firstUncoveredIdx : 0);
                      }}
                      className={`h-7 px-2.5 rounded text-[11px] font-bold flex items-center gap-1 transition-all shrink-0 cursor-pointer ${
                        allPiecesCovered
                          ? 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs'
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

                  {/* Single-Line Warning Alert strictly in one line */}
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
              )}

              {/* Totals Breakdown */}
              <div className="space-y-1.5 pt-0.5">
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
                <div className="pt-1 pb-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Delivery Speed
                    </span>
                    {storeConfig?.expressSurchargePercent == null && (
                      <span className="text-[10px] text-slate-400">Standard only</span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                    {/* Regular */}
                    <button
                      type="button"
                      id="speed-regular-btn"
                      onClick={() => setDeliverySpeed(ExpressDeliveryOption.REGULAR)}
                      className={`py-1.5 px-2 rounded-md text-center transition-all text-xs font-medium cursor-pointer ${
                        deliverySpeed === ExpressDeliveryOption.REGULAR
                          ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-sm font-semibold'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      <div className="leading-tight">Regular</div>
                      <div className="text-[10px] opacity-75 font-normal">Standard</div>
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
                            : 'Tomorrow / Next-Day Evening Delivery (+1.5× base express)'
                      }
                      className={`py-1.5 px-2 rounded-md text-center transition-all text-xs font-medium cursor-pointer ${
                        storeConfig?.expressSurchargePercent == null || isWednesdayOff
                          ? 'opacity-40 cursor-not-allowed text-slate-400'
                          : deliverySpeed === ExpressDeliveryOption.NEXT_DAY_EVENING
                            ? 'bg-amber-500 text-white shadow-sm font-semibold'
                            : 'text-slate-600 dark:text-slate-400 hover:text-amber-700 dark:hover:text-amber-400'
                      }`}
                    >
                      <div className="leading-tight flex items-center justify-center gap-0.5">
                        <span>⚡</span> Tomorrow
                      </div>
                      <div className="text-[10px] opacity-90 font-mono font-medium">
                        {storeConfig?.expressSurchargePercent != null && subtotal > 0
                          ? `+₹${(((subtotal * storeConfig.expressSurchargePercent) / 100) * 1.5).toFixed(0)}`
                          : '1.5× base'}
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
                            : 'Same-Day Express Delivery (+2.0× base express)'
                      }
                      className={`py-1.5 px-2 rounded-md text-center transition-all text-xs font-medium cursor-pointer ${
                        storeConfig?.expressSurchargePercent == null || isThursdayOff
                          ? 'opacity-40 cursor-not-allowed text-slate-400'
                          : deliverySpeed === ExpressDeliveryOption.SAME_DAY
                            ? 'bg-amber-500 text-white shadow-sm font-semibold'
                            : 'text-slate-600 dark:text-slate-400 hover:text-amber-700 dark:hover:text-amber-400'
                      }`}
                    >
                      <div className="leading-tight flex items-center justify-center gap-0.5">
                        <span>⚡</span> Same Day
                      </div>
                      <div className="text-[10px] opacity-90 font-mono font-medium">
                        {storeConfig?.expressSurchargePercent != null && subtotal > 0
                          ? `+₹${(((subtotal * storeConfig.expressSurchargePercent) / 100) * 2.0).toFixed(0)}`
                          : '2.0× base'}
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
              <div className="border-t border-slate-100" />

              {/* Highlighted Total Box */}
              <div
                className="rounded-lg px-3.5 py-2.5 flex items-center justify-between"
                style={{
                  background: 'var(--accent-muted)',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                  transition: 'background-color 0.2s ease, border-color 0.2s ease',
                }}
              >
                <div>
                  <div
                    className="text-sm font-bold tracking-tight"
                    style={{ color: 'var(--accent)' }}
                  >
                    Total
                  </div>
                  <div
                    className="text-[11px] font-normal mt-0.5"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Inclusive of taxes
                  </div>
                </div>
                <div
                  className="text-xl font-extrabold font-mono tracking-tight pr-1"
                  style={{ color: 'var(--accent)' }}
                >
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
                className={`w-full min-h-[44px] h-[44px] py-2.5 px-4 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-sm ${
                  isSubmitting ||
                  items.length === 0 ||
                  !selectedCustomerId ||
                  (isPhotoRequired && !allPiecesCovered)
                    ? 'bg-[#bfdbfe] text-white cursor-not-allowed opacity-90'
                    : 'bg-[#2563eb] hover:bg-blue-700 text-white cursor-pointer shadow-xs active:scale-[0.99]'
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Top Up Service (Optional)
                </label>
                <input
                  type="text"
                  className="w-full border border-slate-200 rounded-[3px] px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="e.g. Starching, Stain Treatment"
                  value={items[editingItemIndex].topUpService || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setItems((prev) => {
                      const updated = [...prev];
                      updated[editingItemIndex] = {
                        ...updated[editingItemIndex],
                        topUpService: val,
                      };
                      return updated;
                    });
                  }}
                />
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
                <label
                  htmlFor="piece-exception-price-input"
                  className="block text-xs font-bold text-slate-800 mb-1.5"
                >
                  Price Per Piece (₹) <span className="text-rose-500">*</span>
                </label>
                <input
                  id="piece-exception-price-input"
                  type="number"
                  min="0"
                  step="1"
                  value={pieceExceptionModalData.unitPrice}
                  onChange={(e) =>
                    setPieceExceptionModalData((prev) =>
                      prev
                        ? {
                            ...prev,
                            unitPrice: Math.max(0, parseFloat(e.target.value) || 0),
                          }
                        : null,
                    )
                  }
                  className="w-full text-base font-bold font-mono px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {/* Presets */}
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
                          if (isWb) {
                            handleAddBatchPhoto(m.itemIndex, file);
                          } else if (m.unitNumber != null) {
                            handleAddPhotoToPiece(m.itemIndex, m.unitNumber, file);
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
                                if (isWb) {
                                  handleAddBatchPhoto(m.itemIndex, f);
                                } else if (m.unitNumber != null) {
                                  handleAddPhotoToPiece(m.itemIndex, m.unitNumber, f);
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
                            if (isWb) {
                              handleAddBatchPhoto(m.itemIndex, file);
                            } else if (m.unitNumber != null) {
                              handleAddPhotoToPiece(m.itemIndex, m.unitNumber, file);
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
