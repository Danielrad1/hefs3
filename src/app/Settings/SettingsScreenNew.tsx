import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Switch, Linking, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme } from '../../design/theme';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';
import { db } from '../../services/anki/InMemoryDb';
import { PersistenceService } from '../../services/anki/PersistenceService';
import { useScheduler } from '../../context/SchedulerProvider';
import { AccountSection } from './components/AccountSection';
import { BackupSection } from './components/BackupSection';
import { DeveloperSection } from './components/DeveloperSection';

type ColorScheme = 'sunset' | 'ocean' | 'forest' | 'neon' | 'royal' | 'moss' | 'midnight' | 'cherry' | 'mint' | 'coral' | 'lavender' | 'amber' | 'sky' | 'berry' | 'earth' | 'aurora' | 'monoPurple' | 'monoBlue' | 'monoGreen' | 'monoRed' | 'monoOrange' | 'monoPink' | 'monoTeal' | 'monoIndigo' | 'monoRose' | 'monoEmerald' | 'monoViolet' | 'monoSky' | 'monoAmber' | 'monoLime' | 'monoCyan' | 'monoFuchsia' | 'monoSlate' | 'monoStone' | 'monoNeutral' | 'monoZinc';

interface ThemeColorOption {
  id: ColorScheme;
  name: string;
  description: string;
  colors: [string, string, string];
  gradient: [string, string];
  icon: keyof typeof Ionicons.glyphMap;
}

const popularThemes: ThemeColorOption[] = [
  {
    id: 'sunset',
    name: 'Sunset',
    description: 'Purple, Amber & Rose',
    colors: ['#8B5CF6', '#F59E0B', '#FB7185'],
    gradient: ['#6366F1', '#8B5CF6'],
    icon: 'partly-sunny',
  },
  {
    id: 'ocean',
    name: 'Ocean',
    description: 'Indigo, Cyan & Teal',
    colors: ['#6366F1', '#06B6D4', '#14B8A6'],
    gradient: ['#3B82F6', '#6366F1'],
    icon: 'water',
  },
  {
    id: 'forest',
    name: 'Forest',
    description: 'Purple, Emerald & Lime',
    colors: ['#8B5CF6', '#10B981', '#84CC16'],
    gradient: ['#10B981', '#8B5CF6'],
    icon: 'leaf',
  },
  {
    id: 'neon',
    name: 'Neon',
    description: 'Bright Purple, Cyan & Fuchsia',
    colors: ['#A855F7', '#22D3EE', '#F0ABFC'],
    gradient: ['#EC4899', '#A855F7'],
    icon: 'flash',
  },
  {
    id: 'royal',
    name: 'Royal',
    description: 'Deep Purple, Gold & Indigo',
    colors: ['#7C3AED', '#F59E0B', '#4F46E5'],
    gradient: ['#4F46E5', '#7C3AED'],
    icon: 'diamond',
  },
];

const moreThemes: ThemeColorOption[] = [
  {
    id: 'aurora',
    name: 'Aurora',
    description: 'Purple, Pink & Green',
    colors: ['#8B5CF6', '#EC4899', '#10B981'],
    gradient: ['#EC4899', '#8B5CF6'],
    icon: 'sparkles',
  },
  {
    id: 'moss',
    name: 'Moss',
    description: 'Purple, Dark Green & Lime',
    colors: ['#8B5CF6', '#059669', '#84CC16'],
    gradient: ['#059669', '#8B5CF6'],
    icon: 'leaf',
  },
  {
    id: 'midnight',
    name: 'Midnight',
    description: 'Navy, Purple & Silver',
    colors: ['#1E40AF', '#8B5CF6', '#94A3B8'],
    gradient: ['#3B82F6', '#1E40AF'],
    icon: 'moon',
  },
  {
    id: 'cherry',
    name: 'Cherry',
    description: 'Red, Orange & Pink',
    colors: ['#DC2626', '#F97316', '#FB923C'],
    gradient: ['#F97316', '#DC2626'],
    icon: 'heart',
  },
  {
    id: 'mint',
    name: 'Mint',
    description: 'Teal, Emerald & Cyan',
    colors: ['#14B8A6', '#10B981', '#06B6D4'],
    gradient: ['#2DD4BF', '#14B8A6'],
    icon: 'fitness',
  },
  {
    id: 'coral',
    name: 'Coral',
    description: 'Orange, Yellow & Warm',
    colors: ['#F97316', '#FDE047', '#FB923C'],
    gradient: ['#FDE047', '#F97316'],
    icon: 'sunny',
  },
  {
    id: 'lavender',
    name: 'Lavender',
    description: 'Light Purple, Pink & Sky',
    colors: ['#C084FC', '#F0ABFC', '#93C5FD'],
    gradient: ['#F0ABFC', '#C084FC'],
    icon: 'flower',
  },
  {
    id: 'amber',
    name: 'Amber',
    description: 'Gold, Red & Orange',
    colors: ['#F59E0B', '#EF4444', '#FB923C'],
    gradient: ['#FCD34D', '#F59E0B'],
    icon: 'flame',
  },
  {
    id: 'sky',
    name: 'Sky',
    description: 'Light Blue, Cyan & Azure',
    colors: ['#0EA5E9', '#22D3EE', '#60A5FA'],
    gradient: ['#7DD3FC', '#0EA5E9'],
    icon: 'airplane',
  },
  {
    id: 'berry',
    name: 'Berry',
    description: 'Bright Purple, Blue & Pink',
    colors: ['#A855F7', '#3B82F6', '#F0ABFC'],
    gradient: ['#D946EF', '#A855F7'],
    icon: 'nutrition',
  },
  {
    id: 'earth',
    name: 'Earth',
    description: 'Brown, Green & Orange',
    colors: ['#92400E', '#16A34A', '#FB923C'],
    gradient: ['#F97316', '#92400E'],
    icon: 'planet',
  },
];

const monochromeThemes: ThemeColorOption[] = [
  {
    id: 'monoPurple',
    name: 'Mono Purple',
    description: 'Pure Purple Shades',
    colors: ['#9333EA', '#A855F7', '#C4B5FD'],
    gradient: ['#C084FC', '#9333EA'],
    icon: 'color-palette',
  },
  {
    id: 'monoBlue',
    name: 'Mono Blue',
    description: 'Pure Blue Shades',
    colors: ['#2563EB', '#3B82F6', '#93C5FD'],
    gradient: ['#60A5FA', '#2563EB'],
    icon: 'water',
  },
  {
    id: 'monoGreen',
    name: 'Mono Green',
    description: 'Pure Green Shades',
    colors: ['#16A34A', '#22C55E', '#86EFAC'],
    gradient: ['#4ADE80', '#16A34A'],
    icon: 'leaf',
  },
  {
    id: 'monoRed',
    name: 'Mono Red',
    description: 'Pure Red Shades',
    colors: ['#DC2626', '#EF4444', '#FCA5A5'],
    gradient: ['#F87171', '#DC2626'],
    icon: 'flame',
  },
  {
    id: 'monoOrange',
    name: 'Mono Orange',
    description: 'Pure Orange Shades',
    colors: ['#EA580C', '#F97316', '#FDBA74'],
    gradient: ['#FB923C', '#EA580C'],
    icon: 'sunny',
  },
  {
    id: 'monoPink',
    name: 'Mono Pink',
    description: 'Pure Pink Shades',
    colors: ['#DB2777', '#EC4899', '#F9A8D4'],
    gradient: ['#F472B6', '#DB2777'],
    icon: 'heart',
  },
  {
    id: 'monoTeal',
    name: 'Mono Teal',
    description: 'Pure Teal Shades',
    colors: ['#0D9488', '#14B8A6', '#99F6E4'],
    gradient: ['#5EEAD4', '#0D9488'],
    icon: 'fitness',
  },
  {
    id: 'monoIndigo',
    name: 'Mono Indigo',
    description: 'Pure Indigo Shades',
    colors: ['#4F46E5', '#6366F1', '#A5B4FC'],
    gradient: ['#818CF8', '#4F46E5'],
    icon: 'moon',
  },
  {
    id: 'monoRose',
    name: 'Mono Rose',
    description: 'Pure Rose Shades',
    colors: ['#E11D48', '#F43F5E', '#FDA4AF'],
    gradient: ['#FB7185', '#E11D48'],
    icon: 'rose',
  },
  {
    id: 'monoEmerald',
    name: 'Mono Emerald',
    description: 'Pure Emerald Shades',
    colors: ['#059669', '#10B981', '#A7F3D0'],
    gradient: ['#6EE7B7', '#059669'],
    icon: 'diamond',
  },
  {
    id: 'monoViolet',
    name: 'Mono Violet',
    description: 'Pure Violet Shades',
    colors: ['#7C3AED', '#8B5CF6', '#C4B5FD'],
    gradient: ['#A78BFA', '#7C3AED'],
    icon: 'flower',
  },
  {
    id: 'monoSky',
    name: 'Mono Sky',
    description: 'Pure Sky Shades',
    colors: ['#0284C7', '#0EA5E9', '#BAE6FD'],
    gradient: ['#7DD3FC', '#0284C7'],
    icon: 'airplane',
  },
  {
    id: 'monoAmber',
    name: 'Mono Amber',
    description: 'Pure Amber Shades',
    colors: ['#D97706', '#F59E0B', '#FDE68A'],
    gradient: ['#FCD34D', '#D97706'],
    icon: 'star',
  },
  {
    id: 'monoLime',
    name: 'Mono Lime',
    description: 'Pure Lime Shades',
    colors: ['#65A30D', '#84CC16', '#D9F99D'],
    gradient: ['#BEF264', '#65A30D'],
    icon: 'nutrition',
  },
  {
    id: 'monoCyan',
    name: 'Mono Cyan',
    description: 'Pure Cyan Shades',
    colors: ['#0891B2', '#06B6D4', '#A5F3FC'],
    gradient: ['#67E8F9', '#0891B2'],
    icon: 'water',
  },
  {
    id: 'monoFuchsia',
    name: 'Mono Fuchsia',
    description: 'Pure Fuchsia Shades',
    colors: ['#C026D3', '#D946EF', '#F5D0FE'],
    gradient: ['#F0ABFC', '#C026D3'],
    icon: 'sparkles',
  },
  {
    id: 'monoSlate',
    name: 'Mono Slate',
    description: 'Pure Slate Shades',
    colors: ['#475569', '#64748B', '#CBD5E1'],
    gradient: ['#94A3B8', '#475569'],
    icon: 'contrast',
  },
  {
    id: 'monoStone',
    name: 'Mono Stone',
    description: 'Pure Stone Shades',
    colors: ['#57534E', '#78716C', '#D6D3D1'],
    gradient: ['#A8A29E', '#57534E'],
    icon: 'cube',
  },
  {
    id: 'monoNeutral',
    name: 'Mono Neutral',
    description: 'Pure Neutral Shades',
    colors: ['#525252', '#737373', '#D4D4D4'],
    gradient: ['#A3A3A3', '#525252'],
    icon: 'ellipse',
  },
  {
    id: 'monoZinc',
    name: 'Mono Zinc',
    description: 'Pure Zinc Shades',
    colors: ['#52525B', '#71717A', '#D4D4D8'],
    gradient: ['#A1A1AA', '#52525B'],
    icon: 'square',
  },
];

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
      style={[styles.settingItem, { backgroundColor: theme.colors.surface2 }]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={[styles.iconContainer, { backgroundColor: iconBg || theme.colors.primary }]}>
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>
      
      <View style={styles.settingContent}>
        <Text style={[styles.settingTitle, { color: theme.colors.textHigh }]}>
          {title}
        </Text>
        {subtitle && (
          <Text style={[styles.settingSubtitle, { color: theme.colors.textMed }]}>
            {subtitle}
          </Text>
        )}
      </View>

      {rightElement || (showChevron && onPress && (
        <Ionicons name="chevron-forward" size={20} color={theme.colors.textLow} />
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
    <Text style={[styles.sectionHeader, { color: theme.colors.textMed }]}>
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
          <Text style={[styles.title, { color: theme.colors.textHigh }]}>
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
                trackColor={{ false: theme.colors.border, true: theme.colors.overlay.primary }}
                thumbColor={notificationsEnabled ? theme.colors.primary : theme.colors.textLow}
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
                trackColor={{ false: theme.colors.border, true: theme.colors.overlay.primary }}
                thumbColor={dailyReminder ? theme.colors.primary : theme.colors.textLow}
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

        <SectionHeader title="POPULAR THEMES" />
        <View style={[styles.colorSchemeSection, { backgroundColor: theme.colors.surface2 }]}>
          <Text style={[styles.colorSchemeTitle, { color: theme.colors.textHigh }]}>
            Choose Your 3-Color Palette
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.colorSchemeScroll}
          >
            {popularThemes.map((option) => {
              const isSelected = theme.colorScheme === option.id;
              return (
                <Pressable
                  key={option.id}
                  style={[
                    styles.colorSchemeCard,
                    isSelected && styles.colorSchemeCardSelected,
                    {
                      borderColor: isSelected ? option.colors[0] : theme.colors.border,
                      backgroundColor: theme.colors.surface2,
                    },
                  ]}
                  onPress={() => theme.setColorScheme(option.id)}
                >
                  <LinearGradient
                    colors={option.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.colorGradient}
                  >
                    <View style={styles.colorIconContainer}>
                      <Ionicons name={option.icon} size={28} color="#FFFFFF" />
                    </View>
                  </LinearGradient>
                  <View style={styles.colorSwatches}>
                    {option.colors.map((color, idx) => (
                      <View key={idx} style={[styles.colorSwatch, { backgroundColor: color }]} />
                    ))}
                  </View>
                  <View style={styles.colorSchemeInfo}>
                    <View style={styles.colorSchemeNameRow}>
                      <Text style={[styles.colorSchemeName, { color: theme.colors.textHigh }]}>
                        {option.name}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={16} color={option.colors[0]} />
                      )}
                    </View>
                    <Text style={[styles.colorSchemeDesc, { color: theme.colors.textMed }]}>
                      {option.description}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <SectionHeader title="MORE THEMES" />
        <View style={[styles.colorSchemeSection, { backgroundColor: theme.colors.surface2 }]}>
          <Text style={[styles.colorSchemeTitle, { color: theme.colors.textHigh }]}>
            Explore More Creative Palettes
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.colorSchemeScroll}
          >
            {moreThemes.map((option) => {
              const isSelected = theme.colorScheme === option.id;
              return (
                <Pressable
                  key={option.id}
                  style={[
                    styles.colorSchemeCard,
                    isSelected && styles.colorSchemeCardSelected,
                    {
                      borderColor: isSelected ? option.colors[0] : theme.colors.border,
                      backgroundColor: theme.colors.surface2,
                    },
                  ]}
                  onPress={() => theme.setColorScheme(option.id)}
                >
                  <LinearGradient
                    colors={option.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.colorGradient}
                  >
                    <View style={styles.colorIconContainer}>
                      <Ionicons name={option.icon} size={28} color="#FFFFFF" />
                    </View>
                  </LinearGradient>
                  <View style={styles.colorSwatches}>
                    {option.colors.map((color, idx) => (
                      <View key={idx} style={[styles.colorSwatch, { backgroundColor: color }]} />
                    ))}
                  </View>
                  <View style={styles.colorSchemeInfo}>
                    <View style={styles.colorSchemeNameRow}>
                      <Text style={[styles.colorSchemeName, { color: theme.colors.textHigh }]}>
                        {option.name}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={16} color={option.colors[0]} />
                      )}
                    </View>
                    <Text style={[styles.colorSchemeDesc, { color: theme.colors.textMed }]}>
                      {option.description}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <SectionHeader title="MONOCHROME THEMES" />
        <View style={[styles.colorSchemeSection, { backgroundColor: theme.colors.surface2 }]}>
          <Text style={[styles.colorSchemeTitle, { color: theme.colors.textHigh }]}>
            Single-Color Focused Palettes
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.colorSchemeScroll}
          >
            {monochromeThemes.map((option) => {
              const isSelected = theme.colorScheme === option.id;
              return (
                <Pressable
                  key={option.id}
                  style={[
                    styles.colorSchemeCard,
                    isSelected && styles.colorSchemeCardSelected,
                    {
                      borderColor: isSelected ? option.colors[0] : theme.colors.border,
                      backgroundColor: theme.colors.surface2,
                    },
                  ]}
                  onPress={() => theme.setColorScheme(option.id)}
                >
                  <LinearGradient
                    colors={option.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.colorGradient}
                  >
                    <View style={styles.colorIconContainer}>
                      <Ionicons name={option.icon} size={28} color="#FFFFFF" />
                    </View>
                  </LinearGradient>
                  <View style={styles.colorSwatches}>
                    {option.colors.map((color, idx) => (
                      <View key={idx} style={[styles.colorSwatch, { backgroundColor: color }]} />
                    ))}
                  </View>
                  <View style={styles.colorSchemeInfo}>
                    <View style={styles.colorSchemeNameRow}>
                      <Text style={[styles.colorSchemeName, { color: theme.colors.textHigh }]}>
                        {option.name}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={16} color={option.colors[0]} />
                      )}
                    </View>
                    <Text style={[styles.colorSchemeDesc, { color: theme.colors.textMed }]}>
                      {option.description}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <SectionHeader title="DEVELOPER TOOLS" />
        <DeveloperSection />

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

        <Text style={[styles.version, { color: theme.colors.textLow }]}>
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
            style={[styles.modalContent, { backgroundColor: theme.colors.surface2 }]}
            onStartShouldSetResponder={() => true}
          >
            <Text style={[styles.modalTitle, { color: theme.colors.textHigh }]}>
              Choose Theme
            </Text>
            
            {themeOptions.map((option) => (
              <Pressable
                key={option.value}
                style={[
                  styles.themeOption,
                  {
                    backgroundColor: theme.themePreference === option.value 
                      ? theme.colors.overlay.primary
                      : 'transparent',
                    borderColor: theme.themePreference === option.value
                      ? theme.colors.primary
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
                  color={theme.themePreference === option.value ? theme.colors.primary : theme.colors.textMed} 
                />
                <Text style={[
                  styles.themeOptionText,
                  { 
                    color: theme.themePreference === option.value 
                      ? theme.colors.primary
                      : theme.colors.textHigh 
                  }
                ]}>
                  {option.label}
                </Text>
                {theme.themePreference === option.value && (
                  <Ionicons name="checkmark-circle" size={24} color={theme.colors.primary} />
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
  // Color scheme styles
  colorSchemeSection: {
    padding: s.xl,
    borderRadius: r.xl,
    marginBottom: s.lg,
  },
  colorSchemeTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: s.lg,
  },
  colorSchemeScroll: {
    gap: s.lg,
  },
  colorSchemeCard: {
    width: 150,
    borderRadius: r.lg,
    borderWidth: 2,
    overflow: 'hidden',
  },
  colorSchemeCardSelected: {
    borderWidth: 3,
  },
  colorGradient: {
    height: 90,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorSwatches: {
    flexDirection: 'row',
    height: 28,
  },
  colorSwatch: {
    flex: 1,
  },
  colorSchemeInfo: {
    padding: s.md,
    gap: 4,
  },
  colorSchemeNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.xs,
  },
  colorSchemeName: {
    fontSize: 15,
    fontWeight: '700',
  },
  colorSchemeDesc: {
    fontSize: 11,
    fontWeight: '500',
  },
});
