import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CustomerDTO,
  CreateOrderItemRequest,
  CreateOrderRequest,
  OrderWorkflowType,
  OrderEntryMode,
  PickupType,
  ExpressDeliveryOption,
  GarmentCatalogDTO,
  ServiceTypeDTO,
  GarmentCategory,
  ServiceCategory,
  Role,
  resolveCatalogSelectionOnWorkflowChange,
  resolveCatalogSelectionOnServiceSelect,
  resolveCatalogSelectionOnCategoryChange,
  isItemCompatibleWithWorkflow,
  calculateOrderTotals,
  isDryCleanService,
} from '@growfast/shared-types';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { OrderDraft, saveDraft, queueDraftForSync, generateUUID } from '../../db/drafts';
import { getPhotosForDraft, PendingPhoto } from '../../db/photos';
import { syncEngine } from '../../services/sync-engine';
import { apiClient } from '../../api/client';

// Modular Screen Components
import { CustomerStep } from './CustomerStep';
import { ServiceCategoryStep } from './ServiceCategoryStep';
import { isWeightBasedPricing } from '../../services/catalog-rules';
import { CatalogGridStep } from './CatalogGridStep';
import { ItemDetailsModal } from './ItemDetailsModal';
import { OrderItemsReviewStep } from './OrderItemsReviewStep';
import { FinalReviewStep } from './FinalReviewStep';
import { OrderCreatedStep } from './OrderCreatedStep';

export type WizardStep =
  | 'CUSTOMER' // Screen 3 (Dev C)
  | 'SERVICE_CATEGORY' // Screen 4 (Dev B)
  | 'CATALOG_GRID' // Screen 5 (Dev B)
  | 'ITEMS_REVIEW' // Screen 7 (Dev B)
  | 'FINAL_REVIEW' // Screen 8 (Dev B)
  | 'ORDER_CREATED'; // Screen 9 (Dev B)

const STEPS: { key: WizardStep; label: string }[] = [
  { key: 'CUSTOMER', label: 'Customer' },
  { key: 'SERVICE_CATEGORY', label: 'Services' },
  { key: 'CATALOG_GRID', label: 'Catalog' },
  { key: 'ITEMS_REVIEW', label: 'Cart' },
  { key: 'FINAL_REVIEW', label: 'Review' },
  { key: 'ORDER_CREATED', label: 'Confirmed' },
];

// Offline Fallback Seed Catalog
const FALLBACK_GARMENTS: GarmentCatalogDTO[] = [
  { id: 'cat-shirt', name: 'Shirt / T-Shirt', category: GarmentCategory.MEN, isActive: true },
  { id: 'cat-trousers', name: 'Trousers / Pants', category: GarmentCategory.MEN, isActive: true },
  { id: 'cat-suit', name: '2-Piece Suit', category: GarmentCategory.MEN, isActive: true },
  { id: 'cat-kurta', name: 'Kurta / Pyjama', category: GarmentCategory.MEN, isActive: true },
  { id: 'cat-saree', name: 'Saree (Silk/Cotton)', category: GarmentCategory.WOMEN, isActive: true },
  { id: 'cat-dress', name: 'Dress / Gown', category: GarmentCategory.WOMEN, isActive: true },
  {
    id: 'cat-bedsheet',
    name: 'Bedsheet / Linen',
    category: GarmentCategory.HOUSEHOLD,
    isActive: true,
  },
  {
    id: 'cat-blanket',
    name: 'Blanket / Quilt',
    category: GarmentCategory.HOUSEHOLD,
    isActive: true,
  },
  {
    id: 'g-wb-1',
    name: 'Weight Based Laundry',
    category: GarmentCategory.WEIGHT_BASED,
    isActive: true,
  },
  {
    id: 'cat-kg-wash',
    name: 'Wash & Fold (Per Kg)',
    category: GarmentCategory.WEIGHT_BASED,
    isActive: true,
  },
  {
    id: 'cat-kg-iron',
    name: 'Wash & Iron (Per Kg)',
    category: GarmentCategory.WEIGHT_BASED,
    isActive: true,
  },
];

const FALLBACK_SERVICES: ServiceTypeDTO[] = [
  {
    id: 'svc-wash-iron',
    name: 'Steam Iron',
    category: ServiceCategory.WASH_IRON,
    estimatedDays: 1,
    isActive: true,
  },
  {
    id: 'svc-wash-fold',
    name: 'Wash and Fold',
    category: ServiceCategory.WASH,
    estimatedDays: 2,
    isActive: true,
  },
  {
    id: 'svc-laundry-white',
    name: 'Laundry for White',
    category: ServiceCategory.WASH,
    estimatedDays: 2,
    isActive: true,
  },
  {
    id: 'svc-laundry-premium',
    name: 'Premium Laundry',
    category: ServiceCategory.WASH,
    estimatedDays: 3,
    isActive: true,
  },
  {
    id: 'svc-laundry-woolen',
    name: 'Woolen Laundry',
    category: ServiceCategory.WASH,
    estimatedDays: 3,
    isActive: true,
  },
  {
    id: 'srv-wash-iron',
    name: 'Starching',
    category: ServiceCategory.WASH_IRON,
    estimatedDays: 2,
    isActive: true,
  },
  {
    id: 'srv-dry-clean',
    name: 'Dry Clean',
    category: ServiceCategory.DRY_CLEAN,
    estimatedDays: 3,
    isActive: true,
  },
  {
    id: 'srv-shoe-clean',
    name: 'Shoe Cleaning',
    category: ServiceCategory.SHOE_CLEAN,
    estimatedDays: 3,
    isActive: true,
  },
];

const FALLBACK_PRICES = [
  { garmentCatalogId: 'cat-shirt', serviceTypeId: 'srv-wash-iron', price: 40 },
  { garmentCatalogId: 'cat-shirt', serviceTypeId: 'srv-dry-clean', price: 80 },
  { garmentCatalogId: 'cat-shirt', serviceTypeId: 'srv-steam-press', price: 25 },
  { garmentCatalogId: 'cat-trousers', serviceTypeId: 'srv-wash-iron', price: 50 },
  { garmentCatalogId: 'cat-trousers', serviceTypeId: 'srv-dry-clean', price: 90 },
  { garmentCatalogId: 'cat-suit', serviceTypeId: 'srv-dry-clean', price: 250 },
  { garmentCatalogId: 'cat-saree', serviceTypeId: 'srv-dry-clean', price: 180 },
  { garmentCatalogId: 'cat-saree', serviceTypeId: 'srv-wash-iron', price: 100 },
  { garmentCatalogId: 'cat-bedsheet', serviceTypeId: 'srv-wash-iron', price: 90 },
  { garmentCatalogId: 'cat-blanket', serviceTypeId: 'srv-dry-clean', price: 200 },
  { garmentCatalogId: 'cat-kg-wash', serviceTypeId: 'svc-wash-fold', price: 80 },
  { garmentCatalogId: 'cat-kg-iron', serviceTypeId: 'svc-wash-iron', price: 95 },
  { garmentCatalogId: 'g-wb-1', serviceTypeId: 'svc-wash-iron', price: 95 },
  { garmentCatalogId: 'g-wb-1', serviceTypeId: 'svc-wash-fold', price: 80 },
  { garmentCatalogId: 'g-wb-1', serviceTypeId: 'svc-laundry-white', price: 110 },
  { garmentCatalogId: 'g-wb-1', serviceTypeId: 'svc-laundry-premium', price: 120 },
  { garmentCatalogId: 'g-wb-1', serviceTypeId: 'svc-laundry-woolen', price: 140 },
  { garmentCatalogId: 'g-wb-1', serviceTypeId: 'srv-wash-iron', price: 95 },
];

interface OrderWizardModalProps {
  visible: boolean;
  draft: OrderDraft | null;
  initialCustomer?: CustomerDTO | null;
  initialEntryMode?: OrderEntryMode;
  initialWorkflow?: OrderWorkflowType;
  storeId: string;
  userRole?: string;
  onClose: () => void;
  onOrderSavedOrSubmitted: () => void;
  onViewOrderDetail?: (orderId: string) => void;
}

export function OrderWizardModal({
  visible,
  draft,
  initialCustomer,
  initialEntryMode = 'PIECES',
  initialWorkflow = 'LAUNDRY',
  storeId,
  userRole,
  onClose,
  onOrderSavedOrSubmitted,
  onViewOrderDetail,
}: OrderWizardModalProps) {
  const { isConnected } = useNetworkStatus();
  const canModifyPrice = userRole === Role.OWNER || userRole === Role.MANAGER;

  // Safe Area insets (respects Android status bar, cutouts, notches, and navigation bar)
  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0,
  );

  // Wizard Navigation
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Form State
  const [clientDraftId, setClientDraftId] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDTO | null>(null);
  const [manualCustomerName, setManualCustomerName] = useState('');
  const [manualCustomerPhone, setManualCustomerPhone] = useState('');
  const [workflow, setWorkflow] = useState<OrderWorkflowType>('LAUNDRY');
  const [entryMode, setEntryMode] = useState<OrderEntryMode>('PIECES');
  const [selectedServiceId, setSelectedServiceId] = useState('srv-wash-iron');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [items, setItems] = useState<CreateOrderItemRequest[]>([]);
  const [pickupType, setPickupType] = useState<PickupType>(PickupType.STORE_PICKUP);
  const [expressOption, setExpressOption] = useState<ExpressDeliveryOption>(
    ExpressDeliveryOption.REGULAR,
  );
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [storeConfig, setStoreConfig] = useState<{
    expressSurchargePercent?: number | null;
  } | null>(null);

  // Catalog Data
  const [garments, setGarments] = useState<GarmentCatalogDTO[]>(FALLBACK_GARMENTS);
  const [services, setServices] = useState<ServiceTypeDTO[]>(FALLBACK_SERVICES);
  const [prices, setPrices] = useState<any[]>(FALLBACK_PRICES);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);

  // Item Details Modal State (Screen 6)
  const [itemConfigModalVisible, setItemConfigModalVisible] = useState(false);
  const [configuringGarment, setConfiguringGarment] = useState<GarmentCatalogDTO | null>(null);
  const [configuringExistingIndex, setConfiguringExistingIndex] = useState<number | undefined>(
    undefined,
  );
  const [configuringInitialItem, setConfiguringInitialItem] =
    useState<CreateOrderItemRequest | null>(null);

  // Confirmed Order State (Screen 9)
  const [confirmedOrder, setConfirmedOrder] = useState<{
    orderId: string;
    orderNumber: string;
    isOfflineQueued?: boolean;
  } | null>(null);

  // Fetch catalog & store config (Stale-while-revalidate)
  useEffect(() => {
    if (visible && isConnected) {
      const hasCatalog = garments !== FALLBACK_GARMENTS && garments.length > 0;
      if (!hasCatalog) {
        setIsLoadingCatalog(true);
      }
      Promise.all([
        apiClient.catalog.getGarments().catch(() => FALLBACK_GARMENTS),
        apiClient.catalog.getServices().catch(() => FALLBACK_SERVICES),
        apiClient.catalog.getPricing().catch(() => FALLBACK_PRICES),
        apiClient.store.getConfig().catch(() => null),
      ])
        .then(([gRes, sRes, pRes, cfgRes]) => {
          if (gRes && gRes.length > 0) setGarments(gRes);
          if (sRes && sRes.length > 0) setServices(sRes);
          if (pRes && pRes.length > 0) setPrices(pRes);
          if (cfgRes) setStoreConfig(cfgRes);
        })
        .finally(() => setIsLoadingCatalog(false));
    }
  }, [visible, isConnected]);

  // Initialize or restore state when modal becomes visible
  useEffect(() => {
    if (visible) {
      if (draft) {
        setClientDraftId(draft.clientDraftId);
        setManualCustomerName(draft.customerName || '');
        setManualCustomerPhone(draft.customerPhone || '');
        if (draft.customerId && draft.customerId !== 'cust-offline-temp') {
          setSelectedCustomer({
            id: draft.customerId,
            name: draft.customerName || '',
            phone: draft.customerPhone || '',
            email: null,
            address: null,
            pincode: null,
            membership: 'NONE' as any,
            discountPercent: 0,
            preferences: null,
            registrationSource: 'MOBILE_APP',
            createdAt: draft.createdAt,
            updatedAt: draft.updatedAt,
          });
        } else {
          setSelectedCustomer(null);
        }

        setWorkflow((draft.workflowType as OrderWorkflowType) || 'LAUNDRY');
        setPickupType((draft.pickupType as PickupType) || PickupType.STORE_PICKUP);
        setExpressOption(
          draft.payload?.expressDeliveryOption ||
            (draft.isExpress ? ExpressDeliveryOption.SAME_DAY : ExpressDeliveryOption.REGULAR),
        );
        setNotes(draft.notes || '');
        setItems(draft.payload?.items || []);
        getPhotosForDraft(draft.clientDraftId).then(setPhotos);
        setConfirmedOrder(null);
        setCurrentStepIndex(draft.payload?.items && draft.payload.items.length > 0 ? 3 : 0);
      } else {
        // Fresh draft
        const newDraftId = generateUUID();
        setClientDraftId(newDraftId);
        if (initialCustomer) {
          setSelectedCustomer(initialCustomer);
          setManualCustomerName(initialCustomer.name);
          setManualCustomerPhone(initialCustomer.phone);
          setCurrentStepIndex(1);
        } else {
          setSelectedCustomer(null);
          setManualCustomerName('');
          setManualCustomerPhone('');
          setCurrentStepIndex(0);
        }
        const targetMode = initialEntryMode || 'PIECES';
        const targetWorkflow = initialWorkflow || 'LAUNDRY';
        setWorkflow(targetWorkflow);
        setEntryMode(targetMode);
        if (targetWorkflow === 'DRY_CLEANING') {
          setSelectedCategory('ALL');
          const dryCleanSvc = services.find(
            (s) => s.category === ServiceCategory.DRY_CLEAN || s.id === 'srv-dry-clean',
          );
          setSelectedServiceId(dryCleanSvc ? dryCleanSvc.id : 'srv-dry-clean');
        } else if (targetMode === 'WEIGHT') {
          setSelectedCategory(GarmentCategory.WEIGHT_BASED);
          setSelectedServiceId('srv-premium-wash');
        } else {
          setSelectedCategory('ALL');
          setSelectedServiceId('srv-wash-iron');
        }
        setItems([]);
        setPickupType(PickupType.STORE_PICKUP);
        setExpressOption(ExpressDeliveryOption.REGULAR);
        setNotes('');
        setPhotos([]);
        setConfirmedOrder(null);
      }
    }
  }, [visible, draft, initialCustomer, initialEntryMode]);

  const refreshPhotos = useCallback(async () => {
    if (clientDraftId) {
      const updated = await getPhotosForDraft(clientDraftId);
      setPhotos(updated);
    }
  }, [clientDraftId]);

  // Build canonical CreateOrderRequest payload
  const buildOrderPayload = (): CreateOrderRequest => {
    const isExpress = expressOption !== ExpressDeliveryOption.REGULAR;
    return {
      clientDraftId,
      customerId: selectedCustomer?.id || draft?.customerId || 'cust-offline-temp',
      isExpress,
      expressDeliveryOption: expressOption,
      pickupType,
      workflow,
      entryMode,
      notes: notes.trim() || undefined,
      items: items.map((item) => {
        const pieceCount = item.quantity || 1;
        const pieces =
          item.pieces && item.pieces.length === pieceCount
            ? item.pieces
            : Array.from({ length: pieceCount }, (_, i) => ({
                unitNumber: i + 1,
                photoCount: photos.filter((p) => p.garmentId === item.garmentCatalogId).length,
              }));
        return {
          ...item,
          pieces,
        };
      }),
    };
  };

  // Persist draft to SQLite
  const persistDraftToStorage = async (statusOverride?: 'DRAFT' | 'QUEUED') => {
    const payload = buildOrderPayload();
    const custName = selectedCustomer?.name || manualCustomerName.trim() || null;
    const custPhone = selectedCustomer?.phone || manualCustomerPhone.trim() || null;

    await saveDraft({
      clientDraftId,
      storeId,
      customerId: selectedCustomer?.id || null,
      customerName: custName,
      customerPhone: custPhone,
      workflowType: workflow,
      pickupType,
      isExpress: expressOption !== ExpressDeliveryOption.REGULAR,
      notes: notes.trim() || null,
      payload,
    });
  };

  // Step Validation
  const validateStep = (stepIdx: number): boolean => {
    if (stepIdx === 0) {
      // Screen 3: Customer step
      if (!selectedCustomer && !manualCustomerName.trim()) {
        Alert.alert(
          'Customer Required',
          'Please select an existing customer or enter customer details.',
        );
        return false;
      }
      if (
        !selectedCustomer &&
        (!manualCustomerPhone.trim() || manualCustomerPhone.replace(/\D/g, '').length < 10)
      ) {
        Alert.alert('Phone Required', 'Please provide a valid 10-digit mobile number.');
        return false;
      }
    } else if (stepIdx === 2 || stepIdx === 3) {
      // Catalog & Items Review step
      if (items.length === 0) {
        Alert.alert('Items Required', 'Please add at least one garment or laundry item.');
        return false;
      }
    }
    return true;
  };

  const handleNext = async () => {
    if (!validateStep(currentStepIndex)) return;

    try {
      await persistDraftToStorage();
    } catch (err: any) {
      console.warn('Draft auto-save notice:', err.message);
    }

    if (currentStepIndex < STEPS.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };

  const handleBack = async () => {
    try {
      await persistDraftToStorage();
    } catch (err: any) {
      console.warn('Draft auto-save notice:', err.message);
    }

    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    } else {
      onClose();
    }
  };

  // Quick add item from catalog
  const handleQuickAddItem = (garment: GarmentCatalogDTO, serviceId: string, unitPrice: number) => {
    const existingIndex = items.findIndex(
      (it) => it.garmentCatalogId === garment.id && it.serviceTypeId === serviceId,
    );

    if (existingIndex >= 0) {
      const updated = [...items];
      const target = { ...updated[existingIndex] };
      target.quantity = (target.quantity || 1) + 1;
      updated[existingIndex] = target;
      setItems(updated);
    } else {
      const newItem: CreateOrderItemRequest = {
        garmentCatalogId: garment.id,
        serviceTypeId: serviceId,
        quantity: 1,
        unitPrice,
        pieces: [{ unitNumber: 1, photoCount: 0 }],
      };
      setItems([...items, newItem]);
    }
  };

  // Quick decrement item from catalog
  const handleQuickDecrementItem = (garmentId: string) => {
    const existingIndex = items.findIndex((it) => it.garmentCatalogId === garmentId);
    if (existingIndex >= 0) {
      const target = items[existingIndex];
      if ((target.quantity || 1) > 1) {
        const updated = [...items];
        updated[existingIndex] = { ...target, quantity: (target.quantity || 1) - 1 };
        setItems(updated);
      } else {
        setItems(items.filter((_, idx) => idx !== existingIndex));
      }
    }
  };

  // Open item configuration modal (Screen 6)
  const handleOpenItemConfig = (garment: GarmentCatalogDTO, existingIndex?: number) => {
    setConfiguringGarment(garment);
    setConfiguringExistingIndex(existingIndex);
    setConfiguringInitialItem(existingIndex != null ? items[existingIndex] : null);
    setItemConfigModalVisible(true);
  };

  // Save item from ItemDetailsModal
  const handleSaveConfiguredItem = (item: CreateOrderItemRequest, existingIndex?: number) => {
    if (existingIndex != null && existingIndex >= 0) {
      const updated = [...items];
      updated[existingIndex] = item;
      setItems(updated);
    } else {
      setItems([...items, item]);
    }
  };

  // Delete item from cart
  const handleRemoveCartItem = (index: number) => {
    setItems(items.filter((_, idx) => idx !== index));
  };

  // Order Mode switch handler: reconciles entryMode, workflow, service, category, and safely handles incompatible items
  const handleEntryModeChange = (newMode: OrderEntryMode) => {
    if (newMode === entryMode) return;

    // Check for incompatible items in current cart:
    // In WEIGHT mode, items without weight are incompatible.
    // In PIECES mode, items with weight are incompatible.
    const incompatible = items.filter((item) => {
      const isItemWeight = Boolean(item.weight != null && item.weight > 0);
      return newMode === 'WEIGHT' ? !isItemWeight : isItemWeight;
    });

    const executeModeSwitch = () => {
      setEntryMode(newMode);
      if (newMode === 'WEIGHT') {
        setWorkflow('LAUNDRY');
        const firstWeightSvc = services.find(
          (s) =>
            s.id === 'svc-wash-iron' ||
            s.id === 'srv-wash-iron' ||
            s.name.toLowerCase().includes('wash and steam iron') ||
            s.name.toLowerCase().includes('steam iron'),
        );
        setSelectedServiceId(firstWeightSvc?.id || 'svc-wash-iron');
        setSelectedCategory(GarmentCategory.WEIGHT_BASED);
      } else {
        // Per-Piece mode: select first per-piece service
        const firstPieceSvc = services.find((s) => {
          if (!s.isActive) return false;
          const lower = s.name.toLowerCase();
          return (
            !lower.includes('wash and fold') &&
            !lower.includes('white') &&
            !lower.includes('premium') &&
            !lower.includes('woolen') &&
            !lower.includes('free shoe')
          );
        });
        const targetSvcId = firstPieceSvc?.id || 'srv-wash-iron';
        setSelectedServiceId(targetSvcId);
        setSelectedCategory('ALL');
        const isDc = firstPieceSvc ? isDryCleanService(firstPieceSvc.id, services) : false;
        setWorkflow(isDc ? 'DRY_CLEANING' : 'LAUNDRY');
      }

      if (incompatible.length > 0) {
        setItems((prev) =>
          prev.filter((item) => {
            const isItemWeight = Boolean(item.weight != null && item.weight > 0);
            return newMode === 'WEIGHT' ? isItemWeight : !isItemWeight;
          }),
        );
      }
    };

    if (incompatible.length > 0) {
      Alert.alert(
        'Switch Order Mode',
        `Switching to ${newMode === 'WEIGHT' ? 'Per-Weight' : 'Per-Piece'} will remove ${incompatible.length} incompatible item(s) from your order. Continue?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Switch & Remove', style: 'destructive', onPress: executeModeSwitch },
        ],
      );
    } else {
      executeModeSwitch();
    }
  };

  // Workflow switch handler: reconciles service, category, entryMode, and handles incompatible items
  const handleWorkflowChange = (newWorkflow: OrderWorkflowType) => {
    if (newWorkflow === workflow) return;

    const incompatible = items.filter(
      (item) => !isItemCompatibleWithWorkflow(item, newWorkflow, services),
    );

    const executeWorkflowSwitch = () => {
      const resolved = resolveCatalogSelectionOnWorkflowChange(
        newWorkflow,
        selectedServiceId,
        selectedCategory,
        services,
      );
      setWorkflow(newWorkflow);
      setSelectedServiceId(resolved.serviceId);
      setSelectedCategory(String(resolved.category));

      const newSvc = services.find((s) => s.id === resolved.serviceId);
      const isWeight = isWeightBasedPricing(newWorkflow, newSvc);
      setEntryMode(isWeight ? 'WEIGHT' : 'PIECES');

      if (incompatible.length > 0) {
        setItems((prev) =>
          prev.filter((item) => isItemCompatibleWithWorkflow(item, newWorkflow, services)),
        );
      }
    };

    if (incompatible.length > 0) {
      Alert.alert(
        'Switch Processing Track',
        `Switching to ${newWorkflow === 'DRY_CLEANING' ? 'Dry Cleaning' : 'Laundry'} will remove ${incompatible.length} incompatible item(s) from your order. Continue?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Switch & Remove', style: 'destructive', onPress: executeWorkflowSwitch },
        ],
      );
    } else {
      executeWorkflowSwitch();
    }
  };

  // Service selection handler: enforces service selection rules and reconciles category/entryMode
  const handleSelectService = (newServiceId: string) => {
    setSelectedServiceId(newServiceId);
    const svc = services.find((s) => s.id === newServiceId);
    if (svc) {
      if (entryMode === 'WEIGHT') {
        setWorkflow('LAUNDRY');
        setSelectedCategory(GarmentCategory.WEIGHT_BASED);
      } else {
        const isDc = isDryCleanService(svc.id, services);
        const targetWorkflow: OrderWorkflowType = isDc ? 'DRY_CLEANING' : 'LAUNDRY';
        setWorkflow(targetWorkflow);
        const resolved = resolveCatalogSelectionOnServiceSelect(
          newServiceId,
          selectedCategory,
          services,
          targetWorkflow,
        );
        if (resolved.category) {
          setSelectedCategory(String(resolved.category));
        }
      }
    }
  };

  // Category selection handler: updates category and reconciles service constraints
  const handleSelectCategory = (newCat: string) => {
    const resolvedServiceId = resolveCatalogSelectionOnCategoryChange(
      newCat,
      selectedServiceId,
      services,
      workflow,
    );
    setSelectedCategory(newCat);
    if (resolvedServiceId !== selectedServiceId) {
      setSelectedServiceId(resolvedServiceId);
    }
  };

  // Direct quantity update from review screen (Workstream 2)
  const handleUpdateItemQuantity = (index: number, newQty: number) => {
    if (index < 0 || index >= items.length) return;
    if (newQty <= 0) {
      handleRemoveCartItem(index);
      return;
    }
    const updated = [...items];
    const target = { ...updated[index] };
    target.quantity = newQty;
    // Keep pieces array synchronized
    target.pieces = Array.from({ length: newQty }, (_, i) => ({
      unitNumber: i + 1,
      photoCount: photos.filter((p) => p.garmentId === target.garmentCatalogId).length,
    }));
    updated[index] = target;
    setItems(updated);
  };

  // Submit order to server
  const handleSubmitOrder = async () => {
    await persistDraftToStorage('QUEUED');
    await queueDraftForSync(clientDraftId);

    if (isConnected) {
      const syncResult = await syncEngine.syncDraft(clientDraftId);
      if (syncResult.success) {
        onOrderSavedOrSubmitted();
        return {
          success: true,
          orderId: syncResult.orderId,
          orderNumber: syncResult.orderNumber,
        };
      } else if (syncResult.isConflict) {
        return {
          success: false,
          isConflict: true,
          error: syncResult.error,
        };
      } else {
        return {
          success: false,
          error: syncResult.error || 'Server rejected order submission.',
        };
      }
    } else {
      onOrderSavedOrSubmitted();
      return {
        success: false,
        error: 'Order queued offline in local storage.',
      };
    }
  };

  // Handle successful order creation (Screen 9)
  const handleOrderCreatedSuccess = (order: { orderId: string; orderNumber: string }) => {
    setConfirmedOrder({
      orderId: order.orderId,
      orderNumber: order.orderNumber,
      isOfflineQueued: order.orderId === 'offline-queued',
    });
    setCurrentStepIndex(5); // Jump directly to Screen 9 (ORDER_CREATED)
  };

  // Create another order reset
  const handleCreateAnotherOrder = () => {
    const newDraftId = generateUUID();
    setClientDraftId(newDraftId);
    setSelectedCustomer(null);
    setManualCustomerName('');
    setManualCustomerPhone('');
    setWorkflow('LAUNDRY');
    setEntryMode('PIECES');
    setSelectedServiceId(services[0]?.id || 'srv-wash-iron');
    setSelectedCategory('ALL');
    setItems([]);
    setPickupType(PickupType.STORE_PICKUP);
    setExpressOption(ExpressDeliveryOption.REGULAR);
    setNotes('');
    setPhotos([]);
    setConfirmedOrder(null);
    setCurrentStepIndex(0);
  };

  const isExpress = expressOption !== ExpressDeliveryOption.REGULAR;
  const effectiveSurchargeRate =
    storeConfig?.expressSurchargePercent != null ? storeConfig.expressSurchargePercent : 50;
  const discountPercent = selectedCustomer?.discountPercent || 0;

  const orderTotals = useMemo(() => {
    const pricingItems = items.map((it) => ({
      quantity: it.quantity || 1,
      unitPrice: it.unitPrice || 0,
      weight: it.weight ?? null,
    }));
    return calculateOrderTotals(pricingItems, {
      isExpress,
      expressSurchargePercent: isExpress ? effectiveSurchargeRate : undefined,
      expressDeliveryOption: expressOption,
      discountPercent,
    });
  }, [items, isExpress, effectiveSurchargeRate, expressOption, discountPercent]);

  const itemsSummaryList = useMemo(() => {
    return items.map((it) => {
      const g = garments.find((gar) => gar.id === it.garmentCatalogId);
      const s = services.find((svc) => svc.id === it.serviceTypeId);
      const mult = it.weight && it.weight > 0 ? it.weight : it.quantity || 1;
      return {
        garmentName: g?.name || 'Garment Item',
        serviceName: s?.name || 'Service',
        quantity: it.quantity || 1,
        weight: it.weight ?? null,
        unitPrice: it.unitPrice || 0,
        lineTotal: (it.unitPrice || 0) * mult,
      };
    });
  }, [items, garments, services]);

  const currentStep = STEPS[currentStepIndex];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={[styles.safeContainer, { paddingTop: topInset, paddingBottom: insets.bottom }]}>
        {/* Header Bar */}
        <View style={styles.header}>
          {currentStepIndex !== 5 ? (
            <TouchableOpacity
              style={styles.headerBackBtn}
              onPress={handleBack}
              accessible={true}
              accessibilityLabel="Go back or cancel"
            >
              <Text style={styles.headerBackText}>
                {currentStepIndex === 0 ? '✕ Cancel' : '‹ Back'}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 60 }} />
          )}

          <Text style={styles.headerTitle}>
            {currentStepIndex === 5
              ? 'Order Confirmation'
              : draft
                ? 'Edit Order Draft'
                : 'New Mobile Order'}
          </Text>

          <View style={styles.headerRightSpacer} />
        </View>

        {/* Step Progress Segment Bar */}
        {currentStepIndex !== 5 && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBarRow}>
              {STEPS.slice(0, 5).map((step, idx) => (
                <View
                  key={step.key}
                  style={[
                    styles.progressSegment,
                    idx <= currentStepIndex
                      ? styles.progressSegmentFilled
                      : styles.progressSegmentEmpty,
                  ]}
                />
              ))}
            </View>
            <View style={styles.stepLabelsRow}>
              {STEPS.slice(0, 5).map((step, idx) => (
                <Text
                  key={step.key}
                  style={[
                    styles.stepLabelText,
                    idx === currentStepIndex && styles.stepLabelTextActive,
                  ]}
                >
                  {step.label}
                </Text>
              ))}
            </View>
          </View>
        )}

        {/* Step Body Component */}
        <View style={styles.body}>
          {/* STEP 0: Customer (Screen 3 - Dev C) */}
          {currentStepIndex === 0 && (
            <View style={{ flex: 1 }}>
              <CustomerStep
                selectedCustomer={selectedCustomer}
                onSelectCustomer={(c) => setSelectedCustomer(c)}
                onClearCustomer={() => setSelectedCustomer(null)}
                manualCustomerName={manualCustomerName}
                manualCustomerPhone={manualCustomerPhone}
                onChangeManualDetails={(name, phone) => {
                  setManualCustomerName(name);
                  setManualCustomerPhone(phone);
                }}
                isConnected={isConnected}
              />
              <View style={styles.customerFooter}>
                <TouchableOpacity
                  style={[
                    styles.customerNextBtn,
                    !selectedCustomer && !manualCustomerPhone && styles.customerNextBtnDisabled,
                  ]}
                  onPress={handleNext}
                  disabled={!selectedCustomer && !manualCustomerPhone}
                  accessible={true}
                  accessibilityLabel="Proceed to Services"
                >
                  <Text style={styles.customerNextBtnText}>Continue to Services ›</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* STEP 1: Service & Category Selection (Screen 4 - Dev B) */}
          {currentStepIndex === 1 && (
            <ServiceCategoryStep
              workflow={workflow}
              onWorkflowChange={handleWorkflowChange}
              selectedServiceId={selectedServiceId}
              onSelectService={handleSelectService}
              selectedCategory={selectedCategory}
              onSelectCategory={handleSelectCategory}
              services={services}
              isLoadingServices={isLoadingCatalog}
              cartItemCount={items.length}
              onContinue={handleNext}
              entryMode={entryMode}
              onEntryModeChange={handleEntryModeChange}
            />
          )}

          {/* STEP 2: Garment Catalog Grid (Screen 5 - Dev B) */}
          {currentStepIndex === 2 && (
            <CatalogGridStep
              workflow={workflow}
              entryMode={entryMode}
              garments={garments}
              services={services}
              prices={prices}
              selectedServiceId={selectedServiceId}
              selectedCategory={selectedCategory}
              onCategoryChange={handleSelectCategory}
              items={items}
              onOpenItemConfig={handleOpenItemConfig}
              onQuickAddItem={handleQuickAddItem}
              onQuickDecrementItem={handleQuickDecrementItem}
              onAddWeightItem={(weightItem) => setItems((prev) => [...prev, weightItem])}
              onRemoveItem={handleRemoveCartItem}
              onProceedToReview={() => setCurrentStepIndex(3)}
              onBackToService={() => setCurrentStepIndex(1)}
              isLoadingCatalog={isLoadingCatalog}
              clientDraftId={clientDraftId}
              photos={photos}
              onRefreshPhotos={refreshPhotos}
            />
          )}

          {/* STEP 3: Order Items Review & Line Totals (Screen 7 - Dev B) */}
          {currentStepIndex === 3 && (
            <OrderItemsReviewStep
              items={items}
              garments={garments}
              services={services}
              photos={photos}
              onEditItem={(idx) => {
                const it = items[idx];
                const g = garments.find((item) => item.id === it.garmentCatalogId) || {
                  id: it.garmentCatalogId,
                  name: 'Garment Item',
                  category: it.weight ? GarmentCategory.WEIGHT_BASED : GarmentCategory.MEN,
                  isActive: true,
                };
                handleOpenItemConfig(g, idx);
              }}
              onRemoveItem={handleRemoveCartItem}
              onAddMoreItems={() => setCurrentStepIndex(2)}
              onContinueToFinalReview={handleNext}
              onUpdateItemQuantity={handleUpdateItemQuantity}
            />
          )}

          {/* STEP 4: Final Order Review (Screen 8 - Dev B) */}
          {currentStepIndex === 4 && (
            <FinalReviewStep
              clientDraftId={clientDraftId}
              customer={selectedCustomer}
              manualCustomerName={manualCustomerName}
              manualCustomerPhone={manualCustomerPhone}
              workflow={workflow}
              pickupType={pickupType}
              onPickupTypeChange={setPickupType}
              expressOption={expressOption}
              onExpressOptionChange={setExpressOption}
              items={items}
              garments={garments}
              services={services}
              notes={notes}
              onNotesChange={setNotes}
              photos={photos}
              isConnected={isConnected}
              storeConfig={storeConfig}
              onSaveDraft={persistDraftToStorage}
              onSubmitOrder={handleSubmitOrder}
              onOrderSuccess={handleOrderCreatedSuccess}
            />
          )}

          {/* STEP 5: Order Created & Confirmed (Screen 9 - Dev B) */}
          {currentStepIndex === 5 && confirmedOrder && (
            <OrderCreatedStep
              orderId={confirmedOrder.orderId}
              orderNumber={confirmedOrder.orderNumber}
              isOfflineQueued={Boolean(confirmedOrder.isOfflineQueued)}
              totalPieces={items.reduce((s, it) => s + (it.quantity || 1), 0)}
              totalAmount={orderTotals.totalAmount}
              subtotal={orderTotals.subtotal}
              discountAmount={orderTotals.discountAmount}
              expressSurcharge={orderTotals.expressSurcharge}
              taxAmount={orderTotals.taxAmount}
              customerName={selectedCustomer?.name || manualCustomerName}
              customerPhone={selectedCustomer?.phone || manualCustomerPhone}
              customerAddress={selectedCustomer?.address}
              itemsList={itemsSummaryList}
              paymentStatus="PENDING"
              amountDue={orderTotals.totalAmount}
              onViewOrder={(orderId) => {
                onClose();
                onViewOrderDetail?.(orderId);
              }}
              onCreateAnotherOrder={handleCreateAnotherOrder}
              onDone={() => {
                onClose();
                onOrderSavedOrSubmitted();
              }}
            />
          )}
        </View>

        {/* Modal: Item Details, Defect Notes & Photos (Screen 6 - Dev B) */}
        {configuringGarment && (
          <ItemDetailsModal
            visible={itemConfigModalVisible}
            clientDraftId={clientDraftId}
            garment={configuringGarment}
            service={services.find((s) => s.id === selectedServiceId) || services[0] || null}
            unitPrice={
              prices.find(
                (p) =>
                  (p.garmentCatalogId === configuringGarment.id ||
                    p.garmentId === configuringGarment.id) &&
                  (p.serviceTypeId === selectedServiceId || p.serviceId === selectedServiceId),
              )?.price || 50
            }
            existingItemIndex={configuringExistingIndex}
            initialItem={configuringInitialItem}
            canModifyPrice={canModifyPrice}
            onSaveItem={handleSaveConfiguredItem}
            onClose={() => {
              setItemConfigModalVisible(false);
              setConfiguringGarment(null);
            }}
            onPhotosUpdated={refreshPhotos}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  headerBackBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    minHeight: 40,
    justifyContent: 'center',
  },
  headerBackText: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  headerRightSpacer: {
    width: 60,
  },
  progressContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  progressBarRow: {
    flexDirection: 'row',
    gap: 6,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  progressSegmentFilled: {
    backgroundColor: '#2563eb',
  },
  progressSegmentEmpty: {
    backgroundColor: '#e2e8f0',
  },
  stepLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  stepLabelText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94a3b8',
  },
  stepLabelTextActive: {
    color: '#2563eb',
    fontWeight: '700',
  },
  body: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  customerFooter: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  customerNextBtn: {
    backgroundColor: '#2563eb',
    minHeight: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerNextBtnDisabled: {
    backgroundColor: '#94a3b8',
  },
  customerNextBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
