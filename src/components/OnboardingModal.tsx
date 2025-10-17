import React from 'react';
import { Modal, View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../design/theme';
import { s } from '../design/spacing';
import { r } from '../design/radii';

type Props = {
  visible: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  accentColor?: string;
  title: string;
  body?: string;
  helper?: string; // small text like "Takes ~1 minute"
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
};

export default function OnboardingModal({
  visible,
  icon = 'sparkles-outline',
  accentColor,
  title,
  body,
  helper,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: Props) {
  const theme = useTheme();
  const accent = accentColor || theme.colors.accent;
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
          <View style={styles.headerRow}>
            <View style={[styles.badge, { backgroundColor: accent + '20' }]}>
              <Ionicons name={icon} size={18} color={accent} />
              <Text style={[styles.badgeText, { color: accent }]}>Quick Setup</Text>
            </View>
            {!!helper && (
              <Text style={[styles.helper, { color: theme.colors.textSecondary }]}>{helper}</Text>
            )}
          </View>

          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{title}</Text>
          {!!body && (
            <Text style={[styles.body, { color: theme.colors.textSecondary }]}>{body}</Text>
          )}

          <View style={styles.actions}>
            {secondaryLabel && onSecondary && (
              <Pressable onPress={onSecondary} style={[styles.secondaryBtn]}> 
                <Text style={[styles.secondaryText, { color: theme.colors.textSecondary }]}>{secondaryLabel}</Text>
              </Pressable>
            )}
            <Pressable onPress={onPrimary} style={[styles.primaryBtn, { backgroundColor: accent }]}> 
              <Text style={styles.primaryText}>{primaryLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: s.lg,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    borderRadius: r.xl,
    borderWidth: 1,
    padding: s.xl,
    gap: s.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: r.lg,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  helper: {
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
  },
  actions: {
    marginTop: s.md,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: s.md,
  },
  primaryBtn: {
    paddingHorizontal: s.lg,
    paddingVertical: 12,
    borderRadius: r.lg,
  },
  primaryText: {
    color: '#fff',
    fontWeight: '900',
  },
  secondaryBtn: {
    paddingHorizontal: s.md,
    paddingVertical: 10,
  },
  secondaryText: {
    fontWeight: '700',
  },
});

