import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '../design/theme';
import { s } from '../design/spacing';
import { r } from '../design/radii';

type Props = {
  title: string;
  body?: string;
  primaryLabel?: string;
  onPrimary?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
};

export function GuideBanner({ title, body, primaryLabel, onPrimary, secondaryLabel, onSecondary }: Props) {
  const theme = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
      <View style={styles.textCol}>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{title}</Text>
        {!!body && (
          <Text style={[styles.body, { color: theme.colors.textSecondary }]}>{body}</Text>
        )}
      </View>
      <View style={styles.actions}>
        {secondaryLabel && onSecondary && (
          <Pressable onPress={onSecondary} style={[styles.secondaryBtn]}> 
            <Text style={[styles.secondaryText, { color: theme.colors.textSecondary }]}>{secondaryLabel}</Text>
          </Pressable>
        )}
        {primaryLabel && onPrimary && (
          <Pressable onPress={onPrimary} style={[styles.primaryBtn, { backgroundColor: theme.colors.accent }]}> 
            <Text style={styles.primaryText}>{primaryLabel}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: r.lg,
    padding: s.md,
    marginHorizontal: s.md,
    marginTop: s.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.md,
  },
  textCol: { flex: 1 },
  title: { fontSize: 16, fontWeight: '700' },
  body: { marginTop: 2, fontSize: 13, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: s.sm },
  primaryBtn: { paddingHorizontal: s.md, paddingVertical: 8, borderRadius: r.md },
  primaryText: { color: '#fff', fontWeight: '700' },
  secondaryBtn: { paddingHorizontal: s.md, paddingVertical: 8 },
  secondaryText: { fontWeight: '600' },
});

export default GuideBanner;

