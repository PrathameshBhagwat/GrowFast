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
} from 'react-native';
import { useRouter } from 'expo-router';
import { apiClient } from '../../src/api/client';
import { useAuth } from '../../src/contexts/AuthContext';

interface EmployeeDirectoryItem {
  id: string;
  name: string;
  role: string;
}

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [directory, setDirectory] = useState<EmployeeDirectoryItem[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [pin, setPin] = useState<string>('');
  const [isFetchingDirectory, setIsFetchingDirectory] = useState(true);

  const loadDirectory = useCallback(async () => {
    setIsFetchingDirectory(true);
    try {
      // Request strictly OWNER and COUNTER accounts from backend
      const list = await apiClient.auth.getDirectory(['OWNER', 'COUNTER']);
      if (Array.isArray(list)) {
        // Strictly filter to ensure only POS-authorized roles (OWNER, COUNTER) are shown
        const mobileRoles = ['OWNER', 'COUNTER'];
        const posStaff = list.filter((emp) => mobileRoles.includes(emp.role));
        setDirectory(posStaff);
        if (posStaff.length > 0) {
          setSelectedEmpId((prev) => prev || posStaff[0].id);
          setErrorMsg(null);
        }
      }
    } catch (err: any) {
      console.warn('Could not load employee directory:', err.message);
      setErrorMsg(
        `Unable to connect to backend server at ${apiClient.getBaseUrl()}. Please ensure the NestJS backend is running and your device is connected to the same Wi-Fi network.`,
      );
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
        err.message?.includes('Failed to fetch')
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

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'OWNER':
        return { bg: '#fef08a', text: '#854d0e' };
      case 'COUNTER':
        return { bg: '#dbeafe', text: '#1e40af' };
      default:
        return { bg: '#f1f5f9', text: '#334155' };
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.title}>GrowFast Mobile</Text>
          <Text style={styles.subtitle}>Laundry & Dry-Cleaning Point of Sale</Text>

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

          {/* Employee Directory Selection */}
          <Text style={styles.label}>Select Staff Account</Text>
          {isFetchingDirectory ? (
            <ActivityIndicator size="small" color="#2563eb" style={{ marginVertical: 12 }} />
          ) : directory.length > 0 ? (
            <View style={styles.directoryContainer}>
              {directory.map((emp) => {
                const isSelected = selectedEmpId === emp.id;
                const badge = getRoleBadgeStyle(emp.role);
                return (
                  <TouchableOpacity
                    key={emp.id}
                    style={[styles.empOptionCard, isSelected && styles.empOptionCardActive]}
                    onPress={() => setSelectedEmpId(emp.id)}
                    accessible={true}
                    accessibilityLabel={`Select ${emp.name} (${emp.role})`}
                  >
                    <View style={styles.radioCircle}>
                      {isSelected && <View style={styles.radioDot} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.empName}>{emp.name}</Text>
                      <Text style={styles.empIdSub}>{emp.id}</Text>
                    </View>
                    <View style={[styles.roleBadge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.roleBadgeText, { color: badge.text }]}>
                        {emp.role}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={styles.fieldContainer}>
              <TextInput
                style={styles.input}
                placeholder="e.g. emp-counter-001"
                placeholderTextColor="#94a3b8"
                value={selectedEmpId}
                onChangeText={setSelectedEmpId}
                autoCapitalize="none"
              />
            </View>
          )}

          {/* Security PIN Input */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Security PIN</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter PIN (e.g. 333333 for Counter)"
              placeholderTextColor="#94a3b8"
              keyboardType="number-pad"
              secureTextEntry
              value={pin}
              onChangeText={setPin}
            />
          </View>

          {/* Sign In Button (Touch target >= 44px) */}
          <TouchableOpacity
            style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
            accessible={true}
            accessibilityLabel="Sign into GrowFast system"
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.submitButtonText}>Sign In</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0f172a',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
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
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 13,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 8,
    alignSelf: 'center',
    backgroundColor: '#fee2e2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  retryBtnText: {
    color: '#991b1b',
    fontSize: 12,
    fontWeight: '600',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  directoryContainer: {
    gap: 8,
    marginBottom: 16,
  },
  empOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    gap: 10,
    minHeight: 48,
  },
  empOptionCardActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2563eb',
  },
  empName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  empIdSub: {
    fontSize: 11,
    color: '#94a3b8',
    fontFamily: 'monospace',
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  fieldContainer: {
    marginBottom: 16,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#ffffff',
  },
  submitButton: {
    height: 48,
    backgroundColor: '#2563eb',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
