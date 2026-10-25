import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  TextInput,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
import { DeliveryRecordDTO, DeliveryStatus, Role } from '@growfast/shared-types';
import { getUserSession, MobileUserSession } from '../../src/storage/secure-store';
import { useNetworkStatus } from '../../src/hooks/useNetworkStatus';
import { apiClient } from '../../src/api/client';
import { ConnectionBanner } from '../../src/components/ConnectionBanner';
import { DeliveryDetailModal } from '../../src/components/DeliveryDetailModal';
import { DeliveryCompletionModal } from '../../src/components/DeliveryCompletionModal';

type FilterTab = 'ALL' | DeliveryStatus;

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: DeliveryStatus.SCHEDULED, label: 'Scheduled' },
  { key: DeliveryStatus.ASSIGNED, label: 'Assigned' },
  { key: DeliveryStatus.IN_TRANSIT, label: 'In Transit' },
  { key: DeliveryStatus.COMPLETED, label: 'Completed' },
  { key: DeliveryStatus.FAILED, label: 'Failed' },
];

export default function DeliveriesScreen() {
  const { isConnected } = useNetworkStatus();
  const [session, setSession] = useState<MobileUserSession | null>(null);

  // Deliveries State
  const [deliveries, setDeliveries] = useState<DeliveryRecordDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Delivery for Modals
  const [activeDelivery, setActiveDelivery] = useState<DeliveryRecordDTO | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [completionModalVisible, setCompletionModalVisible] = useState(false);

  // Driver Assignment State (Owner/Manager only)
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [deliveryToAssign, setDeliveryToAssign] = useState<DeliveryRecordDTO | null>(null);
  const [availableRiders, setAvailableRiders] = useState<
    { id: string; name: string; role: string }[]
  >([]);
  const [loadingRiders, setLoadingRiders] = useState(false);
  const [selectedRiderId, setSelectedRiderId] = useState<string>('');
  const [isAssigning, setIsAssigning] = useState(false);

  // Load session
  useEffect(() => {
    getUserSession().then((user) => {
      setSession(user);
    });
  }, []);

  // Fetch Deliveries from authenticated endpoint
  const fetchDeliveries = useCallback(async () => {
    setError(null);
    if (!isConnected) {
      setLoading(false);
      setRefreshing(false);
      setError('Device is currently offline. Connect to Wi-Fi to load deliveries.');
      return;
    }

    try {
      const statusParam = activeTab === 'ALL' ? undefined : activeTab;
      const data = await apiClient.deliveries.list(statusParam);
      if (Array.isArray(data)) {
        setDeliveries(data);
      } else {
        setDeliveries([]);
      }
    } catch (err: any) {
      setError(err?.data?.message || err?.message || 'Failed to fetch deliveries from server.');
      setDeliveries([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isConnected, activeTab]);

  useEffect(() => {
    setLoading(true);
    fetchDeliveries();
  }, [fetchDeliveries]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDeliveries();
  };

  // Open driver assignment modal
  const handleOpenAssignDriver = async (delivery: DeliveryRecordDTO) => {
    setDeliveryToAssign(delivery);
    setSelectedRiderId('');
    setAssignModalVisible(true);
    setLoadingRiders(true);

    try {
      const directory = await apiClient.auth.getDirectory(['DELIVERY']);
      setAvailableRiders(directory || []);
    } catch {
      // Fallback: fetch general directory
      try {
        const directory = await apiClient.auth.getDirectory();
        setAvailableRiders(directory.filter((e) => e.role === Role.DELIVERY) || []);
      } catch {
        setAvailableRiders([]);
      }
    } finally {
      setLoadingRiders(false);
    }
  };

  // Submit Driver Assignment
  const handleConfirmAssignment = async () => {
    if (!deliveryToAssign || !selectedRiderId) {
      Alert.alert('Rider Required', 'Please select a delivery rider from the list.');
      return;
    }

    setIsAssigning(true);
    try {
      await apiClient.deliveries.assign(deliveryToAssign.id, selectedRiderId);
      Alert.alert(
        'Rider Assigned',
        `Driver successfully assigned to Order #${deliveryToAssign.orderNumber}.`,
      );
      setAssignModalVisible(false);
      setDeliveryToAssign(null);
      fetchDeliveries();
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || 'Could not assign driver.';
      Alert.alert('Assignment Error', Array.isArray(msg) ? msg.join('\n') : msg);
    } finally {
      setIsAssigning(false);
    }
  };

  // Quick action: Start delivery (ASSIGNED -> IN_TRANSIT)
  const handleQuickStartDelivery = async (delivery: DeliveryRecordDTO) => {
    try {
      await apiClient.deliveries.updateStatus(
        delivery.id,
        DeliveryStatus.IN_TRANSIT,
        'Out for delivery',
      );
      Alert.alert('In Transit', `Order #${delivery.orderNumber} is now out for delivery.`);
      fetchDeliveries();
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || 'Could not start delivery.';
      Alert.alert('Status Error', Array.isArray(msg) ? msg.join('\n') : msg);
    }
  };

  // Filter deliveries by local search query
  const filteredDeliveries = useMemo(() => {
    if (!searchQuery.trim()) return deliveries;
    const q = searchQuery.toLowerCase().trim();
    return deliveries.filter(
      (d) =>
        d.orderNumber.toLowerCase().includes(q) ||
        d.customerName.toLowerCase().includes(q) ||
        d.address.toLowerCase().includes(q) ||
        (d.riderName && d.riderName.toLowerCase().includes(q)),
    );
  }, [deliveries, searchQuery]);

  // Operational counts
  const counts = useMemo(() => {
    const scheduled = deliveries.filter((d) => d.status === DeliveryStatus.SCHEDULED).length;
    const assigned = deliveries.filter((d) => d.status === DeliveryStatus.ASSIGNED).length;
    const inTransit = deliveries.filter((d) => d.status === DeliveryStatus.IN_TRANSIT).length;
    const completed = deliveries.filter((d) => d.status === DeliveryStatus.COMPLETED).length;
    const failed = deliveries.filter((d) => d.status === DeliveryStatus.FAILED).length;
    return { scheduled, assigned, inTransit, completed, failed, total: deliveries.length };
  }, [deliveries]);

  const getStatusBadgeStyle = (status: DeliveryStatus) => {
    switch (status) {
      case DeliveryStatus.SCHEDULED:
        return { label: 'Scheduled', bg: '#e0f2fe', text: '#0284c7' };
      case DeliveryStatus.ASSIGNED:
        return { label: 'Assigned', bg: '#ede9fe', text: '#6d28d9' };
      case DeliveryStatus.IN_TRANSIT:
        return { label: 'Out for Delivery', bg: '#fef3c7', text: '#b45309' };
      case DeliveryStatus.COMPLETED:
        return { label: 'Delivered', bg: '#dcfce7', text: '#15803d' };
      case DeliveryStatus.FAILED:
        return { label: 'Failed', bg: '#fee2e2', text: '#b91c1c' };
      default:
        return { label: status, bg: '#f1f5f9', text: '#475569' };
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'Unscheduled';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const isOwnerOrManager = session?.role === Role.OWNER || session?.role === Role.MANAGER;
  const staffName = session?.name || 'Staff Member';
  const staffRole = session?.role || 'COUNTER';
  const storeBranch = session?.storeName || 'GrowFast Branch';

  const renderDeliveryCard = ({ item }: { item: DeliveryRecordDTO }) => {
    const badge = getStatusBadgeStyle(item.status);
    const orderNumDisplay = item.orderNumber.startsWith('#')
      ? item.orderNumber
      : `#${item.orderNumber}`;
    const isAssignedToCurrentRider = item.riderId === session?.id;
    const canOperate = isOwnerOrManager || isAssignedToCurrentRider;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => {
          setActiveDelivery(item);
          setDetailModalVisible(true);
        }}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Delivery for ${orderNumDisplay}`}
      >
        {/* Card Header: Order Number, Badge, Chevron */}
        <View style={styles.cardHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={styles.deliveryIconBox}>
              <Text style={styles.deliveryEmoji}>🚚</Text>
            </View>
            <View>
              <Text style={styles.orderNumberText}>{orderNumDisplay}</Text>
              <Text style={styles.customerNameText}>{item.customerName}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
              <Text style={[styles.statusBadgeText, { color: badge.text }]}>{badge.label}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </View>
        </View>

        {/* Destination Address */}
        <View style={styles.addressRow}>
          <Text style={styles.addressPin}>📍</Text>
          <Text style={styles.addressText} numberOfLines={2}>
            {item.address}
          </Text>
        </View>

        {/* Sub-info: Scheduled date & Driver */}
        <View style={styles.cardFooterInfo}>
          <Text style={styles.scheduledText}>📅 {formatDate(item.scheduledAt)}</Text>
          <Text style={styles.riderText}>
            👤 {item.riderName ? item.riderName : 'No Rider Assigned'}
          </Text>
        </View>

        {/* Quick Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          {item.status === DeliveryStatus.SCHEDULED && isOwnerOrManager ? (
            <TouchableOpacity
              style={styles.cardActionBtn}
              onPress={(e) => {
                e.stopPropagation();
                handleOpenAssignDriver(item);
              }}
              accessibilityRole="button"
              accessibilityLabel="Assign Driver"
            >
              <Text style={styles.cardActionBtnText}>👤 Assign Rider</Text>
            </TouchableOpacity>
          ) : null}

          {item.status === DeliveryStatus.ASSIGNED && canOperate ? (
            <TouchableOpacity
              style={[styles.cardActionBtn, { backgroundColor: '#2563eb' }]}
              onPress={(e) => {
                e.stopPropagation();
                handleQuickStartDelivery(item);
              }}
              accessibilityRole="button"
              accessibilityLabel="Start Delivery"
            >
              <Text style={[styles.cardActionBtnText, { color: '#ffffff' }]}>
                🚚 Start Delivery
              </Text>
            </TouchableOpacity>
          ) : null}

          {item.status === DeliveryStatus.IN_TRANSIT && canOperate ? (
            <TouchableOpacity
              style={[styles.cardActionBtn, { backgroundColor: '#16a34a' }]}
              onPress={(e) => {
                e.stopPropagation();
                setActiveDelivery(item);
                setCompletionModalVisible(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="Complete Delivery"
            >
              <Text style={[styles.cardActionBtnText, { color: '#ffffff' }]}>
                ✓ Complete Delivery
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ConnectionBanner />
      <View style={styles.container}>
        {/* Top Header */}
        <View style={styles.headerRow}>
          <View style={styles.userProfileGroup}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{staffName.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ marginLeft: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.userName}>{staffName}</Text>
                <View style={styles.roleBadge}>
                  <Text style={styles.roleBadgeText}>{staffRole}</Text>
                </View>
              </View>
              <Text style={styles.userBranch}>{storeBranch}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.refreshButton}
            onPress={handleRefresh}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Refresh Deliveries"
          >
            <Text style={styles.refreshButtonText}>↻</Text>
          </TouchableOpacity>
        </View>

        {/* Operational Overview Counters */}
        <View style={styles.counterBar}>
          <View style={styles.counterBox}>
            <Text style={styles.counterVal}>{counts.inTransit}</Text>
            <Text style={styles.counterLabel}>In Transit</Text>
          </View>
          <View style={styles.counterDivider} />
          <View style={styles.counterBox}>
            <Text style={styles.counterVal}>{counts.assigned}</Text>
            <Text style={styles.counterLabel}>Assigned</Text>
          </View>
          <View style={styles.counterDivider} />
          <View style={styles.counterBox}>
            <Text style={[styles.counterVal, { color: '#16a34a' }]}>{counts.completed}</Text>
            <Text style={styles.counterLabel}>Completed</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by order #, customer, address, rider..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
        </View>

        {/* Status Filters Horizontal Scroll */}
        <View style={styles.filterTabsWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterTabsScroll}
          >
            {FILTER_TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.filterChip, isActive && styles.filterChipActive]}
                  onPress={() => setActiveTab(tab.key)}
                  activeOpacity={0.7}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isActive }}
                >
                  <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Main List */}
        {loading && !refreshing ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.loadingText}>Fetching deliveries...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerBox}>
            <Text style={styles.errorEmoji}>⚠️</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={fetchDeliveries}>
              <Text style={styles.retryBtnText}>↻ Retry</Text>
            </TouchableOpacity>
          </View>
        ) : filteredDeliveries.length === 0 ? (
          <View style={styles.centerBox}>
            <Text style={styles.emptyEmoji}>🚚</Text>
            <Text style={styles.emptyTitle}>No Deliveries Found</Text>
            <Text style={styles.emptySub}>
              {searchQuery
                ? `No delivery matching "${searchQuery}".`
                : activeTab === 'ALL'
                  ? 'There are currently no delivery records for this store.'
                  : `No deliveries with status "${activeTab}".`}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredDeliveries}
            keyExtractor={(item) => item.id}
            renderItem={renderDeliveryCard}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={['#2563eb']}
              />
            }
          />
        )}
      </View>

      {/* Delivery Detail Modal */}
      <DeliveryDetailModal
        visible={detailModalVisible}
        delivery={activeDelivery}
        userRole={session?.role}
        currentUserId={session?.id}
        onClose={() => {
          setDetailModalVisible(false);
          setActiveDelivery(null);
        }}
        onDeliveryUpdated={fetchDeliveries}
        onAssignDriverRequested={(d) => {
          setDetailModalVisible(false);
          handleOpenAssignDriver(d);
        }}
      />

      {/* Delivery Completion Modal */}
      <DeliveryCompletionModal
        visible={completionModalVisible}
        delivery={activeDelivery}
        userRole={session?.role}
        onClose={() => {
          setCompletionModalVisible(false);
          setActiveDelivery(null);
        }}
        onDeliveryCompleted={fetchDeliveries}
      />

      {/* Driver Assignment Modal (Owner/Manager) */}
      <Modal
        visible={assignModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setAssignModalVisible(false)}
      >
        <View style={styles.assignOverlay}>
          <View style={styles.assignCard}>
            <View style={styles.assignHeaderRow}>
              <Text style={styles.assignTitle}>Assign Delivery Rider</Text>
              <TouchableOpacity
                onPress={() => setAssignModalVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.assignClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.assignSub}>
              Select a delivery driver for Order #{deliveryToAssign?.orderNumber}:
            </Text>

            {loadingRiders ? (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <ActivityIndicator color="#2563eb" />
                <Text style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>
                  Loading staff riders...
                </Text>
              </View>
            ) : availableRiders.length === 0 ? (
              <View style={{ padding: 16, alignItems: 'center' }}>
                <Text style={{ color: '#64748b', fontSize: 13 }}>
                  No active DELIVERY riders found.
                </Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 240, marginVertical: 8 }}>
                {availableRiders.map((rider) => {
                  const isSelected = selectedRiderId === rider.id;
                  return (
                    <TouchableOpacity
                      key={rider.id}
                      style={[styles.riderOptionRow, isSelected && styles.riderOptionRowSelected]}
                      onPress={() => setSelectedRiderId(rider.id)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.riderOptionName, isSelected && { color: '#1e40af' }]}>
                          {rider.name}
                        </Text>
                        <Text style={styles.riderOptionSub}>Role: {rider.role}</Text>
                      </View>
                      <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                        {isSelected ? <View style={styles.radioDot} /> : null}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <View style={styles.assignActionsRow}>
              <TouchableOpacity
                style={styles.assignCancelBtn}
                onPress={() => setAssignModalVisible(false)}
              >
                <Text style={styles.assignCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.assignConfirmBtn, !selectedRiderId && { opacity: 0.5 }]}
                onPress={handleConfirmAssignment}
                disabled={isAssigning || !selectedRiderId}
              >
                {isAssigning ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.assignConfirmText}>Confirm Assignment</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
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
    fontSize: 15,
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
  counterBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingVertical: 10,
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  counterBox: {
    flex: 1,
    alignItems: 'center',
  },
  counterVal: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  counterLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 2,
  },
  counterDivider: {
    width: 1,
    backgroundColor: '#f1f5f9',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    minHeight: 44,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
    minHeight: 44,
  },
  filterTabsWrapper: {
    marginTop: 10,
    marginBottom: 4,
  },
  filterTabsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  filterChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deliveryIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deliveryEmoji: {
    fontSize: 18,
  },
  orderNumberText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  customerNameText: {
    fontSize: 12,
    color: '#475569',
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  chevron: {
    fontSize: 18,
    color: '#cbd5e1',
    fontWeight: '300',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 10,
    backgroundColor: '#f8fafc',
    padding: 8,
    borderRadius: 8,
  },
  addressPin: {
    fontSize: 13,
  },
  addressText: {
    flex: 1,
    fontSize: 12,
    color: '#334155',
    lineHeight: 16,
  },
  cardFooterInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  scheduledText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  riderText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  actionButtonsContainer: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 8,
  },
  cardActionBtn: {
    minHeight: 44,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  cardActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 10,
  },
  errorEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 13,
    color: '#b91c1c',
    textAlign: 'center',
    marginBottom: 12,
  },
  retryBtn: {
    minHeight: 44,
    paddingHorizontal: 18,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyEmoji: {
    fontSize: 36,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  emptySub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    textAlign: 'center',
  },
  assignOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  assignCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
  },
  assignHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  assignTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  assignClose: {
    fontSize: 18,
    color: '#64748b',
    padding: 4,
  },
  assignSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    marginBottom: 10,
  },
  riderOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
  riderOptionRowSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  riderOptionName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  riderOptionSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#94a3b8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: '#2563eb',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2563eb',
  },
  assignActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 14,
  },
  assignCancelBtn: {
    minHeight: 44,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assignCancelText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  assignConfirmBtn: {
    minHeight: 44,
    paddingHorizontal: 16,
    backgroundColor: '#2563eb',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assignConfirmText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
