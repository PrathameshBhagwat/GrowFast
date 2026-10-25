import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { OrderStatus, deriveOrderStatus, ItemStatus } from '@growfast/shared-types';

export interface OrderCreatedStepProps {
  orderId: string;
  orderNumber: string;
  isOfflineQueued: boolean;
  totalPieces: number;
  totalAmount: number;
  customerName: string;
  customerPhone: string;
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

  return (
    <View style={styles.container}>
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

      {/* Details Card */}
      <View style={styles.detailsCard}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>
            {isOfflineQueued ? 'Sync Status:' : 'Official Order Number:'}
          </Text>
          <Text style={[styles.detailValueBold, !isOfflineQueued && styles.orderNumberHighlight]}>
            {isOfflineQueued ? 'QUEUED FOR SYNC' : `#${orderNumber}`}
          </Text>
        </View>

        {!isOfflineQueued && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Internal Order ID:</Text>
            <Text style={styles.detailValueText} numberOfLines={1}>
              {orderId}
            </Text>
          </View>
        )}

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Derived Order Status:</Text>
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

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Customer:</Text>
          <Text style={styles.detailValueText}>{customerName || 'Walk-in Customer'}</Text>
        </View>

        {customerPhone ? (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Phone:</Text>
            <Text style={styles.detailValueText}>{customerPhone}</Text>
          </View>
        ) : null}

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Total Garments:</Text>
          <Text style={styles.detailValueText}>{totalPieces} piece(s)</Text>
        </View>

        <View style={[styles.detailRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>
            {isOfflineQueued ? 'Provisional Total:' : 'Billed Total:'}
          </Text>
          <Text style={styles.totalAmountText}>₹{totalAmount.toFixed(2)}</Text>
        </View>
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
          accessibilityLabel="Done and return to dashboard"
        >
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
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
    fontSize: 32,
    fontWeight: '800',
    color: '#16a34a',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  detailsCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 24,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
  },
  detailLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  detailValueText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  detailValueBold: {
    fontSize: 15,
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
    paddingVertical: 3,
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
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    marginTop: 6,
    paddingTop: 10,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  totalAmountText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2563eb',
  },
  actionsContainer: {
    width: '100%',
    gap: 10,
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
