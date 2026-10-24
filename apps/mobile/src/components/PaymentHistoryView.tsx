import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { PaymentDTO, PaymentMode } from '@growfast/shared-types';

interface PaymentHistoryViewProps {
  payments: PaymentDTO[];
  totalAmount: number;
  amountPaid: number;
  amountDue: number;
  isLoading?: boolean;
}

export function PaymentHistoryView({
  payments,
  totalAmount,
  amountPaid,
  amountDue,
  isLoading,
}: PaymentHistoryViewProps) {
  const formatDateTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return `${d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })}, ${d.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    } catch {
      return isoString;
    }
  };

  const getModeBadgeStyle = (mode: PaymentMode) => {
    switch (mode) {
      case PaymentMode.CASH:
        return { bg: '#dcfce7', text: '#15803d' };
      case PaymentMode.UPI:
        return { bg: '#e0e7ff', text: '#4338ca' };
      case PaymentMode.CARD:
        return { bg: '#fef3c7', text: '#b45309' };
      case PaymentMode.ONLINE:
        return { bg: '#dbeafe', text: '#1d4ed8' };
      case PaymentMode.STORE_CREDIT:
        return { bg: '#f3e8ff', text: '#7e22ce' };
      default:
        return { bg: '#f1f5f9', text: '#475569' };
    }
  };

  return (
    <View style={styles.container}>
      {/* Financial Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryCol}>
          <Text style={styles.summaryLabel}>Total Bill</Text>
          <Text style={styles.summaryTotal}>₹{totalAmount.toFixed(2)}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryCol}>
          <Text style={styles.summaryLabel}>Collected</Text>
          <Text style={styles.summaryPaid}>₹{amountPaid.toFixed(2)}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryCol}>
          <Text style={styles.summaryLabel}>Balance Due</Text>
          <Text style={[styles.summaryDue, amountDue > 0 ? styles.duePositive : styles.dueSettled]}>
            ₹{amountDue.toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Payment History List Header */}
      <View style={styles.historyHeader}>
        <Text style={styles.historyTitle}>Payment History ({payments.length})</Text>
        <Text style={styles.historySubtitle}>Authoritative Ledger</Text>
      </View>

      {payments.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No payments recorded yet for this order.</Text>
          <Text style={styles.emptySubtext}>
            Tap &quot;Collect Payment&quot; below to record an advance or full settlement.
          </Text>
        </View>
      ) : (
        <View style={styles.listContainer}>
          {payments.map((item) => {
            const badge = getModeBadgeStyle(item.mode);
            return (
              <View key={item.id} style={styles.paymentRow}>
                <View style={styles.rowLeft}>
                  <View style={styles.modeAndAmount}>
                    <View style={[styles.modeBadge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.modeBadgeText, { color: badge.text }]}>{item.mode}</Text>
                    </View>
                    <Text style={styles.amountText}>₹{item.amount.toFixed(2)}</Text>
                  </View>
                  <Text style={styles.dateText}>{formatDateTime(item.createdAt)}</Text>
                  {item.reference ? (
                    <Text style={styles.referenceText}>Ref: {item.reference}</Text>
                  ) : null}
                </View>

                <View style={styles.rowRight}>
                  <Text style={styles.staffLabel}>Received by</Text>
                  <Text style={styles.staffName}>{item.receivedByName || 'Staff'}</Text>
                  {item.idempotencyKey ? (
                    <Text style={styles.idempKeyText} numberOfLines={1}>
                      🔒 Verified Key
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  summaryCol: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#e2e8f0',
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  summaryTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  summaryPaid: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#16a34a',
  },
  summaryDue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  duePositive: {
    color: '#dc2626',
  },
  dueSettled: {
    color: '#16a34a',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  historyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  historySubtitle: {
    fontSize: 11,
    color: '#64748b',
  },
  emptyContainer: {
    padding: 20,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 4,
  },
  listContainer: {
    gap: 8,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  rowLeft: {
    flex: 1,
  },
  modeAndAmount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  modeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  modeBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  amountText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  dateText: {
    fontSize: 11,
    color: '#64748b',
  },
  referenceText: {
    fontSize: 11,
    color: '#94a3b8',
    fontStyle: 'italic',
    marginTop: 2,
  },
  rowRight: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  staffLabel: {
    fontSize: 10,
    color: '#94a3b8',
  },
  staffName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  idempKeyText: {
    fontSize: 10,
    color: '#16a34a',
    marginTop: 2,
  },
});
