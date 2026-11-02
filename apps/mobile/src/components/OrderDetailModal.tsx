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
import { useTheme } from '../contexts/ThemeContext';

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
  const { colors, isDark } = useTheme();
  const [order, setOrder] = useState<OrderDetailDTO | null>(null);
  const [payments, setPayments] = useState<PaymentDTO[]>([]);
  const [summary, setSummary] = useState<PaymentSummaryDTO | null>(null);
  const [orderPhotos, setOrderPhotos] = useState<any[]>([]);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);
  const [lightboxPhotos, setLightboxPhotos] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number>(0);
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

      const photosMap = new Map<string, any>();
      if (Array.isArray(photosRes)) {
        for (const p of photosRes) {
          if (p && (p.id || p.url)) {
            photosMap.set(p.id || p.url, p);
          }
        }
      }
      if (orderData?.items) {
        for (const item of orderData.items) {
          if (Array.isArray(item.photos)) {
            for (const p of item.photos) {
              const key = p?.id || p?.url;
              if (key) {
                const existing = photosMap.get(key) || {};
                photosMap.set(key, { ...existing, ...p, orderItemId: item.id });
              }
            }
          }
          if (Array.isArray(item.physicalGarments)) {
            for (const pg of item.physicalGarments) {
              if (Array.isArray(pg.photos)) {
                for (const p of pg.photos) {
                  const key = p?.id || p?.url;
                  if (key) {
                    const existing = photosMap.get(key) || {};
                    photosMap.set(key, {
                      ...existing,
                      ...p,
                      orderItemId: item.id,
                      physicalGarmentId: pg.id,
                    });
                  }
                }
              }
            }
          }
        }
      }
      setOrderPhotos(Array.from(photosMap.values()));
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

  const openLightbox = (photoUrls: string[], initialIndex: number = 0) => {
    if (!photoUrls || photoUrls.length === 0) return;
    const resolvedUrls = photoUrls.map((u) => resolvePhotoUrl(u));
    setLightboxPhotos(resolvedUrls);
    const validIndex = Math.max(0, Math.min(initialIndex, resolvedUrls.length - 1));
    setLightboxIndex(validIndex);
    setSelectedPhotoUrl(resolvedUrls[validIndex]);
  };

  const handleNextPhoto = () => {
    if (lightboxIndex < lightboxPhotos.length - 1) {
      const nextIdx = lightboxIndex + 1;
      setLightboxIndex(nextIdx);
      setSelectedPhotoUrl(lightboxPhotos[nextIdx]);
    }
  };

  const handlePrevPhoto = () => {
    if (lightboxIndex > 0) {
      const prevIdx = lightboxIndex - 1;
      setLightboxIndex(prevIdx);
      setSelectedPhotoUrl(lightboxPhotos[prevIdx]);
    }
  };

  const handleViewInPhotosTab = () => {
    setSelectedPhotoUrl(null);
    setLightboxPhotos([]);
    setActiveTab('PHOTOS');
  };

  const getItemPhotos = (item: any): any[] => {
    const seen = new Set<string>();
    const result: any[] = [];

    const addPhoto = (p: any) => {
      if (!p) return;
      const key = p.id || p.url;
      if (key && !seen.has(key)) {
        seen.add(key);
        result.push(p);
      }
    };

    // 1. Photos directly on item
    if (Array.isArray(item.photos)) {
      item.photos.forEach(addPhoto);
    }

    // 2. Photos on physical garments of this item
    if (Array.isArray(item.physicalGarments)) {
      const pgIds = new Set(item.physicalGarments.map((pg: any) => pg.id));
      item.physicalGarments.forEach((pg: any) => {
        if (Array.isArray(pg.photos)) {
          pg.photos.forEach(addPhoto);
        }
      });

      orderPhotos.forEach((p) => {
        if (p.physicalGarmentId && pgIds.has(p.physicalGarmentId)) {
          addPhoto(p);
        }
      });
    }

    // 3. Photos in orderPhotos with orderItemId === item.id
    orderPhotos.forEach((p) => {
      if (p.orderItemId === item.id) {
        addPhoto(p);
      }
    });

    // 4. Single-item order: order-level photos belong to this item
    if (order && order.items && order.items.length === 1) {
      orderPhotos.forEach((p) => {
        if (!p.orderItemId && !p.physicalGarmentId) {
          addPhoto(p);
        }
      });
    }

    return result;
  };

  const getGarmentPhotos = (garmentId: string, item?: any, g?: any): any[] => {
    const seen = new Set<string>();
    const result: any[] = [];

    const addPhoto = (p: any) => {
      if (!p) return;
      const key = p.id || p.url;
      if (key && !seen.has(key)) {
        seen.add(key);
        result.push(p);
      }
    };

    // 1. Direct piece-specific photos from physical garment object
    if (g && Array.isArray(g.photos)) {
      g.photos.forEach(addPhoto);
    }

    // 2. Search through order.items for the garment if g was not provided or has no photos
    if (result.length === 0 && order && Array.isArray(order.items)) {
      for (const it of order.items) {
        if (Array.isArray(it.physicalGarments)) {
          const pg = it.physicalGarments.find((candidate: any) => candidate.id === garmentId);
          if (pg && Array.isArray(pg.photos)) {
            pg.photos.forEach(addPhoto);
          }
        }
      }
    }

    // 3. Search orderPhotos for photos directly tagged with physicalGarmentId
    orderPhotos.forEach((p) => {
      if (p.physicalGarmentId === garmentId) {
        addPhoto(p);
      }
    });

    // 4. Resolve the target parent item and unitNumber
    const targetItem =
      item ||
      (order?.items
        ? order.items.find((it: any) =>
            Array.isArray(it.physicalGarments) &&
            it.physicalGarments.some((cand: any) => cand.id === garmentId),
          )
        : null);

    const resolvedG =
      g ||
      (targetItem && Array.isArray(targetItem.physicalGarments)
        ? targetItem.physicalGarments.find((cand: any) => cand.id === garmentId)
        : null);

    const unitNum = resolvedG?.unitNumber;

    if (targetItem) {
      if (unitNum != null) {
        // Photos explicitly tagged with unitNumber or pieceNumber
        orderPhotos.forEach((p) => {
          if (
            p.orderItemId === targetItem.id &&
            (p.unitNumber === unitNum ||
              p.pieceNumber === unitNum ||
              (p as any).pieceIndex === unitNum - 1)
          ) {
            addPhoto(p);
          }
        });

        if (Array.isArray(targetItem.photos)) {
          targetItem.photos.forEach((p: any) => {
            if (
              p.unitNumber === unitNum ||
              p.pieceNumber === unitNum ||
              p.pieceIndex === unitNum - 1
            ) {
              addPhoto(p);
            }
          });
        }
      }

      // 5. Fallback to item-level intake photos if this piece has no piece-specific photos
      if (result.length === 0) {
        const itemPhotos = getItemPhotos(targetItem);
        if (itemPhotos.length > 0) {
          if (unitNum != null && itemPhotos[unitNum - 1]) {
            // If item has a photo corresponding to this piece index, use it
            addPhoto(itemPhotos[unitNum - 1]);
          } else {
            // Otherwise, fallback to the item's primary intake photo (e.g. 1 photo taken for the entire bundle)
            addPhoto(itemPhotos[0]);
          }
        }
      }
    }

    // 6. Single-item order fallback: order-level photo
    if (result.length === 0 && orderPhotos.length > 0 && order?.items?.length === 1) {
      addPhoto(orderPhotos[0]);
    }

    return result;
  };

  const handleTakePhoto = async (target?: { orderItemId?: string; physicalGarmentId?: string }) => {
    if (!order || isUploadingPhoto) return;
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
          orderItemId: target?.orderItemId,
          physicalGarmentId: target?.physicalGarmentId,
          photoType: PhotoType.FRONT,
        });
        Alert.alert('Photo Uploaded', 'Garment photo attached successfully.');
        await fetchOrderData();
        onOrderUpdated?.();
      }
    } catch (err: any) {
      Alert.alert('Upload Failed', err.message || 'Could not upload garment photo.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handlePickGallery = async (target?: {
    orderItemId?: string;
    physicalGarmentId?: string;
  }) => {
    if (!order || isUploadingPhoto) return;
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
          orderItemId: target?.orderItemId,
          physicalGarmentId: target?.physicalGarmentId,
          photoType: PhotoType.FRONT,
        });
        Alert.alert('Photo Uploaded', 'Garment photo attached successfully.');
        await fetchOrderData();
        onOrderUpdated?.();
      }
    } catch (err: any) {
      Alert.alert('Upload Failed', err.message || 'Could not select photo.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleAddPhotoAction = (target?: { orderItemId?: string; physicalGarmentId?: string }) => {
    Alert.alert('Add Garment Photo', 'Choose how you want to add a photo to this order:', [
      { text: '📷 Take Photo', onPress: () => handleTakePhoto(target) },
      { text: '🖼️ Choose from Gallery', onPress: () => handlePickGallery(target) },
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
        return { label: 'Delivered', bg: '#dcfce7', text: '#15803d', dot: '#15803d' };
      case OrderStatus.READY:
        return { label: 'Ready', bg: '#eff6ff', text: '#1765f5', dot: '#1765f5' };
      case OrderStatus.OUT_FOR_DELIVERY:
        return { label: 'Out for Delivery', bg: '#ede9fe', text: '#6d28d9', dot: '#6d28d9' };
      case OrderStatus.CANCELLED:
        return { label: 'Cancelled', bg: '#fee2e2', text: '#b91c1c', dot: '#b91c1c' };
      case OrderStatus.PROCESSING:
      case OrderStatus.RECEIVED:
      default:
        return { label: 'In Process', bg: '#eff6ff', text: '#0284c7', dot: '#0284c7' };
    }
  };

  const statusBadge = getStatusBadgeStyle(derivedStatus);

  const getRelativeDueText = (dueDateStr?: string) => {
    if (!dueDateStr) return '';
    try {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const due = new Date(dueDateStr);
      due.setHours(0, 0, 0, 0);
      const diffTime = due.getTime() - now.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays === 0) return '(Today)';
      if (diffDays === 1) return '(Tomorrow)';
      if (diffDays > 1) return `(${diffDays} days left)`;
      if (diffDays === -1) return '(1 day overdue)';
      return `(${Math.abs(diffDays)} days overdue)`;
    } catch {
      return '';
    }
  };

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

  const totalGarments = order?.items
    ? order.items.reduce((s, it) => s + (it.physicalGarments?.length || 0), 0)
    : 0;
  const readyGarments = order?.items
    ? order.items.reduce(
        (s, it) => s + (it.physicalGarments?.filter((g) => Boolean(g.isReady)).length || 0),
        0,
      )
    : 0;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.surface }]}>
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          {/* Header Bar matching Screen 11 */}
          <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.headerBackBtn}
            >
              <Text style={[styles.backArrow, { color: colors.primary }]}>‹</Text>
              <Text style={[styles.backBtnText, { color: colors.primary }]}>Back</Text>
            </TouchableOpacity>

            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Order Details</Text>

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
              <Text style={[styles.dotsIcon, { color: colors.textSecondary }]}>⋮</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.centerText, { color: colors.textSecondary }]}>Loading order details...</Text>
            </View>
          ) : error ? (
            <View style={styles.centerBox}>
              <Text style={styles.errorText}>⚠️ {error}</Text>
              <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={fetchOrderData}>
                <Text style={styles.retryBtnText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : order ? (
            <View style={{ flex: 1, justifyContent: 'space-between' }}>
              <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                {/* Order Information Header Card matching Screen 11 / Screenshot 9 */}
                <View style={[styles.orderHeaderCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  {/* Order Number & Status Row */}
                  <View style={styles.orderTopRow}>
                    <View style={styles.orderIconAndNumberGroup}>
                      <View style={[styles.orderDocSquircle, { backgroundColor: colors.primaryBg }]}>
                        <Text style={{ fontSize: 20 }}>🧾</Text>
                      </View>
                      <View>
                        <Text style={[styles.orderNumLabel, { color: colors.textSecondary }]}>Order Number</Text>
                        <Text style={[styles.orderNumBig, { color: colors.textPrimary }]}>{orderNumDisplay}</Text>
                      </View>
                    </View>
                    <View style={[styles.statusChip, { backgroundColor: statusBadge.bg }]}>
                      <View style={[styles.statusDot, { backgroundColor: statusBadge.dot }]} />
                      <Text style={[styles.statusChipText, { color: statusBadge.text }]}>
                        {statusBadge.label}
                      </Text>
                    </View>
                  </View>

                  {/* Customer Information Row */}
                  <TouchableOpacity
                    style={[styles.customerRowCard, { backgroundColor: colors.surface, borderTopColor: colors.border }]}
                    activeOpacity={0.7}
                    onPress={() => {
                      // Customer info preview
                    }}
                  >
                    <View style={[styles.customerAvatarCircle, { backgroundColor: colors.primaryLight }]}>
                      <Text style={[styles.customerAvatarText, { color: colors.primary }]}>
                        {order.customerName
                          ? order.customerName
                              .trim()
                              .split(/\s+/)
                              .slice(0, 2)
                              .map((p) => p[0]?.toUpperCase())
                              .join('')
                          : 'CU'}
                      </Text>
                    </View>
                    <View style={{ flex: 1, paddingHorizontal: 10 }}>
                      <Text style={[styles.customerName, { color: colors.textPrimary }]} numberOfLines={1} ellipsizeMode="tail">
                        {order.customerName}
                      </Text>
                      <Text style={[styles.customerPhone, { color: colors.textSecondary }]} numberOfLines={1} ellipsizeMode="tail">
                        📞 +91 {order.customerPhone ? order.customerPhone.replace(/^\+?91/, '') : ''}
                      </Text>
                      <Text style={[styles.customerCode, { color: colors.textMuted }]} numberOfLines={1} ellipsizeMode="tail">
                        🪪 ID: {order.customerCode || `CUS-${(order.customerId || '').replace(/\D/g, '').slice(-6).padStart(6, '0') || '000078'}`}
                      </Text>
                    </View>
                    <Text style={[styles.customerChevron, { color: colors.textMuted }]}>›</Text>
                  </TouchableOpacity>

                  {/* Dates Grid */}
                  <View style={[styles.datesGrid, { borderTopColor: colors.border }]}>
                    <View style={[styles.dateCol, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                      <View style={styles.dateLabelRow}>
                        <Text style={{ fontSize: 13, marginRight: 4 }}>📅</Text>
                        <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>Created On</Text>
                      </View>
                      <Text style={[styles.dateVal, { color: colors.textPrimary }]}>{formatDateTime(order.orderDate)}</Text>
                      <Text style={[styles.creatorVal, { color: colors.textSecondary }]} testID="mobile-order-created-by">
                        {order.createdByName
                          ? `by ${order.createdByName}`
                          : 'Creator: Not recorded'}
                      </Text>
                    </View>
                    <View style={[styles.dateCol, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                      <View style={styles.dateLabelRow}>
                        <Text style={{ fontSize: 13, marginRight: 4 }}>📅</Text>
                        <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>Due Date</Text>
                      </View>
                      <Text style={[styles.dateVal, { color: colors.textPrimary }]}>{formatDateOnly(order.effectiveDueDate)}</Text>
                      <Text style={[styles.dueRemainingVal, { color: colors.textSecondary }]}>
                        {getRelativeDueText(order.effectiveDueDate)}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Segmented Tabs matching Screen 11 / Screenshot 9 */}
                <View style={[styles.tabBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <TouchableOpacity
                    style={[styles.tabItem, activeTab === 'ITEMS' && [styles.tabItemActive, { backgroundColor: colors.primary }]]}
                    onPress={() => setActiveTab('ITEMS')}
                  >
                    <Text
                      style={[
                        styles.tabItemText,
                        { color: colors.textSecondary },
                        activeTab === 'ITEMS' && styles.tabItemTextActive,
                      ]}
                    >
                      👕 Items ({order.items.length})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.tabItem, activeTab === 'PHOTOS' && [styles.tabItemActive, { backgroundColor: colors.primary }]]}
                    onPress={() => setActiveTab('PHOTOS')}
                  >
                    <Text
                      style={[
                        styles.tabItemText,
                        { color: colors.textSecondary },
                        activeTab === 'PHOTOS' && styles.tabItemTextActive,
                      ]}
                    >
                      🖼 Photos ({orderPhotos.length})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.tabItem, activeTab === 'HISTORY' && [styles.tabItemActive, { backgroundColor: colors.primary }]]}
                    onPress={() => setActiveTab('HISTORY')}
                  >
                    <Text
                      style={[
                        styles.tabItemText,
                        { color: colors.textSecondary },
                        activeTab === 'HISTORY' && styles.tabItemTextActive,
                      ]}
                    >
                      ⏱ History
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Tab Content 1: Items */}
                {activeTab === 'ITEMS' ? (
                  <View style={styles.itemsListContainer}>
                    {order.items.map((item) => {
                      const isWeight = item.weight != null && item.weight > 0;
                      const itemPhotos = getItemPhotos(item);
                      const maxThumbnails = 3;
                      const visibleThumbnails = itemPhotos.slice(0, maxThumbnails);
                      const extraPhotosCount = Math.max(0, itemPhotos.length - maxThumbnails);

                      return (
                        <View key={item.id} style={[styles.itemRowCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                          <View style={styles.itemMainRow}>
                            <View style={[styles.garmentIconBox, { backgroundColor: colors.primaryBg }]}>
                              <Text style={styles.garmentEmoji}>{isWeight ? '⚖️' : '👔'}</Text>
                            </View>
                            <View style={{ flex: 1, paddingHorizontal: 12 }}>
                              <Text style={[styles.itemGarmentName, { color: colors.textPrimary }]}>{item.garmentName}</Text>
                              <Text style={[styles.itemServiceName, { color: colors.textSecondary }]}>
                                {((item as any).serviceName || item.serviceType || 'DRY_CLEAN').toUpperCase()} •{' '}
                                {isWeight
                                  ? `${item.weight} kg (${item.quantity} pcs in bag)`
                                  : `${item.quantity} pc${item.quantity > 1 ? 's' : ''}`}
                              </Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text style={[styles.itemPrice, { color: colors.textPrimary }]}>₹ {item.lineTotal.toFixed(0)}</Text>
                              <Text style={[styles.itemChevronIcon, { color: colors.textSecondary }]}>^</Text>
                            </View>
                          </View>

                          {/* Compact Photo Preview Strip */}
                          <View style={[styles.itemPhotoStripContainer, { borderTopColor: colors.border }]}>
                            {itemPhotos.length > 0 ? (
                              <View>
                                <View style={styles.itemThumbnailsRow}>
                                  {visibleThumbnails.map((photo, phIdx) => {
                                    const fullUrl = resolvePhotoUrl(photo.url);
                                    return (
                                      <TouchableOpacity
                                        key={photo.id || phIdx}
                                        style={styles.compactThumbBtn}
                                        onPress={() =>
                                          openLightbox(
                                            itemPhotos.map((p) => p.url),
                                            phIdx,
                                          )
                                        }
                                        accessible={true}
                                        accessibilityLabel={`View photo ${phIdx + 1} for ${item.garmentName}`}
                                        activeOpacity={0.8}
                                      >
                                        <Image
                                          source={{ uri: fullUrl }}
                                          style={styles.compactThumbImage}
                                          resizeMode="cover"
                                        />
                                      </TouchableOpacity>
                                    );
                                  })}

                                  {extraPhotosCount > 0 ? (
                                    <TouchableOpacity
                                      style={styles.compactExtraBadgeBtn}
                                      onPress={() =>
                                        openLightbox(
                                          itemPhotos.map((p) => p.url),
                                          maxThumbnails,
                                        )
                                      }
                                      accessible={true}
                                      accessibilityLabel={`View ${extraPhotosCount} more photos`}
                                      activeOpacity={0.8}
                                    >
                                      <Text style={styles.compactExtraBadgeText}>
                                        +{extraPhotosCount}
                                      </Text>
                                    </TouchableOpacity>
                                  ) : null}

                                  <TouchableOpacity
                                    style={[styles.compactAddMorePhotoBtn, { backgroundColor: colors.primaryBg, borderColor: colors.primaryLight }]}
                                    onPress={() => handleAddPhotoAction({ orderItemId: item.id })}
                                    accessible={true}
                                    accessibilityLabel={`Add photo for ${item.garmentName}`}
                                    activeOpacity={0.7}
                                  >
                                    <Text style={styles.compactAddCameraIcon}>📷</Text>
                                    <Text style={[styles.compactAddMorePhotoText, { color: colors.primary }]}>Add</Text>
                                  </TouchableOpacity>
                                </View>

                                <TouchableOpacity
                                  style={styles.compactViewAllLink}
                                  onPress={() => setActiveTab('PHOTOS')}
                                  accessible={true}
                                  accessibilityLabel="View all order photos in Photos tab"
                                >
                                  <Text style={[styles.compactViewAllText, { color: colors.primary }]}>
                                    {itemPhotos.length} photo{itemPhotos.length > 1 ? 's' : ''} • View All →
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            ) : (
                              <View style={styles.noPhotosRow}>
                                <TouchableOpacity
                                  style={[styles.addPhotoInlineBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
                                  onPress={() => handleAddPhotoAction({ orderItemId: item.id })}
                                  accessible={true}
                                  accessibilityLabel={`Add photo for ${item.garmentName}`}
                                  activeOpacity={0.7}
                                >
                                  <Text style={[styles.addPhotoInlineText, { color: colors.textPrimary }]}>📷 + Add Photo</Text>
                                </TouchableOpacity>
                                <Text style={[styles.noPhotosLabel, { color: colors.textMuted }]}>No photos attached</Text>
                              </View>
                            )}
                          </View>
                        </View>
                      );
                    })}

                    {/* Physical Garments Processing checklist */}
                    {order.items.some(
                      (i) => i.physicalGarments && i.physicalGarments.length > 0,
                    ) ? (
                      <View style={[styles.garmentChecklistCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={styles.checklistHeaderRow}>
                          <View style={styles.checklistTitleGroup}>
                            <Text style={styles.checklistCheckIcon}>☑</Text>
                            <Text style={[styles.checklistTitle, { color: colors.textPrimary }]}>Garment Readiness Checklist</Text>
                          </View>
                          <View style={styles.checklistBadgePill}>
                            <Text style={styles.checklistBadgeText}>
                              {readyGarments} / {totalGarments} Ready
                            </Text>
                          </View>
                        </View>
                        {order.items.map((item) =>
                          item.physicalGarments?.map((g) => {
                            const pgPhotos = getGarmentPhotos(g.id, item, g);
                            return (
                              <TouchableOpacity
                                key={g.id}
                                style={[styles.garmentCheckRow, { borderBottomColor: colors.border }]}
                                onPress={() => handleToggleGarmentReady(item.id, g.id, g.isReady)}
                                disabled={operatingGarmentId === g.id}
                                activeOpacity={0.7}
                              >
                                <View
                                  style={[
                                    styles.checkboxCircle,
                                    g.isReady && styles.checkboxCircleActive,
                                  ]}
                                >
                                  {Boolean(g.isReady) ? (
                                    <Text style={styles.checkmarkIcon}>✓</Text>
                                  ) : null}
                                </View>
                                <Text
                                  style={[styles.garmentCheckText, { color: colors.textPrimary }]}
                                  numberOfLines={1}
                                  ellipsizeMode="tail"
                                >
                                  {item.garmentName} #{g.unitNumber}{' '}
                                  {g.tagId ? `(Tag: ${g.tagId})` : ''}
                                </Text>

                                {pgPhotos.length > 0 ? (
                                  <TouchableOpacity
                                    style={styles.garmentPiecePhotoBtn}
                                    onPress={(e) => {
                                      e.stopPropagation?.();
                                      openLightbox(
                                        pgPhotos.map((p) => p.url),
                                        0,
                                      );
                                    }}
                                    accessible={true}
                                    accessibilityLabel={`View ${pgPhotos.length} photo(s) for ${item.garmentName} #${g.unitNumber}`}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    activeOpacity={0.8}
                                  >
                                    <Image
                                      source={{ uri: resolvePhotoUrl(pgPhotos[0].url) }}
                                      style={styles.garmentPieceThumbImage}
                                      resizeMode="cover"
                                    />
                                    {pgPhotos.length > 1 ? (
                                      <View style={styles.garmentPieceBadge}>
                                        <Text style={styles.garmentPieceBadgeText}>
                                          +{pgPhotos.length - 1}
                                        </Text>
                                      </View>
                                    ) : null}
                                  </TouchableOpacity>
                                ) : (
                                  <TouchableOpacity
                                    style={styles.garmentPiecePlaceholderBtn}
                                    onPress={(e) => {
                                      e.stopPropagation?.();
                                      handleAddPhotoAction({
                                        orderItemId: item.id,
                                        physicalGarmentId: g.id,
                                      });
                                    }}
                                    accessible={true}
                                    accessibilityLabel={`Add photo for ${item.garmentName} #${g.unitNumber}`}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    activeOpacity={0.7}
                                  >
                                    <Text style={styles.garmentPiecePlaceholderIcon}>📷</Text>
                                  </TouchableOpacity>
                                )}

                                <View
                                  style={[
                                    styles.garmentStatusPill,
                                    g.isReady ? styles.statusPillReady : styles.statusPillWaiting,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.garmentStatusLabel,
                                      g.isReady ? styles.statusReady : styles.statusWaiting,
                                    ]}
                                  >
                                    {g.isReady ? 'Ready' : 'In Processing'}
                                  </Text>
                                </View>
                              </TouchableOpacity>
                            );
                          }),
                        )}
                      </View>
                    ) : null}

                    {/* Financial Summary / Payment Summary */}
                    <View style={[styles.financialSummaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <View style={styles.paymentSummaryHeaderRow}>
                        <Text style={{ fontSize: 18, marginRight: 6 }}>👛</Text>
                        <Text style={[styles.paymentSummaryTitle, { color: colors.textPrimary }]}>Payment Summary</Text>
                      </View>

                      <View style={styles.summaryRow}>
                        <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Total Amount</Text>
                        <Text style={[styles.summaryVal, { color: colors.textPrimary }]}>₹ {effectiveTotal.toFixed(2)}</Text>
                      </View>
                      <View style={styles.summaryRow}>
                        <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Amount Paid</Text>
                        <Text style={[styles.summaryVal, { color: colors.success }]}>
                          ₹ {effectivePaid.toFixed(2)}
                        </Text>
                      </View>
                      <View style={[styles.balanceDueHighlightBox, { backgroundColor: colors.errorBg, borderColor: colors.error }]}>
                        <Text style={[styles.summaryDueLabel, { color: colors.textPrimary }]}>Balance Due</Text>
                        <Text style={[styles.summaryDueVal, { color: colors.error }]}>₹ {effectiveDue.toFixed(2)}</Text>
                      </View>
                    </View>
                  </View>
                ) : activeTab === 'PHOTOS' ? (
                  /* Tab Content 2: Photos */
                  <View style={[styles.photosTabContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.photosTabHeaderRow}>
                      <View>
                        <Text style={[styles.photosTabTitle, { color: colors.textPrimary }]}>Order Garment Intake Photos</Text>
                        <Text style={[styles.photosTabSubtitle, { color: colors.textSecondary }]}>
                          {orderPhotos.length} photo(s) recorded for this order
                        </Text>
                      </View>
                      <View style={styles.photosActionRow}>
                        <TouchableOpacity
                          style={[styles.actionBtnSmall, { backgroundColor: colors.primary }]}
                          onPress={() => handleTakePhoto()}
                          disabled={isUploadingPhoto}
                          accessible={true}
                          accessibilityLabel="Take Photo with Camera"
                        >
                          <Text style={styles.actionBtnSmallText}>📷 Camera</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionBtnSmall, styles.actionBtnSmallSecondary, { backgroundColor: colors.surfaceSecondary }]}
                          onPress={() => handlePickGallery()}
                          disabled={isUploadingPhoto}
                          accessible={true}
                          accessibilityLabel="Select from Gallery"
                        >
                          <Text style={[styles.actionBtnSmallText, { color: colors.textPrimary }]}>🖼️ Gallery</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {isUploadingPhoto && (
                      <View style={[styles.uploadingBox, { backgroundColor: colors.primaryBg }]}>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text style={[styles.uploadingText, { color: colors.primary }]}>Uploading photo to server...</Text>
                      </View>
                    )}

                    {orderPhotos.length === 0 ? (
                      <View style={[styles.emptyPhotosContainer, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                        <Text style={styles.emptyPhotosIcon}>📷</Text>
                        <Text style={[styles.emptyPhotosText, { color: colors.textPrimary }]}>
                          No photos recorded for this order yet.
                        </Text>
                        <Text style={[styles.emptyPhotosSubtext, { color: colors.textSecondary }]}>
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
                              style={[styles.photoCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
                              onPress={() =>
                                openLightbox(
                                  orderPhotos.map((p) => p.url),
                                  idx,
                                )
                              }
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
                    <View style={[styles.notificationHistorySection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <Text style={[styles.notificationHistoryTitle, { color: colors.textPrimary }]}>Customer Notifications</Text>
                      {notifications.length > 0 ? (
                        notifications.map((notif) => (
                          <View key={notif.id} style={[styles.notificationCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                            <View style={styles.notificationHeader}>
                              <Text style={[styles.notifEventText, { color: colors.textPrimary }]}>
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
                            <Text style={[styles.notifRecipientText, { color: colors.textSecondary }]}>
                              📱 {notif.recipient} via {notif.channel}
                            </Text>
                            <Text style={[styles.notifDateText, { color: colors.textMuted }]}>
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
                        <Text style={[styles.noNotificationsText, { color: colors.textMuted }]}>
                          No notifications recorded for this order yet.
                        </Text>
                      )}
                    </View>
                  </View>
                )}
              </ScrollView>

              {/* Bottom Action Bar matching Screen 11 */}
              <View style={[styles.bottomBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
                <TouchableOpacity
                  style={[styles.addPhotoBtn, { backgroundColor: colors.surface, borderColor: colors.primary }]}
                  onPress={() => handleAddPhotoAction()}
                  activeOpacity={0.8}
                  disabled={isUploadingPhoto}
                  accessible={true}
                  accessibilityLabel="Add Photo to Order"
                >
                  <Text style={[styles.addPhotoBtnText, { color: colors.primary }]}>
                    {isUploadingPhoto ? '⏳ Uploading...' : '📷 Add Photo'}
                  </Text>
                </TouchableOpacity>

                {effectiveDue > 0 ? (
                  <TouchableOpacity
                    style={[styles.primaryActionBtn, { backgroundColor: colors.primary }]}
                    onPress={() => setPaymentModalVisible(true)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.primaryActionBtnText}>
                      Collect Payment (₹{effectiveDue.toFixed(0)})
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.primaryActionBtn, { backgroundColor: colors.primary }]}
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
          {selectedPhotoUrl ? (
            <Modal visible={true} transparent={true} animationType="fade">
              <View style={styles.lightboxBackdrop}>
                <View style={styles.lightboxHeader}>
                  <Text style={styles.lightboxTitle}>
                    {lightboxPhotos.length > 1
                      ? `Photo ${lightboxIndex + 1} of ${lightboxPhotos.length}`
                      : 'Photo Preview'}
                  </Text>
                  <TouchableOpacity
                    style={styles.lightboxCloseBtn}
                    onPress={() => {
                      setSelectedPhotoUrl(null);
                      setLightboxPhotos([]);
                    }}
                    accessible={true}
                    accessibilityLabel="Close photo preview"
                  >
                    <Text style={styles.lightboxCloseText}>✕ Close</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.lightboxImageContainer}>
                  <Image
                    source={{ uri: selectedPhotoUrl }}
                    style={styles.lightboxImage}
                    resizeMode="contain"
                  />
                </View>

                <View style={styles.lightboxFooter}>
                  {lightboxPhotos.length > 1 ? (
                    <View style={styles.lightboxNavRow}>
                      <TouchableOpacity
                        style={[
                          styles.lightboxNavBtn,
                          lightboxIndex === 0 && styles.lightboxNavBtnDisabled,
                        ]}
                        onPress={handlePrevPhoto}
                        disabled={lightboxIndex === 0}
                        accessible={true}
                        accessibilityLabel="Previous Photo"
                      >
                        <Text style={styles.lightboxNavBtnText}>‹ Previous</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.lightboxNavBtn,
                          lightboxIndex === lightboxPhotos.length - 1 &&
                            styles.lightboxNavBtnDisabled,
                        ]}
                        onPress={handleNextPhoto}
                        disabled={lightboxIndex === lightboxPhotos.length - 1}
                        accessible={true}
                        accessibilityLabel="Next Photo"
                      >
                        <Text style={styles.lightboxNavBtnText}>Next ›</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}

                  <TouchableOpacity
                    style={styles.lightboxTabSwitchBtn}
                    onPress={handleViewInPhotosTab}
                    accessible={true}
                    accessibilityLabel="Go to Photos Tab"
                  >
                    <Text style={styles.lightboxTabSwitchText}>
                      Open Complete Photos Tab ({orderPhotos.length}) →
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>
          ) : null}
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
  headerBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backArrow: {
    fontSize: 24,
    color: '#1765f5',
    fontWeight: '700',
    marginTop: -2,
  },
  backBtnText: {
    fontSize: 15,
    color: '#1765f5',
    fontWeight: '700',
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
  orderIconAndNumberGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  orderDocSquircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderNumLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  orderNumBig: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    gap: 5,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  customerRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    marginTop: 12,
  },
  customerAvatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerAvatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1d4ed8',
  },
  customerName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  customerPhone: {
    fontSize: 13,
    color: '#475569',
    marginTop: 2,
  },
  customerCode: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  customerChevron: {
    fontSize: 20,
    color: '#94a3b8',
    fontWeight: 'bold',
  },
  datesGrid: {
    flexDirection: 'row',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 12,
    marginTop: 4,
  },
  dateCol: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  dateLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  dateLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
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
  dueRemainingVal: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 2,
  },
  itemChevronIcon: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: 'bold',
    marginLeft: 4,
  },
  compactAddCameraIcon: {
    fontSize: 16,
    marginBottom: 2,
  },
  checklistHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  checklistTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  checklistCheckIcon: {
    fontSize: 16,
    color: '#1765f5',
  },
  checklistBadgePill: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  checklistBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  garmentStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusPillReady: {
    backgroundColor: '#dcfce7',
  },
  statusPillWaiting: {
    backgroundColor: '#fef3c7',
  },
  paymentSummaryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  paymentSummaryTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  balanceDueHighlightBox: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
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
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  itemMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemPhotoStripContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  itemThumbnailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  compactThumbBtn: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    overflow: 'hidden',
    backgroundColor: '#f8fafc',
  },
  compactThumbImage: {
    width: '100%',
    height: '100%',
  },
  compactExtraBadgeBtn: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#94a3b8',
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactExtraBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  compactAddMorePhotoBtn: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactAddMorePhotoText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2563eb',
  },
  compactViewAllLink: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  compactViewAllText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563eb',
  },
  noPhotosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addPhotoInlineBtn: {
    minHeight: 44,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoInlineText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  noPhotosLabel: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  garmentPiecePhotoBtn: {
    width: 42,
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    overflow: 'hidden',
    backgroundColor: '#f8fafc',
    marginRight: 6,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  garmentPieceThumbImage: {
    width: '100%',
    height: '100%',
  },
  garmentPiecePlaceholderBtn: {
    width: 42,
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    backgroundColor: '#f8fafc',
    marginRight: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  garmentPiecePlaceholderIcon: {
    fontSize: 15,
    opacity: 0.6,
  },
  garmentPieceBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderTopLeftRadius: 4,
  },
  garmentPieceBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '700',
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
    backgroundColor: 'rgba(0, 0, 0, 0.94)',
    justifyContent: 'space-between',
    paddingVertical: 40,
    paddingHorizontal: 16,
  },
  lightboxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: Platform.OS === 'android' ? 20 : 10,
    zIndex: 10,
  },
  lightboxTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  lightboxCloseBtn: {
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightboxCloseText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  lightboxImageContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  lightboxImage: {
    width: '100%',
    height: '100%',
  },
  lightboxFooter: {
    gap: 12,
    alignItems: 'center',
    paddingBottom: 10,
  },
  lightboxNavRow: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'center',
  },
  lightboxNavBtn: {
    minHeight: 44,
    minWidth: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  lightboxNavBtnDisabled: {
    opacity: 0.3,
  },
  lightboxNavBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  lightboxTabSwitchBtn: {
    minHeight: 44,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#2563eb',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightboxTabSwitchText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
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
