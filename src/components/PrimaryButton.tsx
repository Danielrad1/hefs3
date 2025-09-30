import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { useTheme } from '../design/theme';
import { r, s } from '../design';

export default function PrimaryButton({ title, onPress }: { title: string; onPress?: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.btn, { backgroundColor: t.colors.accent }]}>
      <Text style={[styles.txt, { color: '#021216' }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { paddingVertical: s.md, paddingHorizontal: s.xl, borderRadius: r.lg, alignItems: 'center' },
  txt: { fontSize: 16, fontWeight: '700' },
});
