import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import {
  CreateOrderItemRequest,
  GarmentCatalogDTO,
  ServiceTypeDTO,
  GarmentCategory,
  ServiceCategory,
  OrderWorkflowType,
  OrderEntryMode,
  isWeightBasedCategory,
  formatCatalogServiceName,
} from '@growfast/shared-types';
import { apiClient } from '../../api/client';

interface CatalogItemsStepProps {
  workflow: OrderWorkflowType;
  onWorkflowChange: (workflow: OrderWorkflowType) => void;
  entryMode: OrderEntryMode;
  onEntryModeChange: (mode: OrderEntryMode) => void;
  items: CreateOrderItemRequest[];
  onItemsChange: (items: CreateOrderItemRequest[]) => void;
  canModifyPrice: boolean;
  isConnected: boolean;
}

// Fallback seed data in case initial network is offline
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
    id: 'srv-wash-iron',
    name: 'Wash & Iron',
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
    id: 'srv-steam-press',
    name: 'Steam Press Only',
    category: ServiceCategory.STEAM_PRESS,
    estimatedDays: 1,
    isActive: true,
  },
  {
    id: 'srv-premium-wash',
    name: 'Premium Wash & Fold',
    category: ServiceCategory.WASH,
    estimatedDays: 2,
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
  { garmentCatalogId: 'cat-kg-wash', serviceTypeId: 'srv-premium-wash', price: 80 },
  { garmentCatalogId: 'cat-kg-iron', serviceTypeId: 'srv-wash-iron', price: 120 },
];

const DEFECT_QUICK_TAGS = [
  'Collar Stain',
  'Torn Hem',
  'Missing Button',
  'Color Bleed',
  'Faded',
  'Ink Mark',
  'Oil Stain',
];

export function CatalogItemsStep({
  workflow,
  onWorkflowChange,
  entryMode,
  onEntryModeChange,
  items,
  onItemsChange,
  canModifyPrice,
  isConnected,
}: CatalogItemsStepProps) {
  const [garments, setGarments] = useState<GarmentCatalogDTO[]>(FALLBACK_GARMENTS);
  const [services, setServices] = useState<ServiceTypeDTO[]>(FALLBACK_SERVICES);
  const [prices, setPrices] = useState<any[]>(FALLBACK_PRICES);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [catalogCached, setCatalogCached] = useState(false);

  // Active Category Filter
  const [activeCategory, setActiveCategory] = useState<string>('ALL');

  // Item Configuration Modal State
  const [itemModalVisible, setItemModalVisible] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [selectedGarment, setSelectedGarment] = useState<GarmentCatalogDTO | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [quantityInput, setQuantityInput] = useState('1');
  const [weightInput, setWeightInput] = useState('2.00');
  const [unitPriceInput, setUnitPriceInput] = useState('0');
  const [defectNotes, setDefectNotes] = useState('');
  const [weightValidationError, setWeightValidationError] = useState<string | null>(null);

  // Fetch catalog on mount or when online
  useEffect(() => {
    let isMounted = true;
    async function loadCatalog() {
      if (!isConnected) {
        setCatalogCached(true);
        return;
      }
      setIsLoadingCatalog(true);
      try {
        const [garmentsRes, servicesRes, pricingRes] = await Promise.all([
          apiClient.catalog.getGarments().catch(() => FALLBACK_GARMENTS),
          apiClient.catalog.getServices().catch(() => FALLBACK_SERVICES),
          apiClient.catalog.getPricing().catch(() => FALLBACK_PRICES),
        ]);

        if (isMounted) {
          if (garmentsRes && garmentsRes.length > 0) setGarments(garmentsRes);
          if (servicesRes && servicesRes.length > 0) setServices(servicesRes);
          if (pricingRes && pricingRes.length > 0) setPrices(pricingRes);
          setCatalogCached(false);
        }
      } catch (err) {
        if (isMounted) setCatalogCached(true);
      } finally {
        if (isMounted) setIsLoadingCatalog(false);
      }
    }

    loadCatalog();
    return () => {
      isMounted = false;
    };
  }, [isConnected]);

  // Price lookup helper
  const getCatalogPrice = (garmentId: string, serviceId: string): number => {
    const found = prices.find(
      (p) =>
        (p.garmentCatalogId === garmentId || p.garmentId === garmentId) &&
        (p.serviceTypeId === serviceId || p.serviceId === serviceId),
    );
    if (found && typeof found.price === 'number') return found.price;
    return 50; // Fallback default rate
  };

  // Garment name lookup helper
  const getGarmentName = (garmentId: string): string => {
    const g = garments.find((item) => item.id === garmentId);
    return g ? g.name : 'Garment';
  };

  // Service name lookup helper
  const getServiceName = (serviceId: string): string => {
    const s = services.find((item) => item.id === serviceId);
    return s ? formatCatalogServiceName(s.name) : serviceId;
  };

  // Filter garments based on active category
  const filteredGarments = useMemo(() => {
    if (activeCategory === 'ALL') return garments;
    if (activeCategory === 'WEIGHT_BASED') {
      return garments.filter(
        (g) => g.category === GarmentCategory.WEIGHT_BASED || isWeightBasedCategory(g.category),
      );
    }
    return garments.filter((g) => g.category === activeCategory);
  }, [garments, activeCategory]);

  // Open modal to configure and add garment
  const handleOpenGarmentModal = (garment: GarmentCatalogDTO) => {
    setSelectedGarment(garment);
    setEditingItemIndex(null);

    // Pick appropriate default service
    const isWeight =
      garment.category === GarmentCategory.WEIGHT_BASED || isWeightBasedCategory(garment.category);
    let defaultService = services[0]?.id || 'srv-wash-iron';
    if (workflow === 'DRY_CLEANING') {
      const dcSrv = services.find((s) => s.category === ServiceCategory.DRY_CLEAN);
      if (dcSrv) defaultService = dcSrv.id;
    } else if (isWeight) {
      const washSrv = services.find(
        (s) => s.category === ServiceCategory.WASH || s.category === ServiceCategory.WASH_IRON,
      );
      if (washSrv) defaultService = washSrv.id;
    }

    setSelectedServiceId(defaultService);
    setQuantityInput('1');
    setWeightInput(isWeight ? '2.00' : '');
    const price = getCatalogPrice(garment.id, defaultService);
    setUnitPriceInput(String(price));
    setDefectNotes('');
    setWeightValidationError(null);
    setItemModalVisible(true);
  };

  // Open modal to edit existing order item
  const handleEditItem = (index: number) => {
    const item = items[index];
    if (!item) return;

    const garment = garments.find((g) => g.id === item.garmentCatalogId) || {
      id: item.garmentCatalogId,
      name: item.defectNotes?.split(' - ')[0] || 'Garment Item',
      category: item.weight ? GarmentCategory.WEIGHT_BASED : GarmentCategory.MEN,
      isActive: true,
    };

    setSelectedGarment(garment);
    setEditingItemIndex(index);
    setSelectedServiceId(item.serviceTypeId);
    setQuantityInput(String(item.quantity || 1));
    setWeightInput(item.weight ? String(item.weight) : '');
    setUnitPriceInput(String(item.unitPrice || 0));
    setDefectNotes(item.defectNotes || '');
    setWeightValidationError(null);
    setItemModalVisible(true);
  };

  const handleServiceChange = (serviceId: string) => {
    setSelectedServiceId(serviceId);
    if (selectedGarment) {
      const price = getCatalogPrice(selectedGarment.id, serviceId);
      setUnitPriceInput(String(price));
    }
  };

  const handleSaveItem = () => {
    if (!selectedGarment) return;

    const isWeight =
      selectedGarment.category === GarmentCategory.WEIGHT_BASED ||
      isWeightBasedCategory(selectedGarment.category) ||
      entryMode === 'WEIGHT';

    if (workflow === 'DRY_CLEANING' && isWeight) {
      Alert.alert(
        'Dry Cleaning Restriction',
        'Dry Cleaning is strictly per-piece and does not support weight-based processing.',
      );
      return;
    }

    let weightVal: number | undefined = undefined;
    if (isWeight) {
      const parsedWeight = parseFloat(weightInput);
      if (isNaN(parsedWeight) || parsedWeight < 2.0) {
        setWeightValidationError('Minimum weight requirement is 2.00 kg per business rules.');
        Alert.alert('Validation Error', 'Weight-based laundry requires a minimum of 2.00 kg.');
        return;
      }
      weightVal = Math.round(parsedWeight * 100) / 100;
    }

    const qty = parseInt(quantityInput, 10);
    if (isNaN(qty) || qty < 1) {
      Alert.alert('Validation Error', 'Quantity must be at least 1.');
      return;
    }

    const unitPrice = parseFloat(unitPriceInput);
    if (isNaN(unitPrice) || unitPrice < 0) {
      Alert.alert('Validation Error', 'Unit price must be a valid non-negative number.');
      return;
    }

    const newItem: CreateOrderItemRequest = {
      garmentCatalogId: selectedGarment.id,
      serviceTypeId: selectedServiceId,
      quantity: qty,
      weight: weightVal,
      unitPrice,
      defectNotes: defectNotes.trim() || undefined,
    };

    if (editingItemIndex !== null) {
      // Edit in place
      const updated = [...items];
      updated[editingItemIndex] = newItem;
      onItemsChange(updated);
    } else {
      // Add new
      onItemsChange([...items, newItem]);
    }

    setItemModalVisible(false);
  };

  const handleRemoveItem = (index: number) => {
    onItemsChange(items.filter((_, idx) => idx !== index));
  };

  // Calculate quick totals
  const totalPieces = items.reduce((acc, it) => acc + (it.quantity || 1), 0);
  const totalWeight = items.reduce((acc, it) => acc + (it.weight || 0), 0);
  const estimatedSubtotal = items.reduce((acc, it) => {
    const rate = it.unitPrice || 0;
    if (it.weight) return acc + rate * it.weight;
    return acc + rate * (it.quantity || 1);
  }, 0);

  return (
    <View style={styles.container}>
      <Text style={styles.stepTitle}>Select Services & Items</Text>

      {/* Offline Notice if applicable */}
      {catalogCached && (
        <View style={styles.cachedNotice}>
          <Text style={styles.cachedNoticeText}>
            ℹ️ Offline Mode: Using cached catalog. Server will compute authoritative final pricing.
          </Text>
        </View>
      )}

      {/* Workflow Toggle (Laundry vs Dry Clean) */}
      <View style={styles.workflowSelector}>
        <TouchableOpacity
          style={[styles.workflowButton, workflow === 'LAUNDRY' && styles.workflowButtonActive]}
          onPress={() => onWorkflowChange('LAUNDRY')}
          accessible={true}
          accessibilityLabel="Switch to Laundry workflow"
        >
          <Text
            style={[
              styles.workflowButtonText,
              workflow === 'LAUNDRY' && styles.workflowButtonTextActive,
            ]}
          >
            🧺 Laundry
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.workflowButton,
            workflow === 'DRY_CLEANING' && styles.workflowButtonActive,
          ]}
          onPress={() => {
            onWorkflowChange('DRY_CLEANING');
            if (entryMode === 'WEIGHT') {
              onEntryModeChange('PIECES');
            }
          }}
          accessible={true}
          accessibilityLabel="Switch to Dry Cleaning workflow"
        >
          <Text
            style={[
              styles.workflowButtonText,
              workflow === 'DRY_CLEANING' && styles.workflowButtonTextActive,
            ]}
          >
            ✨ Dry Cleaning
          </Text>
        </TouchableOpacity>
      </View>

      {/* Entry Mode Toggle (Per Piece vs Per Weight) */}
      <View style={styles.entryModeRow}>
        <Text style={styles.entryModeLabel}>Entry Mode:</Text>
        <View style={styles.modeToggleGroup}>
          <TouchableOpacity
            style={[styles.modeToggleBtn, entryMode === 'PIECES' && styles.modeToggleBtnActive]}
            onPress={() => onEntryModeChange('PIECES')}
            accessible={true}
            accessibilityLabel="Per piece mode"
          >
            <Text
              style={[styles.modeToggleText, entryMode === 'PIECES' && styles.modeToggleTextActive]}
            >
              Per Piece
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.modeToggleBtn,
              entryMode === 'WEIGHT' && styles.modeToggleBtnActive,
              workflow === 'DRY_CLEANING' && { opacity: 0.5 },
            ]}
            onPress={() => {
              if (workflow === 'DRY_CLEANING') {
                Alert.alert(
                  'Dry Cleaning Restriction',
                  'Dry Cleaning is strictly per-piece and does not support weight-based processing. Please switch to Laundry workflow to enter by weight.',
                );
                return;
              }
              onEntryModeChange('WEIGHT');
            }}
            accessible={true}
            accessibilityLabel="By weight mode"
          >
            <Text
              style={[styles.modeToggleText, entryMode === 'WEIGHT' && styles.modeToggleTextActive]}
            >
              By Weight (Kg)
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Category Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryScroll}
      >
        {['ALL', 'MEN', 'WOMEN', 'KIDS', 'HOUSEHOLD', 'WEIGHT_BASED'].map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.categoryPill, activeCategory === cat && styles.categoryPillActive]}
            onPress={() => setActiveCategory(cat)}
            accessible={true}
            accessibilityLabel={`Filter by ${cat}`}
          >
            <Text
              style={[
                styles.categoryPillText,
                activeCategory === cat && styles.categoryPillTextActive,
              ]}
            >
              {cat === 'WEIGHT_BASED' ? '⚖️ By Weight' : cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Garment Grid / List */}
      <Text style={styles.sectionSubtitle}>Tap a garment to add ({filteredGarments.length})</Text>
      {isLoadingCatalog ? (
        <ActivityIndicator size="small" color="#2563eb" style={{ marginVertical: 16 }} />
      ) : (
        <View style={styles.garmentGrid}>
          {filteredGarments.map((g) => {
            const isWeight =
              g.category === GarmentCategory.WEIGHT_BASED || isWeightBasedCategory(g.category);
            return (
              <TouchableOpacity
                key={g.id}
                style={styles.garmentCard}
                onPress={() => handleOpenGarmentModal(g)}
                accessible={true}
                accessibilityLabel={`Add garment ${g.name}`}
              >
                <Text style={styles.garmentCardName}>{g.name}</Text>
                <View style={styles.garmentCardFooter}>
                  <Text style={styles.garmentCardCategory}>
                    {isWeight ? '⚖️ Weight' : g.category}
                  </Text>
                  <Text style={styles.garmentAddSign}>+ Add</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Selected Items List */}
      <View style={styles.selectedItemsSection}>
        <View style={styles.selectedHeaderRow}>
          <Text style={styles.selectedSectionTitle}>Order Items ({items.length})</Text>
          <Text style={styles.runningTotalText}>Est: ₹{estimatedSubtotal.toFixed(2)}</Text>
        </View>

        {items.length === 0 ? (
          <View style={styles.emptyItemsBox}>
            <Text style={styles.emptyItemsText}>
              No items added yet. Tap garments above to build the order.
            </Text>
          </View>
        ) : (
          items.map((item, index) => {
            const lineSubtotal = item.weight
              ? (item.unitPrice || 0) * item.weight
              : (item.unitPrice || 0) * (item.quantity || 1);

            return (
              <View key={index} style={styles.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemRowTitle}>{getGarmentName(item.garmentCatalogId)}</Text>
                  <Text style={styles.itemRowSubtitle}>
                    {getServiceName(item.serviceTypeId)} •{' '}
                    {item.weight
                      ? `${item.weight} kg (${item.quantity} pcs)`
                      : `${item.quantity} pc(s)`}
                    {' • '}₹{item.unitPrice} each
                  </Text>
                  {item.defectNotes ? (
                    <Text style={styles.itemDefectText}>⚠️ {item.defectNotes}</Text>
                  ) : null}
                </View>

                <View style={styles.itemRightCol}>
                  <Text style={styles.itemSubtotalText}>₹{lineSubtotal.toFixed(2)}</Text>
                  <View style={styles.itemActionRow}>
                    <TouchableOpacity
                      style={styles.itemEditBtn}
                      onPress={() => handleEditItem(index)}
                      accessible={true}
                      accessibilityLabel="Edit item"
                    >
                      <Text style={styles.itemEditBtnText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.itemRemoveBtn}
                      onPress={() => handleRemoveItem(index)}
                      accessible={true}
                      accessibilityLabel="Remove item"
                    >
                      <Text style={styles.itemRemoveBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* Item Configuration Modal */}
      <Modal visible={itemModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingItemIndex !== null ? 'Edit Item' : 'Add Item'}: {selectedGarment?.name}
              </Text>
              <TouchableOpacity
                onPress={() => setItemModalVisible(false)}
                style={styles.modalCloseBtn}
                accessible={true}
                accessibilityLabel="Close item configuration"
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              {/* Service Selection */}
              <Text style={styles.inputLabel}>Select Service</Text>
              <View style={styles.serviceSelectionRow}>
                {services.map((srv) => (
                  <TouchableOpacity
                    key={srv.id}
                    style={[
                      styles.serviceOptionPill,
                      selectedServiceId === srv.id && styles.serviceOptionPillActive,
                    ]}
                    onPress={() => handleServiceChange(srv.id)}
                  >
                    <Text
                      style={[
                        styles.serviceOptionText,
                        selectedServiceId === srv.id && styles.serviceOptionTextActive,
                      ]}
                    >
                      {formatCatalogServiceName(srv.name)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Weight Input if Weight-based */}
              {(selectedGarment?.category === GarmentCategory.WEIGHT_BASED ||
                isWeightBasedCategory(selectedGarment?.category || GarmentCategory.MEN) ||
                entryMode === 'WEIGHT') && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Measured Weight (kg) * [Min 2.00 kg]</Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      weightValidationError ? styles.inputErrorBorder : null,
                    ]}
                    value={weightInput}
                    onChangeText={(val) => {
                      setWeightInput(val);
                      setWeightValidationError(null);
                    }}
                    keyboardType="decimal-pad"
                    placeholder="2.00"
                    placeholderTextColor="#94a3b8"
                  />
                  {weightValidationError && (
                    <Text style={styles.errorText}>⚠️ {weightValidationError}</Text>
                  )}
                </View>
              )}

              {/* Quantity Stepper */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Quantity (Pieces) *</Text>
                <View style={styles.stepperRow}>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => {
                      const current = parseInt(quantityInput, 10) || 1;
                      if (current > 1) setQuantityInput(String(current - 1));
                    }}
                  >
                    <Text style={styles.stepperBtnText}>-</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={styles.stepperInput}
                    value={quantityInput}
                    onChangeText={setQuantityInput}
                    keyboardType="numeric"
                  />
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => {
                      const current = parseInt(quantityInput, 10) || 1;
                      setQuantityInput(String(current + 1));
                    }}
                  >
                    <Text style={styles.stepperBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Unit Price (Read-only unless canModifyPrice) */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Unit Rate (₹){' '}
                  {canModifyPrice ? '(Admin Overridable)' : '(Authoritative Catalog Rate)'}
                </Text>
                <TextInput
                  style={[styles.textInput, !canModifyPrice && styles.readOnlyInput]}
                  value={unitPriceInput}
                  onChangeText={setUnitPriceInput}
                  keyboardType="decimal-pad"
                  editable={canModifyPrice}
                />
              </View>

              {/* Defect Notes & Quick Chips */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Garment Remarks / Defect Notes</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.chipsScroll}
                >
                  {DEFECT_QUICK_TAGS.map((tag) => (
                    <TouchableOpacity
                      key={tag}
                      style={styles.chip}
                      onPress={() => {
                        if (defectNotes.includes(tag)) return;
                        setDefectNotes(defectNotes ? `${defectNotes}, ${tag}` : tag);
                      }}
                    >
                      <Text style={styles.chipText}>+ {tag}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TextInput
                  style={[styles.textInput, { height: 60 }]}
                  value={defectNotes}
                  onChangeText={setDefectNotes}
                  placeholder="e.g. Broken zipper, stain on collar"
                  placeholderTextColor="#94a3b8"
                  multiline
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.saveItemBtn}
                onPress={handleSaveItem}
                accessible={true}
                accessibilityLabel="Confirm and save garment item"
              >
                <Text style={styles.saveItemBtnText}>
                  {editingItemIndex !== null ? 'Update Item' : 'Add to Order'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
  },
  cachedNotice: {
    backgroundColor: '#eff6ff',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    marginBottom: 12,
  },
  cachedNoticeText: {
    fontSize: 12,
    color: '#1e40af',
  },
  workflowSelector: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 4,
    marginBottom: 12,
  },
  workflowButton: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  workflowButtonActive: {
    backgroundColor: '#2563eb',
  },
  workflowButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  workflowButtonTextActive: {
    color: '#ffffff',
  },
  entryModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  entryModeLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  modeToggleGroup: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    borderRadius: 6,
    padding: 2,
  },
  modeToggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 38,
    borderRadius: 5,
    justifyContent: 'center',
  },
  modeToggleBtnActive: {
    backgroundColor: '#ffffff',
  },
  modeToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  modeToggleTextActive: {
    color: '#0f172a',
  },
  categoryScroll: {
    gap: 8,
    paddingBottom: 8,
    marginBottom: 12,
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    minHeight: 44,
    justifyContent: 'center',
  },
  categoryPillActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#2563eb',
  },
  categoryPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  categoryPillTextActive: {
    color: '#ffffff',
  },
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  garmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  garmentCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    minHeight: 64,
    justifyContent: 'space-between',
  },
  garmentCardName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  garmentCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  garmentCardCategory: {
    fontSize: 11,
    color: '#64748b',
  },
  garmentAddSign: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563eb',
  },
  selectedItemsSection: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 12,
  },
  selectedHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  selectedSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  runningTotalText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#16a34a',
  },
  emptyItemsBox: {
    padding: 20,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    alignItems: 'center',
  },
  emptyItemsText: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
  itemRowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  itemRowSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  itemDefectText: {
    fontSize: 11,
    color: '#d97706',
    marginTop: 2,
  },
  itemRightCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  itemSubtotalText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  itemActionRow: {
    flexDirection: 'row',
    gap: 6,
  },
  itemEditBtn: {
    minHeight: 38,
    minWidth: 38,
    paddingHorizontal: 8,
    borderRadius: 4,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemEditBtnText: {
    fontSize: 11,
    color: '#2563eb',
    fontWeight: '600',
  },
  itemRemoveBtn: {
    minHeight: 38,
    minWidth: 38,
    paddingHorizontal: 8,
    borderRadius: 4,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemRemoveBtnText: {
    fontSize: 11,
    color: '#dc2626',
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '85%',
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
  },
  modalCloseBtn: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    fontSize: 20,
    color: '#64748b',
  },
  modalScroll: {
    paddingVertical: 12,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
    minHeight: 44,
  },
  inputErrorBorder: {
    borderColor: '#ef4444',
  },
  readOnlyInput: {
    backgroundColor: '#e2e8f0',
    color: '#64748b',
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 4,
  },
  serviceSelectionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  serviceOptionPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    minHeight: 44,
    justifyContent: 'center',
  },
  serviceOptionPillActive: {
    backgroundColor: '#2563eb',
    borderColor: '#1d4ed8',
  },
  serviceOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  serviceOptionTextActive: {
    color: '#ffffff',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepperBtn: {
    minHeight: 44,
    minWidth: 44,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  stepperBtnText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  stepperInput: {
    width: 60,
    minHeight: 44,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    fontSize: 16,
    fontWeight: '600',
  },
  chipsScroll: {
    marginBottom: 8,
  },
  chip: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 6,
    minHeight: 38,
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '500',
  },
  modalFooter: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  saveItemBtn: {
    backgroundColor: '#2563eb',
    minHeight: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveItemBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
