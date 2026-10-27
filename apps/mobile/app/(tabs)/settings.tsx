import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { GrowFastLogo } from '../../src/components/GrowFastLogo';

export default function SettingsScreen() {
  const router = useRouter();
  const { logout, user } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.brandHero}>
        <GrowFastLogo size={72} containerStyle={styles.logoContainer} />
        <Text style={styles.brandTitle}>GrowFast Laundry</Text>
        <Text style={styles.brandSubtitle}>Operations & POS Management</Text>
      </View>

      {user ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Logged-in Staff</Text>
          <Text style={styles.infoText}>Name: {user.name}</Text>
          <Text style={styles.infoText}>Role: {user.role}</Text>
          <Text style={styles.infoText}>ID: {user.id}</Text>
          {user.storeName ? <Text style={styles.infoText}>Store: {user.storeName}</Text> : null}
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Application Information</Text>
        <Text style={styles.infoText}>App: GrowFast Mobile POS</Text>
        <Text style={styles.infoText}>Version: 1.0.0 (Phase B Foundation)</Text>
        <Text style={styles.infoText}>Architecture: Expo + React Native + SQLite</Text>
      </View>

      <TouchableOpacity
        style={styles.logoutButton}
        onPress={handleLogout}
        accessibilityRole="button"
        accessibilityLabel="Log out of application"
      >
        <Text style={styles.logoutButtonText}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  brandHero: {
    alignItems: 'center',
    paddingVertical: 20,
    marginBottom: 12,
  },
  logoContainer: {
    marginBottom: 10,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  brandSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 6,
  },
  logoutButton: {
    backgroundColor: '#ef4444',
    minHeight: 48,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  logoutButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
