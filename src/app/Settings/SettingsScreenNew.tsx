import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Switch, Linking, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme } from '../../design/theme';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';
import { db } from '../../services/anki/InMemoryDb';
import { PersistenceService } from '../../services/anki/PersistenceService';
import { useScheduler } from '../../context/SchedulerProvider';
import { AccountSection } from './components/AccountSection';
import { BackupSection } from './components/BackupSection';

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

function SettingItem({
  icon,
  title,
  subtitle,
  onPress,
  rightElement,
  showChevron = true,
  iconColor = '#FFFFFF',
  iconBg,
}: SettingItemProps) {
  const theme = useTheme();

  return (
    <Pressable
      style={[styles.settingItem, { backgroundColor: theme.colors.surface }]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={[styles.iconContainer, { backgroundColor: iconBg || theme.colors.accent }]}>
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>
      
      <View style={styles.settingContent}>
        <Text style={[styles.settingTitle, { color: theme.colors.textPrimary }]}>
          {title}
        </Text>
        {subtitle && (
          <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>
            {subtitle}
          </Text>
        )}
      </View>

      {rightElement || (showChevron && onPress && (
        <Ionicons name="chevron-forward" size={20} color={theme.colors.textTertiary} />
      ))}
    </Pressable>
  );
}

interface SectionHeaderProps {
  title: string;
}

function SectionHeader({ title }: SectionHeaderProps) {
  const theme = useTheme();
  
  return (
    <Text style={[styles.sectionHeader, { color: theme.colors.textSecondary }]}>
      {title}
    </Text>
  );
}

export default function SettingsScreen() {
  const theme = useTheme();
  const { reload } = useScheduler();
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(true);
  const [dailyReminder, setDailyReminder] = React.useState(true);
  const [showThemeModal, setShowThemeModal] = React.useState(false);

  const themeOptions = [
    { value: 'system', label: 'System', icon: 'phone-portrait' },
    { value: 'light', label: 'Light', icon: 'sunny' },
    { value: 'dark', label: 'Dark', icon: 'moon' },
  ] as const;

  const handleSubscription = () => {
    Alert.alert(
      'Memorize Pro',
      'Unlock unlimited decks, advanced statistics, and cloud sync!',
      [
        { text: 'Maybe Later', style: 'cancel' },
        { text: 'Subscribe', onPress: () => console.log('Subscribe pressed') },
      ]
    );
  };

  const handleRateUs = () => {
    Alert.alert('Rate Us', 'Thank you for your support! This would open the app store.');
  };

  const handleContactSupport = () => {
    Linking.openURL('mailto:support@memorizeapp.com?subject=Support Request');
  };

  const handlePrivacyPolicy = () => {
    Linking.openURL('https://memorizeapp.com/privacy');
  };

  const handleTerms = () => {
    Linking.openURL('https://memorizeapp.com/terms');
  };

  const handleAbout = () => {
    Alert.alert(
      'About Memorize',
      'Version 1.0.0\n\nA powerful flashcard app built with spaced repetition to help you learn anything.',
      [{ text: 'OK' }]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
            Settings
          </Text>
        </View>

        <View style={styles.section}>
          <SettingItem
            icon="star"
            title="Upgrade to Pro"
            subtitle="Unlock all features and support development"
            onPress={handleSubscription}
            iconColor="#FFD700"
            iconBg="#FF6B6B"
          />
        </View>

        <SectionHeader title="ACCOUNT" />
        <View style={styles.section}>
          <AccountSection SettingItem={SettingItem} />
        </View>

        <SectionHeader title="STUDY" />
        <View style={styles.section}>
          <SettingItem
            icon="notifications"
            title="Notifications"
            subtitle="Get reminded to study"
            rightElement={
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: theme.colors.border, true: theme.colors.accent + '80' }}
                thumbColor={notificationsEnabled ? theme.colors.accent : theme.colors.textTertiary}
              />
            }
            showChevron={false}
            iconColor="#FFFFFF"
            iconBg="#FF6B6B"
          />
          
          <SettingItem
            icon="time"
            title="Daily Reminder"
            subtitle="Study at the same time every day"
            rightElement={
              <Switch
                value={dailyReminder}
                onValueChange={setDailyReminder}
                trackColor={{ false: theme.colors.border, true: theme.colors.accent + '80' }}
                thumbColor={dailyReminder ? theme.colors.accent : theme.colors.textTertiary}
              />
            }
            showChevron={false}
            iconColor="#FFFFFF"
            iconBg="#A29BFE"
          />

          <SettingItem
            icon="calendar"
            title="Study Schedule"
            subtitle="Set your study times"
            onPress={() => Alert.alert('Coming Soon', 'Study schedule feature coming soon!')}
            iconColor="#FFFFFF"
            iconBg="#00B894"
          />
        </View>

        <SectionHeader title="APPEARANCE" />
        <View style={styles.section}>
          <SettingItem
            icon="color-palette"
            title="Theme"
            subtitle={themeOptions.find(o => o.value === theme.themePreference)?.label || 'System'}
            onPress={() => setShowThemeModal(true)}
            iconColor="#FFFFFF"
            iconBg="#6C5CE7"
          />

          <SettingItem
            icon="text"
            title="Font Size"
            subtitle="Adjust card text size"
            onPress={() => Alert.alert('Coming Soon', 'Font size adjustment coming soon!')}
            iconColor="#FFFFFF"
            iconBg="#FDCB6E"
          />
        </View>

        <SectionHeader title="DATA & STORAGE" />
        <View style={styles.section}>
          <BackupSection SettingItem={SettingItem} />

          <SettingItem
            icon="download"
            title="Export Data"
            subtitle="Export all your decks"
            onPress={() => Alert.alert('Coming Soon', 'Export feature coming soon!')}
            iconColor="#FFFFFF"
            iconBg="#00B894"
          />

          <SettingItem
            icon="trash"
            title="Clear All Data"
            subtitle="Delete all decks and reset app"
            onPress={() => {
              Alert.alert(
                'Clear All Data',
                'This will permanently delete ALL decks, cards, and progress. This cannot be undone.\n\nAre you sure?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { 
                    text: 'Delete Everything', 
                    style: 'destructive', 
                    onPress: async () => {
                      try {
                        // Clear all data from database
                        db.clear();
                        
                        // Save empty database
                        await PersistenceService.save(db);
                        
                        // Clear media files
                        const mediaDir = `${FileSystem.documentDirectory}media/`;
                        await FileSystem.deleteAsync(mediaDir, { idempotent: true });
                        await FileSystem.makeDirectoryAsync(mediaDir, { intermediates: true });
                        
                        // Clear temp files
                        const tempDir = `${FileSystem.documentDirectory}temp/`;
                        await FileSystem.deleteAsync(tempDir, { idempotent: true });
                        await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true });
                        
                        // Reload scheduler to refresh all screens
                        reload();
                        
                        Alert.alert('Success', 'All data has been cleared.');
                      } catch (error) {
                        console.error('Error clearing data:', error);
                        Alert.alert('Error', 'Failed to clear data. Please try again.');
                      }
                    }
                  },
                ]
              );
            }}
            iconColor="#FFFFFF"
            iconBg="#D63031"
          />
        </View>

        <SectionHeader title="SUPPORT" />
        <View style={styles.section}>
          <SettingItem
            icon="star-outline"
            title="Rate Us"
            subtitle="Love Memorize? Leave a review!"
            onPress={handleRateUs}
            iconColor="#FFFFFF"
            iconBg="#FFD700"
          />

          <SettingItem
            icon="mail"
            title="Contact Support"
            subtitle="Get help from our team"
            onPress={handleContactSupport}
            iconColor="#FFFFFF"
            iconBg="#0984E3"
          />

          <SettingItem
            icon="help-circle"
            title="Help & Tutorial"
            subtitle="Learn how to use Memorize"
            onPress={() => Alert.alert('Coming Soon', 'Tutorial coming soon!')}
            iconColor="#FFFFFF"
            iconBg="#00B894"
          />
        </View>

        <SectionHeader title="LEGAL" />
        <View style={styles.section}>
          <SettingItem
            icon="shield-checkmark"
            title="Privacy Policy"
            onPress={handlePrivacyPolicy}
            iconColor="#FFFFFF"
            iconBg="#636E72"
          />

          <SettingItem
            icon="document-text"
            title="Terms & Conditions"
            onPress={handleTerms}
            iconColor="#FFFFFF"
            iconBg="#636E72"
          />

          <SettingItem
            icon="information-circle"
            title="About"
            onPress={handleAbout}
            iconColor="#FFFFFF"
            iconBg="#636E72"
          />
        </View>

        <Text style={[styles.version, { color: theme.colors.textTertiary }]}>
          Version 1.0.0
        </Text>
      </ScrollView>

      <Modal
        visible={showThemeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowThemeModal(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setShowThemeModal(false)}
        >
          <View 
            style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}
            onStartShouldSetResponder={() => true}
          >
            <Text style={[styles.modalTitle, { color: theme.colors.textPrimary }]}>
              Choose Theme
            </Text>
            
            {themeOptions.map((option) => (
              <Pressable
                key={option.value}
                style={[
                  styles.themeOption,
                  {
                    backgroundColor: theme.themePreference === option.value 
                      ? theme.colors.accent + '15'
                      : 'transparent',
                    borderColor: theme.themePreference === option.value
                      ? theme.colors.accent
                      : theme.colors.border,
                  }
                ]}
                onPress={() => {
                  theme.setThemePreference(option.value);
                  setShowThemeModal(false);
                }}
              >
                <Ionicons 
                  name={option.icon as any} 
                  size={24} 
                  color={theme.themePreference === option.value ? theme.colors.accent : theme.colors.textSecondary} 
                />
                <Text style={[
                  styles.themeOptionText,
                  { 
                    color: theme.themePreference === option.value 
                      ? theme.colors.accent
                      : theme.colors.textPrimary 
                  }
                ]}>
                  {option.label}
                </Text>
                {theme.themePreference === option.value && (
                  <Ionicons name="checkmark-circle" size={24} color={theme.colors.accent} />
                )}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: s.lg,
    paddingBottom: s.xl * 2,
  },
  header: {
    marginBottom: s.lg,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
  },
  section: {
    marginBottom: s.lg,
    borderRadius: r.lg,
    overflow: 'hidden',
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: s.sm,
    marginTop: s.md,
    marginLeft: s.xs,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: s.lg,
    gap: s.md,
    marginBottom: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingContent: {
    flex: 1,
    gap: s.xs / 2,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  settingSubtitle: {
    fontSize: 13,
  },
  version: {
    textAlign: 'center',
    fontSize: 13,
    marginTop: s.xl,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: s.lg,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: r.lg,
    padding: s.lg,
    gap: s.sm,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: s.md,
  },
  themeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.md,
    padding: s.lg,
    borderRadius: r.md,
    borderWidth: 2,
    marginBottom: s.sm,
  },
  themeOptionText: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
});
