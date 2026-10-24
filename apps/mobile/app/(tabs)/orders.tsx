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
  Modal,
} from 'react-native';
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

export default function OrdersScreen() {
  const { isConnected } = useNetworkStatus();
  const { syncDraft, syncAll, isSyncingAll } = useSyncManager();

  const [session, setSession] = useState<MobileUserSession | null>(null);
  const [drafts, setDrafts] = useState<OrderDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterTab, setFilterTab] = useState<'ALL' | 'PENDING' | 'SYNCED'>('ALL');

  // Order Wizard modal state
  const [editorVisible, setEditorVisible] = useState(false);
  const [selectedDraft, setSelectedDraft] = useState<OrderDraft | null>(null);

  // Order Details & Payments modal state (Phase F)
  const [orderDetailVisible, setOrderDetailVisible] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  // Server order lookup modal state
  const [lookupVisible, setLookupVisible] = useState(false);
  const [lookupQuery, setLookupQuery] = useState('');
  const [isSearchingServer, setIsSearchingServer] = useState(false);
  const [searchResults, setSearchResults] = useState<OrderSummaryDTO[]>([]);

  const loadDrafts = useCallback(async () => {
    try {
      const allDrafts = await listDrafts({ storeId: session?.storeId });
      setDrafts(allDrafts);
    } catch (err: any) {
      console.warn('Failed to load drafts:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session?.storeId]);

  useEffect(() => {
    getUserSession().then((sess) => {
      setSession(sess);
    });
  }, []);

  useEffect(() => {
    if (session) {
      loadDrafts();
    }
  }, [session, loadDrafts]);

  const onRefresh = () => {
    setRefreshing(true);
    loadDrafts();
  };

  const handleOpenNewDraft = () => {
    setSelectedDraft(null);
    setEditorVisible(true);
  };

  const handleOpenOrderDetail = (orderId: string) => {
    setActiveOrderId(orderId);
    setOrderDetailVisible(true);
  };

  const handleEditDraft = (draft: OrderDraft) => {
    if (draft.syncStatus === 'SYNCED') {
      if (draft.serverOrderId) {
        handleOpenOrderDetail(draft.serverOrderId);
      } else {
        Alert.alert(
          'Server Confirmed Order',
          `This order has already been created on the server (Order #${draft.serverOrderNumber || draft.serverOrderId}). Confirmed orders cannot be edited in local drafts.`,
        );
      }
      return;
    }
    if (draft.syncStatus === 'SYNCING') {
      Alert.alert('Synchronizing', 'This draft is actively being submitted to the server.');
      return;
    }
    setSelectedDraft(draft);
    setEditorVisible(true);
  };

  const handleSyncSingleDraft = async (draft: OrderDraft) => {
    if (!isConnected) {
      Alert.alert(
        'Device Offline',
        'Cannot sync draft while device is offline. Draft remains safely stored in local queue.',
      );
      return;
    }

    const result = await syncDraft(draft.clientDraftId);
    await loadDrafts();

    if (result.success) {
      Alert.alert(
        'Order Synchronized',
        `Successfully confirmed on server!\nOrder Number: ${result.orderNumber || result.orderId}`,
        [
          { text: 'Later', style: 'cancel' },
          {
            text: 'View & Pay',
            onPress: () => {
              if (result.orderId) {
                handleOpenOrderDetail(result.orderId);
              }
            },
          },
        ],
      );
    } else if (result.isConflict) {
      Alert.alert(
        'Server Conflict (409)',
        result.error || 'Server rejected order due to a conflict with existing records.',
      );
    } else {
      Alert.alert('Sync Failed', result.error || 'Could not synchronize order.');
    }
  };

  const handleDeleteDraft = (draft: OrderDraft) => {
    if (draft.syncStatus === 'SYNCED') {
      Alert.alert(
        'Clear Local Record',
        'This order is confirmed on the server. Do you want to remove this confirmed record from your local device list? (The server order is NOT cancelled)',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Clear Record',
            style: 'destructive',
            onPress: async () => {
              await clearLocalSyncedRecord(draft.clientDraftId);
              loadDrafts();
            },
          },
        ],
      );
      return;
    }

    Alert.alert(
      'Delete Unsaved Draft',
      `Are you sure you want to delete draft for "${draft.customerName || 'Customer'}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDraft(draft.clientDraftId);
              loadDrafts();
            } catch (err: any) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ],
    );
  };

  const handleSearchServerOrders = async () => {
    const q = lookupQuery.trim();
    if (!q) {
      Alert.alert('Search Input Required', 'Please enter an Order Number, ID, or customer phone.');
      return;
    }
    if (!isConnected) {
      Alert.alert('Network Offline', 'Cannot search server orders while device is offline.');
      return;
    }

    setIsSearchingServer(true);
    try {
      const results = await apiClient.orders.list({ search: q });
      setSearchResults(results.data || []);
    } catch (err: any) {
      Alert.alert('Search Failed', err.message || 'Could not query server orders.');
    } finally {
      setIsSearchingServer(false);
    }
  };

  const getStatusBadge = (status: DraftSyncStatus) => {
    switch (status) {
      case 'SYNCED':
        return { label: 'SYNCED', bg: '#dcfce7', text: '#15803d' };
      case 'SYNCING':
        return { label: 'SYNCING...', bg: '#dbeafe', text: '#1d4ed8' };
      case 'QUEUED':
        return { label: 'QUEUED FOR SYNC', bg: '#fef3c7', text: '#b45309' };
      case 'FAILED_RETRYABLE':
        return { label: 'RETRYABLE FAILED', bg: '#fee2e2', text: '#b91c1c' };
      case 'CONFLICT':
        return { label: '409 CONFLICT', bg: '#ffedd5', text: '#c2410c' };
      default:
        return { label: 'LOCAL DRAFT', bg: '#f1f5f9', text: '#475569' };
    }
  };

  const filteredDrafts = drafts.filter((d) => {
    if (filterTab === 'PENDING') return d.syncStatus !== 'SYNCED';
    if (filterTab === 'SYNCED') return d.syncStatus === 'SYNCED';
    return true;
  });

  return (
    <View style={styles.container}>
      {/* Top Header / Actions */}
      <View style={styles.topBar}>
        <View style={styles.networkStatusContainer}>
          <View
            style={[
              styles.networkDot,
              { backgroundColor: isConnected ? '#16a34a' : '#ea580c' },
            ]}
          />
          <Text style={styles.networkStatusText}>
            {isConnected ? 'Online' : 'Offline'}
          </Text>
        </View>

        <View style={styles.topActionsGroup}>
          <TouchableOpacity
            style={styles.lookupButton}
            onPress={() => {
              setLookupVisible(true);
              setSearchResults([]);
            }}
            accessible={true}
            accessibilityLabel="Search Server Orders"
          >
            <Text style={styles.lookupButtonText}>🔍 Find Order</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.newDraftButton}
            onPress={handleOpenNewDraft}
            accessible={true}
            accessibilityLabel="Create New Order Draft"
          >
            <Text style={styles.newDraftButtonText}>+ New Draft</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Tabs & Sync All */}
      <View style={styles.controlsBar}>
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, filterTab === 'ALL' && styles.tabButtonActive]}
            onPress={() => setFilterTab('ALL')}
          >
            <Text
              style={[
                styles.tabButtonText,
                filterTab === 'ALL' && styles.tabButtonTextActive,
              ]}
            >
              All ({drafts.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, filterTab === 'PENDING' && styles.tabButtonActive]}
            onPress={() => setFilterTab('PENDING')}
          >
            <Text
              style={[
                styles.tabButtonText,
                filterTab === 'PENDING' && styles.tabButtonTextActive,
              ]}
            >
              Queue ({drafts.filter((d) => d.syncStatus !== 'SYNCED').length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, filterTab === 'SYNCED' && styles.tabButtonActive]}
            onPress={() => setFilterTab('SYNCED')}
          >
            <Text
              style={[
                styles.tabButtonText,
                filterTab === 'SYNCED' && styles.tabButtonTextActive,
              ]}
            >
              Synced ({drafts.filter((d) => d.syncStatus === 'SYNCED').length})
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.syncAllButton, (!isConnected || isSyncingAll) && styles.syncAllDisabled]}
          onPress={async () => {
            await syncAll();
            loadDrafts();
          }}
          disabled={!isConnected || isSyncingAll}
          accessible={true}
          accessibilityLabel="Synchronize all pending drafts"
        >
          {isSyncingAll ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.syncAllButtonText}>⚡ Sync Queue</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Main Drafts List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading local drafts...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredDrafts}
          keyExtractor={(item) => item.clientDraftId}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563eb']} />
          }
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No Drafts Found</Text>
              <Text style={styles.emptySubtitle}>
                {filterTab === 'PENDING'
                  ? 'All local orders have been synchronized with the server!'
                  : 'Tap "+ New Draft" to intake an order offline or online, or "Find Order" to inspect existing server orders.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const badge = getStatusBadge(item.syncStatus);
            const totalItems = (item.payload.items || []).reduce(
              (acc, it) => acc + (it.quantity || 1),
              0,
            );

            return (
              <TouchableOpacity
                style={styles.draftCard}
                activeOpacity={0.85}
                onPress={() => {
                  if (item.syncStatus === 'SYNCED' && item.serverOrderId) {
                    handleOpenOrderDetail(item.serverOrderId);
                  } else {
                    handleEditDraft(item);
                  }
                }}
              >
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.customerName}>
                      {item.customerName || 'Walk-in Customer'}
                    </Text>
                    <Text style={styles.customerPhone}>
                      {item.customerPhone || 'No phone provided'}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.statusBadgeText, { color: badge.text }]}>
                      {badge.label}
                    </Text>
                  </View>
                </View>

                {/* Details Breakdown */}
                <View style={styles.cardDetails}>
                  <Text style={styles.detailsText}>
                    📦 {totalItems} item(s) • {item.workflowType || 'LAUNDRY'}
                    {item.isExpress ? ' • ⚡ Express' : ''}
                  </Text>
                  <Text style={styles.draftIdText}>
                    Draft ID: {item.clientDraftId.substring(0, 13)}...
                  </Text>
                </View>

                {/* Server Confirmation Banner */}
                {item.syncStatus === 'SYNCED' && (
                  <View style={styles.syncedBanner}>
                    <Text style={styles.syncedBannerTitle}>
                      ✅ Confirmed Server Order: #{item.serverOrderNumber || item.serverOrderId}
                    </Text>
                    <Text style={styles.syncedBannerSubtitle}>
                      Internal Server ID: {item.serverOrderId}
                    </Text>
                  </View>
                )}

                {/* Conflict Banner */}
                {item.syncStatus === 'CONFLICT' && (
                  <View style={styles.conflictBanner}>
                    <Text style={styles.conflictBannerTitle}>⚠️ Conflict Details</Text>
                    <Text style={styles.conflictBannerText}>
                      {item.conflictDetails ||
                        'The server rejected this submission due to a conflict.'}
                    </Text>
                  </View>
                )}

                {/* Error Banner */}
                {item.syncStatus === 'FAILED_RETRYABLE' && (
                  <View style={styles.errorBanner}>
                    <Text style={styles.errorBannerText}>
                      ⚠️ {item.lastError || 'Network request failed.'} (Retry count:{' '}
                      {item.retryCount})
                    </Text>
                  </View>
                )}

                {/* Card Action Buttons (Touch Target >= 44px) */}
                <View style={styles.cardActions}>
                  {item.syncStatus === 'SYNCED' && item.serverOrderId && (
                    <TouchableOpacity
                      style={[styles.cardActionBtn, styles.viewPayBtn]}
                      onPress={() => handleOpenOrderDetail(item.serverOrderId!)}
                      accessible={true}
                      accessibilityLabel="View order details and collect payment"
                    >
                      <Text style={styles.viewPayBtnText}>💳 View & Pay</Text>
                    </TouchableOpacity>
                  )}

                  {item.syncStatus !== 'SYNCED' && (
                    <TouchableOpacity
                      style={styles.cardActionBtn}
                      onPress={() => handleEditDraft(item)}
                      accessible={true}
                      accessibilityLabel="Edit draft"
                    >
                      <Text style={styles.cardActionText}>✏️ Edit</Text>
                    </TouchableOpacity>
                  )}

                  {item.syncStatus !== 'SYNCED' && (
                    <TouchableOpacity
                      style={[styles.cardActionBtn, styles.syncCardBtn]}
                      onPress={() => handleSyncSingleDraft(item)}
                      accessible={true}
                      accessibilityLabel="Synchronize draft now"
                    >
                      <Text style={styles.syncCardText}>
                        {item.syncStatus === 'FAILED_RETRYABLE' ? '🔄 Retry' : '⚡ Sync'}
                      </Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[styles.cardActionBtn, styles.deleteCardBtn]}
                    onPress={() => handleDeleteDraft(item)}
                    accessible={true}
                    accessibilityLabel="Delete draft or clear local record"
                  >
                    <Text style={styles.deleteCardText}>
                      {item.syncStatus === 'SYNCED' ? 'Clear' : '🗑️ Delete'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Complete Order Creation Wizard Modal */}
      <OrderWizardModal
        visible={editorVisible}
        draft={selectedDraft}
        storeId={session?.storeId || 'store-dev-default'}
        userRole={session?.role}
        onClose={() => setEditorVisible(false)}
        onOrderSavedOrSubmitted={loadDrafts}
      />

      {/* Authoritative Order Details & Payment Operations Modal (Phase F) */}
      <OrderDetailModal
        visible={orderDetailVisible}
        orderId={activeOrderId}
        userRole={session?.role}
        onClose={() => {
          setOrderDetailVisible(false);
          setActiveOrderId(null);
        }}
        onOrderUpdated={loadDrafts}
      />

      {/* Server Order Lookup Modal */}
      <Modal
        visible={lookupVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setLookupVisible(false)}
      >
        <View style={styles.lookupModalOverlay}>
          <View style={styles.lookupModalContent}>
            <View style={styles.lookupModalHeader}>
              <Text style={styles.lookupModalTitle}>Find Server Order</Text>
              <TouchableOpacity
                style={styles.closeLookupBtn}
                onPress={() => setLookupVisible(false)}
                accessible={true}
                accessibilityLabel="Close order lookup modal"
              >
                <Text style={styles.closeLookupBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.lookupInstructions}>
              Search by Order Number, Order ID, or Customer Phone to view payments and manage items:
            </Text>

            <View style={styles.searchRow}>
              <TextInput
                style={styles.searchInput}
                placeholder="e.g. GF-20261023-0001 or phone"
                value={lookupQuery}
                onChangeText={setLookupQuery}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.searchExecuteBtn}
                onPress={handleSearchServerOrders}
                disabled={isSearchingServer}
                accessible={true}
                accessibilityLabel="Execute server search"
              >
                {isSearchingServer ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.searchExecuteBtnText}>Search</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Search Results */}
            <FlatList
              data={searchResults}
              keyExtractor={(res) => res.id}
              style={{ maxHeight: 300, marginTop: 12 }}
              ListEmptyComponent={
                lookupQuery && !isSearchingServer ? (
                  <Text style={styles.emptySearchText}>No matching orders found on server.</Text>
                ) : null
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.searchResultItem}
                  onPress={() => {
                    setLookupVisible(false);
                    handleOpenOrderDetail(item.id);
                  }}
                  accessible={true}
                  accessibilityLabel={`Select order ${item.orderNumber}`}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resultOrderNum}>#{item.orderNumber}</Text>
                    <Text style={styles.resultCustomer}>{item.customerName} • 📞 {item.customerPhone}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.resultTotal}>₹{item.totalAmount.toFixed(2)}</Text>
                    <Text
                      style={[
                        styles.resultDue,
                        { color: item.amountDue > 0 ? '#b91c1c' : '#15803d' },
                      ]}
                    >
                      {item.amountDue > 0 ? `Due: ₹${item.amountDue.toFixed(2)}` : 'Paid'}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  networkStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  networkDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  networkStatusText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  topActionsGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  lookupButton: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lookupButtonText: {
    color: '#334155',
    fontWeight: '600',
    fontSize: 13,
  },
  newDraftButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newDraftButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  controlsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 2,
  },
  tabButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 44,
    borderRadius: 6,
    justifyContent: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  tabButtonTextActive: {
    color: '#0f172a',
  },
  syncAllButton: {
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncAllDisabled: {
    backgroundColor: '#94a3b8',
  },
  syncAllButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: '#64748b',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
  },
  draftCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  customerPhone: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  cardDetails: {
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#f8fafc',
  },
  detailsText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '500',
  },
  draftIdText: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
    fontFamily: 'monospace',
  },
  syncedBanner: {
    backgroundColor: '#f0fdf4',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    marginTop: 8,
  },
  syncedBannerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  syncedBannerSubtitle: {
    fontSize: 11,
    color: '#15803d',
    marginTop: 2,
  },
  conflictBanner: {
    backgroundColor: '#fff7ed',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fed7aa',
    marginTop: 8,
  },
  conflictBannerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9a3412',
  },
  conflictBannerText: {
    fontSize: 11,
    color: '#c2410c',
    marginTop: 2,
  },
  errorBanner: {
    backgroundColor: '#fef2f2',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fecaca',
    marginTop: 8,
  },
  errorBannerText: {
    fontSize: 11,
    color: '#b91c1c',
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
  },
  cardActionBtn: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  cardActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  viewPayBtn: {
    backgroundColor: '#2563eb',
  },
  viewPayBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  syncCardBtn: {
    backgroundColor: '#059669',
  },
  syncCardText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  deleteCardBtn: {
    backgroundColor: '#fee2e2',
  },
  deleteCardText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#dc2626',
  },
  lookupModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  lookupModalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 20,
    maxHeight: '80%',
  },
  lookupModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  lookupModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  closeLookupBtn: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeLookupBtnText: {
    fontSize: 18,
    color: '#64748b',
  },
  lookupInstructions: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 12,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    backgroundColor: '#f8fafc',
  },
  searchExecuteBtn: {
    height: 44,
    minWidth: 70,
    backgroundColor: '#2563eb',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  searchExecuteBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  emptySearchText: {
    textAlign: 'center',
    paddingVertical: 20,
    color: '#94a3b8',
    fontSize: 13,
  },
  searchResultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    minHeight: 44,
  },
  resultOrderNum: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  resultCustomer: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  resultTotal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  resultDue: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
});
