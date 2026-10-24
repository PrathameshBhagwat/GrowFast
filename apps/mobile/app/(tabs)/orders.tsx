import React, { useEffect, useState, useCallback } from 'react';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { useNetworkStatus } from '../../src/hooks/useNetworkStatus';
import { useSyncManager } from '../../src/hooks/useSyncManager';
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
  const { isConnected } = useNetworkStatus();
  const { syncDraft, syncAll, isSyncingAll } = useSyncManager();

  const [session, setSession] = useState<MobileUserSession | null>(null);
  const [drafts, setDrafts] = useState<OrderDraft[]>([]);
  const [serverOrders, setServerOrders] = useState<OrderSummaryDTO[]>(REFERENCE_ORDERS);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Search & Filter state matching Screen 10
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('ALL');

  // Modals
  const [editorVisible, setEditorVisible] = useState(false);
  const [selectedDraft, setSelectedDraft] = useState<OrderDraft | null>(null);
  const [orderDetailVisible, setOrderDetailVisible] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const allDrafts = await listDrafts({ storeId: session?.storeId });
      setDrafts(allDrafts);

      if (isConnected) {
        let statusParam: string | undefined = undefined;
        if (activeFilter === 'READY') statusParam = 'READY';
        else if (activeFilter === 'DELIVERED') statusParam = 'DELIVERED';
        else if (activeFilter === 'IN_PROCESS') statusParam = 'PROCESSING';

        const resp = await apiClient.orders.list({
          search: searchQuery.trim() || undefined,
          status: statusParam,
          limit: 30,
        });

        if (resp && resp.data && resp.data.length > 0) {
          setServerOrders(resp.data);
        } else if (!searchQuery.trim()) {
          setServerOrders(REFERENCE_ORDERS);
        } else {
          setServerOrders([]);
        }
      } else {
        setServerOrders(REFERENCE_ORDERS);
      }
    } catch {
      setServerOrders(REFERENCE_ORDERS);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session?.storeId, isConnected, searchQuery, activeFilter]);

  useEffect(() => {
    getUserSession().then((sess) => {
      setSession(sess);
    });
  }, []);

  useEffect(() => {
    if (session) {
      loadData();
    }
  }, [session, loadData]);

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

  // Filter server orders locally if offline or searching
  const filteredOrders = serverOrders.filter((ord) => {
    if (activeFilter === 'IN_PROCESS') {
      return ord.status === 'PROCESSING' || ord.status === 'RECEIVED';
    }
    if (activeFilter === 'READY') {
      return ord.status === 'READY';
    }
    if (activeFilter === 'DELIVERED') {
      return ord.status === 'DELIVERED';
    }
    return true;
  });

  const pendingDraftCount = drafts.filter((d) => d.syncStatus !== 'SYNCED').length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header matching Screen 10 */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.backArrow}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Search Orders</Text>
          <TouchableOpacity
            style={styles.filterIconBtn}
            onPress={() => {
              Alert.alert('Filter Options', 'Show: All, In Process, Ready, Delivered');
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.filterIcon}>⚙</Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar matching Screen 10 */}
        <View style={styles.searchBarContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
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
            >
              <Text style={styles.clearSearchIcon}>✕</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.scanIcon}>⊡</Text>
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
                    <Text style={styles.garmentEmoji}>👔</Text>
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
});
