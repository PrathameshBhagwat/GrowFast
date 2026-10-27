import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { deriveOrderStatus, ItemStatus } from '@growfast/shared-types';

export interface OrderItemSummary {
  garmentName: string;
  serviceName: string;
  quantity: number;
  weight?: number | null;
  unitPrice: number;
  lineTotal: number;
}

export interface OrderCreatedStepProps {
  orderId: string;
  orderNumber: string;
  isOfflineQueued: boolean;
  totalPieces: number;
  totalAmount: number;
  customerName: string;
  customerPhone: string;
  customerAddress?: string | null;
  itemsList?: OrderItemSummary[];
  subtotal?: number;
  discountAmount?: number;
  expressSurcharge?: number;
  taxAmount?: number;
  paymentStatus?: string;
  amountDue?: number;
  dueDate?: string;
  onViewOrder: (orderId: string) => void;
  onCreateAnotherOrder: () => void;
  onDone: () => void;
}

export function OrderCreatedStep({
  orderId,
  orderNumber,
  isOfflineQueued,
  totalPieces,
  totalAmount,
  customerName,
  customerPhone,
  customerAddress,
  itemsList = [],
  subtotal,
  discountAmount = 0,
  expressSurcharge = 0,
  taxAmount = 0,
  paymentStatus = 'PENDING',
  amountDue,
  dueDate,
  onViewOrder,
  onCreateAnotherOrder,
  onDone,
}: OrderCreatedStepProps) {
  // Canonical status derivation for freshly confirmed order
  const canonicalStatus = isOfflineQueued
    ? 'QUEUED'
    : deriveOrderStatus({
        items: Array.from({ length: totalPieces || 1 }, () => ({
          status: ItemStatus.RECEIVED,
        })),
      });

  const effectiveSubtotal = subtotal != null ? subtotal : totalAmount;
  const effectiveAmountDue = amountDue != null ? amountDue : totalAmount;

  return (
    <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.contentContainer}>
      {/* Success / Queued Icon */}
      <View
        style={[
          styles.iconCircle,
          isOfflineQueued ? styles.queuedIconCircle : styles.successIconCircle,
        ]}
      >
        <Text style={styles.iconEmoji}>{isOfflineQueued ? '⏳' : '✓'}</Text>
      </View>

      {/* Title & Subtitle */}
      <Text style={styles.title}>
        {isOfflineQueued ? 'Order Queued Offline!' : 'Order Created & Confirmed!'}
      </Text>
      <Text style={styles.subtitle}>
        {isOfflineQueued
          ? 'Your order is safely recorded in local device SQLite storage. It will synchronize automatically to the server when internet returns.'
          : 'The central server has registered this order into PostgreSQL.'}
      </Text>

      {/* Bill & Details Card */}
      <View style={styles.detailsCard}>
        {/* Order Number Header */}
        <View style={styles.orderHeaderRow}>
          <View>
            <Text style={styles.detailLabel}>
              {isOfflineQueued ? 'Sync Status' : 'Official Order Number'}
            </Text>
            <Text style={[styles.detailValueBold, !isOfflineQueued && styles.orderNumberHighlight]}>
              {isOfflineQueued ? 'QUEUED FOR SYNC' : `#${orderNumber}`}
            </Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              isOfflineQueued ? styles.statusBadgeQueued : styles.statusBadgeReceived,
            ]}
          >
            <Text
              style={[
                styles.statusBadgeText,
                isOfflineQueued ? styles.statusBadgeTextQueued : styles.statusBadgeTextReceived,
              ]}
            >
              {canonicalStatus}
            </Text>
          </View>
        </View>

        {!isOfflineQueued && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Internal ID:</Text>
            <Text style={styles.detailValueText} numberOfLines={1}>
              {orderId}
            </Text>
          </View>
        )}

        <View style={styles.divider} />

        {/* Customer Details */}
        <Text style={styles.sectionHeading}>Customer Details</Text>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Name:</Text>
          <Text style={styles.detailValueText}>{customerName || 'Walk-in Customer'}</Text>
        </View>

        {customerPhone ? (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Phone:</Text>
            <Text style={styles.detailValueText}>{customerPhone}</Text>
          </View>
        ) : null}

        {customerAddress ? (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Address:</Text>
            <Text style={[styles.detailValueText, { flex: 1, textAlign: 'right' }]}>
              {customerAddress}
            </Text>
          </View>
        ) : null}

        {/* Order Items & Services Breakdown */}
        {itemsList.length > 0 && (
          <>
            <View style={styles.divider} />
            <Text style={styles.sectionHeading}>Order Items & Services</Text>
            {itemsList.map((item, index) => (
              <View key={index} style={styles.itemRow}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.itemGarmentName}>{item.garmentName}</Text>
                  <Text style={styles.itemServiceName}>{item.serviceName}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.itemQtyText}>
                    {item.weight && item.weight > 0
                      ? `${item.weight.toFixed(2)} kg`
                      : `${item.quantity} pc`}
                    {' × ₹'}
                    {item.unitPrice.toFixed(2)}
                  </Text>
                  <Text style={styles.itemTotalText}>₹{item.lineTotal.toFixed(2)}</Text>
                </View>
              </View>
            ))}
          </>
        )}

        <View style={styles.divider} />

        {/* Final Price Breakdown */}
        <Text style={styles.sectionHeading}>Price Breakdown</Text>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Subtotal ({totalPieces} items):</Text>
          <Text style={styles.detailValueText}>₹{effectiveSubtotal.toFixed(2)}</Text>
        </View>

        {expressSurcharge > 0 && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Express Surcharge:</Text>
            <Text style={[styles.detailValueText, styles.surchargeText]}>
              +₹{expressSurcharge.toFixed(2)}
            </Text>
          </View>
        )}

        {discountAmount > 0 && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Customer Discount:</Text>
            <Text style={[styles.detailValueText, styles.discountText]}>
              -₹{discountAmount.toFixed(2)}
            </Text>
          </View>
        )}

        {taxAmount > 0 && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Taxes (GST):</Text>
            <Text style={styles.detailValueText}>₹{taxAmount.toFixed(2)}</Text>
          </View>
        )}

        <View style={[styles.detailRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>
            {isOfflineQueued ? 'Provisional Total:' : 'Billed Total:'}
          </Text>
          <Text style={styles.totalAmountText}>₹{totalAmount.toFixed(2)}</Text>
        </View>

        <View style={styles.divider} />

        {/* Payment & Turnaround Status */}
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Payment Status:</Text>
          <View
            style={[
              styles.paymentBadge,
              paymentStatus === 'PAID' ? styles.paymentPaid : styles.paymentPending,
            ]}
          >
            <Text
              style={[
                styles.paymentBadgeText,
                paymentStatus === 'PAID' ? styles.paymentPaidText : styles.paymentPendingText,
              ]}
            >
              {paymentStatus}
            </Text>
          </View>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Amount Due:</Text>
          <Text
            style={[
              styles.detailValueBold,
              effectiveAmountDue > 0 ? styles.dueText : styles.settledText,
            ]}
          >
            ₹{effectiveAmountDue.toFixed(2)}
          </Text>
        </View>

        {dueDate ? (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Expected Due Date:</Text>
            <Text style={styles.detailValueText}>{dueDate}</Text>
          </View>
        ) : null}
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        {!isOfflineQueued && (
          <TouchableOpacity
            style={styles.viewOrderButton}
            onPress={() => onViewOrder(orderId)}
            accessible={true}
            accessibilityLabel="View full order details"
          >
            <Text style={styles.viewOrderButtonText}>🔍 View Order Details</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.newOrderButton}
          onPress={onCreateAnotherOrder}
          accessible={true}
          accessibilityLabel="Create another order for next customer"
        >
          <Text style={styles.newOrderButtonText}>＋ Create Another Order</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.doneButton}
          onPress={onDone}
          accessible={true}
          accessibilityLabel="Done and return to home"
        >
          <Text style={styles.doneButtonText}>🏠 Return Home</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  contentContainer: {
    padding: 18,
    alignItems: 'center',
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  successIconCircle: {
    backgroundColor: '#dcfce7',
    borderWidth: 2,
    borderColor: '#22c55e',
  },
  queuedIconCircle: {
    backgroundColor: '#fef3c7',
    borderWidth: 2,
    borderColor: '#f59e0b',
  },
  iconEmoji: {
    fontSize: 28,
    fontWeight: '800',
    color: '#16a34a',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
    paddingHorizontal: 10,
  },
  detailsCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  orderHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 6,
    marginBottom: 6,
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  detailLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  detailValueText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  detailValueBold: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  orderNumberHighlight: {
    fontSize: 17,
    fontWeight: '800',
    color: '#2563eb',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeReceived: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  statusBadgeQueued: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  statusBadgeTextReceived: {
    color: '#1d4ed8',
  },
  statusBadgeTextQueued: {
    color: '#b45309',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  itemGarmentName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  itemServiceName: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  itemQtyText: {
    fontSize: 11,
    color: '#64748b',
  },
  itemTotalText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  surchargeText: {
    color: '#d97706',
  },
  discountText: {
    color: '#16a34a',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    marginTop: 8,
    paddingTop: 10,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  totalAmountText: {
    fontSize: 19,
    fontWeight: '800',
    color: '#2563eb',
  },
  paymentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  paymentPaid: {
    backgroundColor: '#dcfce7',
  },
  paymentPending: {
    backgroundColor: '#fef3c7',
  },
  paymentBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  paymentPaidText: {
    color: '#15803d',
  },
  paymentPendingText: {
    color: '#b45309',
  },
  dueText: {
    color: '#dc2626',
  },
  settledText: {
    color: '#16a34a',
  },
  actionsContainer: {
    width: '100%',
    gap: 10,
    marginBottom: 24,
  },
  viewOrderButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  viewOrderButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  newOrderButton: {
    backgroundColor: '#eff6ff',
    borderWidth: 1.5,
    borderColor: '#bfdbfe',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  newOrderButtonText: {
    color: '#2563eb',
    fontSize: 15,
    fontWeight: '700',
  },
  doneButton: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  doneButtonText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '600',
  },
});
