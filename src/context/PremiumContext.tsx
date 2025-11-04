import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import { useAuth } from './AuthContext';
import { logger } from '../utils/logger';
import { auth } from '../config/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Lazy import to avoid initializing native module at import time
let Purchases: any = null;
let CustomerInfo: any = null;
let PurchasesOfferings: any = null;
let PurchasesPackage: any = null;

if (Platform.OS === 'ios') {
  try {
    const PurchasesModule = require('react-native-purchases');
    Purchases = PurchasesModule.default || PurchasesModule;
  } catch (err) {
    logger.warn('[Premium] Failed to load react-native-purchases module:', err);
  }
}

export interface UsageData {
  monthKey: string;
  deckGenerations: number; // Legacy - kept for backward compat
  basicDeckGenerations: number;
  advancedDeckGenerations: number;
  basicHintGenerations: number;
  advancedHintGenerations: number;
  limits: {
    deck: number; // Legacy - kept for backward compat
    basicDecks: number;
    advancedDecks: number;
    basicHints: number;
    advancedHints: number;
  };
}

export interface PremiumContextType {
  isPremiumEffective: boolean;
  usage: UsageData | null;
  loading: boolean;
  error: string | null;
  offerings: any | null;
  monthlyPackage: any | null;
  subscribe: () => Promise<void>;
  restore: () => Promise<void>;
  refreshEntitlements: () => Promise<void>;
  fetchUsage: () => Promise<void>;
  incrementUsage: (kind: 'deck' | 'basicDecks' | 'advancedDecks' | 'basicHints' | 'advancedHints') => Promise<void>;
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
  // Free version: everyone is premium
  const [isPremiumEffective, setIsPremiumEffective] = useState(true);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rcInitialized, setRcInitialized] = useState(false);
  const [offerings, setOfferings] = useState<any | null>(null);
  const [monthlyPackage, setMonthlyPackage] = useState<any | null>(null);

  /**
   * Check premium status - Free version: always premium
   */
  const checkPremiumStatus = useCallback(async () => {
    // Free version: everyone is premium
    setIsPremiumEffective(true);
  }, [user, rcInitialized]);

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
        logger.debug(`[Premium] Loaded usage from storage for key ${storageKey}:`, data);
        
        // Migrate old data that doesn't have new hint fields
        let migrated = false;
        if (data.basicHintGenerations === undefined) {
          data.basicHintGenerations = 0;
          migrated = true;
        }
        if (data.advancedHintGenerations === undefined) {
          data.advancedHintGenerations = 0;
          migrated = true;
        }
        // Ensure limits object has hint fields
        if (!data.limits.basicHints) {
          data.limits.basicHints = 3;
          migrated = true;
        }
        if (!data.limits.advancedHints) {
          data.limits.advancedHints = 1;
          migrated = true;
        }
        // Save migrated data
        if (migrated) {
          logger.info(`[Premium] Migrated old usage data for user ${user.uid}`);
          await AsyncStorage.setItem(storageKey, JSON.stringify(data));
        }
      } else {
        // Initialize new month - Free version: unlimited
        data = {
          monthKey,
          deckGenerations: 0,
          basicDeckGenerations: 0,
          advancedDeckGenerations: 0,
          basicHintGenerations: 0,
          advancedHintGenerations: 0,
          limits: {
            deck: 999999,
            basicDecks: 999999,
            advancedDecks: 999999,
            basicHints: 999999,
            advancedHints: 999999,
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
      const limits = isPremiumEffective 
        ? { deck: 999999, basicDecks: 999999, advancedDecks: 999999, basicHints: 999999, advancedHints: 999999 }
        : { deck: 3, basicDecks: 3, advancedDecks: 1, basicHints: 3, advancedHints: 1 };
      setUsage({
        monthKey: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
        deckGenerations: 0,
        basicDeckGenerations: 0,
        advancedDeckGenerations: 0,
        basicHintGenerations: 0,
        advancedHintGenerations: 0,
        limits,
      });
    }
  }, [user, isPremiumEffective]);

  /**
   * Update limits when premium status changes
   */
  useEffect(() => {
    if (usage) {
      const newLimits = isPremiumEffective 
        ? { deck: 999999, basicDecks: 999999, advancedDecks: 999999, basicHints: 999999, advancedHints: 999999 }
        : { deck: 3, basicDecks: 3, advancedDecks: 1, basicHints: 3, advancedHints: 1 };
      setUsage({ ...usage, limits: newLimits });
    }
  }, [isPremiumEffective]);

  /**
   * Increment usage count for a specific feature
   */
  const incrementUsage = useCallback(async (kind: 'deck' | 'basicDecks' | 'advancedDecks' | 'basicHints' | 'advancedHints') => {
    try {
      if (!user) {
        logger.warn('[Premium] Cannot increment usage: no user');
        return;
      }

      const now = new Date();
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const storageKey = `usage_${user.uid}_${monthKey}`;
      
      logger.info(`[Premium] Attempting to increment ${kind} usage for user ${user.uid}`);
      
      // Load current usage
      const stored = await AsyncStorage.getItem(storageKey);
      let data: UsageData;
      
      if (stored) {
        data = JSON.parse(stored);
        logger.debug(`[Premium] Found existing usage data:`, data);
        
        // Migrate old data that doesn't have new fields
        if (data.basicDeckGenerations === undefined) {
          data.basicDeckGenerations = 0;
        }
        if (data.advancedDeckGenerations === undefined) {
          data.advancedDeckGenerations = 0;
        }
        if (data.basicHintGenerations === undefined) {
          data.basicHintGenerations = 0;
        }
        if (data.advancedHintGenerations === undefined) {
          data.advancedHintGenerations = 0;
        }
        // Ensure limits object has all fields
        if (!data.limits.basicDecks) {
          data.limits.basicDecks = 3;
        }
        if (!data.limits.advancedDecks) {
          data.limits.advancedDecks = 1;
        }
        if (!data.limits.basicHints) {
          data.limits.basicHints = 3;
        }
        if (!data.limits.advancedHints) {
          data.limits.advancedHints = 1;
        }
      } else {
        logger.info(`[Premium] No existing usage data, creating new`);
        const limits = isPremiumEffective 
          ? { deck: 999999, basicDecks: 999999, advancedDecks: 999999, basicHints: 999999, advancedHints: 999999 }
          : { deck: 3, basicDecks: 3, advancedDecks: 1, basicHints: 3, advancedHints: 1 };
        data = {
          monthKey,
          deckGenerations: 0,
          basicDeckGenerations: 0,
          advancedDeckGenerations: 0,
          basicHintGenerations: 0,
          advancedHintGenerations: 0,
          limits,
        };
      }
      
      // Check if user has already reached the limit (for non-premium users)
      if (!isPremiumEffective) {
        let canIncrement = true;
        if (kind === 'deck' && data.deckGenerations >= data.limits.deck) {
          logger.warn(`[Premium] Cannot increment deck: limit reached (${data.deckGenerations}/${data.limits.deck})`);
          canIncrement = false;
        } else if (kind === 'basicDecks' && data.basicDeckGenerations >= data.limits.basicDecks) {
          logger.warn(`[Premium] Cannot increment basicDecks: limit reached (${data.basicDeckGenerations}/${data.limits.basicDecks})`);
          canIncrement = false;
        } else if (kind === 'advancedDecks' && data.advancedDeckGenerations >= data.limits.advancedDecks) {
          logger.warn(`[Premium] Cannot increment advancedDecks: limit reached (${data.advancedDeckGenerations}/${data.limits.advancedDecks})`);
          canIncrement = false;
        } else if (kind === 'basicHints' && data.basicHintGenerations >= data.limits.basicHints) {
          logger.warn(`[Premium] Cannot increment basicHints: limit reached (${data.basicHintGenerations}/${data.limits.basicHints})`);
          canIncrement = false;
        } else if (kind === 'advancedHints' && data.advancedHintGenerations >= data.limits.advancedHints) {
          logger.warn(`[Premium] Cannot increment advancedHints: limit reached (${data.advancedHintGenerations}/${data.limits.advancedHints})`);
          canIncrement = false;
        }
        
        if (!canIncrement) {
          // Don't increment, but update state with current data
          setUsage(data);
          return;
        }
      }
      
      // Increment the appropriate counter
      if (kind === 'deck') {
        data.deckGenerations += 1;
      } else if (kind === 'basicDecks') {
        data.basicDeckGenerations += 1;
      } else if (kind === 'advancedDecks') {
        data.advancedDeckGenerations += 1;
      } else if (kind === 'basicHints') {
        data.basicHintGenerations += 1;
      } else {
        data.advancedHintGenerations += 1;
      }
      
      logger.info(`[Premium] Incremented ${kind} usage. New counts:`, {
        deck: data.deckGenerations,
        basicDecks: data.basicDeckGenerations,
        advancedDecks: data.advancedDeckGenerations,
        basicHints: data.basicHintGenerations,
        advancedHints: data.advancedHintGenerations,
      });
      
      // Save back to storage
      await AsyncStorage.setItem(storageKey, JSON.stringify(data));
      logger.debug(`[Premium] Saved usage to AsyncStorage with key: ${storageKey}`);
      
      // Update state
      setUsage(data);
    } catch (err) {
      logger.error('[Premium] Error incrementing usage:', err);
    }
  }, [user, isPremiumEffective]);

  /**
   * Initialize RevenueCat SDK on mount - Free version: disabled
   */
  useEffect(() => {
    // Free version: no RevenueCat initialization
    logger.info('[Premium] Free version - RevenueCat disabled');
  }, []);

  /**
   * Handle auth state changes - Free version: disabled
   */
  useEffect(() => {
    // Free version: no RevenueCat sync
  }, [user, rcInitialized, checkPremiumStatus]);

  /**
   * Initialize premium state on mount and when user changes
   */
  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      setError(null);
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
   * Handle subscription purchase - Free version: no-op
   */
  const subscribe = useCallback(async () => {
    // Free version: everyone is already premium
    logger.info('[Premium] Free version - subscribe is a no-op');
  }, [monthlyPackage, refreshEntitlements]);

  /**
   * Restore previous purchases - Free version: no-op
   */
  const restore = useCallback(async () => {
    // Free version: everyone is already premium
    logger.info('[Premium] Free version - restore is a no-op');
  }, [refreshEntitlements]);

  const value: PremiumContextType = {
    isPremiumEffective,
    usage,
    loading,
    error,
    offerings,
    monthlyPackage,
    subscribe,
    restore,
    refreshEntitlements,
    fetchUsage,
    incrementUsage,
  };

  return <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>;
};
