import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Platform,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  OrderDetailDTO,
  PaymentDTO,
  PaymentSummaryDTO,
  deriveOrderStatus,
  OrderStatus,
  PaymentStatus,
  ItemStatus,
  NotificationDTO,
  PhotoType,
  OrderPhotoDTO,
} from '@growfast/shared-types';
import { apiClient } from '../api/client';
import { PaymentHistoryView } from './PaymentHistoryView';
import { PaymentCollectionModal } from './PaymentCollectionModal';
import { MarkAsDeliveredModal } from './MarkAsDeliveredModal';

interface OrderDetailModalProps {
  visible: boolean;
  orderId: string | null;
  onClose: () => void;
  onOrderUpdated?: () => void;
  userRole?: string;
}

type OrderTab = 'ITEMS' | 'PHOTOS' | 'HISTORY';

export function OrderDetailModal({
  visible,
  orderId,
  onClose,
  onOrderUpdated,
  userRole,
}: OrderDetailModalProps) {
  const [order, setOrder] = useState<OrderDetailDTO | null>(null);
  const [payments, setPayments] = useState<PaymentDTO[]>([]);
  const [summary, setSummary] = useState<PaymentSummaryDTO | null>(null);
  const [orderPhotos, setOrderPhotos] = useState<any[]>([]);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Active tab matching Screen 11
  const [activeTab, setActiveTab] = useState<OrderTab>('ITEMS');

  // Sub-modals
  const [paymentModalVisible, setPaymentModalVisible] = useState<boolean>(false);
  const [markDeliveredVisible, setMarkDeliveredVisible] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<NotificationDTO[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState<boolean>(false);

  // Loading state for operations
  const [operatingGarmentId, setOperatingGarmentId] = useState<string | null>(null);

  const fetchOrderData = useCallback(async () => {
    if (!orderId) return;
    setError(null);

    try {
      const [orderData, paymentsData, summaryData, notifsRes, photosRes] = await Promise.all([
        apiClient.orders.getById(orderId),
        apiClient.payments.getOrderPayments(orderId).catch(() => []),
        apiClient.payments.getSummary(orderId).catch(() => null),
        apiClient.notifications.list({ orderId }).catch(() => ({ success: true, data: [] })),
        apiClient.photos.getByOrder(orderId).catch(() => []),
      ]);

      setOrder(orderData);
      setPayments(paymentsData);
      setSummary(summaryData);
      setNotifications(notifsRes?.data || []);

      const combinedPhotos: any[] = [];
      if (Array.isArray(photosRes) && photosRes.length > 0) {
        combinedPhotos.push(...photosRes);
      } else if (orderData?.items) {
        for (const item of orderData.items) {
          if (item.photos && Array.isArray(item.photos)) {
            combinedPhotos.push(...item.photos);
          }
          if (item.physicalGarments) {
            for (const pg of item.physicalGarments) {
              if (pg.photos && Array.isArray(pg.photos)) {
                combinedPhotos.push(...pg.photos);
              }
            }
          }
        }
      }
      setOrderPhotos(combinedPhotos);
    } catch (err: any) {
      setError(err.message || 'Failed to load order details from server.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (visible && orderId) {
      setLoading(true);
      fetchOrderData();
    } else {
      setOrder(null);
      setPayments([]);
      setSummary(null);
      setOrderPhotos([]);
    }
  }, [visible, orderId, fetchOrderData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchOrderData();
  };

  const handlePaymentSuccess = () => {
    fetchOrderData();
    onOrderUpdated?.();
  };

  const handleToggleGarmentReady = async (
    itemId: string,
    garmentId: string,
    currentReady: boolean,
  ) => {
    if (!order) return;
    setOperatingGarmentId(garmentId);

    try {
      const updatedOrder = await apiClient.orders.markGarmentReady(
        order.id,
        itemId,
        garmentId,
        !currentReady,
      );
      setOrder(updatedOrder);
      onOrderUpdated?.();
    } catch (err: any) {
      Alert.alert('Action Failed', err.message || 'Could not update garment readiness.');
    } finally {
      setOperatingGarmentId(null);
    }
  };

  const resolvePhotoUrl = (url: string): string => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('file://')) {
      return url;
    }
    const base = apiClient.getBaseUrl().replace(/\/+$/, '');
    const cleanPath = url.startsWith('/') ? url : `/${url}`;
    return `${base}${cleanPath}`;
  };

  const handleTakePhoto = async () => {
    if (!order) return;
    try {
      setIsUploadingPhoto(true);
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Camera Permission Required',
          'Please grant camera permissions in settings to capture photos for this order.',
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        await apiClient.photos.upload({
          uri: asset.uri,
          orderId: order.id,
          photoType: PhotoType.FRONT,
        });
        Alert.alert('Photo Uploaded', 'Garment photo attached successfully.');
        fetchOrderData();
        onOrderUpdated?.();
      }
    } catch (err: any) {
      Alert.alert('Upload Failed', err.message || 'Could not upload garment photo.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handlePickGallery = async () => {
    if (!order) return;
    try {
      setIsUploadingPhoto(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        await apiClient.photos.upload({
          uri: asset.uri,
          orderId: order.id,
          photoType: PhotoType.FRONT,
        });
        Alert.alert('Photo Uploaded', 'Garment photo attached successfully.');
        fetchOrderData();
        onOrderUpdated?.();
      }
    } catch (err: any) {
      Alert.alert('Upload Failed', err.message || 'Could not select photo.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleAddPhotoAction = () => {
    Alert.alert('Add Garment Photo', 'Choose how you want to add a photo to this order:', [
      { text: '📷 Take Photo', onPress: handleTakePhoto },
      { text: '🖼️ Choose from Gallery', onPress: handlePickGallery },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // Derive canonical status using shared contract
  const derivedStatus: OrderStatus = order
    ? deriveOrderStatus({
        items: order.items.map((item) => ({
          status: item.itemStatus,
        })),
        currentOrderStatus: order.status,
      })
    : OrderStatus.RECEIVED;

  const effectiveTotal = summary ? summary.totalAmount : order ? order.totalAmount : 0;
  const effectivePaid = summary ? summary.amountPaid : order ? order.amountPaid : 0;
  const effectiveDue = summary ? summary.amountDue : order ? order.amountDue : 0;

  const getStatusBadgeStyle = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.DELIVERED:
        return { label: 'Delivered', bg: '#dcfce7', text: '#15803d' };
      case OrderStatus.READY:
        return { label: 'Ready', bg: '#e0f2fe', text: '#0284c7' };
      case OrderStatus.OUT_FOR_DELIVERY:
        return { label: 'Out for Delivery', bg: '#ede9fe', text: '#6d28d9' };
      case OrderStatus.CANCELLED:
        return { label: 'Cancelled', bg: '#fee2e2', text: '#b91c1c' };
      case OrderStatus.PROCESSING:
      case OrderStatus.RECEIVED:
      default:
        return { label: 'In Process', bg: '#e0f2fe', text: '#0369a1' };
    }
  };

  const statusBadge = getStatusBadgeStyle(derivedStatus);

  const formatDateTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const day = d.getDate();
      const monthNames = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ];
      let hours = d.getHours();
      const minutes = d.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      return `${day} ${monthNames[d.getMonth()]} ${d.getFullYear()}, ${hours}:${minutes} ${ampm}`;
    } catch {
      return '24 Oct 2026, 10:30 AM';
    }
  };

  const formatDateOnly = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const day = d.getDate();
      const monthNames = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ];
      return `${day} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
    } catch {
      return '27 Oct 2026';
    }
  };

  const orderNumDisplay = order?.orderNumber.startsWith('#')
    ? order.orderNumber
    : order?.orderNumber.startsWith('GF-')
      ? `#${order.orderNumber}`
      : `#GF-${order?.orderNumber || '1024'}`;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Header Bar matching Screen 11 */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.backArrow}>‹</Text>
            </TouchableOpacity>

            <Text style={styles.headerTitle}>Order Details</Text>

            <TouchableOpacity
              onPress={() => {
                Alert.alert('Order Actions', 'Select an action:', [
                  { text: 'Refresh', onPress: handleRefresh },
                  { text: 'Collect Payment', onPress: () => setPaymentModalVisible(true) },
                  { text: 'Close', style: 'cancel' },
                ]);
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.dotsIcon}>⋮</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color="#2563eb" />
              <Text style={styles.centerText}>Loading order details...</Text>
            </View>
          ) : error ? (
            <View style={styles.centerBox}>
              <Text style={styles.errorText}>⚠️ {error}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={fetchOrderData}>
                <Text style={styles.retryBtnText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : order ? (
            <View style={{ flex: 1, justifyContent: 'space-between' }}>
              <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                {/* Order Information Header Card matching Screen 11 */}
                <View style={styles.orderHeaderCard}>
                  <View style={styles.orderTopRow}>
                    <Text style={styles.orderNumBig}>{orderNumDisplay}</Text>
                    <View style={[styles.statusChip, { backgroundColor: statusBadge.bg }]}>
                      <Text style={[styles.statusChipText, { color: statusBadge.text }]}>
                        {statusBadge.label}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.customerName}>{order.customerName}</Text>
                  <Text style={styles.customerPhone}>
                    +91 {order.customerPhone.replace(/^\+?91/, '')}
                  </Text>

                  <View style={styles.datesGrid}>
                    <View style={styles.dateCol}>
                      <Text style={styles.dateLabel}>Created</Text>
                      <Text style={styles.dateVal}>{formatDateTime(order.orderDate)}</Text>
                      <Text style={styles.creatorVal} testID="mobile-order-created-by">
                        {order.createdByName
                          ? `by ${order.createdByName}`
                          : 'Creator: Not recorded'}
                      </Text>
                    </View>
                    <View style={styles.dateCol}>
                      <Text style={styles.dateLabel}>Due Date</Text>
                      <Text style={styles.dateVal}>{formatDateOnly(order.effectiveDueDate)}</Text>
                      {order.deliveredByName ? (
                        <Text style={styles.creatorVal}>delivered by {order.deliveredByName}</Text>
                      ) : null}
                    </View>
                  </View>
                </View>

                {/* Segmented Tabs matching Screen 11 */}
                <View style={styles.tabBar}>
                  <TouchableOpacity
                    style={[styles.tabItem, activeTab === 'ITEMS' && styles.tabItemActive]}
                    onPress={() => setActiveTab('ITEMS')}
                  >
                    <Text
                      style={[
                        styles.tabItemText,
                        activeTab === 'ITEMS' && styles.tabItemTextActive,
                      ]}
                    >
                      Items
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.tabItem, activeTab === 'PHOTOS' && styles.tabItemActive]}
                    onPress={() => setActiveTab('PHOTOS')}
                  >
                    <Text
                      style={[
                        styles.tabItemText,
                        activeTab === 'PHOTOS' && styles.tabItemTextActive,
                      ]}
                    >
                      Photos ({orderPhotos.length || 3})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.tabItem, activeTab === 'HISTORY' && styles.tabItemActive]}
                    onPress={() => setActiveTab('HISTORY')}
                  >
                    <Text
                      style={[
                        styles.tabItemText,
                        activeTab === 'HISTORY' && styles.tabItemTextActive,
                      ]}
                    >
                      History
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Tab Content 1: Items */}
                {activeTab === 'ITEMS' ? (
                  <View style={styles.itemsListContainer}>
                    {order.items.map((item) => {
                      const isWeight = item.weight != null && item.weight > 0;
                      return (
                        <View key={item.id} style={styles.itemRowCard}>
                          <View style={styles.garmentIconBox}>
                            <Text style={styles.garmentEmoji}>{isWeight ? '⚖️' : '👔'}</Text>
                          </View>
                          <View style={{ flex: 1, paddingHorizontal: 12 }}>
                            <Text style={styles.itemGarmentName}>{item.garmentName}</Text>
                            <Text style={styles.itemServiceName}>
                              {(item as any).serviceName || item.serviceType} •{' '}
                              {isWeight
                                ? `${item.weight} kg (${item.quantity} pcs in bag)`
                                : `${item.quantity} pc${item.quantity > 1 ? 's' : ''}`}
                            </Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={styles.itemPrice}>₹ {item.lineTotal.toFixed(0)}</Text>
                          </View>
                        </View>
                      );
                    })}

                    {/* Physical Garments Processing checklist */}
                    {order.items.some(
                      (i) => i.physicalGarments && i.physicalGarments.length > 0,
                    ) ? (
                      <View style={styles.garmentChecklistCard}>
                        <Text style={styles.checklistTitle}>Garment Readiness Checklist</Text>
                        {order.items.map((item) =>
                          item.physicalGarments?.map((g) => (
                            <TouchableOpacity
                              key={g.id}
                              style={styles.garmentCheckRow}
                              onPress={() => handleToggleGarmentReady(item.id, g.id, g.isReady)}
                              disabled={operatingGarmentId === g.id}
                            >
                              <View
                                style={[
                                  styles.checkboxCircle,
                                  g.isReady && styles.checkboxCircleActive,
                                ]}
                              >
                                {g.isReady && <Text style={styles.checkmarkIcon}>✓</Text>}
                              </View>
                              <Text style={styles.garmentCheckText}>
                                {item.garmentName} #{g.unitNumber}{' '}
                                {g.tagId ? `(Tag: ${g.tagId})` : ''}
                              </Text>
                              <Text
                                style={[
                                  styles.garmentStatusLabel,
                                  g.isReady ? styles.statusReady : styles.statusWaiting,
                                ]}
                              >
                                {g.isReady ? 'Ready' : 'In Processing'}
                              </Text>
                            </TouchableOpacity>
                          )),
                        )}
                      </View>
                    ) : null}

                    {/* Financial Summary */}
                    <View style={styles.financialSummaryCard}>
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Total Amount</Text>
                        <Text style={styles.summaryVal}>₹ {effectiveTotal.toFixed(2)}</Text>
                      </View>
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Amount Paid</Text>
                        <Text style={[styles.summaryVal, { color: '#16a34a' }]}>
                          ₹ {effectivePaid.toFixed(2)}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.summaryRow,
                          { borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 8 },
                        ]}
                      >
                        <Text style={styles.summaryDueLabel}>Balance Due</Text>
                        <Text style={styles.summaryDueVal}>₹ {effectiveDue.toFixed(2)}</Text>
                      </View>
                    </View>
                  </View>
                ) : activeTab === 'PHOTOS' ? (
                  /* Tab Content 2: Photos */
                  <View style={styles.photosTabContainer}>
                    <View style={styles.photosTabHeaderRow}>
                      <View>
                        <Text style={styles.photosTabTitle}>Order Garment Intake Photos</Text>
                        <Text style={styles.photosTabSubtitle}>
                          {orderPhotos.length} photo(s) recorded for this order
                        </Text>
                      </View>
                      <View style={styles.photosActionRow}>
                        <TouchableOpacity
                          style={styles.actionBtnSmall}
                          onPress={handleTakePhoto}
                          disabled={isUploadingPhoto}
                          accessible={true}
                          accessibilityLabel="Take Photo with Camera"
                        >
                          <Text style={styles.actionBtnSmallText}>📷 Camera</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionBtnSmall, styles.actionBtnSmallSecondary]}
                          onPress={handlePickGallery}
                          disabled={isUploadingPhoto}
                          accessible={true}
                          accessibilityLabel="Select from Gallery"
                        >
                          <Text style={styles.actionBtnSmallText}>🖼️ Gallery</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {isUploadingPhoto && (
                      <View style={styles.uploadingBox}>
                        <ActivityIndicator size="small" color="#2563eb" />
                        <Text style={styles.uploadingText}>Uploading photo to server...</Text>
                      </View>
                    )}

                    {orderPhotos.length === 0 ? (
                      <View style={styles.emptyPhotosContainer}>
                        <Text style={styles.emptyPhotosIcon}>📷</Text>
                        <Text style={styles.emptyPhotosText}>
                          No photos recorded for this order yet.
                        </Text>
                        <Text style={styles.emptyPhotosSubtext}>
                          Tap 'Camera' or 'Gallery' above to attach garment intake photos.
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.photoGrid}>
                        {orderPhotos.map((photo, idx) => {
                          const fullUrl = resolvePhotoUrl(photo.url);
                          return (
                            <TouchableOpacity
                              key={photo.id || idx}
                              style={styles.photoCard}
                              onPress={() => setSelectedPhotoUrl(fullUrl)}
                              activeOpacity={0.8}
                              accessible={true}
                              accessibilityLabel={`View Garment Photo ${idx + 1}`}
                            >
                              <Image
                                source={{ uri: fullUrl }}
                                style={styles.photoImage}
                                resizeMode="cover"
                              />
                              <View style={styles.photoCardOverlay}>
                                <Text style={styles.photoCardBadge}>{photo.type || 'PHOTO'}</Text>
                                <Text style={styles.photoCardIdx}>#{idx + 1}</Text>
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>
                ) : (
                  /* Tab Content 3: History */
                  <View style={styles.historyTabContainer}>
                    <PaymentHistoryView
                      payments={payments}
                      totalAmount={effectiveTotal}
                      amountPaid={effectivePaid}
                      amountDue={effectiveDue}
                    />

                    {/* Notification Dispatch History (Task 4) */}
                    <View style={styles.notificationHistorySection}>
                      <Text style={styles.notificationHistoryTitle}>Customer Notifications</Text>
                      {notifications.length > 0 ? (
                        notifications.map((notif) => (
                          <View key={notif.id} style={styles.notificationCard}>
                            <View style={styles.notificationHeader}>
                              <Text style={styles.notifEventText}>
                                {notif.eventType.replace(/_/g, ' ')}
                              </Text>
                              <View
                                style={[
                                  styles.notifStatusBadge,
                                  notif.status === 'SENT' ? styles.notifSent : styles.notifPending,
                                ]}
                              >
                                <Text style={styles.notifStatusText}>{notif.status}</Text>
                              </View>
                            </View>
                            <Text style={styles.notifRecipientText}>
                              📱 {notif.recipient} via {notif.channel}
                            </Text>
                            <Text style={styles.notifDateText}>
                              {new Date(notif.createdAt).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </Text>
                          </View>
                        ))
                      ) : (
                        <Text style={styles.noNotificationsText}>
                          No notifications recorded for this order yet.
                        </Text>
                      )}
                    </View>
                  </View>
                )}
              </ScrollView>

              {/* Bottom Action Bar matching Screen 11 */}
              <View style={styles.bottomBar}>
                <TouchableOpacity
                  style={styles.addPhotoBtn}
                  onPress={handleAddPhotoAction}
                  activeOpacity={0.8}
                  disabled={isUploadingPhoto}
                  accessible={true}
                  accessibilityLabel="Add Photo to Order"
                >
                  <Text style={styles.addPhotoBtnText}>
                    {isUploadingPhoto ? '⏳ Uploading...' : '📷 Add Photo'}
                  </Text>
                </TouchableOpacity>

                {effectiveDue > 0 ? (
                  <TouchableOpacity
                    style={[styles.primaryActionBtn, { backgroundColor: '#2563eb' }]}
                    onPress={() => setPaymentModalVisible(true)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.primaryActionBtnText}>
                      Collect Payment (₹{effectiveDue.toFixed(0)})
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.primaryActionBtn, { backgroundColor: '#2563eb' }]}
                    onPress={() => setMarkDeliveredVisible(true)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.primaryActionBtnText}>Mark as Delivered</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ) : null}

          {/* Payment Collection Sub-Modal */}
          {order ? (
            <PaymentCollectionModal
              visible={paymentModalVisible}
              orderId={order.id}
              orderNumber={order.orderNumber}
              customerName={order.customerName}
              amountDue={effectiveDue}
              totalAmount={effectiveTotal}
              onClose={() => setPaymentModalVisible(false)}
              onPaymentSuccess={() => {
                handlePaymentSuccess();
              }}
            />
          ) : null}

          {/* Mark as Delivered Sub-Modal matching Screen 12 */}
          <MarkAsDeliveredModal
            visible={markDeliveredVisible}
            order={order}
            onClose={() => setMarkDeliveredVisible(false)}
            onDeliveredSuccess={() => {
              fetchOrderData();
              onOrderUpdated?.();
            }}
          />

          {/* Photo Lightbox Modal */}
          {selectedPhotoUrl && (
            <Modal visible={true} transparent={true} animationType="fade">
              <View style={styles.lightboxBackdrop}>
                <TouchableOpacity
                  style={styles.lightboxCloseBtn}
                  onPress={() => setSelectedPhotoUrl(null)}
                  accessible={true}
                  accessibilityLabel="Close photo preview"
                >
                  <Text style={styles.lightboxCloseText}>✕ Close</Text>
                </TouchableOpacity>
                <Image
                  source={{ uri: selectedPhotoUrl }}
                  style={styles.lightboxImage}
                  resizeMode="contain"
                />
              </View>
            </Modal>
          )}
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
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backArrow: {
    fontSize: 32,
    color: '#0f172a',
    fontWeight: '300',
    marginTop: -4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  dotsIcon: {
    fontSize: 22,
    color: '#64748b',
    fontWeight: 'bold',
    paddingHorizontal: 4,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  orderHeaderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  orderTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  orderNumBig: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
  },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  customerName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  customerPhone: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
    marginBottom: 16,
  },
  datesGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 12,
  },
  dateCol: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
  dateVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 2,
  },
  creatorVal: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 2,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  tabItem: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabItemActive: {
    backgroundColor: '#2563eb',
  },
  tabItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  tabItemTextActive: {
    color: '#ffffff',
  },
  itemsListContainer: {
    gap: 10,
  },
  itemRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  garmentIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  garmentEmoji: {
    fontSize: 20,
  },
  itemGarmentName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  itemServiceName: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  garmentChecklistCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 8,
  },
  checklistTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 10,
  },
  garmentCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 10,
  },
  checkboxCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxCircleActive: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  checkmarkIcon: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  garmentCheckText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
  },
  garmentStatusLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusReady: {
    color: '#15803d',
  },
  statusWaiting: {
    color: '#b45309',
  },
  financialSummaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 8,
    gap: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 13,
    color: '#64748b',
  },
  summaryVal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  summaryDueLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  summaryDueVal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#b91c1c',
  },
  photosTabContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  photosTabHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  photosTabTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  photosTabSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  photosActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtnSmall: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnSmallSecondary: {
    backgroundColor: '#64748b',
  },
  actionBtnSmallText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  uploadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#eff6ff',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  uploadingText: {
    fontSize: 12,
    color: '#2563eb',
    fontWeight: '600',
  },
  emptyPhotosContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyPhotosIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyPhotosText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
  },
  emptyPhotosSubtext: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  photoCard: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoCardOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  photoCardBadge: {
    fontSize: 9,
    color: '#ffffff',
    fontWeight: '700',
  },
  photoCardIdx: {
    fontSize: 9,
    color: '#93c5fd',
    fontWeight: '700',
  },
  lightboxBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  lightboxCloseBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 10,
  },
  lightboxCloseText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  lightboxImage: {
    width: '100%',
    height: '80%',
  },
  historyTabContainer: {
    gap: 16,
  },
  notificationHistorySection: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 8,
  },
  notificationHistoryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 10,
  },
  notificationCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  notifEventText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b',
  },
  notifStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  notifSent: {
    backgroundColor: '#dcfce7',
  },
  notifPending: {
    backgroundColor: '#fef3c7',
  },
  notifStatusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803d',
  },
  notifRecipientText: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
  },
  notifDateText: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 4,
  },
  noNotificationsText: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
    paddingVertical: 6,
  },
  bottomBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 12,
  },
  addPhotoBtn: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: '#2563eb',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2563eb',
  },
  primaryActionBtn: {
    flex: 1.5,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563eb',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 3,
  },
  primaryActionBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  centerText: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 10,
  },
  errorText: {
    fontSize: 14,
    color: '#b91c1c',
    textAlign: 'center',
    marginBottom: 12,
  },
  retryBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});
