import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { logger } from '../utils/logger';
import { auth } from '../config/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface UsageData {
  monthKey: string;
  deckGenerations: number;
  hintGenerations: number;
  limits: {
    deck: number;
    hints: number;
  };
}

export interface PremiumContextType {
  isPremiumEffective: boolean;
  usage: UsageData | null;
  loading: boolean;
  error: string | null;
  subscribe: () => Promise<void>;
  refreshEntitlements: () => Promise<void>;
  fetchUsage: () => Promise<void>;
  incrementUsage: (kind: 'deck' | 'hints') => Promise<void>;
}

const PremiumContext = createContext<PremiumContextType | undefined>(undefined);

export const usePremium = () => {
  const context = useContext(PremiumContext);
  if (!context) {
    throw new Error('usePremium must be used within PremiumProvider');
  }
  return context;
};

interface PremiumProviderProps {
  children: React.ReactNode;
}

export const PremiumProvider: React.FC<PremiumProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [isPremiumEffective, setIsPremiumEffective] = useState(false);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Check premium status from Firebase custom claims
   */
  const checkPremiumStatus = useCallback(async () => {
    try {
      if (!user) {
        setIsPremiumEffective(false);
        return;
      }

      // Get ID token result to access custom claims
      const currentUser = auth().currentUser;
      if (!currentUser) {
        setIsPremiumEffective(false);
        return;
      }

      const tokenResult = await currentUser.getIdTokenResult();
      const isPremium = tokenResult.claims.premium === true;
      
      logger.debug(`[Premium] User premium status: ${isPremium}`);
      setIsPremiumEffective(isPremium);
    } catch (err) {
      logger.error('[Premium] Error checking premium status:', err);
      setError(err instanceof Error ? err.message : 'Failed to check premium status');
    }
  }, [user]);

  /**
   * Fetch usage data from local storage (client-side tracking)
   */
  const fetchUsage = useCallback(async () => {
    try {
      if (!user) {
        setUsage(null);
        return;
      }

      // Get current month key (YYYY-MM)
      const now = new Date();
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      // Load usage from AsyncStorage
      const storageKey = `usage_${user.uid}_${monthKey}`;
      const stored = await AsyncStorage.getItem(storageKey);
      
      let data: UsageData;
      if (stored) {
        data = JSON.parse(stored);
      } else {
        // Initialize new month
        data = {
          monthKey,
          deckGenerations: 0,
          hintGenerations: 0,
          limits: {
            deck: 3,
            hints: 1,
          },
        };
        await AsyncStorage.setItem(storageKey, JSON.stringify(data));
      }
      
      logger.debug(`[Premium] Usage data:`, data);
      setUsage(data);
      setError(null);
    } catch (err) {
      logger.error('[Premium] Error fetching usage:', err);
      // Don't set error - just use default values
      setUsage({
        monthKey: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
        deckGenerations: 0,
        hintGenerations: 0,
        limits: { deck: 3, hints: 1 },
      });
    }
  }, [user]);

  /**
   * Increment usage count for a specific feature
   */
  const incrementUsage = useCallback(async (kind: 'deck' | 'hints') => {
    try {
      if (!user) return;

      const now = new Date();
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const storageKey = `usage_${user.uid}_${monthKey}`;
      
      // Load current usage
      const stored = await AsyncStorage.getItem(storageKey);
      let data: UsageData;
      
      if (stored) {
        data = JSON.parse(stored);
      } else {
        data = {
          monthKey,
          deckGenerations: 0,
          hintGenerations: 0,
          limits: { deck: 3, hints: 1 },
        };
      }
      
      // Increment the appropriate counter
      if (kind === 'deck') {
        data.deckGenerations += 1;
      } else {
        data.hintGenerations += 1;
      }
      
      // Save back to storage
      await AsyncStorage.setItem(storageKey, JSON.stringify(data));
      
      // Update state
      setUsage(data);
      logger.debug(`[Premium] Incremented ${kind} usage:`, data);
    } catch (err) {
      logger.error('[Premium] Error incrementing usage:', err);
    }
  }, [user]);

  /**
   * Initialize premium state on mount and when user changes
   */
  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      await Promise.all([
        checkPremiumStatus(),
        fetchUsage(),
      ]);
      setLoading(false);
    };

    initialize();
  }, [checkPremiumStatus, fetchUsage]);

  /**
   * Refresh entitlements after purchase
   * This forces a token refresh to pick up updated custom claims
   */
  const refreshEntitlements = useCallback(async () => {
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) {
        throw new Error('No user signed in');
      }

      // Force token refresh to get updated claims
      await currentUser.getIdToken(true);
      
      // Re-check premium status and usage
      await Promise.all([
        checkPremiumStatus(),
        fetchUsage(),
      ]);

      logger.info('[Premium] Entitlements refreshed');
    } catch (err) {
      logger.error('[Premium] Error refreshing entitlements:', err);
      throw err;
    }
  }, [checkPremiumStatus, fetchUsage]);

  /**
   * Open paywall and handle subscription
   * Note: This is a placeholder. Actual implementation requires RevenueCat SDK
   * Install: npx expo install react-native-purchases
   */
  const subscribe = useCallback(async () => {
    try {
      // TODO: Implement RevenueCat integration
      // 1. Initialize Purchases SDK
      // 2. Fetch offerings
      // 3. Present paywall modal
      // 4. On successful purchase, call refreshEntitlements()
      
      logger.warn('[Premium] Subscribe not yet implemented - requires RevenueCat SDK');
      throw new Error('Subscription feature coming soon. Please check back later.');
    } catch (err) {
      logger.error('[Premium] Subscribe error:', err);
      throw err;
    }
  }, [refreshEntitlements]);

  const value: PremiumContextType = {
    isPremiumEffective,
    usage,
    loading,
    error,
    subscribe,
    refreshEntitlements,
    fetchUsage,
    incrementUsage,
  };

  return <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>;
};
