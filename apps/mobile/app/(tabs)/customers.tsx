import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  SafeAreaView,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CustomerDTO,
  CreateCustomerRequest,
  OrderSummaryDTO,
  MembershipTier,
  OrderEntryMode,
  OrderWorkflowType,
} from '@growfast/shared-types';
import { apiClient, ApiError } from '../../src/api/client';
import { useNetworkStatus } from '../../src/hooks/useNetworkStatus';
import { useAuth } from '../../src/contexts/AuthContext';
import { getUserSession, MobileUserSession } from '../../src/storage/secure-store';
import { OrderWizardModal } from '../../src/components/wizard/OrderWizardModal';
import { OrderDetailModal } from '../../src/components/OrderDetailModal';

export default function CustomersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isConnected } = useNetworkStatus();
  const { user: authUser, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const session = authUser;

  // Tab: 'FIND' | 'NEW'
  const [activeTab, setActiveTab] = useState<'FIND' | 'NEW'>('FIND');

  // Search & Directory State
  const [searchQuery, setSearchQuery] = useState('');
  const [customers, setCustomers] = useState<CustomerDTO[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const PAGE_SIZE = 20;

  // Stale request prevention ref
  const searchRequestIdRef = useRef(0);

  // Customer Detail & Order History Modal State
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDTO | null>(null);
  const [customerOrders, setCustomerOrders] = useState<OrderSummaryDTO[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [orderHistoryError, setOrderHistoryError] = useState<string | null>(null);

  // Order History Filter & Pagination State (Workstream 1)
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('ALL');
  const [orderPaymentFilter, setOrderPaymentFilter] = useState<string>('ALL');
  const [orderHistoryPage, setOrderHistoryPage] = useState(1);
  const [totalOrderCount, setTotalOrderCount] = useState(0);
  const [hasMoreOrders, setHasMoreOrders] = useState(false);
  const [isLoadingMoreOrders, setIsLoadingMoreOrders] = useState(false);

  // Stale request prevention refs
  const orderHistoryRequestIdRef = useRef(0);
  const selectedCustomerIdRef = useRef<string | null>(null);

  // Order Detail Inspection Modal State
  const [viewingOrderId, setViewingOrderId] = useState<string | null>(null);

  // Wizard Launch state with Target Customer and Modes (Task 6)
  const [wizardVisible, setWizardVisible] = useState(false);
  const [orderTargetCustomer, setOrderTargetCustomer] = useState<CustomerDTO | null>(null);
  const [orderTargetMode, setOrderTargetMode] = useState<OrderEntryMode>('PIECES');
  const [orderTargetWorkflow, setOrderTargetWorkflow] = useState<OrderWorkflowType>('LAUNDRY');

  // New Customer Form State (Strictly Name, WhatsApp Phone, Address, Pincode)
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newPincode, setNewPincode] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    phone?: string;
    address?: string;
    pincode?: string;
  }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  /**
   * Fetch customer directory with pagination and stale response protection.
   */
  const loadCustomers = useCallback(
    async (query: string = '', page: number = 1, isRefresh: boolean = false) => {
      if (!isAuthenticated || isAuthLoading) {
        setCustomers([]);
        setIsLoading(false);
        setIsRefreshing(false);
        setIsLoadingMore(false);
        return;
      }

      const requestId = ++searchRequestIdRef.current;

      if (page === 1) {
        if (isRefresh) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }
        setSearchError(null);
      } else {
        setIsLoadingMore(true);
      }

      try {
        const response = await apiClient.customers.search(
          query.trim() || undefined,
          page,
          PAGE_SIZE,
        );

        // Ignore stale network response if user typed a newer query in the meantime
        if (requestId !== searchRequestIdRef.current) {
          return;
        }

        const newItems = response?.data || [];
        const total = response?.total ?? newItems.length;

        if (page === 1) {
          setCustomers(newItems);
        } else {
          setCustomers((prev) => [...prev, ...newItems]);
        }

        setCurrentPage(page);
        setTotalCustomers(total);
        setHasMore(page * PAGE_SIZE < total);
        setSearchError(null);
      } catch (err: any) {
        if (requestId !== searchRequestIdRef.current) {
          return;
        }
        const errorMsg =
          err?.message || 'Unable to connect to server. Please check your network and retry.';
        setSearchError(errorMsg);
        if (page === 1 && !isRefresh) {
          setCustomers([]);
        }
      } finally {
        if (requestId === searchRequestIdRef.current) {
          setIsLoading(false);
          setIsRefreshing(false);
          setIsLoadingMore(false);
        }
      }
    },
    [isAuthenticated, isAuthLoading],
  );

  // Debounced search effect
  useEffect(() => {
    if (!isAuthenticated || isAuthLoading) {
      setCustomers([]);
      return;
    }
    const timer = setTimeout(() => {
      loadCustomers(searchQuery, 1, false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, loadCustomers, isAuthenticated, isAuthLoading]);

  const onRefresh = () => {
    if (!isAuthenticated || isAuthLoading) return;
    loadCustomers(searchQuery, 1, true);
  };

  const onLoadMore = () => {
    if (!isAuthenticated || isAuthLoading) return;
    if (!isLoading && !isLoadingMore && hasMore) {
      loadCustomers(searchQuery, currentPage + 1, false);
    }
  };

  /**
   * Load customer order history with search, status/payment filters, pagination, and race protection.
   */
  const loadCustomerOrderHistory = useCallback(
    async (
      customerId: string,
      page: number = 1,
      append: boolean = false,
      search: string = '',
      status: string = 'ALL',
      paymentStatus: string = 'ALL',
    ) => {
      if (!isAuthenticated || isAuthLoading) {
        setCustomerOrders([]);
        setLoadingOrders(false);
        setIsLoadingMoreOrders(false);
        return;
      }

      const requestId = ++orderHistoryRequestIdRef.current;
      selectedCustomerIdRef.current = customerId;

      if (page === 1) {
        setLoadingOrders(true);
        setOrderHistoryError(null);
      } else {
        setIsLoadingMoreOrders(true);
      }

      try {
        const res = await apiClient.orders.list({
          customerId,
          page,
          pageSize: 10,
          search: search.trim() || undefined,
          status: status === 'ALL' ? undefined : status,
          paymentStatus: paymentStatus === 'ALL' ? undefined : paymentStatus,
        });

        // Guard against stale response if user switched customer or query in the meantime
        if (
          requestId !== orderHistoryRequestIdRef.current ||
          selectedCustomerIdRef.current !== customerId
        ) {
          return;
        }

        const items = res.data || [];
        const total = res.total ?? items.length;

        if (append) {
          setCustomerOrders((prev) => [...prev, ...items]);
        } else {
          setCustomerOrders(items);
        }

        setOrderHistoryPage(page);
        setTotalOrderCount(total);
        setHasMoreOrders(page * 10 < total);
        setOrderHistoryError(null);
      } catch (err: any) {
        if (
          requestId !== orderHistoryRequestIdRef.current ||
          selectedCustomerIdRef.current !== customerId
        ) {
          return;
        }
        const msg = err?.message || 'Could not load past orders for this customer.';
        setOrderHistoryError(msg);
        if (!append) {
          setCustomerOrders([]);
        }
      } finally {
        if (
          requestId === orderHistoryRequestIdRef.current &&
          selectedCustomerIdRef.current === customerId
        ) {
          setLoadingOrders(false);
          setIsLoadingMoreOrders(false);
        }
      }
    },
    [],
  );

  const handleSelectCustomer = (cust: CustomerDTO) => {
    selectedCustomerIdRef.current = cust.id;
    setSelectedCustomer(cust);
    setOrderSearchQuery('');
    setOrderStatusFilter('ALL');
    setOrderPaymentFilter('ALL');
    setOrderHistoryPage(1);
    setHasMoreOrders(false);
    loadCustomerOrderHistory(cust.id, 1, false, '', 'ALL', 'ALL');
  };

  // Debounced search and filter effect for customer order history
  useEffect(() => {
    if (!selectedCustomer) return;
    const timer = setTimeout(() => {
      loadCustomerOrderHistory(
        selectedCustomer.id,
        1,
        false,
        orderSearchQuery,
        orderStatusFilter,
        orderPaymentFilter,
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [
    selectedCustomer?.id,
    orderSearchQuery,
    orderStatusFilter,
    orderPaymentFilter,
    loadCustomerOrderHistory,
  ]);

  const handleLoadMoreOrders = () => {
    if (!selectedCustomer || loadingOrders || isLoadingMoreOrders || !hasMoreOrders) return;
    loadCustomerOrderHistory(
      selectedCustomer.id,
      orderHistoryPage + 1,
      true,
      orderSearchQuery,
      orderStatusFilter,
      orderPaymentFilter,
    );
  };

  const startPerPieceOrder = (cust: CustomerDTO) => {
    setOrderTargetCustomer(cust);
    setOrderTargetMode('PIECES');
    setOrderTargetWorkflow('LAUNDRY');
    setSelectedCustomer(null);
    setWizardVisible(true);
  };

  const startPerWeightOrder = (cust: CustomerDTO) => {
    setOrderTargetCustomer(cust);
    setOrderTargetMode('WEIGHT');
    setOrderTargetWorkflow('LAUNDRY');
    setSelectedCustomer(null);
    setWizardVisible(true);
  };

  const startDryCleanOrder = (cust: CustomerDTO) => {
    setOrderTargetCustomer(cust);
    setOrderTargetMode('PIECES');
    setOrderTargetWorkflow('DRY_CLEANING');
    setSelectedCustomer(null);
    setWizardVisible(true);
  };

  /**
   * Create Customer handler with mandatory address & pincode, phone validation, and duplicate conflict handling.
   */
  const handleCreateCustomer = async () => {
    setCreateError(null);
    const errors: { name?: string; phone?: string; address?: string; pincode?: string } = {};

    // 1. Name validation
    const trimmedName = newName.trim();
    if (!trimmedName) {
      errors.name = 'Customer Full Name is required.';
    }

    // 2. WhatsApp Phone validation: 10-15 digits matching backend contract
    const cleanPhone = newPhone.replace(/[\s\-()]/g, '');
    if (!cleanPhone) {
      errors.phone = 'WhatsApp Phone Number is required.';
    } else if (!/^\+?[0-9]{10,15}$/.test(cleanPhone)) {
      errors.phone = 'Please enter a valid WhatsApp phone number (10 to 15 digits).';
    }

    // 3. Address validation: mandatory
    const trimmedAddress = newAddress.trim();
    if (!trimmedAddress) {
      errors.address = 'Delivery / Street Address is required.';
    }

    // 4. Pincode validation: mandatory, 3-10 characters
    const trimmedPincode = newPincode.trim();
    if (!trimmedPincode) {
      errors.pincode = 'Pincode is required.';
    } else if (!/^[A-Za-z0-9\s\-]{3,10}$/.test(trimmedPincode)) {
      errors.pincode = 'Pincode must be between 3 and 10 characters.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);
    try {
      const payload: CreateCustomerRequest = {
        name: trimmedName,
        phone: cleanPhone,
        address: trimmedAddress,
        pincode: trimmedPincode,
      };

      const created = await apiClient.customers.create(payload);

      // Reset form fields
      setNewName('');
      setNewPhone('');
      setNewAddress('');
      setNewPincode('');
      setFieldErrors({});
      setCreateError(null);

      // Switch to directory, reload list, and select the newly created customer for immediate order creation
      setActiveTab('FIND');
      loadCustomers('', 1, false);
      handleSelectCustomer(created);

      Alert.alert(
        'Customer Registered',
        `"${created.name}" has been successfully added and is ready for order creation.`,
      );
    } catch (err: any) {
      const isConflict =
        err?.statusCode === 409 ||
        err?.message?.toLowerCase().includes('already exists') ||
        err?.data?.message?.toLowerCase().includes('already exists');

      const message = isConflict
        ? `A customer with phone number "${cleanPhone}" is already registered. Please search for the existing record or verify the number.`
        : err?.message || 'Customer creation failed. Please check your network and retry.';

      setCreateError(message);
      if (isConflict) {
        setFieldErrors((prev) => ({ ...prev, phone: message }));
      }
      Alert.alert(isConflict ? 'Duplicate Customer' : 'Registration Error', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Avatar color helper matching Screen 3 pastel palette.
   */
  const getAvatarColor = (name: string) => {
    const colors = [
      { bg: '#ede9fe', text: '#6d28d9' }, // Purple
      { bg: '#dbeafe', text: '#1d4ed8' }, // Blue
      { bg: '#fce7f3', text: '#be185d' }, // Pink
      { bg: '#fef3c7', text: '#b45309' }, // Amber
      { bg: '#dcfce7', text: '#15803d' }, // Green
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
    return colors[Math.abs(hash) % colors.length];
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return (name.slice(0, 2) || 'CU').toUpperCase();
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.container, { paddingTop: Math.max(insets.top, 12) }]}>
        {/* Header matching Screen 3 */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Customers</Text>
          <Text style={styles.headerSubtitle}>Directory & Quick Order Intake</Text>
        </View>

        {/* Segmented Control matching Screen 3 */}
        <View style={styles.segmentContainer}>
          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'FIND' && styles.segmentBtnActive]}
            onPress={() => setActiveTab('FIND')}
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'FIND' }}
          >
            <Text
              style={[styles.segmentBtnText, activeTab === 'FIND' && styles.segmentBtnTextActive]}
            >
              Find Existing
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'NEW' && styles.segmentBtnActive]}
            onPress={() => setActiveTab('NEW')}
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'NEW' }}
          >
            <Text
              style={[styles.segmentBtnText, activeTab === 'NEW' && styles.segmentBtnTextActive]}
            >
              + New Customer
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'FIND' ? (
          <View style={{ flex: 1 }}>
            {/* Search Bar matching Screen 3 */}
            <View style={styles.searchBarWrapper}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name, phone, or customer code..."
                placeholderTextColor="#94a3b8"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                clearButtonMode="while-editing"
                returnKeyType="search"
              />
              {searchQuery ? (
                <TouchableOpacity
                  style={styles.clearBtn}
                  onPress={() => setSearchQuery('')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.clearSearchIcon}>✕</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.clearBtn}>
                  <Text style={styles.scanIcon}>⊡</Text>
                </View>
              )}
            </View>

            {/* List Header */}
            <View style={styles.listHeaderRow}>
              <Text style={styles.listHeaderTitle}>
                {searchQuery.trim()
                  ? `Search Results (${totalCustomers})`
                  : `All Customers (${totalCustomers})`}
              </Text>
              {searchQuery.trim() ? (
                <TouchableOpacity style={styles.actionLinkTouch} onPress={() => setSearchQuery('')}>
                  <Text style={styles.viewAllText}>Clear Search</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.actionLinkTouch}
                  onPress={() => loadCustomers('', 1, false)}
                >
                  <Text style={styles.viewAllText}>Refresh</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Error Banner with Retry */}
            {searchError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠️ {searchError}</Text>
                <TouchableOpacity
                  style={styles.retryBtn}
                  onPress={() => loadCustomers(searchQuery, 1, false)}
                >
                  <Text style={styles.retryBtnText}>↻ Retry</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Loading Indicator */}
            {isLoading && !isRefreshing ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color="#2563eb" />
                <Text style={styles.loadingText}>Searching customer directory...</Text>
              </View>
            ) : customers.length === 0 && !searchError ? (
              /* Empty State */
              <View style={styles.emptyBox}>
                <Text style={styles.emptyEmoji}>👥</Text>
                <Text style={styles.emptyTitle}>
                  {searchQuery.trim() ? 'No Customers Found' : 'No Customers Registered'}
                </Text>
                <Text style={styles.emptySub}>
                  {searchQuery.trim()
                    ? `No matches found for "${searchQuery}". Tap below to register a new customer.`
                    : 'The directory is empty. Register your first customer to get started.'}
                </Text>
                <TouchableOpacity
                  style={styles.emptyActionBtn}
                  onPress={() => {
                    const cleanPhoneInput = searchQuery.replace(/\D/g, '').trim();
                    const cleanNameInput = searchQuery.replace(/[0-9+]/g, '').trim();
                    if (cleanPhoneInput.length >= 5) {
                      setNewPhone(cleanPhoneInput);
                    } else if (cleanNameInput) {
                      setNewName(cleanNameInput);
                    }
                    setActiveTab('NEW');
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.emptyActionBtnText}>
                    + Add {searchQuery.trim() ? `"${searchQuery.trim()}"` : 'New Customer'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* Paginated Customer List */
              <FlatList
                data={customers}
                keyExtractor={(item) => item.id}
                refreshControl={
                  <RefreshControl
                    refreshing={isRefreshing}
                    onRefresh={onRefresh}
                    colors={['#2563eb']}
                  />
                }
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
                onEndReached={onLoadMore}
                onEndReachedThreshold={0.3}
                ListFooterComponent={
                  isLoadingMore ? (
                    <View style={styles.loadingMoreBox}>
                      <ActivityIndicator size="small" color="#2563eb" />
                      <Text style={styles.loadingMoreText}>Loading more customers...</Text>
                    </View>
                  ) : null
                }
                renderItem={({ item }) => {
                  const avatar = getAvatarColor(item.name);
                  const initials = getInitials(item.name);
                  const hasMembership = item.membership && item.membership !== MembershipTier.NONE;
                  return (
                    <TouchableOpacity
                      style={styles.customerCard}
                      onPress={() => handleSelectCustomer(item)}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={`View customer ${item.name}`}
                    >
                      <View style={[styles.avatarCircle, { backgroundColor: avatar.bg }]}>
                        <Text style={[styles.avatarText, { color: avatar.text }]}>{initials}</Text>
                      </View>
                      <View style={{ flex: 1, paddingHorizontal: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.custName} numberOfLines={1}>
                            {item.name}
                          </Text>
                          {hasMembership ? (
                            <View style={styles.memberTagSmall}>
                              <Text style={styles.memberTagSmallText}>{item.membership}</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.custPhone}>{item.phone}</Text>
                        {item.customerCode ? (
                          <Text style={styles.custCodeText}>#{item.customerCode}</Text>
                        ) : null}
                      </View>
                      <View style={styles.chevronBox}>
                        <Text style={styles.chevron}>›</Text>
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        ) : (
          /* New Customer Form */
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.formContainer}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.formCard}>
                <Text style={styles.formTitle}>Add New Customer</Text>
                <Text style={styles.formSubtitle}>Quickly register walk-in or phone customer</Text>

                {createError ? (
                  <View style={styles.formErrorBox}>
                    <Text style={styles.formErrorText}>⚠️ {createError}</Text>
                  </View>
                ) : null}

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Full Name *</Text>
                  <TextInput
                    style={[styles.formInput, fieldErrors.name && styles.inputError]}
                    placeholder="e.g. Rahul Sharma"
                    placeholderTextColor="#94a3b8"
                    value={newName}
                    onChangeText={(val) => {
                      setNewName(val);
                      if (fieldErrors.name)
                        setFieldErrors((prev) => ({ ...prev, name: undefined }));
                    }}
                    autoCapitalize="words"
                  />
                  {fieldErrors.name ? (
                    <Text style={styles.fieldErrorText}>{fieldErrors.name}</Text>
                  ) : null}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>WhatsApp Phone Number *</Text>
                  <TextInput
                    style={[styles.formInput, fieldErrors.phone && styles.inputError]}
                    placeholder="e.g. 9876543210 (10-15 digits)"
                    placeholderTextColor="#94a3b8"
                    keyboardType="phone-pad"
                    maxLength={16}
                    value={newPhone}
                    onChangeText={(val) => {
                      setNewPhone(val);
                      if (fieldErrors.phone)
                        setFieldErrors((prev) => ({ ...prev, phone: undefined }));
                    }}
                  />
                  {fieldErrors.phone ? (
                    <Text style={styles.fieldErrorText}>{fieldErrors.phone}</Text>
                  ) : null}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Address *</Text>
                  <TextInput
                    style={[
                      styles.formInput,
                      { height: 72, textAlignVertical: 'top', paddingTop: 10 },
                      fieldErrors.address && styles.inputError,
                    ]}
                    placeholder="House/Flat, Street, Area"
                    placeholderTextColor="#94a3b8"
                    multiline
                    value={newAddress}
                    onChangeText={(val) => {
                      setNewAddress(val);
                      if (fieldErrors.address)
                        setFieldErrors((prev) => ({ ...prev, address: undefined }));
                    }}
                  />
                  {fieldErrors.address ? (
                    <Text style={styles.fieldErrorText}>{fieldErrors.address}</Text>
                  ) : null}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Pincode *</Text>
                  <TextInput
                    style={[styles.formInput, fieldErrors.pincode && styles.inputError]}
                    placeholder="e.g. 411001"
                    placeholderTextColor="#94a3b8"
                    keyboardType="default"
                    maxLength={10}
                    value={newPincode}
                    onChangeText={(val) => {
                      setNewPincode(val);
                      if (fieldErrors.pincode)
                        setFieldErrors((prev) => ({ ...prev, pincode: undefined }));
                    }}
                  />
                  {fieldErrors.pincode ? (
                    <Text style={styles.fieldErrorText}>{fieldErrors.pincode}</Text>
                  ) : null}
                </View>

                <TouchableOpacity
                  style={[styles.submitCustomerBtn, isSubmitting && styles.btnDisabled]}
                  onPress={handleCreateCustomer}
                  disabled={isSubmitting}
                  activeOpacity={0.8}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.submitCustomerBtnText}>Create Customer Record →</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        )}

        {/* Customer Detail & Order History Profile Modal */}
        {selectedCustomer ? (
          <Modal
            visible={!!selectedCustomer}
            transparent={true}
            animationType="slide"
            onRequestClose={() => {
              selectedCustomerIdRef.current = null;
              setSelectedCustomer(null);
            }}
          >
            <View style={styles.modalBackdrop}>
              <View style={styles.detailCard}>
                {/* Header */}
                <View style={styles.detailCardHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View
                      style={[
                        styles.avatarCircleLarge,
                        { backgroundColor: getAvatarColor(selectedCustomer.name).bg },
                      ]}
                    >
                      <Text
                        style={[
                          styles.avatarTextLarge,
                          { color: getAvatarColor(selectedCustomer.name).text },
                        ]}
                      >
                        {getInitials(selectedCustomer.name)}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.detailName} numberOfLines={1}>
                        {selectedCustomer.name}
                      </Text>
                      <Text style={styles.detailPhone}>{selectedCustomer.phone}</Text>
                      {selectedCustomer.customerCode ? (
                        <Text style={styles.detailCode}>ID: #{selectedCustomer.customerCode}</Text>
                      ) : null}
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.modalCloseBtn}
                    onPress={() => {
                      selectedCustomerIdRef.current = null;
                      setSelectedCustomer(null);
                    }}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Text style={styles.modalCloseText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false}>
                  {/* Membership & Discount Badges */}
                  <View style={styles.badgesRow}>
                    {selectedCustomer.membership &&
                    selectedCustomer.membership !== MembershipTier.NONE ? (
                      <View style={styles.badgePillGold}>
                        <Text style={styles.badgeTextGold}>
                          ⭐ {selectedCustomer.membership} MEMBER
                        </Text>
                      </View>
                    ) : null}
                    {selectedCustomer.discountPercent && selectedCustomer.discountPercent > 0 ? (
                      <View style={styles.badgePillDiscount}>
                        <Text style={styles.badgeTextDiscount}>
                          🏷️ {selectedCustomer.discountPercent}% OFF
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Address Snippet */}
                  {selectedCustomer.address ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>📍 Address</Text>
                      <Text style={styles.detailVal}>
                        {selectedCustomer.address}
                        {selectedCustomer.pincode ? ` - ${selectedCustomer.pincode}` : ''}
                      </Text>
                    </View>
                  ) : null}

                  {/* Order History Section (Workstream 1) */}
                  <View style={styles.orderHistoryHeaderRow}>
                    <Text style={styles.orderHistoryTitle}>
                      Order History {totalOrderCount > 0 ? `(${totalOrderCount})` : ''}
                    </Text>
                    <TouchableOpacity
                      onPress={() =>
                        loadCustomerOrderHistory(
                          selectedCustomer.id,
                          1,
                          false,
                          orderSearchQuery,
                          orderStatusFilter,
                          orderPaymentFilter,
                        )
                      }
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.orderHistoryRefreshText}>↻ Refresh</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Order History Search Bar */}
                  <View style={styles.orderSearchWrapper}>
                    <Text style={styles.orderSearchIcon}>🔍</Text>
                    <TextInput
                      style={styles.orderSearchInput}
                      placeholder="Search order # (e.g. 1024)..."
                      placeholderTextColor="#94a3b8"
                      value={orderSearchQuery}
                      onChangeText={setOrderSearchQuery}
                      autoCapitalize="characters"
                      clearButtonMode="while-editing"
                      returnKeyType="search"
                    />
                    {orderSearchQuery ? (
                      <TouchableOpacity
                        style={styles.orderClearBtn}
                        onPress={() => setOrderSearchQuery('')}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={styles.orderClearIcon}>✕</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {/* Order Status & Payment Filter Chips */}
                  <View style={styles.orderFilterContainer}>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.filterChipScroll}
                    >
                      <TouchableOpacity
                        style={[
                          styles.filterChip,
                          orderStatusFilter === 'ALL' && styles.filterChipActive,
                        ]}
                        onPress={() => setOrderStatusFilter('ALL')}
                      >
                        <Text
                          style={[
                            styles.filterChipText,
                            orderStatusFilter === 'ALL' && styles.filterChipTextActive,
                          ]}
                        >
                          All Status
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.filterChip,
                          orderStatusFilter === 'READY' && styles.filterChipActive,
                        ]}
                        onPress={() => setOrderStatusFilter('READY')}
                      >
                        <Text
                          style={[
                            styles.filterChipText,
                            orderStatusFilter === 'READY' && styles.filterChipTextActive,
                          ]}
                        >
                          Ready
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.filterChip,
                          orderStatusFilter === 'PROCESSING' && styles.filterChipActive,
                        ]}
                        onPress={() => setOrderStatusFilter('PROCESSING')}
                      >
                        <Text
                          style={[
                            styles.filterChipText,
                            orderStatusFilter === 'PROCESSING' && styles.filterChipTextActive,
                          ]}
                        >
                          Processing
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.filterChip,
                          orderStatusFilter === 'DELIVERED' && styles.filterChipActive,
                        ]}
                        onPress={() => setOrderStatusFilter('DELIVERED')}
                      >
                        <Text
                          style={[
                            styles.filterChipText,
                            orderStatusFilter === 'DELIVERED' && styles.filterChipTextActive,
                          ]}
                        >
                          Delivered
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.filterChip,
                          orderStatusFilter === 'CANCELLED' && styles.filterChipActive,
                        ]}
                        onPress={() => setOrderStatusFilter('CANCELLED')}
                      >
                        <Text
                          style={[
                            styles.filterChipText,
                            orderStatusFilter === 'CANCELLED' && styles.filterChipTextActive,
                          ]}
                        >
                          Cancelled
                        </Text>
                      </TouchableOpacity>

                      <View style={styles.filterChipDivider} />

                      <TouchableOpacity
                        style={[
                          styles.filterChip,
                          orderPaymentFilter === 'ALL' && styles.filterChipActive,
                        ]}
                        onPress={() => setOrderPaymentFilter('ALL')}
                      >
                        <Text
                          style={[
                            styles.filterChipText,
                            orderPaymentFilter === 'ALL' && styles.filterChipTextActive,
                          ]}
                        >
                          All Pay
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.filterChip,
                          orderPaymentFilter === 'PENDING' && styles.filterChipActive,
                        ]}
                        onPress={() => setOrderPaymentFilter('PENDING')}
                      >
                        <Text
                          style={[
                            styles.filterChipText,
                            orderPaymentFilter === 'PENDING' && styles.filterChipTextActive,
                          ]}
                        >
                          Pending Due
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.filterChip,
                          orderPaymentFilter === 'PAID' && styles.filterChipActive,
                        ]}
                        onPress={() => setOrderPaymentFilter('PAID')}
                      >
                        <Text
                          style={[
                            styles.filterChipText,
                            orderPaymentFilter === 'PAID' && styles.filterChipTextActive,
                          ]}
                        >
                          Paid
                        </Text>
                      </TouchableOpacity>
                    </ScrollView>
                  </View>

                  {loadingOrders ? (
                    <View style={styles.orderLoadingBox}>
                      <ActivityIndicator size="small" color="#2563eb" />
                      <Text style={styles.orderLoadingText}>Loading customer order history...</Text>
                    </View>
                  ) : orderHistoryError ? (
                    <View style={styles.orderErrorBox}>
                      <Text style={styles.orderErrorText}>⚠️ {orderHistoryError}</Text>
                      <TouchableOpacity
                        style={styles.retryOrderBtn}
                        onPress={() =>
                          loadCustomerOrderHistory(
                            selectedCustomer.id,
                            1,
                            false,
                            orderSearchQuery,
                            orderStatusFilter,
                            orderPaymentFilter,
                          )
                        }
                      >
                        <Text style={styles.retryOrderBtnText}>↻ Retry History</Text>
                      </TouchableOpacity>
                    </View>
                  ) : customerOrders.length > 0 ? (
                    <View style={styles.orderListBox}>
                      {customerOrders.map((ord) => {
                        const paidAmount =
                          ord.amountPaid ?? Math.max(0, ord.totalAmount - (ord.amountDue ?? 0));
                        const hasDue = ord.amountDue != null && ord.amountDue > 0;

                        return (
                          <TouchableOpacity
                            key={ord.id}
                            style={styles.orderItemCard}
                            onPress={() => setViewingOrderId(ord.id)}
                            activeOpacity={0.7}
                            accessibilityRole="button"
                            accessibilityLabel={`View order ${ord.orderNumber}`}
                          >
                            <View style={styles.orderItemGarmentBox}>
                              <Text style={styles.orderItemEmoji}>👔</Text>
                            </View>
                            <View style={{ flex: 1, paddingHorizontal: 10 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={styles.orderItemNumber}>#{ord.orderNumber}</Text>
                                <View
                                  style={[
                                    styles.orderStatusChip,
                                    ord.status === 'READY'
                                      ? styles.chipReady
                                      : ord.status === 'DELIVERED'
                                        ? styles.chipDelivered
                                        : ord.status === 'CANCELLED'
                                          ? styles.chipCancelled
                                          : styles.chipProcess,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.orderStatusChipText,
                                      ord.status === 'READY'
                                        ? styles.chipTextReady
                                        : ord.status === 'DELIVERED'
                                          ? styles.chipTextDelivered
                                          : ord.status === 'CANCELLED'
                                            ? styles.chipTextCancelled
                                            : styles.chipTextProcess,
                                    ]}
                                  >
                                    {ord.status}
                                  </Text>
                                </View>
                              </View>
                              <Text style={styles.orderItemDate}>{formatDate(ord.orderDate)}</Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                              <Text style={styles.orderItemTotal}>
                                ₹{ord.totalAmount.toFixed(0)}
                              </Text>
                              <View style={styles.orderFinancialSummary}>
                                <Text style={styles.orderItemPaidText}>
                                  Paid: ₹{paidAmount.toFixed(0)}
                                </Text>
                                {hasDue ? (
                                  <Text style={styles.orderItemDueText}>
                                    Due: ₹{ord.amountDue?.toFixed(0)}
                                  </Text>
                                ) : (
                                  <Text style={styles.orderItemSettledText}>✓ Settled</Text>
                                )}
                              </View>
                            </View>
                          </TouchableOpacity>
                        );
                      })}

                      {/* Pagination: Load More Orders */}
                      {hasMoreOrders ? (
                        <TouchableOpacity
                          style={styles.loadMoreOrdersBtn}
                          onPress={handleLoadMoreOrders}
                          disabled={isLoadingMoreOrders}
                          activeOpacity={0.8}
                        >
                          {isLoadingMoreOrders ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <ActivityIndicator size="small" color="#2563eb" />
                              <Text style={styles.loadMoreOrdersText}>Loading more orders...</Text>
                            </View>
                          ) : (
                            <Text style={styles.loadMoreOrdersText}>
                              Load More Orders ({customerOrders.length} of {totalOrderCount}) ↓
                            </Text>
                          )}
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ) : (
                    <View style={styles.noOrdersBox}>
                      <Text style={styles.noOrdersEmoji}>📦</Text>
                      <Text style={styles.noOrdersText}>
                        {orderSearchQuery.trim() ||
                        orderStatusFilter !== 'ALL' ||
                        orderPaymentFilter !== 'ALL'
                          ? 'No orders match your filter criteria.'
                          : 'No past orders recorded for this customer.'}
                      </Text>
                      {orderSearchQuery.trim() ||
                      orderStatusFilter !== 'ALL' ||
                      orderPaymentFilter !== 'ALL' ? (
                        <TouchableOpacity
                          style={styles.clearOrderFiltersBtn}
                          onPress={() => {
                            setOrderSearchQuery('');
                            setOrderStatusFilter('ALL');
                            setOrderPaymentFilter('ALL');
                          }}
                        >
                          <Text style={styles.clearOrderFiltersText}>Clear Filters</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  )}
                </ScrollView>

                {/* Order Action Buttons: 3 Specific Options matching Website Rules */}
                <View style={styles.orderActionsContainer}>
                  <Text style={styles.orderActionsTitle}>
                    Create Order for {selectedCustomer.name}:
                  </Text>
                  <View style={styles.orderActionsRow}>
                    <TouchableOpacity
                      style={styles.perPieceActionBtn}
                      onPress={() => startPerPieceOrder(selectedCustomer)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.actionBtnIcon}>👕</Text>
                      <Text style={styles.perPieceActionText}>Per-Piece</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.perWeightActionBtn}
                      onPress={() => startPerWeightOrder(selectedCustomer)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.actionBtnIcon}>⚖️</Text>
                      <Text style={styles.perWeightActionText}>Per-Weight</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.dryCleanActionBtn}
                      onPress={() => startDryCleanOrder(selectedCustomer)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.actionBtnIcon}>✨</Text>
                      <Text style={styles.dryCleanActionText}>Dry Clean</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          </Modal>
        ) : null}

        {/* Order Wizard Modal integration (Developer B boundary preserved) */}
        <OrderWizardModal
          visible={wizardVisible}
          draft={null}
          initialCustomer={orderTargetCustomer}
          initialEntryMode={orderTargetMode}
          initialWorkflow={orderTargetWorkflow}
          storeId={session?.storeId || 'store-kp-001'}
          userRole={session?.role || 'COUNTER'}
          onClose={() => {
            setWizardVisible(false);
            setOrderTargetCustomer(null);
          }}
          onOrderSavedOrSubmitted={() => {
            setWizardVisible(false);
            setOrderTargetCustomer(null);
            router.push('/(tabs)/orders');
          }}
          onViewOrderDetail={(orderId) => {
            setWizardVisible(false);
            setViewingOrderId(orderId);
          }}
        />

        {/* Direct Order Inspection Modal */}
        <OrderDetailModal
          visible={!!viewingOrderId}
          orderId={viewingOrderId}
          onClose={() => setViewingOrderId(null)}
          onOrderUpdated={() => {
            if (selectedCustomer) {
              loadCustomerOrderHistory(
                selectedCustomer.id,
                orderHistoryPage,
                false,
                orderSearchQuery,
                orderStatusFilter,
                orderPaymentFilter,
              );
            }
          }}
        />
      </View>
    </SafeAreaView>
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: '#ffffff',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 14,
    padding: 4,
  },
  segmentBtn: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  segmentBtnActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  segmentBtnTextActive: {
    color: '#2563eb',
    fontWeight: '700',
  },
  searchBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    height: 48,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
    height: '100%',
  },
  clearBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearSearchIcon: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: 'bold',
  },
  scanIcon: {
    fontSize: 18,
    color: '#64748b',
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  listHeaderTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  actionLinkTouch: {
    minHeight: 44,
    justifyContent: 'center',
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563eb',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  customerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
    minHeight: 64,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
  },
  custName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    flexShrink: 1,
  },
  custPhone: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  custCodeText: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 1,
    fontWeight: '500',
  },
  memberTagSmall: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  memberTagSmallText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#b45309',
  },
  chevronBox: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevron: {
    fontSize: 22,
    color: '#cbd5e1',
    fontWeight: '300',
  },
  errorBox: {
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 12,
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 13,
    flex: 1,
    marginRight: 8,
  },
  retryBtn: {
    minHeight: 44,
    paddingHorizontal: 12,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  loadingBox: {
    padding: 30,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 8,
  },
  loadingMoreBox: {
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  loadingMoreText: {
    fontSize: 12,
    color: '#64748b',
  },
  emptyBox: {
    padding: 36,
    alignItems: 'center',
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  emptySub: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  emptyActionBtn: {
    marginTop: 16,
    minHeight: 44,
    backgroundColor: '#eff6ff',
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyActionBtnText: {
    color: '#1d4ed8',
    fontSize: 13,
    fontWeight: '700',
  },
  formContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  formSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
    marginBottom: 16,
  },
  formErrorBox: {
    backgroundColor: '#fef2f2',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
    marginBottom: 14,
  },
  formErrorText: {
    color: '#b91c1c',
    fontSize: 13,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 6,
  },
  formInput: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#0f172a',
  },
  inputError: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  fieldErrorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  tierSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tierBtn: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tierBtnSelected: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  tierBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  tierBtnTextSelected: {
    color: '#ffffff',
    fontWeight: '700',
  },
  submitCustomerBtn: {
    minHeight: 50,
    borderRadius: 25,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  submitCustomerBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  btnDisabled: {
    backgroundColor: '#93c5fd',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  detailCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '85%',
  },
  detailCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 12,
  },
  avatarCircleLarge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTextLarge: {
    fontSize: 20,
    fontWeight: '800',
  },
  detailName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  detailPhone: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  detailCode: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 1,
    fontWeight: '500',
  },
  modalCloseBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#94a3b8',
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  badgePillGold: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeTextGold: {
    fontSize: 11,
    fontWeight: '700',
    color: '#b45309',
  },
  badgePillDiscount: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeTextDiscount: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803d',
  },
  detailRow: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  detailVal: {
    fontSize: 13,
    fontWeight: '500',
    color: '#0f172a',
    marginTop: 2,
  },
  orderHistoryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderHistoryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  orderHistoryRefreshText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563eb',
  },
  orderLoadingBox: {
    paddingVertical: 18,
    alignItems: 'center',
    gap: 6,
  },
  orderLoadingText: {
    fontSize: 12,
    color: '#64748b',
  },
  orderErrorBox: {
    padding: 12,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  orderErrorText: {
    color: '#b91c1c',
    fontSize: 12,
    flex: 1,
    marginRight: 6,
  },
  retryOrderBtn: {
    minHeight: 44,
    backgroundColor: '#ef4444',
    paddingHorizontal: 10,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryOrderBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  orderListBox: {
    paddingVertical: 2,
  },
  orderSearchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 10,
    height: 38,
    marginBottom: 8,
  },
  orderSearchIcon: {
    fontSize: 13,
    marginRight: 6,
  },
  orderSearchInput: {
    flex: 1,
    fontSize: 12,
    color: '#0f172a',
    height: '100%',
  },
  orderClearBtn: {
    padding: 4,
  },
  orderClearIcon: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: 'bold',
  },
  orderFilterContainer: {
    marginBottom: 8,
  },
  filterChipScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterChipActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  filterChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  filterChipDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#cbd5e1',
    marginHorizontal: 4,
  },
  orderItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    minHeight: 52,
  },
  orderItemGarmentBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderItemEmoji: {
    fontSize: 18,
  },
  orderItemNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  orderItemDate: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  orderStatusChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  chipReady: {
    backgroundColor: '#e0f2fe',
  },
  chipTextReady: {
    color: '#0284c7',
    fontSize: 10,
    fontWeight: '700',
  },
  chipDelivered: {
    backgroundColor: '#dcfce7',
  },
  chipTextDelivered: {
    color: '#15803d',
    fontSize: 10,
    fontWeight: '700',
  },
  chipProcess: {
    backgroundColor: '#fef3c7',
  },
  chipTextProcess: {
    color: '#b45309',
    fontSize: 10,
    fontWeight: '700',
  },
  chipCancelled: {
    backgroundColor: '#fee2e2',
  },
  chipTextCancelled: {
    color: '#b91c1c',
    fontSize: 10,
    fontWeight: '700',
  },
  orderStatusChipText: {
    fontSize: 10,
    fontWeight: '700',
  },
  orderItemTotal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  orderFinancialSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  orderItemPaidText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#16a34a',
  },
  orderItemDueText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#dc2626',
  },
  orderItemSettledText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
  },
  loadMoreOrdersBtn: {
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  loadMoreOrdersText: {
    color: '#2563eb',
    fontSize: 12,
    fontWeight: '700',
  },
  noOrdersBox: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  noOrdersEmoji: {
    fontSize: 28,
    marginBottom: 6,
  },
  noOrdersText: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
  },
  clearOrderFiltersBtn: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
  },
  clearOrderFiltersText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563eb',
  },
  startOrderBtn: {
    minHeight: 50,
    borderRadius: 25,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  startOrderBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  orderActionsContainer: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  orderActionsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
  },
  orderActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  perPieceActionBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    flexDirection: 'row',
    gap: 4,
  },
  perPieceActionText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  perWeightActionBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    flexDirection: 'row',
    gap: 4,
  },
  perWeightActionText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  dryCleanActionBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    flexDirection: 'row',
    gap: 4,
  },
  dryCleanActionText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  actionBtnIcon: {
    fontSize: 14,
  },
});
