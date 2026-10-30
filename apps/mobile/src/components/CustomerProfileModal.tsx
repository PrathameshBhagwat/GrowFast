import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Linking,
  Platform,
  Alert,
  KeyboardAvoidingView,
  useWindowDimensions,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  CustomerDTO,
  OrderSummaryDTO,
  OrderStatus,
  ORDER_STATUS_COLORS,
  UpdateCustomerRequest,
} from '@growfast/shared-types';
import { apiClient } from '../api/client';

const IonIcon = Ionicons as unknown as React.ComponentType<{
  name: string;
  size?: number;
  color?: string;
  style?: any;
}>;

const MciIcon = MaterialCommunityIcons as unknown as React.ComponentType<{
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
  onCustomerUpdated?: (updatedCustomer: CustomerDTO) => void;
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

type OrderStatusFilter = 'ALL' | 'READY' | 'PROCESSING' | 'DELIVERED' | 'CANCELLED';

const STATUS_FILTERS: { key: OrderStatusFilter; label: string }[] = [
  { key: 'ALL', label: 'All Status' },
  { key: 'READY', label: 'Ready' },
  { key: 'PROCESSING', label: 'Processing' },
  { key: 'DELIVERED', label: 'Delivered' },
  { key: 'CANCELLED', label: 'Cancelled' },
];

export function CustomerProfileModal({
  visible,
  customer,
  onClose,
  onCreatePerPieceOrder,
  onCreatePerWeightOrder,
  onReturnToSearch,
  onViewOrder,
  onCustomerUpdated,
}: CustomerProfileModalProps) {
  const { width: windowWidth } = useWindowDimensions();
  const isNarrowScreen = windowWidth < 360;

  // Active customer state (allows instant inline updates when edited)
  const [activeCustomer, setActiveCustomer] = useState<CustomerDTO | null>(customer);

  // Order history state
  const [orders, setOrders] = useState<OrderSummaryDTO[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<OrderStatusFilter>('ALL');

  // Edit customer modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editPincode, setEditPincode] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const requestIdRef = useRef(0);

  // Sync internal customer state when prop changes
  useEffect(() => {
    setActiveCustomer(customer);
  }, [customer]);

  /**
   * Load order history filtered by customerId, search query, and status.
   */
  const loadOrderHistory = useCallback(
    async (customerId: string, search: string = '', status: OrderStatusFilter = 'ALL') => {
      const currentReqId = ++requestIdRef.current;
      setLoadingOrders(true);
      setOrderError(null);

      try {
        const queryStatus = status === 'ALL' ? undefined : status;
        const res = await apiClient.orders.list({
          customerId,
          search: search.trim() || undefined,
          status: queryStatus,
          pageSize: 20,
        });

        if (currentReqId !== requestIdRef.current) return;
        setOrders(res?.data || []);
      } catch (err: any) {
        if (currentReqId !== requestIdRef.current) return;
        setOrderError(err?.message || 'Could not load order history. Tap Refresh to retry.');
        setOrders([]);
      } finally {
        if (currentReqId === requestIdRef.current) {
          setLoadingOrders(false);
        }
      }
    },
    [],
  );

  // Debounced order fetch when modal is visible or filter/search changes
  useEffect(() => {
    if (!visible || !activeCustomer?.id) {
      setOrders([]);
      setOrderError(null);
      return;
    }

    const timer = setTimeout(() => {
      loadOrderHistory(activeCustomer.id, orderSearchQuery, orderStatusFilter);
    }, 250);

    return () => clearTimeout(timer);
  }, [visible, activeCustomer?.id, orderSearchQuery, orderStatusFilter, loadOrderHistory]);

  // Open address in platform Maps app
  const handleViewOnMap = () => {
    if (!activeCustomer?.address) return;
    const query = encodeURIComponent(
      `${activeCustomer.address}${activeCustomer.pincode ? `, ${activeCustomer.pincode}` : ''}`,
    );
    const url = Platform.select({
      ios: `maps:0,0?q=${query}`,
      android: `geo:0,0?q=${query}`,
      default: `https://www.google.com/maps/search/?api=1&query=${query}`,
    });

    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          Linking.openURL(url);
        } else {
          Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
        }
      })
      .catch(() => {
        Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
      });
  };

  // Open Edit Dialog
  const handleOpenEdit = () => {
    if (!activeCustomer) return;
    setEditName(activeCustomer.name || '');
    setEditPhone(activeCustomer.phone || '');
    setEditAddress(activeCustomer.address || '');
    setEditPincode(activeCustomer.pincode || '');
    setEditError(null);
    setEditModalVisible(true);
  };

  // Save Customer Edits
  const handleSaveCustomer = async () => {
    if (!activeCustomer) return;
    const trimmedName = editName.trim();
    const cleanPhone = editPhone.replace(/[\s\-()]/g, '');

    if (!trimmedName) {
      setEditError('Customer Name is required.');
      return;
    }
    if (cleanPhone.length < 10) {
      setEditError('Valid 10-digit phone number is required.');
      return;
    }

    setIsSavingEdit(true);
    setEditError(null);

    try {
      const payload: UpdateCustomerRequest = {
        name: trimmedName,
        phone: cleanPhone,
        address: editAddress.trim() || undefined,
        pincode: editPincode.trim() || undefined,
      };

      const updated = await apiClient.customers.update(activeCustomer.id, payload);
      setActiveCustomer(updated);
      onCustomerUpdated?.(updated);
      setEditModalVisible(false);
      Alert.alert('Customer Updated', `Profile for "${updated.name}" updated successfully.`);
    } catch (err: any) {
      setEditError(err?.message || 'Failed to update customer details.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  if (!activeCustomer) return null;

  const displayCode = activeCustomer.customerCode
    ? activeCustomer.customerCode
    : activeCustomer.id
      ? activeCustomer.id.replace(/^cust-/, 'CUS-')
      : 'CUS-000000';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.sheetCard}>
          {/* Top Drag Handle (Screenshot 2) */}
          <View style={styles.dragHandle} />

          {/* ── B. CUSTOMER PROFILE HEADER (Screenshot 2) ── */}
          <View style={styles.headerRow}>
            {/* Left: Avatar with soft blue decorative backdrop */}
            <View style={styles.avatarWrapper}>
              <View style={styles.avatarBackdrop} />
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>{getInitials(activeCustomer.name)}</Text>
              </View>
            </View>

            {/* Middle: Name, Phone, ID */}
            <View style={styles.headerInfoCol}>
              <Text style={styles.customerName} numberOfLines={1}>
                {activeCustomer.name}
              </Text>

              {/* Phone with receiver icon */}
              <View style={styles.headerMetaRow}>
                <IonIcon name="call" size={13} color="#64748B" style={styles.metaIcon} />
                <Text style={styles.headerMetaText}>{activeCustomer.phone}</Text>
              </View>

              {/* ID with badge/card icon */}
              <View style={styles.headerMetaRow}>
                <IonIcon name="id-card-outline" size={13} color="#64748B" style={styles.metaIcon} />
                <Text style={styles.headerMetaText}>ID: {displayCode}</Text>
              </View>
            </View>

            {/* Right: Close button & Edit button */}
            <View style={styles.headerActionsCol}>
              <TouchableOpacity
                style={styles.closeBtnCircle}
                onPress={onClose}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel="Close customer details"
              >
                <IonIcon name="close" size={18} color="#64748B" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.editBtnPill}
                onPress={handleOpenEdit}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Edit Customer Details"
              >
                <IonIcon name="pencil" size={13} color="#0866F5" style={{ marginRight: 4 }} />
                <Text style={styles.editBtnText}>Edit</Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {/* ── C. CUSTOMER ADDRESS SECTION (Screenshot 2) ── */}
            <View style={styles.addressCard}>
              <View style={styles.addressIconCircle}>
                <IonIcon name="location-sharp" size={18} color="#0866F5" />
              </View>

              <View style={styles.addressTextCol}>
                <Text style={styles.addressLabel}>Address</Text>
                <Text style={styles.addressVal} numberOfLines={2}>
                  {activeCustomer.address
                    ? `${activeCustomer.address}${activeCustomer.pincode ? `, ${activeCustomer.pincode}` : ''}`
                    : 'No address recorded for this customer.'}
                </Text>
              </View>

              {activeCustomer.address ? (
                <TouchableOpacity
                  style={styles.viewMapBtn}
                  onPress={handleViewOnMap}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="View address on map"
                >
                  <IonIcon
                    name="location-outline"
                    size={14}
                    color="#0866F5"
                    style={{ marginRight: 3 }}
                  />
                  <Text style={styles.viewMapText}>View on Map</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {/* ── D. ORDER HISTORY SECTION (Screenshot 2) ── */}
            <View style={styles.orderHistorySection}>
              {/* Header: Document icon + Title & Subtitle + Refresh button */}
              <View style={styles.orderHistoryHeaderRow}>
                <View style={styles.orderHistoryTitleGroup}>
                  <View style={styles.docIconBox}>
                    <IonIcon name="document-text-outline" size={18} color="#0866F5" />
                  </View>
                  <View>
                    <Text style={styles.orderHistoryHeading}>Order History</Text>
                    <Text style={styles.orderHistorySubheading}>
                      View and track this customer's past orders
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.refreshBtn}
                  onPress={() =>
                    loadOrderHistory(activeCustomer.id, orderSearchQuery, orderStatusFilter)
                  }
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Refresh Order History"
                >
                  <IonIcon name="refresh-outline" size={14} color="#0866F5" />
                  <Text style={styles.refreshBtnText}>Refresh</Text>
                </TouchableOpacity>
              </View>

              {/* Search Bar */}
              <View style={styles.searchBarContainer}>
                <IonIcon
                  name="search-outline"
                  size={17}
                  color="#64748B"
                  style={{ marginRight: 8 }}
                />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search order # (e.g. 1024)..."
                  placeholderTextColor="#94A3B8"
                  value={orderSearchQuery}
                  onChangeText={setOrderSearchQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                />
                {orderSearchQuery.length > 0 ? (
                  <TouchableOpacity
                    onPress={() => setOrderSearchQuery('')}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <IonIcon name="close-circle" size={16} color="#94A3B8" />
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Status Filter Chips (Horizontally Scrollable) */}
              <View style={styles.filterChipsRow}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.filterChipsScroll}
                >
                  {STATUS_FILTERS.map((f) => {
                    const isSelected = orderStatusFilter === f.key;
                    return (
                      <TouchableOpacity
                        key={f.key}
                        style={[styles.filterChip, isSelected && styles.filterChipActive]}
                        onPress={() => setOrderStatusFilter(f.key)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.filterChipText,
                            isSelected && styles.filterChipTextActive,
                          ]}
                        >
                          {f.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Order History Content States */}
              {loadingOrders ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="small" color="#0866F5" />
                  <Text style={styles.loadingText}>Fetching order history...</Text>
                </View>
              ) : orderError ? (
                <View style={styles.errorBox}>
                  <IonIcon name="alert-circle-outline" size={18} color="#DC2626" />
                  <Text style={styles.errorText}>{orderError}</Text>
                  <TouchableOpacity
                    style={styles.retryBtn}
                    onPress={() =>
                      loadOrderHistory(activeCustomer.id, orderSearchQuery, orderStatusFilter)
                    }
                  >
                    <Text style={styles.retryBtnText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : orders.length === 0 ? (
                /* Empty State Card matching Screenshot 2 */
                <View style={styles.emptyStateCard}>
                  {/* Package box graphic with rays */}
                  <View style={styles.packageGraphicWrap}>
                    <View style={styles.packageCloudBackdrop} />
                    <View style={styles.packageSunburstRay1} />
                    <View style={styles.packageSunburstRay2} />
                    <View style={styles.packageBox}>
                      <MciIcon name="package-variant-closed" size={36} color="#0866F5" />
                    </View>
                  </View>

                  <Text style={styles.emptyStateHeading}>No past orders</Text>
                  <Text style={styles.emptyStateSubtext}>
                    No past orders recorded for this customer.
                  </Text>
                </View>
              ) : (
                /* Order History List */
                <View style={styles.orderListWrap}>
                  {orders.map((ord) => {
                    const displayStatus = ord.status;
                    const statusColors = ORDER_STATUS_COLORS[displayStatus] || {
                      bg: '#F1F5F9',
                      text: '#475569',
                      border: '#CBD5E1',
                    };
                    const orderNumDisplay = ord.orderNumber.startsWith('GF-')
                      ? `#${ord.orderNumber}`
                      : ord.orderNumber.startsWith('#')
                        ? ord.orderNumber
                        : `#GF-${ord.orderNumber}`;

                    return (
                      <TouchableOpacity
                        key={ord.id}
                        style={styles.orderItemCard}
                        onPress={() => {
                          onClose();
                          onViewOrder?.(ord.id);
                        }}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={`View Order ${orderNumDisplay}`}
                      >
                        <View style={styles.orderSquircle}>
                          <IonIcon name="shirt-outline" size={16} color="#0866F5" />
                        </View>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={styles.orderNumText}>{orderNumDisplay}</Text>
                          <Text style={styles.orderDateText}>
                            {formatDate(ord.orderDate || ord.effectiveDueDate)}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 3 }}>
                          <View
                            style={[
                              styles.statusBadge,
                              {
                                backgroundColor: statusColors.bg,
                                borderColor: statusColors.border,
                              },
                            ]}
                          >
                            <Text style={[styles.statusBadgeText, { color: statusColors.text }]}>
                              {displayStatus.replace(/_/g, ' ')}
                            </Text>
                          </View>
                          <Text style={styles.orderTotalText}>₹{ord.totalAmount.toFixed(0)}</Text>
                        </View>
                        <IonIcon
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
            </View>

            {/* ── E. CREATE ORDER SECTION (Screenshot 2: EXACTLY TWO OPTIONS) ── */}
            <View style={styles.createOrderContainer}>
              {/* Header row: Cart icon + Title + Subtitle */}
              <View style={styles.createOrderHeaderRow}>
                <View style={styles.cartIconSquircle}>
                  <IonIcon name="cart-outline" size={18} color="#0866F5" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.createOrderHeading} numberOfLines={1}>
                    Create Order for {activeCustomer.name}
                  </Text>
                  <Text style={styles.createOrderSubheading}>
                    Choose how you want to add items to this order
                  </Text>
                </View>
              </View>

              {/* Exactly TWO large order-creation cards: Per-Piece & Per-Weight */}
              <View
                style={[
                  styles.orderCardsRow,
                  isNarrowScreen && styles.orderCardsRowNarrow,
                ]}
              >
                {/* 1. Per-Piece Card (Primary Blue) */}
                <TouchableOpacity
                  style={[
                    styles.orderCardPerPiece,
                    isNarrowScreen && styles.orderCardFullWidth,
                  ]}
                  onPress={() => {
                    onClose();
                    onCreatePerPieceOrder?.(activeCustomer);
                  }}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={`Create Per-Piece Order for ${activeCustomer.name}`}
                >
                  <View style={styles.orderCardLeftIcon}>
                    <IonIcon name="shirt-outline" size={24} color="#FFFFFF" />
                  </View>
                  <View style={styles.orderCardContent}>
                    <Text style={styles.orderCardTitlePerPiece}>Per-Piece</Text>
                    <Text style={styles.orderCardDescPerPiece} numberOfLines={1}>
                      Individual garment pricing
                    </Text>
                  </View>
                  <IonIcon name="arrow-forward" size={18} color="#FFFFFF" />
                </TouchableOpacity>

                {/* 2. Per-Weight Card (White with Blue Border) */}
                <TouchableOpacity
                  style={[
                    styles.orderCardPerWeight,
                    isNarrowScreen && styles.orderCardFullWidth,
                  ]}
                  onPress={() => {
                    onClose();
                    onCreatePerWeightOrder?.(activeCustomer);
                  }}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={`Create Per-Weight Order for ${activeCustomer.name}`}
                >
                  <View style={styles.orderCardLeftIcon}>
                    <MciIcon name="scale-balance" size={24} color="#0866F5" />
                  </View>
                  <View style={styles.orderCardContent}>
                    <Text style={styles.orderCardTitlePerWeight}>Per-Weight</Text>
                    <Text style={styles.orderCardDescPerWeight} numberOfLines={1}>
                      Batch laundry in kg
                    </Text>
                  </View>
                  <IonIcon name="arrow-forward" size={18} color="#0866F5" />
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>

        {/* ── EDIT CUSTOMER MODAL (Triggered by Header Edit Button) ── */}
        <Modal
          visible={editModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setEditModalVisible(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.editModalOverlay}
          >
            <View style={styles.editModalCard}>
              <View style={styles.editModalHeader}>
                <Text style={styles.editModalTitle}>Edit Customer Details</Text>
                <TouchableOpacity
                  onPress={() => setEditModalVisible(false)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <IonIcon name="close" size={20} color="#64748B" />
                </TouchableOpacity>
              </View>

              {editError ? (
                <View style={styles.editErrorBox}>
                  <Text style={styles.editErrorText}>⚠️ {editError}</Text>
                </View>
              ) : null}

              <View style={styles.editInputGroup}>
                <Text style={styles.editInputLabel}>Customer Name *</Text>
                <TextInput
                  style={styles.editTextInput}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Full Name"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <View style={styles.editInputGroup}>
                <Text style={styles.editInputLabel}>Phone / WhatsApp *</Text>
                <TextInput
                  style={styles.editTextInput}
                  value={editPhone}
                  onChangeText={setEditPhone}
                  placeholder="10-digit number"
                  placeholderTextColor="#94A3B8"
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.editInputGroup}>
                <Text style={styles.editInputLabel}>Address</Text>
                <TextInput
                  style={[styles.editTextInput, { height: 60 }]}
                  value={editAddress}
                  onChangeText={setEditAddress}
                  placeholder="Street / Area / Society"
                  placeholderTextColor="#94A3B8"
                  multiline
                />
              </View>

              <View style={styles.editInputGroup}>
                <Text style={styles.editInputLabel}>Pincode</Text>
                <TextInput
                  style={styles.editTextInput}
                  value={editPincode}
                  onChangeText={setEditPincode}
                  placeholder="e.g. 412105"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.editActionsRow}>
                <TouchableOpacity
                  style={styles.editCancelBtn}
                  onPress={() => setEditModalVisible(false)}
                >
                  <Text style={styles.editCancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.editSaveBtn, isSavingEdit && { opacity: 0.7 }]}
                  onPress={handleSaveCustomer}
                  disabled={isSavingEdit}
                >
                  {isSavingEdit ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.editSaveBtnText}>Save Changes</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  sheetCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: '92%',
    paddingBottom: Platform.OS === 'ios' ? 28 : 20,
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -4 },
    elevation: 10,
  },
  dragHandle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 12,
  },

  // ── HEADER ──
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBackdrop: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#EFF6FF',
    transform: [{ scale: 1.1 }],
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#0866F5',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0866F5',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerInfoCol: {
    flex: 1,
  },
  customerName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  headerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  metaIcon: {
    marginRight: 4,
  },
  headerMetaText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  headerActionsCol: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 62,
  },
  closeBtnCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBtnPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    minHeight: 30,
  },
  editBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0866F5',
  },

  scrollBody: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },

  // ── ADDRESS SECTION ──
  addressCard: {
    backgroundColor: '#F0F8FF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E0ECFF',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  addressIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  addressTextCol: {
    flex: 1,
  },
  addressLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  addressVal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    marginTop: 2,
    lineHeight: 18,
  },
  viewMapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 8,
  },
  viewMapText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0866F5',
  },

  // ── ORDER HISTORY SECTION ──
  orderHistorySection: {
    marginBottom: 16,
  },
  orderHistoryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  orderHistoryTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  docIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  orderHistoryHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  orderHistorySubheading: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
  },
  refreshBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0866F5',
  },

  // Search
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    paddingVertical: 0,
  },

  // Status Filter Chips
  filterChipsRow: {
    marginBottom: 12,
  },
  filterChipsScroll: {
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
  },
  filterChipActive: {
    backgroundColor: '#0866F5',
  },
  filterChipText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#475569',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // Loading & Error
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748B',
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 12.5,
    color: '#DC2626',
  },
  retryBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#FEE2E2',
    borderRadius: 6,
  },
  retryBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },

  // Empty State Card (Screenshot 2)
  emptyStateCard: {
    backgroundColor: '#F0F9FF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0ECFF',
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  packageGraphicWrap: {
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    position: 'relative',
  },
  packageCloudBackdrop: {
    position: 'absolute',
    width: 64,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E0F2FE',
    opacity: 0.9,
  },
  packageSunburstRay1: {
    position: 'absolute',
    top: 2,
    width: 2,
    height: 8,
    backgroundColor: '#0866F5',
    borderRadius: 1,
  },
  packageSunburstRay2: {
    position: 'absolute',
    top: 6,
    right: 14,
    width: 2,
    height: 7,
    backgroundColor: '#0866F5',
    borderRadius: 1,
    transform: [{ rotate: '40deg' }],
  },
  packageBox: {
    zIndex: 2,
  },
  emptyStateHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  emptyStateSubtext: {
    fontSize: 12.5,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
  },

  // Populated Order List
  orderListWrap: {
    gap: 8,
  },
  orderItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 10,
  },
  orderSquircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderNumText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  orderDateText: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  orderTotalText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },

  // ── E. CREATE ORDER SECTION (Screenshot 2) ──
  createOrderContainer: {
    backgroundColor: '#F0F9FF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E0ECFF',
    padding: 14,
    marginTop: 14,
    marginBottom: 8,
  },
  createOrderHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cartIconSquircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  createOrderHeading: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  createOrderSubheading: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 1,
  },
  orderCardsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  orderCardsRowNarrow: {
    flexDirection: 'column',
    gap: 8,
  },
  orderCardPerPiece: {
    flex: 1,
    height: 58,
    borderRadius: 12,
    backgroundColor: '#0866F5',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#0866F5',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  orderCardPerWeight: {
    flex: 1,
    height: 58,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#0866F5',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderCardFullWidth: {
    width: '100%',
  },
  orderCardLeftIcon: {
    marginRight: 8,
  },
  orderCardContent: {
    flex: 1,
  },
  orderCardTitlePerPiece: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  orderCardDescPerPiece: {
    fontSize: 10.5,
    color: '#DBEAFE',
    marginTop: 1,
  },
  orderCardTitlePerWeight: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  orderCardDescPerWeight: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 1,
  },

  // ── EDIT CUSTOMER MODAL ──
  editModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  editModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#0F172A',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  editModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  editModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  editErrorBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  editErrorText: {
    fontSize: 12.5,
    color: '#DC2626',
  },
  editInputGroup: {
    marginBottom: 12,
  },
  editInputLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 5,
  },
  editTextInput: {
    height: 44,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 13.5,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  editActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  editCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editCancelBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#475569',
  },
  editSaveBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#0866F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editSaveBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
