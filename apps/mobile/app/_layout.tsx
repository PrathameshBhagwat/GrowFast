import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConnectionBanner } from '../src/components/ConnectionBanner';
import { AuthProvider, useAuth } from '../src/contexts/AuthContext';
import { getDatabase } from '../src/db/sqlite';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        // Never retry 401 Unauthorized errors
        if (error?.statusCode === 401 || error?.status === 401) return false;
        return failureCount < 2;
      },
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

export function ProtectedRoutes({
  children,
  isDbReady = true,
}: {
  children: React.ReactNode;
  isDbReady?: boolean;
}) {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();

  const isNavigationReady = Boolean(rootNavigationState?.key);
  const isAppReady = isDbReady && !isLoading && isNavigationReady;

  useEffect(() => {
    if (!isAppReady) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect to login screen if unauthenticated
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      // Redirect to main tabs if already authenticated
      router.replace('/(tabs)');
    }
  }, [isAppReady, isAuthenticated, segments, router]);

  return (
    <View style={styles.wrapper}>
      {children}
      {(!isDbReady || isLoading) && (
        <View style={styles.loadingOverlay} pointerEvents="auto">
          <ActivityIndicator size="large" color="#4f46e5" />
        </View>
      )}
    </View>
  );
}

export default function RootLayout() {
  const [isDbReady, setIsDbReady] = useState(false);

  useEffect(() => {
    async function initApp() {
      try {
        // Initialize SQLite local database and migrations
        await getDatabase();
      } catch (err) {
        console.error('Failed to initialize mobile app foundation:', err);
      } finally {
        setIsDbReady(true);
      }
    }

    initApp();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ProtectedRoutes isDbReady={isDbReady}>
          <View style={styles.container}>
            <StatusBar style="auto" />
            <ConnectionBanner />
            <Stack screenOptions={{ headerShown: false }}>
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
  wrapper: {
    flex: 1,
  },
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
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    zIndex: 999,
  },
});
