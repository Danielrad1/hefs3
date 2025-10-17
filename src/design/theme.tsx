import { useColorScheme } from 'react-native';
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/logger';

type ThemePreference = 'light' | 'dark' | 'system';
type ColorScheme = 'sunset' | 'ocean' | 'forest' | 'neon' | 'royal' | 'moss' | 'midnight' | 'cherry' | 'mint' | 'coral' | 'lavender' | 'amber' | 'sky' | 'berry' | 'earth' | 'aurora' | 'monoPurple' | 'monoBlue' | 'monoGreen' | 'monoRed' | 'monoOrange' | 'monoPink' | 'monoTeal' | 'monoIndigo' | 'monoRose' | 'monoEmerald' | 'monoViolet' | 'monoSky' | 'monoAmber' | 'monoLime' | 'monoCyan' | 'monoFuchsia' | 'monoSlate' | 'monoStone' | 'monoNeutral' | 'monoZinc';

interface ThemeColors {
  // Brand
  primary: string;
  primaryHover: string;
  primaryGradient: [string, string];
  onPrimary: string;
  secondary: string;
  
  // Surfaces
  bg: string;
  surface1: string;
  surface2: string;
  surface3: string;
  border: string;
  
  // Text
  textHigh: string;
  textMed: string;
  textLow: string;
  
  // Legacy (for backward compatibility)
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  surface: string; // Maps to surface2
  accent: string; // Maps to primary
  
  // Status
  success: string;
  warning: string;
  danger: string;
  info: string;
  
  // Special purpose
  streak: string; // Dedicated orange for streaks
  
  // Overlays (12% alpha for consistency)
  overlay: {
    primary: string;
    success: string;
    warning: string;
    danger: string;
    info: string;
    streak: string;
  };
  
  // Data Visualization
  dataViz: {
    new: string;
    young: string;
    mature: string;
    time: string;
    reviews: string;
  };
}

interface ThemeContextType {
  isDark: boolean;
  themePreference: ThemePreference;
  setThemePreference: (preference: ThemePreference) => void;
  colorScheme: ColorScheme;
  setColorScheme: (scheme: ColorScheme) => void;
  colors: ThemeColors;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = '@memorize_theme_preference';
const COLOR_SCHEME_STORAGE_KEY = '@memorize_color_scheme';

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const systemScheme = useColorScheme();
  const [themePreference, setThemePreference] = useState<ThemePreference>('dark');
  const [colorScheme, setColorScheme] = useState<ColorScheme>('sunset');
  const [isLoading, setIsLoading] = useState(true);

  // Load saved theme preference and color scheme on mount
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        const savedScheme = await AsyncStorage.getItem(COLOR_SCHEME_STORAGE_KEY);
        
        if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system')) {
          setThemePreference(savedTheme as ThemePreference);
        }
        
        if (savedScheme && ['sunset', 'ocean', 'forest', 'neon', 'royal', 'moss', 'midnight', 'cherry', 'mint', 'coral', 'lavender', 'amber', 'sky', 'berry', 'earth', 'aurora', 'monoPurple', 'monoBlue', 'monoGreen', 'monoRed', 'monoOrange', 'monoPink', 'monoTeal', 'monoIndigo', 'monoRose', 'monoEmerald', 'monoViolet', 'monoSky', 'monoAmber', 'monoLime', 'monoCyan', 'monoFuchsia', 'monoSlate', 'monoStone', 'monoNeutral', 'monoZinc'].includes(savedScheme)) {
          setColorScheme(savedScheme as ColorScheme);
        }
      } catch (error) {
        logger.error('[Theme] Failed to load theme preference:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadTheme();
  }, []);

  // Save theme preference whenever it changes
  useEffect(() => {
    if (!isLoading) {
      AsyncStorage.setItem(THEME_STORAGE_KEY, themePreference).catch((error) => {
        logger.error('[Theme] Failed to save theme preference:', error);
      });
    }
  }, [themePreference, isLoading]);

  // Save color scheme whenever it changes
  useEffect(() => {
    if (!isLoading) {
      AsyncStorage.setItem(COLOR_SCHEME_STORAGE_KEY, colorScheme).catch((error) => {
        logger.error('[Theme] Failed to save color scheme:', error);
      });
    }
  }, [colorScheme, isLoading]);

  const isDark = themePreference === 'system' 
    ? systemScheme === 'dark' 
    : themePreference === 'dark';

  // Color scheme definitions (3 colors each)
  const getColorSchemeColors = () => {
    switch (colorScheme) {
      case 'sunset':
        return {
          primary: '#8B5CF6', // Purple 500
          primaryHover: '#7C3AED', // Purple 600
          primaryGradient: ['#6366F1', '#8B5CF6'] as [string, string], // Indigo → Purple
          secondary: '#EC4899', // Fuchsia 500 (accent)
          success: '#F59E0B', // Amber 500 (warm)
          info: '#FB7185', // Rose 400 (third color)
          warning: '#D97706', // Amber 600
          dataVizMature: '#FB7185', // Rose for mature
          dataVizNew: '#EC4899', // Fuchsia for new
          dataVizYoung: '#8B5CF6', // Purple for young
          dataVizTime: '#F59E0B', // Amber for time
          dataVizReviews: '#FB7185', // Rose for reviews
        };
      
      case 'ocean':
        return {
          primary: '#6366F1', // Indigo 500
          primaryHover: '#4F46E5', // Indigo 600
          primaryGradient: ['#3B82F6', '#6366F1'] as [string, string], // Blue → Indigo
          secondary: '#EC4899', // Fuchsia (accent)
          success: '#06B6D4', // Cyan 500
          info: '#14B8A6', // Teal 500 (third color)
          warning: '#0891B2', // Cyan 600
          dataVizMature: '#14B8A6', // Teal for mature
          dataVizNew: '#EC4899', // Fuchsia for new
          dataVizYoung: '#6366F1', // Indigo for young
          dataVizTime: '#06B6D4', // Cyan for time
          dataVizReviews: '#14B8A6', // Teal for reviews
        };
      
      case 'forest':
        return {
          primary: '#8B5CF6', // Purple 500
          primaryHover: '#7C3AED', // Purple 600
          primaryGradient: ['#10B981', '#8B5CF6'] as [string, string], // Emerald → Purple
          secondary: '#EC4899', // Fuchsia (accent)
          success: '#10B981', // Emerald 500
          info: '#84CC16', // Lime 500 (third color)
          warning: '#059669', // Emerald 600
          dataVizMature: '#84CC16', // Lime for mature
          dataVizNew: '#EC4899', // Fuchsia for new
          dataVizYoung: '#8B5CF6', // Purple for young
          dataVizTime: '#10B981', // Emerald for time
          dataVizReviews: '#84CC16', // Lime for reviews
        };
      
      case 'neon':
        return {
          primary: '#A855F7', // Purple 500 (brighter)
          primaryHover: '#9333EA', // Purple 600
          primaryGradient: ['#EC4899', '#A855F7'] as [string, string], // Fuchsia → Purple
          secondary: '#EC4899', // Fuchsia 500
          success: '#22D3EE', // Cyan 400 (bright)
          info: '#F0ABFC', // Fuchsia 300 (third color - lighter)
          warning: '#06B6D4', // Cyan 500
          dataVizMature: '#F0ABFC', // Light fuchsia for mature
          dataVizNew: '#EC4899', // Fuchsia for new
          dataVizYoung: '#A855F7', // Purple for young
          dataVizTime: '#22D3EE', // Bright cyan for time
          dataVizReviews: '#F0ABFC', // Light fuchsia for reviews
        };
      
      case 'royal':
        return {
          primary: '#7C3AED', // Purple 600 (deeper)
          primaryHover: '#6D28D9', // Purple 700
          primaryGradient: ['#4F46E5', '#7C3AED'] as [string, string], // Indigo → Deep Purple
          secondary: '#EC4899', // Fuchsia (accent)
          success: '#F59E0B', // Amber 500 (gold)
          info: '#4F46E5', // Indigo 600 (third color - navy)
          warning: '#D97706', // Amber 600
          dataVizMature: '#4F46E5', // Indigo for mature
          dataVizNew: '#EC4899', // Fuchsia for new
          dataVizYoung: '#7C3AED', // Deep purple for young
          dataVizTime: '#F59E0B', // Gold for time
          dataVizReviews: '#4F46E5', // Indigo for reviews
        };
      
      case 'moss':
        return {
          primary: '#8B5CF6', // Purple 500
          primaryHover: '#7C3AED', // Purple 600
          primaryGradient: ['#059669', '#8B5CF6'] as [string, string], // Dark Green → Purple
          secondary: '#EC4899', // Fuchsia
          success: '#059669', // Emerald 600 (dark green)
          info: '#84CC16', // Lime 500 (bright accent)
          warning: '#047857', // Emerald 700
          dataVizMature: '#84CC16', // Lime for mature
          dataVizNew: '#EC4899', // Fuchsia for new
          dataVizYoung: '#8B5CF6', // Purple for young
          dataVizTime: '#059669', // Dark green for time
          dataVizReviews: '#84CC16', // Lime for reviews
        };
      
      case 'midnight':
        return {
          primary: '#1E40AF', // Blue 800 (deep navy)
          primaryHover: '#1E3A8A', // Blue 900
          primaryGradient: ['#3B82F6', '#1E40AF'] as [string, string], // Blue → Navy
          secondary: '#EC4899', // Fuchsia
          success: '#8B5CF6', // Purple 500 (mystical)
          info: '#94A3B8', // Slate 400 (silver)
          warning: '#7C3AED', // Purple 600
          dataVizMature: '#94A3B8', // Silver for mature
          dataVizNew: '#EC4899', // Fuchsia for new
          dataVizYoung: '#1E40AF', // Navy for young
          dataVizTime: '#8B5CF6', // Purple for time
          dataVizReviews: '#94A3B8', // Silver for reviews
        };
      
      case 'cherry':
        return {
          primary: '#DC2626', // Red 600
          primaryHover: '#B91C1C', // Red 700
          primaryGradient: ['#F97316', '#DC2626'] as [string, string], // Orange → Red
          secondary: '#EC4899', // Fuchsia
          success: '#F97316', // Orange 500 (warm)
          info: '#FB923C', // Orange 400 (soft)
          warning: '#EA580C', // Orange 600
          dataVizMature: '#FB923C', // Soft orange for mature
          dataVizNew: '#EC4899', // Fuchsia for new
          dataVizYoung: '#DC2626', // Red for young
          dataVizTime: '#F97316', // Orange for time
          dataVizReviews: '#FB923C', // Soft orange for reviews
        };
      
      case 'mint':
        return {
          primary: '#14B8A6', // Teal 500
          primaryHover: '#0D9488', // Teal 600
          primaryGradient: ['#2DD4BF', '#14B8A6'] as [string, string], // Light Teal → Teal
          secondary: '#EC4899', // Fuchsia
          success: '#10B981', // Emerald 500
          info: '#06B6D4', // Cyan 500
          warning: '#059669', // Emerald 600
          dataVizMature: '#06B6D4', // Cyan for mature
          dataVizNew: '#EC4899', // Fuchsia for new
          dataVizYoung: '#14B8A6', // Teal for young
          dataVizTime: '#10B981', // Emerald for time
          dataVizReviews: '#06B6D4', // Cyan for reviews
        };
      
      case 'coral':
        return {
          primary: '#F97316', // Orange 500
          primaryHover: '#EA580C', // Orange 600
          primaryGradient: ['#FDE047', '#F97316'] as [string, string], // Yellow → Orange
          secondary: '#EC4899', // Fuchsia
          success: '#FDE047', // Yellow 300 (bright)
          info: '#FB923C', // Orange 400
          warning: '#FBBF24', // Amber 400
          dataVizMature: '#FB923C', // Soft orange for mature
          dataVizNew: '#EC4899', // Fuchsia for new
          dataVizYoung: '#F97316', // Orange for young
          dataVizTime: '#FDE047', // Yellow for time
          dataVizReviews: '#FB923C', // Soft orange for reviews
        };
      
      case 'lavender':
        return {
          primary: '#C084FC', // Purple 400 (light)
          primaryHover: '#A78BFA', // Purple 400
          primaryGradient: ['#F0ABFC', '#C084FC'] as [string, string], // Fuchsia 300 → Purple 400
          secondary: '#EC4899', // Fuchsia
          success: '#F0ABFC', // Fuchsia 300 (soft pink)
          info: '#93C5FD', // Blue 300 (sky)
          warning: '#E879F9', // Fuchsia 400
          dataVizMature: '#93C5FD', // Sky blue for mature
          dataVizNew: '#EC4899', // Fuchsia for new
          dataVizYoung: '#C084FC', // Light purple for young
          dataVizTime: '#F0ABFC', // Soft pink for time
          dataVizReviews: '#93C5FD', // Sky blue for reviews
        };
      
      case 'amber':
        return {
          primary: '#F59E0B', // Amber 500
          primaryHover: '#D97706', // Amber 600
          primaryGradient: ['#FCD34D', '#F59E0B'] as [string, string], // Yellow → Amber
          secondary: '#EC4899', // Fuchsia
          success: '#EF4444', // Red 500 (energetic)
          info: '#FB923C', // Orange 400
          warning: '#DC2626', // Red 600
          dataVizMature: '#FB923C', // Orange for mature
          dataVizNew: '#EC4899', // Fuchsia for new
          dataVizYoung: '#F59E0B', // Amber for young
          dataVizTime: '#EF4444', // Red for time
          dataVizReviews: '#FB923C', // Orange for reviews
        };
      
      case 'sky':
        return {
          primary: '#0EA5E9', // Sky 500
          primaryHover: '#0284C7', // Sky 600
          primaryGradient: ['#7DD3FC', '#0EA5E9'] as [string, string], // Light Sky → Sky
          secondary: '#EC4899', // Fuchsia
          success: '#22D3EE', // Cyan 400 (bright)
          info: '#60A5FA', // Blue 400
          warning: '#06B6D4', // Cyan 500
          dataVizMature: '#60A5FA', // Blue for mature
          dataVizNew: '#EC4899', // Fuchsia for new
          dataVizYoung: '#0EA5E9', // Sky for young
          dataVizTime: '#22D3EE', // Bright cyan for time
          dataVizReviews: '#60A5FA', // Blue for reviews
        };
      
      case 'berry':
        return {
          primary: '#A855F7', // Purple 500 (bright)
          primaryHover: '#9333EA', // Purple 600
          primaryGradient: ['#D946EF', '#A855F7'] as [string, string], // Magenta → Purple
          secondary: '#EC4899', // Fuchsia
          success: '#3B82F6', // Blue 500 (cool)
          info: '#F0ABFC', // Fuchsia 300
          warning: '#2563EB', // Blue 600
          dataVizMature: '#F0ABFC', // Light fuchsia for mature
          dataVizNew: '#EC4899', // Fuchsia for new
          dataVizYoung: '#A855F7', // Bright purple for young
          dataVizTime: '#3B82F6', // Blue for time
          dataVizReviews: '#F0ABFC', // Light fuchsia for reviews
        };
      
      case 'earth':
        return {
          primary: '#92400E', // Amber 800 (brown)
          primaryHover: '#78350F', // Amber 900
          primaryGradient: ['#F97316', '#92400E'] as [string, string], // Orange → Brown
          secondary: '#EC4899', // Fuchsia
          success: '#16A34A', // Green 600 (natural)
          info: '#FB923C', // Orange 400
          warning: '#15803D', // Green 700
          dataVizMature: '#FB923C', // Orange for mature
          dataVizNew: '#EC4899', // Fuchsia for new
          dataVizYoung: '#92400E', // Brown for young
          dataVizTime: '#16A34A', // Green for time
          dataVizReviews: '#FB923C', // Orange for reviews
        };
      
      case 'aurora':
        return {
          primary: '#8B5CF6', // Purple 500 (vibrant)
          primaryHover: '#7C3AED', // Purple 600
          primaryGradient: ['#EC4899', '#8B5CF6'] as [string, string], // Pink → Purple
          secondary: '#EC4899', // Fuchsia
          success: '#10B981', // Emerald 500 (fresh green)
          info: '#F0ABFC', // Fuchsia 300 (soft pink)
          warning: '#A78BFA', // Purple 400
          dataVizMature: '#10B981', // Green for mature
          dataVizNew: '#EC4899', // Pink for new
          dataVizYoung: '#8B5CF6', // Purple for young
          dataVizTime: '#F0ABFC', // Soft pink for time
          dataVizReviews: '#A78BFA', // Light purple for reviews
        };
      
      // MONOCHROMATIC THEMES (20 single-color focused themes)
      
      case 'monoPurple':
        return {
          primary: '#9333EA', // Purple 600
          primaryHover: '#7E22CE', // Purple 700
          primaryGradient: ['#C084FC', '#9333EA'] as [string, string],
          secondary: '#EC4899',
          success: '#A855F7', // Purple 500
          info: '#C4B5FD', // Purple 300
          warning: '#7C3AED', // Purple 600
          dataVizMature: '#C4B5FD',
          dataVizNew: '#EC4899',
          dataVizYoung: '#9333EA',
          dataVizTime: '#A855F7',
          dataVizReviews: '#C4B5FD',
        };
      
      case 'monoBlue':
        return {
          primary: '#2563EB', // Blue 600
          primaryHover: '#1D4ED8', // Blue 700
          primaryGradient: ['#60A5FA', '#2563EB'] as [string, string],
          secondary: '#EC4899',
          success: '#3B82F6', // Blue 500
          info: '#93C5FD', // Blue 300
          warning: '#1E40AF', // Blue 800
          dataVizMature: '#93C5FD',
          dataVizNew: '#EC4899',
          dataVizYoung: '#2563EB',
          dataVizTime: '#3B82F6',
          dataVizReviews: '#93C5FD',
        };
      
      case 'monoGreen':
        return {
          primary: '#16A34A', // Green 600
          primaryHover: '#15803D', // Green 700
          primaryGradient: ['#4ADE80', '#16A34A'] as [string, string],
          secondary: '#EC4899',
          success: '#22C55E', // Green 500
          info: '#86EFAC', // Green 300
          warning: '#166534', // Green 800
          dataVizMature: '#86EFAC',
          dataVizNew: '#EC4899',
          dataVizYoung: '#16A34A',
          dataVizTime: '#22C55E',
          dataVizReviews: '#86EFAC',
        };
      
      case 'monoRed':
        return {
          primary: '#DC2626', // Red 600
          primaryHover: '#B91C1C', // Red 700
          primaryGradient: ['#F87171', '#DC2626'] as [string, string],
          secondary: '#EC4899',
          success: '#EF4444', // Red 500
          info: '#FCA5A5', // Red 300
          warning: '#991B1B', // Red 800
          dataVizMature: '#FCA5A5',
          dataVizNew: '#EC4899',
          dataVizYoung: '#DC2626',
          dataVizTime: '#EF4444',
          dataVizReviews: '#FCA5A5',
        };
      
      case 'monoOrange':
        return {
          primary: '#EA580C', // Orange 600
          primaryHover: '#C2410C', // Orange 700
          primaryGradient: ['#FB923C', '#EA580C'] as [string, string],
          secondary: '#EC4899',
          success: '#F97316', // Orange 500
          info: '#FDBA74', // Orange 300
          warning: '#9A3412', // Orange 800
          dataVizMature: '#FDBA74',
          dataVizNew: '#EC4899',
          dataVizYoung: '#EA580C',
          dataVizTime: '#F97316',
          dataVizReviews: '#FDBA74',
        };
      
      case 'monoPink':
        return {
          primary: '#DB2777', // Pink 600
          primaryHover: '#BE185D', // Pink 700
          primaryGradient: ['#F472B6', '#DB2777'] as [string, string],
          secondary: '#EC4899',
          success: '#EC4899', // Pink 500
          info: '#F9A8D4', // Pink 300
          warning: '#9F1239', // Pink 800
          dataVizMature: '#F9A8D4',
          dataVizNew: '#EC4899',
          dataVizYoung: '#DB2777',
          dataVizTime: '#EC4899',
          dataVizReviews: '#F9A8D4',
        };
      
      case 'monoTeal':
        return {
          primary: '#0D9488', // Teal 600
          primaryHover: '#0F766E', // Teal 700
          primaryGradient: ['#5EEAD4', '#0D9488'] as [string, string],
          secondary: '#EC4899',
          success: '#14B8A6', // Teal 500
          info: '#99F6E4', // Teal 300
          warning: '#115E59', // Teal 800
          dataVizMature: '#99F6E4',
          dataVizNew: '#EC4899',
          dataVizYoung: '#0D9488',
          dataVizTime: '#14B8A6',
          dataVizReviews: '#99F6E4',
        };
      
      case 'monoIndigo':
        return {
          primary: '#4F46E5', // Indigo 600
          primaryHover: '#4338CA', // Indigo 700
          primaryGradient: ['#818CF8', '#4F46E5'] as [string, string],
          secondary: '#EC4899',
          success: '#6366F1', // Indigo 500
          info: '#A5B4FC', // Indigo 300
          warning: '#3730A3', // Indigo 800
          dataVizMature: '#A5B4FC',
          dataVizNew: '#EC4899',
          dataVizYoung: '#4F46E5',
          dataVizTime: '#6366F1',
          dataVizReviews: '#A5B4FC',
        };
      
      case 'monoRose':
        return {
          primary: '#E11D48', // Rose 600
          primaryHover: '#BE123C', // Rose 700
          primaryGradient: ['#FB7185', '#E11D48'] as [string, string],
          secondary: '#EC4899',
          success: '#F43F5E', // Rose 500
          info: '#FDA4AF', // Rose 300
          warning: '#9F1239', // Rose 800
          dataVizMature: '#FDA4AF',
          dataVizNew: '#EC4899',
          dataVizYoung: '#E11D48',
          dataVizTime: '#F43F5E',
          dataVizReviews: '#FDA4AF',
        };
      
      case 'monoEmerald':
        return {
          primary: '#059669', // Emerald 600
          primaryHover: '#047857', // Emerald 700
          primaryGradient: ['#6EE7B7', '#059669'] as [string, string],
          secondary: '#EC4899',
          success: '#10B981', // Emerald 500
          info: '#A7F3D0', // Emerald 300
          warning: '#065F46', // Emerald 800
          dataVizMature: '#A7F3D0',
          dataVizNew: '#EC4899',
          dataVizYoung: '#059669',
          dataVizTime: '#10B981',
          dataVizReviews: '#A7F3D0',
        };
      
      case 'monoViolet':
        return {
          primary: '#7C3AED', // Violet 600
          primaryHover: '#6D28D9', // Violet 700
          primaryGradient: ['#A78BFA', '#7C3AED'] as [string, string],
          secondary: '#EC4899',
          success: '#8B5CF6', // Violet 500
          info: '#C4B5FD', // Violet 300
          warning: '#5B21B6', // Violet 800
          dataVizMature: '#C4B5FD',
          dataVizNew: '#EC4899',
          dataVizYoung: '#7C3AED',
          dataVizTime: '#8B5CF6',
          dataVizReviews: '#C4B5FD',
        };
      
      case 'monoSky':
        return {
          primary: '#0284C7', // Sky 600
          primaryHover: '#0369A1', // Sky 700
          primaryGradient: ['#7DD3FC', '#0284C7'] as [string, string],
          secondary: '#EC4899',
          success: '#0EA5E9', // Sky 500
          info: '#BAE6FD', // Sky 300
          warning: '#075985', // Sky 800
          dataVizMature: '#BAE6FD',
          dataVizNew: '#EC4899',
          dataVizYoung: '#0284C7',
          dataVizTime: '#0EA5E9',
          dataVizReviews: '#BAE6FD',
        };
      
      case 'monoAmber':
        return {
          primary: '#D97706', // Amber 600
          primaryHover: '#B45309', // Amber 700
          primaryGradient: ['#FCD34D', '#D97706'] as [string, string],
          secondary: '#EC4899',
          success: '#F59E0B', // Amber 500
          info: '#FDE68A', // Amber 300
          warning: '#92400E', // Amber 800
          dataVizMature: '#FDE68A',
          dataVizNew: '#EC4899',
          dataVizYoung: '#D97706',
          dataVizTime: '#F59E0B',
          dataVizReviews: '#FDE68A',
        };
      
      case 'monoLime':
        return {
          primary: '#65A30D', // Lime 600
          primaryHover: '#4D7C0F', // Lime 700
          primaryGradient: ['#BEF264', '#65A30D'] as [string, string],
          secondary: '#EC4899',
          success: '#84CC16', // Lime 500
          info: '#D9F99D', // Lime 300
          warning: '#3F6212', // Lime 800
          dataVizMature: '#D9F99D',
          dataVizNew: '#EC4899',
          dataVizYoung: '#65A30D',
          dataVizTime: '#84CC16',
          dataVizReviews: '#D9F99D',
        };
      
      case 'monoCyan':
        return {
          primary: '#0891B2', // Cyan 600
          primaryHover: '#0E7490', // Cyan 700
          primaryGradient: ['#67E8F9', '#0891B2'] as [string, string],
          secondary: '#EC4899',
          success: '#06B6D4', // Cyan 500
          info: '#A5F3FC', // Cyan 300
          warning: '#155E75', // Cyan 800
          dataVizMature: '#A5F3FC',
          dataVizNew: '#EC4899',
          dataVizYoung: '#0891B2',
          dataVizTime: '#06B6D4',
          dataVizReviews: '#A5F3FC',
        };
      
      case 'monoFuchsia':
        return {
          primary: '#C026D3', // Fuchsia 600
          primaryHover: '#A21CAF', // Fuchsia 700
          primaryGradient: ['#F0ABFC', '#C026D3'] as [string, string],
          secondary: '#EC4899',
          success: '#D946EF', // Fuchsia 500
          info: '#F5D0FE', // Fuchsia 300
          warning: '#701A75', // Fuchsia 800
          dataVizMature: '#F5D0FE',
          dataVizNew: '#EC4899',
          dataVizYoung: '#C026D3',
          dataVizTime: '#D946EF',
          dataVizReviews: '#F5D0FE',
        };
      
      case 'monoSlate':
        return {
          primary: '#475569', // Slate 600
          primaryHover: '#334155', // Slate 700
          primaryGradient: ['#94A3B8', '#475569'] as [string, string],
          secondary: '#EC4899',
          success: '#64748B', // Slate 500
          info: '#CBD5E1', // Slate 300
          warning: '#1E293B', // Slate 800
          dataVizMature: '#CBD5E1',
          dataVizNew: '#EC4899',
          dataVizYoung: '#475569',
          dataVizTime: '#64748B',
          dataVizReviews: '#CBD5E1',
        };
      
      case 'monoStone':
        return {
          primary: '#57534E', // Stone 600
          primaryHover: '#44403C', // Stone 700
          primaryGradient: ['#A8A29E', '#57534E'] as [string, string],
          secondary: '#EC4899',
          success: '#78716C', // Stone 500
          info: '#D6D3D1', // Stone 300
          warning: '#292524', // Stone 800
          dataVizMature: '#D6D3D1',
          dataVizNew: '#EC4899',
          dataVizYoung: '#57534E',
          dataVizTime: '#78716C',
          dataVizReviews: '#D6D3D1',
        };
      
      case 'monoNeutral':
        return {
          primary: '#525252', // Neutral 600
          primaryHover: '#404040', // Neutral 700
          primaryGradient: ['#A3A3A3', '#525252'] as [string, string],
          secondary: '#EC4899',
          success: '#737373', // Neutral 500
          info: '#D4D4D4', // Neutral 300
          warning: '#262626', // Neutral 800
          dataVizMature: '#D4D4D4',
          dataVizNew: '#EC4899',
          dataVizYoung: '#525252',
          dataVizTime: '#737373',
          dataVizReviews: '#D4D4D4',
        };
      
      case 'monoZinc':
        return {
          primary: '#52525B', // Zinc 600
          primaryHover: '#3F3F46', // Zinc 700
          primaryGradient: ['#A1A1AA', '#52525B'] as [string, string],
          secondary: '#EC4899',
          success: '#71717A', // Zinc 500
          info: '#D4D4D8', // Zinc 300
          warning: '#27272A', // Zinc 800
          dataVizMature: '#D4D4D8',
          dataVizNew: '#EC4899',
          dataVizYoung: '#52525B',
          dataVizTime: '#71717A',
          dataVizReviews: '#D4D4D8',
        };
    }
  };

  const schemeColors = getColorSchemeColors();

  const themeColors: ThemeColors = isDark ? {
    // Brand (from scheme)
    primary: schemeColors.primary,
    primaryHover: schemeColors.primaryHover,
    primaryGradient: schemeColors.primaryGradient,
    onPrimary: '#FFFFFF',
    secondary: schemeColors.secondary,
    
    // Surfaces
    bg: '#0B0B0E',
    surface1: '#12131A',
    surface2: '#161826',
    surface3: '#1C2030',
    border: '#2A2F44',
    
    // Text (semantic)
    textHigh: '#FFFFFF',
    textMed: '#A7B0C0',
    textLow: '#6E7686',
    
    // Legacy mappings
    textPrimary: '#FFFFFF',
    textSecondary: '#A7B0C0',
    textTertiary: '#6E7686',
    surface: '#161826', // surface2
    accent: schemeColors.primary, // primary
    
    // Status (from scheme)
    success: schemeColors.success,
    warning: schemeColors.warning,
    danger: '#EF4444', // Red 500
    info: schemeColors.info,
    
    // Special purpose
    streak: '#FF8C00', // Dedicated orange for streaks
    
    // Overlays (12% alpha - dynamically generated)
    overlay: {
      primary: schemeColors.primary + '1E',
      success: schemeColors.success + '1E',
      warning: schemeColors.warning + '1E',
      danger: '#EF44441E',
      info: schemeColors.info + '1E',
      streak: '#FF8C001E',
    },
    
    // Data Viz (from scheme)
    dataViz: {
      new: schemeColors.dataVizNew,
      young: schemeColors.dataVizYoung,
      mature: schemeColors.dataVizMature,
      time: schemeColors.dataVizTime,
      reviews: schemeColors.dataVizReviews,
    },
  } : {
    // Brand (from scheme) - Light mode
    primary: schemeColors.primary,
    primaryHover: schemeColors.primaryHover,
    primaryGradient: schemeColors.primaryGradient,
    onPrimary: '#FFFFFF',
    secondary: schemeColors.secondary,
    
    // Surfaces
    bg: '#FFFFFF',
    surface1: '#F6F8FC',
    surface2: '#EEF2F8',
    surface3: '#E7ECF4',
    border: 'rgba(0, 0, 0, 0.08)',
    
    // Text (semantic)
    textHigh: '#1B1F2A',
    textMed: '#4D5562',
    textLow: '#778097',
    
    // Legacy mappings
    textPrimary: '#1B1F2A',
    textSecondary: '#4D5562',
    textTertiary: '#778097',
    surface: '#EEF2F8', // surface2
    accent: schemeColors.primary, // primary
    
    // Status (from scheme)
    success: schemeColors.success,
    warning: schemeColors.warning,
    danger: '#EF4444', // Red 500
    info: schemeColors.info,
    
    // Special purpose
    streak: '#FF8C00', // Dedicated orange for streaks
    
    // Overlays (12% alpha - dynamically generated)
    overlay: {
      primary: schemeColors.primary + '1E',
      success: schemeColors.success + '1E',
      warning: schemeColors.warning + '1E',
      danger: '#EF44441E',
      info: schemeColors.info + '1E',
      streak: '#FF8C001E',
    },
    
    // Data Viz (from scheme)
    dataViz: {
      new: schemeColors.dataVizNew,
      young: schemeColors.dataVizYoung,
      mature: schemeColors.dataVizMature,
      time: schemeColors.dataVizTime,
      reviews: schemeColors.dataVizReviews,
    },
  };

  return (
    <ThemeContext.Provider
      value={{
        isDark,
        themePreference,
        setThemePreference,
        colorScheme,
        setColorScheme,
        colors: themeColors,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const useThemeActions = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeActions must be used within a ThemeProvider');
  }
  return {
    setThemePreference: context.setThemePreference,
    setColorScheme: context.setColorScheme,
  };
};
