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
  useWindowDimensions,
} from 'react-native';
import { useRouter, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiClient } from '../../src/api/client';
import { useAuth } from '../../src/contexts/AuthContext';

// Safe component wrapper for vector icons across React 18/19 type definitions
const Icon = Ionicons as unknown as React.ComponentType<{
  name: string;
  size?: number;
  color?: string;
  style?: any;
}>;

interface EmployeeDirectoryItem {
  id: string;
  name: string;
  role: string;
}

// Reusable 4x4 dot matrix decoration matching the reference image corners
function DotMatrix({ rows = 4, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <View style={styles.dotGridContainer} pointerEvents="none" accessible={false}>
      {Array.from({ length: rows }).map((_, r) => (
        <View key={`row-${r}`} style={styles.dotGridRow}>
          {Array.from({ length: cols }).map((_, c) => (
            <View key={`dot-${r}-${c}`} style={styles.dotItem} />
          ))}
        </View>
      ))}
    </View>
  );
}

// Bottom Laundry Machine & Towel Illustration matching reference image
function LaundryIllustration() {
  return (
    <View style={styles.illustrationWrap} pointerEvents="none" accessible={false}>
      {/* Left Leaf Accent */}
      <View style={[styles.leafBase, styles.leafLeft1]} />
      <View style={[styles.leafBase, styles.leafLeft2]} />

      {/* Washing Machine Body */}
      <View style={styles.washerBody}>
        {/* Machine Top Panel */}
        <View style={styles.washerTopPanel}>
          <View style={styles.washerDispenserSlot} />
          <View style={styles.washerControlDots}>
            <View style={styles.washerTinyDot} />
            <View style={styles.washerTinyDot} />
            <View style={styles.washerTinyDot} />
          </View>
          <View style={styles.washerKnobRing}>
            <View style={styles.washerKnobCenter} />
          </View>
        </View>

        {/* Circular Front-Load Door */}
        <View style={styles.washerDoorOuter}>
          <View style={styles.washerDoorMid}>
            <View style={styles.washerDoorGlass}>
              <View style={styles.waterBubbleBig} />
              <View style={styles.waterBubbleSmall} />
              <View style={styles.waterWaveLine} />
            </View>
          </View>
        </View>
      </View>

      {/* Stack of Clean Folded Towels */}
      <View style={styles.towelStack}>
        <View style={[styles.towelFold, styles.towelTop]} />
        <View style={[styles.towelFold, styles.towelMid]} />
        <View style={[styles.towelFold, styles.towelBottom]} />
      </View>

      {/* Right Leaf Accent */}
      <View style={[styles.leafBase, styles.leafRight1]} />
      <View style={[styles.leafBase, styles.leafRight2]} />
    </View>
  );
}

const FALLBACK_STAFF_DIRECTORY: EmployeeDirectoryItem[] = [
  { id: 'emp-counter-001', name: 'Sarthak kumkar', role: 'COUNTER' },
  { id: 'emp-owner-001', name: 'Prathamesh Bhagwat', role: 'OWNER' },
];

export default function LoginScreen() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
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

  // Progressive brute-force lockout states
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);

  // Lockout countdown timer
  useEffect(() => {
    if (!lockoutUntil) return;
    const interval = setInterval(() => {
      const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        setLockoutUntil(null);
        setFailedAttempts(0);
        setTimeLeft(0);
        clearInterval(interval);
      } else {
        setTimeLeft(remaining);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutUntil]);

  const handlePinChange = (val: string) => {
    // Strictly numeric, maximum 6 digits
    const digitsOnly = val.replace(/\D/g, '').slice(0, 6);
    setPin(digitsOnly);
    if (errorMsg && !lockoutUntil) {
      setErrorMsg(null);
    }
  };

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
      console.warn('Could not load employee directory:', err?.message);
      if (directory.length === 0) {
        setErrorMsg(
          `Unable to connect to backend server at ${apiClient.getBaseUrl()}. Please ensure the NestJS backend is running and your device is connected to the same Wi-Fi network.`,
        );
      }
    } finally {
      setIsFetchingDirectory(false);
    }
  }, []);

  useEffect(() => {
    loadDirectory();
  }, [loadDirectory]);

  const handleLogin = async () => {
    if (lockoutUntil) return;

    if (!selectedEmpId.trim()) {
      setErrorMsg('Please select your staff account');
      return;
    }
    if (pin.length < 4) {
      setErrorMsg('PIN must be at least 4 digits');
      return;
    }
    if (pin.length > 6) {
      setErrorMsg('PIN cannot exceed 6 digits');
      return;
    }

    setErrorMsg(null);
    setIsLoading(true);

    try {
      await login({
        employeeId: selectedEmpId.trim(),
        pin: pin.trim(),
      });
      setFailedAttempts(0);
      setLockoutUntil(null);
      router.replace('/(tabs)');
    } catch (err: any) {
      setPin('');
      const attempts = failedAttempts + 1;
      setFailedAttempts(attempts);

      if (err.message && err.message.toLowerCase().includes('lockout')) {
        setLockoutUntil(Date.now() + 60000);
        setErrorMsg(err.message);
      } else if (attempts >= 5) {
        setLockoutUntil(Date.now() + 60000);
        setErrorMsg('Too many failed attempts. Temporary lockout active. Try again in 60s.');
      } else if (err.statusCode === 401 || err.message?.toLowerCase().includes('credential')) {
        setErrorMsg(`Invalid PIN. Please check your staff PIN and try again. (Attempt ${attempts}/5)`);
      } else if (
        err.message?.includes('Network request failed') ||
        err.message?.includes('Failed to fetch') ||
        err.message?.includes('Server unreachable') ||
        err.message?.includes('timeout')
      ) {
        setErrorMsg(
          `Cannot connect to backend server at ${apiClient.getBaseUrl()}. Verify the backend is running and your device is on the same network.`,
        );
      } else {
        setErrorMsg(err.message || 'Login failed. Please verify your PIN.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const selectedEmployee = directory.find((d) => d.id === selectedEmpId);
  const isCompactScreen = windowHeight < 720;

  return (
    <View
      style={[
        styles.safeArea,
        {
          paddingTop: Math.max(insets.top, 16),
          paddingBottom: Math.max(insets.bottom, 12),
        },
      ]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
      >
        {/* Decorative Top-Right & Bottom-Right Dot Matrix */}
        <View style={styles.topRightDots}>
          <DotMatrix rows={4} cols={4} />
        </View>
        <View style={styles.bottomRightDots}>
          <DotMatrix rows={4} cols={4} />
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            isCompactScreen && styles.scrollContentCompact,
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Top Bar: Secure Staff Access Badge (Right-aligned, moon toggle removed) */}
          <View style={styles.topBarRow}>
            <View style={styles.secureBadgePill}>
              <Icon
                name="shield-checkmark-outline"
                size={14}
                color="#2563eb"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.secureBadgeText}>Secure staff access</Text>
            </View>
          </View>

          {/* Wordmark Header: GrowFast & Tagline */}
          <View style={styles.brandHeader}>
            <View style={styles.wordmarkRow}>
              <Text style={styles.brandGrow}>Grow</Text>
              <Text style={styles.brandFast}>Fast</Text>
            </View>
            <Text style={styles.brandTagline}>Simpler Operations. Cleaner Tomorrow.</Text>
            <View style={styles.taglineAccentPill} />
          </View>

          {/* Main White Login Card */}
          <View style={styles.card}>
            {/* Center Top Laundry / T-Shirt Icon Badge */}
            <View style={styles.shirtIconContainer}>
              <Icon name="shirt" size={32} color="#ffffff" />
            </View>

            {/* Welcome Back & Subtitle */}
            <Text style={styles.cardHeading}>Welcome back</Text>
            <Text style={styles.cardSubtitle}>Sign in to continue to GrowFast</Text>

            {/* Error Message / Lockout Box */}
            {lockoutUntil ? (
              <View style={styles.errorBox}>
                <Icon
                  name="alert-circle"
                  size={18}
                  color="#b91c1c"
                  style={{ marginRight: 6, marginTop: 1 }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.errorText}>
                    Too many failed attempts. Temporary lockout active. Try again in {timeLeft}s.
                  </Text>
                </View>
              </View>
            ) : errorMsg ? (
              <View style={styles.errorBox}>
                <Icon
                  name="alert-circle"
                  size={18}
                  color="#b91c1c"
                  style={{ marginRight: 6, marginTop: 1 }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.errorText}>{errorMsg}</Text>
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
              </View>
            ) : null}

            {/* Field 1: Role of You */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Role of You</Text>
              <TouchableOpacity
                style={[styles.dropdownTrigger, !!lockoutUntil && { opacity: 0.6 }]}
                onPress={() => setPickerVisible(true)}
                disabled={!!lockoutUntil}
                activeOpacity={0.7}
                accessible={true}
                accessibilityLabel="Select Staff Account"
              >
                <View style={styles.fieldIconLeft}>
                  <Icon name="person-outline" size={20} color="#2563eb" />
                </View>
                <View style={styles.fieldTextWrapper}>
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
                        : 'Select who you are'}
                  </Text>
                </View>
                <Icon
                  name="chevron-down"
                  size={20}
                  color="#2563eb"
                  style={{ marginLeft: 8 }}
                />
              </TouchableOpacity>
            </View>

            {/* Field 2: PIN */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>PIN</Text>
              <View style={[styles.pinInputContainer, !!lockoutUntil && { opacity: 0.6 }]}>
                <View style={styles.fieldIconLeft}>
                  <Icon name="lock-closed-outline" size={20} color="#2563eb" />
                </View>
                <TextInput
                  style={styles.pinTextInput}
                  placeholder="Enter your PIN"
                  placeholderTextColor="#94a3b8"
                  keyboardType="number-pad"
                  secureTextEntry={!showPin}
                  value={pin}
                  onChangeText={handlePinChange}
                  maxLength={6}
                  editable={!lockoutUntil && !isLoading}
                  autoCapitalize="none"
                  autoCorrect={false}
                  accessible={true}
                  accessibilityLabel="Staff PIN Input"
                />
                <TouchableOpacity
                  style={styles.eyeToggleBtn}
                  onPress={() => setShowPin(!showPin)}
                  disabled={!!lockoutUntil}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  accessible={true}
                  accessibilityLabel={showPin ? 'Hide PIN' : 'Show PIN'}
                >
                  <Icon
                    name={showPin ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color="#64748b"
                  />
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
                (isLoading || !selectedEmpId || pin.length < 4 || pin.length > 6 || !!lockoutUntil) &&
                  styles.signInButtonDisabled,
              ]}
              onPress={handleLogin}
              disabled={isLoading || !selectedEmpId || pin.length < 4 || pin.length > 6 || !!lockoutUntil}
              activeOpacity={0.8}
              accessible={true}
              accessibilityLabel="Sign In Button"
            >
              {isLoading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <View style={styles.signInButtonInner}>
                  <Text style={styles.signInButtonText}>Sign In</Text>
                  <Icon
                    name="arrow-forward"
                    size={20}
                    color="#ffffff"
                    style={{ marginLeft: 8 }}
                  />
                </View>
              )}
            </TouchableOpacity>

            {/* Card Footer: Divider + SECURE STAFF PORTAL */}
            <View style={styles.cardFooterDividerRow}>
              <View style={styles.footerLine} />
              <View style={styles.footerBadge}>
                <Icon
                  name="shield-checkmark-outline"
                  size={12}
                  color="#64748b"
                  style={{ marginRight: 5 }}
                />
                <Text style={styles.footerPortalText}>SECURE STAFF PORTAL</Text>
              </View>
              <View style={styles.footerLine} />
            </View>
          </View>

          {/* Bottom Illustration (Front-Load Washing Machine, Folded Towels & Foliage) */}
          <LaundryIllustration />
        </ScrollView>

        {/* Staff Directory Modal */}
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
                  <Icon name="close" size={22} color="#64748b" />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 340 }}>
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
                        <View style={{ flex: 1, paddingRight: 8 }}>
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
                  <View style={{ padding: 24, alignItems: 'center' }}>
                    <Text style={{ color: '#64748b' }}>No staff accounts loaded.</Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f0f7ff',
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    justifyContent: 'space-between',
  },
  scrollContentCompact: {
    paddingTop: 8,
    paddingBottom: 12,
  },

  // Dot matrix decorations
  topRightDots: {
    position: 'absolute',
    top: 40,
    right: 18,
    zIndex: 0,
  },
  bottomRightDots: {
    position: 'absolute',
    bottom: 120,
    right: 20,
    zIndex: 0,
  },
  dotGridContainer: {
    flexDirection: 'column',
    gap: 7,
  },
  dotGridRow: {
    flexDirection: 'row',
    gap: 7,
  },
  dotItem: {
    width: 4.5,
    height: 4.5,
    borderRadius: 2.25,
    backgroundColor: '#93c5fd',
    opacity: 0.6,
  },

  // Top Bar Row
  topBarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginBottom: 16,
    zIndex: 1,
  },
  themeCircleBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#64748b',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  secureBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbeafe',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    shadowColor: '#93c5fd',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 1,
  },
  secureBadgeText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#2563eb',
  },

  // Brand Header
  brandHeader: {
    alignItems: 'center',
    marginBottom: 16,
    zIndex: 1,
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandGrow: {
    fontSize: 38,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  brandFast: {
    fontSize: 38,
    fontWeight: '900',
    color: '#2563eb',
    letterSpacing: -0.5,
  },
  brandTagline: {
    fontSize: 13.5,
    fontWeight: '500',
    color: '#64748b',
    marginTop: 4,
    textAlign: 'center',
  },
  taglineAccentPill: {
    width: 34,
    height: 3,
    backgroundColor: '#2563eb',
    borderRadius: 2,
    marginTop: 8,
  },

  // Main Card
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 22,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 4,
    zIndex: 1,
    ...Platform.select({
      web: {
        boxShadow: '0px 10px 20px rgba(30, 58, 138, 0.08)',
      },
      default: {
        shadowColor: '#1e3a8a',
        shadowOpacity: 0.08,
        shadowOffset: { width: 0, height: 10 },
        shadowRadius: 20,
      },
    }),
  },
  shirtIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#2563eb',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563eb',
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 14,
  },
  cardHeading: {
    fontSize: 27,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  cardSubtitle: {
    fontSize: 13.5,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
  },

  // Error Box
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    padding: 12,
    borderRadius: 14,
    marginBottom: 16,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  retryBtn: {
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#fee2e2',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  retryBtnText: {
    color: '#991b1b',
    fontSize: 12,
    fontWeight: '600',
  },

  // Form Fields
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 14,
  },
  fieldIconLeft: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldTextWrapper: {
    flex: 1,
    paddingHorizontal: 10,
  },
  dropdownSelectedText: {
    fontSize: 15,
    color: '#0f172a',
    fontWeight: '600',
  },
  dropdownPlaceholder: {
    fontSize: 15,
    color: '#94a3b8',
  },

  // PIN Input
  pinInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 14,
  },
  pinTextInput: {
    flex: 1,
    fontSize: 16,
    color: '#0f172a',
    paddingHorizontal: 10,
    letterSpacing: 2,
    fontWeight: '600',
  },
  eyeToggleBtn: {
    padding: 6,
  },
  // Quick Fill Chips
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

  // Sign In Button
  signInButton: {
    height: 52,
    backgroundColor: '#2563eb',
    borderRadius: 16,
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
  signInButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // Card Footer Divider
  cardFooterDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
  },
  footerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  footerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  footerPortalText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.8,
  },

  // Bottom Illustration
  illustrationWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginTop: 18,
    marginBottom: 6,
    height: 96,
  },
  washerBody: {
    width: 82,
    height: 88,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    paddingTop: 8,
    elevation: 2,
    zIndex: 2,
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 6px rgba(59, 130, 246, 0.15)',
      },
      default: {
        shadowColor: '#94a3b8',
        shadowOpacity: 0.2,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 8,
      },
    }),
  },
  washerTopPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '84%',
    marginBottom: 8,
  },
  washerDispenserSlot: {
    width: 16,
    height: 7,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#94a3b8',
    backgroundColor: '#f1f5f9',
  },
  washerControlDots: {
    flexDirection: 'row',
    gap: 2,
  },
  washerTinyDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#3b82f6',
  },
  washerKnobRing: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  washerKnobCenter: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#2563eb',
  },
  washerDoorOuter: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#94a3b8',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  washerDoorMid: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  washerDoorGlass: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#38bdf8',
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waterBubbleBig: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ffffff',
    opacity: 0.8,
    top: 6,
    left: 8,
  },
  waterBubbleSmall: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ffffff',
    opacity: 0.7,
    bottom: 8,
    right: 8,
  },
  waterWaveLine: {
    position: 'absolute',
    bottom: 0,
    width: 40,
    height: 14,
    backgroundColor: '#0284c7',
    opacity: 0.6,
    borderRadius: 8,
  },

  // Stack of Towels
  towelStack: {
    marginLeft: 8,
    marginBottom: 4,
    zIndex: 2,
  },
  towelFold: {
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 2,
  },
  towelTop: {
    width: 42,
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
  },
  towelMid: {
    width: 46,
    backgroundColor: '#e0f2fe',
    borderColor: '#93c5fd',
  },
  towelBottom: {
    width: 50,
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
  },

  // Soft Cyan Leaves
  leafBase: {
    position: 'absolute',
    width: 32,
    height: 16,
    backgroundColor: '#bae6fd',
    opacity: 0.75,
    borderRadius: 16,
  },
  leafLeft1: {
    left: '12%',
    bottom: 12,
    transform: [{ rotate: '-35deg' }],
  },
  leafLeft2: {
    left: '18%',
    bottom: 24,
    transform: [{ rotate: '-55deg' }],
  },
  leafRight1: {
    right: '12%',
    bottom: 12,
    transform: [{ rotate: '35deg' }],
  },
  leafRight2: {
    right: '18%',
    bottom: 24,
    transform: [{ rotate: '55deg' }],
  },

  // Staff Picker Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  pickerModalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#0f172a',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 8,
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
  staffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  staffRowSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  staffAvatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  staffAvatarInitials: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  staffRowName: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0f172a',
  },
  staffRowId: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
  },
  rolePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  roleOwner: {
    backgroundColor: '#fef3c7',
  },
  roleCounter: {
    backgroundColor: '#e0e7ff',
  },
  rolePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  roleTextOwner: {
    color: '#b45309',
  },
  roleTextCounter: {
    color: '#4338ca',
  },
});
