/**
 * Answer Buttons Distribution - Shows ease distribution by card state
 * Premium tier component - Phase 6 (Anki parity feature)
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/theme';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';

interface StateDistribution {
  state: 'New' | 'Young' | 'Mature';
  again: number;
  hard: number;
  good: number;
  easy: number;
  total: number;
}

interface AnswerButtonsDistributionProps {
  distributions: StateDistribution[];
}

export function AnswerButtonsDistribution({ distributions }: AnswerButtonsDistributionProps) {
  const theme = useTheme();
  const [expandedState, setExpandedState] = useState<string | null>(null);

  // Button colors
  const buttonColors = {
    again: theme.colors.danger,
    hard: theme.colors.warning,
    good: theme.colors.info,
    easy: theme.colors.success,
  };

  // Get state icon
  const getStateIcon = (state: string): string => {
    switch (state) {
      case 'New':
        return 'school-outline';
      case 'Young':
        return 'leaf-outline';
      case 'Mature':
        return 'trophy-outline';
      default:
        return 'help-outline';
    }
  };

  // Calculate percentage
  const getPct = (count: number, total: number): number => {
    return total > 0 ? (count / total) * 100 : 0;
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface2 }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconBadge, { backgroundColor: theme.colors.overlay.primary }]}>
            <Ionicons name="analytics-outline" size={22} color={theme.colors.primary} />
          </View>
          <View>
            <Text style={[styles.title, { color: theme.colors.textHigh }]}>
              Answer Distribution
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.textMed }]}>
              New (&lt;1d) • Young (&lt;21d) • Mature (21d+)
            </Text>
          </View>
        </View>
      </View>

      {/* State Bars */}
      <View style={styles.statesContainer}>
        {distributions.map(dist => {
          const isExpanded = expandedState === dist.state;
          const againPct = getPct(dist.again, dist.total);
          const hardPct = getPct(dist.hard, dist.total);
          const goodPct = getPct(dist.good, dist.total);
          const easyPct = getPct(dist.easy, dist.total);

          return (
            <Pressable
              key={dist.state}
              onPress={() => setExpandedState(isExpanded ? null : dist.state)}
              style={[styles.stateRow, { backgroundColor: theme.colors.bg }]}
            >
              <View style={styles.stateHeader}>
                <View style={styles.stateLeft}>
                  <Ionicons
                    name={getStateIcon(dist.state) as any}
                    size={18}
                    color={theme.colors.textHigh}
                  />
                  <Text style={[styles.stateName, { color: theme.colors.textHigh }]}>
                    {dist.state}
                  </Text>
                </View>
                <Text style={[styles.stateTotal, { color: theme.colors.textMed }]}>
                  {dist.total}
                </Text>
              </View>

              {/* Stacked Bar */}
              <View style={[styles.stackedBar, { backgroundColor: theme.colors.border }]}>
                {dist.again > 0 && (
                  <View
                    style={[
                      styles.barSegment,
                      {
                        backgroundColor: buttonColors.again,
                        width: `${againPct}%`,
                      },
                    ]}
                  />
                )}
                {dist.hard > 0 && (
                  <View
                    style={[
                      styles.barSegment,
                      {
                        backgroundColor: buttonColors.hard,
                        width: `${hardPct}%`,
                      },
                    ]}
                  />
                )}
                {dist.good > 0 && (
                  <View
                    style={[
                      styles.barSegment,
                      {
                        backgroundColor: buttonColors.good,
                        width: `${goodPct}%`,
                      },
                    ]}
                  />
                )}
                {dist.easy > 0 && (
                  <View
                    style={[
                      styles.barSegment,
                      {
                        backgroundColor: buttonColors.easy,
                        width: `${easyPct}%`,
                      },
                    ]}
                  />
                )}
              </View>

              {/* Expanded Details */}
              {isExpanded && (
                <View style={styles.detailsGrid}>
                  <View style={styles.detailItem}>
                    <View
                      style={[styles.detailDot, { backgroundColor: buttonColors.again }]}
                    />
                    <Text style={[styles.detailLabel, { color: theme.colors.textMed }]}>
                      Again
                    </Text>
                    <Text style={[styles.detailValue, { color: theme.colors.textHigh }]}>
                      {Math.round(againPct)}%
                    </Text>
                    <Text style={[styles.detailCount, { color: theme.colors.textLow }]}>
                      ({dist.again})
                    </Text>
                  </View>

                  <View style={styles.detailItem}>
                    <View style={[styles.detailDot, { backgroundColor: buttonColors.hard }]} />
                    <Text style={[styles.detailLabel, { color: theme.colors.textMed }]}>
                      Hard
                    </Text>
                    <Text style={[styles.detailValue, { color: theme.colors.textHigh }]}>
                      {Math.round(hardPct)}%
                    </Text>
                    <Text style={[styles.detailCount, { color: theme.colors.textLow }]}>
                      ({dist.hard})
                    </Text>
                  </View>

                  <View style={styles.detailItem}>
                    <View style={[styles.detailDot, { backgroundColor: buttonColors.good }]} />
                    <Text style={[styles.detailLabel, { color: theme.colors.textMed }]}>
                      Good
                    </Text>
                    <Text style={[styles.detailValue, { color: theme.colors.textHigh }]}>
                      {Math.round(goodPct)}%
                    </Text>
                    <Text style={[styles.detailCount, { color: theme.colors.textLow }]}>
                      ({dist.good})
                    </Text>
                  </View>

                  <View style={styles.detailItem}>
                    <View style={[styles.detailDot, { backgroundColor: buttonColors.easy }]} />
                    <Text style={[styles.detailLabel, { color: theme.colors.textMed }]}>
                      Easy
                    </Text>
                    <Text style={[styles.detailValue, { color: theme.colors.textHigh }]}>
                      {Math.round(easyPct)}%
                    </Text>
                    <Text style={[styles.detailCount, { color: theme.colors.textLow }]}>
                      ({dist.easy})
                    </Text>
                  </View>
                </View>
              )}
            </Pressable>
          );
        })}
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
  statesContainer: {
    gap: s.md,
  },
  stateRow: {
    padding: s.md,
    borderRadius: r.lg,
    gap: s.sm,
  },
  stateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stateLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.sm,
  },
  stateName: {
    fontSize: 15,
    fontWeight: '800',
  },
  stateTotal: {
    fontSize: 13,
    fontWeight: '700',
  },
  stackedBar: {
    height: 8,
    borderRadius: r.full,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  barSegment: {
    height: '100%',
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: s.sm,
    marginTop: s.md,
    paddingTop: s.sm,
  },
  detailItem: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.xs,
    marginBottom: s.xs,
  },
  detailDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  detailCount: {
    fontSize: 11,
    fontWeight: '600',
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
});
