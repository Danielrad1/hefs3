import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../../design/theme';

export default function HomeScreen() {
  const t = useTheme();
  return (
    <View style={{
      flex: 1,
      backgroundColor: t.colors.bg,
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <Text style={{ color: t.colors.textPrimary }}>Home / Stats</Text>
    </View>
  );
}
