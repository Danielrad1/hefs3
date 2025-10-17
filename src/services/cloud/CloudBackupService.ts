import * as FileSystem from 'expo-file-system/legacy';
import { ApiService } from './ApiService';
import { PersistenceService } from '../anki/PersistenceService';
import { db } from '../anki/InMemoryDb';
import { logger } from '../../utils/logger';

interface SignedUrlResponse {
  url: string;
  expiresAt: number;
}

export interface BackupMetadata {
  exists: boolean;
  timestamp?: number;
  size?: number;
  contentType?: string;
}

/**
 * Service for backing up and restoring database to/from cloud storage
 */
export class CloudBackupService {
  /**
   * Upload current database to cloud storage
   */
  static async uploadBackup(): Promise<void> {
    try {
      logger.info('[CloudBackup] Starting backup upload...');

      // 1. Save current database to ensure it's up to date
      await PersistenceService.save(db);
      
      // 2. Read the database file
      const dbPath = PersistenceService.getDbPath();
      const dbContent = await FileSystem.readAsStringAsync(dbPath);
      
      if (!dbContent) {
        throw new Error('Database file is empty');
      }

      logger.info('[CloudBackup] Database size:', dbContent.length, 'bytes');

      // 3. Get signed URL for upload
      const { url, expiresAt } = await ApiService.post<SignedUrlResponse>('/backup/url', {
        op: 'put',
        filename: 'latest.db',
      });

      logger.info('[CloudBackup] Got signed URL, expires at:', new Date(expiresAt).toISOString());

      // 4. Upload to signed URL
      const uploadResponse = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: dbContent,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
      }

      logger.info('[CloudBackup] Upload successful!');
    } catch (error) {
      logger.error('[CloudBackup] Upload failed:', error);
      throw error;
    }
  }

  /**
   * Download backup from cloud and restore
   */
  static async downloadBackup(): Promise<void> {
    try {
      logger.info('[CloudBackup] Starting backup download...');

      // 1. Get signed URL for download
      const { url } = await ApiService.post<SignedUrlResponse>('/backup/url', {
        op: 'get',
        filename: 'latest.db',
      });

      logger.info('[CloudBackup] Got signed URL for download');

      // 2. Download from signed URL
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Download failed: ${response.status} ${response.statusText}`);
      }

      const dbContent = await response.text();
      
      if (!dbContent) {
        throw new Error('Downloaded backup is empty');
      }

      logger.info('[CloudBackup] Downloaded backup, size:', dbContent.length, 'bytes');

      // 3. Create backup of current database
      const dbPath = PersistenceService.getDbPath();
      const backupPath = `${dbPath}.backup`;
      
      try {
        await FileSystem.copyAsync({
          from: dbPath,
          to: backupPath,
        });
        logger.info('[CloudBackup] Created local backup');
      } catch (e) {
        logger.warn('[CloudBackup] Could not create local backup:', e);
      }

      // 4. Write downloaded content to database file
      await FileSystem.writeAsStringAsync(dbPath, dbContent);

      logger.info('[CloudBackup] Restore successful!');
    } catch (error) {
      logger.error('[CloudBackup] Download failed:', error);
      throw error;
    }
  }

  /**
   * Check if cloud backup exists
   */
  static async hasCloudBackup(): Promise<boolean> {
    try {
      const metadata = await this.getBackupMetadata();
      return metadata.exists;
    } catch (error) {
      logger.error('[CloudBackup] Failed to check backup existence:', error);
      return false;
    }
  }

  /**
   * Get cloud backup metadata
   */
  static async getBackupMetadata(): Promise<BackupMetadata> {
    try {
      return await ApiService.get<BackupMetadata>('/backup/metadata');
    } catch (error) {
      logger.error('[CloudBackup] Failed to get metadata:', error);
      return { exists: false };
    }
  }

  /**
   * Delete cloud backup
   */
  static async deleteBackup(): Promise<void> {
    try {
      await fetch(`${ApiService.getBaseUrl()}/backup`, {
        method: 'DELETE',
        headers: await this.getAuthHeaders(),
      });
      logger.info('[CloudBackup] Backup deleted');
    } catch (error) {
      logger.error('[CloudBackup] Failed to delete backup:', error);
      throw error;
    }
  }

  private static async getAuthHeaders(): Promise<HeadersInit> {
    const { auth } = await import('../../config/firebase');
    // Let Firebase handle token refresh automatically (don't force with true)
    const token = await auth().currentUser?.getIdToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }
}
