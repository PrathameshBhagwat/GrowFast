import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Platform,
  Modal,
  Image,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  GarmentCatalogDTO,
  ServiceTypeDTO,
  GarmentCategory,
  OrderWorkflowType,
  OrderEntryMode,
  CreateOrderItemRequest,
  formatCatalogServiceName,
  filterCategoriesForService,
  isCategoryAllowedInWorkflow,
  isWeightBasedCategory,
  DEFAULT_TOP_UP_SERVICES,
  TopUpServiceItem,
  PhotoType,
  roundCurrency,
} from '@growfast/shared-types';
import { isWeightBasedPricing } from '../../services/catalog-rules';
import { PendingPhoto, savePhotoLocally, deletePhoto } from '../../db/photos';
import { generateUUID } from '../../db/drafts';

export interface CatalogGridStepProps {
  workflow?: OrderWorkflowType;
  entryMode?: OrderEntryMode;
  garments: GarmentCatalogDTO[];
  services: ServiceTypeDTO[];
  prices: {
    garmentCatalogId?: string;
    garmentId?: string;
    serviceTypeId?: string;
    serviceId?: string;
    price: number;
  }[];
  selectedServiceId: string;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  items: CreateOrderItemRequest[];
  onOpenItemConfig: (garment: GarmentCatalogDTO, existingItemIndex?: number) => void;
  onQuickAddItem: (garment: GarmentCatalogDTO, serviceId: string, price: number) => void;
  onQuickDecrementItem: (garmentId: string) => void;
  onAddWeightItem?: (item: CreateOrderItemRequest) => void;
  onRemoveItem?: (index: number) => void;
  onProceedToReview: () => void;
  onBackToService: () => void;
  isLoadingCatalog?: boolean;
  clientDraftId?: string;
  photos?: PendingPhoto[];
  onRefreshPhotos?: () => Promise<void>;
  onOpenPieceException?: (garment: GarmentCatalogDTO, serviceId: string, unitPrice: number) => void;
}

const DEFAULT_CATEGORY_TABS: { key: string; label: string }[] = [
  { key: 'ALL', label: 'All Items' },
  { key: GarmentCategory.MEN, label: 'Men' },
  { key: GarmentCategory.WOMEN, label: 'Women' },
  { key: GarmentCategory.KIDS, label: 'Kids' },
  { key: GarmentCategory.HOUSEHOLD, label: 'Household' },
  { key: GarmentCategory.SHOES, label: 'Shoe' },
  { key: GarmentCategory.SPECIAL, label: 'Special' },
  { key: GarmentCategory.OTHERS, label: 'Other' },
  { key: GarmentCategory.WEIGHT_BASED, label: 'Weight Based (Exception)' },
];

export const CATEGORY_TABS = DEFAULT_CATEGORY_TABS;

const DEFECT_QUICK_TAGS = [
  'Collar Stain',
  'Torn Hem',
  'Missing Button',
  'Color Bleed',
  'Faded Fabric',
];

interface LocalWeightPhoto {
  id: string;
  uri: string;
}

export function CatalogGridStep({
  workflow = 'LAUNDRY',
  entryMode,
  garments,
  services,
  prices,
  selectedServiceId,
  selectedCategory,
  onCategoryChange,
  items,
  onOpenItemConfig,
  onQuickAddItem,
  onQuickDecrementItem,
  onAddWeightItem,
  onRemoveItem,
  onProceedToReview,
  onBackToService,
  isLoadingCatalog = false,
  clientDraftId,
  photos = [],
  onRefreshPhotos,
  onOpenPieceException,
}: CatalogGridStepProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Dynamically build category tabs from defaults and active catalog items
  const dynamicCategoryTabs = useMemo(() => {
    const list = [...DEFAULT_CATEGORY_TABS];
    if (garments && garments.length > 0) {
      for (const g of garments) {
        if (!g.isActive) continue;
        if (
          g.category &&
          g.category !== GarmentCategory.HOME_CLEANING &&
          !list.some((t) => t.key === g.category)
        ) {
          list.push({
            key: g.category,
            label: g.category.charAt(0) + g.category.slice(1).toLowerCase(),
          });
        }
      }
    }
    return list;
  }, [garments]);

  // Weight entry state for weight-based laundry workflow (Image 2 Screen 3b & Image 3)
  const [weightInput, setWeightInput] = useState('2.00');
  const [garmentsCountInput, setGarmentsCountInput] = useState(1);
  const [weightError, setWeightError] = useState<string | null>(null);

  // Add-ons & Garment Details Modals state
  const [isAddonModalOpen, setIsAddonModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedAddOns, setSelectedAddOns] = useState<TopUpServiceItem[]>([]);
  const [garmentBreakdown, setGarmentBreakdown] = useState('');
  const [defectNotes, setDefectNotes] = useState('');

  // Local photos state for the current weight intake item
  const [uploadedPhotos, setUploadedPhotos] = useState<LocalWeightPhoto[]>([]);
  const [isCapturingPhoto, setIsCapturingPhoto] = useState(false);

  // Selected service object
  const currentService = useMemo(() => {
    return services.find((s) => s.id === selectedServiceId) || services[0] || null;
  }, [services, selectedServiceId]);

  const serviceDisplayName = currentService
    ? formatCatalogServiceName(currentService.name)
    : 'Steam Iron';

  // Determine whether active selection is weight-based pricing
  const isWeightBased = useMemo(() => {
    return isWeightBasedPricing(workflow, currentService, entryMode, selectedCategory);
  }, [workflow, currentService, entryMode, selectedCategory]);

  // Helper to determine if a garment is a weight exception item in Per-Piece mode
  const isWeightExceptionGarment = (g: GarmentCatalogDTO): boolean => {
    return (
      !isWeightBased &&
      (g.category === GarmentCategory.WEIGHT_BASED || isWeightBasedCategory(g.category))
    );
  };

  // Rate per kg for active service in weight-based laundry
  const pricePerKg = useMemo(() => {
    const match = prices.find(
      (p) =>
        (p.serviceTypeId === selectedServiceId || p.serviceId === selectedServiceId) &&
        (p.garmentCatalogId === 'g-wb-1' ||
          p.garmentId === 'g-wb-1' ||
          p.garmentCatalogId === 'cat-kg-wash' ||
          p.garmentId === 'cat-kg-wash' ||
          !p.garmentCatalogId),
    );
    if (match && match.price > 0) return match.price;

    const name = (currentService?.name || '').trim().toLowerCase();
    if (name.includes('woolen')) return 140;
    if (name.includes('premium')) return 120;
    if (name.includes('white')) return 110;
    if (name.includes('iron') || name.includes('steam')) return 159;
    return 80;
  }, [prices, selectedServiceId, currentService]);

  // Allowed categories for per-piece workflow (filtered according to active service)
  const allowedCategories = useMemo(() => {
    if (isWeightBased) return [];
    const base = dynamicCategoryTabs.filter(
      (t) =>
        t.key !== GarmentCategory.HOME_CLEANING &&
        t.key !== 'HOME_CLEANING' &&
        (t.key === 'ALL' || isCategoryAllowedInWorkflow(t.key as GarmentCategory, workflow)),
    );
    const filteredKeys = filterCategoriesForService(
      base.map((t) => t.key),
      selectedServiceId,
      services,
      workflow,
    );
    return base.filter((t) => filteredKeys.includes(t.key));
  }, [isWeightBased, dynamicCategoryTabs, selectedServiceId, services, workflow]);

  // Helper to look up price for (garment, service) in per-piece catalog
  const getGarmentPrice = (garmentId: string): number => {
    const isWeightPieceException =
      !isWeightBased &&
      (selectedCategory === 'WEIGHT_BASED' ||
        selectedCategory === GarmentCategory.WEIGHT_BASED ||
        garmentId === 'g-wb-1');
    const found = prices.find(
      (p) =>
        (p.garmentCatalogId === garmentId || p.garmentId === garmentId) &&
        (p.serviceTypeId === selectedServiceId || p.serviceId === selectedServiceId),
    );
    if (found && typeof found.price === 'number') return found.price;
    return isWeightPieceException ? 40 : 50; // Fallback standard rate (₹40 for weight exception)
  };

  // Filter garments for per-piece catalog
  const filteredGarments = useMemo(() => {
    if (isWeightBased) return [];

    const isDryCleanWeightCategory =
      workflow === 'DRY_CLEANING' &&
      (selectedCategory === 'WEIGHT_BASED' || selectedCategory === GarmentCategory.WEIGHT_BASED);

    // In Per Pieces (DRY_CLEANING) workflow under WEIGHT_BASED category, display EXACTLY ONE card
    if (isDryCleanWeightCategory) {
      const existing =
        garments.find(
          (g) =>
            (g.category === GarmentCategory.WEIGHT_BASED || isWeightBasedCategory(g.category)) &&
            (g.id === 'g-wb-1' || g.name === 'Weight Based'),
        ) ||
        garments.find(
          (g) => g.category === GarmentCategory.WEIGHT_BASED || isWeightBasedCategory(g.category),
        );
      const singleItem: GarmentCatalogDTO = {
        id: existing?.id || 'g-wb-1',
        name: existing?.name || 'Weight Based',
        category: GarmentCategory.WEIGHT_BASED,
        section: 'Per Piece Exception',
        isActive: existing ? existing.isActive : true,
      };

      const q = searchQuery.toLowerCase().trim();
      if (
        q &&
        !singleItem.name.toLowerCase().includes(q) &&
        !(singleItem.section || '').toLowerCase().includes(q) &&
        !'weight based'.includes(q)
      ) {
        return [];
      }
      return [singleItem];
    }

    return garments.filter((g) => {
      if (g.isActive === false) return false;
      // Per-piece catalog excludes weight-based items unless WEIGHT_BASED is selected
      if (
        (g.category === GarmentCategory.WEIGHT_BASED || isWeightBasedCategory(g.category)) &&
        selectedCategory !== GarmentCategory.WEIGHT_BASED &&
        selectedCategory !== 'WEIGHT_BASED'
      ) {
        return false;
      }

      // Category filter
      if (selectedCategory !== 'ALL' && g.category !== selectedCategory) {
        return false;
      }

      // Search query filter
      if (searchQuery.trim().length > 0) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = g.name.toLowerCase().includes(query);
        const matchesCat = g.category.toLowerCase().includes(query);
        if (!matchesName && !matchesCat) return false;
      }

      return true;
    });
  }, [isWeightBased, garments, selectedCategory, searchQuery, workflow]);

  // Map of garmentId -> quantity in current cart
  const cartQuantityByGarment = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of items) {
      const current = map.get(it.garmentCatalogId) || 0;
      map.set(it.garmentCatalogId, current + (it.quantity || 1));
    }
    return map;
  }, [items]);

  // Cart summary calculations
  const totalCartPieces = useMemo(() => {
    return items.reduce((sum, it) => sum + (it.quantity || 1), 0);
  }, [items]);

  const totalCartEstimated = useMemo(() => {
    return items.reduce((sum, it) => {
      const rate = it.unitPrice || 0;
      const multiplier = it.weight && it.weight > 0 ? it.weight : it.quantity || 1;
      return sum + rate * multiplier;
    }, 0);
  }, [items]);

  // Weight items currently in cart
  const cartWeightItems = useMemo(() => {
    return items
      .map((it, idx) => ({ ...it, originalIndex: idx }))
      .filter((it) => it.weight != null && it.weight > 0);
  }, [items]);

  // Weight Intake Handlers
  const handleWeightChange = (text: string) => {
    setWeightInput(text);
    const parsed = parseFloat(text);
    if (isNaN(parsed) || parsed < 2.0) {
      setWeightError('Minimum permitted weight is 2.00 kg.');
    } else {
      setWeightError(null);
    }
  };

  const handleAdjustWeight = (delta: number) => {
    const cur = parseFloat(weightInput) || 2.0;
    const next = Math.max(2.0, Math.round((cur + delta) * 100) / 100);
    setWeightInput(next.toFixed(2));
    setWeightError(null);
  };

  const handleSetPresetWeight = (kg: number) => {
    setWeightInput(kg.toFixed(2));
    setWeightError(null);
  };

  // Photo Capture & Upload Handlers
  const handleTakePhoto = async () => {
    try {
      setIsCapturingPhoto(true);
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Camera Permission',
          'Camera access is required to photograph intake garments.',
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        let photoId = `w-photo-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        if (clientDraftId) {
          const saved = await savePhotoLocally({
            clientDraftId,
            sourceUri: asset.uri,
            garmentId: 'g-wb-1',
            unitNumber: uploadedPhotos.length + 1,
            photoType: PhotoType.FRONT,
          });
          photoId = saved.id;
          await onRefreshPhotos?.();
        }
        setUploadedPhotos((prev) => [...prev, { id: photoId, uri: asset.uri }]);
      }
    } catch (err: any) {
      Alert.alert('Camera Error', err.message || 'Could not capture photo');
    } finally {
      setIsCapturingPhoto(false);
    }
  };

  const handlePickFromGallery = async () => {
    try {
      setIsCapturingPhoto(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsMultipleSelection: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newPhotos: LocalWeightPhoto[] = [];
        for (let i = 0; i < result.assets.length; i++) {
          const asset = result.assets[i];
          let photoId = `w-photo-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`;
          if (clientDraftId) {
            const saved = await savePhotoLocally({
              clientDraftId,
              sourceUri: asset.uri,
              garmentId: 'g-wb-1',
              unitNumber: uploadedPhotos.length + i + 1,
              photoType: PhotoType.FRONT,
            });
            photoId = saved.id;
          }
          newPhotos.push({ id: photoId, uri: asset.uri });
        }
        if (clientDraftId) {
          await onRefreshPhotos?.();
        }
        setUploadedPhotos((prev) => [...prev, ...newPhotos]);
      }
    } catch (err: any) {
      Alert.alert('Gallery Error', err.message || 'Could not pick images');
    } finally {
      setIsCapturingPhoto(false);
    }
  };

  const handleRemovePhoto = async (photoId: string) => {
    setUploadedPhotos((prev) => prev.filter((p) => p.id !== photoId));
    try {
      await deletePhoto(photoId);
      await onRefreshPhotos?.();
    } catch {
      // Best effort cleanup
    }
  };

  // Add weight laundry item to cart
  const handleAddWeightToCart = () => {
    const wt = parseFloat(weightInput);
    if (isNaN(wt) || wt < 2.0) {
      setWeightError('Minimum permitted weight is 2.00 kg.');
      return;
    }
    setWeightError(null);

    const weightGarment = garments.find(
      (g) => g.category === GarmentCategory.WEIGHT_BASED || isWeightBasedCategory(g.category),
    ) ||
      garments.find((g) => g.id === 'g-wb-1') ||
      garments[0] || {
        id: 'g-wb-1',
        name: 'Weight Based Laundry',
        category: GarmentCategory.WEIGHT_BASED,
        isActive: true,
      };

    const count = Math.max(1, garmentsCountInput || 1);
    const combinedNotes = [
      garmentBreakdown.trim() ? `Breakdown: ${garmentBreakdown.trim()}` : '',
      defectNotes.trim() ? `Notes: ${defectNotes.trim()}` : '',
    ]
      .filter(Boolean)
      .join(' | ');

    const newItemId = generateUUID();
    const newItem: CreateOrderItemRequest = {
      id: newItemId,
      garmentCatalogId: weightGarment.id,
      serviceTypeId: selectedServiceId,
      quantity: count,
      weight: wt,
      unitPrice: pricePerKg,
      defectNotes: combinedNotes || undefined,
      addOnIds: selectedAddOns.map((a) => a.id),
      pieces: Array.from({ length: count }, (_, i) => ({
        pieceId: generateUUID(),
        unitNumber: i + 1,
        defectNotes: i === 0 && garmentBreakdown ? garmentBreakdown : undefined,
        photoCount: 0,
      })),
    };

    if (onAddWeightItem) {
      onAddWeightItem(newItem);
    } else {
      onQuickAddItem(weightGarment, selectedServiceId, pricePerKg);
    }

    // Reset weight intake form to clean defaults (ready for next weight item)
    setWeightInput('2.00');
    setGarmentsCountInput(1);
    setSelectedAddOns([]);
    setGarmentBreakdown('');
    setDefectNotes('');
    setUploadedPhotos([]);
    setWeightError(null);
  };

  // Render per-piece garment card (matching Image 2 Screen 3a)
  const renderGarmentCard = ({ item }: { item: GarmentCatalogDTO }) => {
    const price = getGarmentPrice(item.id);
    const cartQty = cartQuantityByGarment.get(item.id) || 0;
    const isWeightException = isWeightExceptionGarment(item);

    const handleGarmentClick = () => {
      if (isWeightException) {
        if (onOpenPieceException) {
          onOpenPieceException(item, selectedServiceId, price);
        } else {
          onOpenItemConfig(item);
        }
      } else {
        onQuickAddItem(item, selectedServiceId, price);
      }
    };

    const handleConfigClick = () => {
      if (isWeightException && onOpenPieceException) {
        onOpenPieceException(item, selectedServiceId, price);
      } else {
        onOpenItemConfig(item);
      }
    };

    const getGarmentEmoji = (cat: string) => {
      switch (cat) {
        case GarmentCategory.WOMEN:
          return '👗';
        case GarmentCategory.KIDS:
          return '🧒';
        case GarmentCategory.HOUSEHOLD:
          return '🛏️';
        case GarmentCategory.SHOES:
          return '👟';
        case GarmentCategory.SPECIAL:
          return '🌟';
        case GarmentCategory.WEIGHT_BASED:
          return '⚖️';
        case GarmentCategory.OTHERS:
          return '📦';
        default:
          return '👔';
      }
    };

    return (
      <View style={[styles.garmentCard, cartQty > 0 && styles.garmentCardInCart]}>
        <View style={styles.garmentHeaderRow}>
          <View style={styles.garmentIconCircle}>
            <Text style={styles.garmentIconEmoji}>{getGarmentEmoji(item.category)}</Text>
          </View>
          {cartQty > 0 && (
            <View style={styles.qtyBadge}>
              <Text style={styles.qtyBadgeText}>{cartQty} in cart</Text>
            </View>
          )}
        </View>

        <Text style={styles.garmentName} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={styles.garmentCategory}>
          {isWeightException ? item.section || 'Per Piece Exception' : item.category}
        </Text>

        <View style={styles.priceRow}>
          <Text style={styles.priceText}>
            ₹{price}
            <Text style={styles.priceUnit}> / pc</Text>
          </Text>
          {isWeightException && (
            <View style={styles.exceptionBadge}>
              <Text style={styles.exceptionBadgeText}>Exception</Text>
            </View>
          )}
        </View>

        {/* Action Controls */}
        {cartQty > 0 ? (
          <View style={styles.actionRowContainer}>
            <View style={styles.stepperRow}>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => onQuickDecrementItem(item.id)}
                accessible={true}
                accessibilityLabel={`Remove one ${item.name}`}
              >
                <Text style={styles.stepperBtnText}>−</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.stepperQtyBox}
                onPress={handleConfigClick}
                accessible={true}
                accessibilityLabel={`Edit details for ${item.name}`}
              >
                <Text style={styles.stepperQtyText}>{cartQty}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => onQuickAddItem(item, selectedServiceId, price)}
                accessible={true}
                accessibilityLabel={`Add one more ${item.name}`}
              >
                <Text style={styles.stepperBtnText}>＋</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.itemConfigIconBtn}
              onPress={handleConfigClick}
              accessible={true}
              accessibilityLabel={`Edit notes and photos for ${item.name}`}
            >
              <Text style={styles.itemConfigIconText}>⚙️</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.quickAddRow}>
            <TouchableOpacity
              style={styles.quickAddMainBtn}
              onPress={handleGarmentClick}
              accessible={true}
              accessibilityLabel={`Quick add 1 ${item.name}`}
            >
              <Text style={styles.quickAddMainBtnText}>＋ Quick Add</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickAddConfigBtn}
              onPress={handleConfigClick}
              accessible={true}
              accessibilityLabel={`Configure notes and photos for ${item.name}`}
            >
              <Text style={styles.quickAddConfigBtnText}>⚙️</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const parsedWeightVal = parseFloat(weightInput) || 0;
  const isWeightValid = !isNaN(parsedWeightVal) && parsedWeightVal >= 2.0;
  const targetCount = Math.max(1, garmentsCountInput || 1);
  const uploadedCount = uploadedPhotos.length;
  const remainingCount = Math.max(0, targetCount - uploadedCount);

  // Selected Category Label for Per-Piece context
  const selectedCategoryLabel = useMemo(() => {
    const tab = dynamicCategoryTabs.find((t) => t.key === selectedCategory);
    return tab ? tab.label : selectedCategory;
  }, [selectedCategory, dynamicCategoryTabs]);

  return (
    <View style={styles.container}>
      {/* Top Context Bar: Selected Service + Change CTA (Matches Image 2 Screen 3a & 3b) */}
      <View style={styles.contextHeader}>
        <TouchableOpacity
          style={styles.contextBackArrow}
          onPress={onBackToService}
          accessible={true}
          accessibilityLabel="Back to service selection"
        >
          <Text style={styles.contextBackArrowText}>‹</Text>
        </TouchableOpacity>

        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.contextServiceName} numberOfLines={1}>
            {isWeightBased
              ? `${serviceDisplayName} (Laundry / kg)`
              : `${serviceDisplayName} • ${selectedCategoryLabel}`}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.changeServiceBtn}
          onPress={onBackToService}
          accessible={true}
          accessibilityLabel="Change selected service"
        >
          <Text style={styles.changeServiceBtnText}>Change</Text>
        </TouchableOpacity>
      </View>

      {/* ── WEIGHT-BASED LAUNDRY FLOW (Image 2 Screen 3b & Image 3 Website Functionality) ── */}
      {isWeightBased ? (
        <ScrollView style={styles.weightScroll} contentContainerStyle={styles.weightScrollContent}>
          {/* Card 1: Weight (KG) */}
          <View style={styles.weightCard}>
            <Text style={styles.fieldSectionLabel}>Weight (KG)</Text>

            {/* Stepper display [ - ]  2.00  [ + ] */}
            <View style={styles.weightStepperContainer}>
              <TouchableOpacity
                style={styles.weightBigStepBtn}
                onPress={() => handleAdjustWeight(-0.5)}
                accessible={true}
                accessibilityLabel="Decrease weight by 0.5 kg"
              >
                <Text style={styles.weightBigStepBtnText}>−</Text>
              </TouchableOpacity>

              <View style={styles.weightDisplayValueBox}>
                <TextInput
                  style={styles.weightBigValueText}
                  value={weightInput}
                  onChangeText={handleWeightChange}
                  keyboardType="numeric"
                  accessible={true}
                  accessibilityLabel="Enter weight in kilograms"
                />
              </View>

              <TouchableOpacity
                style={[styles.weightBigStepBtn, styles.weightBigStepBtnPrimary]}
                onPress={() => handleAdjustWeight(0.5)}
                accessible={true}
                accessibilityLabel="Increase weight by 0.5 kg"
              >
                <Text style={[styles.weightBigStepBtnText, styles.weightBigStepBtnTextPrimary]}>
                  ＋
                </Text>
              </TouchableOpacity>
            </View>

            {/* Preset chips row: [-0.5 kg] [+0.5 kg] | [2 kg] [3 kg] [5 kg] [10 kg]   Min: 2.00 kg */}
            <View style={styles.presetsAndMinRow}>
              <View style={styles.presetsGroup}>
                <TouchableOpacity
                  style={styles.presetSmallChip}
                  onPress={() => handleAdjustWeight(-0.5)}
                >
                  <Text style={styles.presetSmallChipText}>-0.5 kg</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.presetSmallChip}
                  onPress={() => handleAdjustWeight(0.5)}
                >
                  <Text style={styles.presetSmallChipText}>+0.5 kg</Text>
                </TouchableOpacity>

                <View style={styles.presetDivider} />

                {[2, 3, 5, 10].map((presetKg) => {
                  const isActive = parsedWeightVal === presetKg;
                  return (
                    <TouchableOpacity
                      key={presetKg}
                      style={[styles.presetKgChip, isActive && styles.presetKgChipActive]}
                      onPress={() => handleSetPresetWeight(presetKg)}
                    >
                      <Text
                        style={[styles.presetKgChipText, isActive && styles.presetKgChipTextActive]}
                      >
                        {presetKg} kg
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.minWeightLabel}>Min: 2.00 kg</Text>
            </View>

            {weightError ? (
              <View style={styles.weightErrorBanner}>
                <Text style={styles.weightErrorBannerText}>⚠️ {weightError}</Text>
              </View>
            ) : null}
          </View>

          {/* Card 2: Price / KG */}
          <View style={styles.infoRowCard}>
            <Text style={styles.infoRowLabel}>Price / KG</Text>
            <View style={styles.priceWithLockRow}>
              <Text style={styles.priceWithLockAmount}>₹ {pricePerKg}</Text>
              <Text style={styles.priceLockIcon}>🔒</Text>
            </View>
          </View>

          {/* Card 3: No. of Garments */}
          <View style={styles.infoRowCard}>
            <Text style={styles.infoRowLabel}>No. of Garments</Text>
            <View style={styles.stepperContainerSmall}>
              <TouchableOpacity
                style={styles.stepperBtnSmall}
                onPress={() => setGarmentsCountInput((c) => Math.max(1, c - 1))}
                accessible={true}
                accessibilityLabel="Decrease garment count"
              >
                <Text style={styles.stepperBtnSmallText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.stepperCountText}>{garmentsCountInput}</Text>
              <TouchableOpacity
                style={[styles.stepperBtnSmall, styles.stepperBtnSmallActive]}
                onPress={() => setGarmentsCountInput((c) => c + 1)}
                accessible={true}
                accessibilityLabel="Increase garment count"
              >
                <Text style={[styles.stepperBtnSmallText, styles.stepperBtnSmallTextActive]}>
                  ＋
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Actions: Add-on & Garment Details (Matches Image 2 & Image 3) */}
          <View style={styles.detailsButtonRow}>
            <TouchableOpacity
              style={styles.addonActionBtn}
              onPress={() => setIsAddonModalOpen(true)}
              accessible={true}
              accessibilityLabel="Select add-on services"
            >
              <Text style={styles.addonActionBtnText}>
                🏷️ Add on {selectedAddOns.length > 0 ? `(${selectedAddOns.length})` : ''}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.detailsActionBtn}
              onPress={() => setIsDetailsModalOpen(true)}
              accessible={true}
              accessibilityLabel="Add garment details and defect notes"
            >
              <Text style={styles.detailsActionBtnText}>📄 Garment Details (Optional) ›</Text>
            </TouchableOpacity>
          </View>

          {/* Preview tags if details or add-ons exist */}
          {(selectedAddOns.length > 0 || garmentBreakdown || defectNotes) && (
            <View style={styles.selectedAddonsRow}>
              {selectedAddOns.map((addon) => (
                <View key={addon.id} style={styles.addonTagChip}>
                  <Text style={styles.addonTagChipText}>
                    {addon.name} (+₹{addon.price})
                  </Text>
                  <TouchableOpacity
                    onPress={() =>
                      setSelectedAddOns((prev) => prev.filter((a) => a.id !== addon.id))
                    }
                  >
                    <Text style={styles.addonTagRemoveText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {garmentBreakdown.trim().length > 0 && (
                <View style={styles.notesTagChip}>
                  <Text style={styles.notesTagChipText} numberOfLines={1}>
                    Breakdown: {garmentBreakdown}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Add to Cart CTA (Image 2 Screen 3b) */}
          <TouchableOpacity
            style={[styles.addWeightMainCta, !isWeightValid && styles.addWeightMainCtaDisabled]}
            onPress={handleAddWeightToCart}
            disabled={!isWeightValid}
            accessible={true}
            accessibilityLabel="Add to Cart"
          >
            <Text style={styles.addWeightMainCtaText}>Add to Cart →</Text>
          </TouchableOpacity>

          {/* Weight Items in Cart List (if any exist) */}
          {cartWeightItems.length > 0 && (
            <View style={styles.cartWeightListCard}>
              <Text style={styles.cartWeightListTitle}>
                Weight Items in Cart ({cartWeightItems.length})
              </Text>
              {cartWeightItems.map((item) => (
                <View key={item.originalIndex} style={styles.cartWeightItemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cartWeightItemName}>
                      {serviceDisplayName} • {item.weight} kg
                    </Text>
                    <Text style={styles.cartWeightItemSub}>
                      {item.quantity} pieces • ₹
                      {((item.weight || 0) * (item.unitPrice || 0)).toFixed(2)}
                      {item.defectNotes ? ` • ${item.defectNotes}` : ''}
                    </Text>
                  </View>
                  {onRemoveItem && (
                    <TouchableOpacity
                      style={styles.removeWeightItemBtn}
                      onPress={() => onRemoveItem(item.originalIndex)}
                      accessible={true}
                      accessibilityLabel="Remove weight item"
                    >
                      <Text style={styles.removeWeightItemText}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      ) : (
        /* ── PER-PIECE GARMENT FLOW (Image 2 Screen 3a) ── */
        <>
          {/* Search Input Bar */}
          <View style={styles.searchBarContainer}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search garments..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
              accessible={true}
              accessibilityLabel="Search garments"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
                <Text style={styles.clearSearchBtnText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Horizontal Category Tabs (Only for Per-Piece Services) */}
          <View style={styles.categoryTabsContainer}>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={allowedCategories}
              keyExtractor={(item) => item.key}
              renderItem={({ item }) => {
                const isSelected = selectedCategory === item.key;
                return (
                  <TouchableOpacity
                    style={[styles.categoryTab, isSelected && styles.categoryTabActive]}
                    onPress={() => onCategoryChange(item.key)}
                    accessible={true}
                    accessibilityLabel={`Category tab ${item.label}`}
                  >
                    <Text
                      style={[styles.categoryTabText, isSelected && styles.categoryTabTextActive]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              }}
              contentContainerStyle={styles.categoryTabsList}
            />
          </View>

          {/* Garment Grid */}
          {isLoadingCatalog ? (
            <View style={styles.centeredContainer}>
              <ActivityIndicator size="large" color="#2563eb" />
              <Text style={styles.centeredText}>Loading catalog items...</Text>
            </View>
          ) : filteredGarments.length === 0 ? (
            <View style={styles.centeredContainer}>
              <Text style={styles.emptyEmoji}>🧺</Text>
              <Text style={styles.emptyTitle}>No garments found</Text>
              <Text style={styles.centeredText}>
                {searchQuery
                  ? `No results matching "${searchQuery}"`
                  : 'No garments available in this category.'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredGarments}
              keyExtractor={(item) => item.id}
              renderItem={renderGarmentCard}
              numColumns={2}
              columnWrapperStyle={styles.gridRow}
              contentContainerStyle={[
                styles.gridContent,
                items.length > 0 && { paddingBottom: 100 },
              ]}
            />
          )}
        </>
      )}

      {/* Persistent Bottom Sticky Cart Bar (Matches Image 2 & 3) */}
      {items.length > 0 && (
        <View style={styles.stickyCartBar}>
          <View style={styles.cartBarInfo}>
            <Text style={styles.cartBarCount}>
              🛒 {totalCartPieces} {totalCartPieces === 1 ? 'item' : 'items'}
            </Text>
            <Text style={styles.cartBarTotal}>₹{totalCartEstimated.toFixed(2)} est.</Text>
          </View>

          <TouchableOpacity
            style={styles.cartBarReviewBtn}
            onPress={onProceedToReview}
            accessible={true}
            accessibilityLabel="Proceed to Order Review"
          >
            <Text style={styles.cartBarReviewText}>View Cart →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── MODAL: TOP-UP ADD-ON SERVICES ── */}
      <Modal visible={isAddonModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🏷️ Top-Up Add-on Services</Text>
              <TouchableOpacity onPress={() => setIsAddonModalOpen(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              {DEFAULT_TOP_UP_SERVICES.map((addon) => {
                const isChecked = selectedAddOns.some((a) => a.id === addon.id);
                return (
                  <TouchableOpacity
                    key={addon.id}
                    style={[styles.addonModalItem, isChecked && styles.addonModalItemActive]}
                    onPress={() => {
                      if (isChecked) {
                        setSelectedAddOns((prev) => prev.filter((a) => a.id !== addon.id));
                      } else {
                        setSelectedAddOns((prev) => [...prev, addon]);
                      }
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.addonModalItemName}>{addon.name}</Text>
                      {addon.description && (
                        <Text style={styles.addonModalItemDesc}>{addon.description}</Text>
                      )}
                    </View>
                    <Text style={styles.addonModalItemPrice}>+₹{addon.price}</Text>
                    <View style={[styles.addonCheckbox, isChecked && styles.addonCheckboxActive]}>
                      {isChecked && <Text style={styles.addonCheckmark}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalDoneBtn}
              onPress={() => setIsAddonModalOpen(false)}
            >
              <Text style={styles.modalDoneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── MODAL: GARMENT DETAILS & DEFECT NOTES ── */}
      <Modal visible={isDetailsModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📄 Garment Details & Notes</Text>
              <TouchableOpacity onPress={() => setIsDetailsModalOpen(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              <Text style={styles.modalInputLabel}>Garment Breakdown (Optional)</Text>
              <TextInput
                style={styles.modalTextInput}
                placeholder="e.g. 2 Shirts, 1 Trouser, 1 Bedsheet"
                placeholderTextColor="#94a3b8"
                value={garmentBreakdown}
                onChangeText={setGarmentBreakdown}
              />

              <Text style={styles.modalInputLabel}>Defect / Special Notes (Optional)</Text>
              <TextInput
                style={[styles.modalTextInput, { height: 70 }]}
                placeholder="e.g. Broken button on blue shirt, ink stain"
                placeholderTextColor="#94a3b8"
                value={defectNotes}
                onChangeText={setDefectNotes}
                multiline
              />

              <Text style={styles.modalQuickTagTitle}>Quick Defect Tags:</Text>
              <View style={styles.modalTagsRow}>
                {DEFECT_QUICK_TAGS.map((tag) => {
                  const isPresent = defectNotes.includes(tag);
                  return (
                    <TouchableOpacity
                      key={tag}
                      style={[styles.quickTagChip, isPresent && styles.quickTagChipActive]}
                      onPress={() => {
                        if (isPresent) {
                          setDefectNotes((prev) =>
                            prev
                              .split(',')
                              .map((s) => s.trim())
                              .filter((s) => s !== tag)
                              .join(', '),
                          );
                        } else {
                          setDefectNotes((prev) => (prev ? `${prev}, ${tag}` : tag));
                        }
                      }}
                    >
                      <Text
                        style={[
                          styles.quickTagChipText,
                          isPresent && styles.quickTagChipTextActive,
                        ]}
                      >
                        {tag}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <TouchableOpacity
              style={styles.modalDoneBtn}
              onPress={() => setIsDetailsModalOpen(false)}
            >
              <Text style={styles.modalDoneBtnText}>Save Details</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  contextHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  contextBackArrow: {
    paddingRight: 6,
    paddingVertical: 4,
  },
  contextBackArrowText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
  },
  contextServiceName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  changeServiceBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    justifyContent: 'center',
  },
  changeServiceBtnText: {
    color: '#2563eb',
    fontSize: 12,
    fontWeight: '700',
  },

  // ── WEIGHT INTAKE STYLES (Image 2 Screen 3b) ──
  weightScroll: {
    flex: 1,
  },
  weightScrollContent: {
    padding: 16,
    paddingBottom: 110,
  },
  weightCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  fieldSectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 10,
  },
  weightStepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  weightBigStepBtn: {
    width: 52,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  weightBigStepBtnPrimary: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  weightBigStepBtnText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1e293b',
  },
  weightBigStepBtnTextPrimary: {
    color: '#ffffff',
  },
  weightDisplayValueBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  weightBigValueText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    minWidth: 100,
  },
  presetsAndMinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  presetsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  presetSmallChip: {
    backgroundColor: '#f1f5f9',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  presetSmallChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  presetDivider: {
    width: 1,
    height: 18,
    backgroundColor: '#cbd5e1',
    marginHorizontal: 2,
  },
  presetKgChip: {
    backgroundColor: '#f1f5f9',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  presetKgChipActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  presetKgChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  presetKgChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  minWeightLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginLeft: 'auto',
  },
  weightErrorBanner: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    padding: 8,
    marginTop: 10,
  },
  weightErrorBannerText: {
    fontSize: 12,
    color: '#b91c1c',
    fontWeight: '600',
  },

  // Row Card (Price / KG, No. of Garments)
  infoRowCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoRowLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
  },
  priceWithLockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  priceWithLockAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  priceLockIcon: {
    fontSize: 14,
  },
  stepperContainerSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepperBtnSmall: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnSmallActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  stepperBtnSmallText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
  },
  stepperBtnSmallTextActive: {
    color: '#ffffff',
  },
  stepperCountText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    minWidth: 28,
    textAlign: 'center',
  },

  // Details and Addon Action Buttons
  detailsButtonRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  addonActionBtn: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addonActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  detailsActionBtn: {
    flex: 1.3,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  selectedAddonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  addonTagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 6,
  },
  addonTagChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1d4ed8',
  },
  addonTagRemoveText: {
    fontSize: 11,
    color: '#ef4444',
    fontWeight: '700',
  },
  notesTagChip: {
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: '100%',
  },
  notesTagChipText: {
    fontSize: 11,
    color: '#475569',
  },

  // Photo Upload Card
  photoUploadCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
  },
  photoHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  photoHeaderTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  photoHeaderCount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  photoProgressSubtext: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 12,
  },
  photoActionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  photoAddBtn: {
    flex: 1,
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoAddBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563eb',
  },
  photoUploadMultipleBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoUploadMultipleBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  photoThumbList: {
    marginTop: 12,
  },
  photoThumbWrapper: {
    marginRight: 10,
    position: 'relative',
    alignItems: 'center',
  },
  photoThumbImage: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  photoThumbRemoveBtn: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ef4444',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoThumbRemoveText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  photoThumbLabel: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 4,
  },

  // Add to Cart Main CTA
  addWeightMainCta: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  addWeightMainCtaDisabled: {
    backgroundColor: '#94a3b8',
  },
  addWeightMainCtaText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },

  // Weight Items in Cart List
  cartWeightListCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cartWeightListTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 10,
  },
  cartWeightItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  cartWeightItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  cartWeightItemSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  removeWeightItemBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  removeWeightItemText: {
    color: '#dc2626',
    fontWeight: '700',
    fontSize: 14,
  },

  // ── PER-PIECE STYLES (Image 2 Screen 3a) ──
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    minHeight: 44,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
    paddingVertical: 8,
  },
  clearSearchBtn: {
    padding: 6,
  },
  clearSearchBtnText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: 'bold',
  },
  categoryTabsContainer: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 8,
  },
  categoryTabsList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    minHeight: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryTabActive: {
    backgroundColor: '#2563eb',
  },
  categoryTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  categoryTabTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  gridContent: {
    padding: 8,
    paddingBottom: 20,
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  garmentCard: {
    width: '48.5%',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 8,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  garmentCardInCart: {
    borderColor: '#2563eb',
    backgroundColor: '#f8faff',
  },
  garmentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  garmentIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  garmentIconEmoji: {
    fontSize: 13,
  },
  qtyBadge: {
    backgroundColor: '#dbeafe',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  qtyBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  garmentName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b',
    minHeight: 28,
    lineHeight: 14,
  },
  garmentCategory: {
    fontSize: 9,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    marginTop: 1,
  },
  priceRow: {
    marginTop: 4,
    marginBottom: 6,
  },
  priceText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  priceUnit: {
    fontSize: 10,
    fontWeight: '500',
    color: '#64748b',
  },
  exceptionBadge: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6,
  },
  exceptionBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#92400e',
  },
  actionRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stepperRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 6,
    overflow: 'hidden',
    height: 32,
  },
  stepperBtn: {
    width: 28,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e2e8f0',
  },
  stepperBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
  },
  stepperQtyBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 32,
  },
  stepperQtyText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  itemConfigIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemConfigIconText: {
    fontSize: 12,
  },
  quickAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  quickAddMainBtn: {
    flex: 1,
    backgroundColor: '#2563eb',
    borderRadius: 6,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 32,
  },
  quickAddMainBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  quickAddConfigBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickAddConfigBtnText: {
    fontSize: 12,
  },
  centeredContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  centeredText: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 8,
    textAlign: 'center',
  },
  emptyEmoji: {
    fontSize: 36,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },

  // Sticky Bottom Bar
  stickyCartBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0f172a',
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    ...Platform.select({
      web: {
        boxShadow: '0 -3px 6px rgba(0, 0, 0, 0.15)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 8,
      },
    }),
  },
  cartBarInfo: {
    flex: 1,
  },
  cartBarCount: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700',
  },
  cartBarTotal: {
    color: '#38bdf8',
    fontSize: 16,
    fontWeight: '800',
  },
  cartBarReviewBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartBarReviewText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },

  // ── MODAL STYLES ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  modalCloseText: {
    fontSize: 18,
    color: '#64748b',
    fontWeight: 'bold',
    padding: 4,
  },
  modalScroll: {
    maxHeight: 320,
  },
  addonModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    marginBottom: 10,
  },
  addonModalItemActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  addonModalItemName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
  },
  addonModalItemDesc: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  addonModalItemPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1d4ed8',
    marginRight: 10,
  },
  addonCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  addonCheckboxActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  addonCheckmark: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalInputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
    marginTop: 10,
  },
  modalTextInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  modalQuickTagTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginTop: 14,
    marginBottom: 8,
  },
  modalTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  quickTagChip: {
    backgroundColor: '#f1f5f9',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  quickTagChipActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  quickTagChipText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },
  quickTagChipTextActive: {
    color: '#ffffff',
  },
  modalDoneBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  modalDoneBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
