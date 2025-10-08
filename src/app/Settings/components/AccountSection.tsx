import React from 'react';
import { Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import { useNavigation } from '@react-navigation/native';

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
  const { user, signOut } = useAuth();

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
              Alert.alert('Signed Out', 'You have been signed out successfully.');
            } catch (error) {
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          },
        },
      ]
    );
  };

  if (!user || user.isAnonymous) {
    return null; // User must sign in from the auth screen
  }

  return (
    <>
      <SettingItem
        icon="person-circle"
        title={user.email || 'Account'}
        subtitle={user.emailVerified ? 'Verified' : 'Not verified'}
        showChevron={false}
        iconColor="#FFFFFF"
        iconBg="#6C5CE7"
      />
      
      <SettingItem
        icon="log-out"
        title="Sign Out"
        subtitle="Sign out of your account"
        onPress={handleSignOut}
        iconColor="#FFFFFF"
        iconBg="#D63031"
      />
    </>
  );
}
