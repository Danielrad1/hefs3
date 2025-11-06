import { Request, Response, NextFunction } from 'express';
import { getFirestore } from 'firebase-admin/firestore';
import { AuthenticatedRequest } from './auth';
import { errorCodes } from '../config/constants';
import { logger } from '../utils/logger';

export interface QuotaConfig {
  kind: 'deck' | 'hints';
  freeLimit: number;
}

export interface UsageData {
  monthKey: string;
  deckGenerations: number;
  hintGenerations: number;
}

/**
 * Get the current month key in YYYY-MM format (UTC)
 */
function getMonthKey(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Middleware to enforce quota limits for free users
 * Premium users bypass all quota checks
 */
export function withQuota(config: QuotaConfig) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Free version: no quotas, everyone is unlimited
    next();
    return;
    
    const user = (req as AuthenticatedRequest).user;

    // Check if user exists
    if (!user || !user.uid) {
      logger.error('[Quota] User not authenticated');
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication required',
        },
      });
      return;
    }

    logger.info(`[Quota] Checking ${config.kind} quota for user ${user.uid} (premium: ${user.premium})`);

    // Premium users bypass quota
    if (user.premium) {
      logger.info(`[Quota] Premium user ${user.uid} bypasses quota for ${config.kind}`);
      next();
      return;
    }

    try {
      const db = getFirestore();
      const monthKey = getMonthKey();
      const usageRef = db.collection('usage').doc(user.uid).collection('months').doc(monthKey);

      // Run in transaction to ensure atomic read-increment
      await db.runTransaction(async (transaction) => {
        const usageDoc = await transaction.get(usageRef);
        const currentUsage = usageDoc.data() as UsageData | undefined;

        // Determine current count for this quota kind
        const currentCount = config.kind === 'deck' 
          ? (currentUsage?.deckGenerations || 0)
          : (currentUsage?.hintGenerations || 0);

        logger.debug(`[Quota] User ${user.uid} has used ${currentCount}/${config.freeLimit} ${config.kind} generations this month`);

        // Check if over limit
        if (currentCount >= config.freeLimit) {
          logger.warn(`[Quota] User ${user.uid} exceeded ${config.kind} quota: ${currentCount}/${config.freeLimit}`);
          throw new Error('QUOTA_EXCEEDED');
        }

        // Increment counter
        const update = {
          monthKey,
          [config.kind === 'deck' ? 'deckGenerations' : 'hintGenerations']: currentCount + 1,
        };

        transaction.set(usageRef, update, { merge: true });
      });

      next();
    } catch (error: unknown) {
      const err = error as Error;
      if (err instanceof Error && err.message === 'QUOTA_EXCEEDED') {
        res.status(403).json({
          success: false,
          error: {
            code: 'QUOTA_EXCEEDED',
            message: `Free tier limit reached. You've used all ${config.freeLimit} ${config.kind} generations this month.`,
          },
        });
        return;
      }

      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      logger.error(`[Quota] Error checking quota: ${errorMessage}`);
      res.status(500).json({
        success: false,
        error: {
          code: errorCodes.INTERNAL_ERROR,
          message: 'Failed to check quota',
        },
      });
    }
  };
}

/**
 * Get current usage data for a user
 */
export async function getUserUsage(uid: string): Promise<UsageData & { limits: { deck: number; hints: number } }> {
  const db = getFirestore();
  const monthKey = getMonthKey();
  const usageRef = db.collection('usage').doc(uid).collection('months').doc(monthKey);

  const usageDoc = await usageRef.get();
  const data = usageDoc.data() as UsageData | undefined;

  return {
    monthKey,
    deckGenerations: data?.deckGenerations || 0,
    hintGenerations: data?.hintGenerations || 0,
    limits: {
      deck: 3,
      hints: 1,
    },
  };
}
