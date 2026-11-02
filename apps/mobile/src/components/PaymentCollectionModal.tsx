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
import { useTheme } from '../contexts/ThemeContext';

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
  { mode: PaymentMode.CASH, label: 'Cash', icon: '💵' },
  { mode: PaymentMode.UPI, label: 'UPI', icon: '⚡' },
  { mode: PaymentMode.CARD, label: 'Card', icon: '💳' },
  { mode: PaymentMode.ONLINE, label: 'Online', icon: '🌐' },
  { mode: PaymentMode.STORE_CREDIT, label: 'Store Credit', icon: '🏬' },
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
  const { colors, isDark } = useTheme();
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

  const effectivePaid = Math.max(0, totalAmount - amountDue);

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.headerTitleGroup}>
              <View style={[styles.walletIconSquircle, { backgroundColor: colors.primaryBg }]}>
                <Text style={{ fontSize: 20 }}>👛</Text>
              </View>
              <View>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Collect Payment</Text>
                <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                  Order #{orderNumber} • {customerName || 'Customer'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              disabled={isSubmitting}
              style={[styles.closeButton, { backgroundColor: colors.surfaceSecondary }]}
              accessible={true}
              accessibilityLabel="Close payment modal"
            >
              <Text style={[styles.closeButtonText, { color: colors.textSecondary }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* Outstanding Amount Banner matching Screenshot 10 */}
            <View style={[styles.balanceCard, isDark && { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <View style={[styles.balanceIconBox, isDark && { backgroundColor: colors.errorBg }]}>
                <Text style={{ fontSize: 22 }}>👛</Text>
              </View>
              <View style={styles.balanceCenterCol}>
                <Text style={[styles.balanceCardLabel, isDark && { color: colors.error }]}>Outstanding Amount</Text>
                <Text style={[styles.balanceCardAmount, isDark && { color: colors.error }]}>₹{amountDue.toFixed(2)}</Text>
                <Text style={[styles.balanceSubtext, { color: colors.textSecondary }]}>
                  Collect the remaining amount for this order.
                </Text>
              </View>
              <View style={[styles.balanceRightCol, isDark && { borderLeftColor: colors.border }]}>
                <Text style={[styles.balanceSummaryLabel, { color: colors.textSecondary }]}>Total Amount</Text>
                <Text style={[styles.balanceTotalVal, { color: colors.textPrimary }]}>₹{totalAmount.toFixed(2)}</Text>
                <Text style={[styles.balanceSummaryLabel, { color: colors.textSecondary, marginTop: 6 }]}>Amount Paid</Text>
                <Text style={[styles.balancePaidVal, { color: colors.success }]}>₹{effectivePaid.toFixed(2)}</Text>
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
              <View style={styles.inputLabelRow}>
                <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>Payment Amount (₹) *</Text>
                <TouchableOpacity
                  onPress={() => handleApplyPreset(amountDue)}
                  style={styles.fillFullBtn}
                  disabled={isSubmitting}
                >
                  <Text style={{ fontSize: 13, marginRight: 4 }}>📋</Text>
                  <Text style={[styles.fillFullBtnText, { color: colors.primary }]}>Fill Full Amount</Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.amountInputContainer, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
                <Text style={[styles.currencyPrefix, { color: colors.textSecondary }]}>₹</Text>
                <TextInput
                  style={[styles.amountInput, { color: colors.textPrimary }]}
                  keyboardType="decimal-pad"
                  value={amount}
                  onChangeText={(val) => {
                    setAmount(val);
                    setErrorMessage(null);
                  }}
                  placeholder="0.00"
                  placeholderTextColor={colors.textMuted}
                  editable={!isSubmitting}
                  accessible={true}
                  accessibilityLabel="Enter payment amount"
                />
                {amount.length > 0 ? (
                  <TouchableOpacity onPress={() => setAmount('')} style={[styles.clearAmountBtn, { backgroundColor: colors.surfaceSecondary }]}>
                    <Text style={[styles.clearAmountBtnText, { color: colors.textSecondary }]}>✕</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Quick Preset Buttons matching Screenshot 10 */}
              <View style={styles.presetsRow}>
                <TouchableOpacity
                  style={[
                    styles.presetButton,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    parseFloat(amount) === amountDue && [styles.presetButtonActive, { backgroundColor: colors.primary, borderColor: colors.primary }],
                  ]}
                  onPress={() => handleApplyPreset(amountDue)}
                  disabled={isSubmitting || amountDue <= 0}
                >
                  <Text
                    style={[
                      styles.presetTitle,
                      { color: colors.textPrimary },
                      parseFloat(amount) === amountDue && styles.presetTextActive,
                    ]}
                  >
                    Full Amount
                  </Text>
                  <Text
                    style={[
                      styles.presetAmount,
                      { color: colors.textSecondary },
                      parseFloat(amount) === amountDue && styles.presetTextActive,
                    ]}
                  >
                    ₹{amountDue.toFixed(2)}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.presetButton,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    parseFloat(amount) === Number((amountDue * 0.5).toFixed(2)) &&
                      [styles.presetButtonActive, { backgroundColor: colors.primary, borderColor: colors.primary }],
                  ]}
                  onPress={() => handleApplyPreset(Number((amountDue * 0.5).toFixed(2)))}
                  disabled={isSubmitting || amountDue <= 0}
                >
                  <Text
                    style={[
                      styles.presetTitle,
                      { color: colors.textPrimary },
                      parseFloat(amount) === Number((amountDue * 0.5).toFixed(2)) &&
                        styles.presetTextActive,
                    ]}
                  >
                    50%
                  </Text>
                  <Text
                    style={[
                      styles.presetAmount,
                      { color: colors.textSecondary },
                      parseFloat(amount) === Number((amountDue * 0.5).toFixed(2)) &&
                        styles.presetTextActive,
                    ]}
                  >
                    ₹{(amountDue * 0.5).toFixed(2)}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.presetButton,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    parseFloat(amount) === amountDue && [styles.presetButtonActive, { backgroundColor: colors.primary, borderColor: colors.primary }],
                  ]}
                  onPress={() => handleApplyPreset(amountDue)}
                  disabled={isSubmitting || amountDue <= 0}
                >
                  <Text
                    style={[
                      styles.presetTitle,
                      { color: colors.textPrimary },
                      parseFloat(amount) === amountDue && styles.presetTextActive,
                    ]}
                  >
                    Exact
                  </Text>
                  <Text
                    style={[
                      styles.presetAmount,
                      { color: colors.textSecondary },
                      parseFloat(amount) === amountDue && styles.presetTextActive,
                    ]}
                  >
                    ₹{amountDue.toFixed(2)}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.presetButton, styles.presetClear, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
                  onPress={() => setAmount('')}
                  disabled={isSubmitting}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={{ fontSize: 13 }}>🧹</Text>
                    <Text style={[styles.presetClearText, { color: colors.textSecondary }]}>Clear</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* Payment Method Selector */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>Payment Method *</Text>
              <View style={styles.modesContainer}>
                {SUPPORTED_MODES.map((item) => {
                  const isSelected = mode === item.mode;
                  return (
                    <TouchableOpacity
                      key={item.mode}
                      style={[
                        styles.modeChip,
                        { backgroundColor: colors.surface, borderColor: colors.border },
                        isSelected && [styles.modeChipSelected, { backgroundColor: colors.primaryBg, borderColor: colors.primary }],
                      ]}
                      onPress={() => setMode(item.mode)}
                      disabled={isSubmitting}
                      accessible={true}
                      accessibilityLabel={`Select ${item.label}`}
                    >
                      <Text style={styles.modeIcon}>{item.icon}</Text>
                      <Text
                        style={[
                          styles.modeChipText,
                          { color: colors.textPrimary },
                          isSelected && [styles.modeChipTextSelected, { color: colors.primary }],
                        ]}
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
              <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>Reference / Transaction ID (Optional)</Text>
              <View style={[styles.referenceInputBox, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
                <Text style={{ fontSize: 15, marginRight: 8 }}>📄</Text>
                <TextInput
                  style={[styles.textInput, { color: colors.textPrimary }]}
                  value={reference}
                  onChangeText={setReference}
                  placeholder="e.g. UPI Ref Number, Cheque No., or Card Auth Code"
                  placeholderTextColor={colors.textMuted}
                  editable={!isSubmitting}
                  accessible={true}
                  accessibilityLabel="Enter reference or transaction note"
                />
              </View>
            </View>

            {/* Idempotency Key Footnote */}
            <View style={[styles.idempFooter, isDark && { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <Text style={{ fontSize: 13, marginRight: 5 }}>✅</Text>
              <Text style={[styles.idempFooterText, isDark && { color: colors.success }]}>
                Idempotency Protected • Key: {idempotencyKey.substring(0, 18)}...
              </Text>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={[styles.footerActions, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.cancelButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
              onPress={onClose}
              disabled={isSubmitting}
              accessible={true}
              accessibilityLabel="Cancel payment collection"
            >
              <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.submitButton,
                { backgroundColor: colors.primary },
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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 16 }}>🧾</Text>
                  <Text style={styles.submitButtonText}>
                    {isRetryableFailure
                      ? 'Retry Payment'
                      : `Collect ₹${parseFloat(amount) ? parseFloat(amount).toFixed(2) : amountDue.toFixed(2)}`}
                  </Text>
                </View>
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
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  walletIconSquircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 18,
  },
  balanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    gap: 10,
  },
  balanceIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceCenterCol: {
    flex: 1,
  },
  balanceCardLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#b91c1c',
  },
  balanceCardAmount: {
    fontSize: 24,
    fontWeight: '800',
    color: '#dc2626',
    marginVertical: 2,
  },
  balanceSubtext: {
    fontSize: 11,
    color: '#64748b',
  },
  balanceRightCol: {
    alignItems: 'flex-end',
    borderLeftWidth: 1,
    borderLeftColor: '#fed7aa',
    paddingLeft: 12,
  },
  balanceSummaryLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  balanceTotalVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  balancePaidVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#16a34a',
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
  inputLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  fillFullBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  fillFullBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1765f5',
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    height: 50,
  },
  currencyPrefix: {
    fontSize: 18,
    fontWeight: '700',
    color: '#64748b',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    paddingVertical: 0,
  },
  clearAmountBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearAmountBtnText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: 'bold',
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  presetButton: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  presetButtonActive: {
    backgroundColor: '#1765f5',
    borderColor: '#1765f5',
  },
  presetTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  presetAmount: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 1,
  },
  presetTextActive: {
    color: '#ffffff',
  },
  presetClear: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  presetClearText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  modesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    minHeight: 44,
    justifyContent: 'center',
  },
  modeChipSelected: {
    backgroundColor: '#eff6ff',
    borderColor: '#1765f5',
    borderWidth: 1.5,
  },
  modeIcon: {
    fontSize: 16,
  },
  modeChipText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0f172a',
  },
  modeChipTextSelected: {
    color: '#1765f5',
  },
  referenceInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    height: 46,
  },
  textInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
    paddingVertical: 0,
  },
  idempFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginVertical: 10,
  },
  idempFooterText: {
    fontSize: 11.5,
    color: '#166534',
    fontWeight: '600',
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
    borderRadius: 12,
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
    flex: 1.6,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#1765f5',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1765f5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
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
