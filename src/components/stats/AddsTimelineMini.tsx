/**
 * Adds Timeline Mini - Shows cards added over time as sparkline
 * Free tier component - Phase 6
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/theme';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';

interface AddsTimelineMiniProps {
  points: Array<{ date: string; count: number }>;
  days?: number;
}

export function AddsTimelineMini({ points, days = 30 }: AddsTimelineMiniProps) {
  const theme = useTheme();

  // Calculate stats
  const totalAdds = points.reduce((sum, p) => sum + p.count, 0);
  const avgPerDay = totalAdds / points.length;
  const maxCount = Math.max(...points.map(p => p.count), 1);

  // Get trend (compare first and second half)
  const midpoint = Math.floor(points.length / 2);
  const firstHalfAvg =
    points.slice(0, midpoint).reduce((sum, p) => sum + p.count, 0) / midpoint;
  const secondHalfAvg =
    points.slice(midpoint).reduce((sum, p) => sum + p.count, 0) /
    (points.length - midpoint);
  const isIncreasing = secondHalfAvg > firstHalfAvg;
  const isDecreasing = secondHalfAvg < firstHalfAvg * 0.8; // 20% decrease threshold

  const getTrendIcon = (): string => {
    if (isIncreasing) return 'trending-up';
    if (isDecreasing) return 'trending-down';
    return 'remove';
  };

  const getTrendColor = (): string => {
    if (isIncreasing) return theme.colors.success;
    if (isDecreasing) return theme.colors.warning;
    return theme.colors.info;
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface2 }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconBadge, { backgroundColor: theme.colors.overlay.primary }]}>
            <Ionicons name="add-circle-outline" size={20} color={theme.colors.primary} />
          </View>
          <View>
            <Text style={[styles.title, { color: theme.colors.textHigh }]}>
              Learning Velocity
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.textMed }]}>
              Last {days} days
            </Text>
          </View>
        </View>
        <View style={styles.trendBadge}>
          <Ionicons name={getTrendIcon() as any} size={16} color={getTrendColor()} />
        </View>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: theme.colors.textHigh }]}>
            {totalAdds}
          </Text>
          <Text style={[styles.statLabel, { color: theme.colors.textMed }]}>Total</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: theme.colors.textHigh }]}>
            {avgPerDay.toFixed(1)}
          </Text>
          <Text style={[styles.statLabel, { color: theme.colors.textMed }]}>Avg/Day</Text>
        </View>
      </View>

      {/* Sparkline */}
      <View style={styles.chartContainer}>
        <View style={styles.chart}>
          {points.map((point, index) => {
            const height = Math.max((point.count / maxCount) * 40, 2);
            const isToday = index === points.length - 1;

            return (
              <View key={point.date} style={styles.barWrapper}>
                <View
                  style={[
                    styles.bar,
                    {
                      height,
                      backgroundColor: isToday
                        ? theme.colors.primary
                        : theme.colors.dataViz.young,
                      opacity: point.count > 0 ? 1 : 0.3,
                    },
                  ]}
                />
              </View>
            );
          })}
        </View>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: s.md,
    borderRadius: r.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    gap: s.sm,
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
    width: 36,
    height: 36,
    borderRadius: r.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  trendBadge: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: s.md,
  },
  statItem: {
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  chartContainer: {
    height: 40,
  },
  chart: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 1,
  },
  barWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderRadius: 1,
  },
  infoText: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
});
