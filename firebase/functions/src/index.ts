import { initializeApp } from 'firebase-admin/app';
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { healthCheck } from './handlers/health';
import { getCurrentUser } from './handlers/user';
import { aiHandler } from './handlers/ai';
import { generateHints } from './handlers/aiHints';
import { parseHandler } from './handlers/parse';
import { getUsage } from './handlers/usage';
// import { revenueCatWebhook } from './handlers/revenuecat'; // Free version: removed
import { authenticate } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';
import express from 'express';
import cors from 'cors';
import { logger } from './utils/logger';

// Define secrets
const openaiApiKey = defineSecret('OPENAI_API_KEY');
const revenuecatWebhookToken = defineSecret('REVENUECAT_WEBHOOK_TOKEN');

// Initialize Firebase Admin
initializeApp();

// Create Express app
const app = express();
logger.info('[Setup] Express app created');

// Middleware - CORS configuration
const allowedOrigins = [
  'http://localhost:8081',
  'http://localhost:19006',
  /^https:\/\/.*\.expo\.dev$/,  // Expo development/preview
  /^exp:\/\/.*$/,                // Expo Go
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }
    
    // Check if origin matches allowed list
    const isAllowed = allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') {
        return origin === allowed;
      }
      return allowed.test(origin);
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      logger.warn('[CORS] Rejected origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// IMPORTANT: Register route-specific parsers BEFORE global parser
// Parse route needs 25MB for large file uploads (Base64 encoding inflates ~33%)
app.post('/parse/file', 
  express.json({ limit: '25mb' }), 
  authenticate, 
  parseHandler.parseFile
);

// Global JSON parser for all other routes (10MB)
app.use(express.json({ limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  // Use debug level in production to avoid flooding logs
  const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';
  
  if (isEmulator) {
    logger.warn(`[Express] ${req.method} ${req.path}`);
  } else {
    logger.debug(`[Express] ${req.method} ${req.path}`);
  }
  logger.debug(`[Express] From: ${req.get('origin') || req.ip}`);
  logger.debug(`[Express] Headers:`, req.headers);
  logger.debug(`[Express] Body:`, req.body ? JSON.stringify(req.body).substring(0, 200) : 'empty');
  next();
});

// Public routes
app.get('/health', healthCheck);

// Protected routes (require authentication)
app.get('/user/me', authenticate, getCurrentUser);

// AI routes (quota enforced on client side)
logger.info('[Setup] Registering AI routes...');

app.post('/ai/deck/generate', authenticate, aiHandler.generateDeck);
logger.info('[Setup] Registered /ai/deck/generate');

app.post('/ai/hints/generate', authenticate, generateHints);
logger.info('[Setup] Registered /ai/hints/generate');

app.get('/ai/models', authenticate, aiHandler.getModels);
logger.info('[Setup] AI routes registered');

// Usage routes
app.get('/usage', authenticate, getUsage);
// Free version: RevenueCat webhook removed
// app.post('/iap/revenuecat/webhook', revenueCatWebhook);

// Note: /parse/file route registered above (before global JSON parser) to support 25MB limit

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
    secrets: [openaiApiKey, revenuecatWebhookToken], // Make secrets available as process.env
  },
  app
);
