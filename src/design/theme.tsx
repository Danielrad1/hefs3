import { useColorScheme } from 'react-native';
import { colors } from './colors';
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemePreference = 'light' | 'dark' | 'system';

interface ThemeContextType {
  isDark: boolean;
  themePreference: ThemePreference;
  setThemePreference: (preference: ThemePreference) => void;
  colors: {
    bg: string;
    surface: string;
    border: string;
    textPrimary: string;
    textSecondary: string;
    textTertiary: string;
    accent: string;
    success: string;
    warning: string;
    danger: string;
    info: string;
  };
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = '@memorize_theme_preference';

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const systemScheme = useColorScheme();
  const [themePreference, setThemePreference] = useState<ThemePreference>('dark');
  const [isLoading, setIsLoading] = useState(true);

  // Load saved theme preference on mount
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (saved && (saved === 'light' || saved === 'dark' || saved === 'system')) {
          setThemePreference(saved as ThemePreference);
        }
      } catch (error) {
        console.error('[Theme] Failed to load theme preference:', error);
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
        console.error('[Theme] Failed to save theme preference:', error);
      });
    }
  }, [themePreference, isLoading]);

  const isDark = themePreference === 'system' 
    ? systemScheme === 'dark' 
    : themePreference === 'dark';

  const themeColors = isDark ? {
    bg: '#0A0A0A',
    surface: '#1A1A1A',
    border: '#2A2A2A',
    textPrimary: '#FFFFFF',
    textSecondary: '#A0A0A0',
    textTertiary: '#707070',
    accent: '#3B82F6',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    info: '#06B6D4',
  } : {
    bg: '#FFFFFF',
    surface: '#F5F7FB',
    border: 'rgba(0, 0, 0, 0.1)',
    textPrimary: '#1B1B1F',
    textSecondary: '#4B4B57',
    textTertiary: '#8B8B97',
    accent: '#3B82F6',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    info: '#06B6D4',
  };

  return (
    <ThemeContext.Provider
      value={{
        isDark,
        themePreference,
        setThemePreference,
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
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
