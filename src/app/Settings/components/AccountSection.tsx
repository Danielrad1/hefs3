import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';

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

export function AccountSection({ SettingItem }: { SettingItem: React.ComponentType<SettingItemProps> }) {
  const { user } = useAuth();

  if (!user || user.isAnonymous) {
    return null;
  }

  return (
    <SettingItem
      icon="person-circle"
      title={user.email || 'Account'}
      subtitle={user.emailVerified ? 'Verified' : 'Not verified'}
      showChevron={false}
    />
  );
}
