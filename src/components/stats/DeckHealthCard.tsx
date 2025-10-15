/**
 * Deck Health Card - Shows deck difficulty, retention, and throughput
 * Free tier component - Phase 1 MVP
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/theme';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';

interface DeckHealthCardProps {
  difficultyIndex: number; // 0-100
  retention: {
    young7: number;
    mature7: number;
  };
  throughput: {
    rpm: number;
    secPerReview: number;
  };
  estTimeMinutes: number;
}

export function DeckHealthCard({
  difficultyIndex,
  retention,
  throughput,
  estTimeMinutes,
}: DeckHealthCardProps) {
  const theme = useTheme();

  // Difficulty color and label
  const getDifficultyColor = (index: number): string => {
    if (index <= 30) return theme.colors.success;
    if (index <= 60) return theme.colors.warning;
    return theme.colors.danger;
  };

  const getDifficultyLabel = (index: number): string => {
    if (index <= 30) return 'Easy';
    if (index <= 60) return 'Moderate';
    return 'Challenging';
  };

  const difficultyColor = getDifficultyColor(difficultyIndex);
  const avgRetention = (retention.young7 + retention.mature7) / 2;

  const formatTime = (minutes: number): string => {
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // Map difficulty color to overlay token
  const getOverlayColor = () => {
    if (difficultyColor === theme.colors.success) return theme.colors.overlay.success;
    if (difficultyColor === theme.colors.warning) return theme.colors.overlay.warning;
    return theme.colors.overlay.danger;
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconBadge, { backgroundColor: getOverlayColor() }]}>
            <Ionicons name="fitness-outline" size={22} color={difficultyColor} />
          </View>
          <View>
            <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
              Deck Health
            </Text>
            <Text style={[styles.subtitle, { color: difficultyColor }]}>
              {getDifficultyLabel(difficultyIndex)}
            </Text>
          </View>
        </View>
        {estTimeMinutes > 0 && (
          <View style={[styles.timeBadge, { backgroundColor: theme.colors.overlay.info }]}>
            <Ionicons name="time-outline" size={16} color={theme.colors.info} />
            <Text style={[styles.timeText, { color: theme.colors.info }]}>
              {formatTime(estTimeMinutes)}
            </Text>
          </View>
        )}
      </View>

      {/* Difficulty Gauge */}
      <View style={styles.gaugeContainer}>
        <View style={styles.gaugeLabels}>
          <Text style={[styles.gaugeLabel, { color: theme.colors.textSecondary }]}>
            Difficulty
          </Text>
          <Text style={[styles.gaugeValue, { color: difficultyColor }]}>
            {Math.round(difficultyIndex)}
          </Text>
        </View>
        <View style={[styles.gaugeTrack, { backgroundColor: theme.colors.bg }]}>
          <View
            style={[
              styles.gaugeFill,
              {
                backgroundColor: difficultyColor,
                width: `${difficultyIndex}%`,
              },
            ]}
          />
        </View>
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        {/* Retention */}
        <View style={styles.statItem}>
          <View style={[styles.statIcon, { backgroundColor: theme.colors.overlay.success }]}>
            <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
          </View>
          <Text style={[styles.statValue, { color: theme.colors.textPrimary }]}>
            {Math.round(avgRetention)}%
          </Text>
          <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
            Retention
          </Text>
        </View>

        {/* Speed */}
        <View style={styles.statItem}>
          <View style={[styles.statIcon, { backgroundColor: theme.colors.overlay.warning }]}>
            <Ionicons name="flash" size={20} color={theme.colors.warning} />
          </View>
          <Text style={[styles.statValue, { color: theme.colors.textPrimary }]}>
            {throughput.rpm > 0 ? throughput.rpm.toFixed(1) : '—'}
          </Text>
          <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
            cards/min
          </Text>
        </View>

        {/* Avg Time */}
        <View style={styles.statItem}>
          <View style={[styles.statIcon, { backgroundColor: theme.colors.overlay.info }]}>
            <Ionicons name="timer-outline" size={20} color={theme.colors.info} />
          </View>
          <Text style={[styles.statValue, { color: theme.colors.textPrimary }]}>
            {throughput.secPerReview > 0 ? throughput.secPerReview.toFixed(1) : '—'}s
          </Text>
          <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
            per card
          </Text>
        </View>
      </View>

      {/* Retention Breakdown */}
      <View style={styles.retentionBreakdown}>
        <View style={styles.retentionItem}>
          <Text style={[styles.retentionLabel, { color: theme.colors.textSecondary }]}>
            Young
          </Text>
          <Text style={[styles.retentionValue, { color: theme.colors.textPrimary }]}>
            {Math.round(retention.young7)}%
          </Text>
        </View>
        <View style={[styles.separator, { backgroundColor: theme.colors.border }]} />
        <View style={styles.retentionItem}>
          <Text style={[styles.retentionLabel, { color: theme.colors.textSecondary }]}>
            Mature
          </Text>
          <Text style={[styles.retentionValue, { color: theme.colors.textPrimary }]}>
            {Math.round(retention.mature7)}%
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: s.xl,
    borderRadius: r['2xl'],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    gap: s.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.sm,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: r.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.xs,
    paddingHorizontal: s.md,
    paddingVertical: s.sm,
    borderRadius: r.full,
  },
  timeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  gaugeContainer: {
    gap: s.sm,
  },
  gaugeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gaugeLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  gaugeValue: {
    fontSize: 24,
    fontWeight: '900',
  },
  gaugeTrack: {
    height: 10,
    borderRadius: r.full,
    overflow: 'hidden',
  },
  gaugeFill: {
    height: '100%',
    borderRadius: r.full,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: s.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: s.xs,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: r.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  retentionBreakdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.md,
  },
  retentionItem: {
    flex: 1,
    alignItems: 'center',
    gap: s.xs,
  },
  separator: {
    width: 1,
    height: 30,
  },
  retentionLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  retentionValue: {
    fontSize: 18,
    fontWeight: '800',
  },
});
