/**
 * Backlog Clear-By Card - Projects when backlog will be cleared
 * Premium tier component - Phase 6
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/theme';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';

interface BacklogClearByCardProps {
  backlogCount: number;
  avgReviewsPerDay: number;
  todayNewLimit?: number;
  medianDaysOverdue?: number;
  overduenessIndex?: number;
}

export function BacklogClearByCard({
  backlogCount,
  avgReviewsPerDay,
  todayNewLimit = 0,
  medianDaysOverdue = 0,
  overduenessIndex = 0,
}: BacklogClearByCardProps) {
  const theme = useTheme();

  // Calculate gross days to clear backlog
  const grossDaysToCleared = backlogCount / Math.max(1, avgReviewsPerDay);
  
  // Calculate with ±20% sensitivity for best/worst case
  const bestCaseDays = backlogCount / Math.max(1, avgReviewsPerDay * 1.2);
  const worstCaseDays = backlogCount / Math.max(1, avgReviewsPerDay * 0.8);
  
  // Format target date
  const getTargetDate = (days: number): string => {
    const target = new Date();
    target.setDate(target.getDate() + Math.ceil(days));
    return target.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Determine urgency level
  const getUrgencyColor = (days: number): string => {
    if (days <= 7) return theme.colors.success;
    if (days <= 30) return theme.colors.info;
    if (days <= 90) return theme.colors.warning;
    return theme.colors.danger;
  };

  // Get status message
  const getStatusMessage = (days: number): string => {
    if (backlogCount === 0) return 'No backlog! You\'re all caught up.';
    if (avgReviewsPerDay < 1) return 'Start reviewing to see projection';
    if (days <= 7) return 'Almost there! Keep up the momentum.';
    if (days <= 30) return 'On track for a clear month ahead';
    if (days <= 90) return 'Stay consistent to reach your goal';
    return 'Break it into smaller daily targets';
  };

  // Determine pressure level
  const getPressureLevel = (): {
    level: string;
    color: string;
    icon: string;
  } => {
    if (backlogCount === 0) {
      return {
        level: 'No Backlog',
        color: theme.colors.success,
        icon: 'checkmark-circle',
      };
    }
    if (overduenessIndex < 5) {
      return {
        level: 'Light',
        color: theme.colors.info,
        icon: 'information-circle',
      };
    }
    if (overduenessIndex < 15) {
      return {
        level: 'Moderate',
        color: theme.colors.warning,
        icon: 'alert-circle',
      };
    }
    return {
      level: 'Heavy',
      color: theme.colors.danger,
      icon: 'warning',
    };
  };

  const pressure = getPressureLevel();

  const urgencyColor = getUrgencyColor(grossDaysToCleared);
  const statusMessage = getStatusMessage(grossDaysToCleared);

  // Show nothing if no backlog
  if (backlogCount === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.surface2 }]}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.iconBadge, { backgroundColor: theme.colors.overlay.success }]}>
              <Ionicons name="checkmark-circle" size={24} color={theme.colors.success} />
            </View>
            <View>
              <Text style={[styles.title, { color: theme.colors.textHigh }]}>
                Backlog Clear-By
              </Text>
              <Text style={[styles.subtitle, { color: theme.colors.success }]}>
                All caught up!
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.infoBox, { backgroundColor: theme.colors.bg }]}>
          <Ionicons name="information-circle-outline" size={16} color={theme.colors.textMed} />
          <Text style={[styles.infoText, { color: theme.colors.textMed }]}>
            No overdue reviews. Great work staying on top of your cards!
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface2 }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconBadge, { backgroundColor: theme.colors.overlay.primary }]}>
            <Ionicons name="calendar-outline" size={22} color={theme.colors.primary} />
          </View>
          <View>
            <Text style={[styles.title, { color: theme.colors.textHigh }]}>
              Backlog Clear-By
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.textMed }]}>
              Based on 7-day average
            </Text>
          </View>
        </View>
      </View>

      {/* Main Projection */}
      <View style={styles.projectionSection}>
        <Text style={[styles.projectionValue, { color: theme.colors.textHigh }]}>
          {Math.ceil(grossDaysToCleared)}
        </Text>
        <Text style={[styles.projectionLabel, { color: theme.colors.textMed }]}>
          days to clear backlog
        </Text>
        <View style={styles.targetDate}>
          <Ionicons name="flag-outline" size={16} color={theme.colors.textLow} />
          <Text style={[styles.targetDateText, { color: theme.colors.textMed }]}>
            {getTargetDate(grossDaysToCleared)}
          </Text>
        </View>
      </View>

      {/* Metrics Grid */}
      <View style={[styles.metricsGrid, { backgroundColor: theme.colors.bg }]}>
        <View style={styles.metricItem}>
          <Text style={[styles.metricValue, { color: theme.colors.textHigh }]}>
            {backlogCount}
          </Text>
          <Text style={[styles.metricLabel, { color: theme.colors.textMed }]}>
            Overdue
          </Text>
        </View>
        <View style={[styles.metricDivider, { backgroundColor: theme.colors.border }]} />
        <View style={styles.metricItem}>
          <Text style={[styles.metricValue, { color: theme.colors.textHigh }]}>
            {avgReviewsPerDay.toFixed(1)}
          </Text>
          <Text style={[styles.metricLabel, { color: theme.colors.textMed }]}>
            Daily Avg
          </Text>
        </View>
        <View style={[styles.metricDivider, { backgroundColor: theme.colors.border }]} />
        <View style={styles.metricItem}>
          <Text style={[styles.metricValue, { color: theme.colors.textHigh }]}>
            {Math.round(medianDaysOverdue)}
          </Text>
          <Text style={[styles.metricLabel, { color: theme.colors.textMed }]}>
            Median Days
          </Text>
        </View>
      </View>

      {/* Pressure Badge */}
      <View style={[styles.pressureBadge, { backgroundColor: theme.colors.bg }]}>
        <Ionicons name={pressure.icon as any} size={16} color={pressure.color} />
        <Text style={[styles.pressureText, { color: pressure.color }]}>
          {pressure.level} Pressure
        </Text>
        <Text style={[styles.pressureIndex, { color: theme.colors.textMed }]}>
          • Index: {overduenessIndex.toFixed(1)}
        </Text>
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
  premiumBadge: {
    width: 28,
    height: 28,
    borderRadius: r.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  projectionSection: {
    alignItems: 'center',
    gap: s.sm,
  },
  projectionValue: {
    fontSize: 48,
    fontWeight: '900',
    lineHeight: 48,
  },
  projectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: 'textMed',
  },
  targetDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.xs,
    marginTop: s.xs,
  },
  targetDateText: {
    fontSize: 14,
    fontWeight: '600',
  },
  metricsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: s.md,
    borderRadius: r.lg,
    gap: s.md,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  metricDivider: {
    width: 1,
    height: 36,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.sm,
    padding: s.md,
    borderRadius: r.lg,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  pressureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s.xs,
    padding: s.md,
    borderRadius: r.lg,
  },
  pressureText: {
    fontSize: 14,
    fontWeight: '800',
  },
  pressureIndex: {
    fontSize: 13,
    fontWeight: '600',
  },
});
