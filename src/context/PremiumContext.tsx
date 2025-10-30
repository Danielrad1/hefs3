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
  deckGenerations: number;
  basicHintGenerations: number;
  advancedHintGenerations: number;
  limits: {
    deck: number;
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
  incrementUsage: (kind: 'deck' | 'basicHints' | 'advancedHints') => Promise<void>;
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
  const [rcInitialized, setRcInitialized] = useState(false);
  const [offerings, setOfferings] = useState<any | null>(null);
  const [monthlyPackage, setMonthlyPackage] = useState<any | null>(null);

  /**
   * Check premium status from Firebase custom claims and optionally RC entitlements
   */
  const checkPremiumStatus = useCallback(async () => {
    try {
      if (!user) {
        setIsPremiumEffective(false);
        setUsage(null);
        return;
      }

      // Get ID token result to access custom claims
      const currentUser = auth().currentUser;
      if (!currentUser) {
        setIsPremiumEffective(false);
        return;
      }

      const tokenResult = await currentUser.getIdTokenResult();
      const isPremiumFromClaim = tokenResult.claims.premium === true;
      
      // Optional: Check RC entitlement for immediate unlock if enabled
      const enableFallback = Constants.expoConfig?.extra?.enableRcEntitlementFallback === true;
      let isPremiumFromRC = false;
      
      if (enableFallback && rcInitialized) {
        try {
          const customerInfo = await Purchases.getCustomerInfo();
          
          // Check for 'Pro' entitlement (case-sensitive!)
          isPremiumFromRC = customerInfo.entitlements.active['Pro'] !== undefined;
          logger.debug(`[Premium] RC entitlement 'Pro' active: ${isPremiumFromRC}`);
        } catch (rcErr) {
          logger.warn('[Premium] Could not check RC entitlement:', rcErr);
        }
      }
      
      const isPremium = isPremiumFromClaim || (enableFallback && isPremiumFromRC);
      
      logger.debug('[Premium] Status check complete', {
        claim: isPremiumFromClaim,
        rc: isPremiumFromRC,
        fallbackEnabled: enableFallback,
        effective: isPremium
      });
      setIsPremiumEffective(isPremium);
    } catch (err) {
      logger.error('[Premium] Error checking premium status:', err);
      setError(err instanceof Error ? err.message : 'Failed to check premium status');
    }
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
        // Initialize new month
        data = {
          monthKey,
          deckGenerations: 0,
          basicHintGenerations: 0,
          advancedHintGenerations: 0,
          limits: {
            deck: 3,
            basicHints: 3,
            advancedHints: 1,
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
      const limits = isPremiumEffective ? { deck: 999999, basicHints: 999999, advancedHints: 999999 } : { deck: 3, basicHints: 3, advancedHints: 1 };
      setUsage({
        monthKey: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
        deckGenerations: 0,
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
      const newLimits = isPremiumEffective ? { deck: 999999, basicHints: 999999, advancedHints: 999999 } : { deck: 3, basicHints: 3, advancedHints: 1 };
      setUsage({ ...usage, limits: newLimits });
    }
  }, [isPremiumEffective]);

  /**
   * Increment usage count for a specific feature
   */
  const incrementUsage = useCallback(async (kind: 'deck' | 'basicHints' | 'advancedHints') => {
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
        
        // Migrate old data that doesn't have new hint fields
        if (data.basicHintGenerations === undefined) {
          data.basicHintGenerations = 0;
        }
        if (data.advancedHintGenerations === undefined) {
          data.advancedHintGenerations = 0;
        }
        // Ensure limits object has hint fields
        if (!data.limits.basicHints) {
          data.limits.basicHints = 3;
        }
        if (!data.limits.advancedHints) {
          data.limits.advancedHints = 1;
        }
      } else {
        logger.info(`[Premium] No existing usage data, creating new`);
        const limits = isPremiumEffective ? { deck: 999999, basicHints: 999999, advancedHints: 999999 } : { deck: 3, basicHints: 3, advancedHints: 1 };
        data = {
          monthKey,
          deckGenerations: 0,
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
      } else if (kind === 'basicHints') {
        data.basicHintGenerations += 1;
      } else {
        data.advancedHintGenerations += 1;
      }
      
      logger.info(`[Premium] Incremented ${kind} usage. New counts:`, {
        deck: data.deckGenerations,
        basic: data.basicHintGenerations,
        advanced: data.advancedHintGenerations,
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
   * Initialize RevenueCat SDK on mount
   */
  useEffect(() => {
    const initializeRC = async () => {
      try {
        // Only initialize on iOS
        if (Platform.OS !== 'ios') {
          logger.info('[Premium] RevenueCat only available on iOS, skipping initialization');
          return;
        }

        const rcPublicKey = Constants.expoConfig?.extra?.rcPublicKey;
        const enableIAP = Constants.expoConfig?.extra?.enableIAP !== false;
        
        if (!enableIAP) {
          logger.info('[Premium] IAP disabled via feature flag');
          return;
        }
        
        if (!rcPublicKey) {
          logger.warn('[Premium] RC public key not found in config');
          return;
        }

        // Check if Purchases module is available
        if (!Purchases || typeof Purchases.configure !== 'function') {
          logger.error('[Premium] Purchases module not available - native module may not be linked');
          return;
        }

        const enableFallback = Constants.expoConfig?.extra?.enableRcEntitlementFallback === true;
        
        logger.info('[Premium] Initializing RevenueCat SDK', {
          environment: Constants.expoConfig?.extra?.environment,
          enableEntitlementFallback: enableFallback,
        });
        
        Purchases.configure({ apiKey: rcPublicKey });
        
        // Add customer info listener for entitlement changes
        Purchases.addCustomerInfoUpdateListener((info: any) => {
          logger.debug('[Premium] Customer info updated', {
            hasProEntitlement: info.entitlements.active['Pro'] !== undefined,
          });
          // Re-check premium status when entitlements change
          checkPremiumStatus();
        });
        
        setRcInitialized(true);
        logger.info('[Premium] RevenueCat initialized successfully');
      } catch (err) {
        logger.error('[Premium] Failed to initialize RevenueCat:', err);
        logger.error('[Premium] This is expected if running on Android or if native module failed to link');
      }
    };

    // Small delay to ensure native modules are ready
    const timer = setTimeout(initializeRC, 100);
    return () => clearTimeout(timer);
  }, []);

  /**
   * Handle auth state changes - map Firebase UID to RC app_user_id
   */
  useEffect(() => {
    const syncRCUser = async () => {
      if (!rcInitialized) return;
      
      try {
        if (user?.uid) {
          logger.info('[Premium] Logging in to RevenueCat', { uid: user.uid });
          const loginResult = await Purchases.logIn(user.uid);
          
          // Wait for customer info to sync
          logger.debug('[Premium] Customer info after login:', {
            hasProEntitlement: loginResult.customerInfo.entitlements.active['Pro'] !== undefined,
          });
          
          // Fetch offerings after login
          try {
            const newOfferings = await Purchases.getOfferings();
            setOfferings(newOfferings);
            
            // Select monthly package
            const currentOffering = newOfferings.current || newOfferings.all['default'];
            if (currentOffering) {
              const monthly = currentOffering.availablePackages.find(
                (pkg: any) => pkg.packageType === 'MONTHLY'
              );
              setMonthlyPackage(monthly || null);
              if (monthly) {
                logger.debug('[Premium] Monthly package found', {
                  identifier: monthly.identifier,
                });
              }
            } else {
              logger.warn('[Premium] No offerings available - products may not be configured in App Store Connect yet');
            }
          } catch (offeringsErr) {
            logger.warn('[Premium] Could not fetch offerings:', offeringsErr);
            // Continue without offerings - user can still use the app
          }
          
          // Small delay to ensure backend has processed the login
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Force Firebase token refresh to get updated custom claims
          const currentUser = auth().currentUser;
          if (currentUser) {
            logger.info('[Premium] Refreshing Firebase token to get updated claims');
            await currentUser.getIdToken(true);
          }
          
          // Automatically check premium status after login to restore purchases
          logger.info('[Premium] Auto-restoring purchases after login');
          await checkPremiumStatus();
        } else {
          logger.info('[Premium] Logging out from RevenueCat');
          await Purchases.logOut();
          setOfferings(null);
          setMonthlyPackage(null);
        }
      } catch (err) {
        logger.error('[Premium] Error syncing RC user:', err);
      }
    };

    syncRCUser();
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
   * Handle subscription purchase
   */
  const subscribe = useCallback(async () => {
    try {
      if (!monthlyPackage) {
        throw new Error('Monthly package not available. Please try again later.');
      }

      logger.info('[Premium] Starting purchase flow');
      
      // Execute purchase
      const { customerInfo } = await Purchases.purchasePackage(monthlyPackage);
      
      logger.info('[Premium] Purchase successful', {
        hasProEntitlement: customerInfo.entitlements.active['Pro'] !== undefined,
      });
      
      // Force token refresh to get updated custom claims
      await auth().currentUser?.getIdToken(true);
      
      // Refresh entitlements
      await refreshEntitlements();
      
      logger.info('[Premium] Purchase complete, entitlements refreshed');
    } catch (err: any) {
      // Check if user cancelled
      if (err?.userCancelled) {
        logger.info('[Premium] Purchase cancelled by user');
        throw new Error('cancelled');
      }
      
      logger.error('[Premium] Purchase error:', err);
      throw err;
    }
  }, [monthlyPackage, refreshEntitlements]);

  /**
   * Restore previous purchases
   */
  const restore = useCallback(async () => {
    try {
      logger.info('[Premium] Starting restore');
      
      const customerInfo = await Purchases.restorePurchases();
      
      logger.info('[Premium] Restore successful', {
        hasProEntitlement: customerInfo.entitlements.active['Pro'] !== undefined,
      });
      
      // Force token refresh to get updated custom claims
      await auth().currentUser?.getIdToken(true);
      
      // Refresh entitlements
      await refreshEntitlements();
      
      logger.info('[Premium] Restore complete, entitlements refreshed');
    } catch (err) {
      logger.error('[Premium] Restore error:', err);
      throw err;
    }
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
