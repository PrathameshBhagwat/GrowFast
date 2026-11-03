import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../api/client';
import {
  OverdueCleanupOrderDTO,
  OverdueCleanupSummaryResponseDTO,
  OrderStatus,
} from '@growfast/shared-types';

const Icon = Ionicons as unknown as React.ComponentType<{
  name: string;
  size?: number;
  color?: string;
  style?: any;
}>;

// Session-level guard to ensure the prompt appears AT MOST ONCE per app session
let sessionPromptTriggered = false;

export function resetCleanupSessionPrompt(): void {
  sessionPromptTriggered = false;
}

interface OverdueCleanupModalProps {
  onCleanupCompleted?: (archivedCount: number) => void;
  /**
   * If provided, allows triggering the review screen directly (e.g. from a button or banner).
   */
  forceOpenReview?: boolean;
  onCloseReview?: () => void;
}

export const OverdueCleanupModal: React.FC<OverdueCleanupModalProps> = ({
  onCleanupCompleted,
  forceOpenReview = false,
  onCloseReview,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();

  // Dialog stages:
  // 'NONE' -> neither modal open
  // 'PROMPT' -> initial one-time alert modal ("Long-Overdue Orders")
  // 'REVIEW' -> full review list screen
  const [stage, setStage] = useState<'NONE' | 'PROMPT' | 'REVIEW'>('NONE');
  const [loading, setLoading] = useState<boolean>(false);
  const [archiving, setArchiving] = useState<boolean>(false);
  const [cleanupData, setCleanupData] = useState<OverdueCleanupSummaryResponseDTO | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const isOwner = user?.role === 'OWNER';

  // Check eligibility on app entry for authorized owners
  const checkEligibility = useCallback(
    async (isManualTrigger = false) => {
      if (!isAuthenticated || isAuthLoading || !isOwner) {
        return;
      }
      if (!isManualTrigger && sessionPromptTriggered) {
        return;
      }

      try {
        setLoading(true);
        const res = await apiClient.orders.getCleanupEligibleOrders();
        setCleanupData(res);

        if (res && res.totalEligibleCount > 0) {
          // Pre-select all eligible orders by default for convenient review
          setSelectedIds(new Set(res.eligibleOrders.map((o) => o.id)));

          if (!isManualTrigger && !sessionPromptTriggered) {
            sessionPromptTriggered = true;
            setStage('PROMPT');
          } else if (isManualTrigger) {
            setStage('REVIEW');
          }
        } else {
          if (isManualTrigger) {
            Alert.alert(
              'No Long-Overdue Orders',
              'There are currently no orders uncollected for more than 90 days.',
              [{ text: 'OK' }],
            );
          }
        }
      } catch (err: any) {
        // Non-blocking error handling
        console.warn('[OverdueCleanupModal] Failed to check eligible orders:', err?.message || err);
      } finally {
        setLoading(false);
      }
    },
    [isAuthenticated, isAuthLoading, isOwner],
  );

  useEffect(() => {
    if (forceOpenReview) {
      checkEligibility(true);
    } else {
      checkEligibility(false);
    }
  }, [forceOpenReview, checkEligibility]);

  const handleDismissPrompt = () => {
    setStage('NONE');
  };

  const handleOpenReview = () => {
    setStage('REVIEW');
  };

  const handleCloseReview = () => {
    setStage('NONE');
    onCloseReview?.();
  };

  const toggleSelectOrder = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!cleanupData) return;
    if (selectedIds.size === cleanupData.eligibleOrders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(cleanupData.eligibleOrders.map((o) => o.id)));
    }
  };

  const handleConfirmArchive = () => {
    if (selectedIds.size === 0) {
      Alert.alert('No Orders Selected', 'Please select at least one order to archive.');
      return;
    }

    const count = selectedIds.size;
    Alert.alert(
      `Archive ${count} long-overdue order${count > 1 ? 's' : ''}?`,
      'These orders will be removed from active order views but retained for authorized historical review. Associated financial and audit records will be preserved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive Orders',
          style: 'destructive',
          onPress: async () => {
            try {
              setArchiving(true);
              const orderIdsArray = Array.from(selectedIds);
              const res = await apiClient.orders.archiveOverdueOrders({
                orderIds: orderIdsArray,
                reason: '90-day uncollected inventory cleanup by owner',
              });

              Alert.alert(
                'Orders Archived',
                res.message || `Successfully archived ${count} order(s).`,
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      setStage('NONE');
                      onCleanupCompleted?.(count);
                      onCloseReview?.();
                    },
                  },
                ],
              );
            } catch (err: any) {
              Alert.alert(
                'Archival Error',
                err?.message || 'Could not archive selected orders. Please try again.',
              );
            } finally {
              setArchiving(false);
            }
          },
        },
      ],
    );
  };

  const totalOutstandingSelected = useMemo(() => {
    if (!cleanupData) return 0;
    return cleanupData.eligibleOrders
      .filter((o) => selectedIds.has(o.id))
      .reduce((sum, o) => sum + (o.amountDue || 0), 0);
  }, [cleanupData, selectedIds]);

  const renderOrderItem = ({ item }: { item: OverdueCleanupOrderDTO }) => {
    const isSelected = selectedIds.has(item.id);
    const dueDate = new Date(item.effectiveDueDate).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const orderDate = new Date(item.orderDate).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    return (
      <TouchableOpacity
        style={[
          styles.orderCard,
          {
            backgroundColor: isDark ? colors.surfaceSecondary : '#FFFFFF',
            borderColor: isSelected ? colors.primary : colors.border,
            borderWidth: isSelected ? 1.5 : 1,
          },
        ]}
        onPress={() => toggleSelectOrder(item.id)}
        activeOpacity={0.8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isSelected }}
      >
        <View style={styles.cardHeader}>
          <TouchableOpacity
            style={styles.checkboxTouch}
            onPress={() => toggleSelectOrder(item.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon
              name={isSelected ? 'checkbox' : 'square-outline'}
              size={24}
              color={isSelected ? colors.primary : colors.textMuted}
            />
          </TouchableOpacity>

          <View style={{ flex: 1, marginLeft: 8 }}>
            <View style={styles.rowBetween}>
              <Text style={[styles.orderNumber, { color: colors.textPrimary }]}>
                {item.orderNumber}
              </Text>
              <View style={[styles.daysOverdueBadge, { backgroundColor: '#fee2e2' }]}>
                <Icon name="warning" size={13} color="#b91c1c" />
                <Text style={styles.daysOverdueText}>{item.daysOverdue}d overdue</Text>
              </View>
            </View>

            <Text style={[styles.customerName, { color: colors.textPrimary }]} numberOfLines={1}>
              {item.customerName || 'Unknown Customer'}
            </Text>
            {item.customerPhone ? (
              <Text style={[styles.customerPhone, { color: colors.textSecondary }]}>
                {item.customerPhone}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Order Details & Financials */}
        <View style={[styles.cardDivider, { backgroundColor: colors.border }]} />

        <View style={styles.rowBetween}>
          <View>
            <Text style={[styles.metaLabel, { color: colors.textMuted }]}>Due Date</Text>
            <Text style={[styles.metaValue, { color: colors.textSecondary }]}>{dueDate}</Text>
          </View>

          <View style={{ alignItems: 'center' }}>
            <Text style={[styles.metaLabel, { color: colors.textMuted }]}>Status</Text>
            <Text
              style={[
                styles.metaValue,
                { color: item.status === OrderStatus.READY ? '#0284c7' : '#b45309' },
              ]}
            >
              {item.status}
            </Text>
          </View>

          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.metaLabel, { color: colors.textMuted }]}>Balance Due</Text>
            <Text
              style={[styles.amountDueText, { color: item.amountDue > 0 ? '#dc2626' : '#16a34a' }]}
            >
              ₹{item.amountDue.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Association Chips */}
        <View style={styles.chipsRow}>
          {item.hasPayments ? (
            <View style={[styles.chip, { backgroundColor: isDark ? '#1e293b' : '#f0fdf4' }]}>
              <Icon name="cash-outline" size={12} color="#15803d" />
              <Text style={[styles.chipText, { color: '#15803d' }]}>
                Paid ₹{item.amountPaid.toFixed(0)} ({item.paymentCount})
              </Text>
            </View>
          ) : (
            <View style={[styles.chip, { backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]}>
              <Icon name="cash-outline" size={12} color={colors.textMuted} />
              <Text style={[styles.chipText, { color: colors.textMuted }]}>Unpaid</Text>
            </View>
          )}

          {item.hasPhotos ? (
            <View style={[styles.chip, { backgroundColor: isDark ? '#1e293b' : '#eff6ff' }]}>
              <Icon name="camera-outline" size={12} color="#2563eb" />
              <Text style={[styles.chipText, { color: '#2563eb' }]}>
                {item.photoCount} photo{item.photoCount > 1 ? 's' : ''}
              </Text>
            </View>
          ) : null}

          {item.itemsSummary ? (
            <View
              style={[styles.chip, { backgroundColor: isDark ? '#1e293b' : '#f8fafc', flex: 1 }]}
            >
              <Icon name="shirt-outline" size={12} color={colors.textSecondary} />
              <Text
                style={[styles.chipText, { color: colors.textSecondary }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {item.itemsSummary}
              </Text>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  // If user is not OWNER, do not render cleanup UI
  if (!isOwner) {
    return null;
  }

  return (
    <>
      {/* ─── STAGE 1: One-time Startup Prompt Modal ────────────────────── */}
      <Modal
        visible={stage === 'PROMPT'}
        transparent
        animationType="fade"
        onRequestClose={handleDismissPrompt}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.promptBox,
              { backgroundColor: isDark ? colors.surface : '#FFFFFF', borderColor: colors.border },
            ]}
          >
            <View style={styles.promptIconCircle}>
              <Icon name="time-outline" size={32} color="#dc2626" />
            </View>

            <Text style={[styles.promptTitle, { color: colors.textPrimary }]}>
              Long-Overdue Orders
            </Text>

            <Text style={[styles.promptMessage, { color: colors.textSecondary }]}>
              You have{' '}
              <Text style={{ fontWeight: '700', color: '#dc2626' }}>
                {cleanupData?.totalEligibleCount || 0} order
                {(cleanupData?.totalEligibleCount || 0) > 1 ? 's' : ''}
              </Text>{' '}
              that have remained uncollected for more than 90 days after their due date. Review
              these orders before archiving them.
            </Text>

            <View style={styles.promptActions}>
              <TouchableOpacity
                style={[
                  styles.promptSecondaryBtn,
                  {
                    borderColor: colors.border,
                    backgroundColor: isDark ? colors.surfaceSecondary : '#f8fafc',
                  },
                ]}
                onPress={handleDismissPrompt}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Remind Me Later"
              >
                <Text style={[styles.promptSecondaryBtnText, { color: colors.textSecondary }]}>
                  Remind Me Later
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.promptPrimaryBtn, { backgroundColor: colors.primary }]}
                onPress={handleOpenReview}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Review Orders"
              >
                <Text style={styles.promptPrimaryBtnText}>Review Orders</Text>
                <Icon name="arrow-forward" size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── STAGE 2: Full Review & Cleanup Screen Modal ──────────────── */}
      <Modal
        visible={stage === 'REVIEW'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseReview}
      >
        <View
          style={[
            styles.reviewContainer,
            { backgroundColor: colors.background, paddingTop: Math.max(insets.top, 16) },
          ]}
        >
          {/* Header */}
          <View style={[styles.reviewHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={handleCloseReview}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Close Review Screen"
            >
              <Icon name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>

            <View style={{ flex: 1, marginHorizontal: 12 }}>
              <Text style={[styles.reviewTitle, { color: colors.textPrimary }]}>
                90-Day Overdue Cleanup
              </Text>
              <Text style={[styles.reviewSubtitle, { color: colors.textSecondary }]}>
                Owner Archival Workflow
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.selectAllBtn,
                { backgroundColor: isDark ? colors.surfaceSecondary : '#f1f5f9' },
              ]}
              onPress={toggleSelectAll}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Select All Orders"
            >
              <Text style={[styles.selectAllBtnText, { color: colors.primary }]}>
                {cleanupData && selectedIds.size === cleanupData.eligibleOrders.length
                  ? 'Deselect All'
                  : 'Select All'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Overview Info Banner */}
          <View
            style={[
              styles.infoBanner,
              { backgroundColor: isDark ? '#451a03' : '#fef3c7', borderColor: '#fde68a' },
            ]}
          >
            <Icon name="information-circle-outline" size={20} color="#b45309" />
            <Text style={[styles.infoBannerText, { color: '#92400e' }]}>
              Selected orders will be archived from active lists but preserved in audit and payment
              history for historical inspection.
            </Text>
          </View>

          {/* Orders List */}
          {loading ? (
            <View style={styles.centeredContent}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                Loading long-overdue orders...
              </Text>
            </View>
          ) : cleanupData && cleanupData.eligibleOrders.length > 0 ? (
            <FlatList
              data={cleanupData.eligibleOrders}
              keyExtractor={(item) => item.id}
              renderItem={renderOrderItem}
              contentContainerStyle={[styles.listContent, { paddingBottom: 120 }]}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <View style={styles.centeredContent}>
              <Icon name="checkmark-circle-outline" size={48} color="#16a34a" />
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                No Eligible Orders
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                All customer orders are current or have been resolved within the 90-day window.
              </Text>
            </View>
          )}

          {/* Bottom Sticky Action Footer */}
          <View
            style={[
              styles.reviewFooter,
              {
                backgroundColor: colors.surface,
                borderTopColor: colors.border,
                paddingBottom: Math.max(insets.bottom, 16),
              },
            ]}
          >
            <View style={styles.footerSummary}>
              <Text style={[styles.footerSummaryText, { color: colors.textSecondary }]}>
                Selected:{' '}
                <Text style={{ fontWeight: '700', color: colors.textPrimary }}>
                  {selectedIds.size} of {cleanupData?.totalEligibleCount || 0}
                </Text>
              </Text>
              <Text style={[styles.footerSummaryText, { color: colors.textSecondary }]}>
                Outstanding:{' '}
                <Text style={{ fontWeight: '700', color: '#dc2626' }}>
                  ₹{totalOutstandingSelected.toFixed(2)}
                </Text>
              </Text>
            </View>

            <View style={styles.footerButtonsRow}>
              <TouchableOpacity
                style={[
                  styles.footerSecondaryBtn,
                  {
                    borderColor: colors.border,
                    backgroundColor: isDark ? colors.surfaceSecondary : '#f8fafc',
                  },
                ]}
                onPress={handleCloseReview}
                activeOpacity={0.8}
                disabled={archiving}
              >
                <Text style={[styles.footerSecondaryBtnText, { color: colors.textSecondary }]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.footerPrimaryBtn,
                  {
                    backgroundColor: selectedIds.size > 0 ? '#dc2626' : colors.textMuted,
                    opacity: selectedIds.size > 0 && !archiving ? 1 : 0.6,
                  },
                ]}
                onPress={handleConfirmArchive}
                disabled={selectedIds.size === 0 || archiving}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Archive Selected Orders"
              >
                {archiving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Icon
                      name="archive-outline"
                      size={18}
                      color="#FFFFFF"
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.footerPrimaryBtnText}>
                      Archive Selected ({selectedIds.size})
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  promptBox: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  promptIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fee2e2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  promptTitle: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  promptMessage: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 24,
  },
  promptActions: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  promptSecondaryBtn: {
    flex: 1,
    height: 48,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  promptSecondaryBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  promptPrimaryBtn: {
    flex: 1,
    height: 48,
    minHeight: 44,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  promptPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  reviewContainer: {
    flex: 1,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  closeBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  reviewSubtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  selectAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  selectAllBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  orderCard: {
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkboxTouch: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderNumber: {
    fontSize: 15,
    fontWeight: '800',
  },
  daysOverdueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  daysOverdueText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#b91c1c',
  },
  customerName: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  customerPhone: {
    fontSize: 12,
    marginTop: 1,
  },
  cardDivider: {
    height: 1,
    marginVertical: 10,
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  metaValue: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  amountDueText: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    fontSize: 14,
    marginTop: 12,
    fontWeight: '500',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19,
  },
  reviewFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 8,
  },
  footerSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  footerSummaryText: {
    fontSize: 13,
    fontWeight: '500',
  },
  footerButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  footerSecondaryBtn: {
    flex: 1,
    height: 48,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerSecondaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  footerPrimaryBtn: {
    flex: 2,
    height: 48,
    minHeight: 44,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
