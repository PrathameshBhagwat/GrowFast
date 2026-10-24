import React from 'react';
import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#ffffff' },
        headerTintColor: '#0f172a',
        headerTitleStyle: { fontWeight: 'bold' },
        tabBarActiveTintColor: '#3b82f6',
        tabBarInactiveTintColor: '#64748b',
        tabBarStyle: { backgroundColor: '#ffffff', borderTopColor: '#e2e8f0' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          headerTitle: 'GrowFast POS',
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          headerTitle: 'Order Management',
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          headerTitle: 'Store Settings',
        }}
      />
    </Tabs>
  );
}
