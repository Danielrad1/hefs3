import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../design/theme';
import { r, s } from '../design';

export default function CardSurface({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return <View style={[styles.card, { backgroundColor: t.colors.surface }]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: { borderRadius: r.xl, padding: s.xl, margin: s.lg },
});
