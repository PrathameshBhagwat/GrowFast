import React, { useState, useMemo } from 'react';
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
import { WizardIcon } from './WizardIcon';

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
  { key: GarmentCategory.SHOES, label: 'Shoes' },
  { key: GarmentCategory.SPECIAL, label: 'Special' },
  { key: GarmentCategory.OTHERS, label: 'Others' },
  { key: GarmentCategory.WEIGHT_BASED, label: 'Weight Based (Exception)' },
];

export const CATEGORY_TABS = DEFAULT_CATEGORY_TABS;

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

  // Dynamically build category tabs
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

  // Weight entry state for weight-based laundry workflow
  const [weightInput, setWeightInput] = useState('2.00');
  const [garmentsCountInput, setGarmentsCountInput] = useState(1);
  const [weightError, setWeightError] = useState<string | null>(null);

  // Add-ons & Garment Details Modals state
  const [isAddonModalOpen, setIsAddonModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedAddOns, setSelectedAddOns] = useState<TopUpServiceItem[]>([]);
  const [garmentBreakdown, setGarmentBreakdown] = useState('');
  const [defectNotes, setDefectNotes] = useState('');

  // Local photos state for weight intake item
  const [uploadedPhotos, setUploadedPhotos] = useState<LocalWeightPhoto[]>([]);
  const [isCapturingPhoto, setIsCapturingPhoto] = useState(false);

  // Selected service object
  const currentService = useMemo(() => {
    return services.find((s) => s.id === selectedServiceId) || services[0] || null;
  }, [services, selectedServiceId]);

  const serviceDisplayName = currentService
    ? formatCatalogServiceName(currentService.name)
    : 'Dry Clean';

  // Determine whether active selection is weight-based pricing
  const isWeightBased = useMemo(() => {
    return isWeightBasedPricing(workflow, currentService, entryMode, selectedCategory);
  }, [workflow, currentService, entryMode, selectedCategory]);

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

  // Allowed categories for per-piece workflow
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

  // Helper to look up price for (garment, service)
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
    return isWeightPieceException ? 40 : 50;
  };

  // Filter garments for per-piece catalog
  const filteredGarments = useMemo(() => {
    if (isWeightBased) return [];

    const isDryCleanWeightCategory =
      workflow === 'DRY_CLEANING' &&
      (selectedCategory === 'WEIGHT_BASED' || selectedCategory === GarmentCategory.WEIGHT_BASED);

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
      if (
        (g.category === GarmentCategory.WEIGHT_BASED || isWeightBasedCategory(g.category)) &&
        selectedCategory !== GarmentCategory.WEIGHT_BASED &&
        selectedCategory !== 'WEIGHT_BASED'
      ) {
        return false;
      }

      if (selectedCategory !== 'ALL' && g.category !== selectedCategory) {
        return false;
      }

      if (searchQuery.trim().length > 0) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = g.name.toLowerCase().includes(query);
        const matchesCat = (g.category || '').toLowerCase().includes(query);
        if (!matchesName && !matchesCat) return false;
      }

      return true;
    });
  }, [isWeightBased, garments, selectedCategory, searchQuery, workflow]);

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

  // Garment visual icon helper
  const getGarmentVisualIcon = (g: GarmentCatalogDTO) => {
    const name = g.name.toLowerCase();
    const cat = (g.category || '').toLowerCase();
    if (name.includes('suit') || name.includes('achkan') || name.includes('blazer')) {
      return { name: 'shirt-outline', bg: '#FEF3C7', color: '#D97706' };
    }
    if (name.includes('backpack') || name.includes('bag')) {
      return { name: 'bag-outline', bg: '#FFEDD5', color: '#EA580C' };
    }
    if (name.includes('bed') || name.includes('blanket') || name.includes('quilt')) {
      return { name: 'bed-outline', bg: '#DCFCE7', color: '#16A34A' };
    }
    if (name.includes('belt')) {
      return { name: 'ribbon-outline', bg: '#FEE2E2', color: '#DC2626' };
    }
    if (cat.includes('kids') || name.includes('kids') || name.includes('frock')) {
      return { name: 'happy-outline', bg: '#E0E7FF', color: '#4F46E5' };
    }
    if (cat.includes('shoe') || name.includes('shoe') || name.includes('sneaker')) {
      return { name: 'footsteps-outline', bg: '#F3E8FF', color: '#9333EA' };
    }
    if (cat.includes('women') || name.includes('saree') || name.includes('dress')) {
      return { name: 'rose-outline', bg: '#FCE7F3', color: '#DB2777' };
    }
    return { name: 'shirt-outline', bg: '#EDF5FF', color: '#0866F5' };
  };

  // Active Category label for banner
  const activeCategoryLabel = useMemo(() => {
    const found = dynamicCategoryTabs.find((t) => t.key === selectedCategory);
    return found ? found.label : 'All Items';
  }, [dynamicCategoryTabs, selectedCategory]);

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

  const handleAddWeightToCart = () => {
    const wt = parseFloat(weightInput);
    if (isNaN(wt) || wt < 2.0) {
      setWeightError('Minimum permitted weight is 2.00 kg.');
      return;
    }
    setWeightError(null);

    const weightGarment =
      garments.find((g) => g.id === 'g-wb-1' || g.category === GarmentCategory.WEIGHT_BASED) ||
      garments[0];

    const weightItem: CreateOrderItemRequest = {
      garmentCatalogId: weightGarment?.id || 'g-wb-1',
      serviceTypeId: selectedServiceId,
      weight: wt,
      quantity: garmentsCountInput,
      unitPrice: pricePerKg,
      defectNotes: defectNotes.trim() || undefined,
    };

    onAddWeightItem?.(weightItem);
    setWeightInput('2.00');
    setGarmentsCountInput(1);
    setSelectedAddOns([]);
    setGarmentBreakdown('');
    setDefectNotes('');
    setUploadedPhotos([]);
  };

  // Render Garment Row (Matches Screenshot 3 single-column compact cards)
  const renderGarmentRow = ({ item }: { item: GarmentCatalogDTO }) => {
    const price = getGarmentPrice(item.id);
    const visual = getGarmentVisualIcon(item);
    const isWeightPieceException =
      !isWeightBased &&
      (item.category === GarmentCategory.WEIGHT_BASED || isWeightBasedCategory(item.category));

    // Check if this garment is in the cart
    const cartCount = items
      .filter((it) => it.garmentCatalogId === item.id)
      .reduce((s, it) => s + (it.quantity || 1), 0);

    return (
      <View style={styles.garmentCard}>
        {/* Left Thumbnail */}
        <View style={[styles.garmentThumbnailBox, { backgroundColor: visual.bg }]}>
          <WizardIcon name={visual.name} size={24} color={visual.color} fallbackText="👕" />
        </View>

        {/* Middle Details: Name + Category */}
        <View style={styles.garmentInfo}>
          <Text style={styles.garmentName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.garmentCategory} numberOfLines={1}>
            {item.section ||
              (item.category
                ? item.category.charAt(0) + item.category.slice(1).toLowerCase()
                : 'General')}
          </Text>
        </View>

        {/* Right Section: Price & Action Buttons */}
        <View style={styles.garmentRightCol}>
          <View style={styles.priceContainer}>
            <Text style={styles.priceText}>₹{price}</Text>
            <Text style={styles.priceUnitText}>{isWeightBased ? '/ kg' : '/ pc'}</Text>
          </View>

          {/* Buttons: + Add and Settings Gear */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => {
                if (isWeightPieceException && onOpenPieceException) {
                  onOpenPieceException(item, selectedServiceId, price);
                } else {
                  onQuickAddItem(item, selectedServiceId, price);
                }
              }}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={`Add ${item.name} to cart`}
              activeOpacity={0.8}
            >
              <Text style={styles.addButtonText}>
                {cartCount > 0 ? `+ Add (${cartCount})` : '+ Add'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.gearButton}
              onPress={() => {
                if (isWeightPieceException && onOpenPieceException) {
                  onOpenPieceException(item, selectedServiceId, price);
                } else {
                  onOpenItemConfig(item);
                }
              }}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={`Configure options for ${item.name}`}
              activeOpacity={0.7}
            >
              <WizardIcon name="settings-outline" size={16} color="#647894" fallbackText="⚙️" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* ── TOP SERVICE CONTEXT BANNER (Screenshot 3) ── */}
      <View style={styles.serviceBanner}>
        <View style={styles.bannerLeftRow}>
          <View style={styles.bannerIconCircle}>
            <WizardIcon name="sparkles" size={18} color="#0866F5" fallbackText="✨" />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.bannerTitle} numberOfLines={1}>
              {serviceDisplayName} · {activeCategoryLabel}
            </Text>
            <Text style={styles.bannerSubtitle}>Select garments to add to the cart</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.changeServiceBtn}
          onPress={onBackToService}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Change service"
        >
          <WizardIcon name="swap-horizontal-outline" size={14} color="#0866F5" fallbackText="⇄" />
          <Text style={styles.changeServiceBtnText}>Change</Text>
        </TouchableOpacity>
      </View>

      {/* ── SEARCH & FILTER ROW (Screenshot 3) ── */}
      <View style={styles.searchFilterRow}>
        <View style={styles.searchBox}>
          <WizardIcon name="search-outline" size={18} color="#94A3B8" fallbackText="🔍" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search garments..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
              <Text style={styles.clearSearchBtnText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={styles.filterBtn}
          onPress={() => {
            // Optional filter toggle / reset query
            if (searchQuery) setSearchQuery('');
          }}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Catalog filters"
        >
          <WizardIcon name="options-outline" size={18} color="#0866F5" fallbackText="⚙️" />
        </TouchableOpacity>
      </View>

      {/* ── HORIZONTAL CATEGORY FILTER CHIPS (Screenshot 3) ── */}
      {!isWeightBased && (
        <View style={styles.categoryChipsWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryChipsScroll}
          >
            {allowedCategories.map((cat) => {
              const isSelected = selectedCategory === cat.key;
              return (
                <TouchableOpacity
                  key={cat.key}
                  style={[styles.categoryChip, isSelected && styles.categoryChipActive]}
                  onPress={() => onCategoryChange(cat.key)}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={`Filter by ${cat.label}`}
                >
                  <Text
                    style={[styles.categoryChipText, isSelected && styles.categoryChipTextActive]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* ── GARMENT LIST OR WEIGHT INTAKE ── */}
      {isWeightBased ? (
        /* WEIGHT-BASED INTAKE VIEW */
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.weightScrollContent}>
          <View style={styles.weightCard}>
            <Text style={styles.weightCardTitle}>Weight Intake (kg)</Text>
            <Text style={styles.weightCardSubtitle}>
              Rate: ₹{pricePerKg.toFixed(2)}/kg · Minimum 2.00 kg
            </Text>

            <View style={styles.weightInputRow}>
              <TouchableOpacity
                style={styles.stepperCircleBtn}
                onPress={() => handleAdjustWeight(-0.5)}
              >
                <Text style={styles.stepperCircleBtnText}>−</Text>
              </TouchableOpacity>

              <TextInput
                style={styles.weightTextInput}
                value={weightInput}
                onChangeText={handleWeightChange}
                keyboardType="decimal-pad"
              />

              <TouchableOpacity
                style={styles.stepperCircleBtn}
                onPress={() => handleAdjustWeight(0.5)}
              >
                <Text style={styles.stepperCircleBtnText}>＋</Text>
              </TouchableOpacity>
            </View>

            {weightError && <Text style={styles.weightErrorText}>{weightError}</Text>}

            {/* Presets */}
            <View style={styles.presetsRow}>
              {[2.0, 3.0, 5.0, 7.0, 10.0].map((kg) => (
                <TouchableOpacity
                  key={kg}
                  style={styles.presetChip}
                  onPress={() => handleSetPresetWeight(kg)}
                >
                  <Text style={styles.presetChipText}>{kg} kg</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Pieces count */}
            <View style={styles.piecesCountRow}>
              <Text style={styles.piecesCountLabel}>Estimated Pieces in Bag:</Text>
              <View style={styles.piecesStepperRow}>
                <TouchableOpacity
                  style={styles.miniStepperBtn}
                  onPress={() => setGarmentsCountInput((c) => Math.max(1, c - 1))}
                >
                  <Text style={styles.miniStepperBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.piecesCountVal}>{garmentsCountInput}</Text>
                <TouchableOpacity
                  style={styles.miniStepperBtn}
                  onPress={() => setGarmentsCountInput((c) => c + 1)}
                >
                  <Text style={styles.miniStepperBtnText}>＋</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={styles.addWeightBtn} onPress={handleAddWeightToCart}>
              <Text style={styles.addWeightBtnText}>
                Add to Cart (₹{((parseFloat(weightInput) || 2) * pricePerKg).toFixed(0)}) →
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : isLoadingCatalog ? (
        <View style={styles.centeredContainer}>
          <ActivityIndicator size="large" color="#0866F5" />
          <Text style={styles.centeredText}>Loading catalog garments...</Text>
        </View>
      ) : filteredGarments.length === 0 ? (
        <View style={styles.centeredContainer}>
          <WizardIcon name="basket-outline" size={40} color="#94A3B8" fallbackText="🧺" />
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
          renderItem={renderGarmentRow}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: 100 }, // Space for sticky bottom cart summary
          ]}
        />
      )}

      {/* ── STICKY BOTTOM CART SUMMARY (Screenshot 3) ── */}
      <View style={styles.stickyCartBar}>
        <View style={styles.cartInfoLeft}>
          <View style={styles.cartIconCircle}>
            <WizardIcon name="cart-outline" size={20} color="#0866F5" fallbackText="🛒" />
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{totalCartPieces}</Text>
            </View>
          </View>
          <View style={styles.cartTextCol}>
            <Text style={styles.cartCountText}>
              {totalCartPieces} {totalCartPieces === 1 ? 'item' : 'items'} in cart
            </Text>
            <Text style={styles.cartSubtotalText}>₹{totalCartEstimated.toFixed(0)}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.continueCartBtn,
            totalCartPieces > 0 ? styles.continueCartBtnActive : styles.continueCartBtnDisabled,
          ]}
          onPress={onProceedToReview}
          disabled={totalCartPieces === 0}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Continue to Cart"
        >
          <Text style={styles.continueCartBtnText}>Continue to Cart →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  serviceBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 10,
    backgroundColor: '#EDF5FF',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  bannerIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#101F3D',
  },
  bannerSubtitle: {
    fontSize: 11,
    color: '#647894',
    marginTop: 1,
  },
  changeServiceBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 8,
  },
  changeServiceBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0866F5',
  },
  searchFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 10,
    gap: 8,
  },
  searchBox: {
    flex: 1,
    height: 44,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCE5F0',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#101F3D',
    marginLeft: 8,
    paddingVertical: 8,
  },
  clearSearchBtn: {
    padding: 4,
  },
  clearSearchBtnText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '700',
  },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE5F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryChipsWrapper: {
    marginBottom: 8,
  },
  categoryChipsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE5F0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  categoryChipActive: {
    backgroundColor: '#0866F5',
    borderColor: '#0866F5',
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#647894',
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  garmentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DCE5F0',
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 1px 4px rgba(0, 0, 0, 0.03)',
      },
      default: {
        shadowColor: '#000',
        shadowOpacity: 0.03,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
      },
    }),
  },
  garmentThumbnailBox: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  garmentInfo: {
    flex: 1,
  },
  garmentName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#101F3D',
  },
  garmentCategory: {
    fontSize: 12,
    color: '#647894',
    marginTop: 2,
  },
  garmentRightCol: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  priceText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#101F3D',
  },
  priceUnitText: {
    fontSize: 11,
    color: '#647894',
    marginLeft: 3,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addButton: {
    backgroundColor: '#0866F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  gearButton: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centeredContainer: {
    flex: 1,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centeredText: {
    fontSize: 13,
    color: '#647894',
    marginTop: 8,
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#101F3D',
    marginTop: 12,
  },
  weightScrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  weightCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DCE5F0',
    padding: 16,
  },
  weightCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#101F3D',
  },
  weightCardSubtitle: {
    fontSize: 13,
    color: '#647894',
    marginTop: 2,
    marginBottom: 16,
  },
  weightInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 12,
  },
  stepperCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EDF5FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperCircleBtnText: {
    fontSize: 22,
    color: '#0866F5',
    fontWeight: '700',
  },
  weightTextInput: {
    width: 120,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#0866F5',
    backgroundColor: '#F0F7FF',
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700',
    color: '#101F3D',
  },
  weightErrorText: {
    color: '#EF4444',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 8,
  },
  presetsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  presetChip: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  piecesCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginBottom: 16,
  },
  piecesCountLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#101F3D',
  },
  piecesStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  miniStepperBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniStepperBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0866F5',
  },
  piecesCountVal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#101F3D',
    minWidth: 24,
    textAlign: 'center',
  },
  addWeightBtn: {
    backgroundColor: '#0866F5',
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addWeightBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  stickyCartBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#DCE5F0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...Platform.select({
      web: {
        boxShadow: '0 -4px 12px rgba(0, 0, 0, 0.05)',
      },
      default: {
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: -3 },
        elevation: 8,
      },
    }),
  },
  cartInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cartIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EDF5FF',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginRight: 10,
  },
  cartBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#0866F5',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  cartTextCol: {},
  cartCountText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#101F3D',
  },
  cartSubtotalText: {
    fontSize: 12,
    color: '#647894',
    marginTop: 1,
  },
  continueCartBtn: {
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueCartBtnActive: {
    backgroundColor: '#0866F5',
  },
  continueCartBtnDisabled: {
    backgroundColor: '#BFDBFE',
  },
  continueCartBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
