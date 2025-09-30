import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../../design/theme';

export default function SettingsScreen() {
  const t = useTheme();
  return (
    <View style={{
      flex: 1,
      backgroundColor: t.colors.bg,
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <Text style={{ color: t.colors.textPrimary }}>Settings</Text>
    </View>
  );
}
