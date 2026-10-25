import React from 'react';
import { Tabs } from 'expo-router';
import { Text, View, StyleSheet } from 'react-native';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#64748b',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#e2e8f0',
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
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
              <Text style={[styles.tabEmoji, { opacity: focused ? 1 : 0.6 }]}>🏠</Text>
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
              <Text style={[styles.tabEmoji, { opacity: focused ? 1 : 0.6 }]}>📋</Text>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="deliveries"
        options={{
          title: 'Deliveries',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.tabIconBox}>
              <Text style={[styles.tabEmoji, { opacity: focused ? 1 : 0.6 }]}>🚚</Text>
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
              <Text style={[styles.tabEmoji, { opacity: focused ? 1 : 0.6 }]}>👥</Text>
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
              <Text style={[styles.tabEmoji, { opacity: focused ? 1 : 0.6 }]}>⚙️</Text>
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
});
