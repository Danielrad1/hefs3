/**
 * Deck Counts Bar - Visual breakdown of card states
 * Free tier component - Phase 1 MVP
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/theme';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';

interface CardCounts {
  new: number;
  young: number;
  mature: number;
  suspended: number;
  buried: number;
  leeches: number;
  total: number;
}

interface DeckCountsBarProps {
  counts: CardCounts;
}

export function DeckCountsBar({ counts }: DeckCountsBarProps) {
  const theme = useTheme();

  const total = counts.total || 1; // Avoid division by zero

  const segments = [
    {
      label: 'New',
      count: counts.new,
      color: theme.colors.dataViz.new,
      icon: 'sparkles' as const,
      percentage: (counts.new / total) * 100,
    },
    {
      label: 'Young',
      count: counts.young,
      color: theme.colors.dataViz.young,
      icon: 'school' as const,
      percentage: (counts.young / total) * 100,
    },
    {
      label: 'Mature',
      count: counts.mature,
      color: theme.colors.dataViz.mature,
      icon: 'checkmark-circle' as const,
      percentage: (counts.mature / total) * 100,
    },
  ];

  const issues = [
    {
      label: 'Suspended',
      count: counts.suspended,
      color: theme.colors.textSecondary,
      icon: 'pause-circle' as const,
    },
    {
      label: 'Leeches',
      count: counts.leeches,
      color: theme.colors.danger,
      icon: 'warning' as const,
    },
  ].filter((issue) => issue.count > 0);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
          Card Distribution
        </Text>
        <Text style={[styles.total, { color: theme.colors.textSecondary }]}>
          {counts.total.toLocaleString()} total
        </Text>
      </View>

      {/* Progress Bar */}
      <View style={[styles.progressBar, { backgroundColor: theme.colors.bg }]}>
        {segments.map((segment, index) => (
          <View
            key={segment.label}
            style={[
              styles.segment,
              {
                width: `${segment.percentage}%`,
                backgroundColor: segment.color,
                borderTopLeftRadius: index === 0 ? r.full : 0,
                borderBottomLeftRadius: index === 0 ? r.full : 0,
                borderTopRightRadius: index === segments.length - 1 ? r.full : 0,
                borderBottomRightRadius: index === segments.length - 1 ? r.full : 0,
              },
            ]}
          />
        ))}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        {segments.map((segment) => (
          <View key={segment.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: segment.color }]} />
            <Ionicons name={segment.icon} size={14} color={segment.color} />
            <Text style={[styles.legendLabel, { color: theme.colors.textSecondary }]}>
              {segment.label}
            </Text>
            <Text style={[styles.legendCount, { color: theme.colors.textPrimary }]}>
              {segment.count}
            </Text>
          </View>
        ))}
      </View>

      {/* Issues (if any) */}
      {issues.length > 0 && (
        <View style={[styles.issuesContainer, { backgroundColor: theme.colors.bg }]}>
          <View style={styles.issuesHeader}>
            <Ionicons name="alert-circle-outline" size={16} color={theme.colors.textSecondary} />
            <Text style={[styles.issuesTitle, { color: theme.colors.textSecondary }]}>
              Attention Needed
            </Text>
          </View>
          <View style={styles.issuesRow}>
            {issues.map((issue) => (
              <View key={issue.label} style={styles.issueItem}>
                <Ionicons name={issue.icon} size={16} color={issue.color} />
                <Text style={[styles.issueLabel, { color: theme.colors.textSecondary }]}>
                  {issue.label}
                </Text>
                <Text style={[styles.issueCount, { color: issue.color }]}>
                  {issue.count}
                </Text>
              </View>
            ))}
          </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  total: {
    fontSize: 14,
    fontWeight: '700',
  },
  progressBar: {
    height: 12,
    borderRadius: r.full,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  segment: {
    height: '100%',
  },
  legend: {
    gap: s.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.sm,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  legendCount: {
    fontSize: 16,
    fontWeight: '800',
  },
  issuesContainer: {
    padding: s.md,
    borderRadius: r.lg,
    gap: s.sm,
  },
  issuesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.xs,
  },
  issuesTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  issuesRow: {
    flexDirection: 'row',
    gap: s.lg,
  },
  issueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.xs,
  },
  issueLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  issueCount: {
    fontSize: 15,
    fontWeight: '800',
  },
});
