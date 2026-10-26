import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
  SafeAreaView,
} from 'react-native';
import { useRouter, Redirect } from 'expo-router';
import { apiClient } from '../../src/api/client';
import { useAuth } from '../../src/contexts/AuthContext';

interface EmployeeDirectoryItem {
  id: string;
  name: string;
  role: string;
}

const FALLBACK_STAFF_DIRECTORY: EmployeeDirectoryItem[] = [
  { id: 'emp-counter-001', name: 'Sarthak kumkar', role: 'COUNTER' },
  { id: 'emp-owner-001', name: 'Prathamesh Bhagwat', role: 'OWNER' },
];

export default function LoginScreen() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isAuthLoading && isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  // Initialize with fallback directory so the screen is immediately interactive on mount
  const [directory, setDirectory] = useState<EmployeeDirectoryItem[]>(FALLBACK_STAFF_DIRECTORY);
  const [selectedEmpId, setSelectedEmpId] = useState<string>('emp-counter-001');
  const [pin, setPin] = useState<string>('');
  const [showPin, setShowPin] = useState(false);
  const [isFetchingDirectory, setIsFetchingDirectory] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);

  const loadDirectory = useCallback(async () => {
    setIsFetchingDirectory(true);
    try {
      // Request strictly OWNER and COUNTER accounts from backend
      const list = await apiClient.auth.getDirectory(['OWNER', 'COUNTER']);
      if (Array.isArray(list) && list.length > 0) {
        const mobileRoles = ['OWNER', 'COUNTER'];
        const posStaff = list.filter((emp) => mobileRoles.includes(emp.role));
        if (posStaff.length > 0) {
          setDirectory(posStaff);
          setSelectedEmpId((prev) => (posStaff.some((p) => p.id === prev) ? prev : posStaff[0].id));
          setErrorMsg(null);
        }
      }
    } catch (err: any) {
      console.warn('Could not load employee directory from server:', err.message);
      // Fallback accounts remain available; notify user only if network is completely down
    } finally {
      setIsFetchingDirectory(false);
    }
  }, []);

  useEffect(() => {
    loadDirectory();
  }, [loadDirectory]);

  const handleLogin = async () => {
    if (!selectedEmpId.trim()) {
      setErrorMsg('Please select or enter an employee ID');
      return;
    }
    if (!pin.trim()) {
      setErrorMsg('Please enter your staff PIN');
      return;
    }

    setErrorMsg(null);
    setIsLoading(true);

    try {
      await login({
        employeeId: selectedEmpId.trim(),
        pin: pin.trim(),
      });
      router.replace('/(tabs)');
    } catch (err: any) {
      if (err.statusCode === 401 || err.message?.toLowerCase().includes('credential')) {
        setErrorMsg('Invalid PIN. Please check your 6-digit staff PIN and try again.');
      } else if (
        err.message?.includes('Network request failed') ||
        err.message?.includes('Failed to fetch') ||
        err.message?.includes('timeout')
      ) {
        setErrorMsg(
          `Cannot connect to backend server at ${apiClient.getBaseUrl()}. Verify the host IP and ensure your phone is on the same local network.`,
        );
      } else {
        setErrorMsg(err.message || 'Login failed. Please verify your PIN.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const selectedEmployee = directory.find((d) => d.id === selectedEmpId);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Top Brand Header matching Screen 1 */}
          <View style={styles.brandHeader}>
            <View style={styles.bubbleIconCircle}>
              <Text style={styles.bubbleEmoji}>🫧</Text>
            </View>
            <Text style={styles.brandTitle}>GrowFast</Text>
            <Text style={styles.brandTagline}>Simpler Operations, Cleaner Tomorrow.</Text>
          </View>

          {/* Login Card matching Screen 1 */}
          <View style={styles.card}>
            <Text style={styles.portalTitle}>Staff Portal</Text>
            <Text style={styles.portalSubtitle}>Sign in to continue</Text>

            {errorMsg ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
                {directory.length === 0 ? (
                  <TouchableOpacity
                    style={styles.retryBtn}
                    onPress={loadDirectory}
                    disabled={isFetchingDirectory}
                  >
                    <Text style={styles.retryBtnText}>
                      {isFetchingDirectory ? 'Connecting...' : '🔄 Retry Staff Loading'}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}

            {/* Field 1: Role of You */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Role of You</Text>
              <TouchableOpacity
                style={styles.dropdownTrigger}
                onPress={() => setPickerVisible(true)}
                activeOpacity={0.7}
                accessible={true}
                accessibilityLabel="Select Staff Account"
              >
                <View style={styles.fieldLeftIconContainer}>
                  <Text style={styles.fieldIcon}>👤</Text>
                </View>
                <View style={{ flex: 1, paddingHorizontal: 8 }}>
                  <Text
                    style={
                      selectedEmployee ? styles.dropdownSelectedText : styles.dropdownPlaceholder
                    }
                    numberOfLines={1}
                  >
                    {selectedEmployee
                      ? `${selectedEmployee.name} (${selectedEmployee.role})`
                      : isFetchingDirectory
                        ? 'Loading staff accounts...'
                        : 'Select who you are...'}
                  </Text>
                </View>
                <Text style={styles.chevronIcon}>⌄</Text>
              </TouchableOpacity>
            </View>

            {/* Field 2: PIN */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>PIN</Text>
              <View style={styles.pinInputContainer}>
                <View style={styles.fieldLeftIconContainer}>
                  <Text style={styles.fieldIcon}>🔒</Text>
                </View>
                <TextInput
                  style={styles.pinTextInput}
                  placeholder="Enter your PIN"
                  placeholderTextColor="#94a3b8"
                  keyboardType="number-pad"
                  secureTextEntry={!showPin}
                  value={pin}
                  onChangeText={setPin}
                  maxLength={10}
                />
                <TouchableOpacity
                  style={styles.eyeToggleBtn}
                  onPress={() => setShowPin(!showPin)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessible={true}
                  accessibilityLabel={showPin ? 'Hide PIN' : 'Show PIN'}
                >
                  <Text style={styles.eyeIcon}>{showPin ? '👁️' : '👁️‍🗨️'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Quick Fill Test Accounts */}
            <View style={styles.quickFillContainer}>
              <Text style={styles.quickFillLabel}>⚡ Quick Fill for Testing:</Text>
              <View style={styles.quickFillRow}>
                <TouchableOpacity
                  style={[
                    styles.quickChip,
                    selectedEmpId === 'emp-counter-001' && styles.quickChipActive,
                  ]}
                  onPress={() => {
                    setSelectedEmpId('emp-counter-001');
                    setPin('333333');
                    setErrorMsg(null);
                  }}
                  activeOpacity={0.7}
                  accessible={true}
                  accessibilityLabel="Quick Select Counter Staff"
                >
                  <Text style={styles.quickChipTitle}>👔 Counter (Swapnil)</Text>
                  <Text style={styles.quickChipSubtitle}>PIN: 333333</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.quickChip,
                    selectedEmpId === 'emp-owner-001' && styles.quickChipActive,
                  ]}
                  onPress={() => {
                    setSelectedEmpId('emp-owner-001');
                    setPin('111111');
                    setErrorMsg(null);
                  }}
                  activeOpacity={0.7}
                  accessible={true}
                  accessibilityLabel="Quick Select Owner Staff"
                >
                  <Text style={styles.quickChipTitle}>👑 Owner (Prathamesh)</Text>
                  <Text style={styles.quickChipSubtitle}>PIN: 111111</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Sign In Button */}
            <TouchableOpacity
              style={[
                styles.signInButton,
                (isLoading || !selectedEmpId || !pin.trim()) && styles.signInButtonDisabled,
              ]}
              onPress={handleLogin}
              disabled={isLoading || !selectedEmpId || !pin.trim()}
              activeOpacity={0.8}
              accessible={true}
              accessibilityLabel="Sign In"
            >
              {isLoading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.signInButtonText}>Sign In →</Text>
              )}
            </TouchableOpacity>

            {/* Secure Badge */}
            <View style={styles.secureBadgeContainer}>
              <Text style={styles.secureBadgeText}>🛡️ SECURE STAFF PORTAL</Text>
            </View>
          </View>

          {/* Bottom Illustration matching Screen 1 (Stylized Washing Machine & Basket) */}
          <View style={styles.illustrationContainer}>
            <View style={styles.machineBody}>
              <View style={styles.machineDisplayBar}>
                <View style={styles.machineStatusDot} />
                <View style={styles.machineKnob} />
              </View>
              <View style={styles.machineDoorOuter}>
                <View style={styles.machineDoorInner}>
                  <Text style={styles.waterWaveEmoji}>🌊</Text>
                </View>
              </View>
            </View>
            <View style={styles.basketContainer}>
              <View style={styles.foldedTowel} />
              <View style={styles.basketBase}>
                <Text style={styles.basketEmoji}>🧺</Text>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Staff Directory Selection Modal */}
        <Modal
          visible={pickerVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setPickerVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setPickerVisible(false)}
          >
            <View style={styles.pickerModalCard}>
              <View style={styles.pickerModalHeader}>
                <Text style={styles.pickerModalTitle}>Select Staff Account</Text>
                <TouchableOpacity
                  onPress={() => setPickerVisible(false)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.pickerCloseBtn}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 320 }}>
                {directory.length > 0 ? (
                  directory.map((emp) => {
                    const isSelected = selectedEmpId === emp.id;
                    return (
                      <TouchableOpacity
                        key={emp.id}
                        style={[styles.staffRow, isSelected && styles.staffRowSelected]}
                        onPress={() => {
                          setSelectedEmpId(emp.id);
                          setPickerVisible(false);
                          setErrorMsg(null);
                        }}
                      >
                        <View style={styles.staffAvatarCircle}>
                          <Text style={styles.staffAvatarInitials}>
                            {emp.name.slice(0, 1).toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.staffRowName}>{emp.name}</Text>
                          <Text style={styles.staffRowId}>{emp.id}</Text>
                        </View>
                        <View
                          style={[
                            styles.rolePill,
                            emp.role === 'OWNER' ? styles.roleOwner : styles.roleCounter,
                          ]}
                        >
                          <Text
                            style={[
                              styles.rolePillText,
                              emp.role === 'OWNER' ? styles.roleTextOwner : styles.roleTextCounter,
                            ]}
                          >
                            {emp.role}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  <View style={{ padding: 20, alignItems: 'center' }}>
                    <Text style={{ color: '#64748b' }}>No staff accounts loaded.</Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f0f6ff',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
    justifyContent: 'space-between',
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  bubbleIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  bubbleEmoji: {
    fontSize: 22,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  brandTagline: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 3,
    ...Platform.select({
      web: {
        boxShadow: '0px 8px 16px rgba(37, 99, 235, 0.08)',
      },
      default: {
        shadowColor: '#2563eb',
        shadowOpacity: 0.06,
        shadowOffset: { width: 0, height: 8 },
        shadowRadius: 16,
      },
    }),
  },
  portalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
  },
  portalSubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  retryBtn: {
    marginTop: 8,
    alignSelf: 'center',
    backgroundColor: '#fee2e2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  retryBtnText: {
    color: '#991b1b',
    fontSize: 12,
    fontWeight: '600',
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
  },
  fieldLeftIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldIcon: {
    fontSize: 16,
  },
  dropdownSelectedText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  dropdownPlaceholder: {
    fontSize: 14,
    color: '#94a3b8',
  },
  chevronIcon: {
    fontSize: 18,
    color: '#94a3b8',
    paddingRight: 4,
  },
  pinInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
  },
  pinTextInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    paddingHorizontal: 10,
    height: '100%',
  },
  eyeToggleBtn: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeIcon: {
    fontSize: 18,
  },
  quickFillContainer: {
    marginTop: 4,
    marginBottom: 16,
  },
  quickFillLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 6,
  },
  quickFillRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quickChip: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  quickChipActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
  },
  quickChipTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b',
  },
  quickChipSubtitle: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  signInButton: {
    height: 52,
    borderRadius: 26,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    elevation: 4,
    ...Platform.select({
      web: {
        boxShadow: '0px 4px 8px rgba(37, 99, 235, 0.3)',
      },
      default: {
        shadowColor: '#2563eb',
        shadowOpacity: 0.3,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 8,
      },
    }),
  },
  signInButtonDisabled: {
    backgroundColor: '#93c5fd',
    elevation: 0,
    ...Platform.select({
      web: {
        boxShadow: 'none',
      },
      default: {
        shadowOpacity: 0,
      },
    }),
  },
  signInButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  secureBadgeContainer: {
    marginTop: 18,
    alignSelf: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  secureBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563eb',
    letterSpacing: 0.5,
  },
  illustrationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    marginTop: 24,
    marginBottom: 8,
    gap: 16,
  },
  machineBody: {
    width: 96,
    height: 108,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#bfdbfe',
    alignItems: 'center',
    padding: 6,
    elevation: 2,
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 6px rgba(59, 130, 246, 0.15)',
      },
      default: {
        shadowColor: '#3b82f6',
        shadowOpacity: 0.1,
        shadowRadius: 6,
      },
    }),
  },
  machineDisplayBar: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginBottom: 8,
  },
  machineStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  machineKnob: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#93c5fd',
  },
  machineDoorOuter: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#93c5fd',
  },
  machineDoorInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#bfdbfe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waterWaveEmoji: {
    fontSize: 18,
  },
  basketContainer: {
    alignItems: 'center',
  },
  foldedTowel: {
    width: 38,
    height: 12,
    backgroundColor: '#93c5fd',
    borderRadius: 6,
    marginBottom: -2,
    zIndex: 1,
  },
  basketBase: {
    width: 52,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    borderWidth: 1.5,
    borderColor: '#bfdbfe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  basketEmoji: {
    fontSize: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  pickerModalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    maxHeight: 450,
  },
  pickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  pickerModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
  },
  pickerCloseBtn: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#64748b',
    padding: 4,
  },
  staffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 12,
  },
  staffRowSelected: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  staffAvatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  staffAvatarInitials: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  staffRowName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  staffRowId: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  rolePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roleOwner: {
    backgroundColor: '#fef08a',
  },
  roleCounter: {
    backgroundColor: '#dbeafe',
  },
  rolePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  roleTextOwner: {
    color: '#854d0e',
  },
  roleTextCounter: {
    color: '#1e40af',
  },
});
