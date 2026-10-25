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
} from 'react-native';
import { OrderDetailDTO } from '@growfast/shared-types';
import { apiClient } from '../api/client';

interface MarkAsDeliveredModalProps {
  visible: boolean;
  order: OrderDetailDTO | null;
  onClose: () => void;
  onDeliveredSuccess: () => void;
}

export function MarkAsDeliveredModal({
  visible,
  order,
  onClose,
  onDeliveredSuccess,
}: MarkAsDeliveredModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!order) return null;

  const todayStr = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const handleConfirmDelivered = async () => {
    // If order has balance due, alert user
    if (order.amountDue > 0) {
      Alert.alert(
        'Outstanding Balance Due',
        `This order has an unpaid balance of ₹${order.amountDue.toFixed(2)}. Do you want to record handover with payment marked pending, or collect payment first?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Deliver Anyway',
            style: 'destructive',
            onPress: () => submitDelivery(),
          },
        ],
      );
      return;
    }

    await submitDelivery();
  };

  const submitDelivery = async () => {
    setIsSubmitting(true);
    try {
      // 1. If physical garments exist, deliver all items
      await apiClient.orders.recordPickup(order.id, {
        notes: 'Delivered via mobile app',
      });
      Alert.alert('Success', `Order #${order.orderNumber} successfully marked as Delivered!`);
      onDeliveredSuccess();
      onClose();
    } catch (err: any) {
      Alert.alert('Delivery Error', err.message || 'Could not update order status to DELIVERED.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const orderNumDisplay = order.orderNumber.startsWith('#')
    ? order.orderNumber
    : `#${order.orderNumber}`;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Top Header matching Screen 12 */}
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.backArrow}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Mark as Delivered</Text>
            <View style={{ width: 32 }} />
          </View>

          {/* Subheader with Order Number & Customer Name */}
          <View style={styles.orderRefRow}>
            <Text style={styles.orderRefNum}>{orderNumDisplay}</Text>
            <Text style={styles.orderRefCustomer}>{order.customerName}</Text>
          </View>

          {/* Center Illustration & Content matching Screen 12 */}
          <View style={styles.centerContent}>
            {/* Big Green Checkmark Icon */}
            <View style={styles.greenCheckCircle}>
              <Text style={styles.checkMarkEmoji}>✓</Text>
            </View>

            <Text style={styles.confirmHeading}>Mark as Delivered?</Text>
            <Text style={styles.confirmSubtext}>
              This will update the order status and notify the customer (if enabled).
            </Text>

            {/* Delivery Date Field matching Screen 12 */}
            <View style={styles.dateSelectorBox}>
              <Text style={styles.dateLabel}>Delivery Date</Text>
              <View style={styles.datePickerTrigger}>
                <Text style={styles.dateEmoji}>📅</Text>
                <Text style={styles.dateValue}>{todayStr}</Text>
                <Text style={styles.dropdownChevron}>⌄</Text>
              </View>
            </View>
          </View>

          {/* Bottom Action matching Screen 12 */}
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={[styles.confirmButton, isSubmitting && styles.buttonDisabled]}
              onPress={handleConfirmDelivered}
              disabled={isSubmitting}
              activeOpacity={0.8}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.confirmButtonText}>Confirm Delivered</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
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
    backgroundColor: '#ffffff',
    justifyContent: 'space-between',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backArrow: {
    fontSize: 32,
    color: '#0f172a',
    fontWeight: '300',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  orderRefRow: {
    alignItems: 'center',
    paddingTop: 16,
  },
  orderRefNum: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  orderRefCustomer: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  centerContent: {
    alignItems: 'center',
    paddingHorizontal: 32,
    marginTop: -20,
  },
  greenCheckCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10b981',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 24,
  },
  checkMarkEmoji: {
    fontSize: 48,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  confirmHeading: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
    textAlign: 'center',
  },
  confirmSubtext: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  dateSelectorBox: {
    width: '100%',
  },
  dateLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  datePickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 16,
  },
  dateEmoji: {
    fontSize: 18,
    marginRight: 10,
  },
  dateValue: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  dropdownChevron: {
    fontSize: 18,
    color: '#94a3b8',
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  confirmButton: {
    height: 52,
    borderRadius: 26,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563eb',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    backgroundColor: '#93c5fd',
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
