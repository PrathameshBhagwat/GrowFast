import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import {
  CreateOrderItemRequest,
  GarmentCatalogDTO,
  ServiceTypeDTO,
  formatCatalogServiceName,
  roundCurrency,
} from '@growfast/shared-types';
import { PendingPhoto } from '../../db/photos';

export interface OrderItemsReviewStepProps {
  items: CreateOrderItemRequest[];
  garments: GarmentCatalogDTO[];
  services: ServiceTypeDTO[];
  photos: PendingPhoto[];
  onEditItem: (index: number) => void;
  onRemoveItem: (index: number) => void;
  onAddMoreItems: () => void;
  onContinueToFinalReview: () => void;
  onUpdateItemQuantity?: (index: number, newQty: number) => void;
}

export function OrderItemsReviewStep({
  items,
  garments,
  services,
  photos,
  onEditItem,
  onRemoveItem,
  onAddMoreItems,
  onContinueToFinalReview,
  onUpdateItemQuantity,
}: OrderItemsReviewStepProps) {
  // Helpers
  const getGarmentName = (id: string): string => {
    const g = garments.find((item) => item.id === id);
    return g ? g.name : 'Garment';
  };

  const getServiceName = (id: string): string => {
    const s = services.find((item) => item.id === id);
    return s ? formatCatalogServiceName(s.name) : 'Standard Service';
  };

  const getPhotoCountForGarment = (garmentId: string): number => {
    return photos.filter((p) => p.garmentId === garmentId).length;
  };

  // Summaries
  const totalPieces = useMemo(() => {
    return items.reduce((sum, it) => sum + (it.quantity || 1), 0);
  }, [items]);

  const totalWeight = useMemo(() => {
    return items.reduce((sum, it) => sum + (it.weight || 0), 0);
  }, [items]);

  const subtotal = useMemo(() => {
    return items.reduce((sum, it) => {
      const multiplier = it.weight && it.weight > 0 ? it.weight : it.quantity || 1;
      return sum + roundCurrency((it.unitPrice || 0) * multiplier);
    }, 0);
  }, [items]);

  const handleConfirmRemove = (index: number) => {
    const item = items[index];
    const name = getGarmentName(item.garmentCatalogId);
    Alert.alert('Remove Item', `Are you sure you want to remove ${name} from this order?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => onRemoveItem(index),
      },
    ]);
  };

  if (items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyEmoji}>🛒</Text>
        <Text style={styles.emptyTitle}>Your cart is empty</Text>
        <Text style={styles.emptySubtitle}>Add garments or laundry items from the catalog.</Text>
        <TouchableOpacity
          style={styles.browseButton}
          onPress={onAddMoreItems}
          accessible={true}
          accessibilityLabel="Browse garment catalog"
        >
          <Text style={styles.browseButtonText}>＋ Browse Catalog</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Top Summary Banner */}
        <View style={styles.summaryBar}>
          <View style={styles.summaryBarItem}>
            <Text style={styles.summaryBarValue}>{totalPieces}</Text>
            <Text style={styles.summaryBarLabel}>Pieces</Text>
          </View>
          {totalWeight > 0 && (
            <View style={styles.summaryBarItem}>
              <Text style={styles.summaryBarValue}>{totalWeight.toFixed(2)} kg</Text>
              <Text style={styles.summaryBarLabel}>Weight</Text>
            </View>
          )}
          <View style={styles.summaryBarItem}>
            <Text style={styles.summaryBarValue}>{photos.length}</Text>
            <Text style={styles.summaryBarLabel}>Photos</Text>
          </View>
          <View style={styles.summaryBarItem}>
            <Text style={styles.summaryBarTotal}>₹{subtotal.toFixed(2)}</Text>
            <Text style={styles.summaryBarLabel}>Est. Subtotal</Text>
          </View>
        </View>

        {/* Action button to add more items */}
        <TouchableOpacity
          style={styles.addMoreButton}
          onPress={onAddMoreItems}
          accessible={true}
          accessibilityLabel="Add more items to order"
        >
          <Text style={styles.addMoreButtonText}>＋ Add More Items from Catalog</Text>
        </TouchableOpacity>

        {/* Itemized Cart List */}
        <Text style={styles.listSectionTitle}>Order Items ({items.length})</Text>

        {items.map((it, idx) => {
          const isWeight = it.weight != null && it.weight > 0;
          const multiplier = isWeight ? it.weight! : it.quantity || 1;
          const lineTotal = roundCurrency((it.unitPrice || 0) * multiplier);
          const garmentPhotoCount = getPhotoCountForGarment(it.garmentCatalogId);

          return (
            <View key={idx} style={styles.itemCard}>
              <View style={styles.itemHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{getGarmentName(it.garmentCatalogId)}</Text>
                  <Text style={styles.itemService}>{getServiceName(it.serviceTypeId)}</Text>
                </View>
                <Text style={styles.itemLineTotal}>₹{lineTotal.toFixed(2)}</Text>
              </View>

              {/* Quantity / Weight and Rate Details */}
              <View style={styles.itemMetaRow}>
                <Text style={styles.itemMetaText}>
                  {isWeight
                    ? `${it.weight?.toFixed(2)} kg × ₹${it.unitPrice?.toFixed(2)}/kg`
                    : `${it.quantity} pc × ₹${it.unitPrice?.toFixed(2)}/pc`}
                </Text>

                {garmentPhotoCount > 0 && (
                  <View style={styles.photoTag}>
                    <Text style={styles.photoTagText}>📷 {garmentPhotoCount} photo(s)</Text>
                  </View>
                )}
              </View>

              {/* Defect Notes */}
              {it.defectNotes && (
                <View style={styles.defectBox}>
                  <Text style={styles.defectBoxText}>⚠️ Defect: {it.defectNotes}</Text>
                </View>
              )}

              {/* Action Buttons & Inline Stepper (Workstream 2) */}
              <View style={styles.itemActionsRow}>
                {!isWeight && onUpdateItemQuantity ? (
                  <View style={styles.inlineStepperBox}>
                    <TouchableOpacity
                      style={styles.inlineStepperBtn}
                      onPress={() => {
                        const current = it.quantity || 1;
                        if (current <= 1) {
                          handleConfirmRemove(idx);
                        } else {
                          onUpdateItemQuantity(idx, current - 1);
                        }
                      }}
                      accessible={true}
                      accessibilityLabel={`Decrease quantity of ${getGarmentName(it.garmentCatalogId)}`}
                    >
                      <Text style={styles.inlineStepperBtnText}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.inlineStepperQty}>{it.quantity || 1}</Text>
                    <TouchableOpacity
                      style={styles.inlineStepperBtn}
                      onPress={() => {
                        const current = it.quantity || 1;
                        onUpdateItemQuantity(idx, current + 1);
                      }}
                      accessible={true}
                      accessibilityLabel={`Increase quantity of ${getGarmentName(it.garmentCatalogId)}`}
                    >
                      <Text style={styles.inlineStepperBtnText}>＋</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => onEditItem(idx)}
                  accessible={true}
                  accessibilityLabel={`Edit details for ${getGarmentName(it.garmentCatalogId)}`}
                >
                  <Text style={styles.editBtnText}>✏️ Edit Details</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => handleConfirmRemove(idx)}
                  accessible={true}
                  accessibilityLabel={`Remove ${getGarmentName(it.garmentCatalogId)} from cart`}
                >
                  <Text style={styles.removeBtnText}>🗑️ Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Bottom Sticky Action Bar */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomBarTotals}>
          <Text style={styles.bottomBarSubtotalLabel}>PROVISIONAL SUBTOTAL</Text>
          <Text style={styles.bottomBarSubtotalValue}>₹{subtotal.toFixed(2)}</Text>
        </View>

        <TouchableOpacity
          style={styles.continueButton}
          onPress={onContinueToFinalReview}
          accessible={true}
          accessibilityLabel="Continue to Final Order Review"
        >
          <Text style={styles.continueButtonText}>Review Order →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  summaryBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  summaryBarItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#f1f5f9',
  },
  summaryBarValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  summaryBarTotal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2563eb',
  },
  summaryBarLabel: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  addMoreButton: {
    backgroundColor: '#eff6ff',
    borderWidth: 1.5,
    borderColor: '#bfdbfe',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    minHeight: 46,
  },
  addMoreButtonText: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '700',
  },
  listSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 10,
  },
  itemCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  itemHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
  },
  itemService: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563eb',
    marginTop: 2,
  },
  itemLineTotal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  itemMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  itemMetaText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  photoTag: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  photoTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1d4ed8',
  },
  defectBox: {
    backgroundColor: '#fef3c7',
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  defectBoxText: {
    fontSize: 12,
    color: '#b45309',
    fontWeight: '600',
  },
  itemActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 8,
    marginTop: 4,
  },
  inlineStepperBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    minHeight: 36,
    paddingHorizontal: 2,
    marginRight: 4,
  },
  inlineStepperBtn: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    backgroundColor: '#f1f5f9',
  },
  inlineStepperBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    lineHeight: 18,
  },
  inlineStepperQty: {
    paddingHorizontal: 8,
    fontSize: 13,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  editBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#f1f5f9',
    borderRadius: 6,
    minHeight: 36,
    justifyContent: 'center',
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  removeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#fee2e2',
    borderRadius: 6,
    minHeight: 36,
    justifyContent: 'center',
  },
  removeBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#b91c1c',
  },
  bottomBar: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 4,
  },
  bottomBarTotals: {
    flex: 1,
  },
  bottomBarSubtotalLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  bottomBarSubtotalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  continueButton: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    minHeight: 46,
    justifyContent: 'center',
    alignItems: 'center',
  },
  continueButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 20,
  },
  browseButton: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    minHeight: 44,
  },
  browseButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
