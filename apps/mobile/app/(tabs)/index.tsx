import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  OrderStatus,
  PaymentStatus,
  Role,
  OrderSummaryDTO,
  DashboardSummaryDTO,
} from '@growfast/shared-types';
import { getUserSession, MobileUserSession } from '../../src/storage/secure-store';
import { useNetworkStatus } from '../../src/hooks/useNetworkStatus';
import { apiClient } from '../../src/api/client';
import { ConnectionBanner } from '../../src/components/ConnectionBanner';
import { OrderWizardModal } from '../../src/components/wizard/OrderWizardModal';
import { OrderDetailModal } from '../../src/components/OrderDetailModal';
import { listDrafts } from '../../src/db/drafts';
import { syncEngine } from '../../src/services/sync-engine';

export interface DashboardMetrics {
  readyCount: number | null;
  dueTodayCount: number | null;
  deliveriesTodayCount: number | null;
  unpaidCount: number | null;
  offlineDraftCount: number;
  ownerRevenue: number | null;
  ownerOrdersCount: number | null;
}

export default function HomeScreen() {
  const router = useRouter();
  const { isConnected } = useNetworkStatus();
  const [session, setSession] = useState<MobileUserSession | null>(null);

  // Operational KPI state
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    readyCount: null,
    dueTodayCount: null,
    deliveriesTodayCount: null,
    unpaidCount: null,
    offlineDraftCount: 0,
    ownerRevenue: null,
    ownerOrdersCount: null,
  });
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  // Recent Orders State (No fake fallback data in production UI)
  const [recentOrders, setRecentOrders] = useState<OrderSummaryDTO[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Quick Action Sync State
  const [isSyncing, setIsSyncing] = useState(false);

  // Modals
  const [wizardVisible, setWizardVisible] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [orderDetailVisible, setOrderDetailVisible] = useState(false);

  // Stale request guard
  const refreshIdRef = useRef(0);

  useEffect(() => {
    getUserSession().then((user) => {
      setSession(user);
    });
  }, []);

  /**
   * Load local SQLite pending draft count.
   */
  const loadOfflineDraftCount = useCallback(async (): Promise<number> => {
    try {
      const allDrafts = await listDrafts();
      const unsynced = allDrafts.filter(
        (d) =>
          d.syncStatus === 'QUEUED' ||
          d.syncStatus === 'DRAFT' ||
          d.syncStatus === 'FAILED_RETRYABLE' ||
          d.syncStatus === 'CONFLICT',
      );
      return unsynced.length;
    } catch {
      return 0;
    }
  }, []);

  /**
   * Load operational metrics from authorized endpoints with role gating.
   */
  const loadOperationalMetrics = useCallback(
    async (currentSession: MobileUserSession | null) => {
      setLoadingMetrics(true);
      const draftCount = await loadOfflineDraftCount();

      if (!isConnected) {
        setMetrics((prev) => ({
          ...prev,
          offlineDraftCount: draftCount,
        }));
        setLoadingMetrics(false);
        return;
      }

      try {
        // 1. Ready for Pickup: GET /api/orders?status=READY
        const readyPromise = apiClient.orders
          .list({ status: OrderStatus.READY, limit: 1 })
          .then((res) => res.total)
          .catch(() => null);

        // 2. Orders Due Today: GET /api/orders/due-today?countOnly=true
        const dueTodayPromise = apiClient.orders
          .dueToday({ countOnly: true })
          .then((res) => res.count)
          .catch(() => null);

        // 3. Unpaid Orders: GET /api/orders?paymentStatus=PENDING
        const unpaidPromise = apiClient.orders
          .list({ paymentStatus: PaymentStatus.PENDING, limit: 1 })
          .then((res) => res.total)
          .catch(() => null);

        // 4. Deliveries Scheduled for Today: GET /api/deliveries -> filter scheduledAt
        const deliveriesPromise = apiClient.deliveries
          .list()
          .then((records) => {
            if (!Array.isArray(records)) return null;
            const todayStr = new Date().toDateString();
            return records.filter((d) => {
              if (!d.scheduledAt) return false;
              try {
                return new Date(d.scheduledAt).toDateString() === todayStr;
              } catch {
                return false;
              }
            }).length;
          })
          .catch(() => null);

        // 5. OWNER-only Financials: strictly call only if user role is OWNER
        const isOwner = currentSession?.role === Role.OWNER;
        const ownerSummaryPromise: Promise<DashboardSummaryDTO | null> = isOwner
          ? apiClient.dashboard.getSummary().catch(() => null)
          : Promise.resolve(null);

        const [readyTotal, dueTodayTotal, unpaidTotal, deliveriesTotal, ownerSummary] =
          await Promise.all([
            readyPromise,
            dueTodayPromise,
            unpaidPromise,
            deliveriesPromise,
            ownerSummaryPromise,
          ]);

        setMetrics({
          readyCount: readyTotal,
          dueTodayCount: dueTodayTotal,
          deliveriesTodayCount: deliveriesTotal,
          unpaidCount: unpaidTotal,
          offlineDraftCount: draftCount,
          ownerRevenue:
            ownerSummary?.financial?.collections ??
            ownerSummary?.financial?.amountPaid ??
            ownerSummary?.financial?.totalOrderValue ??
            null,
          ownerOrdersCount: ownerSummary?.overview?.totalOrders ?? null,
        });
      } catch (err: any) {
        setMetrics((prev) => ({
          ...prev,
          offlineDraftCount: draftCount,
        }));
      } finally {
        setLoadingMetrics(false);
      }
    },
    [isConnected, loadOfflineDraftCount],
  );

  /**
   * Load compact list of real recent orders from server.
   */
  const loadRecentOrders = useCallback(async () => {
    const currentRefreshId = ++refreshIdRef.current;
    setLoadingOrders(true);
    setOrdersError(null);

    if (!isConnected) {
      setLoadingOrders(false);
      setOrdersError('Device is currently offline. Connect to Wi-Fi to load live server orders.');
      return;
    }

    try {
      const resp = await apiClient.orders.list({ limit: 5, page: 1 });
      if (currentRefreshId !== refreshIdRef.current) return;

      if (resp && resp.data) {
        setRecentOrders(resp.data);
      } else {
        setRecentOrders([]);
      }
      setOrdersError(null);
    } catch (err: any) {
      if (currentRefreshId !== refreshIdRef.current) return;
      const msg = err?.message || 'Unable to load recent orders. Check server connection.';
      setOrdersError(msg);
      setRecentOrders([]);
    } finally {
      if (currentRefreshId === refreshIdRef.current) {
        setLoadingOrders(false);
      }
    }
  }, [isConnected]);

  // Initial load when session or connection changes
  useEffect(() => {
    loadOperationalMetrics(session);
    loadRecentOrders();
  }, [session, isConnected, loadOperationalMetrics, loadRecentOrders]);

  /**
   * Manual refresh of dashboard metrics, drafts, and recent orders.
   */
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([loadOperationalMetrics(session), loadRecentOrders()]);
    setIsRefreshing(false);
  };

  /**
   * Quick Action: Sync all pending offline drafts.
   */
  const handleSyncPendingDrafts = async () => {
    if (isSyncing) return;
    if (!isConnected) {
      Alert.alert(
        'Offline',
        'Cannot sync drafts while disconnected. Please reconnect to your network and try again.',
      );
      return;
    }

    setIsSyncing(true);
    try {
      const result = await syncEngine.syncAllPending(session?.storeId);
      await loadOperationalMetrics(session);
      await loadRecentOrders();

      if (result.processed === 0) {
        Alert.alert(
          'Queue Clean',
          'All orders on this device are already synchronized with the server.',
        );
      } else {
        Alert.alert(
          'Synchronization Complete',
          `Processed: ${result.processed}\nSuccessfully synced: ${result.succeeded}\nPending/Failed: ${result.failed}`,
        );
      }
    } catch (err: any) {
      Alert.alert('Sync Error', err?.message || 'An error occurred during synchronization.');
    } finally {
      setIsSyncing(false);
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

  const formatDate = (dateStr: string) => {
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
  };

  const staffName = session?.name || 'Staff Member';
  const staffInitial = staffName.charAt(0).toUpperCase();
  const staffRole = session?.role || 'COUNTER';
  const storeBranch = session?.storeName || 'GrowFast Branch';
  const isOwner = session?.role === Role.OWNER;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ConnectionBanner />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={['#2563eb']}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header matching Screen 2 */}
        <View style={styles.headerRow}>
          <View style={styles.userProfileGroup}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{staffInitial}</Text>
            </View>
            <View style={{ marginLeft: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.userName}>{staffName}</Text>
                <View style={styles.roleBadge}>
                  <Text style={styles.roleBadgeText}>{staffRole}</Text>
                </View>
              </View>
              <Text style={styles.userBranch}>{storeBranch}</Text>
            </View>
          </View>

          {/* Action Icons */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={handleRefresh}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Refresh Dashboard"
            >
              <Text style={styles.refreshButtonText}>↻</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.bellButton}
              onPress={() =>
                Alert.alert(
                  'Store Status',
                  `Active Store: ${storeBranch}\nOperator: ${staffName} (${staffRole})\nConnection: ${
                    isConnected ? 'Online' : 'Offline Mode'
                  }`,
                )
              }
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Store Information"
            >
              <Text style={styles.bellEmoji}>🔔</Text>
              <View style={[styles.bellBadgeDot, !isConnected && { backgroundColor: '#dc2626' }]} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Operational KPI Cards Grid */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Operations Overview</Text>
          {loadingMetrics ? <ActivityIndicator size="small" color="#2563eb" /> : null}
        </View>

        <View style={styles.kpiGrid}>
          {/* Card 1: Ready for Pickup */}
          <TouchableOpacity
            style={[styles.kpiCard, { borderColor: '#bae6fd' }]}
            onPress={() => router.push('/(tabs)/orders')}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="View Ready Orders"
          >
            <View style={[styles.kpiIconBox, { backgroundColor: '#e0f2fe' }]}>
              <Text style={styles.kpiEmoji}>📦</Text>
            </View>
            <Text style={styles.kpiValue}>
              {metrics.readyCount !== null ? metrics.readyCount : isConnected ? '—' : 'N/A'}
            </Text>
            <Text style={styles.kpiLabel}>Ready for Pickup</Text>
          </TouchableOpacity>

          {/* Card 2: Deliveries Today */}
          <TouchableOpacity
            style={[styles.kpiCard, { borderColor: '#fed7aa' }]}
            onPress={() => router.push('/(tabs)/deliveries' as any)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="View Deliveries Today"
          >
            <View style={[styles.kpiIconBox, { backgroundColor: '#ffedd5' }]}>
              <Text style={styles.kpiEmoji}>🚚</Text>
            </View>
            <Text style={styles.kpiValue}>
              {metrics.deliveriesTodayCount !== null
                ? metrics.deliveriesTodayCount
                : metrics.dueTodayCount !== null
                  ? metrics.dueTodayCount
                  : isConnected
                    ? '—'
                    : 'N/A'}
            </Text>
            <Text style={styles.kpiLabel}>
              {metrics.deliveriesTodayCount !== null ? 'Deliveries Today' : 'Due Today'}
            </Text>
          </TouchableOpacity>

          {/* Card 3: Unpaid Orders Count */}
          <TouchableOpacity
            style={[styles.kpiCard, { borderColor: '#fecdd3' }]}
            onPress={() => router.push('/(tabs)/orders')}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="View Unpaid Orders"
          >
            <View style={[styles.kpiIconBox, { backgroundColor: '#ffe4e6' }]}>
              <Text style={styles.kpiEmoji}>💳</Text>
            </View>
            <Text style={styles.kpiValue}>
              {metrics.unpaidCount !== null ? metrics.unpaidCount : isConnected ? '—' : 'N/A'}
            </Text>
            <Text style={styles.kpiLabel}>Unpaid Orders</Text>
          </TouchableOpacity>

          {/* Card 4: Pending Offline Drafts */}
          <TouchableOpacity
            style={[styles.kpiCard, { borderColor: '#ddd6fe' }]}
            onPress={handleSyncPendingDrafts}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Offline Drafts Queue"
          >
            <View style={[styles.kpiIconBox, { backgroundColor: '#ede9fe' }]}>
              <Text style={styles.kpiEmoji}>⚡</Text>
            </View>
            <Text style={styles.kpiValue}>{metrics.offlineDraftCount}</Text>
            <Text style={styles.kpiLabel}>
              {metrics.offlineDraftCount > 0 ? 'Sync Drafts' : 'Offline Queue'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* OWNER-ONLY Financial Summary Card */}
        {isOwner && metrics.ownerRevenue !== null ? (
          <View style={styles.ownerCard}>
            <View style={styles.ownerCardHeader}>
              <Text style={styles.ownerCardTitle}>👑 Today's Store Financials (Owner View)</Text>
            </View>
            <View style={styles.ownerMetricsRow}>
              <View>
                <Text style={styles.ownerMetricLabel}>Today's Revenue</Text>
                <Text style={styles.ownerMetricValue}>₹{metrics.ownerRevenue.toFixed(2)}</Text>
              </View>
              {metrics.ownerOrdersCount !== null ? (
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.ownerMetricLabel}>Orders Booked</Text>
                  <Text style={styles.ownerMetricValue}>{metrics.ownerOrdersCount}</Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Quick Actions matching Screen 2 */}
        <View style={[styles.sectionHeader, { marginTop: 18 }]}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
        </View>

        <View style={styles.quickActionsGrid}>
          {/* Action 1: Create New Order */}
          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => setWizardVisible(true)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Create New Order"
          >
            <View style={[styles.actionIconCircle, { backgroundColor: '#2563eb' }]}>
              <Text style={styles.actionIconPlus}>+</Text>
            </View>
            <Text style={styles.actionCardTitle}>Create</Text>
            <Text style={styles.actionCardSub}>New Order</Text>
          </TouchableOpacity>

          {/* Action 2: Find Customer (Navigates to Customer Hub Phase 1B) */}
          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => router.push('/(tabs)/customers' as any)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Find Customer"
          >
            <View style={[styles.actionIconCircle, { backgroundColor: '#0284c7' }]}>
              <Text style={styles.actionIconEmoji}>👥</Text>
            </View>
            <Text style={styles.actionCardTitle}>Find</Text>
            <Text style={styles.actionCardSub}>Customer</Text>
          </TouchableOpacity>

          {/* Action 3: Search Orders */}
          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => router.push('/(tabs)/orders')}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Search Orders"
          >
            <View style={[styles.actionIconCircle, { backgroundColor: '#3b82f6' }]}>
              <Text style={styles.actionIconEmoji}>🔍</Text>
            </View>
            <Text style={styles.actionCardTitle}>Search</Text>
            <Text style={styles.actionCardSub}>Orders</Text>
          </TouchableOpacity>

          {/* Action 4: Sync Pending Drafts */}
          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={handleSyncPendingDrafts}
            disabled={isSyncing}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Sync Offline Drafts"
          >
            <View style={[styles.actionIconCircle, { backgroundColor: '#8b5cf6' }]}>
              {isSyncing ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.actionIconEmoji}>🔄</Text>
              )}
            </View>
            <Text style={styles.actionCardTitle}>Sync</Text>
            <Text style={styles.actionCardSub}>Queue</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Orders Section matching Screen 2 */}
        <View style={[styles.sectionHeader, { marginTop: 22 }]}>
          <Text style={styles.sectionTitle}>Recent Orders</Text>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/orders')}
            accessibilityRole="button"
            accessibilityLabel="View All Orders"
          >
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        {loadingOrders && !isRefreshing ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color="#2563eb" />
            <Text style={styles.loadingText}>Fetching recent orders...</Text>
          </View>
        ) : ordersError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {ordersError}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={loadRecentOrders}>
              <Text style={styles.retryBtnText}>↻ Retry</Text>
            </TouchableOpacity>
          </View>
        ) : recentOrders.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyEmoji}>📦</Text>
            <Text style={styles.emptyTitle}>No Orders Yet</Text>
            <Text style={styles.emptySub}>No orders have been recorded for this store yet.</Text>
            <TouchableOpacity style={styles.emptyActionBtn} onPress={() => setWizardVisible(true)}>
              <Text style={styles.emptyActionBtnText}>+ Create First Order</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.ordersListContainer}>
            {recentOrders.map((order) => {
              const badge = getStatusBadgeStyle(order.status, order.effectiveDueDate);
              const orderNumDisplay = order.orderNumber.startsWith('GF-')
                ? `#${order.orderNumber}`
                : order.orderNumber.startsWith('#')
                  ? order.orderNumber
                  : `#GF-${order.orderNumber}`;

              return (
                <TouchableOpacity
                  key={order.id}
                  style={styles.orderCard}
                  onPress={() => {
                    setActiveOrderId(order.id);
                    setOrderDetailVisible(true);
                  }}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`Order ${orderNumDisplay}`}
                >
                  {/* Left Garment Icon matching Screen 2 */}
                  <View style={styles.garmentIconBox}>
                    <Text style={styles.garmentEmoji}>👔</Text>
                  </View>

                  {/* Center Details */}
                  <View style={styles.orderCenterDetails}>
                    <Text style={styles.orderNumberText}>{orderNumDisplay}</Text>
                    <Text style={styles.orderCustomerText} numberOfLines={1}>
                      {order.customerName || (order as any).customer?.name || 'Customer'}
                    </Text>
                    <Text style={styles.orderSubDetails}>
                      {formatDate(order.orderDate)} • ₹{order.totalAmount.toFixed(0)}
                    </Text>
                  </View>

                  {/* Right Status Badge & Chevron */}
                  <View style={styles.orderRightGroup}>
                    <View style={[styles.statusChip, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.statusChipText, { color: badge.text }]}>
                        {badge.label}
                      </Text>
                    </View>
                    <Text style={styles.orderChevron}>›</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Order Wizard Modal integration (Preserves Developer B boundary) */}
      <OrderWizardModal
        visible={wizardVisible}
        draft={null}
        storeId={session?.storeId || 'store-1'}
        userRole={session?.role || 'COUNTER'}
        onClose={() => setWizardVisible(false)}
        onOrderSavedOrSubmitted={() => {
          setWizardVisible(false);
          loadOperationalMetrics(session);
          loadRecentOrders();
        }}
      />

      {/* Order Detail Modal integration */}
      <OrderDetailModal
        visible={orderDetailVisible}
        orderId={activeOrderId}
        onClose={() => {
          setOrderDetailVisible(false);
          setActiveOrderId(null);
        }}
        onOrderUpdated={() => {
          loadOperationalMetrics(session);
          loadRecentOrders();
        }}
      />
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
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 36,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 4,
  },
  userProfileGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#38bdf8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0369a1',
  },
  userName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  roleBadge: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0369a1',
  },
  userBranch: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  refreshButton: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshButtonText: {
    fontSize: 18,
    color: '#3b82f6',
    fontWeight: '700',
  },
  bellButton: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bellEmoji: {
    fontSize: 18,
  },
  bellBadgeDot: {
    position: 'absolute',
    top: 10,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: -0.2,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563eb',
    minHeight: 44,
    lineHeight: 44,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  kpiCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    minHeight: 96,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  kpiIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  kpiEmoji: {
    fontSize: 16,
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  kpiLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 2,
  },
  ownerCard: {
    backgroundColor: '#fefce8',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#fde047',
    padding: 14,
    marginBottom: 14,
  },
  ownerCardHeader: {
    marginBottom: 8,
  },
  ownerCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#854d0e',
  },
  ownerMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ownerMetricLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#a16207',
  },
  ownerMetricValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#713f12',
    marginTop: 2,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 14,
  },
  quickActionCard: {
    flex: 1,
    minHeight: 88,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  actionIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  actionIconPlus: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 22,
  },
  actionIconEmoji: {
    fontSize: 16,
    color: '#ffffff',
  },
  actionCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  actionCardSub: {
    fontSize: 10,
    fontWeight: '500',
    color: '#64748b',
  },
  ordersListContainer: {
    gap: 10,
  },
  orderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    minHeight: 64,
  },
  garmentIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  garmentEmoji: {
    fontSize: 20,
  },
  orderCenterDetails: {
    flex: 1,
    paddingHorizontal: 12,
  },
  orderNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  orderCustomerText: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
    fontWeight: '500',
  },
  orderSubDetails: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  orderRightGroup: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 8,
  },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  orderChevron: {
    fontSize: 20,
    color: '#cbd5e1',
    fontWeight: '300',
    marginLeft: 2,
  },
  loadingBox: {
    padding: 24,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 8,
  },
  errorBox: {
    padding: 14,
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 12,
    flex: 1,
    marginRight: 8,
  },
  retryBtn: {
    minHeight: 44,
    paddingHorizontal: 12,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyBox: {
    padding: 28,
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  emptyEmoji: {
    fontSize: 36,
    marginBottom: 6,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  emptySub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    textAlign: 'center',
  },
  emptyActionBtn: {
    marginTop: 12,
    minHeight: 44,
    paddingHorizontal: 16,
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1d4ed8',
  },
});
