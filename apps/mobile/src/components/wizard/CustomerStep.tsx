import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Platform,
  ScrollView,
} from 'react-native';
import { CustomerDTO, CreateCustomerRequest, MembershipTier } from '@growfast/shared-types';
import { apiClient } from '../../api/client';
import { WizardIcon } from './WizardIcon';

export interface CustomerStepProps {
  selectedCustomer: CustomerDTO | null;
  onSelectCustomer: (customer: CustomerDTO) => void;
  onClearCustomer: () => void;
  manualCustomerName: string;
  manualCustomerPhone: string;
  onChangeManualDetails: (name: string, phone: string) => void;
  isConnected: boolean;
}

export function CustomerStep({
  selectedCustomer,
  onSelectCustomer,
  onClearCustomer,
  manualCustomerName,
  manualCustomerPhone,
  onChangeManualDetails,
  isConnected,
}: CustomerStepProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CustomerDTO[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // New customer quick-create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newPincode, setNewPincode] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Debounced search
  useEffect(() => {
    if (!isConnected) {
      setSearchResults([]);
      return;
    }

    const trimmed = searchQuery.trim();
    if (!trimmed || trimmed.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    const timer = setTimeout(async () => {
      try {
        const resp = await apiClient.customers.search(trimmed, 1, 15);
        setSearchResults(resp.data || []);
      } catch (err: any) {
        setSearchError(err.message || 'Failed to search customers');
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery, isConnected]);

  const handleCreateCustomer = async () => {
    if (!newName.trim()) {
      Alert.alert('Validation', 'Customer Name is required');
      return;
    }
    const cleanPhone = newPhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      Alert.alert('Validation', 'Valid 10-digit WhatsApp phone number is required');
      return;
    }

    if (!isConnected) {
      onChangeManualDetails(newName.trim(), newPhone.trim());
      setShowCreateForm(false);
      Alert.alert(
        'Offline Mode',
        'Customer details recorded for local draft. Server account will be created or matched upon synchronization.',
      );
      return;
    }

    setIsCreating(true);
    try {
      const payload: CreateCustomerRequest = {
        name: newName.trim(),
        phone: newPhone.trim(),
        address: newAddress.trim() || undefined,
        pincode: newPincode.trim() || undefined,
      };
      const created = await apiClient.customers.create(payload);
      onSelectCustomer(created);
      setShowCreateForm(false);
      setNewName('');
      setNewPhone('');
      setNewAddress('');
      setNewPincode('');
    } catch (err: any) {
      Alert.alert('Customer Creation Error', err.message || 'Failed to create customer');
    } finally {
      setIsCreating(false);
    }
  };

  const getMembershipBadgeLabel = (tier?: MembershipTier | string | null) => {
    if (!tier || tier === 'NONE' || tier === 'STANDARD') return 'NONE';
    return String(tier).toUpperCase();
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. SELECTED CUSTOMER CARD (Matches Screenshot 1)
  // ─────────────────────────────────────────────────────────────────────────────
  if (selectedCustomer) {
    const badgeLabel = getMembershipBadgeLabel(selectedCustomer.membership);
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* Section Header: User Icon in soft blue box + Title */}
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionIconBox}>
            <WizardIcon name="person-outline" size={20} color="#0866F5" fallbackText="👤" />
          </View>
          <Text style={styles.sectionTitle}>Selected Customer</Text>
        </View>

        {/* Selected Customer Card */}
        <View style={styles.selectedCustomerCard}>
          {/* Top Row: Circular Avatar + Name + Membership Badge */}
          <View style={styles.cardTopRow}>
            <View style={styles.avatarCircle}>
              <WizardIcon name="person-outline" size={24} color="#0866F5" fallbackText="👤" />
            </View>
            <View style={styles.nameContainer}>
              <Text style={styles.customerNameText} numberOfLines={1}>
                {selectedCustomer.name}
              </Text>
            </View>
            <View style={styles.membershipPill}>
              <Text style={styles.membershipPillText}>{badgeLabel}</Text>
            </View>
          </View>

          {/* Details Rows */}
          <View style={styles.detailsGroup}>
            {/* Phone Row */}
            <View style={styles.detailRow}>
              <View style={styles.detailIconCircleBlue}>
                <WizardIcon name="call" size={15} color="#0866F5" fallbackText="📞" />
              </View>
              <Text style={styles.phoneText}>{selectedCustomer.phone}</Text>
            </View>

            {/* ID Row */}
            <View style={styles.detailRow}>
              <View style={styles.detailIconCircleBlue}>
                <WizardIcon name="id-card-outline" size={16} color="#0866F5" fallbackText="🪪" />
              </View>
              <Text style={styles.idText}>
                ID : {selectedCustomer.customerCode || selectedCustomer.id}
              </Text>
            </View>

            {/* Address Row */}
            {selectedCustomer.address ? (
              <View style={styles.detailRow}>
                <View style={styles.detailIconCircleRed}>
                  <WizardIcon name="location-sharp" size={16} color="#EF4444" fallbackText="📍" />
                </View>
                <Text style={styles.addressText} numberOfLines={2}>
                  {selectedCustomer.address}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Discount Banner if customer has discount */}
          {selectedCustomer.discountPercent > 0 && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountBadgeText}>
                🎉 {selectedCustomer.discountPercent}% Member Discount Applied
              </Text>
            </View>
          )}

          {/* Card Divider */}
          <View style={styles.cardDivider} />

          {/* Change Customer Button (Screenshot 1) */}
          <TouchableOpacity
            style={styles.changeCustomerButton}
            onPress={onClearCustomer}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Change selected customer"
          >
            <WizardIcon name="sync-outline" size={18} color="#0866F5" fallbackText="🔄" />
            <Text style={styles.changeCustomerButtonText}>Change Customer</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. MANUAL / OFFLINE CUSTOMER ENTERED
  // ─────────────────────────────────────────────────────────────────────────────
  if (manualCustomerName) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionIconBox}>
            <WizardIcon name="person-outline" size={20} color="#0866F5" fallbackText="👤" />
          </View>
          <Text style={styles.sectionTitle}>Selected Customer</Text>
        </View>

        <View style={styles.selectedCustomerCard}>
          <View style={styles.cardTopRow}>
            <View style={styles.avatarCircle}>
              <WizardIcon name="person-outline" size={24} color="#0866F5" fallbackText="👤" />
            </View>
            <View style={styles.nameContainer}>
              <Text style={styles.customerNameText}>{manualCustomerName}</Text>
            </View>
            <View style={styles.membershipPill}>
              <Text style={styles.membershipPillText}>OFFLINE</Text>
            </View>
          </View>

          <View style={styles.detailsGroup}>
            <View style={styles.detailRow}>
              <View style={styles.detailIconCircleBlue}>
                <WizardIcon name="call" size={15} color="#0866F5" fallbackText="📞" />
              </View>
              <Text style={styles.phoneText}>{manualCustomerPhone || 'No phone provided'}</Text>
            </View>
          </View>

          <View style={styles.cardDivider} />

          <TouchableOpacity
            style={styles.changeCustomerButton}
            onPress={onClearCustomer}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Change customer details"
          >
            <WizardIcon name="sync-outline" size={18} color="#0866F5" fallbackText="🔄" />
            <Text style={styles.changeCustomerButtonText}>Change Customer</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. SEARCH & SELECTION INTERFACE (EMPTY STATE)
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.sectionHeaderRow}>
        <View style={styles.sectionIconBox}>
          <WizardIcon name="search-outline" size={20} color="#0866F5" fallbackText="🔍" />
        </View>
        <Text style={styles.sectionTitle}>Find or Add Customer</Text>
      </View>

      {!isConnected && (
        <View style={styles.offlineNotice}>
          <Text style={styles.offlineNoticeTitle}>Device is Offline</Text>
          <Text style={styles.offlineNoticeText}>
            Customer search is unavailable offline. Enter customer details manually below to save to
            local draft.
          </Text>
        </View>
      )}

      {/* Search Input Box */}
      {isConnected && (
        <View style={styles.searchSection}>
          <Text style={styles.inputLabel}>Search by Name, WhatsApp, or Customer ID</Text>
          <View style={styles.searchInputContainer}>
            <WizardIcon name="search-outline" size={18} color="#94A3B8" fallbackText="🔍" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search phone or name..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
                <Text style={styles.clearSearchBtnText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {isSearching && (
            <View style={styles.searchingRow}>
              <ActivityIndicator size="small" color="#0866F5" />
              <Text style={styles.searchingText}>Searching customer registry...</Text>
            </View>
          )}

          {searchError ? <Text style={styles.errorText}>⚠️ {searchError}</Text> : null}
        </View>
      )}

      {/* Search Results List */}
      {searchResults.length > 0 && (
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsHeader}>Search Results ({searchResults.length})</Text>
          {searchResults.map((item) => {
            const badgeLabel = getMembershipBadgeLabel(item.membership);
            return (
              <TouchableOpacity
                key={item.id}
                style={styles.customerResultCard}
                onPress={() => onSelectCustomer(item)}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`Select customer ${item.name}`}
              >
                <View style={styles.avatarCircleSmall}>
                  <WizardIcon name="person-outline" size={18} color="#0866F5" fallbackText="👤" />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.resultName}>{item.name}</Text>
                  <Text style={styles.resultPhone}>{item.phone}</Text>
                  {item.customerCode ? (
                    <Text style={styles.resultCode}>ID: {item.customerCode}</Text>
                  ) : null}
                </View>
                <View style={styles.membershipPill}>
                  <Text style={styles.membershipPillText}>{badgeLabel}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Empty Search Notice */}
      {isConnected &&
        searchQuery.trim().length >= 2 &&
        !isSearching &&
        searchResults.length === 0 && (
          <View style={styles.emptyResults}>
            <Text style={styles.emptyResultsText}>No customers found matching "{searchQuery}"</Text>
          </View>
        )}

      {/* Create New Customer Toggle / Form */}
      <View style={styles.createCustomerContainer}>
        {!showCreateForm ? (
          <TouchableOpacity
            style={styles.openCreateBtn}
            onPress={() => setShowCreateForm(true)}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Add new customer"
          >
            <WizardIcon name="person-add-outline" size={18} color="#0866F5" fallbackText="＋" />
            <Text style={styles.openCreateBtnText}>Create New Customer</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.createForm}>
            <View style={styles.createFormHeader}>
              <Text style={styles.createFormTitle}>New Customer Intake</Text>
              <TouchableOpacity
                onPress={() => setShowCreateForm(false)}
                style={styles.cancelCreateBtn}
              >
                <Text style={styles.cancelCreateText}>Cancel</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Full Name *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Anand Sharma"
                placeholderTextColor="#94A3B8"
                value={newName}
                onChangeText={setNewName}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>WhatsApp / Mobile Phone *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. 9876543210"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
                value={newPhone}
                onChangeText={setNewPhone}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Delivery Address (Optional)</Text>
              <TextInput
                style={[styles.textInput, { height: 60 }]}
                placeholder="e.g. Flat 302, Green Valley Apartments"
                placeholderTextColor="#94A3B8"
                multiline
                value={newAddress}
                onChangeText={setNewAddress}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Pincode (Optional)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. 560001"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                value={newPincode}
                onChangeText={setNewPincode}
              />
            </View>

            <TouchableOpacity
              style={[styles.saveCustomerBtn, isCreating && styles.saveCustomerBtnDisabled]}
              onPress={handleCreateCustomer}
              disabled={isCreating}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Save Customer and Continue"
            >
              {isCreating ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveCustomerBtnText}>Save Customer & Select</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EDF5FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#101F3D',
  },
  selectedCustomerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#3B82F6',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(8, 102, 245, 0.08)',
      },
      default: {
        shadowColor: '#0866F5',
        shadowOpacity: 0.08,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
      },
    }),
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E0EFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircleSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E0EFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameContainer: {
    flex: 1,
    marginLeft: 12,
  },
  customerNameText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#101F3D',
  },
  membershipPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#DCE5F0',
  },
  membershipPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#647894',
    letterSpacing: 0.5,
  },
  detailsGroup: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailIconCircleBlue: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EDF5FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  detailIconCircleRed: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  phoneText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#101F3D',
  },
  idText: {
    fontSize: 14,
    color: '#647894',
    fontWeight: '500',
  },
  addressText: {
    fontSize: 14,
    color: '#101F3D',
    fontWeight: '500',
    flex: 1,
  },
  discountBadge: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginTop: 12,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  discountBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16A34A',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#EDF2F7',
    marginVertical: 16,
  },
  changeCustomerButton: {
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  changeCustomerButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0866F5',
  },
  offlineNotice: {
    backgroundColor: '#FFF7ED',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FED7AA',
    marginBottom: 16,
  },
  offlineNoticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#C2410C',
  },
  offlineNoticeText: {
    fontSize: 12,
    color: '#9A3412',
    marginTop: 2,
  },
  searchSection: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#647894',
    marginBottom: 6,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DCE5F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    minHeight: 46,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#101F3D',
    marginLeft: 8,
    paddingVertical: 8,
  },
  clearSearchBtn: {
    padding: 4,
  },
  clearSearchBtnText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '700',
  },
  searchingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  searchingText: {
    fontSize: 12,
    color: '#647894',
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  },
  resultsContainer: {
    marginBottom: 16,
  },
  resultsHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#647894',
    marginBottom: 8,
  },
  customerResultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCE5F0',
    marginBottom: 8,
  },
  resultName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#101F3D',
  },
  resultPhone: {
    fontSize: 13,
    color: '#647894',
    marginTop: 2,
  },
  resultCode: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
    fontFamily: 'monospace',
  },
  emptyResults: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCE5F0',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyResultsText: {
    fontSize: 13,
    color: '#647894',
  },
  createCustomerContainer: {
    marginTop: 8,
  },
  openCreateBtn: {
    minHeight: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  openCreateBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0866F5',
  },
  createForm: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DCE5F0',
  },
  createFormHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  createFormTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#101F3D',
  },
  cancelCreateBtn: {
    padding: 6,
  },
  cancelCreateText: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 12,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#DCE5F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#101F3D',
    backgroundColor: '#F8FAFC',
    minHeight: 44,
  },
  saveCustomerBtn: {
    backgroundColor: '#0866F5',
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  saveCustomerBtnDisabled: {
    backgroundColor: '#94A3B8',
  },
  saveCustomerBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
