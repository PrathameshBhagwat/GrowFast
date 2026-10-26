import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  TextInput,
  Alert,
  Modal,
  Pressable,
  Platform,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  OrderStatus,
  OrderSummaryDTO,
  CustomerDTO,
  ORDER_STATUS_COLORS,
  OrderEntryMode,
  OrderWorkflowType,
} from '@growfast/shared-types';
import { useAuth } from '../../src/contexts/AuthContext';
import { useNetworkStatus } from '../../src/hooks/useNetworkStatus';
import { apiClient } from '../../src/api/client';
import { ConnectionBanner } from '../../src/components/ConnectionBanner';
import { OrderWizardModal } from '../../src/components/wizard/OrderWizardModal';
import { OrderDetailModal } from '../../src/components/OrderDetailModal';
import { CustomerProfileModal } from '../../src/components/CustomerProfileModal';
import { listDrafts } from '../../src/db/drafts';

// Safe component wrapper for Ionicons across React 18/19 type definitions
const Icon = Ionicons as unknown as React.ComponentType<{
  name: string;
  size?: number;
  color?: string;
  style?: any;
}>;

function getInitials(name?: string): string {
  if (!name) return 'CU';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

type SearchField = 'ALL' | 'NAME' | 'PHONE' | 'ID' | 'ADDRESS' | 'INVOICE';

interface SearchFieldOption {
  key: SearchField;
  label: string;
  placeholder: string;
}

const SEARCH_FIELD_OPTIONS: SearchFieldOption[] = [
  {
    key: 'ALL',
    label: 'All Fields',
    placeholder: 'Search by WhatsApp number, name, customer ID, or invoice #...',
  },
  {
    key: 'NAME',
    label: 'Customer Name',
    placeholder: 'Search by customer name...',
  },
  {
    key: 'PHONE',
    label: 'Mobile / WhatsApp Number',
    placeholder: 'Search by 10-digit mobile or WhatsApp number...',
  },
  {
    key: 'ID',
    label: 'Customer ID',
    placeholder: 'Search by customer ID (e.g. CUST-1001)...',
  },
  {
    key: 'ADDRESS',
    label: 'Address',
    placeholder: 'Search by street address, building, or flat...',
  },
  {
    key: 'INVOICE',
    label: 'Invoice / Order Number',
    placeholder: 'Search by invoice # or order number (e.g. #GF-1001)...',
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isConnected } = useNetworkStatus();
  const { user: session, logout } = useAuth();

  // 1. Operational Screen Notice State
  const [isNoticeDismissed, setIsNoticeDismissed] = useState(false);

  // 2. Search Field Selection State
  const [selectedField, setSelectedField] = useState<SearchField>('ALL');
  const [fieldPickerVisible, setFieldPickerVisible] = useState(false);

  // 3. Search Query & Results State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [customerResults, setCustomerResults] = useState<CustomerDTO[]>([]);
  const [orderResults, setOrderResults] = useState<OrderSummaryDTO[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDTO | null>(null);
  const searchRequestIdRef = useRef(0);

  // 4. Today's Due Orders State
  const [dueOrders, setDueOrders] = useState<OrderSummaryDTO[]>([]);
  const [dueTotalCount, setDueTotalCount] = useState<number | null>(null);
  const [loadingDueOrders, setLoadingDueOrders] = useState(false);
  const [dueOrdersError, setDueOrdersError] = useState<string | null>(null);
  const [isDueOrdersExpanded, setIsDueOrdersExpanded] = useState(false);

  // 5. Offline Draft Count
  const [offlineDraftCount, setOfflineDraftCount] = useState(0);

  // Pull-to-refresh
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modals State
  const [wizardVisible, setWizardVisible] = useState(false);
  const [wizardCustomer, setWizardCustomer] = useState<CustomerDTO | null>(null);
  const [wizardEntryMode, setWizardEntryMode] = useState<OrderEntryMode>('PIECES');
  const [wizardWorkflow, setWizardWorkflow] = useState<OrderWorkflowType>('LAUNDRY');
  const [customerProfileVisible, setCustomerProfileVisible] = useState(false);
  const [profileCustomer, setProfileCustomer] = useState<CustomerDTO | null>(null);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [orderDetailVisible, setOrderDetailVisible] = useState(false);

  /**
   * Load local SQLite pending draft count.
   */
  const loadOfflineDraftCount = useCallback(async (): Promise<number> => {
    try {
      const allDrafts = await listDrafts();
      const unsynced = allDrafts.filter(
        (d) =>
          d.syncStatus === 'QUEUED' ||
          d.syncStatus === 'DRAFT' ||
          d.syncStatus === 'FAILED_RETRYABLE' ||
          d.syncStatus === 'CONFLICT',
      );
      setOfflineDraftCount(unsynced.length);
      return unsynced.length;
    } catch {
      setOfflineDraftCount(0);
      return 0;
    }
  }, []);

  /**
   * Load today's due orders directly from the canonical backend endpoint.
   */
  const loadDueTodayOrders = useCallback(async () => {
    setLoadingDueOrders(true);
    setDueOrdersError(null);

    if (!session) {
      setLoadingDueOrders(false);
      return;
    }

    if (!isConnected) {
      setLoadingDueOrders(false);
      setDueOrdersError('Offline: Reconnect to Wi-Fi to load today’s due orders.');
      return;
    }

    try {
      const res = await apiClient.orders.dueToday({ countOnly: false });
      const orders = res?.data || res?.orders || [];
      const total = res?.total ?? res?.count ?? orders.length;
      setDueOrders(orders);
      setDueTotalCount(total);
      setDueOrdersError(null);
    } catch (err: any) {
      const msg = err?.message || 'Could not load today’s due orders. Please retry.';
      setDueOrdersError(msg);
      setDueOrders([]);
    } finally {
      setLoadingDueOrders(false);
    }
  }, [isConnected, session]);

  /**
   * Multi-field search implementation with debouncing and stale request guards.
   */
  const executeSearch = useCallback(
    async (query: string, field: SearchField) => {
      const trimmed = query.trim();
      if (trimmed.length < 2) {
        setCustomerResults([]);
        setOrderResults([]);
        setIsSearching(false);
        setSearchError(null);
        return;
      }

      const requestId = ++searchRequestIdRef.current;
      setIsSearching(true);
      setSearchError(null);

      try {
        if (field === 'INVOICE') {
          // Search orders / invoices only
          const orderRes = await apiClient.orders.list({ search: trimmed, pageSize: 6 });
          if (requestId !== searchRequestIdRef.current) return;
          setCustomerResults([]);
          setOrderResults(orderRes?.data || []);
        } else if (field === 'ALL') {
          // Search both customers and orders in parallel
          const [custRes, orderRes] = await Promise.all([
            apiClient.customers.search(trimmed, 1, 5).catch(() => ({ data: [] })),
            apiClient.orders.list({ search: trimmed, pageSize: 4 }).catch(() => ({ data: [] })),
          ]);
          if (requestId !== searchRequestIdRef.current) return;
          setCustomerResults(custRes?.data || []);
          setOrderResults(orderRes?.data || []);
        } else {
          // Customer fields: NAME, PHONE, ID, ADDRESS
          const custRes = await apiClient.customers.search(trimmed, 1, 6);
          if (requestId !== searchRequestIdRef.current) return;
          setCustomerResults(custRes?.data || []);
          setOrderResults([]);
        }
      } catch (err: any) {
        if (requestId !== searchRequestIdRef.current) return;
        setSearchError(err?.message || 'Failed to search. Please try again.');
        setCustomerResults([]);
        setOrderResults([]);
      } finally {
        if (requestId === searchRequestIdRef.current) {
          setIsSearching(false);
        }
      }
    },
    [],
  );

  // Debounced search trigger
  useEffect(() => {
    if (selectedCustomer) return;
    const timer = setTimeout(() => {
      executeSearch(searchQuery, selectedField);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedField, selectedCustomer, executeSearch]);

  // Initial load on mount
  useEffect(() => {
    if (!session) return;
    loadOfflineDraftCount();
    loadDueTodayOrders();
  }, [session, isConnected, loadOfflineDraftCount, loadDueTodayOrders]);

  /**
   * Manual pull-to-refresh handler.
   */
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([loadOfflineDraftCount(), loadDueTodayOrders()]);
    setIsRefreshing(false);
  };

  /**
   * Customer selection handler.
   */
  const handleSelectCustomer = (customer: CustomerDTO) => {
    setSelectedCustomer(customer);
    setCustomerResults([]);
    setOrderResults([]);
    setSearchQuery('');
  };

  /**
   * Deselect active customer.
   */
  const handleClearSelectedCustomer = () => {
    setSelectedCustomer(null);
    setSearchQuery('');
    setCustomerResults([]);
    setOrderResults([]);
  };

  /**
   * Start New Order workflow for selected or general customer with specific entry mode and workflow.
   */
  const handleStartOrderForCustomer = (
    cust: CustomerDTO | null,
    mode: OrderEntryMode = 'PIECES',
    wf: OrderWorkflowType = 'LAUNDRY',
  ) => {
    setWizardCustomer(cust);
    setWizardEntryMode(mode);
    setWizardWorkflow(wf);
    setWizardVisible(true);
  };

  /**
   * Open the detailed customer profile and order history modal.
   */
  const handleViewCustomerProfile = (cust: CustomerDTO) => {
    setProfileCustomer(cust);
    setCustomerProfileVisible(true);
  };

  /**
   * Sign-Out confirmation handler.
   */
  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to log out of GrowFast Laundry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const staffName = session?.name || 'Prathamesh Bhagwat';
  const staffRole = (session?.role || 'OWNER').toUpperCase();
  const storeBranch = session?.storeName || 'Koregaon Park Branch';
  const currentFieldOption =
    SEARCH_FIELD_OPTIONS.find((f) => f.key === selectedField) || SEARCH_FIELD_OPTIONS[0];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ConnectionBanner />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop:
              Platform.OS === 'android'
                ? Math.max(insets.top, StatusBar.currentHeight || 0, 36)
                : Math.max(insets.top, 16),
            paddingBottom: Math.max(insets.bottom, 24),
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={['#1765F5']}
          />
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ==========================================
            A. HEADER
            ========================================== */}
        <View style={styles.headerContainer}>
          <View style={styles.headerTopRow}>
            {/* Left: Brand Icon + Brand Name + Branch */}
            <View style={styles.headerLeftGroup}>
              <View style={styles.brandIconSquircle}>
                <Icon name="shirt-outline" size={24} color="#FFFFFF" />
              </View>
              <View style={styles.brandTextGroup}>
                <Text style={styles.brandTitleText}>
                  GrowFast <Text style={styles.brandAccentText}>Laundry</Text>
                </Text>
                <Text style={styles.branchSubtitleText} numberOfLines={1}>
                  {storeBranch}
                </Text>
              </View>
            </View>

            {/* Right: Theme Toggle + Sign-Out */}
            <View style={styles.headerActionGroup}>
              <TouchableOpacity
                style={styles.circleActionButton}
                onPress={() =>
                  Alert.alert(
                    'Theme Settings',
                    'Light mode is active. System default theme is currently enforced.',
                  )
                }
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Theme Toggle"
              >
                <Icon name="moon-outline" size={19} color="#334155" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.circleActionButton}
                onPress={handleSignOut}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Sign Out"
              >
                <Icon name="log-out-outline" size={20} color="#334155" />
              </TouchableOpacity>
            </View>
          </View>

          {/* User & Role Display */}
          <Text style={styles.userRoleLineText}>
            {staffName} • {staffRole}
          </Text>
        </View>

        {/* ==========================================
            B. COUNTER OPERATIONAL SCREEN NOTICE
            ========================================== */}
        {!isNoticeDismissed && (
          <View style={styles.noticeCard}>
            <TouchableOpacity
              style={styles.noticeDismissBtn}
              onPress={() => setIsNoticeDismissed(true)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Dismiss Notice"
            >
              <Icon name="close" size={18} color="#94A3B8" />
            </TouchableOpacity>

            <View style={styles.noticeContentRow}>
              {/* Blue Squircle Calendar Icon */}
              <View style={styles.noticeIconSquircle}>
                <Icon name="calendar-outline" size={22} color="#FFFFFF" />
              </View>

              {/* Text Group */}
              <View style={styles.noticeTextColumn}>
                <Text style={styles.noticeTitle}>Counter Operational Screen</Text>
                <Text style={styles.noticeSubText}>
                  {loadingDueOrders && dueTotalCount === null
                    ? 'Checking orders requiring attention today...'
                    : dueOrdersError
                      ? 'Could not load today’s due orders. Tap to retry.'
                      : `${dueTotalCount ?? 0} orders requiring attention today.\nClick below to inspect #`}
                </Text>
              </View>

              {/* View Due Orders Pill Button */}
              <TouchableOpacity
                style={styles.noticeActionPill}
                onPress={() => {
                  if (dueOrdersError) {
                    loadDueTodayOrders();
                  } else {
                    setIsDueOrdersExpanded(true);
                  }
                }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="View Due Orders"
              >
                <Text style={styles.noticeActionPillText}>
                  {dueOrdersError ? 'Retry' : 'View Due Orders'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ==========================================
            C. MAIN SEARCH CARD: CUSTOMER / INVOICE
            ========================================== */}
        <View style={styles.mainSearchCard}>
          {/* Card Header */}
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderSquircle}>
              <Icon name="person-outline" size={22} color="#FFFFFF" />
            </View>
            <View style={styles.cardHeaderTextColumn}>
              <Text style={styles.cardHeaderTitle}>Search Customer / Invoice</Text>
              <Text style={styles.cardHeaderSubtitle}>
                Lookup customer by name, mobile, ID, address, or search invoice #
              </Text>
            </View>
          </View>

          {/* Two Primary Action Buttons */}
          <View style={styles.primaryActionsRow}>
            {/* Find / Edit Order Button */}
            <TouchableOpacity
              style={styles.secondaryActionBtn}
              onPress={() => router.push('/(tabs)/orders' as any)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Find or Edit Order"
            >
              <Icon name="search-outline" size={18} color="#1765F5" />
              <Text style={styles.secondaryActionBtnText}>Find / Edit Order</Text>
            </TouchableOpacity>

            {/* Add New Customer Button */}
            <TouchableOpacity
              style={styles.primaryActionBtn}
              onPress={() => router.push('/(tabs)/customers' as any)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Add New Customer"
            >
              <Icon name="add" size={19} color="#FFFFFF" />
              <Text style={styles.primaryActionBtnText}>Add New Customer</Text>
            </TouchableOpacity>
          </View>

          {/* Inner Search Box with Field Selector */}
          <View style={styles.innerSearchBoxContainer}>
            {/* Field Selector Dropdown Pill */}
            <TouchableOpacity
              style={styles.fieldSelectorPill}
              onPress={() => setFieldPickerVisible(true)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Filter Search Field: ${currentFieldOption.label}`}
            >
              <Text style={styles.fieldSelectorPillText}>{currentFieldOption.label}</Text>
              <Icon name="chevron-down" size={14} color="#64748B" />
            </TouchableOpacity>

            {/* Search Input Row */}
            <View style={styles.searchInputRow}>
              <Icon name="search-outline" size={19} color="#94A3B8" style={styles.searchIconStyle} />
              <TextInput
                style={styles.searchTextInput}
                placeholder={currentFieldOption.placeholder}
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                accessibilityLabel="Search customer or invoice"
              />
              {isSearching ? (
                <ActivityIndicator size="small" color="#1765F5" style={{ marginRight: 6 }} />
              ) : searchQuery.length > 0 ? (
                <TouchableOpacity
                  onPress={() => {
                    setSearchQuery('');
                    setCustomerResults([]);
                    setOrderResults([]);
                    setSearchError(null);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel="Clear Search"
                >
                  <Icon name="close-circle" size={18} color="#94A3B8" style={{ marginRight: 6 }} />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {/* Selected Customer Active Banner */}
          {selectedCustomer ? (
            <View style={styles.selectedCustomerBanner}>
              <View style={styles.selectedCustomerInfoRow}>
                <View style={styles.selectedAvatarCircle}>
                  <Text style={styles.selectedAvatarText}>
                    {getInitials(selectedCustomer.name)}
                  </Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text style={styles.selectedCustomerName} numberOfLines={1}>
                      {selectedCustomer.name}
                    </Text>
                    {selectedCustomer.membership && selectedCustomer.membership !== 'NONE' ? (
                      <View style={styles.tierBadge}>
                        <Text style={styles.tierBadgeText}>{selectedCustomer.membership}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.selectedCustomerPhone}>{selectedCustomer.phone}</Text>
                  {selectedCustomer.customerCode ? (
                    <Text style={styles.selectedCustomerCode}>#{selectedCustomer.customerCode}</Text>
                  ) : null}
                  {selectedCustomer.address ? (
                    <Text style={styles.selectedCustomerAddress} numberOfLines={1}>
                      {selectedCustomer.address}
                    </Text>
                  ) : null}
                </View>
                <TouchableOpacity
                  onPress={handleClearSelectedCustomer}
                  style={styles.changeCustomerPill}
                  accessibilityRole="button"
                  accessibilityLabel="Change Customer"
                >
                  <Text style={styles.changeCustomerPillText}>Change</Text>
                </TouchableOpacity>
              </View>

              {/* Four Authoritative Customer Actions (Profile + 3 Order Modes) */}
              <View style={styles.customerActionButtonsRow}>
                {/* 1. View Profile Action */}
                <TouchableOpacity
                  style={styles.customerProfileBtn}
                  onPress={() => handleViewCustomerProfile(selectedCustomer)}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={`View Profile for ${selectedCustomer.name}`}
                >
                  <Icon name="person-outline" size={14} color="#0284C7" style={{ marginRight: 4 }} />
                  <Text style={styles.customerProfileBtnText} numberOfLines={1}>Profile</Text>
                </TouchableOpacity>

                {/* 2. Create Per-Piece Order */}
                <TouchableOpacity
                  style={styles.customerPerPieceBtn}
                  onPress={() => handleStartOrderForCustomer(selectedCustomer, 'PIECES', 'LAUNDRY')}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={`Create Per-Piece Order for ${selectedCustomer.name}`}
                >
                  <Icon name="shirt-outline" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                  <Text style={styles.customerPerPieceBtnText} numberOfLines={1}>Piece</Text>
                </TouchableOpacity>

                {/* 3. Create Per-Weight Order */}
                <TouchableOpacity
                  style={styles.customerPerWeightBtn}
                  onPress={() => handleStartOrderForCustomer(selectedCustomer, 'WEIGHT', 'LAUNDRY')}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={`Create Per-Weight Order for ${selectedCustomer.name}`}
                >
                  <Icon name="scale-outline" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                  <Text style={styles.customerPerWeightBtnText} numberOfLines={1}>Weight</Text>
                </TouchableOpacity>

                {/* 4. Create Dry Cleaning Order */}
                <TouchableOpacity
                  style={styles.customerDryCleanBtn}
                  onPress={() => handleStartOrderForCustomer(selectedCustomer, 'PIECES', 'DRY_CLEANING')}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={`Create Dry Cleaning Order for ${selectedCustomer.name}`}
                >
                  <Icon name="sparkles-outline" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                  <Text style={styles.customerDryCleanBtnText} numberOfLines={1}>Dry Clean</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {/* Dropdown Customer Results */}
          {!selectedCustomer && customerResults.length > 0 ? (
            <View style={styles.resultsContainer}>
              <Text style={styles.resultsSectionHeader}>Customer Matches ({customerResults.length})</Text>
              {customerResults.map((cust) => (
                <TouchableOpacity
                  key={cust.id}
                  style={styles.resultCustomerCard}
                  onPress={() => handleSelectCustomer(cust)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`Select Customer ${cust.name}`}
                >
                  <View style={styles.resultAvatarCircle}>
                    <Text style={styles.resultAvatarText}>{getInitials(cust.name)}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.resultCustomerName} numberOfLines={1}>
                        {cust.name}
                      </Text>
                      {cust.membership && cust.membership !== 'NONE' ? (
                        <View style={styles.tierBadgeSmall}>
                          <Text style={styles.tierBadgeTextSmall}>{cust.membership}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.resultCustomerPhone}>{cust.phone}</Text>
                    {cust.address ? (
                      <Text style={styles.resultCustomerAddress} numberOfLines={1}>
                        {cust.address}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.selectCustomerPill}>
                    <Text style={styles.selectCustomerPillText}>Select</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          {/* Dropdown Order / Invoice Results */}
          {!selectedCustomer && orderResults.length > 0 ? (
            <View style={styles.resultsContainer}>
              <Text style={styles.resultsSectionHeader}>Invoice / Order Matches ({orderResults.length})</Text>
              {orderResults.map((order) => {
                const statusColors =
                  ORDER_STATUS_COLORS[order.status as OrderStatus] || {
                    bg: '#f1f5f9',
                    text: '#475569',
                    border: '#cbd5e1',
                  };
                const orderNumDisplay = order.orderNumber.startsWith('GF-')
                  ? `#${order.orderNumber}`
                  : order.orderNumber.startsWith('#')
                    ? order.orderNumber
                    : `#GF-${order.orderNumber}`;

                return (
                  <TouchableOpacity
                    key={order.id}
                    style={styles.resultOrderCard}
                    onPress={() => {
                      setActiveOrderId(order.id);
                      setOrderDetailVisible(true);
                    }}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`View Order ${orderNumDisplay}`}
                  >
                    <View style={styles.orderSquircleSmall}>
                      <Icon name="shirt-outline" size={18} color="#1765F5" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.resultOrderNumber}>{orderNumDisplay}</Text>
                      <Text style={styles.resultOrderCustomer} numberOfLines={1}>
                        {order.customerName || (order as any).customer?.name || 'Customer'}
                      </Text>
                      <Text style={styles.resultOrderMeta}>
                        Due: {formatDate(order.effectiveDueDate || order.orderDate)} • ₹
                        {order.totalAmount.toFixed(0)}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusChipSmall,
                        { backgroundColor: statusColors.bg, borderColor: statusColors.border },
                      ]}
                    >
                      <Text style={[styles.statusChipTextSmall, { color: statusColors.text }]}>
                        {order.status.replace(/_/g, ' ')}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}

          {/* Empty Search Result with Customer Creation CTA */}
          {!selectedCustomer &&
          searchQuery.trim().length >= 2 &&
          !isSearching &&
          customerResults.length === 0 &&
          orderResults.length === 0 ? (
            <View style={styles.emptySearchNoticeBox}>
              <Text style={styles.emptySearchNoticeText}>
                No customer or invoice found matching "{searchQuery}"
              </Text>
              <TouchableOpacity
                style={styles.registerCustomerCtaBtn}
                onPress={() => router.push('/(tabs)/customers' as any)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Register New Customer"
              >
                <Icon name="person-add-outline" size={16} color="#1765F5" style={{ marginRight: 6 }} />
                <Text style={styles.registerCustomerCtaBtnText}>+ Register New Customer</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Search Error State */}
          {searchError ? (
            <View style={styles.searchErrorNoticeBox}>
              <Text style={styles.searchErrorNoticeText}>⚠️ {searchError}</Text>
            </View>
          ) : null}
        </View>

        {/* ==========================================
            D. TODAY'S DUE ORDERS CARD
            ========================================== */}
        <View style={styles.dueOrdersCard}>
          {/* Header Row */}
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderSquircle}>
              <Icon name="time-outline" size={22} color="#FFFFFF" />
            </View>
            <View style={styles.cardHeaderTextColumn}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.cardHeaderTitle}>Today's Due Orders</Text>
                <View style={styles.dueCountBadgePill}>
                  {loadingDueOrders && dueTotalCount === null ? (
                    <ActivityIndicator size="small" color="#FFFFFF" style={{ transform: [{ scale: 0.7 }] }} />
                  ) : (
                    <Text style={styles.dueCountBadgePillText}>
                      {dueOrdersError ? '!' : (dueTotalCount ?? 0)}
                    </Text>
                  )}
                </View>
              </View>
              <Text style={styles.cardHeaderSubtitle}>Orders requiring attention today</Text>
            </View>
          </View>

          {/* Full-width Toggle / Navigation Button */}
          <TouchableOpacity
            style={styles.viewDueOrdersFullBtn}
            onPress={() => setIsDueOrdersExpanded((prev) => !prev)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="View Today's Due Orders"
          >
            <Icon
              name={isDueOrdersExpanded ? 'chevron-up' : 'chevron-down'}
              size={18}
              color="#FFFFFF"
            />
            <Text style={styles.viewDueOrdersFullBtnText}>
              {isDueOrdersExpanded ? "Hide Today's Due Orders" : "View Today's Due Orders"}
            </Text>
          </TouchableOpacity>

          {/* Expanded Due Orders List */}
          {isDueOrdersExpanded && (
            <View style={styles.expandedDueOrdersContainer}>
              {loadingDueOrders && !isRefreshing ? (
                <View style={styles.loadingDueBox}>
                  <ActivityIndicator size="small" color="#1765F5" />
                  <Text style={styles.loadingDueText}>Loading today's due orders...</Text>
                </View>
              ) : dueOrdersError ? (
                <View style={styles.errorDueBox}>
                  <Icon name="alert-circle-outline" size={20} color="#b91c1c" style={{ marginRight: 6 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.errorDueText}>{dueOrdersError}</Text>
                  </View>
                  <TouchableOpacity style={styles.retryDueBtn} onPress={loadDueTodayOrders}>
                    <Text style={styles.retryDueBtnText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : dueOrders.length === 0 ? (
                <View style={styles.emptyDueMessageBox}>
                  <Icon name="checkmark-done-circle-outline" size={36} color="#10b981" />
                  <Text style={styles.emptyDueMessageTitle}>All caught up!</Text>
                  <Text style={styles.emptyDueMessageSub}>
                    No orders are currently due today for this branch.
                  </Text>
                </View>
              ) : (
                <View style={styles.dueOrdersList}>
                  {dueOrders.map((order) => {
                    const statusColors =
                      ORDER_STATUS_COLORS[order.status as OrderStatus] || {
                        bg: '#f1f5f9',
                        text: '#475569',
                        border: '#cbd5e1',
                      };
                    const orderNumDisplay = order.orderNumber.startsWith('GF-')
                      ? `#${order.orderNumber}`
                      : order.orderNumber.startsWith('#')
                        ? order.orderNumber
                        : `#GF-${order.orderNumber}`;

                    return (
                      <TouchableOpacity
                        key={order.id}
                        style={styles.dueOrderItemCard}
                        onPress={() => {
                          setActiveOrderId(order.id);
                          setOrderDetailVisible(true);
                        }}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={`Order ${orderNumDisplay}`}
                      >
                        <View style={styles.garmentSquircleSmall}>
                          <Icon name="shirt-outline" size={19} color="#1765F5" />
                        </View>
                        <View style={styles.dueOrderCenterColumn}>
                          <Text style={styles.dueOrderNumberText}>{orderNumDisplay}</Text>
                          <Text style={styles.dueOrderCustomerText} numberOfLines={1}>
                            {order.customerName || (order as any).customer?.name || 'Customer'}
                          </Text>
                          <Text style={styles.dueOrderSubText}>
                            Due: {formatDate(order.effectiveDueDate || order.orderDate)} • ₹
                            {order.totalAmount.toFixed(0)}
                          </Text>
                        </View>
                        <View style={styles.dueOrderRightColumn}>
                          <View
                            style={[
                              styles.statusChipSmall,
                              { backgroundColor: statusColors.bg, borderColor: statusColors.border },
                            ]}
                          >
                            <Text style={[styles.statusChipTextSmall, { color: statusColors.text }]}>
                              {order.status.replace(/_/g, ' ')}
                            </Text>
                          </View>
                          <Icon name="chevron-forward" size={17} color="#94A3B8" />
                        </View>
                      </TouchableOpacity>
                    );
                  })}

                  {/* View all in orders tab */}
                  <TouchableOpacity
                    style={styles.viewAllOrdersLink}
                    onPress={() => router.push('/(tabs)/orders' as any)}
                    accessibilityRole="button"
                    accessibilityLabel="Open Full Orders List"
                  >
                    <Text style={styles.viewAllOrdersLinkText}>View All in Orders Screen →</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>

        {/* ==========================================
            E. BOTTOM DECORATIVE LAUNDRY ILLUSTRATION
            ========================================== */}
        <View style={styles.bottomIllustrationContainer} pointerEvents="none">
          {/* Subtle background waves */}
          <View style={styles.softWaveBackdrop} />

          {/* Left Decorative Botanical Leaves */}
          <View style={styles.leafClusterLeft}>
            <View style={[styles.leafPetal, { transform: [{ rotate: '-35deg' }] }]} />
            <View style={[styles.leafPetal, { transform: [{ rotate: '-10deg' }], marginTop: -10 }]} />
          </View>

          {/* Center Washing Machine */}
          <View style={styles.washingMachineBody}>
            {/* Top Control Panel */}
            <View style={styles.machineTopPanel}>
              <View style={styles.machineDialKnob} />
              <View style={styles.machineControlDotsGroup}>
                <View style={styles.machineDot} />
                <View style={styles.machineDot} />
                <View style={styles.machineDot} />
              </View>
            </View>

            {/* Circular Drum Door */}
            <View style={styles.machineDrumOuterCircle}>
              <View style={styles.machineDrumInnerCircle}>
                <View style={styles.waterWaveHighlight} />
              </View>
            </View>
          </View>

          {/* Right Folded Towels Stack */}
          <View style={styles.towelsStackContainer}>
            <View style={[styles.foldedTowel, { backgroundColor: '#E2E8F0' }]} />
            <View style={[styles.foldedTowel, { backgroundColor: '#DBEAFE' }]} />
            <View style={[styles.foldedTowel, { backgroundColor: '#BFDBFE' }]} />
          </View>

          {/* Right Decorative Botanical Leaves */}
          <View style={styles.leafClusterRight}>
            <View style={[styles.leafPetal, { transform: [{ rotate: '35deg' }] }]} />
            <View style={[styles.leafPetal, { transform: [{ rotate: '15deg' }], marginTop: -8 }]} />
          </View>

          {/* Subtle Dot Grid Accent */}
          <View style={styles.dotGridAccent}>
            <View style={styles.dotGridRow}>
              <View style={styles.gridDot} />
              <View style={styles.gridDot} />
              <View style={styles.gridDot} />
            </View>
            <View style={styles.dotGridRow}>
              <View style={styles.gridDot} />
              <View style={styles.gridDot} />
              <View style={styles.gridDot} />
            </View>
            <View style={styles.dotGridRow}>
              <View style={styles.gridDot} />
              <View style={styles.gridDot} />
              <View style={styles.gridDot} />
            </View>
          </View>
        </View>
      </ScrollView>

      {/* ==========================================
          MODAL: SEARCH FIELD SELECTOR
          ========================================== */}
      <Modal
        visible={fieldPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFieldPickerVisible(false)}
      >
        <Pressable style={styles.modalOverlayBackdrop} onPress={() => setFieldPickerVisible(false)}>
          <View style={styles.fieldPickerModalCard}>
            <View style={styles.fieldPickerHeaderRow}>
              <Text style={styles.fieldPickerTitle}>Search Field</Text>
              <TouchableOpacity
                onPress={() => setFieldPickerVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Close Field Picker"
              >
                <Icon name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {SEARCH_FIELD_OPTIONS.map((opt) => {
              const isSelected = opt.key === selectedField;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.fieldPickerOptionRow, isSelected && styles.fieldPickerOptionRowSelected]}
                  onPress={() => {
                    setSelectedField(opt.key);
                    setFieldPickerVisible(false);
                  }}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${opt.label}`}
                >
                  <Text
                    style={[
                      styles.fieldPickerOptionText,
                      isSelected && styles.fieldPickerOptionTextSelected,
                    ]}
                  >
                    {opt.label}
                  </Text>
                  {isSelected && <Icon name="checkmark" size={18} color="#1765F5" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Modal>

      {/* Order Wizard Modal integration */}
      <OrderWizardModal
        visible={wizardVisible}
        draft={null}
        initialCustomer={wizardCustomer}
        initialEntryMode={wizardEntryMode}
        initialWorkflow={wizardWorkflow}
        storeId={session?.storeId || 'store-1'}
        userRole={session?.role || 'COUNTER'}
        onClose={() => {
          setWizardVisible(false);
          setWizardCustomer(null);
        }}
        onOrderSavedOrSubmitted={() => {
          setWizardVisible(false);
          setWizardCustomer(null);
          loadDueTodayOrders();
          loadOfflineDraftCount();
        }}
        onViewOrderDetail={(orderId) => {
          setActiveOrderId(orderId);
          setOrderDetailVisible(true);
        }}
      />

      {/* Customer Profile Modal integration */}
      <CustomerProfileModal
        visible={customerProfileVisible}
        customer={profileCustomer}
        onClose={() => {
          setCustomerProfileVisible(false);
          setProfileCustomer(null);
        }}
        onCreatePerPieceOrder={(cust) => {
          handleStartOrderForCustomer(cust, 'PIECES', 'LAUNDRY');
        }}
        onCreatePerWeightOrder={(cust) => {
          handleStartOrderForCustomer(cust, 'WEIGHT', 'LAUNDRY');
        }}
        onCreateDryCleanOrder={(cust) => {
          handleStartOrderForCustomer(cust, 'PIECES', 'DRY_CLEANING');
        }}
        onReturnToSearch={() => {
          handleClearSelectedCustomer();
        }}
        onViewOrder={(orderId) => {
          setActiveOrderId(orderId);
          setOrderDetailVisible(true);
        }}
      />

      {/* Order Detail Modal integration */}
      <OrderDetailModal
        visible={orderDetailVisible}
        orderId={activeOrderId}
        onClose={() => {
          setOrderDetailVisible(false);
          setActiveOrderId(null);
        }}
        onOrderUpdated={() => {
          loadDueTodayOrders();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F0F6FF',
  },
  container: {
    flex: 1,
    backgroundColor: '#F0F6FF',
  },
  scrollContent: {
    paddingHorizontal: 16,
  },

  // ==========================================
  // A. HEADER STYLES
  // ==========================================
  headerContainer: {
    marginBottom: 16,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  brandIconSquircle: {
    width: 46,
    height: 46,
    borderRadius: 13,
    backgroundColor: '#1765F5',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1765F5',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  brandTextGroup: {
    marginLeft: 12,
    flex: 1,
  },
  brandTitleText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  brandAccentText: {
    color: '#1765F5',
  },
  branchSubtitleText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 2,
  },
  headerActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  circleActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  userRoleLineText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 8,
    marginLeft: 2,
  },

  // ==========================================
  // B. NOTICE CARD STYLES
  // ==========================================
  noticeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
    shadowColor: '#1E40AF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  noticeDismissBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    padding: 4,
  },
  noticeContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  noticeIconSquircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#1765F5',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1765F5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  noticeTextColumn: {
    flex: 1,
    marginHorizontal: 12,
  },
  noticeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  noticeSubText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 3,
    lineHeight: 16,
  },
  noticeActionPill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeActionPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1765F5',
  },

  // ==========================================
  // C. MAIN SEARCH CARD STYLES
  // ==========================================
  mainSearchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0ECFF',
    shadowColor: '#1E40AF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardHeaderSquircle: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: '#1765F5',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1765F5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeaderTextColumn: {
    marginLeft: 12,
    flex: 1,
  },
  cardHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  cardHeaderSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },

  // Two Primary Action Buttons
  primaryActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  secondaryActionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  secondaryActionBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1765F5',
  },
  primaryActionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#1765F5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#1765F5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  primaryActionBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Inner Search Container
  innerSearchBoxContainer: {
    marginTop: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  fieldSelectorPill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginBottom: 8,
  },
  fieldSelectorPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  searchInputRow: {
    height: 44,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  searchIconStyle: {
    marginRight: 8,
  },
  searchTextInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    paddingVertical: 0,
  },

  // Selected Customer Active Banner
  selectedCustomerBanner: {
    marginTop: 12,
    backgroundColor: '#F0F9FF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
  },
  selectedCustomerInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedAvatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1765F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedAvatarText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  selectedCustomerName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  selectedCustomerPhone: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  selectedCustomerAddress: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  selectedCustomerCode: {
    fontSize: 11,
    color: '#0284C7',
    fontWeight: '600',
    marginTop: 1,
  },
  tierBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tierBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B45309',
  },
  changeCustomerPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  changeCustomerPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7',
  },
  customerActionButtonsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 12,
  },
  customerProfileBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  customerProfileBtnText: {
    color: '#0284C7',
    fontSize: 11.5,
    fontWeight: '700',
  },
  customerPerPieceBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: '#1765F5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    shadowColor: '#1765F5',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  customerPerPieceBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },
  customerPerWeightBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: '#0284C7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  customerPerWeightBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },
  customerDryCleanBtn: {
    flex: 1.15,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: '#4F46E5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  customerDryCleanBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },

  // Results Styles
  resultsContainer: {
    marginTop: 12,
  },
  resultsSectionHeader: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resultCustomerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 6,
  },
  resultAvatarCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultAvatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  resultCustomerName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  resultCustomerPhone: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 1,
  },
  resultCustomerAddress: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  tierBadgeSmall: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  tierBadgeTextSmall: {
    fontSize: 9,
    fontWeight: '800',
    color: '#B45309',
  },
  selectCustomerPill: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  selectCustomerPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1765F5',
  },

  // Result Order Card
  resultOrderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 6,
  },
  orderSquircleSmall: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultOrderNumber: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  resultOrderCustomer: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '500',
    marginTop: 1,
  },
  resultOrderMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  statusChipSmall: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
  },
  statusChipTextSmall: {
    fontSize: 9.5,
    fontWeight: '700',
  },

  // Empty Search / Error State
  emptySearchNoticeBox: {
    marginTop: 12,
    padding: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptySearchNoticeText: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 8,
    textAlign: 'center',
  },
  registerCustomerCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    minHeight: 40,
  },
  registerCustomerCtaBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1765F5',
  },
  searchErrorNoticeBox: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  searchErrorNoticeText: {
    fontSize: 12,
    color: '#B91C1C',
  },

  // ==========================================
  // D. TODAY'S DUE ORDERS CARD STYLES
  // ==========================================
  dueOrdersCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E0ECFF',
    shadowColor: '#1E40AF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  dueCountBadgePill: {
    backgroundColor: '#1765F5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  dueCountBadgePillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  viewDueOrdersFullBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#1765F5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
    shadowColor: '#1765F5',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 2,
  },
  viewDueOrdersFullBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  expandedDueOrdersContainer: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
  },
  dueOrdersList: {
    gap: 8,
  },
  dueOrderItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  garmentSquircleSmall: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dueOrderCenterColumn: {
    flex: 1,
    marginLeft: 10,
  },
  dueOrderNumberText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  dueOrderCustomerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginTop: 1,
  },
  dueOrderSubText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  dueOrderRightColumn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  loadingDueBox: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  loadingDueText: {
    marginTop: 6,
    fontSize: 12,
    color: '#64748B',
  },
  emptyDueMessageBox: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  emptyDueMessageTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 8,
  },
  emptyDueMessageSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    textAlign: 'center',
  },
  errorDueBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorDueText: {
    fontSize: 12,
    color: '#B91C1C',
  },
  retryDueBtn: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    marginLeft: 6,
  },
  retryDueBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  viewAllOrdersLink: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 4,
  },
  viewAllOrdersLinkText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1765F5',
  },

  // ==========================================
  // E. BOTTOM DECORATIVE LAUNDRY ILLUSTRATION
  // ==========================================
  bottomIllustrationContainer: {
    marginTop: 8,
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  softWaveBackdrop: {
    position: 'absolute',
    bottom: -20,
    left: -20,
    right: -20,
    height: 120,
    backgroundColor: '#E0ECFF',
    borderTopLeftRadius: 100,
    borderTopRightRadius: 100,
    opacity: 0.6,
  },
  leafClusterLeft: {
    position: 'absolute',
    left: 28,
    bottom: 24,
    alignItems: 'center',
  },
  leafClusterRight: {
    position: 'absolute',
    right: 28,
    bottom: 24,
    alignItems: 'center',
  },
  leafPetal: {
    width: 26,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#BAE6FD',
    opacity: 0.7,
  },
  washingMachineBody: {
    width: 96,
    height: 114,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 2.5,
    borderColor: '#BFDBFE',
    alignItems: 'center',
    paddingTop: 8,
    shadowColor: '#1E40AF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  machineTopPanel: {
    width: '84%',
    height: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1.5,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 4,
    marginBottom: 10,
  },
  machineDialKnob: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#94A3B8',
  },
  machineControlDotsGroup: {
    flexDirection: 'row',
    gap: 3,
  },
  machineDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
  },
  machineDrumOuterCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#EFF6FF',
    borderWidth: 4,
    borderColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  machineDrumInnerCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1765F5',
    position: 'relative',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waterWaveHighlight: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#38BDF8',
    opacity: 0.8,
  },
  towelsStackContainer: {
    position: 'absolute',
    right: 80,
    bottom: 24,
    gap: 3,
  },
  foldedTowel: {
    width: 42,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  dotGridAccent: {
    position: 'absolute',
    right: 20,
    top: 20,
    gap: 4,
  },
  dotGridRow: {
    flexDirection: 'row',
    gap: 4,
  },
  gridDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#BFDBFE',
    opacity: 0.7,
  },

  // ==========================================
  // FIELD PICKER MODAL STYLES
  // ==========================================
  modalOverlayBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  fieldPickerModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
  },
  fieldPickerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  fieldPickerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  fieldPickerOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  fieldPickerOptionRowSelected: {
    backgroundColor: '#EFF6FF',
  },
  fieldPickerOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  fieldPickerOptionTextSelected: {
    color: '#1765F5',
    fontWeight: '700',
  },
});
