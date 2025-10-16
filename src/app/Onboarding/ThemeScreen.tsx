import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useThemeActions } from '../../design/theme';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';
import PrimaryButton from '../../components/PrimaryButton';
import { useAuth } from '../../context/AuthContext';
import { UserPrefsService } from '../../services/onboarding/UserPrefsService';
import { auth } from '../../config/firebase';

interface ThemeScreenProps {
  navigation: any;
  route: any;
}

type ThemeMode = 'system' | 'light' | 'dark';

export default function ThemeScreen({ navigation, route }: ThemeScreenProps) {
  const theme = useTheme();
  const { setThemePreference } = useThemeActions();
  const { user } = useAuth();
  const [selectedTheme, setSelectedTheme] = useState<ThemeMode>('system');
  const [saving, setSaving] = useState(false);
  
  const { profile, preferences } = route.params || {};

  const themeOptions = [
    {
      mode: 'system' as ThemeMode,
      label: 'System',
      description: 'Match device settings',
      icon: 'phone-portrait',
    },
    {
      mode: 'light' as ThemeMode,
      label: 'Light',
      description: 'Light theme always',
      icon: 'sunny',
    },
    {
      mode: 'dark' as ThemeMode,
      label: 'Dark',
      description: 'Dark theme always',
      icon: 'moon',
    },
  ];

  const handleFinish = async () => {
    if (!user?.uid) {
      Alert.alert('Error', 'No user found. Please sign in again.');
      return;
    }

    try {
      setSaving(true);

      // Update display name in Firebase if provided
      if (profile?.displayName && auth().currentUser) {
        await auth().currentUser?.updateProfile({
          displayName: profile.displayName,
        });
      }

      // Save user profile
      if (profile) {
        await UserPrefsService.setUserProfile(user.uid, profile);
      }

      // Save user preferences with theme
      const fullPreferences = {
        ...preferences,
        themePreference: selectedTheme,
      };
      await UserPrefsService.setUserPreferences(user.uid, fullPreferences);

      // Apply theme preference
      setThemePreference(selectedTheme);

      // Mark onboarding as completed - THIS MUST BE LAST
      await UserPrefsService.setOnboardingCompleted(user.uid);

      // Small delay to ensure AsyncStorage write completes
      await new Promise(resolve => setTimeout(resolve, 100));

      // Force reload by setting saving to false which will trigger AuthNavigator check
    } catch (error) {
      console.error('[Onboarding] Error saving preferences:', error);
      Alert.alert('Error', 'Failed to save your preferences. Please try again.');
      setSaving(false);
    }
    // Don't set saving to false here - let AuthNavigator handle navigation
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={{ padding: s.sm }} disabled={saving}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </Pressable>
        <Text style={[styles.stepText, { color: theme.colors.textTertiary }]}>
          Step 3 of 3
        </Text>
      </View>

      <View style={styles.content}>
        {/* Title Section */}
        <View style={styles.titleSection}>
          <View style={[styles.iconContainer, { backgroundColor: theme.colors.accent + '20' }]}>
            <Ionicons name="color-palette" size={32} color={theme.colors.accent} />
          </View>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
            Choose Your Theme
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Select your preferred appearance
          </Text>
        </View>

        {/* Theme Options */}
        <View style={styles.themeOptions}>
          {themeOptions.map((option) => (
            <Pressable
              key={option.mode}
              style={[
                styles.themeCard,
                { 
                  backgroundColor: theme.colors.surface,
                  borderColor: selectedTheme === option.mode ? theme.colors.accent : theme.colors.border,
                  borderWidth: selectedTheme === option.mode ? 2 : 1,
                },
              ]}
              onPress={() => setSelectedTheme(option.mode)}
              disabled={saving}
            >
              <View style={[
                styles.themeIconContainer,
                { backgroundColor: selectedTheme === option.mode ? theme.colors.accent + '20' : theme.colors.bg }
              ]}>
                <Ionicons 
                  name={option.icon} 
                  size={36} 
                  color={selectedTheme === option.mode ? theme.colors.accent : theme.colors.textSecondary} 
                />
              </View>
              <Text style={[
                styles.themeLabel,
                { color: selectedTheme === option.mode ? theme.colors.accent : theme.colors.textPrimary }
              ]}>
                {option.label}
              </Text>
              <Text style={[styles.themeDescription, { color: theme.colors.textSecondary }]}>
                {option.description}
              </Text>
              {selectedTheme === option.mode && (
                <View style={[styles.checkmark, { backgroundColor: theme.colors.accent }]}>
                  <Ionicons name="checkmark" size={16} color="#000" />
                </View>
              )}
            </Pressable>
          ))}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <PrimaryButton
            title={saving ? 'Setting up...' : "Let's Go! ✓"}
            onPress={handleFinish}
          />
          {saving && (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={theme.colors.accent} />
              <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
                Personalizing your experience...
              </Text>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: s.lg,
    paddingVertical: s.md,
  },
  stepText: {
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    padding: s.xl,
    justifyContent: 'space-between',
  },
  titleSection: {
    alignItems: 'center',
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: r.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: s.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: s.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  themeOptions: {
    flexDirection: 'row',
    gap: s.md,
    flex: 1,
    alignItems: 'center',
  },
  themeCard: {
    flex: 1,
    padding: s.xl,
    borderRadius: r.lg,
    alignItems: 'center',
    gap: s.md,
    position: 'relative',
  },
  themeIconContainer: {
    width: 72,
    height: 72,
    borderRadius: r.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  themeLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  themeDescription: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  checkmark: {
    position: 'absolute',
    top: s.md,
    right: s.md,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actions: {
    gap: s.md,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s.sm,
  },
  loadingText: {
    fontSize: 14,
  },
});
