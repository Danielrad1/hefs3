import { initializeApp } from 'firebase-admin/app';
import { onRequest } from 'firebase-functions/v2/https';
import { healthCheck } from './handlers/health';
import { getCurrentUser } from './handlers/user';
import { backupHandler } from './handlers/backup';
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

// Error handler (must be last)
app.use(errorHandler);

// Export as Cloud Function
export const api = onRequest(
  {
    timeoutSeconds: 60,
    memory: '256MiB',
    region: 'us-central1',
  },
  app
);
