/**
 * Retention Card - Shows young vs mature retention rates
 * Free tier component - Phase 1 MVP
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/theme';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';

interface RetentionCardProps {
  retention7: number;
  retention30?: number;
  againRate7: number;
  againRate30?: number;
  showBothPeriods?: boolean;
}

export function RetentionCard({
  retention7,
  retention30,
  againRate7,
  againRate30,
  showBothPeriods = false,
}: RetentionCardProps) {
  const theme = useTheme();

  const getRetentionColor = (retention: number): string => {
    if (retention >= 90) return theme.colors.success;
    if (retention >= 80) return theme.colors.info;
    if (retention >= 70) return theme.colors.warning;
    return theme.colors.danger;
  };

  const getRetentionLabel = (retention: number): string => {
    if (retention >= 90) return 'Excellent';
    if (retention >= 80) return 'Good';
    if (retention >= 70) return 'Fair';
    return 'Needs Work';
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconBadge, { backgroundColor: theme.colors.overlay.success }]}>
            <Ionicons name="checkmark-circle-outline" size={22} color={theme.colors.success} />
          </View>
          <View>
            <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
              Retention Rate
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
              Last 7 days
            </Text>
          </View>
        </View>
      </View>

      {/* Main Retention */}
      <View style={styles.mainStat}>
        <View style={styles.mainStatTop}>
          <Text style={[styles.mainValue, { color: getRetentionColor(retention7) }]}>
            {Math.round(retention7)}%
          </Text>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor:
                  retention7 >= 90
                    ? theme.colors.overlay.success
                    : retention7 >= 80
                    ? theme.colors.overlay.info
                    : retention7 >= 70
                    ? theme.colors.overlay.warning
                    : theme.colors.overlay.danger,
              },
            ]}
          >
            <Text style={[styles.statusText, { color: getRetentionColor(retention7) }]}>
              {getRetentionLabel(retention7)}
            </Text>
          </View>
        </View>
        <View style={[styles.progressBar, { backgroundColor: theme.colors.bg }]}>
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: getRetentionColor(retention7),
                width: `${Math.min(retention7, 100)}%`,
              },
            ]}
          />
        </View>
      </View>

      {/* Again Rate */}
      <View style={styles.statsGrid}>
        <View style={styles.gridItem}>
          <Text style={[styles.gridValue, { color: theme.colors.danger }]}>
            {Math.round(againRate7)}%
          </Text>
          <Text style={[styles.gridLabel, { color: theme.colors.textSecondary }]}>
            Again Rate
          </Text>
        </View>

        {showBothPeriods && retention30 !== undefined && (
          <View style={styles.gridItem}>
            <Text style={[styles.gridValue, { color: getRetentionColor(retention30) }]}>
              {Math.round(retention30)}%
            </Text>
            <Text style={[styles.gridLabel, { color: theme.colors.textSecondary }]}>
              30-Day
            </Text>
          </View>
        )}
      </View>

      {/* Info Text */}
      <Text style={[styles.infoText, { color: theme.colors.textTertiary }]}>
        {retention7 >= 85
          ? 'Great retention! Your study routine is working.'
          : retention7 >= 75
          ? 'Good progress. Consider reviewing struggling cards.'
          : 'Focus on difficult cards to improve retention.'}
      </Text>
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
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  mainStat: {
    gap: s.md,
  },
  mainStatTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mainValue: {
    fontSize: 48,
    fontWeight: '800',
    lineHeight: 48,
  },
  statusBadge: {
    paddingHorizontal: s.md,
    paddingVertical: s.sm,
    borderRadius: r.full,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '800',
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
  statsGrid: {
    flexDirection: 'row',
    gap: s.md,
  },
  gridItem: {
    flex: 1,
    alignItems: 'center',
    gap: s.xs,
  },
  gridValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  gridLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  infoText: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    fontWeight: '500',
  },
});
