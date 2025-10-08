import React from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { useTheme } from '../design';
import AuthNavigator from './AuthNavigator';

export default function RootNav() {
  const theme = useTheme();
  
  const navTheme = theme.isDark 
    ? {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          background: theme.colors.bg,
          card: theme.colors.surface,
          text: theme.colors.textPrimary,
          primary: theme.colors.accent,
        },
      }
    : {
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          background: theme.colors.bg,
          card: theme.colors.surface,
          text: theme.colors.textPrimary,
          primary: theme.colors.accent,
        },
      };

  return (
    <NavigationContainer theme={navTheme}>
      <AuthNavigator />
    </NavigationContainer>
  );
}
