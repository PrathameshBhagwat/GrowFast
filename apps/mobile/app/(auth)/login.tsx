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
  Alert,
  useWindowDimensions,
} from 'react-native';
import { useRouter, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiClient } from '../../src/api/client';
import { useAuth } from '../../src/contexts/AuthContext';
import { GrowFastLogo } from '../../src/components/GrowFastLogo';

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

// Fallback staff directory for immediate interactivity on mount
const FALLBACK_STAFF_DIRECTORY: EmployeeDirectoryItem[] = [
  { id: 'emp-counter-001', name: 'Swapnil Shinde', role: 'COUNTER' },
  { id: 'emp-owner-001', name: 'Prathamesh Bhagwat', role: 'OWNER' },
];

/**
 * Top Laundry Illustration matching Screenshot 4 & Screenshot 5 (left phone):
 * - Ceiling pendant lamp
 * - Curved organic light blue backdrop
 * - White front-load washing machine with bubbly blue drum
 * - Potted plant sitting on top of the machine
 * - Stack of clean folded towels
 */
function TopLaundryIllustration() {
  return (
    <View style={styles.topIllustrationWrap} pointerEvents="none" accessible={false}>
      {/* Ceiling Pendant Lamp */}
      <View style={styles.ceilingLampContainer}>
        <View style={styles.lampCord} />
        <View style={styles.lampShade} />
        <View style={styles.lampGlow} />
      </View>

      {/* Curved Background Backdrop */}
      <View style={styles.curvedBackdropShape} />

      {/* Plant Pot on Top of Washing Machine */}
      <View style={styles.plantContainer}>
        <View style={styles.leafOne} />
        <View style={styles.leafTwo} />
        <View style={styles.leafThree} />
        <View style={styles.plantPot} />
      </View>

      {/* Stack of Folded Towels next to machine */}
      <View style={styles.towelsStack}>
        <View style={[styles.towelLayer, styles.towelTop]} />
        <View style={[styles.towelLayer, styles.towelMid]} />
        <View style={[styles.towelLayer, styles.towelBottom]} />
        <View style={[styles.towelLayer, styles.towelBase]} />
      </View>

      {/* Front-Load Washing Machine Body */}
      <View style={styles.washerMachine}>
        {/* Machine Top Panel */}
        <View style={styles.washerControlBar}>
          <View style={styles.washerDispenserSlot} />
          <View style={styles.washerDotsRow}>
            <View style={styles.washerTinyDot} />
            <View style={styles.washerTinyDot} />
            <View style={styles.washerTinyDot} />
          </View>
          <View style={styles.washerDialKnob} />
        </View>

        {/* Circular Front-Load Drum Door with Bubbles */}
        <View style={styles.washerDoorOuterRing}>
          <View style={styles.washerDoorInnerRing}>
            <View style={styles.washerDoorGlass}>
              <View style={styles.bubbleLarge} />
              <View style={styles.bubbleMedium} />
              <View style={styles.bubbleSmall} />
              <View style={styles.waterWaveCurve} />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [directory, setDirectory] = useState<EmployeeDirectoryItem[]>(FALLBACK_STAFF_DIRECTORY);
  const [selectedEmpId, setSelectedEmpId] = useState<string>('emp-counter-001');
  const [pin, setPin] = useState<string>('');
  const [showPin, setShowPin] = useState(false);
  const [isFetchingDirectory, setIsFetchingDirectory] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [showDevChips, setShowDevChips] = useState(false);

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
    const digitsOnly = val.replace(/\D/g, '').slice(0, 6);
    setPin(digitsOnly);
    if (errorMsg && !lockoutUntil) {
      setErrorMsg(null);
    }
  };

  const loadDirectory = useCallback(async () => {
    setIsFetchingDirectory(true);
    try {
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
          `Unable to connect to backend server at ${apiClient.getBaseUrl()}. Please ensure the NestJS backend is running and your device is on the same Wi-Fi network.`,
        );
      }
    } finally {
      setIsFetchingDirectory(false);
    }
  }, [directory.length]);

  useEffect(() => {
    loadDirectory();
  }, [loadDirectory]);

  // Navigate to main tabs when authenticated
  useEffect(() => {
    if (!isAuthLoading && isAuthenticated) {
      router.replace('/(tabs)');
    }
  }, [isAuthLoading, isAuthenticated, router]);

  if (!isAuthLoading && isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  const handleLogin = async () => {
    if (lockoutUntil) return;

    if (!selectedEmpId.trim()) {
      setErrorMsg('Please select your staff role');
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
      const isNetworkError =
        err.statusCode === 0 ||
        err.message?.includes('Network request failed') ||
        err.message?.includes('Failed to fetch') ||
        err.message?.includes('Server unreachable') ||
        err.message?.includes('timeout') ||
        err.message?.includes('Connection timed out');

      if (isNetworkError) {
        setErrorMsg(
          `Cannot connect to backend server at ${apiClient.getBaseUrl()}. Verify the backend is running and your device is on the same network.`,
        );
        return;
      }

      const attempts = failedAttempts + 1;
      setFailedAttempts(attempts);

      if (err.message && err.message.toLowerCase().includes('lockout')) {
        setLockoutUntil(Date.now() + 60000);
        setErrorMsg(err.message);
      } else if (attempts >= 5) {
        setLockoutUntil(Date.now() + 60000);
        setErrorMsg('Too many failed attempts. Temporary lockout active. Try again in 60s.');
      } else if (err.statusCode === 401 || err.message?.toLowerCase().includes('credential')) {
        setErrorMsg(
          `Invalid PIN. Please check your staff PIN and try again. (Attempt ${attempts}/5)`,
        );
      } else {
        setErrorMsg(err.message || 'Login failed. Please verify your PIN.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPin = () => {
    Alert.alert(
      'Forgot PIN?',
      'Please contact your Store Owner or Manager (Prathamesh Bhagwat) to reset your staff access PIN in the Staff Management console.',
      [{ text: 'OK', style: 'default' }],
    );
  };

  const selectedEmployee = directory.find((d) => d.id === selectedEmpId);
  const isNarrowScreen = windowWidth < 360;

  return (
    <View style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: Math.max(insets.top + 8, 20) },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          {/* ── TOP HERO SECTION (Matches Screenshot 4) ── */}
          <View style={styles.topHeroSection}>
            {/* Left: Brand Header */}
            <View style={styles.brandColumn}>
              {/* GrowFast Logo with up-arrow */}
              <View style={styles.brandLogoWrap}>
                <GrowFastLogo size={isNarrowScreen ? 48 : 56} />
              </View>

              {/* Wordmark: GrowFast */}
              <View style={styles.wordmarkRow}>
                <Text style={styles.brandTitleText}>
                  Grow<Text style={styles.brandTitleAccent}>Fast</Text>
                </Text>
              </View>

              {/* Blue Underline Accent under Grow */}
              <View style={styles.brandUnderlineAccent} />

              {/* Two-Line Tagline */}
              <Text style={styles.taglineText}>
                Simpler Operations.{'\n'}Cleaner Tomorrow.
              </Text>
            </View>

            {/* Right: Laundry Illustration (Washer, Plant, Towels, Lamp) */}
            <TopLaundryIllustration />
          </View>

          {/* ── BOTTOM CARD (White Elevated Bottom-Sheet Card) ── */}
          <View
            style={[
              styles.cardContainer,
              { paddingBottom: Math.max(insets.bottom + 16, 28) },
            ]}
          >
            {/* Small uppercase blue subtitle */}
            <Text style={styles.welcomeSubheader}>WELCOME BACK</Text>

            {/* Heading */}
            <Text style={styles.cardHeading}>Sign in to GrowFast</Text>

            {/* Subtext */}
            <Text style={styles.cardSubtext}>
              Access your laundry operations securely and manage your business with ease.
            </Text>

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

            {/* Field 1: Role of You (Role / Staff Dropdown) */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Role of You</Text>
              <TouchableOpacity
                style={[styles.dropdownBox, !!lockoutUntil && { opacity: 0.6 }]}
                onPress={() => setPickerVisible(true)}
                disabled={!!lockoutUntil}
                activeOpacity={0.7}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Select Staff Role"
              >
                <Icon name="person-outline" size={20} color="#0866F5" style={{ marginRight: 10 }} />
                <Text
                  style={[
                    styles.dropdownValueText,
                    !selectedEmployee && styles.dropdownPlaceholderText,
                  ]}
                  numberOfLines={1}
                >
                  {selectedEmployee
                    ? `${selectedEmployee.name} (${selectedEmployee.role})`
                    : isFetchingDirectory
                      ? 'Loading staff accounts...'
                      : 'Select your role'}
                </Text>
                <Icon name="chevron-down" size={18} color="#0866F5" style={{ marginLeft: 8 }} />
              </TouchableOpacity>
            </View>

            {/* Field 2: PIN Input with Show/Hide Toggle */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>PIN</Text>
              <View style={[styles.pinInputBox, !!lockoutUntil && { opacity: 0.6 }]}>
                <Icon
                  name="lock-closed-outline"
                  size={20}
                  color="#0866F5"
                  style={{ marginRight: 10 }}
                />
                <TextInput
                  style={styles.pinTextInput}
                  placeholder="Enter your PIN"
                  placeholderTextColor="#94A3B8"
                  keyboardType="number-pad"
                  secureTextEntry={!showPin}
                  value={pin}
                  onChangeText={handlePinChange}
                  maxLength={6}
                  editable={!lockoutUntil && !isLoading}
                  autoCapitalize="none"
                  autoCorrect={false}
                  accessible={true}
                  accessibilityLabel="Enter your PIN"
                />
                <TouchableOpacity
                  style={styles.eyeToggleBtn}
                  onPress={() => setShowPin((prev) => !prev)}
                  disabled={!!lockoutUntil}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={showPin ? 'Hide PIN' : 'Show PIN'}
                >
                  <Icon
                    name={showPin ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color="#64748B"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Forgot PIN? Link (Right-aligned, matching Screenshot 4) */}
            <TouchableOpacity
              style={styles.forgotPinTouch}
              onPress={handleForgotPin}
              activeOpacity={0.7}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Forgot PIN"
            >
              <Text style={styles.forgotPinText}>Forgot PIN?</Text>
            </TouchableOpacity>

            {/* Sign In Primary Action Button */}
            <TouchableOpacity
              style={[
                styles.signInBtn,
                (isLoading ||
                  !selectedEmpId ||
                  pin.length < 4 ||
                  pin.length > 6 ||
                  !!lockoutUntil) &&
                  styles.signInBtnDisabled,
              ]}
              onPress={handleLogin}
              disabled={
                isLoading || !selectedEmpId || pin.length < 4 || pin.length > 6 || !!lockoutUntil
              }
              activeOpacity={0.8}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Sign In"
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <View style={styles.signInBtnInner}>
                  <Text style={styles.signInBtnText}>Sign In</Text>
                  <Icon name="arrow-forward" size={19} color="#FFFFFF" style={{ marginLeft: 8 }} />
                </View>
              )}
            </TouchableOpacity>

            {/* Card Footer Divider with Shield Icon */}
            <View style={styles.securityDividerRow}>
              <View style={styles.dividerLine} />
              <View style={styles.shieldIconSquircle}>
                <Icon name="shield-checkmark-outline" size={14} color="#0866F5" />
              </View>
              <View style={styles.dividerLine} />
            </View>

            {/* Security Footer Caption */}
            <Text style={styles.securityFooterText}>
              Secure access to your GrowFast account
            </Text>

            {/* Developer Testing Quick-Fill Drawer Toggle */}
            <View style={styles.devDrawerContainer}>
              <TouchableOpacity
                onPress={() => setShowDevChips((prev) => !prev)}
                style={styles.devDrawerToggle}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.devDrawerToggleText}>
                  {showDevChips ? 'Hide Quick Test Fill ▲' : '⚡ Quick Test Fill ▼'}
                </Text>
              </TouchableOpacity>

              {showDevChips ? (
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
                  >
                    <Text style={styles.quickChipTitle}>👑 Owner (Prathamesh)</Text>
                    <Text style={styles.quickChipSubtitle}>PIN: 111111</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          </View>
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
                <Text style={styles.pickerModalTitle}>Select Your Role</Text>
                <TouchableOpacity
                  onPress={() => setPickerVisible(false)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel="Close Staff Selector"
                >
                  <Icon name="close" size={22} color="#64748B" />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
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
                    <Text style={{ color: '#64748B' }}>No staff accounts loaded.</Text>
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
    backgroundColor: '#F0F8FF',
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
  },

  // ── TOP HERO SECTION ──
  topHeroSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  brandColumn: {
    flex: 1,
    zIndex: 3,
  },
  brandLogoWrap: {
    marginBottom: 8,
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandTitleText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  brandTitleAccent: {
    color: '#0866F5',
  },
  brandUnderlineAccent: {
    height: 3.5,
    width: 44,
    backgroundColor: '#0866F5',
    borderRadius: 2,
    marginTop: 3,
    marginBottom: 10,
  },
  taglineText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
    lineHeight: 20,
  },

  // ── LAUNDRY ILLUSTRATION GRAPHICS ──
  topIllustrationWrap: {
    width: 175,
    height: 175,
    position: 'relative',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
  },
  ceilingLampContainer: {
    position: 'absolute',
    top: -20,
    right: 20,
    alignItems: 'center',
    zIndex: 1,
  },
  lampCord: {
    width: 1.5,
    height: 30,
    backgroundColor: '#94A3B8',
  },
  lampShade: {
    width: 24,
    height: 12,
    backgroundColor: '#BAE6FD',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
  lampGlow: {
    width: 10,
    height: 5,
    backgroundColor: '#FEF08A',
    opacity: 0.6,
    borderRadius: 3,
    marginTop: 1,
  },
  curvedBackdropShape: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#E0F2FE',
    right: -10,
    bottom: -10,
    zIndex: 0,
  },

  // Plant Pot on Top of Washer
  plantContainer: {
    position: 'absolute',
    top: 26,
    right: 20,
    alignItems: 'center',
    zIndex: 4,
  },
  leafOne: {
    position: 'absolute',
    top: -14,
    left: -8,
    width: 12,
    height: 18,
    backgroundColor: '#38BDF8',
    borderTopLeftRadius: 12,
    borderBottomRightRadius: 12,
    transform: [{ rotate: '-30deg' }],
  },
  leafTwo: {
    position: 'absolute',
    top: -18,
    width: 11,
    height: 20,
    backgroundColor: '#0284C7',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  leafThree: {
    position: 'absolute',
    top: -14,
    right: -8,
    width: 12,
    height: 18,
    backgroundColor: '#0369A1',
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 12,
    transform: [{ rotate: '30deg' }],
  },
  plantPot: {
    width: 20,
    height: 16,
    backgroundColor: '#0F172A',
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },

  // Stack of folded towels next to machine
  towelsStack: {
    position: 'absolute',
    bottom: 0,
    right: 98,
    zIndex: 3,
  },
  towelLayer: {
    height: 10,
    borderRadius: 5,
    marginBottom: 2,
  },
  towelTop: {
    width: 32,
    backgroundColor: '#0284C7',
  },
  towelMid: {
    width: 36,
    backgroundColor: '#BAE6FD',
  },
  towelBottom: {
    width: 40,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  towelBase: {
    width: 44,
    backgroundColor: '#0284C7',
  },

  // Front-Load Washing Machine Body
  washerMachine: {
    width: 96,
    height: 106,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    paddingTop: 8,
    zIndex: 2,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 14px rgba(8, 102, 245, 0.12)',
      },
      default: {
        shadowColor: '#0866F5',
        shadowOpacity: 0.12,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
      },
    }),
  },
  washerControlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '84%',
    marginBottom: 8,
  },
  washerDispenserSlot: {
    width: 16,
    height: 6,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
  },
  washerDotsRow: {
    flexDirection: 'row',
    gap: 2,
  },
  washerTinyDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#0866F5',
  },
  washerDialKnob: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#0866F5',
  },
  washerDoorOuterRing: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  washerDoorInnerRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#BAE6FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  washerDoorGlass: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0284C7',
    position: 'relative',
    overflow: 'hidden',
  },
  bubbleLarge: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
    opacity: 0.85,
    top: 6,
    right: 8,
  },
  bubbleMedium: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#FFFFFF',
    opacity: 0.75,
    top: 14,
    left: 8,
  },
  bubbleSmall: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
    opacity: 0.9,
    top: 22,
    right: 14,
  },
  waterWaveCurve: {
    position: 'absolute',
    bottom: -4,
    left: -4,
    right: -4,
    height: 20,
    backgroundColor: '#0369A1',
    borderRadius: 12,
    opacity: 0.7,
  },

  // ── BOTTOM ELEVATED WHITE CARD ──
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 28,
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  welcomeSubheader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0866F5',
    letterSpacing: 1.2,
  },
  cardHeading: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 4,
    letterSpacing: -0.3,
  },
  cardSubtext: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginTop: 4,
    marginBottom: 20,
  },

  // Error Box
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    color: '#991b1b',
    lineHeight: 18,
  },
  retryBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#fee2e2',
    borderRadius: 8,
  },
  retryBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#991b1b',
  },

  // Form Fields
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  dropdownBox: {
    height: 50,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dropdownValueText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  dropdownPlaceholderText: {
    color: '#94A3B8',
    fontWeight: '400',
  },
  pinInputBox: {
    height: 50,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pinTextInput: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    color: '#0F172A',
    paddingVertical: 0,
  },
  eyeToggleBtn: {
    padding: 4,
  },

  // Forgot PIN Link
  forgotPinTouch: {
    alignSelf: 'flex-end',
    marginTop: -4,
    marginBottom: 20,
    paddingVertical: 4,
  },
  forgotPinText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0866F5',
  },

  // Primary Sign In Button
  signInBtn: {
    height: 50,
    backgroundColor: '#0866F5',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0866F5',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 3,
  },
  signInBtnDisabled: {
    backgroundColor: '#93C5FD',
    shadowOpacity: 0,
    elevation: 0,
  },
  signInBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Security Footer
  securityDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
    marginBottom: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  shieldIconSquircle: {
    paddingHorizontal: 12,
  },
  securityFooterText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },

  // Developer Quick Test Fill Drawer
  devDrawerContainer: {
    marginTop: 18,
    alignItems: 'center',
  },
  devDrawerToggle: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  devDrawerToggleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  quickFillRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    width: '100%',
  },
  quickChip: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  quickChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#0866F5',
  },
  quickChipTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  quickChipSubtitle: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },

  // Staff Picker Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  pickerModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#0F172A',
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
    borderBottomColor: '#F1F5F9',
  },
  pickerModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  staffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  staffRowSelected: {
    borderColor: '#0866F5',
    backgroundColor: '#EFF6FF',
  },
  staffAvatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  staffAvatarInitials: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0866F5',
  },
  staffRowName: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  staffRowId: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  rolePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  roleOwner: {
    backgroundColor: '#FEF3C7',
  },
  roleCounter: {
    backgroundColor: '#E0E7FF',
  },
  rolePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  roleTextOwner: {
    color: '#B45309',
  },
  roleTextCounter: {
    color: '#4338CA',
  },
});
