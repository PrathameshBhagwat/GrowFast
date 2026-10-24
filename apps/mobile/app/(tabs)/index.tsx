import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { getUserSession, MobileUserSession } from '../../src/storage/secure-store';
import { useNetworkStatus } from '../../src/hooks/useNetworkStatus';

export default function HomeScreen() {
  const [session, setSession] = useState<MobileUserSession | null>(null);
  const { isConnected } = useNetworkStatus();

  useEffect(() => {
    getUserSession().then(setSession);
  }, []);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.headerCard}>
        <Text style={styles.welcomeText}>Welcome, {session?.name || 'Staff'}</Text>
        <Text style={styles.roleBadge}>
          {session?.role || 'COUNTER'} • {session?.storeName || 'Store Terminal'}
        </Text>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Terminal Readiness Status</Text>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Backend Idempotency</Text>
          <Text style={styles.statusValueSuccess}>Enforced (Phase B)</Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Local SQLite Cache</Text>
          <Text style={styles.statusValueSuccess}>Ready</Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Network Mode</Text>
          <Text style={isConnected ? styles.statusValueSuccess : styles.statusValueWarning}>
            {isConnected ? 'Online' : 'Offline Drafts Only'}
          </Text>
        </View>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Phase B Foundation</Text>
        <Text style={styles.infoBody}>
          Mobile application shell initialized with Expo Router, SQLite local draft database,
          SecureStore token storage, and server-enforced draft idempotency contracts.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 16,
  },
  headerCard: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  roleBadge: {
    fontSize: 13,
    color: '#dbeafe',
    marginTop: 4,
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  statusLabel: {
    fontSize: 14,
    color: '#475569',
  },
  statusValueSuccess: {
    fontSize: 14,
    fontWeight: '600',
    color: '#16a34a',
  },
  statusValueWarning: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ea580c',
  },
  infoCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e40af',
    marginBottom: 6,
  },
  infoBody: {
    fontSize: 13,
    color: '#1e3a8a',
    lineHeight: 18,
  },
});
