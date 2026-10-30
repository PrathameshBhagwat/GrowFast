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
  Platform,
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
  getDayOfWeekInTimezone,
  adjustDueDateForThursday,
} from '@growfast/shared-types';
import { PendingPhoto } from '../../db/photos';
import { WizardIcon } from './WizardIcon';

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
  onNavigateToCart?: () => void;
  onNavigateToCustomer?: () => void;
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
  onNavigateToCart,
  onNavigateToCustomer,
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
  const displayAddress = customer?.address || null;

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

    if (photoRequired) {
      const missingPieces: string[] = [];
      items.forEach((item) => {
        const garment = garments.find((g) => g.id === item.garmentCatalogId);
        const name = garment?.name || 'Garment';
        const pieceCount = item.quantity || 1;
        for (let u = 1; u <= pieceCount; u++) {
          const piece = item.pieces?.find((p) => p.unitNumber === u);
          const count = photos.filter((p) => {
            if (piece?.pieceId && p.pieceId) return p.pieceId === piece.pieceId;
            if (item.id && p.orderItemId) {
              return (
                p.orderItemId === item.id && (p.unitNumber === u || (!p.unitNumber && u === 1))
              );
            }
            return (
              p.garmentId === item.garmentCatalogId &&
              (p.unitNumber === u || (pieceCount === 1 && !p.unitNumber))
            );
          }).length;
          if (count === 0) {
            missingPieces.push(pieceCount > 1 ? `• ${name} — Piece #${u}` : `• ${name}`);
          }
        }
      });

      if (missingPieces.length > 0) {
        Alert.alert(
          'Intake Photos Required',
          `Store walk-in policy requires intake photos for each physical piece (≤50 pieces).\n\nMissing photos:\n${missingPieces.join('\n')}`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Go to Cart',
              style: 'default',
              onPress: () => {
                onNavigateToCart?.();
              },
            },
          ],
        );
        return;
      }
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
          const errMsg = result.error || 'Failed to submit order to server.';
          if (errMsg.includes('missing photos') || errMsg.includes('Photos are required')) {
            Alert.alert('Photo Validation Error', errMsg, [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Go to Cart',
                style: 'default',
                onPress: () => {
                  onNavigateToCart?.();
                },
              },
            ]);
          } else {
            Alert.alert('Submission Error', errMsg);
          }
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
      {!isConnected ? (
        <View style={styles.offlineNotice}>
          <Text style={styles.offlineNoticeTitle}>Device is Offline</Text>
          <Text style={styles.offlineNoticeText}>
            Submitting will queue this order in your local SQLite queue. It will synchronize
            automatically and receive an official server order number when you reconnect.
          </Text>
        </View>
      ) : null}

      {/* ── 1. CUSTOMER CARD (Screenshot 4) ── */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardHeaderLeft}>
            <View style={styles.iconCircleBlue}>
              <WizardIcon name="person-outline" size={18} color="#0866F5" fallbackText="👤" />
            </View>
            <Text style={styles.cardTitle}>Customer</Text>
          </View>
          {onNavigateToCustomer ? (
            <TouchableOpacity
              style={styles.editBtn}
              onPress={onNavigateToCustomer}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Edit Customer"
            >
              <WizardIcon name="create-outline" size={16} color="#0866F5" fallbackText="✏️" />
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <Text style={styles.customerName}>{displayName}</Text>

        <View style={styles.customerDetailRow}>
          <WizardIcon name="call" size={14} color="#647894" fallbackText="📞" />
          <Text style={styles.customerDetailText}>{displayPhone}</Text>
        </View>

        {displayAddress ? (
          <View style={styles.customerDetailRow}>
            <WizardIcon name="location-sharp" size={14} color="#647894" fallbackText="📍" />
            <Text style={styles.customerDetailText}>{displayAddress}</Text>
          </View>
        ) : null}
      </View>

      {/* ── 2. PICKUP & TURNAROUND CARD (Screenshot 4) ── */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardHeaderLeft}>
            <View style={styles.iconCircleBlue}>
              <WizardIcon name="cube-outline" size={18} color="#0866F5" fallbackText="📦" />
            </View>
            <View>
              <Text style={styles.cardTitle}>Pickup & Turnaround</Text>
              <Text style={styles.cardSubtitle}>Choose pickup method and delivery speed</Text>
            </View>
          </View>
        </View>

        {/* Fulfillment Method */}
        <Text style={styles.subsectionLabel}>Fulfillment Method</Text>
        <View style={styles.fulfillmentRow}>
          <TouchableOpacity
            style={styles.fulfillmentCardActive}
            onPress={() => onPickupTypeChange(PickupType.STORE_PICKUP)}
            accessible={true}
            accessibilityRole="radio"
            accessibilityState={{ selected: true }}
            accessibilityLabel="Store Counter Pickup"
          >
            <View style={styles.fulfillmentLeft}>
              <WizardIcon name="business-outline" size={18} color="#0866F5" fallbackText="🏪" />
              <Text style={styles.fulfillmentText}>Store Counter Pickup</Text>
            </View>
            <View style={styles.radioOuterActive}>
              <View style={styles.radioInnerDot} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Turnaround Speed & Surcharge */}
        <Text style={[styles.subsectionLabel, { marginTop: 16 }]}>
          Turnaround Speed & Surcharge
        </Text>

        {/* Regular Turnaround */}
        <TouchableOpacity
          style={[
            styles.turnaroundOption,
            expressOption === ExpressDeliveryOption.REGULAR && styles.turnaroundOptionActive,
          ]}
          onPress={() => onExpressOptionChange(ExpressDeliveryOption.REGULAR)}
          accessible={true}
          accessibilityRole="radio"
          accessibilityState={{ selected: expressOption === ExpressDeliveryOption.REGULAR }}
          accessibilityLabel="Regular delivery speed"
        >
          <View style={styles.turnaroundLeftCol}>
            <View style={styles.turnaroundIconBox}>
              <WizardIcon name="time-outline" size={18} color="#0866F5" fallbackText="⏱" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.turnaroundTitle}>Regular Turnaround</Text>
              <Text style={styles.turnaroundSubtitle}>Standard turnaround (48-72 hours)</Text>
            </View>
          </View>
          <View style={styles.turnaroundRightCol}>
            <Text style={styles.turnaroundMultiplierActive}>Standard (0%)</Text>
            <View
              style={[
                styles.radioOuter,
                expressOption === ExpressDeliveryOption.REGULAR
                  ? styles.radioOuterActive
                  : styles.radioOuterInactive,
              ]}
            >
              {expressOption === ExpressDeliveryOption.REGULAR && (
                <View style={styles.radioInnerDot} />
              )}
            </View>
          </View>
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
          accessibilityRole="radio"
          accessibilityState={{
            selected: expressOption === ExpressDeliveryOption.NEXT_DAY_EVENING,
          }}
          accessibilityLabel="Next-Day Evening Express"
        >
          <View style={styles.turnaroundLeftCol}>
            <View style={styles.turnaroundIconBox}>
              <WizardIcon name="flash" size={18} color="#F59E0B" fallbackText="⚡" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.turnaroundTitle, isWednesday && { color: '#94A3B8' }]}>
                Next-Day Evening Express
              </Text>
              <Text style={styles.turnaroundSubtitle}>
                {isWednesday
                  ? 'Unavailable on Wednesdays (Thursday store weekly off)'
                  : 'Delivered tomorrow evening (+50%)'}
              </Text>
            </View>
          </View>
          <View style={styles.turnaroundRightCol}>
            <Text
              style={[
                styles.turnaroundMultiplier,
                expressOption === ExpressDeliveryOption.NEXT_DAY_EVENING &&
                  styles.turnaroundMultiplierActive,
                isWednesday && { color: '#94A3B8' },
              ]}
            >
              1.5x (+50%)
            </Text>
            <View
              style={[
                styles.radioOuter,
                expressOption === ExpressDeliveryOption.NEXT_DAY_EVENING
                  ? styles.radioOuterActive
                  : styles.radioOuterInactive,
              ]}
            >
              {expressOption === ExpressDeliveryOption.NEXT_DAY_EVENING && (
                <View style={styles.radioInnerDot} />
              )}
            </View>
          </View>
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
          accessibilityRole="radio"
          accessibilityState={{ selected: expressOption === ExpressDeliveryOption.SAME_DAY }}
          accessibilityLabel="Same-Day Urgent Express"
        >
          <View style={styles.turnaroundLeftCol}>
            <View style={styles.turnaroundIconBox}>
              <WizardIcon name="flame" size={18} color="#EF4444" fallbackText="🔥" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.turnaroundTitle, isThursday && { color: '#94A3B8' }]}>
                Same-Day Urgent Express
              </Text>
              <Text style={styles.turnaroundSubtitle}>
                {isThursday
                  ? 'Unavailable on Thursdays (Store weekly off)'
                  : 'Top-priority cycle delivered today (+100%)'}
              </Text>
            </View>
          </View>
          <View style={styles.turnaroundRightCol}>
            <Text
              style={[
                styles.turnaroundMultiplier,
                expressOption === ExpressDeliveryOption.SAME_DAY &&
                  styles.turnaroundMultiplierActive,
                isThursday && { color: '#94A3B8' },
              ]}
            >
              2.0x (+100%)
            </Text>
            <View
              style={[
                styles.radioOuter,
                expressOption === ExpressDeliveryOption.SAME_DAY
                  ? styles.radioOuterActive
                  : styles.radioOuterInactive,
              ]}
            >
              {expressOption === ExpressDeliveryOption.SAME_DAY && (
                <View style={styles.radioInnerDot} />
              )}
            </View>
          </View>
        </TouchableOpacity>

        {/* Estimated Due Date Banner (Screenshot 4) */}
        <View style={styles.dueDateCard}>
          <View style={styles.dueDateIconCircle}>
            <WizardIcon name="calendar-outline" size={20} color="#0866F5" fallbackText="📅" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.dueDateLabel}>Estimated due date</Text>
            <Text style={styles.dueDateValue}>{estimatedDueDate}</Text>
            <Text style={styles.dueDateNote}>Final confirmation by server.</Text>
          </View>
        </View>
      </View>

      {/* ── 3. SPECIAL INSTRUCTIONS CARD (Screenshot 4) ── */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardHeaderLeft}>
            <View style={styles.iconCircleBlue}>
              <WizardIcon
                name="document-text-outline"
                size={18}
                color="#0866F5"
                fallbackText="📝"
              />
            </View>
            <View>
              <Text style={styles.cardTitle}>Special Instructions</Text>
              <Text style={styles.cardSubtitle}>Add any garment care notes for this order</Text>
            </View>
          </View>
        </View>

        <View style={styles.notesInputContainer}>
          <WizardIcon name="create-outline" size={18} color="#94A3B8" fallbackText="✏️" />
          <TextInput
            style={styles.notesTextInput}
            placeholder="Add garment care notes (optional)"
            placeholderTextColor="#94A3B8"
            value={notes}
            onChangeText={onNotesChange}
            multiline
            numberOfLines={2}
          />
        </View>
      </View>

      {/* ── 4. ORDER SUMMARY CARD (Screenshot 4) ── */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardHeaderLeft}>
            <View style={styles.iconCircleBlue}>
              <WizardIcon name="receipt-outline" size={18} color="#0866F5" fallbackText="🧾" />
            </View>
            <Text style={styles.cardTitle}>Order Summary</Text>
          </View>
          <Text style={styles.summaryItemCount}>{totalPieces} items</Text>
        </View>

        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Items Subtotal ({totalPieces} pcs)</Text>
          <Text style={styles.priceValue}>₹{pricingTotals.subtotal.toFixed(2)}</Text>
        </View>

        {pricingTotals.discountAmount > 0 ? (
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Customer Discount ({discountPercent}%)</Text>
            <Text style={styles.discountValue}>-₹{pricingTotals.discountAmount.toFixed(2)}</Text>
          </View>
        ) : null}

        {isExpress ? (
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Express Surcharge</Text>
            <Text style={styles.surchargeValue}>+₹{pricingTotals.expressSurcharge.toFixed(2)}</Text>
          </View>
        ) : null}

        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>GST (18% Applicable Tax)</Text>
          <Text style={styles.priceValue}>₹{pricingTotals.taxAmount.toFixed(2)}</Text>
        </View>

        <View style={styles.summaryDivider} />

        <View style={[styles.priceRow, { alignItems: 'baseline', marginTop: 4 }]}>
          <Text style={styles.totalLabel}>Estimated Total</Text>
          <Text style={styles.totalValue}>₹{pricingTotals.totalAmount.toFixed(2)}</Text>
        </View>

        <Text style={styles.provisionalDisclaimer}>
          Final taxes and total confirmed when order is saved.
        </Text>
      </View>

      {/* ── 5. FINAL ACTION BUTTONS (Screenshot 4) ── */}
      <View style={styles.actionsContainer}>
        {/* Primary Action Button */}
        <TouchableOpacity
          style={styles.submitOrderBtn}
          onPress={handleConfirmSubmit}
          disabled={isSubmitting}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Confirm and Create Order"
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitOrderBtnText}>
              ✓ Confirm & Create Order · ₹{pricingTotals.totalAmount.toFixed(2)}
            </Text>
          )}
        </TouchableOpacity>

        {/* Secondary Action Button */}
        <TouchableOpacity
          style={styles.saveDraftBtn}
          onPress={handleSaveLocalDraft}
          disabled={isSaving || isSubmitting}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Save as Offline Draft"
        >
          {isSaving ? (
            <ActivityIndicator color="#0866F5" />
          ) : (
            <View style={styles.saveDraftBtnRow}>
              <WizardIcon name="save-outline" size={18} color="#0866F5" fallbackText="💾" />
              <Text style={styles.saveDraftBtnText}>Save as Offline Draft</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  offlineNotice: {
    backgroundColor: '#FFF7ED',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FED7AA',
    marginBottom: 14,
  },
  offlineNoticeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#C2410C',
    marginBottom: 4,
  },
  offlineNoticeText: {
    fontSize: 12,
    color: '#9A3412',
    lineHeight: 18,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#DCE5F0',
    marginBottom: 14,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(8, 102, 245, 0.04)',
      },
      default: {
        shadowColor: '#0866F5',
        shadowOpacity: 0.04,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
      },
    }),
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconCircleBlue: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EDF5FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#101F3D',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#647894',
    marginTop: 2,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  editBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0866F5',
  },
  customerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#101F3D',
    marginBottom: 4,
  },
  customerDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  customerDetailText: {
    fontSize: 13,
    color: '#647894',
    fontWeight: '500',
  },
  subsectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#101F3D',
    marginBottom: 8,
  },
  fulfillmentRow: {
    marginBottom: 4,
  },
  fulfillmentCardActive: {
    backgroundColor: '#F0F7FF',
    borderWidth: 1.5,
    borderColor: '#0866F5',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fulfillmentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  fulfillmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#101F3D',
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterActive: {
    borderWidth: 2,
    borderColor: '#0866F5',
    backgroundColor: '#FFFFFF',
  },
  radioOuterInactive: {
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  radioInnerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0866F5',
  },
  turnaroundOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCE5F0',
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
  },
  turnaroundOptionActive: {
    borderColor: '#0866F5',
    borderWidth: 1.5,
    backgroundColor: '#F0F7FF',
  },
  turnaroundOptionDisabled: {
    opacity: 0.5,
  },
  turnaroundLeftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  turnaroundIconBox: {
    width: 28,
    alignItems: 'center',
    marginRight: 8,
  },
  turnaroundTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#101F3D',
  },
  turnaroundSubtitle: {
    fontSize: 11,
    color: '#647894',
    marginTop: 2,
  },
  turnaroundRightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  turnaroundMultiplier: {
    fontSize: 12,
    fontWeight: '600',
    color: '#647894',
  },
  turnaroundMultiplierActive: {
    color: '#0866F5',
    fontWeight: '700',
  },
  dueDateCard: {
    backgroundColor: '#EDF5FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  dueDateIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dueDateLabel: {
    fontSize: 11,
    color: '#647894',
    fontWeight: '500',
  },
  dueDateValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#101F3D',
    marginTop: 2,
  },
  dueDateNote: {
    fontSize: 11,
    color: '#647894',
    marginTop: 2,
  },
  notesInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DCE5F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
    marginTop: 6,
  },
  notesTextInput: {
    flex: 1,
    fontSize: 13,
    color: '#101F3D',
    marginLeft: 8,
    paddingVertical: 2,
  },
  summaryItemCount: {
    fontSize: 13,
    color: '#647894',
    fontWeight: '500',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  priceLabel: {
    fontSize: 13.5,
    color: '#101F3D',
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#101F3D',
  },
  discountValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#16A34A',
  },
  surchargeValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EA580C',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#EDF2F7',
    marginVertical: 10,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#101F3D',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0866F5',
  },
  provisionalDisclaimer: {
    fontSize: 11,
    color: '#647894',
    marginTop: 6,
  },
  actionsContainer: {
    marginTop: 10,
    gap: 10,
  },
  submitOrderBtn: {
    backgroundColor: '#0866F5',
    minHeight: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(8, 102, 245, 0.25)',
      },
      default: {
        shadowColor: '#0866F5',
        shadowOpacity: 0.25,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 4,
      },
    }),
  },
  submitOrderBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  saveDraftBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#0866F5',
    minHeight: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveDraftBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  saveDraftBtnText: {
    color: '#0866F5',
    fontSize: 15,
    fontWeight: '700',
  },
});
