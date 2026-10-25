import React, { useState, useEffect } from 'react';
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
  TextInput,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { DeliveryRecordDTO, Role, OrderItemDTO } from '@growfast/shared-types';
import { apiClient } from '../api/client';
import { PaymentCollectionModal } from './PaymentCollectionModal';

interface DeliveryCompletionModalProps {
  visible: boolean;
  delivery: DeliveryRecordDTO | null;
  userRole?: string;
  onClose: () => void;
  onDeliveryCompleted: () => void;
}

interface ItemDeliverySelection {
  itemId: string;
  name: string;
  totalQuantity: number;
  alreadyDelivered: number;
  remaining: number;
  selectedQuantity: number;
  includeInDelivery: boolean;
}

export function DeliveryCompletionModal({
  visible,
  delivery,
  userRole,
  onClose,
  onDeliveryCompleted,
}: DeliveryCompletionModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notes, setNotes] = useState('');
  const [proofPhotoUri, setProofPhotoUri] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // Financial / payment collection state
  const [amountDue, setAmountDue] = useState<number>(0);
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);

  // Partial delivery item selections
  const [isPartialDelivery, setIsPartialDelivery] = useState(false);
  const [itemSelections, setItemSelections] = useState<ItemDeliverySelection[]>([]);

  useEffect(() => {
    if (visible && delivery) {
      setNotes('');
      setProofPhotoUri(null);
      setIsSubmitting(false);

      // Check financial state from order
      const order = (delivery as any).order;
      if (order) {
        setAmountDue(Number(order.amountDue || 0));
        setTotalAmount(Number(order.totalAmount || 0));
      } else {
        // Query payments summary
        apiClient.payments
          .getSummary(delivery.orderId)
          .then((sum) => {
            if (sum) {
              setAmountDue(Number(sum.amountDue || 0));
              setTotalAmount(Number(sum.totalAmount || 0));
            }
          })
          .catch(() => {
            setAmountDue(0);
          });
      }

      // Populate items for partial delivery selection
      const items: OrderItemDTO[] = delivery.items || (delivery as any).order?.items || [];
      if (items.length > 0) {
        const selections: ItemDeliverySelection[] = items.map((item) => {
          const totalQty = item.quantity;
          const deliveredQty = item.deliveredQuantity || 0;
          const remainingQty = Math.max(0, totalQty - deliveredQty);
          return {
            itemId: item.id,
            name: item.garmentName || 'Garment Item',
            totalQuantity: totalQty,
            alreadyDelivered: deliveredQty,
            remaining: remainingQty,
            selectedQuantity: remainingQty,
            includeInDelivery: remainingQty > 0,
          };
        });
        setItemSelections(selections);
      } else {
        setItemSelections([]);
      }
    }
  }, [visible, delivery]);

  if (!delivery) return null;

  // Handle Photo Capture
  const handleTakePhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Camera Permission Required',
          'Please allow camera access in device settings to take delivery proof photos.',
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setProofPhotoUri(result.assets[0].uri);
      }
    } catch (err: any) {
      Alert.alert('Camera Error', err?.message || 'Could not launch camera.');
    }
  };

  const handlePickFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setProofPhotoUri(result.assets[0].uri);
      }
    } catch (err: any) {
      Alert.alert('Gallery Error', err?.message || 'Could not pick image.');
    }
  };

  // Adjust item quantities for partial delivery
  const updateItemQuantity = (itemId: string, delta: number) => {
    setItemSelections((prev) =>
      prev.map((sel) => {
        if (sel.itemId !== itemId) return sel;
        const newQty = Math.min(sel.remaining, Math.max(1, sel.selectedQuantity + delta));
        return { ...sel, selectedQuantity: newQty };
      }),
    );
  };

  const toggleItemIncluded = (itemId: string) => {
    setItemSelections((prev) =>
      prev.map((sel) => {
        if (sel.itemId !== itemId) return sel;
        return { ...sel, includeInDelivery: !sel.includeInDelivery };
      }),
    );
  };

  // Confirm delivery execution
  const handleConfirmDelivery = async () => {
    if (isSubmitting) return;

    // Check if order has an unpaid balance
    if (amountDue > 0) {
      Alert.alert(
        'Outstanding Balance Due',
        `Order #${delivery.orderNumber} has an unpaid balance of ₹${amountDue.toFixed(
          2,
        )}.\n\nBackend validation strictly requires the balance to be fully settled before final delivery.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Collect Payment Now',
            onPress: () => setPaymentModalVisible(true),
          },
        ],
      );
      return;
    }

    setIsSubmitting(true);
    let uploadedPhotoUrl: string | undefined = undefined;

    // Upload proof photo if present
    if (proofPhotoUri) {
      setIsUploadingPhoto(true);
      try {
        // If user is OWNER or COUNTER, use backend photo upload endpoint
        if (userRole === Role.OWNER || userRole === Role.COUNTER) {
          const uploadRes = await apiClient.photos.upload({
            uri: proofPhotoUri,
            orderId: delivery.orderId,
            photoType: 'DELIVERY_PROOF',
          });
          uploadedPhotoUrl = uploadRes?.url || proofPhotoUri;
        } else {
          // DELIVERY role passes photo URI directly (backend PhotoStorageService will resolve)
          uploadedPhotoUrl = proofPhotoUri;
        }
      } catch (err: any) {
        // Non-blocking upload failure: notify employee
        Alert.alert(
          'Photo Upload Notice',
          'Delivery proof photo could not be uploaded to server storage immediately. The delivery will be submitted with local reference.',
        );
        uploadedPhotoUrl = proofPhotoUri;
      } finally {
        setIsUploadingPhoto(false);
      }
    }

    // Build partial delivery payload if selected
    let deliveredItemsPayload: { itemId: string; quantity: number }[] | undefined = undefined;
    if (isPartialDelivery) {
      const activeSelections = itemSelections.filter(
        (s) => s.includeInDelivery && s.selectedQuantity > 0,
      );
      if (activeSelections.length === 0) {
        Alert.alert('Selection Required', 'Please select at least one garment item to deliver.');
        setIsSubmitting(false);
        return;
      }
      deliveredItemsPayload = activeSelections.map((s) => ({
        itemId: s.itemId,
        quantity: s.selectedQuantity,
      }));
    }

    try {
      await apiClient.deliveries.complete(delivery.id, {
        proofPhotoUrl: uploadedPhotoUrl,
        notes: notes.trim() || undefined,
        deliveredItems: deliveredItemsPayload,
      });

      Alert.alert(
        'Delivery Completed',
        `Delivery for Order #${delivery.orderNumber} has been successfully completed!`,
      );
      onDeliveryCompleted();
      onClose();
    } catch (err: any) {
      const msg =
        err?.data?.message || err?.message || 'Failed to complete delivery. Please try again.';
      Alert.alert('Completion Error', Array.isArray(msg) ? msg.join('\n') : msg);
    } finally {
      setIsSubmitting(false);
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
              accessibilityLabel="Cancel Delivery Completion"
            >
              <Text style={styles.backArrow}>‹</Text>
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={styles.headerTitle}>Complete Delivery</Text>
              <Text style={styles.headerSubtitle}>
                {orderNumDisplay} • {delivery.customerName}
              </Text>
            </View>
            <View style={{ width: 44 }} />
          </View>

          <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
            {/* Outstanding Balance Banner if due */}
            {amountDue > 0 ? (
              <View style={styles.warningCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 20 }}>⚠️</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.warningTitle}>
                      Outstanding Balance: ₹{amountDue.toFixed(2)}
                    </Text>
                    <Text style={styles.warningSub}>
                      Backend requires balance to be fully settled before completion.
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.collectPaymentBtn}
                  onPress={() => setPaymentModalVisible(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Collect Payment"
                >
                  <Text style={styles.collectPaymentBtnText}>
                    Collect Payment (₹{amountDue.toFixed(0)})
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.paidBadgeBox}>
                <Text style={styles.paidBadgeText}>✓ Order Balance Fully Paid</Text>
              </View>
            )}

            {/* Destination Address Card */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>📍 Delivery Destination</Text>
              <Text style={styles.addressText}>{delivery.address}</Text>
              {delivery.riderName ? (
                <Text style={styles.riderText}>Assigned Rider: {delivery.riderName}</Text>
              ) : null}
            </View>

            {/* Partial vs Full Delivery Selection (Section 7) */}
            {itemSelections.length > 0 ? (
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>📦 Items to Deliver</Text>
                  <TouchableOpacity
                    onPress={() => setIsPartialDelivery(!isPartialDelivery)}
                    style={styles.toggleBtn}
                  >
                    <Text style={styles.toggleBtnText}>
                      {isPartialDelivery ? 'Switch to Full Delivery' : 'Custom Partial Delivery'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {isPartialDelivery ? (
                  <View style={styles.itemsList}>
                    <Text style={styles.partialInstructionText}>
                      Select items and specify quantities being delivered in this handover:
                    </Text>
                    {itemSelections.map((sel) => (
                      <View key={sel.itemId} style={styles.itemSelectionRow}>
                        <TouchableOpacity
                          style={styles.checkboxTouch}
                          onPress={() => toggleItemIncluded(sel.itemId)}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: sel.includeInDelivery }}
                        >
                          <View
                            style={[
                              styles.checkboxBox,
                              sel.includeInDelivery && styles.checkboxBoxChecked,
                            ]}
                          >
                            {sel.includeInDelivery ? (
                              <Text style={styles.checkboxCheck}>✓</Text>
                            ) : null}
                          </View>
                          <View style={{ flex: 1, marginLeft: 8 }}>
                            <Text style={styles.itemNameText}>{sel.name}</Text>
                            <Text style={styles.itemSubText}>
                              Remaining: {sel.remaining} of {sel.totalQuantity}
                            </Text>
                          </View>
                        </TouchableOpacity>

                        {sel.includeInDelivery ? (
                          <View style={styles.stepperContainer}>
                            <TouchableOpacity
                              style={styles.stepperBtn}
                              onPress={() => updateItemQuantity(sel.itemId, -1)}
                              disabled={sel.selectedQuantity <= 1}
                            >
                              <Text style={styles.stepperBtnText}>-</Text>
                            </TouchableOpacity>
                            <Text style={styles.stepperValueText}>{sel.selectedQuantity}</Text>
                            <TouchableOpacity
                              style={styles.stepperBtn}
                              onPress={() => updateItemQuantity(sel.itemId, 1)}
                              disabled={sel.selectedQuantity >= sel.remaining}
                            >
                              <Text style={styles.stepperBtnText}>+</Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <Text style={styles.excludedText}>Excluded</Text>
                        )}
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.fullDeliveryNotice}>
                    <Text style={styles.fullDeliveryNoticeText}>
                      All {itemSelections.reduce((acc, s) => acc + s.remaining, 0)} remaining
                      garments will be marked as Delivered.
                    </Text>
                  </View>
                )}
              </View>
            ) : null}

            {/* Proof Photo Capture (Section 6) */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>📷 Proof of Delivery Photo</Text>
              <Text style={styles.photoSubtext}>
                Capture a photo of the handed-over garments or recipient signature confirmation.
              </Text>

              {proofPhotoUri ? (
                <View style={styles.photoPreviewContainer}>
                  <Image source={{ uri: proofPhotoUri }} style={styles.photoPreview} />
                  <View style={styles.photoPreviewActions}>
                    <TouchableOpacity
                      style={styles.retakeBtn}
                      onPress={handleTakePhoto}
                      disabled={isSubmitting}
                    >
                      <Text style={styles.retakeBtnText}>Retake Photo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.removePhotoBtn}
                      onPress={() => setProofPhotoUri(null)}
                      disabled={isSubmitting}
                    >
                      <Text style={styles.removePhotoBtnText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.photoButtonsRow}>
                  <TouchableOpacity
                    style={styles.photoActionButton}
                    onPress={handleTakePhoto}
                    disabled={isSubmitting}
                    accessibilityRole="button"
                    accessibilityLabel="Take Photo with Camera"
                  >
                    <Text style={styles.photoBtnIcon}>📷</Text>
                    <Text style={styles.photoBtnText}>Take Photo</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.photoActionButton, { backgroundColor: '#f1f5f9' }]}
                    onPress={handlePickFromGallery}
                    disabled={isSubmitting}
                    accessibilityRole="button"
                    accessibilityLabel="Select from Gallery"
                  >
                    <Text style={styles.photoBtnIcon}>🖼️</Text>
                    <Text style={[styles.photoBtnText, { color: '#334155' }]}>Gallery</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Delivery Notes */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>📝 Handover Notes (Optional)</Text>
              <TextInput
                style={styles.notesInput}
                placeholder="e.g., Left with building security, Received by customer"
                placeholderTextColor="#94a3b8"
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          </ScrollView>

          {/* Bottom Confirmation Bar */}
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={[
                styles.confirmButton,
                isSubmitting && styles.buttonDisabled,
                amountDue > 0 && { backgroundColor: '#d97706' },
              ]}
              onPress={handleConfirmDelivery}
              disabled={isSubmitting}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Confirm Delivery"
            >
              {isSubmitting ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ActivityIndicator color="#ffffff" />
                  <Text style={styles.confirmButtonText}>
                    {isUploadingPhoto ? 'Uploading Proof...' : 'Completing Delivery...'}
                  </Text>
                </View>
              ) : (
                <Text style={styles.confirmButtonText}>
                  {amountDue > 0 ? '⚠️ Settle Balance & Deliver' : '✓ Confirm Delivery'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Embedded Payment Collection Modal when balance is due */}
        <PaymentCollectionModal
          visible={paymentModalVisible}
          orderId={delivery.orderId}
          orderNumber={delivery.orderNumber}
          customerName={delivery.customerName}
          amountDue={amountDue}
          totalAmount={totalAmount}
          onClose={() => setPaymentModalVisible(false)}
          onPaymentSuccess={() => {
            setPaymentModalVisible(false);
            setAmountDue(0);
            Alert.alert(
              'Payment Collected',
              'Payment recorded successfully! You can now complete the delivery handover.',
            );
          }}
        />
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
    gap: 14,
    paddingBottom: 36,
  },
  warningCard: {
    backgroundColor: '#fef3c7',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#92400e',
  },
  warningSub: {
    fontSize: 12,
    color: '#b45309',
    marginTop: 2,
  },
  collectPaymentBtn: {
    marginTop: 10,
    backgroundColor: '#d97706',
    borderRadius: 10,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collectPaymentBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  paidBadgeBox: {
    backgroundColor: '#dcfce7',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    alignItems: 'center',
  },
  paidBadgeText: {
    color: '#15803d',
    fontSize: 12,
    fontWeight: '700',
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 6,
  },
  addressText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
  riderText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 6,
    fontWeight: '600',
  },
  toggleBtn: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  toggleBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563eb',
  },
  itemsList: {
    marginTop: 8,
    gap: 8,
  },
  partialInstructionText: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 6,
  },
  itemSelectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  checkboxTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minHeight: 44,
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#94a3b8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxBoxChecked: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  checkboxCheck: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  itemNameText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  itemSubText: {
    fontSize: 11,
    color: '#64748b',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepperBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
  },
  stepperValueText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    minWidth: 24,
    textAlign: 'center',
  },
  excludedText: {
    fontSize: 11,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  fullDeliveryNotice: {
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    padding: 10,
    marginTop: 4,
  },
  fullDeliveryNoticeText: {
    fontSize: 12,
    color: '#1e40af',
    fontWeight: '500',
  },
  photoSubtext: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 10,
  },
  photoButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  photoActionButton: {
    flex: 1,
    minHeight: 44,
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  photoBtnIcon: {
    fontSize: 16,
  },
  photoBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  photoPreviewContainer: {
    alignItems: 'center',
    gap: 8,
  },
  photoPreview: {
    width: '100%',
    height: 180,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  photoPreviewActions: {
    flexDirection: 'row',
    gap: 12,
  },
  retakeBtn: {
    minHeight: 44,
    paddingHorizontal: 16,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retakeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  removePhotoBtn: {
    minHeight: 44,
    paddingHorizontal: 16,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePhotoBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#b91c1c',
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
    minHeight: 64,
  },
  bottomBar: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  confirmButton: {
    minHeight: 48,
    backgroundColor: '#2563eb',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
