/**
 * Stats Card Today - Displays today's due load with time estimate
 * Free tier component - Phase 1 MVP
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/theme';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';

interface StatsCardTodayProps {
  dueCount: number;
  learnCount: number;
  newCount: number;
  estTimeMinutes: number;
}

export function StatsCardToday({
  dueCount,
  learnCount,
  newCount,
  estTimeMinutes,
}: StatsCardTodayProps) {
  const theme = useTheme();

  const formatTime = (minutes: number): string => {
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconBadge, { backgroundColor: theme.colors.overlay.primary }]}>
            <Ionicons name="today-outline" size={22} color={theme.colors.accent} />
          </View>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
            Today's Load
          </Text>
        </View>
        {estTimeMinutes > 0 && (
          <View style={[styles.timeBadge, { backgroundColor: theme.colors.overlay.warning }]}>
            <Ionicons name="time-outline" size={16} color={theme.colors.warning} />
            <Text style={[styles.timeText, { color: theme.colors.warning }]}>
              {formatTime(estTimeMinutes)}
            </Text>
          </View>
        )}
      </View>

      {/* Main Stats */}
      <View style={styles.statsRow}>
        {/* Due Count */}
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: theme.colors.textPrimary }]}>
            {dueCount}
          </Text>
          <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
            Due Now
          </Text>
        </View>

        {/* Learning */}
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: theme.colors.textPrimary }]}>
            {learnCount}
          </Text>
          <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
          </Text>
        </View>

        {/* New */}
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: theme.colors.textPrimary }]}>
            {newCount}
          </Text>
          <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
            New
          </Text>
        </View>
      </View>

      {/* Progress Bar */}
      {dueCount > 0 && (
        <View style={styles.progressContainer}>
          <View style={[styles.progressTrack, { backgroundColor: theme.colors.surface1 }]}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: theme.colors.accent,
                  width: `${Math.min((learnCount / dueCount) * 100, 100)}%`,
                },
              ]}
            />
          </View>
          <Text style={[styles.progressText, { color: theme.colors.textTertiary }]}>
            {learnCount} of {dueCount} in learning
          </Text>
        </View>
      )}
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: s.lg,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.sm,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: r.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
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
  statsRow: {
    flexDirection: 'row',
    gap: s.md,
    marginBottom: s.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: s.xs,
  },
  statValue: {
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 32,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  progressContainer: {
    gap: s.xs,
  },
  progressTrack: {
    height: 6,
    borderRadius: r.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: r.full,
  },
  progressText: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
});
