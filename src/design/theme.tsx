import { useColorScheme } from 'react-native';
import { colors } from './colors';
import React, { createContext, useContext, useState, ReactNode } from 'react';

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
    accent: string;
    success: string;
    warning: string;
    danger: string;
  };
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const systemScheme = useColorScheme();
  const [themePreference, setThemePreference] = useState<ThemePreference>('dark');

  const isDark = themePreference === 'system' 
    ? systemScheme === 'dark' 
    : themePreference === 'dark';

  const themeColors = isDark ? {
    bg: '#0A0A0A',
    surface: '#1A1A1A',
    border: '#2A2A2A',
    textPrimary: '#FFFFFF',
    textSecondary: '#A0A0A0',
    accent: '#3B82F6',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
  } : {
    bg: '#FFFFFF',
    surface: '#F5F7FB',
    border: 'rgba(0, 0, 0, 0.1)',
    textPrimary: '#1B1B1F',
    textSecondary: '#4B4B57',
    accent: '#3B82F6',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
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
