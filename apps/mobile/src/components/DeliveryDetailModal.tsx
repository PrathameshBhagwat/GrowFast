import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  Image,
  Linking,
  TextInput,
} from 'react-native';
import { DeliveryRecordDTO, DeliveryStatus, Role } from '@growfast/shared-types';
import { apiClient } from '../api/client';
import { DeliveryCompletionModal } from './DeliveryCompletionModal';

interface DeliveryDetailModalProps {
  visible: boolean;
  delivery: DeliveryRecordDTO | null;
  userRole?: string;
  currentUserId?: string;
  onClose: () => void;
  onDeliveryUpdated: () => void;
  onAssignDriverRequested?: (delivery: DeliveryRecordDTO) => void;
}

export function DeliveryDetailModal({
  visible,
  delivery,
  userRole,
  currentUserId,
  onClose,
  onDeliveryUpdated,
  onAssignDriverRequested,
}: DeliveryDetailModalProps) {
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [completionModalVisible, setCompletionModalVisible] = useState(false);

  // Failure modal state
  const [failurePromptVisible, setFailurePromptVisible] = useState(false);
  const [failureNotes, setFailureNotes] = useState('');

  if (!delivery) return null;

  const isOwnerOrManager = userRole === Role.OWNER || userRole === Role.MANAGER;
  const isAssignedRider = delivery.riderId === currentUserId;
  const canOperateDelivery = isOwnerOrManager || isAssignedRider;

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
        return { label: 'Failed Handover', bg: '#fee2e2', text: '#b91c1c' };
      default:
        return { label: status, bg: '#f1f5f9', text: '#475569' };
    }
  };

  const statusBadge = getStatusBadgeStyle(delivery.status);

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'Not Scheduled';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  // Start Delivery Handover (ASSIGNED -> IN_TRANSIT)
  const handleStartDelivery = async () => {
    if (isUpdatingStatus) return;
    setIsUpdatingStatus(true);
    try {
      await apiClient.deliveries.updateStatus(
        delivery.id,
        DeliveryStatus.IN_TRANSIT,
        'Out for delivery',
      );
      Alert.alert('Out for Delivery', `Order #${delivery.orderNumber} is now in transit.`);
      onDeliveryUpdated();
      onClose();
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || 'Could not update delivery status.';
      Alert.alert('Status Error', Array.isArray(msg) ? msg.join('\n') : msg);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Mark Delivery as Failed
  const handleConfirmFailed = async () => {
    if (!failureNotes.trim()) {
      Alert.alert(
        'Reason Required',
        'Please enter a brief note explaining why delivery could not be completed.',
      );
      return;
    }

    setIsUpdatingStatus(true);
    try {
      await apiClient.deliveries.updateStatus(
        delivery.id,
        DeliveryStatus.FAILED,
        failureNotes.trim(),
      );
      Alert.alert(
        'Delivery Marked Failed',
        `Order #${delivery.orderNumber} delivery marked as failed.`,
      );
      setFailurePromptVisible(false);
      setFailureNotes('');
      onDeliveryUpdated();
      onClose();
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || 'Could not update status to FAILED.';
      Alert.alert('Error', Array.isArray(msg) ? msg.join('\n') : msg);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Reschedule Delivery (FAILED -> SCHEDULED)
  const handleReschedule = async () => {
    if (isUpdatingStatus) return;
    setIsUpdatingStatus(true);
    try {
      await apiClient.deliveries.updateStatus(
        delivery.id,
        DeliveryStatus.SCHEDULED,
        'Rescheduled for delivery',
      );
      Alert.alert('Rescheduled', `Order #${delivery.orderNumber} is returned to SCHEDULED status.`);
      onDeliveryUpdated();
      onClose();
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || 'Could not reschedule delivery.';
      Alert.alert('Reschedule Error', Array.isArray(msg) ? msg.join('\n') : msg);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleCallCustomer = () => {
    const customer = (delivery as any).order?.customer;
    const phone = customer?.phone || customer?.mobile;
    if (phone) {
      Linking.openURL(`tel:${phone}`).catch(() => {
        Alert.alert('Phone Dial Error', `Cannot dial telephone number: ${phone}`);
      });
    } else {
      Alert.alert('No Phone', 'No contact number available for this customer.');
    }
  };

  const orderNumDisplay = delivery.orderNumber.startsWith('#')
    ? delivery.orderNumber
    : `#${delivery.orderNumber}`;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel="Close Delivery Details"
            >
              <Text style={styles.backArrow}>‹</Text>
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={styles.headerTitle}>Delivery Details</Text>
              <Text style={styles.headerSubtitle}>{orderNumDisplay}</Text>
            </View>
            <View style={{ width: 44 }} />
          </View>

          <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
            {/* Status and Order Card */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={styles.orderNumberText}>{orderNumDisplay}</Text>
                  <Text style={styles.customerNameText}>{delivery.customerName}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusBadge.bg }]}>
                  <Text style={[styles.statusBadgeText, { color: statusBadge.text }]}>
                    {statusBadge.label}
                  </Text>
                </View>
              </View>

              <TouchableOpacity style={styles.callRow} onPress={handleCallCustomer}>
                <Text style={styles.callIcon}>📞</Text>
                <Text style={styles.callText}>Call Customer</Text>
              </TouchableOpacity>
            </View>

            {/* Destination & Rider Card */}
            <View style={styles.card}>
              <Text style={styles.sectionHeaderTitle}>📍 Delivery Destination</Text>
              <Text style={styles.addressText}>{delivery.address}</Text>

              <View style={styles.divider} />

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Scheduled Date:</Text>
                <Text style={styles.infoValue}>{formatDate(delivery.scheduledAt)}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Assigned Driver:</Text>
                <Text style={[styles.infoValue, !delivery.riderName && { color: '#94a3b8' }]}>
                  {delivery.riderName || 'Unassigned'}
                </Text>
              </View>

              {delivery.completedAt ? (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Delivered At:</Text>
                  <Text style={styles.infoValue}>{formatDate(delivery.completedAt)}</Text>
                </View>
              ) : null}
            </View>

            {/* Proof Photo Display if completed */}
            {delivery.proofPhotoUrl ? (
              <View style={styles.card}>
                <Text style={styles.sectionHeaderTitle}>📷 Delivery Proof Photo</Text>
                <Image source={{ uri: delivery.proofPhotoUrl }} style={styles.proofImage} />
              </View>
            ) : null}

            {/* Handover Notes if present */}
            {delivery.notes ? (
              <View style={styles.card}>
                <Text style={styles.sectionHeaderTitle}>📝 Notes</Text>
                <Text style={styles.notesText}>{delivery.notes}</Text>
              </View>
            ) : null}

            {/* Garment Items list */}
            {delivery.items && delivery.items.length > 0 ? (
              <View style={styles.card}>
                <Text style={styles.sectionHeaderTitle}>👔 Garments Included</Text>
                {delivery.items.map((item) => (
                  <View key={item.id} style={styles.itemRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName}>{item.garmentName}</Text>
                      <Text style={styles.itemService}>{item.serviceType}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.itemQtyText}>
                        {item.deliveredQuantity || 0} / {item.quantity} Delivered
                      </Text>
                      <Text style={styles.itemStatusChip}>{item.itemStatus}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </ScrollView>

          {/* Action Buttons based on Status & Role */}
          <View style={styles.bottomBar}>
            {delivery.status === DeliveryStatus.SCHEDULED && isOwnerOrManager ? (
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => onAssignDriverRequested?.(delivery)}
                disabled={isUpdatingStatus}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Assign Driver"
              >
                <Text style={styles.primaryBtnText}>👤 Assign Delivery Rider</Text>
              </TouchableOpacity>
            ) : null}

            {delivery.status === DeliveryStatus.ASSIGNED && canOperateDelivery ? (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  style={[styles.primaryBtn, { flex: 2 }]}
                  onPress={handleStartDelivery}
                  disabled={isUpdatingStatus}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Start Delivery"
                >
                  {isUpdatingStatus ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.primaryBtnText}>🚚 Start Delivery</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.secondaryBtn, { flex: 1 }]}
                  onPress={() => setFailurePromptVisible(true)}
                  disabled={isUpdatingStatus}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Mark Delivery Failed"
                >
                  <Text style={styles.secondaryBtnText}>Mark Failed</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {delivery.status === DeliveryStatus.IN_TRANSIT && canOperateDelivery ? (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  style={[styles.primaryBtn, { flex: 2, backgroundColor: '#16a34a' }]}
                  onPress={() => setCompletionModalVisible(true)}
                  disabled={isUpdatingStatus}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Complete Delivery"
                >
                  <Text style={styles.primaryBtnText}>✓ Complete Delivery</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.secondaryBtn, { flex: 1 }]}
                  onPress={() => setFailurePromptVisible(true)}
                  disabled={isUpdatingStatus}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Mark Delivery Failed"
                >
                  <Text style={styles.secondaryBtnText}>Mark Failed</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {delivery.status === DeliveryStatus.FAILED && isOwnerOrManager ? (
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleReschedule}
                disabled={isUpdatingStatus}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Reschedule Delivery"
              >
                {isUpdatingStatus ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.primaryBtnText}>↻ Reschedule Delivery</Text>
                )}
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Delivery Completion Sub-Modal */}
        <DeliveryCompletionModal
          visible={completionModalVisible}
          delivery={delivery}
          userRole={userRole}
          onClose={() => setCompletionModalVisible(false)}
          onDeliveryCompleted={() => {
            setCompletionModalVisible(false);
            onDeliveryUpdated();
            onClose();
          }}
        />

        {/* Failure Reason Prompt Modal */}
        <Modal
          visible={failurePromptVisible}
          animationType="fade"
          transparent
          onRequestClose={() => setFailurePromptVisible(false)}
        >
          <View style={styles.promptOverlay}>
            <View style={styles.promptCard}>
              <Text style={styles.promptTitle}>Report Delivery Failure</Text>
              <Text style={styles.promptSub}>
                Explain why the delivery for #{delivery.orderNumber} could not be completed:
              </Text>
              <TextInput
                style={styles.promptInput}
                placeholder="e.g. Customer unreachable, Incorrect address, Premises closed"
                placeholderTextColor="#94a3b8"
                value={failureNotes}
                onChangeText={setFailureNotes}
                multiline
                numberOfLines={3}
              />
              <View style={styles.promptActionsRow}>
                <TouchableOpacity
                  style={styles.promptCancelBtn}
                  onPress={() => setFailurePromptVisible(false)}
                >
                  <Text style={styles.promptCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.promptSubmitBtn}
                  onPress={handleConfirmFailed}
                  disabled={isUpdatingStatus}
                >
                  {isUpdatingStatus ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={styles.promptSubmitText}>Submit Failure</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </Modal>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  backButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 32,
    color: '#0f172a',
    lineHeight: 34,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 36,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  orderNumberText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  customerNameText: {
    fontSize: 14,
    color: '#334155',
    marginTop: 2,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  callRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    backgroundColor: '#eff6ff',
    padding: 10,
    borderRadius: 8,
    minHeight: 44,
  },
  callIcon: {
    fontSize: 16,
  },
  callText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563eb',
  },
  sectionHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
  },
  addressText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 10,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  infoValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0f172a',
  },
  proofImage: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  notesText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  itemName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  itemService: {
    fontSize: 11,
    color: '#64748b',
  },
  itemQtyText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b',
  },
  itemStatusChip: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  bottomBar: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  primaryBtn: {
    minHeight: 48,
    backgroundColor: '#2563eb',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryBtn: {
    minHeight: 48,
    backgroundColor: '#fee2e2',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  secondaryBtnText: {
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '700',
  },
  promptOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  promptCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
  },
  promptTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  promptSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    marginBottom: 12,
  },
  promptInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
    minHeight: 64,
    textAlignVertical: 'top',
  },
  promptActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 14,
  },
  promptCancelBtn: {
    minHeight: 44,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptCancelText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  promptSubmitBtn: {
    minHeight: 44,
    paddingHorizontal: 16,
    backgroundColor: '#dc2626',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptSubmitText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
