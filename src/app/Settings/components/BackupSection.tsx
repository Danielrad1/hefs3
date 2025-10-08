import React from 'react';
import { Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
  const handleBackupUnavailable = () => {
    Alert.alert(
      'Cloud Backup Unavailable',
      'Cloud backup is currently disabled due to Firebase compatibility issues.\n\nYour data is safely stored locally. Cloud backup will be re-enabled in a future update with an alternative solution.',
      [{ text: 'OK' }]
    );
  };

  return (
    <SettingItem
      icon="cloud-offline"
      title="Cloud Backup"
      subtitle="Currently unavailable - data stored locally"
      onPress={handleBackupUnavailable}
      iconColor="#FFFFFF"
      iconBg="#95A5A6"
    />
  );
}
