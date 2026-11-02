import React from 'react';
import { Tabs, Redirect } from 'expo-router';
import { Text, View, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { GrowFastLogo } from '../../src/components/GrowFastLogo';

const Icon = Ionicons as unknown as React.ComponentType<{
  name: string;
  size?: number;
  color?: string;
  style?: any;
}>;

export default function TabsLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const { colors } = useTheme();

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <GrowFastLogo size={80} containerStyle={{ marginBottom: 16 }} />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.tabBarBackground,
          borderTopColor: colors.tabBarBorder,
          borderTopWidth: 1,
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11.5,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.tabIconBox}>
              <Icon name={focused ? 'home' : 'home-outline'} size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.tabIconBox}>
              <Icon name={focused ? 'receipt' : 'receipt-outline'} size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="deliveries"
        options={{
          href: null, // Temporarily hidden while Home Delivery is not offered
          title: 'Deliveries',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.tabIconBox}>
              <Icon name={focused ? 'bicycle' : 'bicycle-outline'} size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="customers"
        options={{
          title: 'Customers',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.tabIconBox}>
              <Icon name={focused ? 'people' : 'people-outline'} size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'More',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.tabIconBox}>
              <Icon
                name={focused ? 'ellipsis-horizontal-circle' : 'ellipsis-horizontal-circle-outline'}
                size={22}
                color={color}
              />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabIconBox: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  tabEmoji: {
    fontSize: 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
});
