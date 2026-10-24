import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import {
  OrderDetailDTO,
  PaymentDTO,
  PaymentSummaryDTO,
  deriveOrderStatus,
  OrderStatus,
  PaymentStatus,
  ItemStatus,
} from '@growfast/shared-types';
import { apiClient } from '../api/client';
import { PaymentHistoryView } from './PaymentHistoryView';
import { PaymentCollectionModal } from './PaymentCollectionModal';

interface OrderDetailModalProps {
  visible: boolean;
  orderId: string | null;
  onClose: () => void;
  onOrderUpdated?: () => void;
  userRole?: string;
}

export function OrderDetailModal({
  visible,
  orderId,
  onClose,
  onOrderUpdated,
  userRole,
}: OrderDetailModalProps) {
  const [order, setOrder] = useState<OrderDetailDTO | null>(null);
  const [payments, setPayments] = useState<PaymentDTO[]>([]);
  const [summary, setSummary] = useState<PaymentSummaryDTO | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Sub-modal state for payment collection
  const [paymentModalVisible, setPaymentModalVisible] = useState<boolean>(false);

  // Loading state for operations
  const [operatingGarmentId, setOperatingGarmentId] = useState<string | null>(null);
  const [isPickingUp, setIsPickingUp] = useState<boolean>(false);

  const fetchOrderData = useCallback(async () => {
    if (!orderId) return;
    setError(null);

    try {
      const [orderData, paymentsData, summaryData] = await Promise.all([
        apiClient.orders.getById(orderId),
        apiClient.payments.getOrderPayments(orderId).catch(() => []),
        apiClient.payments.getSummary(orderId).catch(() => null),
      ]);

      setOrder(orderData);
      setPayments(paymentsData);
      setSummary(summaryData);
    } catch (err: any) {
      setError(err.message || 'Failed to load order details from server.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (visible && orderId) {
      setLoading(true);
      fetchOrderData();
    } else {
      setOrder(null);
      setPayments([]);
      setSummary(null);
    }
  }, [visible, orderId, fetchOrderData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchOrderData();
  };

  const handlePaymentSuccess = () => {
    fetchOrderData();
    onOrderUpdated?.();
  };

  // ─── Supported Order Operation 1: Mark Physical Garment Ready ───
  const handleToggleGarmentReady = async (
    itemId: string,
    garmentId: string,
    currentReady: boolean,
  ) => {
    if (!order) return;
    setOperatingGarmentId(garmentId);

    try {
      const updatedOrder = await apiClient.orders.markGarmentReady(
        order.id,
        itemId,
        garmentId,
        !currentReady,
      );
      setOrder(updatedOrder);
      onOrderUpdated?.();
    } catch (err: any) {
      Alert.alert('Action Failed', err.message || 'Could not update garment readiness.');
    } finally {
      setOperatingGarmentId(null);
    }
  };

  // ─── Supported Order Operation 2: Record Order Pickup ───
  const handleRecordPickup = async () => {
    if (!order) return;

    // Check if order still has balance due
    const currentDue = summary ? summary.amountDue : order.amountDue;
    if (currentDue > 0) {
      Alert.alert(
        'Outstanding Balance Due',
        `This order has an unpaid balance of ₹${currentDue.toFixed(2)}. Please collect payment before completing customer pickup.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Collect Payment Now',
            onPress: () => setPaymentModalVisible(true),
          },
        ],
      );
      return;
    }

    Alert.alert(
      'Confirm Pickup',
      `Record pickup for Order #${order.orderNumber}? All items will be marked DELIVERED.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Pickup',
          onPress: async () => {
            setIsPickingUp(true);
            try {
              const updated = await apiClient.orders.recordPickup(order.id, {});
              setOrder(updated);
              Alert.alert(
                'Pickup Recorded',
                'Order has been successfully handed over to customer!',
              );
              onOrderUpdated?.();
            } catch (err: any) {
              Alert.alert('Pickup Failed', err.message || 'Could not record pickup.');
            } finally {
              setIsPickingUp(false);
            }
          },
        },
      ],
    );
  };

  // Derive canonical order status strictly via shared contract
  const derivedStatus: OrderStatus = order
    ? deriveOrderStatus({
        items: (order.items || []).map((it) => ({ status: it.itemStatus })),
        currentOrderStatus: order.status,
      })
    : OrderStatus.RECEIVED;

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.READY:
        return { label: 'READY FOR PICKUP', bg: '#dcfce7', text: '#15803d' };
      case OrderStatus.DELIVERED:
        return { label: 'DELIVERED', bg: '#f1f5f9', text: '#475569' };
      case OrderStatus.CANCELLED:
        return { label: 'CANCELLED', bg: '#fee2e2', text: '#b91c1c' };
      default:
        return { label: status, bg: '#dbeafe', text: '#1d4ed8' };
    }
  };

  const statusBadge = getStatusBadge(derivedStatus);
  const effectiveDue = summary ? summary.amountDue : order?.amountDue || 0;
  const effectivePaid = summary ? summary.amountPaid : order?.amountPaid || 0;
  const effectiveTotal = summary ? summary.totalAmount : order?.totalAmount || 0;
  const effectivePaymentStatus = summary
    ? summary.paymentStatus
    : order?.paymentStatus || PaymentStatus.PENDING;

  const isCancelledOrRefunded =
    derivedStatus === OrderStatus.CANCELLED || effectivePaymentStatus === PaymentStatus.REFUNDED;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header Bar */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={onClose}
            accessible={true}
            accessibilityLabel="Close order details"
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Order #{order?.orderNumber || '...'}</Text>

          <TouchableOpacity
            style={styles.refreshButton}
            onPress={handleRefresh}
            disabled={refreshing}
            accessible={true}
            accessibilityLabel="Refresh order details"
          >
            {refreshing ? (
              <ActivityIndicator size="small" color="#2563eb" />
            ) : (
              <Text style={styles.refreshButtonText}>🔄</Text>
            )}
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.centerText}>Fetching authoritative order records...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerBox}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={fetchOrderData}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : order ? (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* Top Order Information Card */}
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <View>
                  <Text style={styles.customerName}>{order.customerName}</Text>
                  <Text style={styles.customerPhone}>📞 {order.customerPhone}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: statusBadge.bg }]}>
                  <Text style={[styles.badgeText, { color: statusBadge.text }]}>
                    {statusBadge.label}
                  </Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                <Text style={styles.metaText}>
                  Order Date:{' '}
                  {new Date(order.orderDate).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </Text>
                <Text style={styles.metaText}>
                  Due Date:{' '}
                  {new Date(order.effectiveDueDate).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </Text>
              </View>

              {order.isExpress && (
                <View style={styles.expressTag}>
                  <Text style={styles.expressTagText}>⚡ Express Delivery Surcharge Applied</Text>
                </View>
              )}
            </View>

            {/* Authoritative Financial & Payment Section */}
            <PaymentHistoryView
              payments={payments}
              totalAmount={effectiveTotal}
              amountPaid={effectivePaid}
              amountDue={effectiveDue}
            />

            {/* Collect Payment Action Banner */}
            <View style={styles.actionCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionCardTitle}>Payment Collection</Text>
                <Text style={styles.actionCardSubtitle}>
                  {effectiveDue > 0
                    ? `₹${effectiveDue.toFixed(2)} remaining to settle`
                    : 'Order is completely paid'}
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.collectButton,
                  (effectiveDue <= 0 || isCancelledOrRefunded) && styles.buttonDisabled,
                ]}
                onPress={() => setPaymentModalVisible(true)}
                disabled={effectiveDue <= 0 || isCancelledOrRefunded}
                accessible={true}
                accessibilityLabel="Collect payment on this order"
              >
                <Text style={styles.collectButtonText}>
                  {effectiveDue > 0 ? '💳 Collect Payment' : '✓ Fully Paid'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Supported Operation: Ready for Pickup / Handover */}
            {derivedStatus === OrderStatus.READY && (
              <View
                style={[styles.actionCard, { borderColor: '#86efac', backgroundColor: '#f0fdf4' }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.actionCardTitle, { color: '#166534' }]}>
                    Customer Pickup
                  </Text>
                  <Text style={styles.actionCardSubtitle}>
                    All garments processed and ready for pickup.
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.collectButton, { backgroundColor: '#16a34a' }]}
                  onPress={handleRecordPickup}
                  disabled={isPickingUp}
                  accessible={true}
                  accessibilityLabel="Record customer pickup"
                >
                  {isPickingUp ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.collectButtonText}>📦 Hand Over</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* Order Items Breakdown & Readiness Toggles */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Intake Line Items ({order.items.length})</Text>

              {order.items.map((item, idx) => {
                return (
                  <View key={item.id || idx} style={styles.itemRow}>
                    <View style={styles.rowBetween}>
                      <View>
                        <Text style={styles.itemName}>{item.garmentName}</Text>
                        <Text style={styles.itemService}>
                          {item.serviceType} •{' '}
                          {item.weight ? `${item.weight} kg` : `${item.quantity} pc(s)`}
                        </Text>
                      </View>
                      <Text style={styles.itemPrice}>₹{item.lineTotal.toFixed(2)}</Text>
                    </View>

                    {/* Physical garments readiness control */}
                    {item.physicalGarments && item.physicalGarments.length > 0 && (
                      <View style={styles.garmentsContainer}>
                        <Text style={styles.garmentsHeader}>Tagged Garments Readiness:</Text>
                        <View style={styles.garmentTagsRow}>
                          {item.physicalGarments.map((g) => {
                            const isThisOperating = operatingGarmentId === g.id;
                            return (
                              <TouchableOpacity
                                key={g.id}
                                style={[styles.garmentTag, g.isReady && styles.garmentTagReady]}
                                onPress={() => handleToggleGarmentReady(item.id, g.id, g.isReady)}
                                disabled={isThisOperating}
                                accessible={true}
                                accessibilityLabel={`Toggle readiness for piece ${g.unitNumber}`}
                              >
                                {isThisOperating ? (
                                  <ActivityIndicator size="small" color="#2563eb" />
                                ) : (
                                  <Text
                                    style={[
                                      styles.garmentTagText,
                                      g.isReady && styles.garmentTagTextReady,
                                    ]}
                                  >
                                    #{g.unitNumber} {g.isReady ? '✓ Ready' : '⏳ Wash'}
                                  </Text>
                                )}
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </ScrollView>
        ) : null}

        {/* Payment Collection Sub-Modal */}
        {order && (
          <PaymentCollectionModal
            visible={paymentModalVisible}
            orderId={order.id}
            orderNumber={order.orderNumber}
            customerName={order.customerName}
            amountDue={effectiveDue}
            totalAmount={effectiveTotal}
            onClose={() => setPaymentModalVisible(false)}
            onPaymentSuccess={handlePaymentSuccess}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingTop: Platform.OS === 'ios' ? 44 : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  backButton: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
  },
  refreshButton: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshButtonText: {
    fontSize: 18,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 36,
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  centerText: {
    marginTop: 12,
    fontSize: 13,
    color: '#64748b',
  },
  errorText: {
    fontSize: 14,
    color: '#dc2626',
    textAlign: 'center',
    marginBottom: 12,
  },
  retryBtn: {
    minHeight: 44,
    paddingHorizontal: 20,
    backgroundColor: '#2563eb',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  customerName: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  customerPhone: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  metaText: {
    fontSize: 12,
    color: '#64748b',
  },
  expressTag: {
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#fffbeb',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  expressTagText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#b45309',
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
  },
  actionCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  actionCardSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  collectButton: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#94a3b8',
  },
  collectButtonText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 12,
  },
  itemRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  itemService: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  garmentsContainer: {
    marginTop: 8,
    backgroundColor: '#f8fafc',
    padding: 8,
    borderRadius: 6,
  },
  garmentsHeader: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 6,
  },
  garmentTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  garmentTag: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  garmentTagReady: {
    backgroundColor: '#dcfce7',
    borderColor: '#86efac',
  },
  garmentTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  garmentTagTextReady: {
    color: '#15803d',
  },
});
