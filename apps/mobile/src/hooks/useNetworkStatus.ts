import { useState, useEffect } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

export interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  connectionType: string | null;
}

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isConnected: true,
    isInternetReachable: true,
    connectionType: 'wifi',
  });

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setStatus({
        isConnected: Boolean(state.isConnected),
        isInternetReachable: state.isInternetReachable,
        connectionType: state.type,
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return status;
}
