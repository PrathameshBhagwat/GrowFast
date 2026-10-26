import React, { useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConnectionBanner } from '../src/components/ConnectionBanner';
import { AuthProvider, useAuth } from '../src/contexts/AuthContext';
import { getDatabase } from '../src/db/sqlite';
import { onUnauthorized } from '../src/api/client';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

function ProtectedRoutes({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();

  // Clear query cache on unauthorized response to protect user data
  useEffect(() => {
    const unsubscribe = onUnauthorized(() => {
      queryClient.clear();
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    // 1. Never attempt navigation before the root navigator state key exists
    if (!rootNavigationState?.key) return;

    // 2. Never attempt navigation while authentication state is loading
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inProtectedGroup = segments[0] === '(tabs)';
    const isAtRoot = !segments[0] || (segments[0] as string) === 'index';

    if (!isAuthenticated) {
      // Unauthenticated: if at root or inside protected tabs, redirect to login
      if (isAtRoot || inProtectedGroup) {
        router.replace('/(auth)/login');
      }
    } else {
      // Authenticated: if at root or on login screen, redirect to main tabs
      if (isAtRoot || inAuthGroup) {
        router.replace('/(tabs)');
      }
    }
  }, [isLoading, isAuthenticated, segments, rootNavigationState?.key, router]);

  // Unconditionally render children so the root navigator (<Stack>) mounts on the first render
  return <>{children}</>;
}

export default function RootLayout() {
  useEffect(() => {
    async function initApp() {
      try {
        if (Platform.OS !== 'web') {
          // Initialize SQLite local database and migrations asynchronously
          await getDatabase();
        }
      } catch (err) {
        console.error('Failed to initialize mobile app foundation:', err);
      }
    }

    initApp();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ProtectedRoutes>
          <View style={styles.container}>
            <StatusBar style="auto" />
            <ConnectionBanner />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)/login" />
              <Stack.Screen name="(tabs)" />
            </Stack>
          </View>
        </ProtectedRoutes>
      </AuthProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
});
