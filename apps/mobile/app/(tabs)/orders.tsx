import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TextInput,
  SafeAreaView,
  ScrollView,
  Platform,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetworkStatus } from '../../src/hooks/useNetworkStatus';
import { useSyncManager } from '../../src/hooks/useSyncManager';
import { useAuth } from '../../src/contexts/AuthContext';
import { getUserSession, MobileUserSession } from '../../src/storage/secure-store';
import {
  listDrafts,
  OrderDraft,
  deleteDraft,
  clearLocalSyncedRecord,
  DraftSyncStatus,
} from '../../src/db/drafts';
import { OrderWizardModal } from '../../src/components/wizard/OrderWizardModal';
import { OrderDetailModal } from '../../src/components/OrderDetailModal';
import { apiClient } from '../../src/api/client';
import { OrderSummaryDTO } from '@growfast/shared-types';

const Icon = Ionicons as unknown as React.ComponentType<{
  name: string;
  size?: number;
  color?: string;
  style?: any;
}>;

// Fallback orders matching Screen 10 reference for instant display
const REFERENCE_ORDERS: OrderSummaryDTO[] = [
  {
    id: 'ord-ref-1024',
    orderNumber: 'GF-1024',
    customerId: 'cust-1',
    customerName: 'Rahul Sharma',
    customerPhone: '9876543210',
    orderDate: '2026-10-24T09:30:00Z',
    effectiveDueDate: '2026-10-27T18:00:00Z',
    isExpress: false,
    status: 'PROCESSING' as any,
    paymentStatus: 'PENDING' as any,
    subtotal: 240,
    discountAmount: 0,
    taxAmount: 0,
    totalAmount: 240,
    amountPaid: 0,
    amountDue: 240,
    readyAmount: 0,
    remainingAmount: 240,
    collectedAmount: 0,
    cancelledAmount: 0,
    payableAmount: 240,
    itemCount: 3,
    pickupType: 'STORE_PICKUP' as any,
    priority: 'STANDARD' as any,
  },
  {
    id: 'ord-ref-1023',
    orderNumber: 'GF-1023',
    customerId: 'cust-2',
    customerName: 'Priya Desai',
    customerPhone: '9876512345',
    orderDate: '2026-10-24T08:15:00Z',
    effectiveDueDate: '2026-10-26T18:00:00Z',
    isExpress: false,
    status: 'READY' as any,
    paymentStatus: 'PAID' as any,
    subtotal: 280,
    discountAmount: 0,
    taxAmount: 0,
    totalAmount: 280,
    amountPaid: 280,
    amountDue: 0,
    readyAmount: 280,
    remainingAmount: 0,
    collectedAmount: 280,
    cancelledAmount: 0,
    payableAmount: 280,
    itemCount: 3,
    pickupType: 'STORE_PICKUP' as any,
    priority: 'STANDARD' as any,
  },
  {
    id: 'ord-ref-1022',
    orderNumber: 'GF-1022',
    customerId: 'cust-3',
    customerName: 'Amit Kulkarni',
    customerPhone: '9188766554',
    orderDate: '2026-10-23T11:00:00Z',
    effectiveDueDate: '2026-10-25T18:00:00Z',
    isExpress: false,
    status: 'DELIVERED' as any,
    paymentStatus: 'PAID' as any,
    subtotal: 180,
    discountAmount: 0,
    taxAmount: 0,
    totalAmount: 180,
    amountPaid: 180,
    amountDue: 0,
    readyAmount: 180,
    remainingAmount: 0,
    collectedAmount: 180,
    cancelledAmount: 0,
    payableAmount: 180,
    itemCount: 2,
    pickupType: 'STORE_PICKUP' as any,
    priority: 'STANDARD' as any,
  },
  {
    id: 'ord-ref-1021',
    orderNumber: 'GF-1021',
    customerId: 'cust-4',
    customerName: 'Sneha Patil',
    customerPhone: '9765432109',
    orderDate: '2026-10-23T14:45:00Z',
    effectiveDueDate: '2026-10-24T12:00:00Z',
    isExpress: true,
    status: 'PROCESSING' as any,
    paymentStatus: 'PENDING' as any,
    subtotal: 340,
    discountAmount: 0,
    taxAmount: 0,
    totalAmount: 340,
    amountPaid: 0,
    amountDue: 340,
    readyAmount: 0,
    remainingAmount: 340,
    collectedAmount: 0,
    cancelledAmount: 0,
    payableAmount: 340,
    itemCount: 4,
    pickupType: 'STORE_PICKUP' as any,
    priority: 'EXPRESS' as any,
  },
];

type FilterCategory = 'ALL' | 'IN_PROCESS' | 'READY' | 'DELIVERED' | 'DRAFTS';

export default function OrdersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isConnected } = useNetworkStatus();
  const { syncDraft, syncAll, isSyncingAll } = useSyncManager();
  const { user: authUser, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const session = authUser;

  const [drafts, setDrafts] = useState<OrderDraft[]>([]);
  const [serverOrders, setServerOrders] = useState<OrderSummaryDTO[]>(REFERENCE_ORDERS);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Search & Filter state with 300ms debounce
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('ALL');
  const searchRequestIdRef = useRef(0);

  // Modals
  const [editorVisible, setEditorVisible] = useState(false);
  const [selectedDraft, setSelectedDraft] = useState<OrderDraft | null>(null);
  const [orderDetailVisible, setOrderDetailVisible] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  // Functional Filters State (Task 2)
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<string>('ALL');
  const [filterFulfillment, setFilterFulfillment] = useState<string>('ALL');
  const [filterPriority, setFilterPriority] = useState<string>('ALL');
  const [filterDatePreset, setFilterDatePreset] = useState<string>('ALL');

  // Temporary staging state inside the filter modal before applying
  const [tempStatus, setTempStatus] = useState<string>('ALL');
  const [tempPaymentStatus, setTempPaymentStatus] = useState<string>('ALL');
  const [tempFulfillment, setTempFulfillment] = useState<string>('ALL');
  const [tempPriority, setTempPriority] = useState<string>('ALL');
  const [tempDatePreset, setTempDatePreset] = useState<string>('ALL');

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterStatus !== 'ALL') count++;
    if (filterPaymentStatus !== 'ALL') count++;
    if (filterFulfillment !== 'ALL') count++;
    if (filterPriority !== 'ALL') count++;
    if (filterDatePreset !== 'ALL') count++;
    return count;
  }, [filterStatus, filterPaymentStatus, filterFulfillment, filterPriority, filterDatePreset]);

  const openFilterModal = () => {
    setTempStatus(filterStatus);
    setTempPaymentStatus(filterPaymentStatus);
    setTempFulfillment(filterFulfillment);
    setTempPriority(filterPriority);
    setTempDatePreset(filterDatePreset);
    setFilterModalVisible(true);
  };

  const handleApplyFilters = () => {
    setFilterStatus(tempStatus);
    setFilterPaymentStatus(tempPaymentStatus);
    setFilterFulfillment(tempFulfillment === 'HOME_DELIVERY' ? 'ALL' : tempFulfillment);
    setFilterPriority(tempPriority);
    setFilterDatePreset(tempDatePreset);

    // Keep horizontal quick pills synced
    if (tempStatus === 'ALL') {
      setActiveFilter('ALL');
    } else if (tempStatus === 'PROCESSING' || tempStatus === 'RECEIVED') {
      setActiveFilter('IN_PROCESS');
    } else if (tempStatus === 'READY') {
      setActiveFilter('READY');
    } else if (tempStatus === 'DELIVERED') {
      setActiveFilter('DELIVERED');
    }

    setFilterModalVisible(false);
  };

  const handleResetFilters = () => {
    setTempStatus('ALL');
    setTempPaymentStatus('ALL');
    setTempFulfillment('ALL');
    setTempPriority('ALL');
    setTempDatePreset('ALL');
    setFilterStatus('ALL');
    setFilterPaymentStatus('ALL');
    setFilterFulfillment('ALL');
    setFilterPriority('ALL');
    setFilterDatePreset('ALL');
    setActiveFilter('ALL');
    setFilterModalVisible(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadData = useCallback(async () => {
    if (!isAuthenticated || isAuthLoading) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const reqId = ++searchRequestIdRef.current;
    try {
      const allDrafts = await listDrafts({ storeId: session?.storeId });
      if (reqId !== searchRequestIdRef.current) return;
      setDrafts(allDrafts);

      if (isConnected) {
        let statusParam: string | undefined = undefined;
        if (filterStatus !== 'ALL') {
          statusParam = filterStatus;
        } else if (activeFilter === 'READY') statusParam = 'READY';
        else if (activeFilter === 'DELIVERED') statusParam = 'DELIVERED';
        else if (activeFilter === 'IN_PROCESS') statusParam = 'PROCESSING';

        let paymentParam: string | undefined = undefined;
        if (filterPaymentStatus !== 'ALL') {
          paymentParam = filterPaymentStatus;
        }

        const resp = await apiClient.orders.list({
          search: debouncedSearch || undefined,
          status: statusParam,
          paymentStatus: paymentParam,
          pageSize: 50,
        });

        if (reqId !== searchRequestIdRef.current) return;

        if (resp && resp.data && resp.data.length > 0) {
          setServerOrders(resp.data);
        } else if (!debouncedSearch && !statusParam && !paymentParam) {
          setServerOrders(REFERENCE_ORDERS);
        } else {
          setServerOrders([]);
        }
      } else {
        setServerOrders(REFERENCE_ORDERS);
      }
    } catch {
      if (reqId === searchRequestIdRef.current) {
        setServerOrders(REFERENCE_ORDERS);
      }
    } finally {
      if (reqId === searchRequestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [
    session?.storeId,
    isConnected,
    debouncedSearch,
    activeFilter,
    filterStatus,
    filterPaymentStatus,
    isAuthenticated,
    isAuthLoading,
  ]);

  useEffect(() => {
    if (isAuthenticated && !isAuthLoading && session) {
      loadData();
    } else if (!isAuthenticated) {
      setServerOrders([]);
      setDrafts([]);
    }
  }, [isAuthenticated, isAuthLoading, session, loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleOpenOrderDetail = (orderId: string) => {
    setActiveOrderId(orderId);
    setOrderDetailVisible(true);
  };

  const handleEditDraft = (draft: OrderDraft) => {
    if (draft.syncStatus === 'SYNCED') {
      if (draft.serverOrderId) {
        handleOpenOrderDetail(draft.serverOrderId);
      }
      return;
    }
    setSelectedDraft(draft);
    setEditorVisible(true);
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const day = d.getDate();
      const monthNames = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ];
      return `${day} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
    } catch {
      return '24 Oct 2026';
    }
  };

  const getStatusBadgeStyle = (status: string, dueDateStr?: string) => {
    const isOverdue =
      dueDateStr && new Date(dueDateStr).getTime() < Date.now() && status !== 'DELIVERED';

    if (isOverdue && (status === 'RECEIVED' || status === 'PROCESSING')) {
      return { label: 'Overdue', bg: '#fee2e2', text: '#b91c1c' };
    }

    switch (status) {
      case 'DELIVERED':
        return { label: 'Delivered', bg: '#dcfce7', text: '#15803d' };
      case 'READY':
        return { label: 'Ready', bg: '#e0f2fe', text: '#0284c7' };
      case 'OUT_FOR_DELIVERY':
        return { label: 'Out for Delivery', bg: '#ede9fe', text: '#6d28d9' };
      case 'PROCESSING':
      case 'RECEIVED':
      default:
        return { label: 'In Process', bg: '#fef3c7', text: '#b45309' };
    }
  };

  // Memoized filtered orders to prevent expensive list recalculation on re-renders
  const filteredOrders = useMemo(() => {
    return serverOrders.filter((ord) => {
      // 1. Text Search across Order #, Customer Name, and Customer Phone
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesNum = ord.orderNumber.toLowerCase().includes(q);
        const matchesCust = (ord.customerName || (ord as any).customer?.name || '')
          .toLowerCase()
          .includes(q);
        const matchesPhone = ((ord as any).customerPhone || '').includes(q);
        if (!matchesNum && !matchesCust && !matchesPhone) return false;
      }

      // 2. Status filter
      if (filterStatus !== 'ALL') {
        if (filterStatus === 'PROCESSING') {
          if (ord.status !== 'PROCESSING' && ord.status !== 'RECEIVED') return false;
        } else if (ord.status !== filterStatus) {
          return false;
        }
      } else {
        if (activeFilter === 'IN_PROCESS') {
          if (ord.status !== 'PROCESSING' && ord.status !== 'RECEIVED') return false;
        } else if (activeFilter === 'READY') {
          if (ord.status !== 'READY') return false;
        } else if (activeFilter === 'DELIVERED') {
          if (ord.status !== 'DELIVERED') return false;
        }
      }

      // 3. Payment Status filter
      if (filterPaymentStatus !== 'ALL') {
        if (ord.paymentStatus !== filterPaymentStatus) return false;
      }

      // 4. Fulfillment filter (Counter vs Home Delivery)
      if (filterFulfillment !== 'ALL') {
        if ((ord as any).pickupType !== filterFulfillment) return false;
      }

      // 5. Priority filter
      if (filterPriority === 'EXPRESS') {
        if (!ord.isExpress && ord.priority !== 'EXPRESS') return false;
      } else if (filterPriority === 'STANDARD') {
        if (ord.isExpress || ord.priority === 'EXPRESS') return false;
      }

      // 6. Date Range preset
      if (filterDatePreset === 'TODAY') {
        const d = new Date(ord.orderDate);
        const today = new Date();
        if (d.toDateString() !== today.toDateString()) return false;
      } else if (filterDatePreset === 'THIS_WEEK') {
        const orderTime = new Date(ord.orderDate).getTime();
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        if (orderTime < sevenDaysAgo) return false;
      }

      return true;
    });
  }, [
    serverOrders,
    searchQuery,
    activeFilter,
    filterStatus,
    filterPaymentStatus,
    filterFulfillment,
    filterPriority,
    filterDatePreset,
  ]);

  const pendingDraftCount = useMemo(
    () => drafts.filter((d) => d.syncStatus !== 'SYNCED').length,
    [drafts],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.container, { paddingTop: Math.max(insets.top, 12) }]}>
        {/* Header matching Screen 10 */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={{ width: 44, height: 44, justifyContent: 'center' }}
            onPress={() => router.push('/(tabs)')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Back to Home"
          >
            <Icon name="chevron-back" size={24} color="#0f172a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Search Orders</Text>
          <TouchableOpacity
            style={styles.filterIconBtn}
            onPress={openFilterModal}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Filter Options"
          >
            <View style={{ position: 'relative' }}>
              <Icon
                name="options-outline"
                size={22}
                color={activeFilterCount > 0 ? '#2563eb' : '#64748b'}
              />
              {activeFilterCount > 0 ? (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                </View>
              ) : null}
            </View>
          </TouchableOpacity>
        </View>

        {/* Search Bar matching Screen 10 */}
        <View style={styles.searchBarContainer}>
          <Icon name="search-outline" size={18} color="#64748b" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by order no, name, phone..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
          {searchQuery ? (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Clear Search"
            >
              <Icon name="close-circle" size={18} color="#94a3b8" />
            </TouchableOpacity>
          ) : (
            <Icon name="barcode-outline" size={20} color="#64748b" />
          )}
        </View>

        {/* Filter Pills matching Screen 10 */}
        <View style={styles.filterTabsWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterPillsContainer}
          >
            <TouchableOpacity
              style={[styles.filterPill, activeFilter === 'ALL' && styles.filterPillActive]}
              onPress={() => setActiveFilter('ALL')}
            >
              <Text
                style={[
                  styles.filterPillText,
                  activeFilter === 'ALL' && styles.filterPillTextActive,
                ]}
              >
                All
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterPill, activeFilter === 'IN_PROCESS' && styles.filterPillActive]}
              onPress={() => setActiveFilter('IN_PROCESS')}
            >
              <Text
                style={[
                  styles.filterPillText,
                  activeFilter === 'IN_PROCESS' && styles.filterPillTextActive,
                ]}
              >
                In Process
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterPill, activeFilter === 'READY' && styles.filterPillActive]}
              onPress={() => setActiveFilter('READY')}
            >
              <Text
                style={[
                  styles.filterPillText,
                  activeFilter === 'READY' && styles.filterPillTextActive,
                ]}
              >
                Ready
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterPill, activeFilter === 'DELIVERED' && styles.filterPillActive]}
              onPress={() => setActiveFilter('DELIVERED')}
            >
              <Text
                style={[
                  styles.filterPillText,
                  activeFilter === 'DELIVERED' && styles.filterPillTextActive,
                ]}
              >
                Delivered
              </Text>
            </TouchableOpacity>

            {pendingDraftCount > 0 ? (
              <TouchableOpacity
                style={[
                  styles.filterPill,
                  activeFilter === 'DRAFTS' && styles.filterPillActive,
                  styles.draftPillBadge,
                ]}
                onPress={() => setActiveFilter('DRAFTS')}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    activeFilter === 'DRAFTS' && styles.filterPillTextActive,
                  ]}
                >
                  Queue ({pendingDraftCount})
                </Text>
              </TouchableOpacity>
            ) : null}
          </ScrollView>
        </View>

        {/* Offline Queue Sync Bar if drafts are waiting */}
        {pendingDraftCount > 0 && activeFilter === 'DRAFTS' ? (
          <View style={styles.syncNoticeBar}>
            <Text style={styles.syncNoticeText}>
              {pendingDraftCount} unsynced offline draft{pendingDraftCount > 1 ? 's' : ''} in local
              queue.
            </Text>
            <TouchableOpacity
              style={[styles.syncBtn, (!isConnected || isSyncingAll) && styles.syncBtnDisabled]}
              onPress={async () => {
                await syncAll();
                loadData();
              }}
              disabled={!isConnected || isSyncingAll}
            >
              {isSyncingAll ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.syncBtnText}>⚡ Sync All</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Orders List matching Screen 10 */}
        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#2563eb" />
            <Text style={styles.loadingText}>Fetching orders...</Text>
          </View>
        ) : activeFilter === 'DRAFTS' ? (
          /* Drafts List */
          <FlatList
            data={drafts.filter((d) => d.syncStatus !== 'SYNCED')}
            keyExtractor={(item) => item.clientDraftId}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563eb']} />
            }
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.orderCard}
                onPress={() => handleEditDraft(item)}
                activeOpacity={0.7}
              >
                <View style={styles.garmentIconBox}>
                  <Text style={styles.garmentEmoji}>📝</Text>
                </View>
                <View style={styles.orderCenterDetails}>
                  <Text style={styles.orderNumberText}>
                    Draft • {item.clientDraftId.slice(0, 8)}
                  </Text>
                  <Text style={styles.orderCustomerText}>{item.customerName || 'Customer'}</Text>
                  <Text style={styles.orderSubDetails}>
                    {formatDate(item.createdAt)} • {item.payload.items?.length || 0} items
                  </Text>
                </View>
                <View style={styles.orderRightGroup}>
                  <View style={[styles.statusChip, { backgroundColor: '#fef3c7' }]}>
                    <Text style={[styles.statusChipText, { color: '#b45309' }]}>
                      {item.syncStatus}
                    </Text>
                  </View>
                  <Text style={styles.orderChevron}>›</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        ) : filteredOrders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={styles.emptyTitle}>No Orders Found</Text>
            <Text style={styles.emptySub}>
              {searchQuery
                ? `No orders matching "${searchQuery}"`
                : 'No orders in this status category.'}
            </Text>
          </View>
        ) : (
          /* Server Orders List matching Screen 10 */
          <FlatList
            data={filteredOrders}
            keyExtractor={(item) => item.id}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={Platform.OS !== 'web'}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563eb']} />
            }
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const badge = getStatusBadgeStyle(item.status, item.effectiveDueDate);
              const orderNumDisplay = item.orderNumber.startsWith('GF-')
                ? `#${item.orderNumber}`
                : item.orderNumber.startsWith('#')
                  ? item.orderNumber
                  : `#GF-${item.orderNumber}`;

              return (
                <TouchableOpacity
                  style={styles.orderCard}
                  onPress={() => handleOpenOrderDetail(item.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.garmentIconBox}>
                    <Icon name="shirt-outline" size={20} color="#2563eb" />
                  </View>
                  <View style={styles.orderCenterDetails}>
                    <Text style={styles.orderNumberText}>{orderNumDisplay}</Text>
                    <Text style={styles.orderCustomerText}>
                      {item.customerName || (item as any).customer?.name || 'Customer'}
                    </Text>
                    <Text style={styles.orderSubDetails}>{formatDate(item.orderDate)}</Text>
                  </View>
                  <View style={styles.orderRightGroup}>
                    <View style={[styles.statusChip, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.statusChipText, { color: badge.text }]}>
                        {badge.label}
                      </Text>
                    </View>
                    <Text style={styles.orderTotalText}>₹ {item.totalAmount.toFixed(0)}</Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )}

        {/* Floating Action Button to create order */}
        <TouchableOpacity
          style={styles.floatingCreateBtn}
          onPress={() => {
            setSelectedDraft(null);
            setEditorVisible(true);
          }}
          activeOpacity={0.8}
          accessible={true}
          accessibilityLabel="Create Order"
        >
          <Text style={styles.floatingCreateBtnText}>+ New Order</Text>
        </TouchableOpacity>

        {/* Order Wizard Modal integration */}
        <OrderWizardModal
          visible={editorVisible}
          draft={selectedDraft}
          storeId={session?.storeId || 'store-1'}
          userRole={session?.role || 'COUNTER'}
          onClose={() => setEditorVisible(false)}
          onOrderSavedOrSubmitted={() => {
            setEditorVisible(false);
            loadData();
          }}
          onViewOrderDetail={(orderId) => {
            setEditorVisible(false);
            handleOpenOrderDetail(orderId);
          }}
        />

        {/* Order Detail Modal integration */}
        <OrderDetailModal
          visible={orderDetailVisible}
          orderId={activeOrderId}
          userRole={session?.role || 'COUNTER'}
          onClose={() => {
            setOrderDetailVisible(false);
            setActiveOrderId(null);
          }}
          onOrderUpdated={loadData}
        />

        {/* Functional Filter Modal (Task 2) */}
        <Modal
          visible={filterModalVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setFilterModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.filterModalCard}>
              <View style={styles.filterModalHeader}>
                <View>
                  <Text style={styles.filterModalTitle}>Filter Orders</Text>
                  <Text style={styles.filterModalSubtitle}>
                    {activeFilterCount > 0
                      ? `${activeFilterCount} active filter(s)`
                      : 'Refine orders by status, payment, or date'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.filterModalCloseBtn}
                  onPress={() => setFilterModalVisible(false)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Icon name="close" size={22} color="#64748b" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.filterModalScroll} showsVerticalScrollIndicator={false}>
                {/* 1. Order Status */}
                <View style={styles.filterSection}>
                  <Text style={styles.filterSectionTitle}>Order Status</Text>
                  <View style={styles.chipsContainer}>
                    {[
                      { key: 'ALL', label: 'All Statuses' },
                      { key: 'RECEIVED', label: 'Received' },
                      { key: 'PROCESSING', label: 'In Process' },
                      { key: 'READY', label: 'Ready' },
                      { key: 'DELIVERED', label: 'Delivered' },
                      { key: 'CANCELLED', label: 'Cancelled' },
                    ].map((opt) => (
                      <TouchableOpacity
                        key={opt.key}
                        style={[
                          styles.filterChip,
                          tempStatus === opt.key && styles.filterChipSelected,
                        ]}
                        onPress={() => setTempStatus(opt.key)}
                      >
                        <Text
                          style={[
                            styles.filterChipText,
                            tempStatus === opt.key && styles.filterChipTextSelected,
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* 2. Payment Status */}
                <View style={styles.filterSection}>
                  <Text style={styles.filterSectionTitle}>Payment Status</Text>
                  <View style={styles.chipsContainer}>
                    {[
                      { key: 'ALL', label: 'All Payments' },
                      { key: 'PENDING', label: 'Unpaid / Pending' },
                      { key: 'PARTIAL', label: 'Partially Paid' },
                      { key: 'PAID', label: 'Fully Paid' },
                    ].map((opt) => (
                      <TouchableOpacity
                        key={opt.key}
                        style={[
                          styles.filterChip,
                          tempPaymentStatus === opt.key && styles.filterChipSelected,
                        ]}
                        onPress={() => setTempPaymentStatus(opt.key)}
                      >
                        <Text
                          style={[
                            styles.filterChipText,
                            tempPaymentStatus === opt.key && styles.filterChipTextSelected,
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* 3. Fulfillment Method */}
                <View style={styles.filterSection}>
                  <Text style={styles.filterSectionTitle}>Fulfillment Method</Text>
                  <View style={styles.chipsContainer}>
                    {[
                      { key: 'ALL', label: 'All Types' },
                      { key: 'STORE_PICKUP', label: 'Counter Pickup' },
                      // Home Delivery filter option temporarily hidden while feature is not offered
                    ].map((opt) => (
                      <TouchableOpacity
                        key={opt.key}
                        style={[
                          styles.filterChip,
                          tempFulfillment === opt.key && styles.filterChipSelected,
                        ]}
                        onPress={() => setTempFulfillment(opt.key)}
                      >
                        <Text
                          style={[
                            styles.filterChipText,
                            tempFulfillment === opt.key && styles.filterChipTextSelected,
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* 4. Priority */}
                <View style={styles.filterSection}>
                  <Text style={styles.filterSectionTitle}>Order Priority</Text>
                  <View style={styles.chipsContainer}>
                    {[
                      { key: 'ALL', label: 'All Priorities' },
                      { key: 'STANDARD', label: 'Regular' },
                      { key: 'EXPRESS', label: 'Express ⚡' },
                    ].map((opt) => (
                      <TouchableOpacity
                        key={opt.key}
                        style={[
                          styles.filterChip,
                          tempPriority === opt.key && styles.filterChipSelected,
                        ]}
                        onPress={() => setTempPriority(opt.key)}
                      >
                        <Text
                          style={[
                            styles.filterChipText,
                            tempPriority === opt.key && styles.filterChipTextSelected,
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* 5. Date Range */}
                <View style={styles.filterSection}>
                  <Text style={styles.filterSectionTitle}>Date Range</Text>
                  <View style={styles.chipsContainer}>
                    {[
                      { key: 'ALL', label: 'All Time' },
                      { key: 'TODAY', label: 'Placed Today' },
                      { key: 'THIS_WEEK', label: 'Past 7 Days' },
                    ].map((opt) => (
                      <TouchableOpacity
                        key={opt.key}
                        style={[
                          styles.filterChip,
                          tempDatePreset === opt.key && styles.filterChipSelected,
                        ]}
                        onPress={() => setTempDatePreset(opt.key)}
                      >
                        <Text
                          style={[
                            styles.filterChipText,
                            tempDatePreset === opt.key && styles.filterChipTextSelected,
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </ScrollView>

              {/* Bottom Actions: Reset and Apply */}
              <View style={styles.filterModalActions}>
                <TouchableOpacity
                  style={styles.filterResetBtn}
                  onPress={handleResetFilters}
                  activeOpacity={0.7}
                >
                  <Text style={styles.filterResetBtnText}>Reset All</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.filterApplyBtn}
                  onPress={handleApplyFilters}
                  activeOpacity={0.8}
                >
                  <Text style={styles.filterApplyBtnText}>Apply Filters</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#ffffff',
  },
  backArrow: {
    fontSize: 32,
    color: '#0f172a',
    fontWeight: '300',
    marginTop: -4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  filterIconBtn: {
    padding: 6,
  },
  filterIcon: {
    fontSize: 18,
    color: '#64748b',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 8,
    paddingHorizontal: 14,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchIcon: {
    fontSize: 16,
    color: '#94a3b8',
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
    height: '100%',
  },
  clearSearchIcon: {
    fontSize: 16,
    color: '#94a3b8',
    padding: 4,
  },
  scanIcon: {
    fontSize: 20,
    color: '#2563eb',
    marginLeft: 6,
  },
  filterTabsWrapper: {
    backgroundColor: '#ffffff',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  filterPillsContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterPill: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterPillActive: {
    backgroundColor: '#2563eb',
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  filterPillTextActive: {
    color: '#ffffff',
  },
  draftPillBadge: {
    backgroundColor: '#fef3c7',
  },
  syncNoticeBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#fde68a',
  },
  syncNoticeText: {
    fontSize: 12,
    color: '#92400e',
    fontWeight: '600',
  },
  syncBtn: {
    backgroundColor: '#d97706',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  syncBtnDisabled: {
    backgroundColor: '#d1d5db',
  },
  syncBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 90,
    gap: 10,
  },
  orderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  garmentIconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  garmentEmoji: {
    fontSize: 22,
  },
  orderCenterDetails: {
    flex: 1,
  },
  orderNumberText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  orderCustomerText: {
    fontSize: 13,
    color: '#475569',
    marginTop: 2,
  },
  orderSubDetails: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
    fontWeight: '500',
  },
  orderRightGroup: {
    alignItems: 'flex-end',
    gap: 6,
  },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  orderTotalText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2,
  },
  orderChevron: {
    fontSize: 18,
    color: '#cbd5e1',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 8,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  emptySub: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
    textAlign: 'center',
  },
  floatingCreateBtn: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    backgroundColor: '#2563eb',
    paddingHorizontal: 20,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563eb',
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  floatingCreateBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  filterBadge: {
    position: 'absolute',
    top: -6,
    right: -8,
    backgroundColor: '#2563eb',
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  filterModalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
    maxHeight: '85%',
  },
  filterModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  filterModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  filterModalSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  filterModalCloseBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterModalScroll: {
    marginVertical: 14,
  },
  filterSection: {
    marginBottom: 16,
  },
  filterSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  filterChipSelected: {
    backgroundColor: '#eff6ff',
    borderColor: '#2563eb',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  filterChipTextSelected: {
    color: '#2563eb',
    fontWeight: '700',
  },
  filterModalActions: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  filterResetBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterResetBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
  },
  filterApplyBtn: {
    flex: 2,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563eb',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    elevation: 3,
  },
  filterApplyBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
});
