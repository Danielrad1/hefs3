import { useColorScheme } from 'react-native';
import { colors } from './colors';

export const useTheme = () => {
  const scheme = useColorScheme(); // 'light' | 'dark'
  const isDark = scheme !== 'light';
  return {
    isDark,
    colors: {
      bg: isDark ? colors.bg.dark : '#FFFFFF',
      surface: isDark ? colors.surface.dark : '#F5F7FB',
      textPrimary: isDark ? colors.text.primary : '#1B1B1F',
      textSecondary: isDark ? colors.text.secondary : '#4B4B57',
      textTertiary: isDark ? '#6B6B75' : '#8E8E93',
      accent: colors.accent,
      success: colors.success,
      warning: colors.warning,
      danger: colors.danger,
      border: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
    },
  };
};
