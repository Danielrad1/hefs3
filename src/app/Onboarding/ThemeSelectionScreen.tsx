import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTheme, useThemeActions } from '../../design/theme';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';
import PrimaryButton from '../../components/PrimaryButton';

interface ThemeSelectionScreenProps {
  onContinue: (themeMode: 'system' | 'light' | 'dark', colorScheme: string) => void;
  onBack: () => void;
}

type ThemeMode = 'system' | 'light' | 'dark';
type ColorScheme = 'sunset' | 'ocean' | 'forest' | 'neon' | 'royal';

const THEME_OPTIONS = [
  { mode: 'light' as ThemeMode, label: 'Light', icon: 'sunny', description: 'Bright & clean' },
  { mode: 'dark' as ThemeMode, label: 'Dark', icon: 'moon', description: 'Easy on the eyes' },
  { mode: 'system' as ThemeMode, label: 'Auto', icon: 'phone-portrait', description: 'Match device' },
];

interface ColorSchemeOption {
  id: ColorScheme;
  name: string;
  description: string;
  colors: [string, string, string];
  gradient: [string, string];
  icon: keyof typeof Ionicons.glyphMap;
}

const COLOR_SCHEMES: ColorSchemeOption[] = [
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

export default function ThemeSelectionScreen({ onContinue, onBack }: ThemeSelectionScreenProps) {
  const theme = useTheme();
  const { setThemePreference, setColorScheme } = useThemeActions();
  const [selectedMode, setSelectedMode] = useState<ThemeMode>('dark');
  const [selectedColorScheme, setSelectedColorScheme] = useState<ColorScheme>('sunset');

  const handleModeSelect = (mode: ThemeMode) => {
    setSelectedMode(mode);
    setThemePreference(mode); // Preview the theme
    Haptics.selectionAsync();
  };

  const handleColorSchemeSelect = (scheme: ColorScheme) => {
    setSelectedColorScheme(scheme);
    setColorScheme(scheme); // Preview the colors
    Haptics.selectionAsync();
  };

  const handleContinue = () => {
    onContinue(selectedMode, selectedColorScheme);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={onBack} style={{ padding: s.sm }}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </Pressable>
        <Text style={[styles.stepText, { color: theme.colors.textTertiary }]}>
          Step 3 of 4
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
            Personalize your learning environment
          </Text>
        </View>

        {/* Theme Mode Selection */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
            Appearance
          </Text>
          <View style={styles.modeOptions}>
            {THEME_OPTIONS.map((option) => (
              <Pressable
                key={option.mode}
                style={({ pressed }) => [
                  styles.modeCard,
                  {
                    backgroundColor: selectedMode === option.mode ? theme.colors.accent + '15' : theme.colors.surface,
                    borderColor: selectedMode === option.mode ? theme.colors.accent : theme.colors.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
                onPress={() => handleModeSelect(option.mode)}
              >
                <Ionicons 
                  name={option.icon as any} 
                  size={28} 
                  color={selectedMode === option.mode ? theme.colors.accent : theme.colors.textSecondary} 
                />
                <Text style={[
                  styles.modeLabel,
                  { color: selectedMode === option.mode ? theme.colors.accent : theme.colors.textPrimary }
                ]}>
                  {option.label}
                </Text>
                <Text style={[styles.modeDescription, { color: theme.colors.textSecondary }]}>
                  {option.description}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Color Scheme Selection */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
            Color Palette
          </Text>
          <ScrollView 
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.colorSchemeScroll}
          >
            {COLOR_SCHEMES.map((scheme) => {
              const isSelected = selectedColorScheme === scheme.id;
              return (
                <Pressable
                  key={scheme.id}
                  style={[
                    styles.colorSchemeCard,
                    {
                      borderColor: isSelected ? scheme.colors[0] : theme.colors.border,
                      backgroundColor: theme.colors.surface,
                    },
                  ]}
                  onPress={() => handleColorSchemeSelect(scheme.id)}
                >
                  <LinearGradient
                    colors={scheme.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.colorGradient}
                  >
                    <Ionicons name={scheme.icon} size={32} color="#FFFFFF" />
                  </LinearGradient>
                  <View style={styles.colorSwatches}>
                    {scheme.colors.map((color, idx) => (
                      <View key={idx} style={[styles.colorSwatch, { backgroundColor: color }]} />
                    ))}
                  </View>
                  <View style={styles.colorSchemeInfo}>
                    <View style={styles.colorSchemeNameRow}>
                      <Text style={[styles.colorSchemeName, { color: theme.colors.textPrimary }]}>
                        {scheme.name}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={16} color={scheme.colors[0]} />
                      )}
                    </View>
                    <Text style={[styles.colorSchemeDesc, { color: theme.colors.textSecondary }]}>
                      {scheme.description}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>

      {/* Fixed Bottom Button */}
      <View style={[styles.footer, { backgroundColor: theme.colors.bg, borderTopColor: theme.colors.border }]}>
        <PrimaryButton
          title="Continue →"
          onPress={handleContinue}
        />
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
    paddingHorizontal: s.xl,
    paddingBottom: s.xl,
    justifyContent: 'space-between',
  },
  titleSection: {
    alignItems: 'center',
    paddingTop: s.xl,
    gap: s.md,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: r.xl,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: s.sm,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  section: {
    gap: s.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modeOptions: {
    flexDirection: 'row',
    gap: s.md,
  },
  modeCard: {
    flex: 1,
    alignItems: 'center',
    padding: s.lg,
    borderRadius: r.lg,
    borderWidth: 2,
    gap: s.sm,
  },
  modeLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  modeDescription: {
    fontSize: 12,
    textAlign: 'center',
  },
  colorSchemeScroll: {
    paddingRight: s.xl,
    gap: s.md,
  },
  colorSchemeCard: {
    width: 140,
    borderRadius: r.lg,
    borderWidth: 2,
    overflow: 'hidden',
  },
  colorGradient: {
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorSwatches: {
    flexDirection: 'row',
    height: 32,
  },
  colorSwatch: {
    flex: 1,
  },
  colorSchemeInfo: {
    padding: s.md,
    gap: s.xs,
  },
  colorSchemeNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  colorSchemeName: {
    fontSize: 15,
    fontWeight: '700',
  },
  colorSchemeDesc: {
    fontSize: 11,
    lineHeight: 14,
  },
  footer: {
    paddingHorizontal: s.xl,
    paddingVertical: s.lg,
    paddingBottom: s.xl,
    borderTopWidth: 1,
  },
});
