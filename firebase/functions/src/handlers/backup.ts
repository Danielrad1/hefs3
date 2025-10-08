import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { BackupUrlRequestSchema } from '../types';
import { StorageService } from '../services/storage/StorageService';
import { logger } from 'firebase-functions/v2';

const storageService = new StorageService();

export const backupHandler = {
  /**
   * Generate signed URL for backup upload/download
   */
  async getSignedUrl(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const { op, filename } = BackupUrlRequestSchema.parse(req.body);

      const operation = op === 'put' ? 'write' : 'read';
      const result = await storageService.generateSignedUrl(
        user.uid,
        operation,
        filename
      );

      logger.info('Generated signed URL', { uid: user.uid, op, filename });

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Signed URL generation failed', { 
        error: error.message,
        stack: error.stack,
        name: error.name 
      });
      res.status(500).json({
        success: false,
        error: {
          code: 'storage_error',
          message: error.message || 'Failed to generate signed URL',
        },
      });
    }
  },

  /**
   * Get backup metadata
   */
  async getMetadata(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const filename = (req.query.filename as string) || 'latest.db';
      
      const metadata = await storageService.getBackupMetadata(user.uid, filename);
      
      res.json({
        success: true,
        data: metadata,
      });
    } catch (error: any) {
      logger.error('Failed to get backup metadata', { error: error.message });
      res.status(500).json({
        success: false,
        error: {
          code: 'storage_error',
          message: 'Failed to get backup metadata',
        },
      });
    }
  },

  /**
   * Delete backup
   */
  async deleteBackup(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const filename = (req.query.filename as string) || 'latest.db';
      
      await storageService.deleteBackup(user.uid, filename);
      
      res.json({
        success: true,
        data: { deleted: true },
      });
    } catch (error: any) {
      logger.error('Failed to delete backup', { error: error.message });
      res.status(500).json({
        success: false,
        error: {
          code: 'storage_error',
          message: 'Failed to delete backup',
        },
      });
    }
  },
};
