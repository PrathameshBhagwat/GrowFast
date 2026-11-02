import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme, ThemeMode } from '../../src/contexts/ThemeContext';
import { GrowFastLogo } from '../../src/components/GrowFastLogo';

export default function SettingsScreen() {
  const router = useRouter();
  const { logout, user } = useAuth();
  const { theme, setTheme, colors } = useTheme();

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  const themeOptions: { key: ThemeMode; label: string; icon: string }[] = [
    { key: 'light', label: 'Light', icon: '☀️' },
    { key: 'dark', label: 'Dark', icon: '🌙' },
    { key: 'system', label: 'System', icon: '⚙️' },
  ];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentContainer}
    >
      <View style={styles.brandHero}>
        <GrowFastLogo size={72} containerStyle={styles.logoContainer} />
        <Text style={[styles.brandTitle, { color: colors.textPrimary }]}>GrowFast Laundry</Text>
        <Text style={[styles.brandSubtitle, { color: colors.textSecondary }]}>
          Operations & POS Management
        </Text>
      </View>

      {/* Theme & Appearance Card */}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Appearance & Theme</Text>
        <Text style={[styles.themeDescription, { color: colors.textSecondary }]}>
          Choose interface appearance mode
        </Text>
        <View style={styles.themeOptionsRow}>
          {themeOptions.map((opt) => {
            const isSelected = theme === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[
                  styles.themeOptionBtn,
                  {
                    backgroundColor: isSelected ? colors.primary : colors.surfaceSecondary,
                    borderColor: isSelected ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setTheme(opt.key)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`Set theme to ${opt.label}`}
              >
                <Text style={styles.themeOptionIcon}>{opt.icon}</Text>
                <Text
                  style={[
                    styles.themeOptionText,
                    { color: isSelected ? '#FFFFFF' : colors.textPrimary },
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {user ? (
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Logged-in Staff</Text>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>Name: {user.name}</Text>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>Role: {user.role}</Text>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>ID: {user.id}</Text>
          {user.storeName ? (
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              Store: {user.storeName}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
          Application Information
        </Text>
        <Text style={[styles.infoText, { color: colors.textSecondary }]}>
          App: GrowFast Mobile POS
        </Text>
        <Text style={[styles.infoText, { color: colors.textSecondary }]}>
          Version: 1.0.0 (Phase B Foundation)
        </Text>
        <Text style={[styles.infoText, { color: colors.textSecondary }]}>
          Architecture: Expo + React Native + SQLite
        </Text>
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
  themeDescription: {
    fontSize: 13,
    marginBottom: 12,
  },
  themeOptionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  themeOptionBtn: {
    flex: 1,
    minHeight: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  themeOptionIcon: {
    fontSize: 15,
  },
  themeOptionText: {
    fontSize: 13,
    fontWeight: '700',
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
