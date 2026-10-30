import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  CustomerDTO,
  OrderSummaryDTO,
  MembershipTier,
  OrderStatus,
  ORDER_STATUS_COLORS,
} from '@growfast/shared-types';
import { apiClient } from '../api/client';

const Icon = Ionicons as unknown as React.ComponentType<{
  name: string;
  size?: number;
  color?: string;
  style?: any;
}>;

export interface CustomerProfileModalProps {
  visible: boolean;
  customer: CustomerDTO | null;
  onClose: () => void;
  onCreatePerPieceOrder?: (customer: CustomerDTO) => void;
  onCreatePerWeightOrder?: (customer: CustomerDTO) => void;
  onReturnToSearch?: () => void;
  onViewOrder?: (orderId: string) => void;
}

function getInitials(name?: string): string {
  if (!name) return 'CU';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function CustomerProfileModal({
  visible,
  customer,
  onClose,
  onCreatePerPieceOrder,
  onCreatePerWeightOrder,
  onReturnToSearch,
  onViewOrder,
}: CustomerProfileModalProps) {
  const [orders, setOrders] = useState<OrderSummaryDTO[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  const totalOutstanding = React.useMemo(() => {
    return orders.reduce((sum, ord) => {
      if (ord.paymentStatus !== 'PAID') {
        return sum + (ord.totalAmount || 0);
      }
      return sum;
    }, 0);
  }, [orders]);

  const loadOrderHistory = useCallback(async (customerId: string) => {
    setLoadingOrders(true);
    setOrderError(null);
    try {
      const res = await apiClient.orders.list({ customerId, pageSize: 15 });
      setOrders(res?.data || []);
    } catch (err: any) {
      setOrderError(err?.message || 'Could not load order history. Tap retry to reload.');
      setOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  useEffect(() => {
    if (visible && customer?.id) {
      loadOrderHistory(customer.id);
    } else {
      setOrders([]);
      setOrderError(null);
    }
  }, [visible, customer?.id, loadOrderHistory]);

  if (!customer) return null;

  const customerCodeDisplay = customer.customerCode
    ? `#${customer.customerCode}`
    : customer.id
      ? `#${customer.id.replace(/^cust-/, 'CUST-')}`
      : null;

  const hasMembership = Boolean(customer.membership && customer.membership !== MembershipTier.NONE);
  const hasDiscount = Boolean(customer.discountPercent && customer.discountPercent > 0);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <SafeAreaView style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.avatarCircleLarge}>
              <Text style={styles.avatarTextLarge}>{getInitials(customer.name)}</Text>
            </View>
            <View style={styles.headerInfoCol}>
              <Text style={styles.customerName} numberOfLines={1}>
                {customer.name}
              </Text>
              <Text style={styles.customerPhone}>{customer.phone}</Text>
              {customerCodeDisplay ? (
                <Text style={styles.customerCodeText}>ID: {customerCodeDisplay}</Text>
              ) : null}
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Close Profile"
            >
              <Icon name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Quick Action Buttons for Ordering (Two Primary Modes) */}
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity
              style={styles.orderPerPieceBtn}
              onPress={() => {
                onClose();
                onCreatePerPieceOrder?.(customer);
              }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Create Per-Piece Order for ${customer.name}`}
            >
              <Icon name="shirt-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.orderPerPieceBtnText} numberOfLines={1}>
                Per-Piece
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.orderPerWeightBtn}
              onPress={() => {
                onClose();
                onCreatePerWeightOrder?.(customer);
              }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Create Per-Weight Order for ${customer.name}`}
            >
              <Icon name="scale-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.orderPerWeightBtnText} numberOfLines={1}>
                Per-Weight
              </Text>
            </TouchableOpacity>
          </View>

          {/* Return to Customer Search Navigation Action */}
          <View style={styles.subBarRow}>
            <TouchableOpacity
              style={styles.returnToSearchBtn}
              onPress={() => {
                onClose();
                onReturnToSearch?.();
              }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Return to Customer Search"
            >
              <Icon
                name="arrow-back-outline"
                size={16}
                color="#1765F5"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.returnToSearchText}>Return to Customer Search</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            {/* Account & Outstanding Balance Overview */}
            <View style={styles.statsCardRow}>
              <View style={styles.statsCard}>
                <Text style={styles.statsLabel}>Total Orders</Text>
                <Text style={styles.statsValue}>{orders.length}</Text>
              </View>
              <View style={[styles.statsCard, totalOutstanding > 0 && styles.statsCardAlert]}>
                <Text style={[styles.statsLabel, totalOutstanding > 0 && styles.statsLabelAlert]}>
                  Outstanding Balance
                </Text>
                <Text style={[styles.statsValue, totalOutstanding > 0 && styles.statsValueAlert]}>
                  ₹{totalOutstanding.toFixed(2)}
                </Text>
              </View>
            </View>

            {/* Badges: Membership & Discount */}
            {hasMembership || hasDiscount ? (
              <View style={styles.badgesRow}>
                {hasMembership ? (
                  <View style={styles.membershipBadgePill}>
                    <Icon name="ribbon-outline" size={14} color="#B45309" />
                    <Text style={styles.membershipBadgeText}>{customer.membership} MEMBER</Text>
                  </View>
                ) : null}
                {hasDiscount ? (
                  <View style={styles.discountBadgePill}>
                    <Icon name="pricetag-outline" size={14} color="#047857" />
                    <Text style={styles.discountBadgeText}>{customer.discountPercent}% OFF</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* Address Card */}
            {customer.address ? (
              <View style={styles.infoCard}>
                <View style={styles.infoCardHeader}>
                  <Icon name="location-outline" size={16} color="#1765F5" />
                  <Text style={styles.infoCardTitle}>Delivery / Registered Address</Text>
                </View>
                <Text style={styles.infoCardBody}>
                  {customer.address}
                  {customer.pincode ? `\nPincode: ${customer.pincode}` : ''}
                </Text>
              </View>
            ) : null}

            {/* Order History Header */}
            <View style={styles.historyHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Icon name="receipt-outline" size={18} color="#0F172A" />
                <Text style={styles.historyTitle}>Recent Order History</Text>
              </View>
              <TouchableOpacity
                onPress={() => loadOrderHistory(customer.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Refresh Order History"
              >
                <Text style={styles.historyRefreshText}>↻ Refresh</Text>
              </TouchableOpacity>
            </View>

            {/* Order History Content */}
            {loadingOrders ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color="#1765F5" />
                <Text style={styles.loadingText}>Fetching customer orders...</Text>
              </View>
            ) : orderError ? (
              <View style={styles.errorBox}>
                <Icon name="alert-circle-outline" size={20} color="#DC2626" />
                <Text style={styles.errorText}>{orderError}</Text>
                <TouchableOpacity
                  style={styles.retryBtn}
                  onPress={() => loadOrderHistory(customer.id)}
                >
                  <Text style={styles.retryBtnText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : orders.length === 0 ? (
              <View style={styles.emptyBox}>
                <Icon name="cube-outline" size={32} color="#94A3B8" />
                <Text style={styles.emptyTitle}>No Orders Yet</Text>
                <Text style={styles.emptySub}>
                  No past orders recorded for this customer in this branch.
                </Text>
              </View>
            ) : (
              <View style={styles.orderListContainer}>
                {orders.map((ord) => {
                  const statusColors = ORDER_STATUS_COLORS[ord.status as OrderStatus] || {
                    bg: '#f1f5f9',
                    text: '#475569',
                    border: '#cbd5e1',
                  };
                  const orderNum = ord.orderNumber.startsWith('GF-')
                    ? `#${ord.orderNumber}`
                    : ord.orderNumber.startsWith('#')
                      ? ord.orderNumber
                      : `#GF-${ord.orderNumber}`;
                  const isPending =
                    ord.paymentStatus === 'PENDING' || (ord.amountDue && ord.amountDue > 0);

                  return (
                    <TouchableOpacity
                      key={ord.id}
                      style={styles.orderRowCard}
                      onPress={() => {
                        onClose();
                        onViewOrder?.(ord.id);
                      }}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={`View Order ${orderNum}`}
                    >
                      <View style={styles.orderSquircle}>
                        <Icon name="shirt-outline" size={18} color="#1765F5" />
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.orderRowNumber}>{orderNum}</Text>
                        <Text style={styles.orderRowDate}>
                          {formatDate(ord.orderDate || ord.effectiveDueDate)}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        <View
                          style={[
                            styles.statusChip,
                            { backgroundColor: statusColors.bg, borderColor: statusColors.border },
                          ]}
                        >
                          <Text style={[styles.statusChipText, { color: statusColors.text }]}>
                            {ord.status.replace(/_/g, ' ')}
                          </Text>
                        </View>
                        <Text style={styles.orderRowTotal}>₹{ord.totalAmount.toFixed(0)}</Text>
                        {isPending && ord.amountDue ? (
                          <Text style={styles.orderRowDue}>Due: ₹{ord.amountDue.toFixed(0)}</Text>
                        ) : null}
                      </View>
                      <Icon
                        name="chevron-forward"
                        size={16}
                        color="#94A3B8"
                        style={{ marginLeft: 6 }}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    minHeight: '65%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  avatarCircleLarge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#1765F5',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1765F5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarTextLarge: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  headerInfoCol: {
    flex: 1,
    marginLeft: 14,
  },
  customerName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  customerPhone: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginTop: 2,
  },
  customerCodeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#94A3B8',
    marginTop: 2,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  orderPerPieceBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#1765F5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    shadowColor: '#1765F5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  orderPerPieceBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  orderPerWeightBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#0284C7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  orderPerWeightBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  subBarRow: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#EFF6FF',
    borderBottomWidth: 1,
    borderBottomColor: '#DBEAFE',
  },
  returnToSearchBtn: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  returnToSearchText: {
    color: '#1765F5',
    fontSize: 13,
    fontWeight: '700',
  },
  statsCardRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  statsCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statsCardAlert: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
  },
  statsLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  statsLabelAlert: {
    color: '#DC2626',
  },
  statsValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 4,
  },
  statsValueAlert: {
    color: '#DC2626',
  },
  scrollArea: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  membershipBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  membershipBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
  },
  discountBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  discountBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065F46',
  },
  infoCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 16,
  },
  infoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  infoCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  infoCardBody: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1E293B',
    lineHeight: 18,
  },
  historyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  historyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  historyRefreshText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1765F5',
  },
  loadingBox: {
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 8,
  },
  errorBox: {
    padding: 16,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    alignItems: 'center',
    gap: 8,
    marginVertical: 10,
  },
  errorText: {
    fontSize: 13,
    color: '#B91C1C',
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyBox: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
    marginTop: 8,
  },
  emptySub: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 20,
  },
  orderListContainer: {
    gap: 8,
    paddingBottom: 24,
  },
  orderRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  orderSquircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderRowNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  orderRowDate: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusChipText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  orderRowTotal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  orderRowDue: {
    fontSize: 11,
    fontWeight: '600',
    color: '#DC2626',
  },
});
