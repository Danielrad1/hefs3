import { initializeApp } from 'firebase-admin/app';
import { onRequest } from 'firebase-functions/v2/https';
import { healthCheck } from './handlers/health';
import { getCurrentUser } from './handlers/user';
import { backupHandler } from './handlers/backup';
import { aiHandler } from './handlers/ai';
import { parseHandler } from './handlers/parse';
import { authenticate } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';
import express from 'express';
import cors from 'cors';

// Initialize Firebase Admin
initializeApp();

// Create Express app
const app = express();

// Middleware
app.use(cors({ origin: true })); // Allow all origins in dev, configure for production
app.use(express.json({ limit: '10mb' })); // Increase payload limit for backups

// Public routes
app.get('/health', healthCheck);

// Protected routes (require authentication)
app.get('/user/me', authenticate, getCurrentUser);

// Backup routes
app.post('/backup/url', authenticate, backupHandler.getSignedUrl);
app.get('/backup/metadata', authenticate, backupHandler.getMetadata);
app.delete('/backup', authenticate, backupHandler.deleteBackup);

// AI routes
app.post('/ai/deck/generate', authenticate, aiHandler.generateDeck);
app.get('/ai/models', authenticate, aiHandler.getModels);

// Parse routes
app.post('/parse/file', authenticate, parseHandler.parseFile);

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
