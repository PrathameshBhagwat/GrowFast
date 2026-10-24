import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import {
  CreateOrderItemRequest,
  CustomerDTO,
  OrderWorkflowType,
  PickupType,
  ExpressDeliveryOption,
  calculateOrderTotals,
  isPhotoRequiredForOrder,
  deriveOrderStatus,
  OrderStatus,
  ItemStatus,
} from '@growfast/shared-types';
import { PendingPhoto } from '../../db/photos';

interface ReviewConfirmStepProps {
  clientDraftId: string;
  customer: CustomerDTO | null;
  manualCustomerName: string;
  manualCustomerPhone: string;
  workflow: OrderWorkflowType;
  pickupType: PickupType;
  expressOption: ExpressDeliveryOption;
  items: CreateOrderItemRequest[];
  notes: string;
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
  onDone: () => void;
}

export function ReviewConfirmStep({
  clientDraftId,
  customer,
  manualCustomerName,
  manualCustomerPhone,
  workflow,
  pickupType,
  expressOption,
  items,
  notes,
  photos,
  isConnected,
  storeConfig,
  onSaveDraft,
  onSubmitOrder,
  onDone,
}: ReviewConfirmStepProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<{
    orderId: string;
    orderNumber: string;
    status: OrderStatus;
  } | null>(null);

  // Compute canonical totals using shared pricing rules
  const isExpress = expressOption !== ExpressDeliveryOption.REGULAR;
  const pricingItems = items.map((it) => ({
    quantity: it.quantity || 1,
    unitPrice: it.unitPrice || 0,
    weight: it.weight ?? null,
  }));
  const discountPercent = customer?.discountPercent || 0;
  const effectiveSurchargeRate =
    storeConfig?.expressSurchargePercent != null ? storeConfig.expressSurchargePercent : 50;

  const pricingTotals = calculateOrderTotals(pricingItems, {
    isExpress,
    expressSurchargePercent: isExpress ? effectiveSurchargeRate : undefined,
    expressDeliveryOption: expressOption,
    discountPercent,
  });
  const finalEstimatedTotal = pricingTotals.totalAmount;

  const totalPieces = items.reduce((acc, it) => acc + (it.quantity || 1), 0);
  const totalWeight = items.reduce((acc, it) => acc + (it.weight || 0), 0);
  const isWeightBased = items.some((it) => it.weight != null && it.weight > 0);
  const photoRequired = isPhotoRequiredForOrder({
    isWalkIn: pickupType === PickupType.STORE_PICKUP,
    totalPieces,
    isWeightBased,
  });

  const displayName = customer?.name || manualCustomerName || 'Walk-in Customer';
  const displayPhone = customer?.phone || manualCustomerPhone || 'No phone provided';

  const handleSaveLocal = async () => {
    setIsSaving(true);
    try {
      await onSaveDraft();
      Alert.alert('Draft Saved', 'Your order draft is safely stored in local SQLite storage.');
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Could not save draft');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (items.length === 0) {
      Alert.alert('Validation Error', 'Cannot submit an order with zero items.');
      return;
    }

    if (photoRequired && photos.length === 0) {
      Alert.alert(
        'Photo Required',
        'Intake photo is mandatory for walk-in orders. Please return to the Requirements step and attach at least one photo.',
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await onSubmitOrder();
      if (result.success && result.orderId) {
        // Canonical status derivation for freshly confirmed order
        const derivedStatus = deriveOrderStatus({
          items: items.map(() => ({
            status: ItemStatus.RECEIVED,
          })),
        });

        setConfirmedOrder({
          orderId: result.orderId,
          orderNumber: result.orderNumber || result.orderId,
          status: derivedStatus,
        });
      } else if (result.isConflict) {
        Alert.alert(
          'Server Conflict (409)',
          result.error || 'Server rejected order due to a conflict with existing records.',
        );
      } else {
        if (!isConnected) {
          Alert.alert(
            'Order Queued Offline',
            'Order has been queued for synchronization. It will be submitted to the server automatically when internet returns.',
          );
          onDone();
        } else {
          Alert.alert('Submission Error', result.error || 'Failed to submit order');
        }
      }
    } catch (err: any) {
      Alert.alert('Submission Exception', err.message || 'An error occurred during submission');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Confirmed state view
  if (confirmedOrder) {
    return (
      <View style={styles.confirmedContainer}>
        <View style={styles.successIconCircle}>
          <Text style={styles.successCheckText}>✓</Text>
        </View>

        <Text style={styles.confirmedTitle}>Order Created & Confirmed!</Text>
        <Text style={styles.confirmedSubtitle}>
          The server has authoritatively created this order in the central database.
        </Text>

        <View style={styles.confirmedDetailsCard}>
          <View style={styles.confirmedRow}>
            <Text style={styles.confirmedLabel}>Official Order Number:</Text>
            <Text style={styles.confirmedOrderNumber}>#{confirmedOrder.orderNumber}</Text>
          </View>
          <View style={styles.confirmedRow}>
            <Text style={styles.confirmedLabel}>Internal Order ID:</Text>
            <Text style={styles.confirmedValueText}>{confirmedOrder.orderId}</Text>
          </View>
          <View style={styles.confirmedRow}>
            <Text style={styles.confirmedLabel}>Derived Canonical Status:</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>{confirmedOrder.status}</Text>
            </View>
          </View>
          <View style={styles.confirmedRow}>
            <Text style={styles.confirmedLabel}>Customer:</Text>
            <Text style={styles.confirmedValueText}>{displayName}</Text>
          </View>
          <View style={styles.confirmedRow}>
            <Text style={styles.confirmedLabel}>Total Pieces:</Text>
            <Text style={styles.confirmedValueText}>{totalPieces} pcs</Text>
          </View>
          <View style={styles.confirmedRow}>
            <Text style={styles.confirmedLabel}>Billed Amount:</Text>
            <Text style={styles.confirmedAmountText}>₹{finalEstimatedTotal.toFixed(2)}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.doneButton}
          onPress={onDone}
          accessible={true}
          accessibilityLabel="Done and return to orders"
        >
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.stepTitle}>Review & Confirm Order</Text>

      {/* Offline Status Callout */}
      {!isConnected && (
        <View style={styles.offlineNotice}>
          <Text style={styles.offlineNoticeTitle}>Device is Offline</Text>
          <Text style={styles.offlineNoticeText}>
            Submitting will queue this draft in your local SQLite queue. It will synchronize automatically
            and receive an official server order number when you reconnect.
          </Text>
        </View>
      )}

      {/* Customer Summary Card */}
      <View style={styles.card}>
        <Text style={styles.cardHeader}>Customer</Text>
        <Text style={styles.cardMainText}>{displayName}</Text>
        <Text style={styles.cardSubText}>📱 {displayPhone}</Text>
        {customer?.membership && customer.membership !== 'NONE' && (
          <Text style={styles.memberTag}>⭐ {customer.membership} Member</Text>
        )}
      </View>

      {/* Order Options Card */}
      <View style={styles.card}>
        <Text style={styles.cardHeader}>Fulfillment & Speed</Text>
        <View style={styles.specRow}>
          <Text style={styles.specLabel}>Workflow:</Text>
          <Text style={styles.specValue}>{workflow}</Text>
        </View>
        <View style={styles.specRow}>
          <Text style={styles.specLabel}>Pickup / Delivery:</Text>
          <Text style={styles.specValue}>
            {pickupType === PickupType.HOME_DELIVERY ? '🚚 Home Delivery' : '🏪 Counter Pickup'}
          </Text>
        </View>
        <View style={styles.specRow}>
          <Text style={styles.specLabel}>Speed Tier:</Text>
          <Text style={styles.specValue}>
            {expressOption === ExpressDeliveryOption.SAME_DAY
              ? '🔥 Same-Day Express (2.0x)'
              : expressOption === ExpressDeliveryOption.NEXT_DAY_EVENING
                ? '⚡ Next-Day Evening (1.5x)'
                : 'Regular (1.0x)'}
          </Text>
        </View>
        {notes ? (
          <View style={styles.specRow}>
            <Text style={styles.specLabel}>Notes:</Text>
            <Text style={[styles.specValue, { flex: 1, textAlign: 'right' }]}>{notes}</Text>
          </View>
        ) : null}
      </View>

      {/* Items Summary Card */}
      <View style={styles.card}>
        <Text style={styles.cardHeader}>Order Items ({items.length})</Text>
        {items.map((it, idx) => {
          const lineRate = it.unitPrice || 0;
          const lineTotal = it.weight ? lineRate * it.weight : lineRate * (it.quantity || 1);
          return (
            <View key={idx} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemNameText}>{it.defectNotes || `Item #${idx + 1}`}</Text>
                <Text style={styles.itemMetaText}>
                  {it.serviceTypeId} • {it.weight ? `${it.weight} kg` : `${it.quantity} pc`} • ₹
                  {lineRate} each
                </Text>
              </View>
              <Text style={styles.itemTotalText}>₹{lineTotal.toFixed(2)}</Text>
            </View>
          );
        })}
      </View>

      {/* Photos Count & Warning */}
      <View style={styles.card}>
        <Text style={styles.cardHeader}>Intake Photos</Text>
        <Text style={styles.cardMainText}>{photos.length} photo(s) attached to draft</Text>
        {photoRequired && photos.length === 0 && (
          <Text style={styles.missingPhotoAlert}>
            ⚠️ Mandatory walk-in photo is currently missing. Please attach a photo before submitting.
          </Text>
        )}
      </View>

      {/* Pricing Breakdown Card */}
      <View style={styles.pricingCard}>
        <Text style={styles.cardHeader}>Estimated Financial Summary</Text>

        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>Base Items Subtotal:</Text>
          <Text style={styles.breakdownValue}>₹{pricingTotals.subtotal.toFixed(2)}</Text>
        </View>

        {isExpress && (
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>
              Express Turnaround Surcharge (
              {expressOption === ExpressDeliveryOption.SAME_DAY ? '+100%' : '+50%'}):
            </Text>
            <Text style={styles.breakdownValue}>+₹{pricingTotals.expressSurcharge.toFixed(2)}</Text>
          </View>
        )}

        {pricingTotals.discountAmount > 0 && (
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Member Discount ({discountPercent}%):</Text>
            <Text style={[styles.breakdownValue, { color: '#16a34a' }]}>
              -₹{pricingTotals.discountAmount.toFixed(2)}
            </Text>
          </View>
        )}

        {pricingTotals.taxAmount > 0 && (
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>GST (18%):</Text>
            <Text style={styles.breakdownValue}>+₹{pricingTotals.taxAmount.toFixed(2)}</Text>
          </View>
        )}

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Estimated Total Amount:</Text>
          <Text style={styles.totalValue}>₹{finalEstimatedTotal.toFixed(2)}</Text>
        </View>

        <Text style={styles.authoritativeDisclaimer}>
          ℹ️ Server Authoritative: The backend performs final rate verification and records the
          official order number upon submission.
        </Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.saveDraftBtn}
          onPress={handleSaveLocal}
          disabled={isSaving || isSubmitting}
          accessible={true}
          accessibilityLabel="Save order as draft"
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#334155" />
          ) : (
            <Text style={styles.saveDraftBtnText}>💾 Save Draft</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.submitBtn, (isSubmitting || isSaving) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting || isSaving}
          accessible={true}
          accessibilityLabel="Submit order for server confirmation"
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.submitBtnText}>
              {isConnected ? '⚡ Submit Order' : '📥 Queue Offline'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
  },
  offlineNotice: {
    backgroundColor: '#fff7ed',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fed7aa',
    marginBottom: 16,
  },
  offlineNoticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#c2410c',
  },
  offlineNoticeText: {
    fontSize: 12,
    color: '#9a3412',
    marginTop: 2,
    lineHeight: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  cardHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardMainText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  cardSubText: {
    fontSize: 13,
    color: '#475569',
    marginTop: 2,
  },
  memberTag: {
    fontSize: 12,
    fontWeight: '700',
    color: '#b45309',
    marginTop: 4,
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  specLabel: {
    fontSize: 13,
    color: '#64748b',
  },
  specValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  itemNameText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  itemMetaText: {
    fontSize: 11,
    color: '#64748b',
  },
  itemTotalText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  missingPhotoAlert: {
    fontSize: 12,
    color: '#ea580c',
    marginTop: 4,
    fontWeight: '600',
  },
  pricingCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    marginBottom: 16,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  breakdownLabel: {
    fontSize: 13,
    color: '#475569',
  },
  breakdownValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1.5,
    borderTopColor: '#cbd5e1',
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#16a34a',
  },
  authoritativeDisclaimer: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 8,
    fontStyle: 'italic',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  saveDraftBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  saveDraftBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  submitBtn: {
    flex: 1.5,
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: '#94a3b8',
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
  confirmedContainer: {
    padding: 24,
    alignItems: 'center',
  },
  successIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#86efac',
  },
  successCheckText: {
    fontSize: 32,
    color: '#15803d',
    fontWeight: 'bold',
  },
  confirmedTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
  },
  confirmedSubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  confirmedDetailsCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 24,
  },
  confirmedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  confirmedLabel: {
    fontSize: 13,
    color: '#64748b',
  },
  confirmedOrderNumber: {
    fontSize: 15,
    fontWeight: '800',
    color: '#2563eb',
  },
  confirmedValueText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  confirmedAmountText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#16a34a',
  },
  statusBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  doneButton: {
    width: '100%',
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
});
