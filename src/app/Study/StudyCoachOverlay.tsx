import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/theme';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';

type Step = 'reveal' | 'swipe';

type Props = {
  visible: boolean;
  step: Step;
  onNext: () => void;
};

export default function StudyCoachOverlay({ visible, step, onNext }: Props) {
  const theme = useTheme();
  if (!visible) return null;

  const isReveal = step === 'reveal';

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
        <View style={styles.headerRow}>
          <View style={[styles.badge, { backgroundColor: theme.colors.accent + '20' }]}>
            <Ionicons name="sparkles-outline" size={16} color={theme.colors.accent} />
            <Text style={[styles.badgeText, { color: theme.colors.accent }]}>Quick Guide</Text>
          </View>
        </View>

        {isReveal ? (
          <>
            <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Tap to reveal the answer</Text>
            <Text style={[styles.body, { color: theme.colors.textSecondary }]}>Tap the card to see the answer. Then you’ll rate it with a swipe.</Text>
          </>
        ) : (
          <>
            <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Swipe to rate your recall</Text>
            <Text style={[styles.body, { color: theme.colors.textSecondary }]}>After revealing: swipe Right = Easy, Left = Hard, Up = Good, Down = Again.</Text>
            <View style={styles.legends}>
              <Legend icon="arrow-forward" label="Easy" color="#3B82F6" />
              <Legend icon="arrow-back" label="Hard" color="#F97316" />
              <Legend icon="arrow-up" label="Good" color="#10B981" />
              <Legend icon="arrow-down" label="Again" color="#EF4444" />
            </View>
          </>
        )}

        <Pressable onPress={onNext} style={[styles.primaryBtn, { backgroundColor: theme.colors.accent }]}> 
          <Text style={styles.primaryText}>{isReveal ? 'Got it' : 'Start'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Legend({ icon, label, color }: { icon: any; label: string; color: string }) {
  return (
    <View style={[legendStyles.container]}> 
      <Ionicons name={icon} size={16} color={color} />
      <Text style={[legendStyles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: s.lg,
    zIndex: 1000,
  },
  card: {
    borderWidth: 1,
    borderRadius: r.lg,
    padding: s.lg,
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
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: r.md,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
  },
  legends: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  primaryBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: s.lg,
    paddingVertical: 10,
    borderRadius: r.md,
  },
  primaryText: {
    color: '#fff',
    fontWeight: '800',
  },
});

const legendStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: r.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  text: {
    fontSize: 13,
    fontWeight: '700',
  },
});
