import { Request, Response } from 'express';
import { getAuth } from 'firebase-admin/auth';
import crypto from 'crypto';
import { logger } from '../utils/logger';

/**
 * Verify RevenueCat webhook signature
 */
function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const expectedSignature = hmac.digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * POST /iap/revenuecat/webhook
 * Handle RevenueCat webhook events to update user premium status
 */
export const revenueCatWebhook = async (req: Request, res: Response) => {
  try {
    // Verify webhook signature
    const signature = req.headers['x-revenuecat-signature'] as string;
    const webhookSecret = process.env.REVENUECAT_WEBHOOK_SECRET;

    if (!webhookSecret) {
      logger.error('[RevenueCat] REVENUECAT_WEBHOOK_SECRET not configured');
      return res.status(500).json({
        success: false,
        error: {
          code: 'CONFIGURATION_ERROR',
          message: 'Webhook secret not configured',
        },
      });
    }

    const rawBody = JSON.stringify(req.body);
    if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
      logger.warn('[RevenueCat] Invalid webhook signature');
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_SIGNATURE',
          message: 'Invalid webhook signature',
        },
      });
    }

    const event = req.body;
    logger.info(`[RevenueCat] Received event: ${event.type} for user ${event.app_user_id}`);

    // Extract user ID and entitlement status
    const userId = event.app_user_id;
    const eventType = event.type;

    // Determine premium status based on event type
    let isPremium = false;
    
    // Events that grant premium access
    const premiumGrantingEvents = [
      'INITIAL_PURCHASE',
      'RENEWAL',
      'NON_RENEWING_PURCHASE',
      'UNCANCELLATION',
      'SUBSCRIPTION_EXTENDED',
    ];

    // Events that revoke premium access
    const premiumRevokingEvents = [
      'CANCELLATION',
      'EXPIRATION',
      'BILLING_ISSUE',
    ];

    if (premiumGrantingEvents.includes(eventType)) {
      isPremium = true;
    } else if (premiumRevokingEvents.includes(eventType)) {
      isPremium = false;
    } else {
      // For trial or grace period, check entitlements
      const entitlements = event.subscriber_attributes?.entitlements || {};
      isPremium = Object.keys(entitlements).length > 0;
    }

    // Update Firebase custom claims
    try {
      await getAuth().setCustomUserClaims(userId, { premium: isPremium });
      logger.info(`[RevenueCat] Updated premium status for user ${userId}: ${isPremium}`);
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
    logger.error('[RevenueCat] Webhook error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'WEBHOOK_ERROR',
        message: error instanceof Error ? error.message : 'Webhook processing failed',
      },
    });
  }
};
