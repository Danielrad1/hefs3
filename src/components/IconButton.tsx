import React from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { useTheme } from '../design/theme';
import { r, s } from '../design';

export default function IconButton({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.btn, { backgroundColor: t.colors.surface }]}>
      <View>{children}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { padding: s.md, borderRadius: r.lg, alignItems: 'center', justifyContent: 'center' },
});
