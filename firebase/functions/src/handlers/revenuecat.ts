import { Request, Response } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from '../utils/logger';

/**
 * POST /iap/revenuecat/webhook
 * Handle RevenueCat webhook events to update user premium status
 */
export const revenueCatWebhook = async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    // Verify Bearer token authentication
    const authHeader = req.headers.authorization;
    const webhookToken = process.env.REVENUECAT_WEBHOOK_TOKEN;

    if (!webhookToken) {
      logger.error('[RevenueCat] REVENUECAT_WEBHOOK_TOKEN not configured');
      return res.status(500).json({
        success: false,
        error: {
          code: 'CONFIGURATION_ERROR',
          message: 'Webhook token not configured',
        },
      });
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('[RevenueCat] Missing or invalid Authorization header');
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing or invalid Authorization header',
        },
      });
    }

    const providedToken = authHeader.substring(7); // Remove 'Bearer ' prefix
    if (providedToken !== webhookToken) {
      logger.warn('[RevenueCat] Invalid webhook token');
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid webhook token',
        },
      });
    }

    const event = req.body;
    const eventId = event.id;
    const userId = event.app_user_id;
    const eventType = event.type;

    if (!eventId || !userId || !eventType) {
      logger.warn('[RevenueCat] Missing required event fields');
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_EVENT',
          message: 'Missing required event fields',
        },
      });
    }

    logger.info(`[RevenueCat] Received event`, {
      eventId,
      eventType,
      userId,
    });

    // Idempotency check - ensure we don't process the same event twice
    const db = getFirestore();
    const eventRef = db.collection('rc_events').doc(eventId);
    
    try {
      const eventDoc = await eventRef.get();
      if (eventDoc.exists) {
        logger.info(`[RevenueCat] Event ${eventId} already processed, skipping`);
        return res.json({
          success: true,
          data: {
            userId,
            alreadyProcessed: true,
          },
        });
      }
    } catch (firestoreErr) {
      // If Firestore check fails, log but continue (don't block webhook processing)
      logger.warn('[RevenueCat] Firestore idempotency check failed:', firestoreErr);
    }

    // Determine premium status based on event type
    let isPremium: boolean | null = null;
    let premiumBefore: boolean | null = null;
    
    // Get current premium status
    try {
      const user = await getAuth().getUser(userId);
      premiumBefore = user.customClaims?.premium === true;
    } catch (err) {
      logger.warn(`[RevenueCat] Could not get user ${userId} current claims:`, err);
    }
    
    // Events that grant premium access
    const premiumGrantingEvents = [
      'INITIAL_PURCHASE',
      'RENEWAL',
      'NON_RENEWING_PURCHASE',
      'UNCANCELLATION',
      'SUBSCRIPTION_EXTENDED',
    ];

    // Events that revoke premium access (only when entitlement actually ends)
    const premiumRevokingEvents = [
      'EXPIRATION',
    ];

    if (premiumGrantingEvents.includes(eventType)) {
      isPremium = true;
    } else if (premiumRevokingEvents.includes(eventType)) {
      isPremium = false;
    } else if (eventType === 'CANCELLATION') {
      // CANCELLATION doesn't immediately revoke - wait for EXPIRATION
      logger.info(`[RevenueCat] Cancellation event received, keeping premium until expiration`);
      isPremium = premiumBefore;
    } else if (eventType === 'BILLING_ISSUE') {
      // Check if in grace period
      const entitlements = event.entitlements || {};
      const hasActiveEntitlement = Object.keys(entitlements).some(
        key => entitlements[key]?.expires_date && new Date(entitlements[key].expires_date) > new Date()
      );
      isPremium = hasActiveEntitlement;
    } else {
      // For unknown events, check entitlements in payload
      const entitlements = event.entitlements || {};
      isPremium = Object.keys(entitlements).some(
        key => entitlements[key]?.expires_date && new Date(entitlements[key].expires_date) > new Date()
      );
    }

    // Update Firebase custom claims
    try {
      await getAuth().setCustomUserClaims(userId, { premium: isPremium });
      
      // Store event in Firestore for idempotency (with TTL)
      try {
        await eventRef.set({
          eventId,
          eventType,
          userId,
          premiumBefore,
          premiumAfter: isPremium,
          processedAt: new Date(),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days TTL
        });
      } catch (firestoreErr) {
        // Don't fail the webhook if Firestore write fails
        logger.warn('[RevenueCat] Failed to store event for idempotency:', firestoreErr);
      }

      const duration = Date.now() - startTime;
      logger.info(`[RevenueCat] Updated premium status`, {
        userId,
        eventType,
        premiumBefore,
        premiumAfter: isPremium,
        duration,
      });
    } catch (error) {
      logger.error(`[RevenueCat] Failed to update claims for user ${userId}:`, error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'CLAIMS_UPDATE_FAILED',
          message: 'Failed to update user claims',
        },
      });
    }

    return res.json({
      success: true,
      data: {
        userId,
        premium: isPremium,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('[RevenueCat] Webhook error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      duration,
    });
    return res.status(500).json({
      success: false,
      error: {
        code: 'WEBHOOK_ERROR',
        message: error instanceof Error ? error.message : 'Webhook processing failed',
      },
    });
  }
};
