import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConnectionBanner } from '../src/components/ConnectionBanner';
import { AuthProvider, useAuth } from '../src/contexts/AuthContext';
import { getDatabase } from '../src/db/sqlite';

const queryClient = new QueryClient({
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

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect to login screen if unauthenticated
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      // Redirect to main tabs if already authenticated
      router.replace('/(tabs)');
    }
  }, [isLoading, isAuthenticated, segments, router]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return <>{children}</>;
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

  if (!isDbReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ProtectedRoutes>
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
