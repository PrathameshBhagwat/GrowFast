import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { CustomerDTO, CreateCustomerRequest, MembershipTier } from '@growfast/shared-types';
import { apiClient } from '../../api/client';

interface CustomerStepProps {
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
      // Offline fallback: set manual customer details
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

  const getMembershipBadgeColor = (tier?: MembershipTier) => {
    switch (tier) {
      case MembershipTier.PLATINUM:
        return { bg: '#fef08a', text: '#854d0e', border: '#fde047' };
      case MembershipTier.GOLD:
        return { bg: '#fed7aa', text: '#9a3412', border: '#fdba74' };
      case MembershipTier.SILVER:
        return { bg: '#e2e8f0', text: '#334155', border: '#cbd5e1' };
      default:
        return { bg: '#f1f5f9', text: '#64748b', border: '#e2e8f0' };
    }
  };

  // If a customer is already selected, show selected customer card
  if (selectedCustomer) {
    const badgeColor = getMembershipBadgeColor(selectedCustomer.membership);
    return (
      <View style={styles.container}>
        <Text style={styles.stepTitle}>Selected Customer</Text>

        <View style={styles.selectedCustomerCard}>
          <View style={styles.customerHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.selectedCustomerName}>{selectedCustomer.name}</Text>
              <Text style={styles.selectedCustomerPhone}>📱 {selectedCustomer.phone}</Text>
              {selectedCustomer.customerCode ? (
                <Text style={styles.selectedCustomerCode}>
                  ID: {selectedCustomer.customerCode}
                </Text>
              ) : null}
            </View>

            <View
              style={[
                styles.tierBadge,
                { backgroundColor: badgeColor.bg, borderColor: badgeColor.border },
              ]}
            >
              <Text style={[styles.tierBadgeText, { color: badgeColor.text }]}>
                {selectedCustomer.membership || 'STANDARD'}
              </Text>
            </View>
          </View>

          {selectedCustomer.address ? (
            <Text style={styles.customerAddressText}>📍 {selectedCustomer.address}</Text>
          ) : null}

          {selectedCustomer.discountPercent > 0 && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountBadgeText}>
                🎉 {selectedCustomer.discountPercent}% Member Discount Applied
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.changeCustomerButton}
            onPress={onClearCustomer}
            accessible={true}
            accessibilityLabel="Change selected customer"
          >
            <Text style={styles.changeCustomerButtonText}>Change Customer</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // If manual customer entered (e.g. offline)
  if (manualCustomerName) {
    return (
      <View style={styles.container}>
        <Text style={styles.stepTitle}>Selected Customer</Text>
        <View style={styles.selectedCustomerCard}>
          <Text style={styles.selectedCustomerName}>{manualCustomerName}</Text>
          <Text style={styles.selectedCustomerPhone}>📱 {manualCustomerPhone || 'No phone'}</Text>
          <View style={[styles.tierBadge, { backgroundColor: '#f1f5f9', borderColor: '#cbd5e1' }]}>
            <Text style={[styles.tierBadgeText, { color: '#475569' }]}>MANUAL / OFFLINE</Text>
          </View>
          <TouchableOpacity
            style={styles.changeCustomerButton}
            onPress={onClearCustomer}
            accessible={true}
            accessibilityLabel="Change customer details"
          >
            <Text style={styles.changeCustomerButtonText}>Change Details</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.stepTitle}>Find or Add Customer</Text>

      {/* Offline Notice if applicable */}
      {!isConnected && (
        <View style={styles.offlineNotice}>
          <Text style={styles.offlineNoticeTitle}>Device is Offline</Text>
          <Text style={styles.offlineNoticeText}>
            Customer search is unavailable offline. Enter customer details manually below to save to
            local draft.
          </Text>
        </View>
      )}

      {/* Search Input (when online) */}
      {isConnected && (
        <View style={styles.searchSection}>
          <Text style={styles.inputLabel}>Search by Name, WhatsApp, or Customer Code</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search phone or name..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
          {isSearching && (
            <View style={styles.searchingRow}>
              <ActivityIndicator size="small" color="#2563eb" />
              <Text style={styles.searchingText}>Searching customer registry...</Text>
            </View>
          )}
          {searchError && <Text style={styles.errorText}>⚠️ {searchError}</Text>}
        </View>
      )}

      {/* Search Results List */}
      {searchResults.length > 0 && (
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsHeader}>Search Results ({searchResults.length})</Text>
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => {
              const badge = getMembershipBadgeColor(item.membership);
              return (
                <TouchableOpacity
                  style={styles.customerResultCard}
                  onPress={() => onSelectCustomer(item)}
                  accessible={true}
                  accessibilityLabel={`Select customer ${item.name}`}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resultName}>{item.name}</Text>
                    <Text style={styles.resultPhone}>📱 {item.phone}</Text>
                    {item.customerCode ? (
                      <Text style={styles.resultCode}>ID: {item.customerCode}</Text>
                    ) : null}
                  </View>
                  <View
                    style={[
                      styles.tierBadgeSmall,
                      { backgroundColor: badge.bg, borderColor: badge.border },
                    ]}
                  >
                    <Text style={[styles.tierBadgeTextSmall, { color: badge.text }]}>
                      {item.membership || 'STD'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      )}

      {/* Empty State when search has query but no results */}
      {isConnected && searchQuery.trim().length >= 2 && !isSearching && searchResults.length === 0 && (
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
            accessibilityLabel="Add new customer"
          >
            <Text style={styles.openCreateBtnText}>+ Create New Customer</Text>
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
                placeholderTextColor="#94a3b8"
                value={newName}
                onChangeText={setNewName}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>WhatsApp / Mobile Phone *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. 9876543210"
                placeholderTextColor="#94a3b8"
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
                placeholderTextColor="#94a3b8"
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
                placeholderTextColor="#94a3b8"
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
              accessibilityLabel="Save Customer and Continue"
            >
              {isCreating ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.saveCustomerBtnText}>Save Customer & Select</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
  },
  selectedCustomerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#3b82f6',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  customerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  selectedCustomerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  selectedCustomerPhone: {
    fontSize: 14,
    color: '#475569',
    marginTop: 4,
  },
  selectedCustomerCode: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
    fontFamily: 'monospace',
  },
  customerAddressText: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 8,
  },
  tierBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  tierBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  tierBadgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
  },
  tierBadgeTextSmall: {
    fontSize: 10,
    fontWeight: '700',
  },
  discountBadge: {
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  discountBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16a34a',
  },
  changeCustomerButton: {
    marginTop: 14,
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  changeCustomerButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  offlineNotice: {
    backgroundColor: '#fff7ed',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fed7aa',
    marginBottom: 16,
  },
  offlineNoticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#c2410c',
  },
  offlineNoticeText: {
    fontSize: 12,
    color: '#9a3412',
    marginTop: 2,
  },
  searchSection: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#ffffff',
    minHeight: 44,
  },
  searchingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  searchingText: {
    fontSize: 12,
    color: '#64748b',
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 4,
  },
  resultsContainer: {
    marginBottom: 16,
  },
  resultsHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  customerResultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
    minHeight: 48,
  },
  resultName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  resultPhone: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  resultCode: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 1,
    fontFamily: 'monospace',
  },
  emptyResults: {
    padding: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyResultsText: {
    fontSize: 13,
    color: '#64748b',
  },
  createCustomerContainer: {
    marginTop: 8,
  },
  openCreateBtn: {
    minHeight: 44,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  openCreateBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2563eb',
  },
  createForm: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  createFormHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  createFormTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  cancelCreateBtn: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelCreateText: {
    fontSize: 13,
    color: '#ef4444',
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 12,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
    minHeight: 44,
  },
  saveCustomerBtn: {
    backgroundColor: '#2563eb',
    minHeight: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  saveCustomerBtnDisabled: {
    backgroundColor: '#94a3b8',
  },
  saveCustomerBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
