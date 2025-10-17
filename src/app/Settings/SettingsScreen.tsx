import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Switch, Alert, Modal, TextInput } from 'react-native';
import Slider from '@react-native-community/slider';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../design/theme';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';
import { useAuth } from '../../context/AuthContext';
import { NotificationService } from '../../services/NotificationService';
import { UserPrefsService } from '../../services/onboarding/UserPrefsService';
import { logger } from '../../utils/logger';

type ColorScheme = 'sunset' | 'ocean' | 'forest' | 'neon';

interface ThemeColorOption {
  id: ColorScheme;
  name: string;
  colors: [string, string, string];
  gradient: [string, string];
  icon: keyof typeof Ionicons.glyphMap;
}

const topThemes: ThemeColorOption[] = [
  { id: 'sunset', name: 'Sunset', colors: ['#8B5CF6', '#F59E0B', '#FB7185'], gradient: ['#6366F1', '#8B5CF6'], icon: 'partly-sunny' },
  { id: 'ocean', name: 'Ocean', colors: ['#6366F1', '#06B6D4', '#14B8A6'], gradient: ['#3B82F6', '#6366F1'], icon: 'water' },
  { id: 'forest', name: 'Forest', colors: ['#8B5CF6', '#10B981', '#84CC16'], gradient: ['#10B981', '#8B5CF6'], icon: 'leaf' },
  { id: 'neon', name: 'Neon', colors: ['#A855F7', '#22D3EE', '#F0ABFC'], gradient: ['#EC4899', '#A855F7'], icon: 'flash' },
];

interface SettingItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  showChevron?: boolean;
}

function SettingItem({ icon, title, subtitle, onPress, rightElement, showChevron = true }: SettingItemProps) {
  const theme = useTheme();
  
  return (
    <Pressable style={[styles.settingItem, { backgroundColor: theme.colors.surface2 }]} onPress={onPress} disabled={!onPress}>
      <View style={[styles.iconContainer, { backgroundColor: '#9CA3AF' }]}>
        <Ionicons name={icon} size={22} color="#FFFFFF" />
      </View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingTitle, { color: theme.colors.textHigh }]}>{title}</Text>
        {subtitle && <Text style={[styles.settingSubtitle, { color: theme.colors.textMed }]}>{subtitle}</Text>}
      </View>
      {rightElement || (showChevron && onPress && <Ionicons name="chevron-forward" size={20} color={theme.colors.textLow} />)}
    </Pressable>
  );
}

function SectionHeader({ title }: { title: string }) {
  const theme = useTheme();
  return <Text style={[styles.sectionHeader, { color: theme.colors.textMed }]}>{title}</Text>;
}

interface SettingsScreenProps {
  navigation: any;
}

export default function SettingsScreen({ navigation }: SettingsScreenProps) {
  const theme = useTheme();
  const { user, signOut } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [dailyReminder, setDailyReminder] = useState(false);
  const [dailyGoal, setDailyGoal] = useState(15);
  const [displayName, setDisplayName] = useState('');
  const [showNameModal, setShowNameModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [tempDisplayName, setTempDisplayName] = useState('');
  const [tempGoal, setTempGoal] = useState('15');

  useEffect(() => { loadSettings(); }, [user]);

  const loadSettings = async () => {
    try {
      const notifSettings = await NotificationService.getSettings();
      setNotificationsEnabled(notifSettings.enabled);
      setDailyReminder(notifSettings.dailyReminderEnabled);
      if (user?.uid) {
        const prefs = await UserPrefsService.getUserPreferences(user.uid);
        setDailyGoal(prefs.goalMinutes);
        const profile = await UserPrefsService.getUserProfile(user.uid);
        if (profile?.displayName) {
          setDisplayName(profile.displayName);
        } else if (user.displayName) {
          setDisplayName(user.displayName);
        }
      }
    } catch (error) {
      logger.error('[Settings] Error loading settings:', error);
    }
  };

  const handleNotificationsToggle = async (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const success = await NotificationService.setNotificationsEnabled(value);
    if (success) {
      setNotificationsEnabled(value);
    } else if (value) {
      Alert.alert('Permission Required', 'Please enable notifications in your device settings.', [{ text: 'OK' }]);
    }
  };

  const handleDailyReminderToggle = async (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const success = await NotificationService.setDailyReminderEnabled(value);
    if (success) {
      setDailyReminder(value);
    } else if (value) {
      Alert.alert('Notifications Required', 'Please enable notifications first.', [{ text: 'OK' }]);
    }
  };

  const handleDailyGoalPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTempGoal(dailyGoal.toString());
    setShowGoalModal(true);
  };

  const handleSaveGoal = async () => {
    const minutes = parseInt(tempGoal || '15', 10);
    if (minutes > 0 && minutes <= 180) {
      setDailyGoal(minutes);
      if (user?.uid) await UserPrefsService.setUserPreferences(user.uid, { goalMinutes: minutes });
      setShowGoalModal(false);
    } else {
      Alert.alert('Invalid Goal', 'Please enter a number between 1 and 180 minutes.');
    }
  };

  const handleDisplayNamePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTempDisplayName(displayName);
    setShowNameModal(true);
  };

  const handleSaveDisplayName = async () => {
    if (!tempDisplayName.trim()) {
      Alert.alert('Invalid Name', 'Please enter a valid display name.');
      return;
    }
    try {
      if (user?.uid) {
        await UserPrefsService.setUserProfile(user.uid, { displayName: tempDisplayName.trim() });
        setDisplayName(tempDisplayName.trim());
        setShowNameModal(false);
        Alert.alert('Success', 'Your display name has been updated!');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update display name. Please try again.');
    }
  };

  const handleSubscription = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('⭐ Memorize Pro', 'Unlock unlimited decks, advanced analytics, cloud sync, and priority support!\n\n• Unlimited flashcard decks\n• Advanced statistics & insights\n• Automatic cloud backup\n• Priority email support\n• Ad-free experience\n\nOnly $4.99/month or $39.99/year', [
      { text: 'Maybe Later', style: 'cancel' },
      { text: 'Subscribe Now', onPress: () => logger.info('Subscribe pressed') },
    ]);
  };

  const handleSignOut = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => {
        try {
          await signOut();
        } catch (error) {
          Alert.alert('Error', 'Failed to sign out. Please try again.');
        }
      }},
    ]);
  };

  const themeOptions = [
    { value: 'system', label: 'System', icon: 'phone-portrait' },
    { value: 'light', label: 'Light', icon: 'sunny' },
    { value: 'dark', label: 'Dark', icon: 'moon' },
  ] as const;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.textHigh }]}>Settings</Text>
        </View>

        <Pressable onPress={handleSubscription} style={styles.premiumBanner}>
          <LinearGradient colors={['#6366F1', '#8B5CF6', '#D946EF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.premiumGradient}>
            <View style={styles.premiumContent}>
              <View style={styles.premiumIcon}>
                <Ionicons name="star" size={32} color="#FFD700" />
              </View>
              <View style={styles.premiumText}>
                <Text style={styles.premiumTitle}>Upgrade to Pro</Text>
                <Text style={styles.premiumSubtitle}>Unlimited decks • Advanced stats • Cloud sync</Text>
              </View>
              <View style={styles.premiumBadge}>
                <Text style={styles.premiumBadgeText}>Premium</Text>
              </View>
            </View>
            <View style={styles.premiumFooter}>
              <Ionicons name="checkmark-circle" size={16} color="rgba(255, 255, 255, 0.9)" />
              <Text style={styles.premiumFooterText}>7-day free trial • Cancel anytime</Text>
            </View>
          </LinearGradient>
        </Pressable>

        <SectionHeader title="PROFILE" />
        <View style={styles.section}>
          <SettingItem icon="person" title="Display Name" subtitle={displayName || 'Set your display name'} onPress={handleDisplayNamePress} />
        </View>

        <SectionHeader title="STUDY" />
        <View style={styles.section}>
          <SettingItem icon="notifications" title="Notifications" subtitle={notificationsEnabled ? 'Enabled' : 'Disabled'} rightElement={<Switch value={notificationsEnabled} onValueChange={handleNotificationsToggle} trackColor={{ false: theme.colors.border, true: theme.colors.overlay.primary }} thumbColor={notificationsEnabled ? theme.colors.primary : theme.colors.textLow} />} showChevron={false} />
          <SettingItem icon="time" title="Daily Reminder" subtitle={dailyReminder ? 'Study at 8:00 PM daily' : 'Disabled'} rightElement={<Switch value={dailyReminder} onValueChange={handleDailyReminderToggle} trackColor={{ false: theme.colors.border, true: theme.colors.overlay.primary }} thumbColor={dailyReminder ? theme.colors.primary : theme.colors.textLow} />} showChevron={false} />
          <SettingItem icon="trophy" title="Daily Goal" subtitle={`${dailyGoal} minutes per day`} onPress={handleDailyGoalPress} />
        </View>

        <SectionHeader title="APPEARANCE" />
        <View style={styles.section}>
          <SettingItem icon="contrast" title="Theme Mode" subtitle={themeOptions.find(o => o.value === theme.themePreference)?.label || 'System'} onPress={() => setShowThemeModal(true)} />
        </View>

        <SectionHeader title="COLOR THEMES" />
        <View style={[styles.colorSection, { backgroundColor: theme.colors.surface2 }]}>
          <View style={styles.colorGrid}>
            {topThemes.map((themeOption) => {
              const isSelected = theme.colorScheme === themeOption.id;
              return (
                <Pressable key={themeOption.id} style={[styles.colorCard, isSelected && styles.colorCardSelected, { borderColor: isSelected ? themeOption.colors[0] : theme.colors.border, backgroundColor: theme.colors.surface2 }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); theme.setColorScheme(themeOption.id as any); }}>
                  <LinearGradient colors={themeOption.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.colorGradient}>
                    <View style={styles.colorIconContainer}>
                      <Ionicons name={themeOption.icon} size={24} color="#FFFFFF" />
                    </View>
                  </LinearGradient>
                  <View style={styles.colorSwatches}>
                    {themeOption.colors.map((color, idx) => <View key={idx} style={[styles.colorSwatch, { backgroundColor: color }]} />)}
                  </View>
                  <View style={styles.colorInfo}>
                    <Text style={[styles.colorName, { color: theme.colors.textHigh }]} numberOfLines={1}>{themeOption.name}</Text>
                    {isSelected && <Ionicons name="checkmark-circle" size={14} color={themeOption.colors[0]} />}
                  </View>
                </Pressable>
              );
            })}
          </View>
          <Pressable style={[styles.moreThemesButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.navigate('ThemeSelection'); }}>
            <Ionicons name="color-palette" size={20} color={theme.colors.textMed} />
            <Text style={[styles.moreThemesText, { color: theme.colors.textMed }]}>View All Themes</Text>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textMed} />
          </Pressable>
        </View>

        <SectionHeader title="ACCOUNT" />
        <View style={styles.section}>
          {user && !user.isAnonymous && (
            <SettingItem icon="person-circle" title={user.email || 'Account'} subtitle={user.emailVerified ? 'Verified' : 'Not verified'} showChevron={false} />
          )}
          {user && !user.isAnonymous && (
            <SettingItem icon="log-out" title="Sign Out" subtitle="Sign out of your account" onPress={handleSignOut} />
          )}
        </View>

        <Text style={[styles.version, { color: theme.colors.textLow }]}>Version 1.0.0</Text>
      </ScrollView>

      <Modal visible={showNameModal} transparent animationType="fade" onRequestClose={() => setShowNameModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowNameModal(false)}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface2 }]} onStartShouldSetResponder={() => true}>
            <Text style={[styles.modalTitle, { color: theme.colors.textHigh }]}>Display Name</Text>
            <TextInput style={[styles.nameInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.textHigh }]} value={tempDisplayName} onChangeText={setTempDisplayName} placeholder="Enter your name" placeholderTextColor={theme.colors.textLow} autoFocus maxLength={50} />
            <View style={styles.modalButtons}>
              <Pressable style={[styles.modalButton, { backgroundColor: theme.colors.surface }]} onPress={() => setShowNameModal(false)}>
                <Text style={[styles.modalButtonText, { color: theme.colors.textHigh }]}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.modalButton, { backgroundColor: theme.colors.primary }]} onPress={handleSaveDisplayName}>
                <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]}>Save</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={showGoalModal} transparent animationType="fade" onRequestClose={() => setShowGoalModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowGoalModal(false)}>
          <View style={[styles.goalModalContent, { backgroundColor: theme.colors.surface2 }]} onStartShouldSetResponder={() => true}>
            <View style={[styles.goalIconContainer, { backgroundColor: theme.colors.overlay.primary }]}>
              <Ionicons name="trophy" size={40} color={theme.colors.primary} />
            </View>
            <Text style={[styles.goalModalTitle, { color: theme.colors.textHigh }]}>Daily Study Goal</Text>
            <Text style={[styles.goalModalSubtitle, { color: theme.colors.textMed }]}>How many minutes do you want to study each day?</Text>
            <View style={styles.sliderContainer}>
              <Text style={[styles.sliderValue, { color: theme.colors.primary }]}>{tempGoal} minutes</Text>
              <Slider
                style={styles.slider}
                minimumValue={5}
                maximumValue={180}
                step={5}
                value={parseInt(tempGoal || '15', 10)}
                onValueChange={(value) => setTempGoal(value.toString())}
                minimumTrackTintColor={theme.colors.primary}
                maximumTrackTintColor={theme.colors.border}
                thumbTintColor={theme.colors.primary}
              />
              <View style={styles.sliderLabels}>
                <Text style={[styles.sliderLabel, { color: theme.colors.textLow }]}>5 min</Text>
                <Text style={[styles.sliderLabel, { color: theme.colors.textLow }]}>180 min</Text>
              </View>
            </View>
            <View style={styles.modalButtons}>
              <Pressable style={[styles.modalButton, { backgroundColor: theme.colors.surface }]} onPress={() => setShowGoalModal(false)}>
                <Text style={[styles.modalButtonText, { color: theme.colors.textHigh }]}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.modalButton, { backgroundColor: theme.colors.primary }]} onPress={handleSaveGoal}>
                <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]}>Save Goal</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={showThemeModal} transparent animationType="fade" onRequestClose={() => setShowThemeModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowThemeModal(false)}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface2 }]} onStartShouldSetResponder={() => true}>
            <Text style={[styles.modalTitle, { color: theme.colors.textHigh }]}>Theme Mode</Text>
            {themeOptions.map((option) => (
              <Pressable key={option.value} style={[styles.themeOption, { backgroundColor: theme.themePreference === option.value ? theme.colors.overlay.primary : 'transparent', borderColor: theme.themePreference === option.value ? theme.colors.primary : theme.colors.border }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); theme.setThemePreference(option.value); setShowThemeModal(false); }}>
                <Ionicons name={option.icon as any} size={24} color={theme.themePreference === option.value ? theme.colors.primary : theme.colors.textMed} />
                <Text style={[styles.themeOptionText, { color: theme.themePreference === option.value ? theme.colors.primary : theme.colors.textHigh }]}>{option.label}</Text>
                {theme.themePreference === option.value && <Ionicons name="checkmark-circle" size={24} color={theme.colors.primary} />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  content: { padding: s.lg, paddingBottom: s.xl * 2 },
  header: { marginBottom: s.lg },
  title: { fontSize: 32, fontWeight: '700' },
  premiumBanner: { marginBottom: s.xl, borderRadius: r.xl, overflow: 'hidden' },
  premiumGradient: { padding: s.lg },
  premiumContent: { flexDirection: 'row', alignItems: 'center', marginBottom: s.md },
  premiumIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255, 255, 255, 0.2)', justifyContent: 'center', alignItems: 'center' },
  premiumText: { flex: 1, marginLeft: s.md },
  premiumTitle: { fontSize: 20, fontWeight: '800', color: '#FFFFFF', marginBottom: 4 },
  premiumSubtitle: { fontSize: 13, fontWeight: '500', color: 'rgba(255, 255, 255, 0.9)' },
  premiumBadge: { backgroundColor: 'rgba(255, 215, 0, 0.3)', paddingHorizontal: s.md, paddingVertical: s.xs, borderRadius: r.full, borderWidth: 1, borderColor: '#FFD700' },
  premiumBadgeText: { fontSize: 12, fontWeight: '700', color: '#FFD700' },
  premiumFooter: { flexDirection: 'row', alignItems: 'center', gap: s.xs },
  premiumFooterText: { fontSize: 12, fontWeight: '500', color: 'rgba(255, 255, 255, 0.9)' },
  section: { marginBottom: s.lg, borderRadius: r.lg, overflow: 'hidden' },
  sectionHeader: { fontSize: 13, fontWeight: '600', letterSpacing: 0.5, marginBottom: s.sm, marginTop: s.md, marginLeft: s.xs },
  settingItem: { flexDirection: 'row', alignItems: 'center', padding: s.lg, gap: s.md, marginBottom: 1 },
  iconContainer: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  settingContent: { flex: 1, gap: s.xs / 2 },
  settingTitle: { fontSize: 16, fontWeight: '600' },
  settingSubtitle: { fontSize: 13 },
  colorSection: { padding: s.lg, borderRadius: r.lg, marginBottom: s.lg },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: s.md, marginBottom: s.md },
  colorCard: { width: '47%', borderRadius: r.md, borderWidth: 2, overflow: 'hidden' },
  colorCardSelected: { borderWidth: 3 },
  colorGradient: { height: 70, justifyContent: 'center', alignItems: 'center' },
  colorIconContainer: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255, 255, 255, 0.2)', justifyContent: 'center', alignItems: 'center' },
  colorSwatches: { flexDirection: 'row', height: 20 },
  colorSwatch: { flex: 1 },
  colorInfo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: s.sm, paddingHorizontal: s.md },
  colorName: { fontSize: 14, fontWeight: '700', flex: 1 },
  moreThemesButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: s.md, borderRadius: r.md, borderWidth: 2, gap: s.sm },
  moreThemesText: { fontSize: 15, fontWeight: '700' },
  version: { textAlign: 'center', fontSize: 13, marginTop: s.xl },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center', padding: s.lg },
  modalContent: { width: '100%', maxWidth: 400, borderRadius: r.lg, padding: s.lg, gap: s.md },
  modalTitle: { fontSize: 20, fontWeight: '600', marginBottom: s.sm },
  nameInput: { borderWidth: 2, borderRadius: r.md, padding: s.md, fontSize: 16, marginBottom: s.sm },
  goalModalContent: { width: '100%', maxWidth: 400, borderRadius: r.xl, padding: s.xl, gap: s.md, alignItems: 'center' },
  goalIconContainer: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: s.sm },
  goalModalTitle: { fontSize: 24, fontWeight: '700', textAlign: 'center' },
  goalModalSubtitle: { fontSize: 15, textAlign: 'center', marginBottom: s.md },
  goalInputContainer: { flexDirection: 'row', alignItems: 'center', gap: s.md, marginBottom: s.xs },
  goalInput: { width: 100, borderWidth: 2, borderRadius: r.md, padding: s.lg, fontSize: 32, fontWeight: '700', textAlign: 'center' },
  goalInputLabel: { fontSize: 18, fontWeight: '600' },
  goalHint: { fontSize: 13, marginBottom: s.lg },
  sliderContainer: { width: '100%', gap: s.md, marginBottom: s.md },
  sliderValue: { fontSize: 48, fontWeight: '800', textAlign: 'center' },
  slider: { width: '100%', height: 40 },
  sliderLabels: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: s.xs },
  sliderLabel: { fontSize: 12, fontWeight: '500' },
  modalButtons: { flexDirection: 'row', gap: s.sm, width: '100%' },
  modalButton: { flex: 1, padding: s.md, borderRadius: r.md, alignItems: 'center' },
  modalButtonText: { fontSize: 16, fontWeight: '600' },
  themeOption: { flexDirection: 'row', alignItems: 'center', gap: s.md, padding: s.lg, borderRadius: r.md, borderWidth: 2, marginBottom: s.sm },
  themeOptionText: { fontSize: 16, fontWeight: '600', flex: 1 },
});
