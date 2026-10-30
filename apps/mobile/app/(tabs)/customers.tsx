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
import { CustomerProfileModal } from '../../src/components/CustomerProfileModal';

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

  // Customer Detail Modal State
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDTO | null>(null);
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

  const handleSelectCustomer = (cust: CustomerDTO) => {
    selectedCustomerIdRef.current = cust.id;
    setSelectedCustomer(cust);
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

        {/* Customer Detail & Order History Profile Modal (Screenshot 2 Target UI) */}
        <CustomerProfileModal
          visible={!!selectedCustomer}
          customer={selectedCustomer}
          onClose={() => {
            selectedCustomerIdRef.current = null;
            setSelectedCustomer(null);
          }}
          onCreatePerPieceOrder={(cust) => startPerPieceOrder(cust)}
          onCreatePerWeightOrder={(cust) => startPerWeightOrder(cust)}
          onViewOrder={(orderId) => {
            setViewingOrderId(orderId);
          }}
          onCustomerUpdated={(updated) => {
            setSelectedCustomer(updated);
            loadCustomers('', currentPage, false);
          }}
        />

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
            loadCustomers('', currentPage, false);
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
});
