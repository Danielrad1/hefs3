import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../design/theme';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';
import * as Haptics from 'expo-haptics';

type ColorScheme = 'sunset' | 'ocean' | 'forest' | 'neon' | 'royal' | 'moss' | 'midnight' | 'cherry' | 'mint' | 'coral' | 'lavender' | 'amber' | 'sky' | 'berry' | 'earth' | 'aurora' | 'monoPurple' | 'monoBlue' | 'monoGreen' | 'monoRed' | 'monoOrange' | 'monoPink' | 'monoTeal' | 'monoIndigo' | 'monoRose' | 'monoEmerald' | 'monoViolet' | 'monoSky' | 'monoAmber' | 'monoLime' | 'monoCyan' | 'monoFuchsia' | 'monoSlate' | 'monoStone' | 'monoNeutral' | 'monoZinc';

interface ThemeColorOption {
  id: ColorScheme;
  name: string;
  description: string;
  colors: [string, string, string];
  gradient: [string, string];
  icon: keyof typeof Ionicons.glyphMap;
}

const allThemes: { category: string; themes: ThemeColorOption[] }[] = [
  {
    category: 'Popular Themes',
    themes: [
      { id: 'sunset', name: 'Sunset', description: 'Purple, Amber & Rose', colors: ['#8B5CF6', '#F59E0B', '#FB7185'], gradient: ['#6366F1', '#8B5CF6'], icon: 'partly-sunny' },
      { id: 'ocean', name: 'Ocean', description: 'Indigo, Cyan & Teal', colors: ['#6366F1', '#06B6D4', '#14B8A6'], gradient: ['#3B82F6', '#6366F1'], icon: 'water' },
      { id: 'forest', name: 'Forest', description: 'Purple, Emerald & Lime', colors: ['#8B5CF6', '#10B981', '#84CC16'], gradient: ['#10B981', '#8B5CF6'], icon: 'leaf' },
      { id: 'neon', name: 'Neon', description: 'Bright Purple, Cyan & Fuchsia', colors: ['#A855F7', '#22D3EE', '#F0ABFC'], gradient: ['#EC4899', '#A855F7'], icon: 'flash' },
      { id: 'royal', name: 'Royal', description: 'Deep Purple, Gold & Indigo', colors: ['#7C3AED', '#F59E0B', '#4F46E5'], gradient: ['#4F46E5', '#7C3AED'], icon: 'diamond' },
    ],
  },
  {
    category: 'Vibrant Themes',
    themes: [
      { id: 'aurora', name: 'Aurora', description: 'Purple, Pink & Green', colors: ['#8B5CF6', '#EC4899', '#10B981'], gradient: ['#EC4899', '#8B5CF6'], icon: 'sparkles' },
      { id: 'cherry', name: 'Cherry', description: 'Red, Orange & Pink', colors: ['#DC2626', '#F97316', '#FB923C'], gradient: ['#F97316', '#DC2626'], icon: 'heart' },
      { id: 'coral', name: 'Coral', description: 'Orange, Yellow & Warm', colors: ['#F97316', '#FDE047', '#FB923C'], gradient: ['#FDE047', '#F97316'], icon: 'sunny' },
      { id: 'berry', name: 'Berry', description: 'Bright Purple, Blue & Pink', colors: ['#A855F7', '#3B82F6', '#F0ABFC'], gradient: ['#D946EF', '#A855F7'], icon: 'nutrition' },
      { id: 'amber', name: 'Amber', description: 'Gold, Red & Orange', colors: ['#F59E0B', '#EF4444', '#FB923C'], gradient: ['#FCD34D', '#F59E0B'], icon: 'flame' },
    ],
  },
  {
    category: 'Natural Themes',
    themes: [
      { id: 'moss', name: 'Moss', description: 'Purple, Dark Green & Lime', colors: ['#8B5CF6', '#059669', '#84CC16'], gradient: ['#059669', '#8B5CF6'], icon: 'leaf' },
      { id: 'mint', name: 'Mint', description: 'Teal, Emerald & Cyan', colors: ['#14B8A6', '#10B981', '#06B6D4'], gradient: ['#2DD4BF', '#14B8A6'], icon: 'fitness' },
      { id: 'earth', name: 'Earth', description: 'Brown, Green & Orange', colors: ['#92400E', '#16A34A', '#FB923C'], gradient: ['#F97316', '#92400E'], icon: 'planet' },
      { id: 'lavender', name: 'Lavender', description: 'Light Purple, Pink & Sky', colors: ['#C084FC', '#F0ABFC', '#93C5FD'], gradient: ['#F0ABFC', '#C084FC'], icon: 'flower' },
      { id: 'sky', name: 'Sky', description: 'Light Blue, Cyan & Azure', colors: ['#0EA5E9', '#22D3EE', '#60A5FA'], gradient: ['#7DD3FC', '#0EA5E9'], icon: 'airplane' },
    ],
  },
  {
    category: 'Dark Themes',
    themes: [
      { id: 'midnight', name: 'Midnight', description: 'Navy, Purple & Silver', colors: ['#1E40AF', '#8B5CF6', '#94A3B8'], gradient: ['#3B82F6', '#1E40AF'], icon: 'moon' },
    ],
  },
  {
    category: 'Monochrome - Purple Family',
    themes: [
      { id: 'monoPurple', name: 'Mono Purple', description: 'Pure Purple Shades', colors: ['#9333EA', '#A855F7', '#C4B5FD'], gradient: ['#C084FC', '#9333EA'], icon: 'color-palette' },
      { id: 'monoViolet', name: 'Mono Violet', description: 'Pure Violet Shades', colors: ['#7C3AED', '#8B5CF6', '#C4B5FD'], gradient: ['#A78BFA', '#7C3AED'], icon: 'flower' },
      { id: 'monoFuchsia', name: 'Mono Fuchsia', description: 'Pure Fuchsia Shades', colors: ['#C026D3', '#D946EF', '#F5D0FE'], gradient: ['#F0ABFC', '#C026D3'], icon: 'sparkles' },
      { id: 'monoIndigo', name: 'Mono Indigo', description: 'Pure Indigo Shades', colors: ['#4F46E5', '#6366F1', '#A5B4FC'], gradient: ['#818CF8', '#4F46E5'], icon: 'moon' },
    ],
  },
  {
    category: 'Monochrome - Blue Family',
    themes: [
      { id: 'monoBlue', name: 'Mono Blue', description: 'Pure Blue Shades', colors: ['#2563EB', '#3B82F6', '#93C5FD'], gradient: ['#60A5FA', '#2563EB'], icon: 'water' },
      { id: 'monoSky', name: 'Mono Sky', description: 'Pure Sky Shades', colors: ['#0284C7', '#0EA5E9', '#BAE6FD'], gradient: ['#7DD3FC', '#0284C7'], icon: 'airplane' },
      { id: 'monoCyan', name: 'Mono Cyan', description: 'Pure Cyan Shades', colors: ['#0891B2', '#06B6D4', '#A5F3FC'], gradient: ['#67E8F9', '#0891B2'], icon: 'water' },
      { id: 'monoTeal', name: 'Mono Teal', description: 'Pure Teal Shades', colors: ['#0D9488', '#14B8A6', '#99F6E4'], gradient: ['#5EEAD4', '#0D9488'], icon: 'fitness' },
    ],
  },
  {
    category: 'Monochrome - Green Family',
    themes: [
      { id: 'monoGreen', name: 'Mono Green', description: 'Pure Green Shades', colors: ['#16A34A', '#22C55E', '#86EFAC'], gradient: ['#4ADE80', '#16A34A'], icon: 'leaf' },
      { id: 'monoEmerald', name: 'Mono Emerald', description: 'Pure Emerald Shades', colors: ['#059669', '#10B981', '#A7F3D0'], gradient: ['#6EE7B7', '#059669'], icon: 'diamond' },
      { id: 'monoLime', name: 'Mono Lime', description: 'Pure Lime Shades', colors: ['#65A30D', '#84CC16', '#D9F99D'], gradient: ['#BEF264', '#65A30D'], icon: 'nutrition' },
    ],
  },
  {
    category: 'Monochrome - Red & Pink Family',
    themes: [
      { id: 'monoRed', name: 'Mono Red', description: 'Pure Red Shades', colors: ['#DC2626', '#EF4444', '#FCA5A5'], gradient: ['#F87171', '#DC2626'], icon: 'flame' },
      { id: 'monoRose', name: 'Mono Rose', description: 'Pure Rose Shades', colors: ['#E11D48', '#F43F5E', '#FDA4AF'], gradient: ['#FB7185', '#E11D48'], icon: 'rose' },
      { id: 'monoPink', name: 'Mono Pink', description: 'Pure Pink Shades', colors: ['#DB2777', '#EC4899', '#F9A8D4'], gradient: ['#F472B6', '#DB2777'], icon: 'heart' },
    ],
  },
  {
    category: 'Monochrome - Orange & Yellow Family',
    themes: [
      { id: 'monoOrange', name: 'Mono Orange', description: 'Pure Orange Shades', colors: ['#EA580C', '#F97316', '#FDBA74'], gradient: ['#FB923C', '#EA580C'], icon: 'sunny' },
      { id: 'monoAmber', name: 'Mono Amber', description: 'Pure Amber Shades', colors: ['#D97706', '#F59E0B', '#FDE68A'], gradient: ['#FCD34D', '#D97706'], icon: 'star' },
    ],
  },
  {
    category: 'Monochrome - Neutral Family',
    themes: [
      { id: 'monoSlate', name: 'Mono Slate', description: 'Pure Slate Shades', colors: ['#475569', '#64748B', '#CBD5E1'], gradient: ['#94A3B8', '#475569'], icon: 'contrast' },
      { id: 'monoStone', name: 'Mono Stone', description: 'Pure Stone Shades', colors: ['#57534E', '#78716C', '#D6D3D1'], gradient: ['#A8A29E', '#57534E'], icon: 'cube' },
      { id: 'monoNeutral', name: 'Mono Neutral', description: 'Pure Neutral Shades', colors: ['#525252', '#737373', '#D4D4D4'], gradient: ['#A3A3A3', '#525252'], icon: 'ellipse' },
      { id: 'monoZinc', name: 'Mono Zinc', description: 'Pure Zinc Shades', colors: ['#52525B', '#71717A', '#D4D4D8'], gradient: ['#A1A1AA', '#52525B'], icon: 'square' },
    ],
  },
];

interface ThemeSelectionScreenProps {
  navigation: any;
}

export default function ThemeSelectionScreen({ navigation }: ThemeSelectionScreenProps) {
  const theme = useTheme();

  const handleThemeSelect = (themeId: ColorScheme) => {
    // Free version: all themes are available
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    theme.setColorScheme(themeId);
  };


  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.textHigh} />
        </Pressable>
        <Text style={[styles.title, { color: theme.colors.textHigh }]}>Choose Theme</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {allThemes.map((category) => (
          <View key={category.category} style={styles.categorySection}>
            <Text style={[styles.categoryTitle, { color: theme.colors.textMed }]}>
              {category.category.toUpperCase()}
            </Text>
            
            <View style={styles.themesGrid}>
              {category.themes.map((themeOption) => {
                const isSelected = theme.colorScheme === themeOption.id;
                return (
                  <Pressable
                    key={themeOption.id}
                    style={[
                      styles.themeCard,
                      isSelected && styles.themeCardSelected,
                      {
                        borderColor: isSelected ? themeOption.colors[0] : theme.colors.border,
                        backgroundColor: theme.colors.surface2,
                      },
                    ]}
                    onPress={() => handleThemeSelect(themeOption.id)}
                  >
                    <LinearGradient
                      colors={themeOption.gradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.themeGradient}
                    >
                      <View style={styles.themeIconContainer}>
                        <Ionicons name={themeOption.icon} size={28} color="#FFFFFF" />
                      </View>
                    </LinearGradient>
                    
                    <View style={styles.themeSwatches}>
                      {themeOption.colors.map((color, idx) => (
                        <View key={idx} style={[styles.themeSwatch, { backgroundColor: color }]} />
                      ))}
                    </View>
                    
                    <View style={styles.themeInfo}>
                      <View style={styles.themeNameRow}>
                        <Text style={[styles.themeName, { color: theme.colors.textHigh }]}>
                          {themeOption.name}
                        </Text>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={16} color={themeOption.colors[0]} />
                        )}
                      </View>
                      <Text style={[styles.themeDesc, { color: theme.colors.textMed }]} numberOfLines={1}>
                        {themeOption.description}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
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
    marginBottom: s.sm,
  },
  backButton: {
    padding: s.xs,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: s.lg,
    paddingBottom: s.xl * 2,
  },
  categorySection: {
    marginBottom: s.xl,
  },
  categoryTitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: s.md,
    marginLeft: s.xs,
  },
  themesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: s.md,
  },
  themeCard: {
    width: '47%',
    borderRadius: r.lg,
    borderWidth: 2,
    overflow: 'hidden',
  },
  themeCardSelected: {
    borderWidth: 3,
  },
  themeGradient: {
    height: 90,
    justifyContent: 'center',
    alignItems: 'center',
  },
  themeIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  themeSwatches: {
    flexDirection: 'row',
    height: 24,
  },
  themeSwatch: {
    flex: 1,
  },
  themeInfo: {
    padding: s.md,
    gap: 4,
  },
  themeNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.xs,
  },
  themeName: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  themeDesc: {
    fontSize: 11,
    fontWeight: '500',
  },
  lockBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
});
