import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { PaymentMode, PaymentDTO } from '@growfast/shared-types';
import {
  executePaymentWithIdempotency,
  generatePaymentIdempotencyKey,
  validatePaymentInput,
} from '../services/payment-manager';

interface PaymentCollectionModalProps {
  visible: boolean;
  orderId: string;
  orderNumber: string;
  customerName?: string;
  amountDue: number;
  totalAmount: number;
  onClose: () => void;
  onPaymentSuccess: (payment: PaymentDTO) => void;
}

const SUPPORTED_MODES = [
  { mode: PaymentMode.CASH, label: '💵 Cash' },
  { mode: PaymentMode.UPI, label: '📱 UPI' },
  { mode: PaymentMode.CARD, label: '💳 Card' },
  { mode: PaymentMode.ONLINE, label: '🌐 Online' },
  { mode: PaymentMode.STORE_CREDIT, label: '🎟️ Store Credit' },
];

export function PaymentCollectionModal({
  visible,
  orderId,
  orderNumber,
  customerName,
  amountDue,
  totalAmount,
  onClose,
  onPaymentSuccess,
}: PaymentCollectionModalProps) {
  const [amount, setAmount] = useState<string>('');
  const [mode, setMode] = useState<PaymentMode>(PaymentMode.CASH);
  const [reference, setReference] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Stable idempotency key for this payment session/attempt
  const [idempotencyKey, setIdempotencyKey] = useState<string>('');
  const [isRetryableFailure, setIsRetryableFailure] = useState<boolean>(false);

  // Reset / initialize state whenever modal opens or order changes
  useEffect(() => {
    if (visible && orderId) {
      setAmount(amountDue > 0 ? amountDue.toFixed(2) : '0.00');
      setMode(PaymentMode.CASH);
      setReference('');
      setErrorMessage(null);
      setIsRetryableFailure(false);
      setIdempotencyKey(generatePaymentIdempotencyKey(orderId));
    }
  }, [visible, orderId, amountDue]);

  const handleApplyPreset = (presetAmount: number) => {
    const safe = Math.max(0, Math.min(amountDue, presetAmount));
    setAmount(safe.toFixed(2));
    setErrorMessage(null);
  };

  const handleSubmit = async () => {
    setErrorMessage(null);

    // 1. Client-side usability validation
    const validation = validatePaymentInput(amount, amountDue);
    if (!validation.isValid) {
      setErrorMessage(validation.error || 'Invalid amount.');
      return;
    }

    const finalAmount = validation.sanitizedAmount!;

    setIsSubmitting(true);

    try {
      // Execute payment reusing existing idempotencyKey if this is a retry
      const result = await executePaymentWithIdempotency({
        orderId,
        amount: finalAmount,
        mode,
        reference: reference.trim() || undefined,
        idempotencyKey, // Reused safely across retries of the same attempt
      });

      if (result.success && result.payment) {
        setIsSubmitting(false);
        Alert.alert(
          'Payment Recorded',
          `Successfully recorded ₹${result.payment.amount.toFixed(2)} via ${result.payment.mode} for Order #${orderNumber}!`,
        );
        onPaymentSuccess(result.payment);
        onClose();
        return;
      }

      setIsSubmitting(false);

      if (result.isRetryable) {
        setIsRetryableFailure(true);
        setErrorMessage(
          `${result.error}\n(Transaction key preserved. Tap "Retry Payment" to safely resubmit).`,
        );
      } else if (result.isConflict) {
        setErrorMessage(result.error || 'Idempotency conflict. Transaction was rejected.');
      } else if (result.isUnauthorized) {
        setErrorMessage(result.error || 'Authentication expired. Please log in again.');
      } else {
        setErrorMessage(result.error || 'Payment recording failed.');
      }
    } catch (err: any) {
      setIsSubmitting(false);
      setIsRetryableFailure(true);
      setErrorMessage(
        err.message ||
          'Unexpected network error occurred. Safe idempotency key preserved for retry.',
      );
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Collect Payment</Text>
              <Text style={styles.headerSubtitle}>
                Order #{orderNumber} • {customerName || 'Customer'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              disabled={isSubmitting}
              style={styles.closeButton}
              accessible={true}
              accessibilityLabel="Close payment modal"
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* Balance Due Alert Banner */}
            <View style={styles.balanceCard}>
              <View>
                <Text style={styles.balanceCardLabel}>Authoritative Balance Due</Text>
                <Text style={styles.balanceCardAmount}>₹{amountDue.toFixed(2)}</Text>
              </View>
              <View style={styles.totalPill}>
                <Text style={styles.totalPillText}>Total: ₹{totalAmount.toFixed(2)}</Text>
              </View>
            </View>

            {/* Error / Conflict Notice */}
            {errorMessage ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* Amount Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Payment Amount (₹) *</Text>
              <TextInput
                style={styles.amountInput}
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={(val) => {
                  setAmount(val);
                  setErrorMessage(null);
                }}
                placeholder="0.00"
                editable={!isSubmitting}
                accessible={true}
                accessibilityLabel="Enter payment amount"
              />

              {/* Quick Preset Buttons */}
              <View style={styles.presetsRow}>
                <TouchableOpacity
                  style={styles.presetButton}
                  onPress={() => handleApplyPreset(amountDue)}
                  disabled={isSubmitting || amountDue <= 0}
                  accessible={true}
                  accessibilityLabel="Pay full balance"
                >
                  <Text style={styles.presetText}>Full (₹{amountDue.toFixed(2)})</Text>
                </TouchableOpacity>

                {amountDue > 100 && (
                  <TouchableOpacity
                    style={styles.presetButton}
                    onPress={() => handleApplyPreset(Math.round(amountDue / 2))}
                    disabled={isSubmitting}
                    accessible={true}
                    accessibilityLabel="Pay half balance"
                  >
                    <Text style={styles.presetText}>50% (₹{Math.round(amountDue / 2)})</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.presetButton, styles.presetClear]}
                  onPress={() => setAmount('')}
                  disabled={isSubmitting}
                >
                  <Text style={styles.presetClearText}>Clear</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Payment Method Selector */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Payment Method *</Text>
              <View style={styles.modesContainer}>
                {SUPPORTED_MODES.map((item) => {
                  const isSelected = mode === item.mode;
                  return (
                    <TouchableOpacity
                      key={item.mode}
                      style={[styles.modeChip, isSelected && styles.modeChipSelected]}
                      onPress={() => setMode(item.mode)}
                      disabled={isSubmitting}
                      accessible={true}
                      accessibilityLabel={`Select ${item.label}`}
                    >
                      <Text
                        style={[styles.modeChipText, isSelected && styles.modeChipTextSelected]}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Optional Reference / Notes Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Reference / Transaction ID (Optional)</Text>
              <TextInput
                style={styles.textInput}
                value={reference}
                onChangeText={setReference}
                placeholder="e.g. UPI Ref Number, Cheque No, or Card Auth Code"
                editable={!isSubmitting}
                accessible={true}
                accessibilityLabel="Enter reference or transaction note"
              />
            </View>

            {/* Idempotency Key Footnote */}
            <View style={styles.idempFooter}>
              <Text style={styles.idempFooterText}>
                🔒 Idempotency Protected • Key: {idempotencyKey.substring(0, 16)}...
              </Text>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.footerActions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              disabled={isSubmitting}
              accessible={true}
              accessibilityLabel="Cancel payment collection"
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.submitButton,
                (isSubmitting || amountDue <= 0) && styles.submitButtonDisabled,
                isRetryableFailure && styles.retryButton,
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting || (amountDue <= 0 && !isRetryableFailure)}
              accessible={true}
              accessibilityLabel="Submit payment"
            >
              {isSubmitting ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {isRetryableFailure
                    ? '🔄 Retry Payment'
                    : `Collect ₹${parseFloat(amount) ? parseFloat(amount).toFixed(2) : '0.00'}`}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  closeButton: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#64748b',
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 18,
  },
  balanceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  balanceCardLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#991b1b',
    textTransform: 'uppercase',
  },
  balanceCardAmount: {
    fontSize: 22,
    fontWeight: '800',
    color: '#dc2626',
    marginTop: 2,
  },
  totalPill: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  totalPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7f1d1d',
  },
  errorBanner: {
    backgroundColor: '#fee2e2',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f87171',
    marginBottom: 16,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 12,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  amountInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
    backgroundColor: '#f8fafc',
    minHeight: 48,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  presetButton: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  presetText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  presetClear: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  presetClearText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  modesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modeChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeChipSelected: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  modeChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  modeChipTextSelected: {
    color: '#ffffff',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
    minHeight: 44,
  },
  idempFooter: {
    paddingVertical: 6,
    alignItems: 'center',
  },
  idempFooterText: {
    fontSize: 11,
    color: '#16a34a',
    fontWeight: '500',
  },
  footerActions: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 14,
  },
  cancelButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  submitButton: {
    flex: 2,
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: '#16a34a',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  retryButton: {
    backgroundColor: '#d97706',
  },
  submitButtonDisabled: {
    backgroundColor: '#94a3b8',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#ffffff',
  },
});
