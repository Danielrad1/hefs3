import React, { useState, useEffect } from 'react';
import { Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CloudBackupService, BackupMetadata } from '../../../services/cloud';
import { useScheduler } from '../../../context/SchedulerProvider';
import Constants from 'expo-constants';

interface SettingItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  showChevron?: boolean;
  iconColor?: string;
  iconBg?: string;
}

export function BackupSection({ SettingItem }: { SettingItem: React.ComponentType<SettingItemProps> }) {
  const { reload } = useScheduler();
  const [loading, setLoading] = useState(false);
  const [metadata, setMetadata] = useState<BackupMetadata | null>(null);
  const [checkingMetadata, setCheckingMetadata] = useState(true);

  const cloudBackupEnabled = Constants.expoConfig?.extra?.enableCloudBackup === true;

  // Load backup metadata on mount
  useEffect(() => {
    if (cloudBackupEnabled) {
      loadMetadata();
    } else {
      setCheckingMetadata(false);
    }
  }, [cloudBackupEnabled]);

  const loadMetadata = async () => {
    try {
      setCheckingMetadata(true);
      const data = await CloudBackupService.getBackupMetadata();
      setMetadata(data);
    } catch (error) {
      console.error('Failed to load backup metadata:', error);
    } finally {
      setCheckingMetadata(false);
    }
  };

  const handleUploadBackup = async () => {
    try {
      setLoading(true);
      
      await CloudBackupService.uploadBackup();
      
      Alert.alert('Success', 'Database backup uploaded successfully!');
      
      // Refresh metadata
      await loadMetadata();
    } catch (error: any) {
      console.error('Backup upload failed:', error);
      Alert.alert('Backup Failed', error.message || 'Failed to upload backup');
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreBackup = async () => {
    Alert.alert(
      'Restore from Cloud',
      'This will replace your local database with the cloud backup. Your current data will be backed up locally first.\n\nContinue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              
              await CloudBackupService.downloadBackup();
              
              // Reload the app with restored data
              reload();
              
              Alert.alert('Success', 'Database restored successfully!');
            } catch (error: any) {
              console.error('Backup restore failed:', error);
              Alert.alert('Restore Failed', error.message || 'Failed to restore backup');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleBackupUnavailable = () => {
    Alert.alert(
      'Cloud Backup Disabled',
      'Cloud backup is currently disabled in development mode.\n\nTo enable, set ENABLE_CLOUD_BACKUP=true in .env.development',
      [{ text: 'OK' }]
    );
  };

  if (!cloudBackupEnabled) {
    return (
      <SettingItem
        icon="cloud-offline"
        title="Cloud Backup"
        subtitle="Disabled in development"
        onPress={handleBackupUnavailable}
        iconColor="#FFFFFF"
        iconBg="#95A5A6"
      />
    );
  }

  const formatTimestamp = (timestamp?: number) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const subtitle = checkingMetadata
    ? 'Checking...'
    : metadata?.exists
    ? `Last backup: ${formatTimestamp(metadata.timestamp)}`
    : 'No backup found';

  return (
    <>
      <SettingItem
        icon="cloud-upload"
        title="Backup to Cloud"
        subtitle={subtitle}
        onPress={handleUploadBackup}
        iconColor="#FFFFFF"
        iconBg="#3498DB"
        rightElement={loading ? <ActivityIndicator /> : undefined}
        showChevron={!loading}
      />
      
      {metadata?.exists && (
        <SettingItem
          icon="cloud-download"
          title="Restore from Cloud"
          subtitle="Replace local data with cloud backup"
          onPress={handleRestoreBackup}
          iconColor="#FFFFFF"
          iconBg="#27AE60"
          rightElement={loading ? <ActivityIndicator /> : undefined}
          showChevron={!loading}
        />
      )}
    </>
  );
}
