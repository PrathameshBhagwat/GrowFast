import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import {
  GarmentCatalogDTO,
  ServiceTypeDTO,
  GarmentCategory,
  CreateOrderItemRequest,
  formatCatalogServiceName,
  isWeightBasedCategory,
} from '@growfast/shared-types';

export interface CatalogGridStepProps {
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
  { key: GarmentCategory.WEIGHT_BASED, label: 'Per Kg' },
  { key: GarmentCategory.OTHERS, label: 'Others' },
];

export function CatalogGridStep({
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
  onProceedToReview,
  onBackToService,
  isLoadingCatalog = false,
}: CatalogGridStepProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Selected service name
  const currentService = useMemo(() => {
    return services.find((s) => s.id === selectedServiceId);
  }, [services, selectedServiceId]);

  const serviceDisplayName = currentService
    ? formatCatalogServiceName(currentService.name)
    : 'Selected Service';

  // Helper to look up price for (garment, service)
  const getGarmentPrice = (garmentId: string): number => {
    const found = prices.find(
      (p) =>
        (p.garmentCatalogId === garmentId || p.garmentId === garmentId) &&
        (p.serviceTypeId === selectedServiceId || p.serviceId === selectedServiceId),
    );
    if (found && typeof found.price === 'number') return found.price;
    return 50; // Fallback standard rate
  };

  // Filter garments by category and search query
  const filteredGarments = useMemo(() => {
    return garments.filter((g) => {
      if (!g.isActive) return false;

      // Category filter
      if (selectedCategory !== 'ALL') {
        if (selectedCategory === GarmentCategory.WEIGHT_BASED) {
          if (g.category !== GarmentCategory.WEIGHT_BASED && !isWeightBasedCategory(g.category)) {
            return false;
          }
        } else if (g.category !== selectedCategory) {
          return false;
        }
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
  }, [garments, selectedCategory, searchQuery]);

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

  const renderGarmentCard = ({ item }: { item: GarmentCatalogDTO }) => {
    const isWeight =
      item.category === GarmentCategory.WEIGHT_BASED || isWeightBasedCategory(item.category);
    const price = getGarmentPrice(item.id);
    const cartQty = cartQuantityByGarment.get(item.id) || 0;

    return (
      <View style={[styles.garmentCard, cartQty > 0 && styles.garmentCardInCart]}>
        <View style={styles.garmentHeaderRow}>
          <View style={styles.garmentIconCircle}>
            <Text style={styles.garmentIconEmoji}>
              {isWeight ? '⚖️' : item.category === GarmentCategory.WOMEN ? '👗' : '👔'}
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
            <Text style={styles.priceUnit}>{isWeight ? ' / kg' : ' / pc'}</Text>
          </Text>
        </View>

        {/* Action Controls */}
        {cartQty > 0 && !isWeight ? (
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
        ) : (
          <TouchableOpacity
            style={[styles.addButton, isWeight && styles.addWeightButton]}
            onPress={() => onOpenItemConfig(item)}
            accessible={true}
            accessibilityLabel={`Configure and add ${item.name}`}
          >
            <Text style={styles.addButtonText}>
              {isWeight ? '⚖️ Enter Weight' : '＋ Add Garment'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Context Bar: Selected Service + Change Service CTA */}
      <View style={styles.contextHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.contextServiceLabel}>ACTIVE SERVICE</Text>
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

      {/* Horizontal Category Tabs */}
      <View style={styles.categoryTabsContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={CATEGORY_TABS}
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
                <Text style={[styles.categoryTabText, isSelected && styles.categoryTabTextActive]}>
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
            items.length > 0 && { paddingBottom: 100 }, // extra space for persistent bottom cart bar
          ]}
        />
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
    borderWidth: 1,
    borderColor: '#e2e8f0',
    minHeight: 34,
    justifyContent: 'center',
  },
  categoryTabActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  categoryTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  categoryTabTextActive: {
    color: '#ffffff',
  },
  gridContent: {
    padding: 12,
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  garmentCard: {
    width: '48.5%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    minHeight: 140,
    justifyContent: 'space-between',
  },
  garmentCardInCart: {
    borderColor: '#2563eb',
    backgroundColor: '#f8faff',
  },
  garmentHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  qtyBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  garmentName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 2,
  },
  garmentCategory: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 6,
  },
  priceRow: {
    marginBottom: 8,
  },
  priceText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  priceUnit: {
    fontSize: 11,
    fontWeight: '400',
    color: '#64748b',
  },
  addButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 38,
  },
  addWeightButton: {
    backgroundColor: '#475569',
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 2,
    minHeight: 38,
  },
  stepperBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  stepperBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    lineHeight: 20,
  },
  stepperQtyBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperQtyText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1d4ed8',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 8,
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
});
