import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

export const ConnectionBanner: React.FC = () => {
  const { isConnected, isInternetReachable } = useNetworkStatus();

  // If connected and internet is reachable, show nothing
  if (isConnected && isInternetReachable !== false) {
    return null;
  }

  return (
    <View style={styles.bannerContainer}>
      <Text style={styles.bannerText}>
        {!isConnected
          ? 'No Network Connection — Operating in Offline Mode'
          : 'Connecting to Server...'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  bannerContainer: {
    backgroundColor: '#dc2626',
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  bannerText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
});
