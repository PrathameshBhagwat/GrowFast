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
} from 'react-native';
import {
  GarmentCatalogDTO,
  ServiceTypeDTO,
  GarmentCategory,
  OrderWorkflowType,
  OrderEntryMode,
  CreateOrderItemRequest,
  formatCatalogServiceName,
  filterCategoriesForService,
  isWeightBasedCategory,
} from '@growfast/shared-types';
import { isWeightBasedPricing } from '../../services/catalog-rules';

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
}

const CATEGORY_TABS: { key: string; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: GarmentCategory.MEN, label: 'Men' },
  { key: GarmentCategory.WOMEN, label: 'Women' },
  { key: GarmentCategory.KIDS, label: 'Kids' },
  { key: GarmentCategory.HOUSEHOLD, label: 'Household' },
  { key: GarmentCategory.SHOES, label: 'Shoes' },
  { key: GarmentCategory.OTHERS, label: 'Others' },
];

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
}: CatalogGridStepProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Weight entry state for weight-based laundry workflow
  const [weightInput, setWeightInput] = useState('2.00');
  const [garmentsCountInput, setGarmentsCountInput] = useState(5);
  const [weightError, setWeightError] = useState<string | null>(null);

  // Selected service object
  const currentService = useMemo(() => {
    return services.find((s) => s.id === selectedServiceId) || services[0] || null;
  }, [services, selectedServiceId]);

  const serviceDisplayName = currentService
    ? formatCatalogServiceName(currentService.name)
    : 'Selected Service';

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
    if (name.includes('iron') || name.includes('steam')) return 95;
    return 80;
  }, [prices, selectedServiceId, currentService]);

  // Allowed categories for per-piece workflow (filtered according to active service)
  const allowedCategories = useMemo(() => {
    if (isWeightBased) return [];
    const base = CATEGORY_TABS.filter((t) => t.key !== GarmentCategory.WEIGHT_BASED);
    const filteredKeys = filterCategoriesForService(
      base.map((t) => t.key),
      selectedServiceId,
      services,
      workflow,
    );
    return base.filter((t) => filteredKeys.includes(t.key));
  }, [isWeightBased, selectedServiceId, services, workflow]);

  // Helper to look up price for (garment, service) in per-piece catalog
  const getGarmentPrice = (garmentId: string): number => {
    const found = prices.find(
      (p) =>
        (p.garmentCatalogId === garmentId || p.garmentId === garmentId) &&
        (p.serviceTypeId === selectedServiceId || p.serviceId === selectedServiceId),
    );
    if (found && typeof found.price === 'number') return found.price;
    return 50; // Fallback standard rate
  };

  // Filter garments for per-piece catalog
  const filteredGarments = useMemo(() => {
    if (isWeightBased) return [];
    return garments.filter((g) => {
      if (!g.isActive) return false;
      // Per-piece catalog excludes weight-based items
      if (g.category === GarmentCategory.WEIGHT_BASED || isWeightBasedCategory(g.category)) {
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
  }, [isWeightBased, garments, selectedCategory, searchQuery]);

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
      setWeightError('Minimum permitted weight is 2.00 kg (e.g. 2.50 kg).');
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
      setWeightError('Minimum permitted weight is 2.00 kg (e.g. 2.50 kg).');
      return;
    }
    setWeightError(null);

    const weightGarment = garments.find(
      (g) => g.category === GarmentCategory.WEIGHT_BASED || isWeightBasedCategory(g.category),
    ) ||
      garments[0] || {
        id: 'g-wb-1',
        name: 'Weight Based Laundry',
        category: GarmentCategory.WEIGHT_BASED,
        isActive: true,
      };

    const count = Math.max(1, garmentsCountInput || 1);
    const newItem: CreateOrderItemRequest = {
      garmentCatalogId: weightGarment.id,
      serviceTypeId: selectedServiceId,
      quantity: count,
      weight: wt,
      unitPrice: pricePerKg,
      pieces: Array.from({ length: count }, (_, i) => ({
        unitNumber: i + 1,
        photoCount: 0,
      })),
    };

    if (onAddWeightItem) {
      onAddWeightItem(newItem);
    } else {
      onQuickAddItem(weightGarment, selectedServiceId, pricePerKg);
    }
  };

  // Render per-piece garment card
  const renderGarmentCard = ({ item }: { item: GarmentCatalogDTO }) => {
    const price = getGarmentPrice(item.id);
    const cartQty = cartQuantityByGarment.get(item.id) || 0;

    return (
      <View style={[styles.garmentCard, cartQty > 0 && styles.garmentCardInCart]}>
        <View style={styles.garmentHeaderRow}>
          <View style={styles.garmentIconCircle}>
            <Text style={styles.garmentIconEmoji}>
              {item.category === GarmentCategory.WOMEN ? '👗' : '👔'}
            </Text>
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
        <Text style={styles.garmentCategory}>{item.category}</Text>

        <View style={styles.priceRow}>
          <Text style={styles.priceText}>
            ₹{price.toFixed(2)}
            <Text style={styles.priceUnit}> / pc</Text>
          </Text>
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
                onPress={() => onOpenItemConfig(item)}
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
              onPress={() => onOpenItemConfig(item)}
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
              onPress={() => onQuickAddItem(item, selectedServiceId, price)}
              accessible={true}
              accessibilityLabel={`Quick add 1 ${item.name}`}
            >
              <Text style={styles.quickAddMainBtnText}>＋ Quick Add</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickAddConfigBtn}
              onPress={() => onOpenItemConfig(item)}
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
  const currentLineTotal = Math.round(parsedWeightVal * pricePerKg * 100) / 100;

  return (
    <View style={styles.container}>
      {/* Top Context Bar: Selected Service + Change Service CTA */}
      <View style={styles.contextHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.contextServiceLabel}>
            {isWeightBased ? 'ACTIVE WEIGHT SERVICE' : 'ACTIVE SERVICE'}
          </Text>
          <Text style={styles.contextServiceName}>{serviceDisplayName}</Text>
        </View>
        <TouchableOpacity
          style={styles.changeServiceBtn}
          onPress={onBackToService}
          accessible={true}
          accessibilityLabel="Change selected service or workflow"
        >
          <Text style={styles.changeServiceBtnText}>Change Service ↺</Text>
        </TouchableOpacity>
      </View>

      {/* ── WEIGHT-BASED LAUNDRY FLOW (Matches Website Rules) ── */}
      {isWeightBased ? (
        <ScrollView style={styles.weightScroll} contentContainerStyle={styles.weightScrollContent}>
          {/* Rate Per KG Info Card */}
          <View style={styles.weightRateCard}>
            <View style={styles.weightRateRow}>
              <View>
                <Text style={styles.weightRateLabel}>RATE PER KG</Text>
                <Text style={styles.weightRateAmount}>₹{pricePerKg.toFixed(2)} / kg</Text>
              </View>
              <View style={styles.weightMinBadge}>
                <Text style={styles.weightMinBadgeText}>Minimum 2.00 kg</Text>
              </View>
            </View>
            <Text style={styles.weightRateSubtext}>
              Turnaround: {currentService?.estimatedDays || 2} days • Batch washed per bag
            </Text>
          </View>

          {/* Weight Intake Measurement Card */}
          <View style={styles.weightIntakeCard}>
            <Text style={styles.cardSectionTitle}>Weigh Laundry Bag</Text>
            <Text style={styles.cardSectionSubtitle}>
              Enter measured scale weight in kg (minimum 2.00 kg)
            </Text>

            {/* Numeric Input & Steppers */}
            <View style={styles.weightInputRow}>
              <TouchableOpacity
                style={styles.weightStepBtn}
                onPress={() => handleAdjustWeight(-0.5)}
                accessible={true}
                accessibilityLabel="Decrease weight by 0.5 kg"
              >
                <Text style={styles.weightStepBtnText}>− 0.5</Text>
              </TouchableOpacity>

              <View style={styles.weightDisplayBox}>
                <TextInput
                  style={styles.weightInputText}
                  value={weightInput}
                  onChangeText={handleWeightChange}
                  keyboardType="numeric"
                  accessible={true}
                  accessibilityLabel="Measured weight in kg"
                />
                <Text style={styles.weightUnitLabel}>kg</Text>
              </View>

              <TouchableOpacity
                style={styles.weightStepBtn}
                onPress={() => handleAdjustWeight(0.5)}
                accessible={true}
                accessibilityLabel="Increase weight by 0.5 kg"
              >
                <Text style={styles.weightStepBtnText}>+ 0.5</Text>
              </TouchableOpacity>
            </View>

            {weightError && (
              <View style={styles.weightErrorBox}>
                <Text style={styles.weightErrorText}>⚠️ {weightError}</Text>
              </View>
            )}

            {/* Quick Preset Buttons */}
            <Text style={styles.presetLabel}>Quick Weight Presets:</Text>
            <View style={styles.presetChipsRow}>
              {[2.0, 3.0, 4.0, 5.0, 8.0, 10.0].map((preset) => (
                <TouchableOpacity
                  key={preset}
                  style={[styles.presetChip, parsedWeightVal === preset && styles.presetChipActive]}
                  onPress={() => handleSetPresetWeight(preset)}
                  accessible={true}
                  accessibilityLabel={`Set weight to ${preset.toFixed(2)} kg`}
                >
                  <Text
                    style={[
                      styles.presetChipText,
                      parsedWeightVal === preset && styles.presetChipTextActive,
                    ]}
                  >
                    {preset.toFixed(1)} kg
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Garments Count in Bag */}
            <View style={styles.garmentCountSection}>
              <View style={{ flex: 1 }}>
                <Text style={styles.garmentCountTitle}>Pieces in Bag</Text>
                <Text style={styles.garmentCountSubtitle}>
                  Physical count for intake verification
                </Text>
              </View>
              <View style={styles.countStepperRow}>
                <TouchableOpacity
                  style={styles.countBtn}
                  onPress={() => setGarmentsCountInput((c) => Math.max(1, c - 1))}
                  accessible={true}
                  accessibilityLabel="Decrease garment count"
                >
                  <Text style={styles.countBtnText}>−</Text>
                </TouchableOpacity>
                <View style={styles.countNumberBox}>
                  <Text style={styles.countNumberText}>{garmentsCountInput}</Text>
                </View>
                <TouchableOpacity
                  style={styles.countBtn}
                  onPress={() => setGarmentsCountInput((c) => c + 1)}
                  accessible={true}
                  accessibilityLabel="Increase garment count"
                >
                  <Text style={styles.countBtnText}>＋</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Line Calculation Summary */}
            <View style={styles.calcSummaryRow}>
              <Text style={styles.calcSummaryLabel}>Estimated Line Total:</Text>
              <Text style={styles.calcSummaryValue}>₹{currentLineTotal.toFixed(2)}</Text>
            </View>

            {/* Add to Cart CTA */}
            <TouchableOpacity
              style={[
                styles.addWeightCta,
                (isNaN(parsedWeightVal) || parsedWeightVal < 2.0) && styles.addWeightCtaDisabled,
              ]}
              onPress={handleAddWeightToCart}
              disabled={isNaN(parsedWeightVal) || parsedWeightVal < 2.0}
              accessible={true}
              accessibilityLabel="Add weight laundry to order"
            >
              <Text style={styles.addWeightCtaText}>＋ Add Weight Laundry to Cart</Text>
            </TouchableOpacity>
          </View>

          {/* List of Weight Items currently in Cart */}
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
        /* ── PER-PIECE GARMENT FLOW (Only for Per-Piece Services) ── */
        <>
          {/* Search Input Bar */}
          <View style={styles.searchBarContainer}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search garments by name (e.g. Saree, Shirt)..."
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

      {/* Persistent Bottom Sticky Cart Bar */}
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
            <Text style={styles.cartBarReviewText}>Review Cart →</Text>
          </TouchableOpacity>
        </View>
      )}
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
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  contextServiceLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  contextServiceName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  changeServiceBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    minHeight: 36,
    justifyContent: 'center',
  },
  changeServiceBtnText: {
    color: '#2563eb',
    fontSize: 12,
    fontWeight: '700',
  },
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
    padding: 12,
    paddingBottom: 24,
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  garmentCard: {
    width: '48.5%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
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
    marginBottom: 6,
  },
  garmentIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  garmentIconEmoji: {
    fontSize: 16,
  },
  qtyBadge: {
    backgroundColor: '#dbeafe',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  qtyBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  garmentName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
    minHeight: 34,
  },
  garmentCategory: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  priceRow: {
    marginTop: 6,
    marginBottom: 8,
  },
  priceText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  priceUnit: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748b',
  },
  actionRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepperRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    overflow: 'hidden',
    height: 38,
  },
  stepperBtn: {
    width: 32,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e2e8f0',
  },
  stepperBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },
  stepperQtyBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 38,
  },
  stepperQtyText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  itemConfigIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemConfigIconText: {
    fontSize: 14,
  },
  quickAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quickAddMainBtn: {
    flex: 1,
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 38,
  },
  quickAddMainBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  quickAddConfigBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickAddConfigBtnText: {
    fontSize: 14,
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

  // Weight-based flow styles
  weightScroll: {
    flex: 1,
  },
  weightScrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  weightRateCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    marginBottom: 14,
  },
  weightRateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  weightRateLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  weightRateAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1d4ed8',
    marginTop: 2,
  },
  weightMinBadge: {
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  weightMinBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563eb',
  },
  weightRateSubtext: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 6,
  },
  weightIntakeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    marginBottom: 14,
  },
  cardSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  cardSectionSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    marginBottom: 14,
  },
  weightInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  weightStepBtn: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  weightStepBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
  },
  weightDisplayBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#2563eb',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 52,
    backgroundColor: '#eff6ff',
  },
  weightInputText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1d4ed8',
    textAlign: 'center',
    minWidth: 70,
  },
  weightUnitLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#3b82f6',
    marginLeft: 4,
  },
  weightErrorBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
  },
  weightErrorText: {
    fontSize: 12,
    color: '#b91c1c',
    fontWeight: '600',
  },
  presetLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginTop: 6,
    marginBottom: 6,
  },
  presetChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  presetChip: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 34,
    justifyContent: 'center',
  },
  presetChipActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  presetChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  garmentCountSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 14,
  },
  garmentCountTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
  },
  garmentCountSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  countStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    overflow: 'hidden',
  },
  countBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e2e8f0',
  },
  countBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
  },
  countNumberBox: {
    paddingHorizontal: 14,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countNumberText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  calcSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  calcSummaryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  calcSummaryValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  addWeightCta: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  addWeightCtaDisabled: {
    backgroundColor: '#94a3b8',
  },
  addWeightCtaText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  cartWeightListCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
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
});
