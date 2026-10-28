import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Image,
  Modal,
  Pressable,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
  CreateOrderItemRequest,
  GarmentCatalogDTO,
  ServiceTypeDTO,
  PhotoType,
  formatCatalogServiceName,
  roundCurrency,
} from '@growfast/shared-types';
import { PendingPhoto, savePhotoLocally, deletePhoto } from '../../db/photos';

// Safe component wrapper for Ionicons across React 18/19 type definitions
const Icon = Ionicons as unknown as React.ComponentType<{
  name: string;
  size?: number;
  color?: string;
  style?: any;
}>;

export interface OrderItemsReviewStepProps {
  clientDraftId?: string;
  items: CreateOrderItemRequest[];
  garments: GarmentCatalogDTO[];
  services: ServiceTypeDTO[];
  photos: PendingPhoto[];
  onEditItem: (index: number) => void;
  onRemoveItem: (index: number) => void;
  onAddMoreItems: () => void;
  onContinueToFinalReview: () => void;
  onUpdateItemQuantity?: (index: number, newQty: number) => void;
  onPhotosUpdated?: () => void;
}

export function OrderItemsReviewStep({
  clientDraftId,
  items,
  garments,
  services,
  photos,
  onEditItem,
  onRemoveItem,
  onAddMoreItems,
  onContinueToFinalReview,
  onUpdateItemQuantity,
  onPhotosUpdated,
}: OrderItemsReviewStepProps) {
  // Target for active photo capture/selection
  const [activePhotoTarget, setActivePhotoTarget] = useState<{
    garmentCatalogId: string;
    garmentName: string;
    unitNumber: number;
    pieceId?: string;
    orderItemId?: string;
  } | null>(null);

  // Piece selector modal state for multi-piece items
  const [pieceSelectorItem, setPieceSelectorItem] = useState<{
    garmentCatalogId: string;
    garmentName: string;
    quantity: number;
    orderItemId?: string;
    pieces: { unitNumber: number; pieceId?: string }[];
  } | null>(null);

  const [selectedPreviewPhoto, setSelectedPreviewPhoto] = useState<PendingPhoto | null>(null);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);

  // Helpers
  const getGarmentName = (id: string): string => {
    const g = garments.find((item) => item.id === id);
    return g ? g.name : 'Garment';
  };

  const getServiceName = (id: string): string => {
    const s = services.find((item) => item.id === id);
    return s ? formatCatalogServiceName(s.name) : 'Standard Service';
  };

  const getPhotosForGarment = (garmentId: string): PendingPhoto[] => {
    return photos.filter((p) => p.garmentId === garmentId);
  };

  const getPhotosForPiece = (
    garmentId: string,
    unitNumber: number,
    pieceId?: string | null,
    totalPiecesInItem: number = 1,
    orderItemId?: string | null,
  ): PendingPhoto[] => {
    return photos.filter((p) => {
      if (pieceId && p.pieceId) return p.pieceId === pieceId;
      if (orderItemId && p.orderItemId) {
        return (
          p.orderItemId === orderItemId &&
          (p.unitNumber === unitNumber || (totalPiecesInItem === 1 && !p.unitNumber))
        );
      }
      if (p.garmentId === garmentId) {
        if (p.unitNumber === unitNumber) return true;
        if (totalPiecesInItem === 1 && (p.unitNumber == null || p.unitNumber === 1)) {
          return true;
        }
      }
      return false;
    });
  };

  // Summaries
  const totalPieces = useMemo(() => {
    return items.reduce((sum, it) => sum + (it.quantity || 1), 0);
  }, [items]);

  const totalWeight = useMemo(() => {
    return items.reduce((sum, it) => sum + (it.weight || 0), 0);
  }, [items]);

  const subtotal = useMemo(() => {
    return items.reduce((sum, it) => {
      const multiplier = it.weight && it.weight > 0 ? it.weight : it.quantity || 1;
      return sum + roundCurrency((it.unitPrice || 0) * multiplier);
    }, 0);
  }, [items]);

  const handleConfirmRemove = (index: number) => {
    const item = items[index];
    const name = getGarmentName(item.garmentCatalogId);
    Alert.alert('Remove Item', `Are you sure you want to remove ${name} from this order?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => onRemoveItem(index),
      },
    ]);
  };

  // Target-specific photo capture via Camera
  const handleTakePhotoForTarget = async (target: {
    garmentCatalogId: string;
    garmentName: string;
    unitNumber: number;
    pieceId?: string;
    orderItemId?: string;
  }) => {
    if (!clientDraftId) {
      Alert.alert('Draft Unavailable', 'Draft ID missing. Please save the order first.');
      return;
    }

    try {
      setIsCapturing(true);
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Camera Permission Required',
          'Please allow camera access in device settings to capture garment photos.',
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
          photoType: PhotoType.FRONT,
          garmentId: target.garmentCatalogId,
          orderItemId: target.orderItemId,
          pieceId: target.pieceId,
          unitNumber: target.unitNumber,
        });
        if (onPhotosUpdated) {
          onPhotosUpdated();
        }
      }
    } catch (err: any) {
      Alert.alert('Photo Error', err.message || 'Could not capture photo');
    } finally {
      setIsCapturing(false);
    }
  };

  // Target-specific photo selection via Gallery
  const handlePickFromGalleryForTarget = async (target: {
    garmentCatalogId: string;
    garmentName: string;
    unitNumber: number;
    pieceId?: string;
    orderItemId?: string;
  }) => {
    if (!clientDraftId) {
      Alert.alert('Draft Unavailable', 'Draft ID missing. Please save the order first.');
      return;
    }

    try {
      setIsCapturing(true);
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Gallery Permission Required',
          'Please allow photo library access in device settings to choose garment photos.',
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        await savePhotoLocally({
          clientDraftId,
          sourceUri: asset.uri,
          photoType: PhotoType.FRONT,
          garmentId: target.garmentCatalogId,
          orderItemId: target.orderItemId,
          pieceId: target.pieceId,
          unitNumber: target.unitNumber,
        });
        if (onPhotosUpdated) {
          onPhotosUpdated();
        }
      }
    } catch (err: any) {
      Alert.alert('Gallery Error', err.message || 'Could not select photo');
    } finally {
      setIsCapturing(false);
    }
  };

  // Delete attached photo with confirmation
  const handleConfirmDeletePhoto = (photo: PendingPhoto) => {
    Alert.alert('Remove Photo', 'Are you sure you want to remove this photo from the garment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await deletePhoto(photo.id);
          if (selectedPreviewPhoto?.id === photo.id) {
            setSelectedPreviewPhoto(null);
          }
          if (onPhotosUpdated) {
            onPhotosUpdated();
          }
        },
      },
    ]);
  };

  if (items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyEmoji}>🛒</Text>
        <Text style={styles.emptyTitle}>Your cart is empty</Text>
        <Text style={styles.emptySubtitle}>Add garments or laundry items from the catalog.</Text>
        <TouchableOpacity
          style={styles.browseButton}
          onPress={onAddMoreItems}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Browse garment catalog"
        >
          <Text style={styles.browseButtonText}>＋ Browse Catalog</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Top Summary Banner */}
        <View style={styles.summaryBar}>
          <View style={styles.summaryBarItem}>
            <Text style={styles.summaryBarValue}>{totalPieces}</Text>
            <Text style={styles.summaryBarLabel}>Pieces</Text>
          </View>
          {totalWeight > 0 && (
            <View style={styles.summaryBarItem}>
              <Text style={styles.summaryBarValue}>{totalWeight.toFixed(2)} kg</Text>
              <Text style={styles.summaryBarLabel}>Weight</Text>
            </View>
          )}
          <View style={styles.summaryBarItem}>
            <Text style={styles.summaryBarValue}>{photos.length}</Text>
            <Text style={styles.summaryBarLabel}>Photos</Text>
          </View>
          <View style={styles.summaryBarItem}>
            <Text style={styles.summaryBarTotal}>₹{subtotal.toFixed(2)}</Text>
            <Text style={styles.summaryBarLabel}>Est. Subtotal</Text>
          </View>
        </View>

        {/* Action button to add more items */}
        <TouchableOpacity
          style={styles.addMoreButton}
          onPress={onAddMoreItems}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Add more items to order from catalog"
        >
          <Text style={styles.addMoreButtonText}>＋ Add More Items from Catalog</Text>
        </TouchableOpacity>

        {/* Itemized Cart List */}
        <Text style={styles.listSectionTitle}>Order Items ({items.length})</Text>

        {items.map((it, idx) => {
          const isWeight = it.weight != null && it.weight > 0;
          const multiplier = isWeight ? it.weight! : it.quantity || 1;
          const lineTotal = roundCurrency((it.unitPrice || 0) * multiplier);
          const garmentPhotos = getPhotosForGarment(it.garmentCatalogId);
          const garmentName = getGarmentName(it.garmentCatalogId);
          const serviceName = getServiceName(it.serviceTypeId);
          const pieceCount = it.quantity || 1;

          return (
            <View key={idx} style={styles.itemCard}>
              {/* Row 1: Garment Name & Line Total */}
              <View style={styles.itemHeaderRow}>
                <Text style={styles.itemName} numberOfLines={1}>
                  {garmentName}
                </Text>
                <Text style={styles.itemLineTotal}>₹{lineTotal.toFixed(2)}</Text>
              </View>

              {/* Row 2: Service Tag */}
              <View style={styles.serviceRow}>
                <Text style={styles.itemService}>{serviceName}</Text>
              </View>

              {/* Row 3: Separate Quantity Controls & Rate Metadata */}
              <View style={styles.quantityMetaRow}>
                <View style={styles.metaTextWrapper}>
                  <Text style={styles.itemMetaText}>
                    {isWeight
                      ? `${it.weight?.toFixed(2)} kg × ₹${it.unitPrice?.toFixed(2)}/kg`
                      : `${it.quantity} pc × ₹${it.unitPrice?.toFixed(2)}/pc`}
                  </Text>
                </View>

                {!isWeight && onUpdateItemQuantity ? (
                  <View style={styles.inlineStepperBox}>
                    <TouchableOpacity
                      style={styles.inlineStepperBtn}
                      onPress={() => {
                        const current = it.quantity || 1;
                        if (current <= 1) {
                          handleConfirmRemove(idx);
                        } else {
                          onUpdateItemQuantity(idx, current - 1);
                        }
                      }}
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel={`Decrease quantity of ${garmentName}`}
                    >
                      <Text style={styles.inlineStepperBtnText}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.inlineStepperQty}>{it.quantity || 1}</Text>
                    <TouchableOpacity
                      style={styles.inlineStepperBtn}
                      onPress={() => {
                        const current = it.quantity || 1;
                        onUpdateItemQuantity(idx, current + 1);
                      }}
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel={`Increase quantity of ${garmentName}`}
                    >
                      <Text style={styles.inlineStepperBtnText}>＋</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>

              {/* Defect Notes Box if present */}
              {it.defectNotes ? (
                <View style={styles.defectBox}>
                  <Text style={styles.defectBoxText}>⚠️ Defect: {it.defectNotes}</Text>
                </View>
              ) : null}

              {/* PHYSICAL PIECES SECTION (Distinguishable per physical piece) */}
              {pieceCount <= 1 ? (
                // Single piece item
                (() => {
                  const piece = it.pieces?.[0];
                  const piecePhotos = getPhotosForPiece(
                    it.garmentCatalogId,
                    1,
                    piece?.pieceId,
                    1,
                    it.id,
                  );
                  return (
                    <View style={styles.pieceSection}>
                      <View style={styles.pieceHeaderRow}>
                        <Text style={styles.pieceSectionLabel}>Intake Photos</Text>
                        <View
                          style={
                            piecePhotos.length > 0 ? styles.pieceBadgeOk : styles.pieceBadgeNeeded
                          }
                        >
                          <Text
                            style={
                              piecePhotos.length > 0
                                ? styles.pieceBadgeTextOk
                                : styles.pieceBadgeTextNeeded
                            }
                          >
                            {piecePhotos.length > 0
                              ? `✓ ${piecePhotos.length} photo${piecePhotos.length > 1 ? 's' : ''}`
                              : '⚠️ Photo needed'}
                          </Text>
                        </View>
                      </View>

                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.pieceThumbnailScroll}
                      >
                        {piecePhotos.map((photo) => (
                          <View key={photo.id} style={styles.thumbnailWrapper}>
                            <TouchableOpacity
                              onPress={() => setSelectedPreviewPhoto(photo)}
                              accessible={true}
                              accessibilityRole="button"
                              accessibilityLabel={`View attached photo for ${garmentName}`}
                            >
                              <Image
                                source={{ uri: photo.localFileUri }}
                                style={styles.thumbnailImg}
                              />
                              {photo.syncStatus === 'UPLOADED' && (
                                <View style={styles.syncStatusPill}>
                                  <Text style={styles.syncStatusPillText}>✓</Text>
                                </View>
                              )}
                              {photo.syncStatus === 'FAILED' && (
                                <View
                                  style={[styles.syncStatusPill, { backgroundColor: '#ef4444' }]}
                                >
                                  <Text style={styles.syncStatusPillText}>!</Text>
                                </View>
                              )}
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.thumbnailRemoveBtn}
                              onPress={() => handleConfirmDeletePhoto(photo)}
                              accessible={true}
                              accessibilityRole="button"
                              accessibilityLabel={`Delete photo for ${garmentName}`}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <Text style={styles.thumbnailRemoveText}>✕</Text>
                            </TouchableOpacity>
                          </View>
                        ))}

                        <TouchableOpacity
                          style={styles.addPhotoPillBtn}
                          onPress={() =>
                            setActivePhotoTarget({
                              garmentCatalogId: it.garmentCatalogId,
                              garmentName,
                              unitNumber: 1,
                              pieceId: piece?.pieceId,
                              orderItemId: it.id,
                            })
                          }
                          accessible={true}
                          accessibilityRole="button"
                          accessibilityLabel={`Add photo for ${garmentName}`}
                        >
                          <Icon
                            name="camera-outline"
                            size={17}
                            color="#2563eb"
                            style={{ marginRight: 6 }}
                          />
                          <Text style={styles.addPhotoPillText}>+ Photo</Text>
                        </TouchableOpacity>
                      </ScrollView>
                    </View>
                  );
                })()
              ) : (
                // Multi-piece item (e.g. Shirt — 2 pieces)
                <View style={styles.multiPiecesSection}>
                  <View style={styles.multiPiecesHeaderRow}>
                    <Text style={styles.multiPiecesSectionLabel}>
                      Physical Pieces ({pieceCount} pcs)
                    </Text>
                    <Text style={styles.multiPiecesSectionHint}>Individual piece photos</Text>
                  </View>

                  {Array.from({ length: pieceCount }, (_, i) => {
                    const u = i + 1;
                    const piece = it.pieces?.find((p) => p.unitNumber === u);
                    const piecePhotos = getPhotosForPiece(
                      it.garmentCatalogId,
                      u,
                      piece?.pieceId,
                      pieceCount,
                      it.id,
                    );
                    const isLast = u === pieceCount;

                    return (
                      <View
                        key={piece?.pieceId || `piece-${u}`}
                        style={[styles.pieceCardlet, isLast && styles.pieceCardletLast]}
                      >
                        <View style={styles.pieceHeaderRow}>
                          <Text style={styles.pieceTitle}>
                            Piece {u} of {pieceCount}
                          </Text>
                          <View
                            style={
                              piecePhotos.length > 0 ? styles.pieceBadgeOk : styles.pieceBadgeNeeded
                            }
                          >
                            <Text
                              style={
                                piecePhotos.length > 0
                                  ? styles.pieceBadgeTextOk
                                  : styles.pieceBadgeTextNeeded
                              }
                            >
                              {piecePhotos.length > 0
                                ? `✓ ${piecePhotos.length} photo${piecePhotos.length > 1 ? 's' : ''}`
                                : '⚠️ Photo needed'}
                            </Text>
                          </View>
                        </View>

                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={styles.pieceThumbnailScroll}
                        >
                          {piecePhotos.map((photo) => (
                            <View key={photo.id} style={styles.thumbnailWrapper}>
                              <TouchableOpacity
                                onPress={() => setSelectedPreviewPhoto(photo)}
                                accessible={true}
                                accessibilityRole="button"
                                accessibilityLabel={`View photo for ${garmentName} Piece ${u}`}
                              >
                                <Image
                                  source={{ uri: photo.localFileUri }}
                                  style={styles.thumbnailImg}
                                />
                                {photo.syncStatus === 'UPLOADED' && (
                                  <View style={styles.syncStatusPill}>
                                    <Text style={styles.syncStatusPillText}>✓</Text>
                                  </View>
                                )}
                                {photo.syncStatus === 'FAILED' && (
                                  <View
                                    style={[styles.syncStatusPill, { backgroundColor: '#ef4444' }]}
                                  >
                                    <Text style={styles.syncStatusPillText}>!</Text>
                                  </View>
                                )}
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.thumbnailRemoveBtn}
                                onPress={() => handleConfirmDeletePhoto(photo)}
                                accessible={true}
                                accessibilityRole="button"
                                accessibilityLabel={`Delete photo for ${garmentName} Piece ${u}`}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              >
                                <Text style={styles.thumbnailRemoveText}>✕</Text>
                              </TouchableOpacity>
                            </View>
                          ))}

                          <TouchableOpacity
                            style={styles.addPhotoPillBtn}
                            onPress={() =>
                              setActivePhotoTarget({
                                garmentCatalogId: it.garmentCatalogId,
                                garmentName,
                                unitNumber: u,
                                pieceId: piece?.pieceId,
                                orderItemId: it.id,
                              })
                            }
                            accessible={true}
                            accessibilityRole="button"
                            accessibilityLabel={`Add photo for ${garmentName} Piece ${u}`}
                          >
                            <Icon
                              name="camera-outline"
                              size={17}
                              color="#2563eb"
                              style={{ marginRight: 6 }}
                            />
                            <Text style={styles.addPhotoPillText}>+ Piece {u} Photo</Text>
                          </TouchableOpacity>
                        </ScrollView>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Row 4: Exactly Three Compact Actions on One Horizontal Row */}
              <View style={styles.actionButtonsRow}>
                {/* 1. Edit (Pencil Icon) — Neutral Style */}
                <TouchableOpacity
                  style={styles.editActionBtn}
                  onPress={() => onEditItem(idx)}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit details for ${garmentName}`}
                  accessibilityHint="Opens configuration for services, add-ons, defect notes, or color tags"
                >
                  <Icon name="pencil-outline" size={19} color="#475569" />
                </TouchableOpacity>

                {/* 2. Photo (Camera Icon) — Brand Blue Style with Count Badge */}
                <TouchableOpacity
                  style={[
                    styles.photoActionBtn,
                    garmentPhotos.length > 0 && styles.photoActionBtnActive,
                  ]}
                  onPress={() => {
                    if (pieceCount <= 1) {
                      setActivePhotoTarget({
                        garmentCatalogId: it.garmentCatalogId,
                        garmentName,
                        unitNumber: 1,
                        pieceId: it.pieces?.[0]?.pieceId,
                        orderItemId: it.id,
                      });
                    } else {
                      setPieceSelectorItem({
                        garmentCatalogId: it.garmentCatalogId,
                        garmentName,
                        quantity: pieceCount,
                        orderItemId: it.id,
                        pieces: Array.from({ length: pieceCount }, (_, i) => ({
                          unitNumber: i + 1,
                          pieceId: it.pieces?.find((p) => p.unitNumber === i + 1)?.pieceId,
                        })),
                      });
                    }
                  }}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={`Garment photos for ${garmentName}${
                    garmentPhotos.length > 0 ? `, ${garmentPhotos.length} attached` : ''
                  }`}
                  accessibilityHint="Opens camera or gallery to capture or view intake photos for this garment"
                >
                  <View style={styles.photoActionContent}>
                    <Icon
                      name={garmentPhotos.length > 0 ? 'camera' : 'camera-outline'}
                      size={20}
                      color={garmentPhotos.length > 0 ? '#1d4ed8' : '#2563eb'}
                    />
                    {garmentPhotos.length > 0 && (
                      <View style={styles.photoCountBadge}>
                        <Text style={styles.photoCountBadgeText}>{garmentPhotos.length}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>

                {/* 3. Remove (Trash Icon) — Restrained Danger Style */}
                <TouchableOpacity
                  style={styles.removeActionBtn}
                  onPress={() => handleConfirmRemove(idx)}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${garmentName} from cart`}
                  accessibilityHint="Removes this garment and its associated draft photos from the order"
                >
                  <Icon name="trash-outline" size={19} color="#dc2626" />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Bottom Sticky Action Bar */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomBarTotals}>
          <Text style={styles.bottomBarSubtotalLabel}>PROVISIONAL SUBTOTAL</Text>
          <Text style={styles.bottomBarSubtotalValue}>₹{subtotal.toFixed(2)}</Text>
        </View>

        <TouchableOpacity
          style={styles.continueButton}
          onPress={onContinueToFinalReview}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Review Order and continue to final checkout"
        >
          <Text style={styles.continueButtonText}>Review Order →</Text>
        </TouchableOpacity>
      </View>

      {/* Modal 1: Target Photo Action Sheet */}
      <Modal
        visible={activePhotoTarget !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setActivePhotoTarget(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setActivePhotoTarget(null)}>
          <Pressable style={styles.actionSheetCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.actionSheetHeader}>
              <Text style={styles.actionSheetTitle} numberOfLines={1}>
                {activePhotoTarget?.garmentName} Photos
              </Text>
              <TouchableOpacity
                style={styles.actionSheetCloseBtn}
                onPress={() => setActivePhotoTarget(null)}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Close photo menu"
              >
                <Text style={styles.actionSheetCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.actionSheetSubtitle}>
              Intake photo for Piece #{activePhotoTarget?.unitNumber || 1}
            </Text>

            {isCapturing ? (
              <View style={styles.capturingIndicatorBox}>
                <ActivityIndicator size="small" color="#2563eb" />
                <Text style={styles.capturingIndicatorText}>Processing photo...</Text>
              </View>
            ) : null}

            {/* Option A: Take Photo with Camera */}
            <TouchableOpacity
              style={styles.sheetOptionBtn}
              onPress={async () => {
                const target = activePhotoTarget;
                setActivePhotoTarget(null);
                if (target) await handleTakePhotoForTarget(target);
              }}
              disabled={isCapturing}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Take photo with camera"
            >
              <View style={styles.sheetOptionIconBox}>
                <Icon name="camera" size={22} color="#2563eb" />
              </View>
              <View style={styles.sheetOptionTextCol}>
                <Text style={styles.sheetOptionTitle}>Take Photo with Camera</Text>
                <Text style={styles.sheetOptionDesc}>
                  Capture intake photo for Piece #{activePhotoTarget?.unitNumber || 1}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Option B: Choose from Gallery */}
            <TouchableOpacity
              style={styles.sheetOptionBtn}
              onPress={async () => {
                const target = activePhotoTarget;
                setActivePhotoTarget(null);
                if (target) await handlePickFromGalleryForTarget(target);
              }}
              disabled={isCapturing}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Choose photo from device gallery"
            >
              <View style={[styles.sheetOptionIconBox, { backgroundColor: '#ecfeff' }]}>
                <Icon name="images-outline" size={22} color="#0891b2" />
              </View>
              <View style={styles.sheetOptionTextCol}>
                <Text style={styles.sheetOptionTitle}>Choose from Gallery</Text>
                <Text style={styles.sheetOptionDesc}>
                  Select existing photo for Piece #{activePhotoTarget?.unitNumber || 1}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Cancel Button */}
            <TouchableOpacity
              style={styles.sheetCancelBtn}
              onPress={() => setActivePhotoTarget(null)}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Cancel photo selection"
            >
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal 3: Multi-Piece Photo Selector Modal */}
      <Modal
        visible={pieceSelectorItem !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPieceSelectorItem(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setPieceSelectorItem(null)}>
          <Pressable style={styles.actionSheetCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.actionSheetHeader}>
              <Text style={styles.actionSheetTitle} numberOfLines={1}>
                Select Piece for Photo
              </Text>
              <TouchableOpacity
                style={styles.actionSheetCloseBtn}
                onPress={() => setPieceSelectorItem(null)}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Close piece selector"
              >
                <Text style={styles.actionSheetCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.actionSheetSubtitle}>
              {pieceSelectorItem?.garmentName} ({pieceSelectorItem?.quantity} pieces) — Choose which
              piece you want to take or attach a photo for:
            </Text>

            {pieceSelectorItem?.pieces.map((piece) => {
              const piecePhotos = getPhotosForPiece(
                pieceSelectorItem.garmentCatalogId,
                piece.unitNumber,
                piece.pieceId,
                pieceSelectorItem.quantity,
              );
              return (
                <TouchableOpacity
                  key={piece.unitNumber}
                  style={styles.pieceSelectItemBtn}
                  onPress={() => {
                    const sel = pieceSelectorItem;
                    setPieceSelectorItem(null);
                    setActivePhotoTarget({
                      garmentCatalogId: sel.garmentCatalogId,
                      garmentName: sel.garmentName,
                      unitNumber: piece.unitNumber,
                      pieceId: piece.pieceId,
                      orderItemId: sel.orderItemId,
                    });
                  }}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={`Select Piece ${piece.unitNumber}`}
                >
                  <View style={styles.pieceSelectIconBox}>
                    <Text style={styles.pieceSelectIconNumber}>#{piece.unitNumber}</Text>
                  </View>
                  <View style={styles.sheetOptionTextCol}>
                    <Text style={styles.sheetOptionTitle}>
                      Piece {piece.unitNumber} of {pieceSelectorItem.quantity}
                    </Text>
                    <Text style={styles.sheetOptionDesc}>
                      {piecePhotos.length > 0
                        ? `✓ ${piecePhotos.length} photo${piecePhotos.length > 1 ? 's' : ''} attached`
                        : '⚠️ No photo attached — Photo required'}
                    </Text>
                  </View>
                  <Icon name="chevron-forward" size={18} color="#94a3b8" />
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={styles.sheetCancelBtn}
              onPress={() => setPieceSelectorItem(null)}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Cancel piece selection"
            >
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal 2: Full Photo Preview & Removal */}
      <Modal
        visible={selectedPreviewPhoto !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedPreviewPhoto(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedPreviewPhoto(null)}>
          <Pressable style={styles.previewCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.previewHeaderRow}>
              <Text style={styles.previewTitle}>Photo Preview</Text>
              <TouchableOpacity
                style={styles.actionSheetCloseBtn}
                onPress={() => setSelectedPreviewPhoto(null)}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Close photo preview"
              >
                <Text style={styles.actionSheetCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedPreviewPhoto ? (
              <View style={styles.previewImageContainer}>
                <Image
                  source={{ uri: selectedPreviewPhoto.localFileUri }}
                  style={styles.previewImage}
                  resizeMode="contain"
                />
              </View>
            ) : null}

            <View style={styles.previewActionsRow}>
              <TouchableOpacity
                style={styles.previewDeleteBtn}
                onPress={() => {
                  if (selectedPreviewPhoto) {
                    const photo = selectedPreviewPhoto;
                    handleConfirmDeletePhoto(photo);
                  }
                }}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Remove photo from garment"
              >
                <Icon name="trash-outline" size={18} color="#dc2626" style={{ marginRight: 6 }} />
                <Text style={styles.previewDeleteBtnText}>Remove Photo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.previewDoneBtn}
                onPress={() => setSelectedPreviewPhoto(null)}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Done previewing photo"
              >
                <Text style={styles.previewDoneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  summaryBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  summaryBarItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#f1f5f9',
  },
  summaryBarValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  summaryBarTotal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2563eb',
  },
  summaryBarLabel: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  addMoreButton: {
    backgroundColor: '#eff6ff',
    borderWidth: 1.5,
    borderColor: '#bfdbfe',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    minHeight: 46,
  },
  addMoreButtonText: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '700',
  },
  listSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 10,
  },
  itemCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  itemHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
    marginRight: 8,
  },
  itemLineTotal: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  serviceRow: {
    marginBottom: 8,
  },
  itemService: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563eb',
  },
  quantityMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  metaTextWrapper: {
    flex: 1,
    marginRight: 8,
  },
  itemMetaText: {
    fontSize: 13.5,
    color: '#64748b',
    fontWeight: '500',
  },
  inlineStepperBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    overflow: 'hidden',
    height: 38,
  },
  inlineStepperBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  inlineStepperBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1e293b',
    lineHeight: 20,
  },
  inlineStepperQty: {
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  defectBox: {
    backgroundColor: '#fef3c7',
    padding: 8,
    borderRadius: 8,
    marginBottom: 10,
  },
  defectBoxText: {
    fontSize: 12,
    color: '#b45309',
    fontWeight: '600',
  },

  // Attached Photos Thumbnails Section
  thumbnailSection: {
    marginBottom: 12,
    paddingTop: 4,
  },
  thumbnailScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  thumbnailWrapper: {
    position: 'relative',
    width: 50,
    height: 50,
    borderRadius: 8,
    overflow: 'visible',
  },
  thumbnailImg: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  thumbnailRemoveBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  thumbnailRemoveText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 12,
  },

  // Action Buttons Row: Exactly 3 Compact Buttons on One Horizontal Row
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  editActionBtn: {
    flex: 1,
    height: 44,
    minHeight: 44,
    minWidth: 44,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoActionBtn: {
    flex: 1,
    height: 44,
    minHeight: 44,
    minWidth: 44,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoActionBtnActive: {
    backgroundColor: '#dbeafe',
    borderColor: '#93c5fd',
  },
  photoActionContent: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  photoCountBadge: {
    position: 'absolute',
    top: 5,
    right: '24%',
    backgroundColor: '#2563eb',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoCountBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  removeActionBtn: {
    flex: 1,
    height: 44,
    minHeight: 44,
    minWidth: 44,
    borderRadius: 10,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Empty Cart State
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f8fafc',
  },
  emptyEmoji: {
    fontSize: 54,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
  },
  browseButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  browseButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },

  // Bottom Sticky Bar
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    elevation: 4,
    ...Platform.select({
      web: {
        boxShadow: '0 -2px 8px rgba(0,0,0,0.05)',
      },
      default: {
        shadowColor: '#000000',
        shadowOpacity: 0.05,
        shadowOffset: { width: 0, height: -2 },
        shadowRadius: 4,
      },
    }),
  },
  bottomBarTotals: {
    flex: 1,
  },
  bottomBarSubtotalLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  bottomBarSubtotalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  continueButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },

  // Modal Overlay & Action Sheet Card
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  actionSheetCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 16,
    elevation: 8,
  },
  actionSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  actionSheetTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
    flex: 1,
    marginRight: 8,
  },
  actionSheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionSheetCloseText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '700',
  },
  actionSheetSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 16,
  },
  capturingIndicatorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    marginBottom: 8,
  },
  capturingIndicatorText: {
    fontSize: 13,
    color: '#2563eb',
    fontWeight: '600',
  },
  sheetOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10,
    minHeight: 54,
  },
  sheetOptionIconBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sheetOptionTextCol: {
    flex: 1,
  },
  sheetOptionTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0f172a',
  },
  sheetOptionDesc: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  sheetCancelBtn: {
    marginTop: 6,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    minHeight: 46,
  },
  sheetCancelText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#475569',
  },

  // Modal 2: Preview Card
  previewCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 420,
    marginBottom: 'auto',
    marginTop: 'auto',
  },
  previewHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  previewTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  previewSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 2,
  },
  previewImageContainer: {
    width: '100%',
    height: 280,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewActionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  previewDeleteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    minHeight: 46,
  },
  previewDeleteBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#dc2626',
  },
  previewDoneBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#2563eb',
    minHeight: 46,
  },
  previewDoneBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },

  // Piece Selector Modal Styles
  pieceSelectItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10,
    minHeight: 56,
  },
  pieceSelectIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  pieceSelectIconNumber: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2563eb',
  },

  // Single & Multi Piece Sections on Item Card
  pieceSection: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  pieceHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  pieceSectionLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#334155',
  },
  pieceBadgeOk: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pieceBadgeNeeded: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pieceBadgeTextOk: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803d',
  },
  pieceBadgeTextNeeded: {
    fontSize: 11,
    fontWeight: '700',
    color: '#b45309',
  },
  pieceThumbnailScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },

  // Multi-piece container
  multiPiecesSection: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  multiPiecesHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  multiPiecesSectionLabel: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0f172a',
  },
  multiPiecesSectionHint: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  pieceCardlet: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  pieceCardletLast: {
    borderBottomWidth: 0,
    paddingBottom: 2,
  },
  pieceTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1e293b',
  },

  // Compact + Photo Pill button
  addPhotoPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#93c5fd',
    borderRadius: 10,
    borderStyle: 'dashed',
  },
  addPhotoPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563eb',
  },

  // Thumbnail Sync Status Pill
  syncStatusPill: {
    position: 'absolute',
    bottom: 3,
    left: 3,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  syncStatusPillText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
    lineHeight: 11,
  },
});
