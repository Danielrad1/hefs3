import { useState, useEffect } from 'react';
import { NetworkService } from '../services/network/NetworkService';

/**
 * Hook to check current network status
 * Returns isOnline boolean that updates when connectivity changes
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Check initial state
    NetworkService.isOnline().then(setIsOnline);

    // Subscribe to changes
    const unsubscribe = NetworkService.subscribe(setIsOnline);

    return unsubscribe;
  }, []);

  return { isOnline };
}
