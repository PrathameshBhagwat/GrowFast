import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  StyleSheet,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import {
  GarmentCatalogDTO,
  ServiceTypeDTO,
  CreateOrderItemRequest,
  GarmentCategory,
  PhotoType,
  formatCatalogServiceName,
  isWeightBasedCategory,
} from '@growfast/shared-types';
import { PendingPhoto, savePhotoLocally, deletePhoto, getPhotosForDraft } from '../../db/photos';
import { generateUUID } from '../../db/drafts';

export interface ItemDetailsModalProps {
  visible: boolean;
  clientDraftId: string;
  garment: GarmentCatalogDTO | null;
  service: ServiceTypeDTO | null;
  unitPrice: number;
  existingItemIndex?: number;
  initialItem?: CreateOrderItemRequest | null;
  canModifyPrice?: boolean;
  onSaveItem: (item: CreateOrderItemRequest, existingIndex?: number) => void;
  onClose: () => void;
  onPhotosUpdated?: () => void;
}

const DEFECT_QUICK_TAGS = [
  'Collar Stain',
  'Torn Hem',
  'Missing Button',
  'Color Bleed',
  'Faded',
  'Ink Mark',
  'Oil Stain',
];

export function ItemDetailsModal({
  visible,
  clientDraftId,
  garment,
  service,
  unitPrice,
  existingItemIndex,
  initialItem,
  canModifyPrice = false,
  onSaveItem,
  onClose,
  onPhotosUpdated,
}: ItemDetailsModalProps) {
  const [quantity, setQuantity] = useState('1');
  const [weight, setWeight] = useState('2.00');
  const [rate, setRate] = useState(String(unitPrice || 0));
  const [defectNotes, setDefectNotes] = useState('');
  const [itemPhotos, setItemPhotos] = useState<PendingPhoto[]>([]);
  const [isCapturingPhoto, setIsCapturingPhoto] = useState(false);
  const [weightError, setWeightError] = useState<string | null>(null);

  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0,
  );

  const isWeightBased =
    garment?.category === GarmentCategory.WEIGHT_BASED ||
    (garment ? isWeightBasedCategory(garment.category) : false) ||
    Boolean(initialItem?.weight != null && initialItem.weight > 0);

  // Load photos and initialize fields when opened
  useEffect(() => {
    if (visible && garment) {
      if (initialItem) {
        setQuantity(String(initialItem.quantity || 1));
        setWeight(initialItem.weight ? String(initialItem.weight) : '2.00');
        setRate(String(initialItem.unitPrice ?? unitPrice ?? 0));
        setDefectNotes(initialItem.defectNotes || '');
      } else {
        setQuantity('1');
        setWeight('2.00');
        setRate(String(unitPrice || 0));
        setDefectNotes('');
      }
      setWeightError(null);

      // Load existing photos for this specific garment
      getPhotosForDraft(clientDraftId)
        .then((allPhotos) => {
          const matched = allPhotos.filter((p) => p.garmentId === garment.id);
          setItemPhotos(matched);
        })
        .catch(() => setItemPhotos([]));
    }
  }, [visible, garment, service, unitPrice, initialItem, clientDraftId]);

  if (!garment) return null;

  const refreshPhotos = async () => {
    const allPhotos = await getPhotosForDraft(clientDraftId);
    const matched = allPhotos.filter((p) => p.garmentId === garment.id);
    setItemPhotos(matched);
    onPhotosUpdated?.();
  };

  const handleCaptureCamera = async () => {
    try {
      setIsCapturingPhoto(true);
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Camera Permission',
          'Camera access is required to photograph intake garments.',
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        await savePhotoLocally({
          clientDraftId,
          sourceUri: asset.uri,
          garmentId: garment.id,
          unitNumber: 1,
          photoType: PhotoType.FRONT,
        });
        await refreshPhotos();
      }
    } catch (err: any) {
      Alert.alert('Camera Error', err.message || 'Could not capture photo');
    } finally {
      setIsCapturingPhoto(false);
    }
  };

  const handlePickGallery = async () => {
    try {
      setIsCapturingPhoto(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        await savePhotoLocally({
          clientDraftId,
          sourceUri: asset.uri,
          garmentId: garment.id,
          unitNumber: 1,
          photoType: PhotoType.FRONT,
        });
        await refreshPhotos();
      }
    } catch (err: any) {
      Alert.alert('Gallery Error', err.message || 'Could not select photo');
    } finally {
      setIsCapturingPhoto(false);
    }
  };

  const handleDeletePhoto = async (photo: PendingPhoto) => {
    Alert.alert('Remove Photo', 'Are you sure you want to remove this garment photo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await deletePhoto(photo.id);
          await refreshPhotos();
        },
      },
    ]);
  };

  const handleToggleDefectTag = (tag: string) => {
    if (defectNotes.includes(tag)) {
      const parts = defectNotes
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s !== tag && s.length > 0);
      setDefectNotes(parts.join(', '));
    } else {
      const parts = defectNotes
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      parts.push(tag);
      setDefectNotes(parts.join(', '));
    }
  };

  const handleSave = () => {
    // 1. Quantity validation
    const qtyNum = parseInt(quantity, 10);
    if (isNaN(qtyNum) || qtyNum < 1) {
      Alert.alert('Validation Error', 'Quantity must be at least 1.');
      return;
    }

    // 2. Weight validation
    let weightVal: number | undefined = undefined;
    if (isWeightBased) {
      const parsedWeight = parseFloat(weight);
      if (isNaN(parsedWeight) || parsedWeight < 2.0) {
        setWeightError('Minimum weight requirement is 2.00 kg per business rules.');
        Alert.alert('Validation Error', 'Weight-based laundry requires a minimum of 2.00 kg.');
        return;
      }
      weightVal = Math.round(parsedWeight * 100) / 100;
    }

    // 3. Price validation
    const parsedPrice = parseFloat(rate);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      Alert.alert('Validation Error', 'Rate must be a valid non-negative number.');
      return;
    }

    // 4. Build pieces array with stable pieceId and photo counts matching website contract
    const itemId = initialItem?.id || generateUUID();
    const pieces = Array.from({ length: qtyNum }, (_, i) => {
      const u = i + 1;
      const existingPiece = initialItem?.pieces?.find((p) => p.unitNumber === u);
      const pieceId = existingPiece?.pieceId || generateUUID();
      const piecePhotos = itemPhotos.filter(
        (p) =>
          (p.pieceId && p.pieceId === pieceId) ||
          p.unitNumber === u ||
          (qtyNum === 1 && !p.unitNumber),
      );
      return {
        pieceId,
        unitNumber: u,
        photoCount: piecePhotos.length,
      };
    });

    const item: CreateOrderItemRequest = {
      id: itemId,
      garmentCatalogId: garment.id,
      serviceTypeId: service?.id || 'srv-wash-iron',
      quantity: qtyNum,
      weight: weightVal,
      unitPrice: parsedPrice,
      defectNotes: defectNotes.trim() || undefined,
      pieces,
    };

    onSaveItem(item, existingItemIndex);
    onClose();
  };

  const parsedQty = parseInt(quantity, 10) || 1;
  const parsedWt = parseFloat(weight) || 0;
  const parsedRate = parseFloat(rate) || 0;
  const estimatedLineTotal = isWeightBased ? parsedWt * parsedRate : parsedQty * parsedRate;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.safeContainer, { paddingTop: topInset, paddingBottom: insets.bottom }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerCancelBtn}>
            <Text style={styles.headerCancelText}>✕ Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {existingItemIndex != null ? 'Edit Garment' : 'Add to Order'}
          </Text>
          <TouchableOpacity onPress={handleSave} style={styles.headerSaveBtn}>
            <Text style={styles.headerSaveText}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
          {/* Garment & Service Summary Card */}
          <View style={styles.summaryCard}>
            <View style={styles.garmentHeaderRow}>
              <View style={styles.garmentBadge}>
                <Text style={styles.garmentBadgeEmoji}>{isWeightBased ? '⚖️' : '👔'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.garmentName}>{garment.name}</Text>
                <Text style={styles.serviceName}>
                  {service ? formatCatalogServiceName(service.name) : 'Standard Service'}
                </Text>
              </View>
            </View>

            <View style={styles.pricingPreviewRow}>
              <Text style={styles.previewRateLabel}>Configured Rate:</Text>
              <Text style={styles.previewRateValue}>
                ₹{parsedRate.toFixed(2)} {isWeightBased ? '/ kg' : '/ piece'}
              </Text>
            </View>
            <View style={[styles.pricingPreviewRow, { borderTopWidth: 0, paddingTop: 4 }]}>
              <Text style={styles.previewRateLabel}>Estimated Line Total:</Text>
              <Text style={[styles.previewRateValue, { color: '#16a34a' }]}>
                ₹{estimatedLineTotal.toFixed(2)}
              </Text>
            </View>
          </View>

          {/* Quantity or Weight Input */}
          {isWeightBased ? (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Measured Weight (kg) *</Text>
                <Text style={styles.inputSubtitle}>
                  Minimum required weight is 2.00 kg per store policy
                </Text>
                <TextInput
                  style={[styles.textInput, weightError && styles.textInputError]}
                  keyboardType="decimal-pad"
                  value={weight}
                  onChangeText={(val) => {
                    setWeight(val);
                    setWeightError(null);
                  }}
                  placeholder="2.00"
                  placeholderTextColor="#94a3b8"
                  accessible={true}
                  accessibilityLabel="Measured laundry weight in kilograms"
                />
                {weightError ? <Text style={styles.errorText}>{weightError}</Text> : null}

                {/* Quick Weight Presets (Workstream 2) */}
                <View style={styles.quickChipsRow}>
                  {['2.00', '3.00', '5.00', '10.00'].map((preset) => (
                    <TouchableOpacity
                      key={preset}
                      style={[styles.quickChipBtn, weight === preset && styles.quickChipBtnActive]}
                      onPress={() => {
                        setWeight(preset);
                        setWeightError(null);
                      }}
                      accessible={true}
                      accessibilityLabel={`Set weight to ${preset} kg`}
                    >
                      <Text
                        style={[
                          styles.quickChipBtnText,
                          weight === preset && styles.quickChipBtnTextActive,
                        ]}
                      >
                        {preset} kg
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Garment Count in Weight Bag (matching website LaundryWeightOrderEntry) */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Garments Count (Pieces in Bag) *</Text>
                <Text style={styles.inputSubtitle}>
                  Number of physical garments for tag tracking & inspection
                </Text>
                <View style={styles.quantityStepperRow}>
                  <TouchableOpacity
                    style={styles.quantityStepperBtn}
                    onPress={() => {
                      const q = Math.max(1, (parseInt(quantity, 10) || 1) - 1);
                      setQuantity(String(q));
                    }}
                    accessible={true}
                    accessibilityLabel="Decrease garment count"
                  >
                    <Text style={styles.quantityStepperBtnText}>−</Text>
                  </TouchableOpacity>

                  <TextInput
                    style={styles.quantityInput}
                    keyboardType="number-pad"
                    value={quantity}
                    onChangeText={setQuantity}
                    accessible={true}
                    accessibilityLabel="Garment count"
                  />

                  <TouchableOpacity
                    style={styles.quantityStepperBtn}
                    onPress={() => {
                      const q = (parseInt(quantity, 10) || 1) + 1;
                      setQuantity(String(q));
                    }}
                    accessible={true}
                    accessibilityLabel="Increase garment count"
                  >
                    <Text style={styles.quantityStepperBtnText}>＋</Text>
                  </TouchableOpacity>
                </View>

                {/* Quick Increment Chips */}
                <View style={styles.quickChipsRow}>
                  {[1, 2, 5, 10].map((inc) => (
                    <TouchableOpacity
                      key={inc}
                      style={styles.quickChipBtn}
                      onPress={() => {
                        const current = parseInt(quantity, 10) || 1;
                        setQuantity(String(current + inc));
                      }}
                      accessible={true}
                      accessibilityLabel={`Add ${inc} more garments`}
                    >
                      <Text style={styles.quickChipBtnText}>+{inc}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={[styles.quickChipBtn, styles.quickChipResetBtn]}
                    onPress={() => setQuantity('1')}
                    accessible={true}
                    accessibilityLabel="Reset count to 1"
                  >
                    <Text style={styles.quickChipResetBtnText}>Reset</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          ) : (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Piece Quantity *</Text>
              <View style={styles.quantityStepperRow}>
                <TouchableOpacity
                  style={styles.quantityStepperBtn}
                  onPress={() => {
                    const q = Math.max(1, (parseInt(quantity, 10) || 1) - 1);
                    setQuantity(String(q));
                  }}
                  accessible={true}
                  accessibilityLabel="Decrease quantity"
                >
                  <Text style={styles.quantityStepperBtnText}>−</Text>
                </TouchableOpacity>

                <TextInput
                  style={styles.quantityInput}
                  keyboardType="number-pad"
                  value={quantity}
                  onChangeText={setQuantity}
                  accessible={true}
                  accessibilityLabel="Quantity"
                />

                <TouchableOpacity
                  style={styles.quantityStepperBtn}
                  onPress={() => {
                    const q = (parseInt(quantity, 10) || 1) + 1;
                    setQuantity(String(q));
                  }}
                  accessible={true}
                  accessibilityLabel="Increase quantity"
                >
                  <Text style={styles.quantityStepperBtnText}>＋</Text>
                </TouchableOpacity>
              </View>

              {/* Quick Increment Chips for Fast Bulk Intake (Workstream 2) */}
              <View style={styles.quickChipsRow}>
                {[1, 2, 5, 10].map((inc) => (
                  <TouchableOpacity
                    key={inc}
                    style={styles.quickChipBtn}
                    onPress={() => {
                      const current = parseInt(quantity, 10) || 1;
                      setQuantity(String(current + inc));
                    }}
                    accessible={true}
                    accessibilityLabel={`Add ${inc} more pieces`}
                  >
                    <Text style={styles.quickChipBtnText}>+{inc}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[styles.quickChipBtn, styles.quickChipResetBtn]}
                  onPress={() => setQuantity('1')}
                  accessible={true}
                  accessibilityLabel="Reset quantity to 1"
                >
                  <Text style={styles.quickChipResetBtnText}>Reset</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Rate Override (Manager/Owner Only) */}
          {canModifyPrice ? (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Unit Rate Override (₹)</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="decimal-pad"
                value={rate}
                onChangeText={setRate}
                accessible={true}
                accessibilityLabel="Unit rate override"
              />
            </View>
          ) : null}

          {/* Pre-Existing Defect Notes & Quick Tags */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Garment Defect & Condition Notes</Text>
            <Text style={styles.inputSubtitle}>Tap quick tags or enter custom condition</Text>

            <View style={styles.defectTagsRow}>
              {DEFECT_QUICK_TAGS.map((tag) => {
                const isActive = defectNotes.includes(tag);
                return (
                  <TouchableOpacity
                    key={tag}
                    style={[styles.defectTag, isActive && styles.defectTagActive]}
                    onPress={() => handleToggleDefectTag(tag)}
                    accessible={true}
                    accessibilityLabel={`Toggle defect note ${tag}`}
                  >
                    <Text style={[styles.defectTagText, isActive && styles.defectTagTextActive]}>
                      {tag}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TextInput
              style={[styles.textInput, styles.defectTextInput]}
              placeholder="e.g. Mild coffee stain near collar, broken button on cuff"
              placeholderTextColor="#94a3b8"
              value={defectNotes}
              onChangeText={setDefectNotes}
              multiline
              numberOfLines={2}
              accessible={true}
              accessibilityLabel="Defect notes input"
            />
          </View>

          {/* Garment Intake Photos */}
          <View style={styles.inputGroup}>
            <View style={styles.photoHeaderRow}>
              <Text style={styles.inputLabel}>Garment Intake Photos</Text>
              <Text style={styles.photoCountText}>{itemPhotos.length} photo(s)</Text>
            </View>

            {/* Photo Action Buttons */}
            <View style={styles.photoActionsRow}>
              <TouchableOpacity
                style={styles.photoActionButton}
                onPress={handleCaptureCamera}
                disabled={isCapturingPhoto}
                accessible={true}
                accessibilityLabel="Take Photo with Camera"
              >
                <Text style={styles.photoActionEmoji}>📷</Text>
                <Text style={styles.photoActionText}>Take Photo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.photoActionButton, styles.galleryButton]}
                onPress={handlePickGallery}
                disabled={isCapturingPhoto}
                accessible={true}
                accessibilityLabel="Select Photo from Gallery"
              >
                <Text style={styles.photoActionEmoji}>🖼️</Text>
                <Text style={styles.photoActionText}>Upload Gallery</Text>
              </TouchableOpacity>
            </View>

            {isCapturingPhoto ? (
              <View style={styles.photoLoadingRow}>
                <ActivityIndicator size="small" color="#2563eb" />
                <Text style={styles.photoLoadingText}>Saving photo to device...</Text>
              </View>
            ) : null}

            {/* Thumbnail previews */}
            {itemPhotos.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.photoGallery}
              >
                {itemPhotos.map((p) => (
                  <View key={p.id} style={styles.photoThumbnailContainer}>
                    <Image source={{ uri: p.localFileUri }} style={styles.photoThumbnail} />
                    <TouchableOpacity
                      style={styles.deletePhotoBtn}
                      onPress={() => handleDeletePhoto(p)}
                      accessible={true}
                      accessibilityLabel="Remove photo"
                    >
                      <Text style={styles.deletePhotoBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            ) : null}
          </View>

          {/* Estimated Line Total Card */}
          <View style={styles.totalPreviewCard}>
            <Text style={styles.totalPreviewLabel}>Estimated Line Total:</Text>
            <Text style={styles.totalPreviewAmount}>₹{estimatedLineTotal.toFixed(2)}</Text>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={styles.saveSubmitButton}
            onPress={handleSave}
            accessible={true}
            accessibilityLabel="Save and add item to cart"
          >
            <Text style={styles.saveSubmitButtonText}>
              {existingItemIndex != null ? 'Update Garment Details' : 'Add Item to Order'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerCancelBtn: {
    padding: 6,
    minHeight: 40,
    justifyContent: 'center',
  },
  headerCancelText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  headerSaveBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#2563eb',
    borderRadius: 8,
    minHeight: 36,
    justifyContent: 'center',
  },
  headerSaveText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '700',
  },
  content: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  summaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  garmentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  garmentBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  garmentBadgeEmoji: {
    fontSize: 20,
  },
  garmentName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  serviceName: {
    fontSize: 13,
    color: '#2563eb',
    fontWeight: '600',
    marginTop: 1,
  },
  pricingPreviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 8,
  },
  previewRateLabel: {
    fontSize: 13,
    color: '#64748b',
  },
  previewRateValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  inputGroup: {
    marginBottom: 16,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 2,
  },
  inputSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0f172a',
  },
  textInputError: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  defectTextInput: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  quantityStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  quantityStepperBtn: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityStepperBtnText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1e293b',
    lineHeight: 24,
  },
  quantityInput: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingVertical: 8,
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    minHeight: 44,
  },
  quickChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  quickChipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickChipBtnActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  quickChipBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  quickChipBtnTextActive: {
    color: '#ffffff',
  },
  quickChipResetBtn: {
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
  },
  quickChipResetBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#b91c1c',
  },
  defectTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  defectTag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  defectTagActive: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
  },
  defectTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  defectTagTextActive: {
    color: '#b45309',
    fontWeight: '700',
  },
  photoHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  photoCountText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  photoActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  photoActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 8,
    paddingVertical: 10,
    minHeight: 44,
    gap: 6,
  },
  galleryButton: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  photoActionEmoji: {
    fontSize: 16,
  },
  photoActionText: {
    color: '#1d4ed8',
    fontSize: 13,
    fontWeight: '700',
  },
  photoLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  photoLoadingText: {
    color: '#64748b',
    fontSize: 12,
  },
  photoGallery: {
    flexDirection: 'row',
    marginTop: 6,
  },
  photoThumbnailContainer: {
    position: 'relative',
    marginRight: 10,
  },
  photoThumbnail: {
    width: 72,
    height: 72,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  deletePhotoBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deletePhotoBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  totalPreviewCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  totalPreviewLabel: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  totalPreviewAmount: {
    color: '#38bdf8',
    fontSize: 18,
    fontWeight: '800',
  },
  saveSubmitButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  saveSubmitButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
