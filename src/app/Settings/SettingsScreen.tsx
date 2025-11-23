import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, Modal, TextInput, Platform, Image } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import Slider from '@react-native-community/slider';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../design/theme';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';
import { useAuth } from '../../context/AuthContext';
import { usePremium } from '../../context/PremiumContext';
import { NotificationService } from '../../services/NotificationService';
import { UserPrefsService } from '../../services/onboarding/UserPrefsService';
import LegalModal from './components/LegalModal';
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
      <View style={[styles.iconContainer, { backgroundColor: theme.colors.accent }]}>
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

function SwitchToggle({ value, onToggle, theme }: { value: boolean; onToggle: () => void; theme: any }) {
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      { 
        translateX: withSpring(value ? 20 : 0, {
          damping: 15,
          stiffness: 180,
        }) 
      }
    ],
  }));

  return (
    <Pressable 
      onPress={onToggle}
      style={[styles.switchContainer, { 
        backgroundColor: value ? theme.colors.primary : theme.colors.border 
      }]}
    >
      <Animated.View style={[styles.switchThumb, thumbStyle]} />
    </Pressable>
  );
}

interface SettingsScreenProps {
  navigation: any;
}

export default function SettingsScreen({ navigation }: SettingsScreenProps) {
  const theme = useTheme();
  const { user, signOut } = useAuth();
  const { isPremiumEffective } = usePremium();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [dailyReminder, setDailyReminder] = useState(false);
  const [reminderTime, setReminderTime] = useState({ hour: 20, minute: 0 });
  const [dailyGoal, setDailyGoal] = useState(15);
  const [displayName, setDisplayName] = useState('');
  const [showNameModal, setShowNameModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showReminderTimeModal, setShowReminderTimeModal] = useState(false);
  const [tempDisplayName, setTempDisplayName] = useState('');
  const [tempGoal, setTempGoal] = useState('15');
  const [tempHour, setTempHour] = useState('20');
  const [tempMinute, setTempMinute] = useState('0');
  const [legalOpen, setLegalOpen] = useState<null | 'privacy' | 'terms'>(null);

  useEffect(() => { loadSettings(); }, [user]);

  const loadSettings = async () => {
    try {
      const notifSettings = await NotificationService.getSettings();
      setNotificationsEnabled(notifSettings.enabled);
      setDailyReminder(notifSettings.dailyReminderEnabled);
      setReminderTime(notifSettings.reminderTime);
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
      // If disabling notifications, daily reminder is also disabled
      if (!value) {
        setDailyReminder(false);
      }
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

  const handleReminderTimePress = () => {
    if (!dailyReminder) {
      Alert.alert('Enable Daily Reminder', 'Please enable daily reminder first to set the time.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTempHour(reminderTime.hour.toString());
    setTempMinute(reminderTime.minute.toString());
    setShowReminderTimeModal(true);
  };

  const handleSaveReminderTime = async () => {
    const hour = parseInt(tempHour || '20', 10);
    const minute = parseInt(tempMinute || '0', 10);
    
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      Alert.alert('Invalid Time', 'Please enter a valid time (hour: 0-23, minute: 0-59).');
      return;
    }
    
    try {
      await NotificationService.setReminderTime(hour, minute);
      setReminderTime({ hour, minute });
      setShowReminderTimeModal(false);
      Alert.alert('Success', `Daily reminder set for ${formatTime(hour, minute)}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to set reminder time. Please try again.');
    }
  };

  const formatTime = (hour: number, minute: number): string => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    const displayMinute = minute.toString().padStart(2, '0');
    return `${displayHour}:${displayMinute} ${period}`;
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


        <SectionHeader title="PROFILE" />
        <View style={styles.section}>
          <SettingItem icon="person" title="Display Name" subtitle={displayName || 'Set your display name'} onPress={handleDisplayNamePress} />
        </View>

        <SectionHeader title="STUDY" />
        <View style={styles.section}>
          <SettingItem 
            icon="notifications" 
            title="Notifications" 
            subtitle={notificationsEnabled ? 'Enabled' : 'Disabled'} 
            rightElement={<SwitchToggle value={notificationsEnabled} onToggle={() => handleNotificationsToggle(!notificationsEnabled)} theme={theme} />} 
            showChevron={false} 
          />
          <SettingItem 
            icon="time" 
            title="Daily Reminder" 
            subtitle={dailyReminder ? `Study at ${formatTime(reminderTime.hour, reminderTime.minute)} daily` : 'Disabled'} 
            rightElement={<SwitchToggle value={dailyReminder} onToggle={() => handleDailyReminderToggle(!dailyReminder)} theme={theme} />} 
            showChevron={false} 
          />
          {dailyReminder && (
            <SettingItem 
              icon="alarm" 
              title="Reminder Time" 
              subtitle={formatTime(reminderTime.hour, reminderTime.minute)} 
              onPress={handleReminderTimePress} 
            />
          )}
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

        <SectionHeader title="LEGAL" />
        <View style={styles.section}>
          <SettingItem icon="document-text" title="Terms of Use" onPress={() => setLegalOpen('terms')} />
          <SettingItem icon="shield-checkmark" title="Privacy Policy" onPress={() => setLegalOpen('privacy')} />
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
                onValueChange={(value: number) => setTempGoal(value.toString())}
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

      <Modal visible={showReminderTimeModal} transparent animationType="fade" onRequestClose={() => setShowReminderTimeModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowReminderTimeModal(false)}>
          <View style={[styles.goalModalContent, { backgroundColor: theme.colors.surface2 }]} onStartShouldSetResponder={() => true}>
            <View style={[styles.goalIconContainer, { backgroundColor: theme.colors.overlay.primary }]}>
              <Ionicons name="alarm" size={40} color={theme.colors.primary} />
            </View>
            <Text style={[styles.goalModalTitle, { color: theme.colors.textHigh }]}>Set Reminder Time</Text>
            <Text style={[styles.goalModalSubtitle, { color: theme.colors.textMed }]}>Choose when you want to receive your daily study reminder</Text>
            <View style={styles.timeInputContainer}>
              <View style={styles.timeInputGroup}>
                <Text style={[styles.timeLabel, { color: theme.colors.textMed }]}>Hour (0-23)</Text>
                <TextInput
                  style={[styles.timeInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.textHigh }]}
                  value={tempHour}
                  onChangeText={setTempHour}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholder="20"
                  placeholderTextColor={theme.colors.textLow}
                />
              </View>
              <Text style={[styles.timeColon, { color: theme.colors.textHigh }]}>:</Text>
              <View style={styles.timeInputGroup}>
                <Text style={[styles.timeLabel, { color: theme.colors.textMed }]}>Minute (0-59)</Text>
                <TextInput
                  style={[styles.timeInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.textHigh }]}
                  value={tempMinute}
                  onChangeText={setTempMinute}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholder="00"
                  placeholderTextColor={theme.colors.textLow}
                />
              </View>
            </View>
            <Text style={[styles.timePreview, { color: theme.colors.primary }]}>
              {formatTime(parseInt(tempHour || '20', 10), parseInt(tempMinute || '0', 10))}
            </Text>
            <View style={styles.modalButtons}>
              <Pressable style={[styles.modalButton, { backgroundColor: theme.colors.surface }]} onPress={() => setShowReminderTimeModal(false)}>
                <Text style={[styles.modalButtonText, { color: theme.colors.textHigh }]}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.modalButton, { backgroundColor: theme.colors.primary }]} onPress={handleSaveReminderTime}>
                <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]}>Set Time</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      {!!legalOpen && (
        <LegalModal visible={true} onClose={() => setLegalOpen(null)} type={legalOpen} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  content: { padding: s.lg, paddingBottom: s.xl * 2 },
  header: { marginBottom: s.lg },
  title: { fontSize: 32, fontWeight: '700' },
  premiumBanner: { 
    marginBottom: s.xl, 
    borderRadius: r.xl, 
    overflow: 'hidden',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  premiumGradient: { 
    padding: s.xl,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  premiumHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: s.lg,
    gap: s.md,
  },
  premiumLogoContainer: { 
    width: 72, 
    height: 72,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center', 
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  premiumLogo: { 
    width: 56, 
    height: 56,
  },
  premiumHeaderText: { 
    flex: 1,
  },
  premiumTitle: { 
    fontSize: 24, 
    fontWeight: '800', 
    color: '#FFFFFF', 
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  premiumSubtitle: { 
    fontSize: 14, 
    fontWeight: '500', 
    color: 'rgba(255, 255, 255, 0.7)',
  },
  premiumFeatures: {
    gap: s.sm,
    marginBottom: s.lg,
  },
  premiumFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.md,
  },
  premiumFeatureIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  premiumFeatureText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  premiumCTA: {
    gap: s.sm,
  },
  premiumCTAButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: s.md + 2,
    paddingHorizontal: s.lg,
    borderRadius: r.md,
    gap: s.sm,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  premiumCTAText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#7C3AED',
  },
  premiumCancelText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
  },
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
  premiumActiveBanner: { marginBottom: s.xl, borderRadius: r.xl, borderWidth: 2, padding: s.lg },
  premiumActiveHeader: { flexDirection: 'row', alignItems: 'center', gap: s.md, marginBottom: s.md },
  premiumActiveIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  premiumActiveContent: { flexDirection: 'row', alignItems: 'center', gap: s.md },
  premiumActiveText: { flex: 1 },
  premiumActiveTitle: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  premiumActiveSubtitle: { fontSize: 14, fontWeight: '500' },
  premiumCheckBadge: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  premiumFeaturesList: { gap: s.xs },
  premiumFeatureItem: { flexDirection: 'row', alignItems: 'center', gap: s.sm },
  usageBanner: { marginBottom: s.xl, borderRadius: r.lg, padding: s.lg },
  usageTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: s.md },
  usageRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: s.sm },
  usageLabel: { fontSize: 15, fontWeight: '600' },
  usageValue: { fontSize: 14, fontWeight: '500' },
  switchContainer: {
    width: 51,
    height: 31,
    borderRadius: 16,
    padding: 2,
    justifyContent: 'center',
  },
  switchThumb: {
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 3,
  },
  timeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s.md,
    marginVertical: s.lg,
  },
  timeInputGroup: {
    alignItems: 'center',
    gap: s.xs,
  },
  timeLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  timeInput: {
    width: 70,
    height: 60,
    borderWidth: 2,
    borderRadius: r.md,
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
  },
  timeColon: {
    fontSize: 40,
    fontWeight: '700',
    marginTop: s.lg,
  },
  timePreview: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: s.md,
  },
});
