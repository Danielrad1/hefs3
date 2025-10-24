import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTheme, useThemeActions } from '../../../design/theme';
import { s } from '../../../design/spacing';
import { r } from '../../../design/radii';
import PrimaryButton from '../../../components/PrimaryButton';

interface ThemeStepProps {
  onNext: (data: { themeMode: 'system' | 'light' | 'dark'; colorScheme: string }) => void;
  onBack?: () => void;
}

type ThemeMode = 'system' | 'light' | 'dark';

const THEME_OPTIONS = [
  { mode: 'light' as ThemeMode, label: 'Light', icon: 'sunny' },
  { mode: 'dark' as ThemeMode, label: 'Dark', icon: 'moon' },
  { mode: 'system' as ThemeMode, label: 'Auto', icon: 'phone-portrait' },
];

const COLOR_SCHEMES = [
  { id: 'sunset', name: 'Sunset', colors: ['#8B5CF6', '#F59E0B', '#FB7185'], gradient: ['#6366F1', '#8B5CF6'] as const, icon: 'partly-sunny' as const },
  { id: 'ocean', name: 'Ocean', colors: ['#6366F1', '#06B6D4', '#14B8A6'], gradient: ['#3B82F6', '#6366F1'] as const, icon: 'water' as const },
  { id: 'forest', name: 'Forest', colors: ['#8B5CF6', '#10B981', '#84CC16'], gradient: ['#10B981', '#8B5CF6'] as const, icon: 'leaf' as const },
  { id: 'neon', name: 'Neon', colors: ['#A855F7', '#22D3EE', '#F0ABFC'], gradient: ['#EC4899', '#A855F7'] as const, icon: 'flash' as const },
  { id: 'royal', name: 'Royal', colors: ['#7C3AED', '#F59E0B', '#4F46E5'], gradient: ['#4F46E5', '#7C3AED'] as const, icon: 'diamond' as const },
];

export default function ThemeStep({ onNext, onBack }: ThemeStepProps) {
  const theme = useTheme();
  const { setThemePreference, setColorScheme } = useThemeActions();
  const [selectedMode, setSelectedMode] = useState<ThemeMode>('dark');
  const [selectedScheme, setSelectedScheme] = useState('sunset');

  // Apply default theme on mount
  useEffect(() => {
    setThemePreference('dark');
    setColorScheme('sunset');
  }, []);

  const handleModeSelect = (mode: ThemeMode) => {
    setSelectedMode(mode);
    setThemePreference(mode);
    Haptics.selectionAsync();
  };

  const handleSchemeSelect = (scheme: string) => {
    setSelectedScheme(scheme);
    setColorScheme(scheme as any);
    Haptics.selectionAsync();
  };

  const handleContinue = () => {
    onNext({ themeMode: selectedMode, colorScheme: selectedScheme });
  };

  return (
    <View style={styles.container}>
      {onBack && (
        <Pressable onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </Pressable>
      )}

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
            Choose Your Theme
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Personalize your learning environment
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Appearance</Text>
          <View style={styles.modeOptions}>
            {THEME_OPTIONS.map((option) => (
              <Pressable
                key={option.mode}
                style={[
                  styles.modeCard,
                  {
                    backgroundColor: selectedMode === option.mode ? theme.colors.accent + '15' : theme.colors.surface,
                    borderColor: selectedMode === option.mode ? theme.colors.accent : theme.colors.border,
                  },
                ]}
                onPress={() => handleModeSelect(option.mode)}
              >
                <Ionicons name={option.icon as any} size={28} color={selectedMode === option.mode ? theme.colors.accent : theme.colors.textSecondary} />
                <Text style={[styles.modeLabel, { color: selectedMode === option.mode ? theme.colors.accent : theme.colors.textPrimary }]}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Color Palette</Text>
          <View style={styles.colorScroll}>
            {COLOR_SCHEMES.map((scheme) => {
              const isSelected = selectedScheme === scheme.id;
              return (
                <Pressable
                  key={scheme.id}
                  style={[styles.colorCard, { borderColor: isSelected ? scheme.colors[0] : theme.colors.border, backgroundColor: theme.colors.surface }]}
                  onPress={() => handleSchemeSelect(scheme.id)}
                >
                  <LinearGradient colors={scheme.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.colorGradient}>
                    <Ionicons name={scheme.icon} size={32} color="#FFFFFF" />
                  </LinearGradient>
                  <View style={styles.colorSwatches}>
                    {scheme.colors.map((color, idx) => (
                      <View key={idx} style={[styles.colorSwatch, { backgroundColor: color }]} />
                    ))}
                  </View>
                  <View style={styles.colorInfo}>
                    <Text style={[styles.colorName, { color: theme.colors.textPrimary }]}>{scheme.name}</Text>
                    {isSelected && <Ionicons name="checkmark-circle" size={16} color={scheme.colors[0]} />}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: theme.colors.bg, borderTopColor: theme.colors.border }]}>
        <PrimaryButton title="Continue →" onPress={handleContinue} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backButton: { padding: s.md, paddingLeft: s.lg },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: s.xl, paddingBottom: s.xl },
  header: { paddingTop: s.md, paddingBottom: s.xl, gap: s.sm },
  title: { fontSize: 32, fontWeight: '800' },
  subtitle: { fontSize: 17, lineHeight: 24 },
  section: { marginBottom: s.xl, gap: s.md },
  sectionTitle: { fontSize: 18, fontWeight: '600' },
  modeOptions: { flexDirection: 'row', gap: s.md },
  modeCard: { flex: 1, alignItems: 'center', padding: s.lg, borderRadius: r.lg, borderWidth: 2, gap: s.sm },
  modeLabel: { fontSize: 16, fontWeight: '700' },
  colorScroll: { flexDirection: 'row', gap: s.md, flexWrap: 'wrap' },
  colorCard: { width: 140, borderRadius: r.lg, borderWidth: 2, overflow: 'hidden' },
  colorGradient: { height: 80, justifyContent: 'center', alignItems: 'center' },
  colorSwatches: { flexDirection: 'row', height: 32 },
  colorSwatch: { flex: 1 },
  colorInfo: { padding: s.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  colorName: { fontSize: 15, fontWeight: '700' },
  footer: { paddingHorizontal: s.xl, paddingVertical: s.lg, paddingBottom: s.xl, borderTopWidth: 1 },
});
