import { initializeApp } from 'firebase-admin/app';
import { onRequest } from 'firebase-functions/v2/https';
import { healthCheck } from './handlers/health';
import { getCurrentUser } from './handlers/user';
import { backupHandler } from './handlers/backup';
import { aiHandler } from './handlers/ai';
import { generateHints } from './handlers/aiHints';
import { parseHandler } from './handlers/parse';
import { authenticate } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';
import express from 'express';
import cors from 'cors';

// Initialize Firebase Admin
initializeApp();

// Create Express app
const app = express();
console.log('[Setup] Express app created');

// Middleware
app.use(cors({ origin: true })); // Allow all origins in dev, configure for production
app.use(express.json({ limit: '10mb' })); // Increase payload limit for backups

// Debug middleware - log all requests
app.use((req, res, next) => {
  console.log(`[Express] ${req.method} ${req.path}`);
  console.log(`[Express] Headers:`, req.headers);
  console.log(`[Express] Body:`, req.body ? JSON.stringify(req.body).substring(0, 200) : 'empty');
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

// AI routes
console.log('[Setup] Registering AI routes...');
app.post('/ai/deck/generate', authenticate, aiHandler.generateDeck);
console.log('[Setup] Registered /ai/deck/generate');
app.post('/ai/hints/generate', authenticate, generateHints);
console.log('[Setup] Registered /ai/hints/generate');
app.get('/ai/models', authenticate, aiHandler.getModels);
console.log('[Setup] AI routes registered');

// Parse routes
app.post('/parse/file', authenticate, parseHandler.parseFile);

// Debug: List all registered routes
console.log('[Setup] All registered routes:');
app._router.stack.forEach((middleware: any) => {
  if (middleware.route) {
    console.log(`  ${Object.keys(middleware.route.methods).join(',').toUpperCase()} ${middleware.route.path}`);
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
