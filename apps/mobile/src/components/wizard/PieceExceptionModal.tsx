import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  GarmentCatalogDTO,
  ServiceTypeDTO,
  CreateOrderItemRequest,
  formatCatalogServiceName,
} from '@growfast/shared-types';

export interface PieceExceptionModalProps {
  visible: boolean;
  garment: GarmentCatalogDTO | null;
  service: ServiceTypeDTO | null;
  unitPrice: number;
  existingItemIndex?: number;
  initialItem?: CreateOrderItemRequest | null;
  canModifyPrice?: boolean;
  onConfirm: (data: {
    garment: GarmentCatalogDTO;
    serviceId: string;
    unitPrice: number;
    quantity: number;
    defectNotes?: string;
    brand?: string;
    existingItemIndex?: number;
  }) => void;
  onClose: () => void;
}

const DEFECT_QUICK_TAGS = ['Collar Stain', 'Torn Hem', 'Missing Button', 'Color Bleed'];
const QTY_PRESETS = [1, 2, 3, 5, 10];
const PRICE_PRESETS = [30, 40, 50, 60, 80];

export function PieceExceptionModal({
  visible,
  garment,
  service,
  unitPrice,
  existingItemIndex,
  initialItem,
  canModifyPrice = false,
  onConfirm,
  onClose,
}: PieceExceptionModalProps) {
  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0,
  );

  const [quantity, setQuantity] = useState<number>(3);
  const [price, setPrice] = useState<number>(40);
  const [defectNotes, setDefectNotes] = useState<string>('');
  const [brand, setBrand] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible && garment) {
      if (initialItem) {
        setQuantity(initialItem.quantity || 1);
        setPrice(initialItem.unitPrice ?? (unitPrice > 0 ? unitPrice : 40));
        setDefectNotes(initialItem.defectNotes || '');
        setBrand((initialItem as any)?.brand || '');
      } else {
        setQuantity(3);
        setPrice(unitPrice > 0 ? unitPrice : 40);
        setDefectNotes('');
        setBrand('');
      }
      setError(null);
    }
  }, [visible, garment, initialItem, unitPrice]);

  const serviceName = service ? formatCatalogServiceName(service.name) : 'Dry Clean';
  const garmentName = garment?.name || 'Weight Based';
  const calculatedTotal = Math.max(0, quantity) * Math.max(0, price);

  const handleConfirm = () => {
    if (!garment || !service) {
      setError('Garment and service must be selected.');
      return;
    }
    if (quantity < 1) {
      setError('Quantity must be at least 1 piece.');
      return;
    }
    if (price < 0) {
      setError('Price cannot be negative.');
      return;
    }

    onConfirm({
      garment,
      serviceId: service.id,
      unitPrice: price,
      quantity,
      defectNotes: defectNotes.trim() || undefined,
      brand: brand.trim() || undefined,
      existingItemIndex,
    });
  };

  const toggleDefectTag = (tag: string) => {
    const trimmed = defectNotes.trim();
    if (!trimmed) {
      setDefectNotes(tag);
      return;
    }
    const tags = trimmed.split(',').map((t) => t.trim());
    if (tags.includes(tag)) {
      setDefectNotes(tags.filter((t) => t !== tag).join(', '));
    } else {
      setDefectNotes([...tags, tag].join(', '));
    }
  };

  if (!visible || !garment) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardContainer}
        >
          <View
            style={[
              styles.modalCard,
              { marginTop: topInset + 20, marginBottom: insets.bottom + 20 },
            ]}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={styles.headerIconContainer}>
                  <Text style={styles.headerIcon}>⚖️</Text>
                </View>
                <View style={styles.headerTitles}>
                  <Text style={styles.titleText}>Weight Based — Per Piece Entry</Text>
                  <Text style={styles.subtitleText} numberOfLines={1}>
                    {garmentName} • {serviceName} • Per Piece Exception
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={onClose}
                accessible={true}
                accessibilityLabel="Close modal"
              >
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Scrollable Body */}
            <ScrollView
              style={styles.bodyScroll}
              contentContainerStyle={styles.bodyContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* Notice Banner */}
              <View style={styles.noticeBanner}>
                <Text style={styles.noticeIcon}>ℹ️</Text>
                <Text style={styles.noticeText}>
                  <Text style={styles.noticeBold}>Notice:</Text> Strictly per-piece pricing
                  exception. No kilograms will be measured or billed.
                </Text>
              </View>

              {error ? (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {/* 1. Quantity / Number of Pieces */}
              <View style={styles.fieldSection}>
                <Text style={styles.fieldLabel}>
                  Quantity / Number of Pieces <Text style={styles.reqStar}>*</Text>
                </Text>
                <View style={styles.stepperRow}>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => setQuantity((prev) => Math.max(1, prev - 1))}
                    accessible={true}
                    accessibilityLabel="Decrease quantity"
                  >
                    <Text style={styles.stepperBtnText}>−</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={styles.numberInput}
                    keyboardType="number-pad"
                    value={String(quantity)}
                    onChangeText={(txt) => {
                      const val = parseInt(txt.replace(/\D/g, ''), 10);
                      setQuantity(isNaN(val) ? 1 : Math.max(1, val));
                    }}
                    accessible={true}
                    accessibilityLabel="Quantity input"
                  />
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => setQuantity((prev) => prev + 1)}
                    accessible={true}
                    accessibilityLabel="Increase quantity"
                  >
                    <Text style={styles.stepperBtnText}>+</Text>
                  </TouchableOpacity>
                </View>

                {/* Presets */}
                <View style={styles.presetsRow}>
                  {QTY_PRESETS.map((preset) => {
                    const isSelected = quantity === preset;
                    return (
                      <TouchableOpacity
                        key={preset}
                        style={[styles.presetBtn, isSelected && styles.presetBtnActive]}
                        onPress={() => setQuantity(preset)}
                        accessible={true}
                        accessibilityLabel={`${preset} pieces preset`}
                      >
                        <Text
                          style={[styles.presetBtnText, isSelected && styles.presetBtnTextActive]}
                        >
                          {preset} {preset === 1 ? 'pc' : 'pcs'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* 2. Price Per Piece (₹) */}
              <View style={styles.fieldSection}>
                <View style={styles.priceHeaderRow}>
                  <Text style={styles.fieldLabel}>
                    Price Per Piece (₹) <Text style={styles.reqStar}>*</Text>
                  </Text>
                  {!canModifyPrice ? (
                    <View style={styles.readOnlyBadge}>
                      <Text style={styles.readOnlyBadgeText}>Configured Rate (View Only)</Text>
                    </View>
                  ) : null}
                </View>

                <TextInput
                  style={[styles.numberInput, !canModifyPrice && styles.numberInputDisabled]}
                  keyboardType="numeric"
                  editable={canModifyPrice}
                  value={String(price)}
                  onChangeText={(txt) => {
                    if (!canModifyPrice) return;
                    const val = parseFloat(txt.replace(/[^0-9.]/g, ''));
                    setPrice(isNaN(val) ? 0 : Math.max(0, val));
                  }}
                  accessible={true}
                  accessibilityLabel="Price per piece input"
                />

                {canModifyPrice ? (
                  <View style={styles.presetsRow}>
                    {PRICE_PRESETS.map((preset) => {
                      const isSelected = price === preset;
                      return (
                        <TouchableOpacity
                          key={preset}
                          style={[styles.presetBtn, isSelected && styles.presetBtnActive]}
                          onPress={() => setPrice(preset)}
                          accessible={true}
                          accessibilityLabel={`₹${preset} preset`}
                        >
                          <Text
                            style={[styles.presetBtnText, isSelected && styles.presetBtnTextActive]}
                          >
                            ₹{preset}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : null}
              </View>

              {/* 3. Calculated Total Box */}
              <View style={styles.totalBox}>
                <Text style={styles.totalBoxTitle}>CALCULATED TOTAL</Text>
                <View style={styles.totalCalculationRow}>
                  <Text style={styles.totalFormulaText}>
                    {quantity} × ₹{price} =
                  </Text>
                  <Text style={styles.totalAmountText}>₹{calculatedTotal.toFixed(0)}</Text>
                </View>
              </View>

              {/* 4. Defect / Item Notes */}
              <View style={styles.fieldSection}>
                <Text style={styles.fieldLabel}>Defect / Item Notes (Optional)</Text>
                <View style={styles.defectTagsRow}>
                  {DEFECT_QUICK_TAGS.map((tag) => {
                    const isActive = defectNotes.toLowerCase().includes(tag.toLowerCase());
                    return (
                      <TouchableOpacity
                        key={tag}
                        style={[styles.defectTag, isActive && styles.defectTagActive]}
                        onPress={() => toggleDefectTag(tag)}
                        accessible={true}
                        accessibilityLabel={`Quick tag ${tag}`}
                      >
                        <Text
                          style={[styles.defectTagText, isActive && styles.defectTagTextActive]}
                        >
                          {tag}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Stains on collar, torn hem, missing buttons"
                  placeholderTextColor="#94a3b8"
                  value={defectNotes}
                  onChangeText={setDefectNotes}
                  accessible={true}
                  accessibilityLabel="Defect notes input"
                />
              </View>

              {/* 5. Brand / Tag / Remarks */}
              <View style={styles.fieldSection}>
                <Text style={styles.fieldLabel}>Brand / Tag / Remarks (Optional)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Raymond, Zara, Blue linen"
                  placeholderTextColor="#94a3b8"
                  value={brand}
                  onChangeText={setBrand}
                  accessible={true}
                  accessibilityLabel="Brand or remarks input"
                />
              </View>
            </ScrollView>

            {/* Footer Actions */}
            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={onClose}
                accessible={true}
                accessibilityLabel="Cancel piece exception"
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={handleConfirm}
                accessible={true}
                accessibilityLabel="Add piece exception to order"
              >
                <Text style={styles.confirmBtnIcon}>✓</Text>
                <Text style={styles.confirmBtnText}>
                  {initialItem ? 'Save Changes' : 'Add to Order'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  keyboardContainer: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '94%',
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  headerIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerIcon: {
    fontSize: 20,
  },
  headerTitles: {
    flex: 1,
  },
  titleText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitleText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  closeBtnText: {
    fontSize: 18,
    color: '#64748b',
    fontWeight: '700',
  },
  bodyScroll: {
    flexGrow: 1,
    flexShrink: 1,
  },
  bodyContent: {
    padding: 18,
    gap: 16,
  },
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  noticeIcon: {
    fontSize: 16,
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    color: '#92400e',
    lineHeight: 17,
  },
  noticeBold: {
    fontWeight: '800',
  },
  errorBanner: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 8,
    padding: 10,
  },
  errorText: {
    fontSize: 12,
    color: '#b91c1c',
    fontWeight: '600',
  },
  fieldSection: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  reqStar: {
    color: '#ef4444',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepperBtn: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1e293b',
    lineHeight: 24,
  },
  numberInput: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    backgroundColor: '#ffffff',
    textAlign: 'center',
  },
  numberInputDisabled: {
    backgroundColor: '#f1f5f9',
    color: '#64748b',
    borderColor: '#e2e8f0',
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  presetBtn: {
    minHeight: 38,
    minWidth: 54,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetBtnActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  presetBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  presetBtnTextActive: {
    color: '#ffffff',
  },
  priceHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  readOnlyBadge: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  readOnlyBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
  },
  totalBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 14,
    gap: 4,
  },
  totalBoxTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  totalCalculationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalFormulaText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  totalAmountText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#2563eb',
  },
  defectTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  defectTag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  defectTagActive: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
  },
  defectTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  defectTagTextActive: {
    color: '#b45309',
    fontWeight: '700',
  },
  textInput: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 13,
    color: '#0f172a',
    backgroundColor: '#ffffff',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  cancelBtn: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  confirmBtn: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  confirmBtnIcon: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  confirmBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },
});
