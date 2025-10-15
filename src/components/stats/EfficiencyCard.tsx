/**
 * Efficiency Card - Shows study speed and efficiency metrics
 * Free tier component - Phase 2
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/theme';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';

interface EfficiencyCardProps {
  reviewsPerMin: number;
  avgSecondsPerReview: number;
  totalReviews: number;
  totalMinutes: number;
}

export function EfficiencyCard({
  reviewsPerMin,
  avgSecondsPerReview,
  totalReviews,
  totalMinutes,
}: EfficiencyCardProps) {
  const theme = useTheme();

  // Determine efficiency rating
  const getEfficiencyRating = (rpm: number): {
    label: string;
    color: string;
  } => {
    if (rpm >= 6) return { label: 'Excellent', color: theme.colors.success };
    if (rpm >= 4) return { label: 'Good', color: theme.colors.info };
    if (rpm >= 2) return { label: 'Moderate', color: theme.colors.warning };
    return { label: 'Relaxed', color: theme.colors.textSecondary };
  };

  const rating = getEfficiencyRating(reviewsPerMin);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconBadge, { backgroundColor: theme.colors.overlay.success }]}>
            <Ionicons name="flash-outline" size={22} color={rating.color} />
          </View>
          <View>
            <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
              Study Efficiency
            </Text>
            <Text style={[styles.subtitle, { color: rating.color }]}>
              {rating.label} Pace
            </Text>
          </View>
        </View>
      </View>

      {/* Main Speed Metric */}
      <View style={styles.mainMetric}>
        <View style={styles.speedDisplay}>
          <Text style={[styles.speedValue, { color: rating.color }]}>
            {reviewsPerMin > 0 ? reviewsPerMin.toFixed(1) : '—'}
          </Text>
          <Text style={[styles.speedUnit, { color: theme.colors.textSecondary }]}>
            cards/min
          </Text>
        </View>
        <View style={[styles.progressBar, { backgroundColor: theme.colors.bg }]}>
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: rating.color,
                width: `${Math.min((reviewsPerMin / 10) * 100, 100)}%`,
              },
            ]}
          />
        </View>
      </View>

      {/* Metrics Grid */}
      <View style={styles.metricsGrid}>
        <View style={styles.metricBox}>
          <View style={[styles.metricIcon, { backgroundColor: theme.colors.overlay.info }]}>
            <Ionicons name="timer-outline" size={20} color={theme.colors.info} />
          </View>
          <Text style={[styles.metricValue, { color: theme.colors.textPrimary }]}>
            {avgSecondsPerReview > 0 ? avgSecondsPerReview.toFixed(1) : '—'}s
          </Text>
          <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>
            Avg Time/Card
          </Text>
        </View>

        <View style={styles.metricBox}>
          <View style={[styles.metricIcon, { backgroundColor: theme.colors.overlay.primary }]}>
            <Ionicons name="layers-outline" size={20} color={theme.colors.accent} />
          </View>
          <Text style={[styles.metricValue, { color: theme.colors.textPrimary }]}>
            {totalReviews}
          </Text>
          <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>
            Total Reviews
          </Text>
        </View>

        <View style={styles.metricBox}>
          <View style={[styles.metricIcon, { backgroundColor: theme.colors.overlay.warning }]}>
            <Ionicons name="time-outline" size={20} color={theme.colors.warning} />
          </View>
          <Text style={[styles.metricValue, { color: theme.colors.textPrimary }]}>
            {totalMinutes}m
          </Text>
          <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>
            Study Time
          </Text>
        </View>
      </View>

      {/* Insight */}
      {reviewsPerMin > 0 && (
        <View style={[styles.insightBox, { backgroundColor: theme.colors.bg }]}>
          <Ionicons name="information-circle-outline" size={16} color={theme.colors.textSecondary} />
          <Text style={[styles.insightText, { color: theme.colors.textSecondary }]}>
            {reviewsPerMin >= 5
              ? 'Fast and focused! Great study habits.'
              : reviewsPerMin >= 3
              ? 'Solid pace. Balance speed with understanding.'
              : 'Take your time to understand each card thoroughly.'}
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
  mainMetric: {
    gap: s.md,
  },
  speedDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: s.xs,
  },
  speedValue: {
    fontSize: 48,
    fontWeight: '900',
    lineHeight: 48,
  },
  speedUnit: {
    fontSize: 16,
    fontWeight: '700',
  },
  progressBar: {
    height: 8,
    borderRadius: r.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: r.full,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: s.md,
  },
  metricBox: {
    flex: 1,
    alignItems: 'center',
    gap: s.xs,
  },
  metricIcon: {
    width: 40,
    height: 40,
    borderRadius: r.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  insightBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.sm,
    padding: s.md,
    borderRadius: r.lg,
  },
  insightText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
});
