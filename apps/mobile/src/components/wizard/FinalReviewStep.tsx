import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  CreateOrderItemRequest,
  CustomerDTO,
  OrderWorkflowType,
  PickupType,
  ExpressDeliveryOption,
  ServiceTypeDTO,
  GarmentCatalogDTO,
  calculateOrderTotals,
  isPhotoRequiredForOrder,
  getExpressMultiplier,
  getDayOfWeekInTimezone,
  adjustDueDateForThursday,
  formatCatalogServiceName,
} from '@growfast/shared-types';
import { PendingPhoto } from '../../db/photos';
import { PhotoQueueView } from '../PhotoQueueView';

export interface FinalReviewStepProps {
  clientDraftId: string;
  customer: CustomerDTO | null;
  manualCustomerName: string;
  manualCustomerPhone: string;
  workflow: OrderWorkflowType;
  pickupType: PickupType;
  onPickupTypeChange: (type: PickupType) => void;
  expressOption: ExpressDeliveryOption;
  onExpressOptionChange: (option: ExpressDeliveryOption) => void;
  items: CreateOrderItemRequest[];
  garments: GarmentCatalogDTO[];
  services: ServiceTypeDTO[];
  notes: string;
  onNotesChange: (notes: string) => void;
  photos: PendingPhoto[];
  isConnected: boolean;
  storeConfig?: { expressSurchargePercent?: number | null } | null;
  onSaveDraft: () => Promise<void>;
  onSubmitOrder: () => Promise<{
    success: boolean;
    orderId?: string;
    orderNumber?: string;
    isConflict?: boolean;
    error?: string;
  }>;
  onOrderSuccess: (order: { orderId: string; orderNumber: string }) => void;
  onPhotosUpdated?: () => void;
}

export function FinalReviewStep({
  clientDraftId,
  customer,
  manualCustomerName,
  manualCustomerPhone,
  workflow,
  pickupType,
  onPickupTypeChange,
  expressOption,
  onExpressOptionChange,
  items,
  garments,
  services,
  notes,
  onNotesChange,
  photos,
  isConnected,
  storeConfig,
  onSaveDraft,
  onSubmitOrder,
  onOrderSuccess,
  onPhotosUpdated,
}: FinalReviewStepProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Day of week in Asia/Kolkata timezone
  const currentDayOfWeek = useMemo(() => {
    return getDayOfWeekInTimezone(new Date(), 'Asia/Kolkata');
  }, []);
  const isThursday = currentDayOfWeek === 4;
  const isWednesday = currentDayOfWeek === 3;

  // Pricing calculations
  const isExpress = expressOption !== ExpressDeliveryOption.REGULAR;
  const pricingItems = useMemo(() => {
    return items.map((it) => ({
      quantity: it.quantity || 1,
      unitPrice: it.unitPrice || 0,
      weight: it.weight ?? null,
    }));
  }, [items]);

  const discountPercent = customer?.discountPercent || 0;
  const effectiveSurchargeRate =
    storeConfig?.expressSurchargePercent != null ? storeConfig.expressSurchargePercent : 50;

  const pricingTotals = useMemo(() => {
    return calculateOrderTotals(pricingItems, {
      isExpress,
      expressSurchargePercent: isExpress ? effectiveSurchargeRate : undefined,
      expressDeliveryOption: expressOption,
      discountPercent,
    });
  }, [pricingItems, isExpress, effectiveSurchargeRate, expressOption, discountPercent]);

  // Turnaround and Due-Date preview calculation
  const estimatedDueDate = useMemo(() => {
    // 1. Find max estimated days among order items
    let maxDays = 2;
    for (const it of items) {
      const s = services.find((svc) => svc.id === it.serviceTypeId);
      if (s?.estimatedDays && s.estimatedDays > maxDays) {
        maxDays = s.estimatedDays;
      }
    }

    const calculatedDue = new Date();
    if (isExpress) {
      if (expressOption === ExpressDeliveryOption.SAME_DAY) {
        // Due today
      } else if (expressOption === ExpressDeliveryOption.NEXT_DAY_EVENING) {
        calculatedDue.setDate(calculatedDue.getDate() + 1);
      } else {
        calculatedDue.setDate(calculatedDue.getDate() + Math.ceil(maxDays / 2));
      }
    } else {
      calculatedDue.setDate(calculatedDue.getDate() + maxDays);
    }

    // Adjust for Thursday store off
    const finalDate = adjustDueDateForThursday(calculatedDue);
    return finalDate.toLocaleDateString('en-IN', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }, [items, services, isExpress, expressOption]);

  // Photo requirement validation
  const totalPieces = items.reduce((acc, it) => acc + (it.quantity || 1), 0);
  const isWeightBased = items.some((it) => it.weight != null && it.weight > 0);
  const photoRequired = isPhotoRequiredForOrder({
    isWalkIn: pickupType === PickupType.STORE_PICKUP,
    totalPieces,
    isWeightBased,
  });

  const displayName = customer?.name || manualCustomerName || 'Walk-in Customer';
  const displayPhone = customer?.phone || manualCustomerPhone || 'No phone provided';

  const handleSaveLocalDraft = async () => {
    setIsSaving(true);
    try {
      await onSaveDraft();
      Alert.alert('Draft Saved', 'Your order draft is safely stored in local device storage.');
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Could not save draft locally');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmSubmit = async () => {
    if (items.length === 0) {
      Alert.alert('Validation Error', 'Cannot submit an order with zero items.');
      return;
    }

    if (photoRequired && photos.length === 0) {
      Alert.alert(
        'Intake Photo Required',
        'Store walk-in policy requires at least one intake photograph of garments before workshop submission.',
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await onSubmitOrder();
      if (result.success && result.orderId) {
        onOrderSuccess({
          orderId: result.orderId,
          orderNumber: result.orderNumber || result.orderId,
        });
      } else if (result.isConflict) {
        Alert.alert(
          'Server Conflict (409)',
          result.error || 'Server reported a conflict with existing records.',
        );
      } else {
        if (!isConnected) {
          Alert.alert(
            'Order Queued Offline',
            'Your order has been queued in local storage. It will synchronize automatically when connection returns.',
          );
          onOrderSuccess({
            orderId: 'offline-queued',
            orderNumber: 'QUEUED',
          });
        } else {
          Alert.alert('Submission Error', result.error || 'Failed to submit order to server.');
        }
      }
    } catch (err: any) {
      Alert.alert('Submission Exception', err.message || 'An error occurred during submission.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Offline Status Callout if applicable */}
      {!isConnected && (
        <View style={styles.offlineNotice}>
          <Text style={styles.offlineNoticeTitle}>⚠️ Device is Offline</Text>
          <Text style={styles.offlineNoticeText}>
            Submitting will queue this order in your local SQLite queue. It will synchronize
            automatically and receive an official server order number when you reconnect.
          </Text>
        </View>
      )}

      {/* 1. Customer Information Card */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>Customer Details</Text>
          {customer?.membership && customer.membership !== 'NONE' && (
            <View style={styles.membershipBadge}>
              <Text style={styles.membershipBadgeText}>{customer.membership} MEMBER</Text>
            </View>
          )}
        </View>

        <Text style={styles.customerName}>{displayName}</Text>
        <Text style={styles.customerPhone}>📞 {displayPhone}</Text>
        {customer?.address ? (
          <Text style={styles.customerAddress}>📍 {customer.address}</Text>
        ) : null}
      </View>

      {/* 2. Fulfillment & Pickup Method */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Fulfillment Method</Text>
        <View style={styles.radioGroupRow}>
          <TouchableOpacity
            style={[
              styles.radioChip,
              pickupType === PickupType.STORE_PICKUP && styles.radioChipActive,
            ]}
            onPress={() => onPickupTypeChange(PickupType.STORE_PICKUP)}
            accessible={true}
            accessibilityLabel="Store Counter Pickup"
          >
            <Text
              style={[
                styles.radioChipText,
                pickupType === PickupType.STORE_PICKUP && styles.radioChipTextActive,
              ]}
            >
              🏪 Store Counter Pickup
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.radioChip,
              pickupType === PickupType.HOME_DELIVERY && styles.radioChipActive,
            ]}
            onPress={() => onPickupTypeChange(PickupType.HOME_DELIVERY)}
            accessible={true}
            accessibilityLabel="Home Delivery"
          >
            <Text
              style={[
                styles.radioChipText,
                pickupType === PickupType.HOME_DELIVERY && styles.radioChipTextActive,
              ]}
            >
              🚚 Home Delivery
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 3. Turnaround & Express Service */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Turnaround Speed & Surcharge</Text>

        {/* Regular */}
        <TouchableOpacity
          style={[
            styles.turnaroundOption,
            expressOption === ExpressDeliveryOption.REGULAR && styles.turnaroundOptionActive,
          ]}
          onPress={() => onExpressOptionChange(ExpressDeliveryOption.REGULAR)}
          accessible={true}
          accessibilityLabel="Regular delivery speed"
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.turnaroundTitle}>Regular Turnaround</Text>
            <Text style={styles.turnaroundSubtitle}>Standard turnaround (48-72 hours)</Text>
          </View>
          <Text style={styles.turnaroundMultiplier}>Standard (0%)</Text>
        </TouchableOpacity>

        {/* Next-Day Evening */}
        <TouchableOpacity
          style={[
            styles.turnaroundOption,
            expressOption === ExpressDeliveryOption.NEXT_DAY_EVENING &&
              styles.turnaroundOptionActive,
            isWednesday && styles.turnaroundOptionDisabled,
          ]}
          onPress={() => {
            if (isWednesday) {
              Alert.alert(
                'Schedule Restriction',
                'Next-Day Evening Express is unavailable on Wednesdays because Thursdays are store weekly off.',
              );
              return;
            }
            onExpressOptionChange(ExpressDeliveryOption.NEXT_DAY_EVENING);
          }}
          accessible={true}
          accessibilityLabel="Next-Day Evening Express"
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.turnaroundTitle, isWednesday && { color: '#94a3b8' }]}>
              ⚡ Next-Day Evening Express
            </Text>
            <Text style={styles.turnaroundSubtitle}>
              {isWednesday
                ? 'Unavailable on Wednesdays (Thursday store weekly off)'
                : 'Delivered tomorrow evening (+50% surcharge)'}
            </Text>
          </View>
          <Text style={[styles.turnaroundMultiplier, isWednesday && { color: '#94a3b8' }]}>
            1.5× (+50%)
          </Text>
        </TouchableOpacity>

        {/* Same-Day Urgent */}
        <TouchableOpacity
          style={[
            styles.turnaroundOption,
            expressOption === ExpressDeliveryOption.SAME_DAY && styles.turnaroundOptionActive,
            isThursday && styles.turnaroundOptionDisabled,
          ]}
          onPress={() => {
            if (isThursday) {
              Alert.alert(
                'Schedule Restriction',
                'Same-Day Urgent Express is unavailable on Thursdays because the workshop is closed for weekly off.',
              );
              return;
            }
            onExpressOptionChange(ExpressDeliveryOption.SAME_DAY);
          }}
          accessible={true}
          accessibilityLabel="Same-Day Urgent Express"
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.turnaroundTitle, isThursday && { color: '#94a3b8' }]}>
              🔥 Same-Day Urgent Express
            </Text>
            <Text style={styles.turnaroundSubtitle}>
              {isThursday
                ? 'Unavailable on Thursdays (Store weekly off)'
                : 'Top-priority cycle delivered today (+100% surcharge)'}
            </Text>
          </View>
          <Text style={[styles.turnaroundMultiplier, isThursday && { color: '#94a3b8' }]}>
            2.0× (+100%)
          </Text>
        </TouchableOpacity>

        {/* Estimated Due Date Preview Banner */}
        <View style={styles.dueDateBanner}>
          <Text style={styles.dueDateIcon}>📅</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.dueDateLabel}>ESTIMATED SYSTEM DUE DATE</Text>
            <Text style={styles.dueDateValue}>{estimatedDueDate}</Text>
            <Text style={styles.dueDateNote}>
              Includes Thursday weekly-off adjustment. Final confirmation by server.
            </Text>
          </View>
        </View>
      </View>

      {/* 4. Garment Intake Photos */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>Intake & Garment Photos</Text>
          <View
            style={[
              styles.membershipBadge,
              photoRequired && photos.length === 0
                ? styles.badgeDangerStyle
                : styles.badgeSuccessStyle,
            ]}
          >
            <Text
              style={[
                styles.membershipBadgeText,
                photoRequired && photos.length === 0
                  ? styles.badgeDangerTextStyle
                  : styles.badgeSuccessTextStyle,
              ]}
            >
              {photoRequired
                ? photos.length === 0
                  ? '⚠️ PHOTO REQUIRED'
                  : '✓ PHOTO ATTACHED'
                : 'OPTIONAL'}
            </Text>
          </View>
        </View>

        <Text style={styles.photoPolicyText}>
          {photoRequired
            ? 'Store walk-in policy requires at least one intake photograph of garments before workshop submission.'
            : 'Capture or select photos of garments, tags, or special care requirements.'}
        </Text>

        <PhotoQueueView
          clientDraftId={clientDraftId}
          photos={photos}
          onPhotosChanged={onPhotosUpdated || (() => {})}
        />
      </View>

      {/* 5. Order Notes Input */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Special Instructions / Notes</Text>
        <TextInput
          style={styles.notesInput}
          placeholder="e.g. Wash separately, customer requested light starch..."
          placeholderTextColor="#94a3b8"
          value={notes}
          onChangeText={onNotesChange}
          multiline
          numberOfLines={2}
          accessible={true}
          accessibilityLabel="Order special instructions input"
        />
      </View>

      {/* 5. Authoritative Bill Breakdown */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Provisional Financial Ledger</Text>

        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Items Subtotal ({totalPieces} pcs):</Text>
          <Text style={styles.priceValue}>₹{pricingTotals.subtotal.toFixed(2)}</Text>
        </View>

        {pricingTotals.discountAmount > 0 && (
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Customer Discount ({discountPercent}%):</Text>
            <Text style={styles.discountValue}>-₹{pricingTotals.discountAmount.toFixed(2)}</Text>
          </View>
        )}

        {isExpress && (
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Express Surcharge:</Text>
            <Text style={styles.surchargeValue}>+₹{pricingTotals.expressSurcharge.toFixed(2)}</Text>
          </View>
        )}

        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>GST (18% Applicable Tax):</Text>
          <Text style={styles.priceValue}>₹{pricingTotals.taxAmount.toFixed(2)}</Text>
        </View>

        <View style={[styles.priceRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Provisional Grand Total:</Text>
          <Text style={styles.totalValue}>₹{pricingTotals.totalAmount.toFixed(2)}</Text>
        </View>

        <Text style={styles.provisionalDisclaimer}>
          * Provisional calculation. Official total and taxes are confirmed upon server commit.
        </Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={styles.submitOrderBtn}
          onPress={handleConfirmSubmit}
          disabled={isSubmitting}
          accessible={true}
          accessibilityLabel="Confirm and Create Order"
        >
          {isSubmitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.submitOrderBtnText}>
              ✓ Confirm & Create Order (₹{pricingTotals.totalAmount.toFixed(2)})
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.saveDraftBtn}
          onPress={handleSaveLocalDraft}
          disabled={isSaving || isSubmitting}
          accessible={true}
          accessibilityLabel="Save as Local Draft"
        >
          {isSaving ? (
            <ActivityIndicator color="#475569" />
          ) : (
            <Text style={styles.saveDraftBtnText}>💾 Save as Offline Draft</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  offlineNotice: {
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#fde68a',
    marginBottom: 16,
  },
  offlineNoticeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#b45309',
    marginBottom: 4,
  },
  offlineNoticeText: {
    fontSize: 12,
    color: '#92400e',
    lineHeight: 18,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  membershipBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  membershipBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#b45309',
  },
  photoPolicyText: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 8,
    lineHeight: 16,
  },
  badgeDangerStyle: {
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
  },
  badgeDangerTextStyle: {
    color: '#b91c1c',
  },
  badgeSuccessStyle: {
    backgroundColor: '#dcfce7',
    borderColor: '#86efac',
  },
  badgeSuccessTextStyle: {
    color: '#15803d',
  },
  customerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 2,
  },
  customerPhone: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 4,
  },
  customerAddress: {
    fontSize: 12,
    color: '#64748b',
  },
  radioGroupRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  radioChip: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    minHeight: 46,
    justifyContent: 'center',
  },
  radioChipActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#2563eb',
  },
  radioChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'center',
  },
  radioChipTextActive: {
    color: '#1d4ed8',
    fontWeight: '700',
  },
  turnaroundOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    marginBottom: 8,
    minHeight: 52,
  },
  turnaroundOptionActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#2563eb',
  },
  turnaroundOptionDisabled: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
    opacity: 0.6,
  },
  turnaroundTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  turnaroundSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  turnaroundMultiplier: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563eb',
  },
  dueDateBanner: {
    flexDirection: 'row',
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    marginTop: 8,
    alignItems: 'center',
    gap: 10,
  },
  dueDateIcon: {
    fontSize: 22,
  },
  dueDateLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1e40af',
    letterSpacing: 0.5,
  },
  dueDateValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1e3a8a',
    marginTop: 2,
  },
  dueDateNote: {
    fontSize: 10,
    color: '#3b82f6',
    marginTop: 2,
  },
  notesInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: '#0f172a',
    minHeight: 56,
    textAlignVertical: 'top',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  priceLabel: {
    fontSize: 13,
    color: '#64748b',
  },
  priceValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  discountValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#16a34a',
  },
  surchargeValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ea580c',
  },
  totalRow: {
    borderTopWidth: 1.5,
    borderTopColor: '#e2e8f0',
    marginTop: 6,
    paddingTop: 10,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2563eb',
  },
  provisionalDisclaimer: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 8,
    fontStyle: 'italic',
  },
  actionsContainer: {
    gap: 12,
    marginTop: 4,
  },
  submitOrderBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  submitOrderBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  saveDraftBtn: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    minHeight: 46,
  },
  saveDraftBtnText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '600',
  },
});
