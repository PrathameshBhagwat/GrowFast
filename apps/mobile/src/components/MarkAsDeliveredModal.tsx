import React, { useState, useMemo, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  TextInput,
  Switch,
} from 'react-native';
import {
  OrderDetailDTO,
  OrderPickupRequest,
  PaymentMode,
  ItemStatus,
} from '@growfast/shared-types';
import { apiClient } from '../api/client';

interface MarkAsDeliveredModalProps {
  visible: boolean;
  order: OrderDetailDTO | null;
  onClose: () => void;
  onDeliveredSuccess: () => void;
}

export function MarkAsDeliveredModal({
  visible,
  order,
  onClose,
  onDeliveredSuccess,
}: MarkAsDeliveredModalProps) {
  const [selectedGarmentIds, setSelectedGarmentIds] = useState<Set<string>>(new Set());
  const [legacyQuantities, setLegacyQuantities] = useState<Record<string, number>>({});
  const [collectPayment, setCollectPayment] = useState<boolean>(false);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>(PaymentMode.UPI);
  const [notes, setNotes] = useState<string>('Delivered via mobile app');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Partition items into physical items and legacy items
  const { physicalItems, legacyItems, totalActiveUndeliveredCount } = useMemo(() => {
    if (!order) {
      return { physicalItems: [], legacyItems: [], totalActiveUndeliveredCount: 0 };
    }
    const pItems = (order.items || []).filter(
      (item) => item.physicalGarments && item.physicalGarments.length > 0,
    );
    const lItems = (order.items || []).filter(
      (item) =>
        (!item.physicalGarments || item.physicalGarments.length === 0) &&
        item.itemStatus !== ItemStatus.CANCELLED,
    );

    let totalUndelivered = 0;
    for (const item of pItems) {
      for (const pg of item.physicalGarments || []) {
        if (!pg.isCancelled && !pg.isDelivered) {
          totalUndelivered++;
        }
      }
    }
    for (const item of lItems) {
      const remaining = Math.max(0, item.quantity - (item.deliveredQuantity || 0));
      totalUndelivered += remaining;
    }

    return {
      physicalItems: pItems,
      legacyItems: lItems,
      totalActiveUndeliveredCount: totalUndelivered,
    };
  }, [order]);

  // Pre-select items whenever modal becomes visible with an order
  useEffect(() => {
    if (visible && order) {
      const initialGarmentIds = new Set<string>();
      let foundReady = false;

      // 1. First check if any physical garments are marked ready
      for (const item of physicalItems) {
        for (const pg of item.physicalGarments || []) {
          if (!pg.isCancelled && !pg.isDelivered && pg.isReady) {
            initialGarmentIds.add(pg.id);
            foundReady = true;
          }
        }
      }

      // If none are marked ready, default-select all active undelivered garments for staff handover
      if (!foundReady) {
        for (const item of physicalItems) {
          for (const pg of item.physicalGarments || []) {
            if (!pg.isCancelled && !pg.isDelivered) {
              initialGarmentIds.add(pg.id);
            }
          }
        }
      }
      setSelectedGarmentIds(initialGarmentIds);

      // 2. Select remaining legacy quantities
      const initialLegacy: Record<string, number> = {};
      for (const item of legacyItems) {
        const remaining = Math.max(0, item.quantity - (item.deliveredQuantity || 0));
        if (remaining > 0) {
          initialLegacy[item.id] = remaining;
        }
      }
      setLegacyQuantities(initialLegacy);

      // 3. Auto-enable payment collection if balance is due
      setCollectPayment(order.amountDue > 0);
      setNotes('Delivered via mobile app');
    }
  }, [visible, order, physicalItems, legacyItems]);

  const selectedPhysicalCount = selectedGarmentIds.size;
  const selectedLegacyCount = Object.values(legacyQuantities).reduce((sum, q) => sum + (q || 0), 0);
  const totalSelectedCount = selectedPhysicalCount + selectedLegacyCount;

  // Check if this pickup would deliver all remaining active items (final handover)
  const isFinalHandover = useMemo(() => {
    if (!order || totalSelectedCount === 0) return false;

    for (const item of physicalItems) {
      for (const pg of item.physicalGarments || []) {
        if (!pg.isCancelled && !pg.isDelivered) {
          if (!selectedGarmentIds.has(pg.id)) {
            return false;
          }
        }
      }
    }

    for (const item of legacyItems) {
      const remaining = Math.max(0, item.quantity - (item.deliveredQuantity || 0));
      const selectedQty = legacyQuantities[item.id] || 0;
      if (selectedQty < remaining) {
        return false;
      }
    }

    return true;
  }, [order, physicalItems, legacyItems, selectedGarmentIds, legacyQuantities, totalSelectedCount]);

  if (!order) return null;

  const todayStr = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const toggleGarment = (id: string) => {
    setSelectedGarmentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const updateLegacyQty = (itemId: string, delta: number, maxQty: number) => {
    setLegacyQuantities((prev) => {
      const current = prev[itemId] || 0;
      const next = Math.max(0, Math.min(maxQty, current + delta));
      if (next === 0) {
        const copy = { ...prev };
        delete copy[itemId];
        return copy;
      }
      return { ...prev, [itemId]: next };
    });
  };

  const handleSelectAll = () => {
    const allIds = new Set<string>();
    for (const item of physicalItems) {
      for (const pg of item.physicalGarments || []) {
        if (!pg.isCancelled && !pg.isDelivered) {
          allIds.add(pg.id);
        }
      }
    }
    setSelectedGarmentIds(allIds);

    const allLegacy: Record<string, number> = {};
    for (const item of legacyItems) {
      const remaining = Math.max(0, item.quantity - (item.deliveredQuantity || 0));
      if (remaining > 0) {
        allLegacy[item.id] = remaining;
      }
    }
    setLegacyQuantities(allLegacy);
  };

  const handleDeselectAll = () => {
    setSelectedGarmentIds(new Set());
    setLegacyQuantities({});
  };

  const handleConfirmDelivered = async () => {
    if (totalSelectedCount === 0) {
      Alert.alert(
        'No Items Selected',
        'Please select at least one garment or item for delivery handover.',
      );
      return;
    }

    // Backend settlement gate: If final handover and balance due without payment, reject
    if (isFinalHandover && order.amountDue > 0 && !collectPayment) {
      Alert.alert(
        'Outstanding Balance Required',
        `Order #${order.orderNumber} has an unpaid balance of ₹${order.amountDue.toFixed(2)}. Full payment must be settled before final delivery handover. Please toggle "Collect Balance at Handover".`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Collect Payment Now',
            onPress: () => setCollectPayment(true),
          },
        ],
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: OrderPickupRequest = {
        notes: notes.trim() || 'Delivered via mobile app',
      };

      if (selectedGarmentIds.size > 0) {
        payload.garmentIds = Array.from(selectedGarmentIds);
      }

      const legacyArray = Object.entries(legacyQuantities)
        .filter(([, qty]) => qty > 0)
        .map(([itemId, quantity]) => ({ itemId, quantity }));

      if (legacyArray.length > 0) {
        payload.legacyItems = legacyArray;
      }

      if (collectPayment && order.amountDue > 0) {
        payload.payment = {
          amount: Number(order.amountDue.toFixed(2)),
          mode: paymentMode,
          reference: 'Mobile handover collection',
        };
      }

      await apiClient.orders.recordPickup(order.id, payload);

      Alert.alert(
        'Delivery Recorded',
        `Successfully delivered ${totalSelectedCount} item(s) for Order #${order.orderNumber}.`,
      );
      onDeliveredSuccess();
      onClose();
    } catch (err: any) {
      Alert.alert(
        'Delivery Error',
        err?.message || 'Could not update order status. Please check network and retry.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const orderNumDisplay = order.orderNumber.startsWith('#')
    ? order.orderNumber
    : `#${order.orderNumber}`;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Top Header */}
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={styles.closeBtn}
            >
              <Text style={styles.backArrow}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Mark as Delivered</Text>
            <View style={{ width: 44 }} />
          </View>

          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Subheader with Order Number & Customer Name */}
            <View style={styles.orderRefRow}>
              <Text style={styles.orderRefNum}>{orderNumDisplay}</Text>
              <Text style={styles.orderRefCustomer}>{order.customerName}</Text>
            </View>

            {/* Delivery Date Badge */}
            <View style={styles.dateSelectorBox}>
              <Text style={styles.dateLabel}>Delivery Date</Text>
              <View style={styles.datePickerTrigger}>
                <Text style={styles.dateEmoji}>📅</Text>
                <Text style={styles.dateValue}>{todayStr}</Text>
                <Text style={styles.dateBadgeText}>Today</Text>
              </View>
            </View>

            {/* Garment / Item Selection Card */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={styles.cardTitle}>Items for Delivery</Text>
                  <Text style={styles.cardSubtitle}>
                    {totalSelectedCount} of {totalActiveUndeliveredCount} items selected
                  </Text>
                </View>
                <View style={styles.actionPillsRow}>
                  <TouchableOpacity
                    style={styles.pillActionBtn}
                    onPress={handleSelectAll}
                    disabled={isSubmitting}
                  >
                    <Text style={styles.pillActionText}>Select All</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.pillActionBtn}
                    onPress={handleDeselectAll}
                    disabled={isSubmitting}
                  >
                    <Text style={styles.pillActionText}>Clear</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Physical Garments Checklist */}
              {physicalItems.map((item) => (
                <View key={item.id} style={styles.itemGroupContainer}>
                  <Text style={styles.itemGroupName}>
                    {item.garmentName} ({item.serviceType})
                  </Text>
                  {(item.physicalGarments || []).map((pg) => {
                    const isSelected = selectedGarmentIds.has(pg.id);
                    const isDelivered = pg.isDelivered;
                    const isCancelled = pg.isCancelled;

                    if (isDelivered || isCancelled) {
                      return (
                        <View key={pg.id} style={[styles.garmentRow, styles.garmentRowDisabled]}>
                          <Text style={styles.disabledCheckmark}>✓</Text>
                          <Text style={styles.garmentLabelDisabled}>
                            Unit #{pg.unitNumber} {pg.tagId ? `(Tag: ${pg.tagId})` : ''} — Already
                            Delivered
                          </Text>
                        </View>
                      );
                    }

                    return (
                      <TouchableOpacity
                        key={pg.id}
                        style={[styles.garmentRow, isSelected && styles.garmentRowSelected]}
                        onPress={() => toggleGarment(pg.id)}
                        activeOpacity={0.7}
                        disabled={isSubmitting}
                      >
                        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                          {isSelected ? <Text style={styles.checkboxCheckmark}>✓</Text> : null}
                        </View>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={styles.garmentTitle}>
                            Unit #{pg.unitNumber} {pg.tagId ? `• Tag ${pg.tagId}` : ''}
                          </Text>
                          <Text style={styles.garmentStatusSubtitle}>
                            {pg.isReady ? 'Ready for Handover' : 'In Processing'}
                          </Text>
                        </View>
                        {pg.isReady ? (
                          <View style={styles.readyBadge}>
                            <Text style={styles.readyBadgeText}>Ready</Text>
                          </View>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}

              {/* Legacy Items Count Selector */}
              {legacyItems.map((item) => {
                const remaining = Math.max(0, item.quantity - (item.deliveredQuantity || 0));
                const currentSelected = legacyQuantities[item.id] || 0;

                if (remaining <= 0) return null;

                return (
                  <View key={item.id} style={styles.legacyItemRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.garmentTitle}>{item.garmentName}</Text>
                      <Text style={styles.garmentStatusSubtitle}>
                        {remaining} remaining for pickup
                      </Text>
                    </View>
                    <View style={styles.stepperContainer}>
                      <TouchableOpacity
                        style={styles.stepperBtn}
                        onPress={() => updateLegacyQty(item.id, -1, remaining)}
                        disabled={currentSelected <= 0 || isSubmitting}
                      >
                        <Text style={styles.stepperBtnText}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.stepperValue}>{currentSelected}</Text>
                      <TouchableOpacity
                        style={styles.stepperBtn}
                        onPress={() => updateLegacyQty(item.id, 1, remaining)}
                        disabled={currentSelected >= remaining || isSubmitting}
                      >
                        <Text style={styles.stepperBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Outstanding Balance & Inline Payment Section */}
            {order.amountDue > 0 ? (
              <View style={styles.card}>
                <View style={styles.paymentCardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.paymentCardTitle}>Outstanding Balance</Text>
                    <Text style={styles.paymentCardAmount}>₹{order.amountDue.toFixed(2)}</Text>
                  </View>
                  <Switch
                    value={collectPayment}
                    onValueChange={setCollectPayment}
                    trackColor={{ false: '#cbd5e1', true: '#2563eb' }}
                  />
                </View>

                {collectPayment ? (
                  <View style={styles.paymentOptionsContainer}>
                    <Text style={styles.paymentSubtitle}>Select Payment Mode at Handover:</Text>
                    <View style={styles.modeTabsRow}>
                      {[PaymentMode.UPI, PaymentMode.CASH, PaymentMode.CARD].map((mode) => (
                        <TouchableOpacity
                          key={mode}
                          style={[styles.modeTab, paymentMode === mode && styles.modeTabSelected]}
                          onPress={() => setPaymentMode(mode)}
                        >
                          <Text
                            style={[
                              styles.modeTabText,
                              paymentMode === mode && styles.modeTabTextSelected,
                            ]}
                          >
                            {mode}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ) : (
                  <Text style={styles.paymentWarningText}>
                    ⚠️ Backend settlement gate: Full payment must be settled to complete final
                    handover.
                  </Text>
                )}
              </View>
            ) : null}

            {/* Handover Notes */}
            <View style={styles.card}>
              <Text style={styles.notesLabel}>Handover Notes (Optional)</Text>
              <TextInput
                style={styles.notesInput}
                value={notes}
                onChangeText={setNotes}
                placeholder="e.g. Handed over to customer Rahul Sharma"
                placeholderTextColor="#94a3b8"
              />
            </View>
          </ScrollView>

          {/* Bottom Action Bar */}
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={[
                styles.confirmButton,
                (isSubmitting || totalSelectedCount === 0) && styles.buttonDisabled,
              ]}
              onPress={handleConfirmDelivered}
              disabled={isSubmitting || totalSelectedCount === 0}
              activeOpacity={0.8}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.confirmButtonText}>
                  Confirm Handover ({totalSelectedCount} items) →
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  closeBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backArrow: {
    fontSize: 32,
    color: '#0f172a',
    fontWeight: '300',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  orderRefRow: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  orderRefNum: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  orderRefCustomer: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '500',
  },
  dateSelectorBox: {
    marginBottom: 14,
  },
  dateLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
  },
  datePickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
  },
  dateEmoji: {
    fontSize: 16,
    marginRight: 8,
  },
  dateValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  dateBadgeText: {
    fontSize: 12,
    color: '#2563eb',
    fontWeight: '700',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  actionPillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pillActionBtn: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563eb',
  },
  itemGroupContainer: {
    marginBottom: 10,
  },
  itemGroupName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  garmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 6,
  },
  garmentRowSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  garmentRowDisabled: {
    opacity: 0.6,
    backgroundColor: '#f1f5f9',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#94a3b8',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  checkboxCheckmark: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  disabledCheckmark: {
    color: '#16a34a',
    fontSize: 14,
    fontWeight: 'bold',
    marginRight: 8,
  },
  garmentTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  garmentLabelDisabled: {
    fontSize: 12,
    color: '#64748b',
  },
  garmentStatusSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  readyBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  readyBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803d',
  },
  legacyItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepperBtn: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  stepperValue: {
    fontSize: 15,
    fontWeight: '700',
    minWidth: 24,
    textAlign: 'center',
    color: '#0f172a',
  },
  paymentCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentCardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  paymentCardAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: '#b91c1c',
    marginTop: 2,
  },
  paymentOptionsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  paymentSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  modeTabsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modeTab: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modeTabSelected: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  modeTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  modeTabTextSelected: {
    color: '#ffffff',
  },
  paymentWarningText: {
    fontSize: 11,
    color: '#b45309',
    marginTop: 8,
    backgroundColor: '#fef3c7',
    padding: 8,
    borderRadius: 6,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
  },
  notesInput: {
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#0f172a',
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  confirmButton: {
    height: 52,
    borderRadius: 26,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563eb',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 3,
  },
  buttonDisabled: {
    backgroundColor: '#93c5fd',
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
