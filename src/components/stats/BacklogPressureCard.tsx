/**
 * Backlog Pressure Card - Shows overdue cards and burndown metrics
 * Free tier component - Phase 2
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/theme';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';

interface BacklogPressureCardProps {
  backlogCount: number;
  medianDaysOverdue: number;
  overduenessIndex: number;
}

export function BacklogPressureCard({
  backlogCount,
  medianDaysOverdue,
  overduenessIndex,
}: BacklogPressureCardProps) {
  const theme = useTheme();

  // Determine pressure level and color
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

  // Map pressure color to overlay token
  const getOverlayColor = () => {
    if (pressure.color === theme.colors.success) return theme.colors.overlay.success;
    if (pressure.color === theme.colors.warning) return theme.colors.overlay.warning;
    if (pressure.color === theme.colors.danger) return theme.colors.overlay.danger;
    return theme.colors.overlay.info;
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface2 }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconBadge, { backgroundColor: getOverlayColor() }]}>
            <Ionicons name={pressure.icon as any} size={22} color={pressure.color} />
          </View>
          <View>
            <Text style={[styles.title, { color: theme.colors.textHigh }]}>
              Backlog Pressure
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.textMed }]}>
              {pressure.level}
            </Text>
          </View>
        </View>
      </View>

      {/* Main Metrics */}
      {backlogCount > 0 ? (
        <>
          <View style={styles.mainMetric}>
            <Text style={[styles.mainValue, { color: theme.colors.textHigh }]}>
              {backlogCount}
            </Text>
            <Text style={[styles.mainLabel, { color: theme.colors.textMed }]}>
              Cards Overdue
            </Text>
          </View>

          {/* Secondary Metrics */}
          <View style={styles.metricsRow}>
            <View style={styles.metricItem}>
              <Text style={[styles.metricValue, { color: theme.colors.textHigh }]}>
                {Math.round(medianDaysOverdue)}
              </Text>
              <Text style={[styles.metricLabel, { color: theme.colors.textMed }]}>
                Median Days
              </Text>
            </View>

            <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

            <View style={styles.metricItem}>
              <Text style={[styles.metricValue, { color: theme.colors.textHigh }]}>
                {overduenessIndex.toFixed(1)}
              </Text>
              <Text style={[styles.metricLabel, { color: theme.colors.textMed }]}>
                Pressure Index
              </Text>
            </View>
          </View>

          {/* Advice */}
          <View style={[styles.adviceBox, { backgroundColor: getOverlayColor() }]}>
            <Ionicons name="bulb-outline" size={16} color={pressure.color} />
            <Text style={[styles.adviceText, { color: theme.colors.textMed }]}>
              {backlogCount > 50
                ? 'Focus on clearing overdue cards to maintain retention'
                : backlogCount > 20
                ? 'Steady progress will clear this backlog soon'
                : 'Small backlog - keep up the good work!'}
            </Text>
          </View>
        </>
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="checkmark-circle-outline" size={64} color={theme.colors.success} />
          <Text style={[styles.emptyTitle, { color: theme.colors.textHigh }]}>
            All Clear!
          </Text>
          <Text style={[styles.emptyText, { color: theme.colors.textMed }]}>
            You have no overdue cards. Excellent work staying on top of reviews!
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
    alignItems: 'center',
    gap: s.xs,
  },
  mainValue: {
    fontSize: 56,
    fontWeight: '900',
    lineHeight: 56,
  },
  mainLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.lg,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
    gap: s.xs,
  },
  metricValue: {
    fontSize: 28,
    fontWeight: '800',
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  divider: {
    width: 1,
    height: 40,
  },
  adviceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.sm,
    padding: s.md,
    borderRadius: r.lg,
  },
  adviceText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: s.xl,
    gap: s.md,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 280,
  },
});
