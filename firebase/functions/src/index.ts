import { initializeApp } from 'firebase-admin/app';
import { onRequest } from 'firebase-functions/v2/https';
import { healthCheck } from './handlers/health';
import { getCurrentUser } from './handlers/user';
import { backupHandler } from './handlers/backup';
import { aiHandler } from './handlers/ai';
import { generateHints } from './handlers/aiHints';
import { parseHandler } from './handlers/parse';
import { getUsage } from './handlers/usage';
import { revenueCatWebhook } from './handlers/revenuecat';
import { authenticate } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';
import { withQuota } from './middleware/quota';
import express from 'express';
import cors from 'cors';
import { logger } from './utils/logger';

// Initialize Firebase Admin
initializeApp();

// Create Express app
const app = express();
logger.info('[Setup] Express app created');

// Middleware
app.use(cors({ origin: true })); // Allow all origins in dev, configure for production
app.use(express.json({ limit: '10mb' })); // Increase payload limit for backups

// Debug middleware - log all requests
app.use((req, res, next) => {
  logger.debug(`[Express] ${req.method} ${req.path}`);
  logger.debug(`[Express] Headers:`, req.headers);
  logger.debug(`[Express] Body:`, req.body ? JSON.stringify(req.body).substring(0, 200) : 'empty');
  next();
});

// Public routes
app.get('/health', healthCheck);

// Protected routes (require authentication)
app.get('/user/me', authenticate, getCurrentUser);

// Backup routes
app.post('/backup/url', authenticate, backupHandler.getSignedUrl);
app.get('/backup/metadata', authenticate, backupHandler.getMetadata);
app.delete('/backup', authenticate, backupHandler.deleteBackup);

// AI routes with quota enforcement
logger.info('[Setup] Registering AI routes...');
app.post('/ai/deck/generate', authenticate, withQuota({ kind: 'deck', freeLimit: 3 }), aiHandler.generateDeck);
logger.info('[Setup] Registered /ai/deck/generate');
app.post('/ai/hints/generate', authenticate, withQuota({ kind: 'hints', freeLimit: 1 }), generateHints);
logger.info('[Setup] Registered /ai/hints/generate');
app.get('/ai/models', authenticate, aiHandler.getModels);
logger.info('[Setup] AI routes registered');

// Usage and IAP routes
app.get('/usage', authenticate, getUsage);
app.post('/iap/revenuecat/webhook', revenueCatWebhook);

// Parse routes
app.post('/parse/file', authenticate, parseHandler.parseFile);

// Debug: List all registered routes
logger.debug('[Setup] All registered routes:');
app._router.stack.forEach((middleware: any) => {
  if (middleware.route) {
    logger.debug(`  ${Object.keys(middleware.route.methods).join(',').toUpperCase()} ${middleware.route.path}`);
  }
});

// Error handler (must be last)
app.use(errorHandler);

// Export as Cloud Function
export const api = onRequest(
  {
    timeoutSeconds: 600, // 10 minutes for AI generation
    memory: '512MiB',
    region: 'us-central1',
  },
  app
);
