import { getStorage } from 'firebase-admin/storage';
import { logger } from 'firebase-functions/v2';

export interface SignedUrlResponse {
  url: string;
  expiresAt: number;
}

export interface BackupMetadata {
  exists: boolean;
  timestamp?: number;
  size?: number;
  contentType?: string;
}

export class StorageService {
  private getBucket() {
    const storage = getStorage();
    // For emulator, use default bucket
    if (process.env.FUNCTIONS_EMULATOR) {
      return storage.bucket();
    }
    return storage.bucket();
  }

  /**
   * Generate a signed URL for uploading or downloading backup
   */
  async generateSignedUrl(
    uid: string,
    operation: 'read' | 'write',
    filename: string = 'latest.db'
  ): Promise<SignedUrlResponse> {
    const path = `backups/${uid}/${filename}`;
    const expires = Date.now() + 15 * 60 * 1000; // 15 minutes

    // In emulator, use direct URLs instead of signed URLs
    if (process.env.FUNCTIONS_EMULATOR) {
      // Get the host from the request or use environment variable
      // For emulator, we need to use the actual network IP, not localhost
      const storageHost = '10.0.0.90:9199'; // Match the Functions emulator host
      
      const projectId = process.env.GCLOUD_PROJECT || 'hefs-b3e45';
      const bucket = process.env.STORAGE_BUCKET || `${projectId}.appspot.com`;
      
      const baseUrl = `http://${storageHost}/v0/b/${bucket}/o`;
      const encodedPath = encodeURIComponent(path);
      const url = `${baseUrl}/${encodedPath}`;
      
      logger.info(`Generated emulator ${operation} URL`, { uid, path, url });
      
      return { url, expiresAt: expires };
    }

    // Production: use signed URLs
    const file = this.getBucket().file(path);
    const action = operation === 'write' ? 'write' : 'read';

    try {
      const [url] = await file.getSignedUrl({
        version: 'v4',
        action,
        expires,
        contentType: operation === 'write' ? 'application/json' : undefined,
      });

      logger.info(`Generated ${action} signed URL`, { uid, path });

      return { url, expiresAt: expires };
    } catch (error: any) {
      logger.error('Failed to generate signed URL', { error: error.message, uid, path });
      throw new Error('Failed to generate storage URL');
    }
  }

  /**
   * Get metadata about user's backup
   */
  async getBackupMetadata(uid: string, filename: string = 'latest.db'): Promise<BackupMetadata> {
    const path = `backups/${uid}/${filename}`;
    const file = this.getBucket().file(path);

    try {
      const [exists] = await file.exists();
      
      if (!exists) {
        return { exists: false };
      }

      const [metadata] = await file.getMetadata();
      
      return {
        exists: true,
        timestamp: metadata.updated ? new Date(metadata.updated).getTime() : undefined,
        size: metadata.size ? parseInt(String(metadata.size)) : undefined,
        contentType: metadata.contentType,
      };
    } catch (error: any) {
      logger.error('Failed to get backup metadata', { error: error.message, uid, path });
      return { exists: false };
    }
  }

  /**
   * Delete a backup file
   */
  async deleteBackup(uid: string, filename: string = 'latest.db'): Promise<void> {
    const path = `backups/${uid}/${filename}`;
    const file = this.getBucket().file(path);

    try {
      await file.delete();
      logger.info('Deleted backup', { uid, path });
    } catch (error: any) {
      logger.error('Failed to delete backup', { error: error.message, uid, path });
      throw new Error('Failed to delete backup');
    }
  }
}
