/**
 * Forecast Chart - Shows predicted workload over time
 * Premium tier component - Phase 6
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/theme';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';
import { ForecastPoint } from '../../services/anki/StatsService';

interface ForecastChartProps {
  points: ForecastPoint[];
  stacked?: boolean;
  days: 7 | 30;
}

export function ForecastChart({ points, stacked = true, days }: ForecastChartProps) {
  const theme = useTheme();

  // Find max total for scaling
  const maxTotal = Math.max(
    ...points.map(p => p.newCount + p.learnCount + p.reviewCount),
    1
  );

  // Format date for display
  const formatDate = (dateStr: string, index: number): string => {
    if (days === 7) {
      const date = new Date(dateStr);
      const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return dayLabels[date.getDay()];
    } else {
      // For 30 days, show date
      const date = new Date(dateStr);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    }
  };

  // Calculate total reviews
  const totalForecast = points.reduce(
    (sum, p) => sum + p.newCount + p.learnCount + p.reviewCount,
    0
  );

  const avgDaily = totalForecast / points.length;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface2 }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconBadge, { backgroundColor: theme.colors.overlay.primary }]}>
            <Ionicons name="trending-up-outline" size={22} color={theme.colors.primary} />
          </View>
          <View>
            <Text style={[styles.title, { color: theme.colors.textHigh }]}>
              Upcoming Reviews
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.textMed }]}>
              Next {days} days (estimated)
            </Text>
          </View>
        </View>
      </View>

      {/* Summary Stats */}
      <View style={styles.summaryGrid}>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: theme.colors.textHigh }]}>
            {Math.round(avgDaily)}
          </Text>
          <Text style={[styles.summaryLabel, { color: theme.colors.textMed }]}>
            Cards/Day (Avg)
          </Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: theme.colors.textHigh }]}>
            {totalForecast}
          </Text>
          <Text style={[styles.summaryLabel, { color: theme.colors.textMed }]}>
            Total Cards
          </Text>
        </View>
      </View>

      {/* Chart */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chartScroll}
      >
        <View style={styles.chart}>
          {points.map((point, index) => {
            const total = point.newCount + point.learnCount + point.reviewCount;
            const height = Math.max((total / maxTotal) * 120, 4);

            return (
              <View key={point.date} style={styles.barWrapper}>
                {/* Bar */}
                <View style={styles.barContainer}>
                  {stacked ? (
                    <View style={[styles.bar, { height }]}>
                      {/* Review (bottom) */}
                      {point.reviewCount > 0 && (
                        <View
                          style={[
                            styles.barSegment,
                            {
                              backgroundColor: theme.colors.dataViz.mature,
                              height: `${(point.reviewCount / total) * 100}%`,
                            },
                          ]}
                        />
                      )}
                      {/* Learn (middle) */}
                      {point.learnCount > 0 && (
                        <View
                          style={[
                            styles.barSegment,
                            {
                              backgroundColor: theme.colors.dataViz.young,
                              height: `${(point.learnCount / total) * 100}%`,
                            },
                          ]}
                        />
                      )}
                      {/* New (top) */}
                      {point.newCount > 0 && (
                        <View
                          style={[
                            styles.barSegment,
                            {
                              backgroundColor: theme.colors.dataViz.new,
                              height: `${(point.newCount / total) * 100}%`,
                            },
                          ]}
                        />
                      )}
                    </View>
                  ) : (
                    <View style={[styles.bar, { height, backgroundColor: theme.colors.primary }]} />
                  )}
                  
                  {/* Total count on bar */}
                  {total > 0 && (
                    <Text style={[styles.barCount, { color: theme.colors.textLow }]}>
                      {total}
                    </Text>
                  )}
                </View>

                {/* Date Label */}
                <Text
                  style={[
                    styles.dateLabel,
                    {
                      color: index === 0 ? theme.colors.textHigh : theme.colors.textMed,
                      fontWeight: index === 0 ? '800' : '600',
                    },
                  ]}
                >
                  {formatDate(point.date, index)}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Legend */}
      {stacked && (
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.colors.dataViz.new }]} />
            <Text style={[styles.legendText, { color: theme.colors.textMed }]}>New</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.colors.dataViz.young }]} />
            <Text style={[styles.legendText, { color: theme.colors.textMed }]}>Learn</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.colors.dataViz.mature }]} />
            <Text style={[styles.legendText, { color: theme.colors.textMed }]}>Review</Text>
          </View>
        </View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: s.md,
    borderRadius: r['2xl'],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
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
  summaryGrid: {
    flexDirection: 'row',
    gap: s.sm,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  chartScroll: {
    paddingHorizontal: s.xs,
  },
  chart: {
    flexDirection: 'row',
    gap: s.sm,
    alignItems: 'flex-end',
    minWidth: '100%',
  },
  barWrapper: {
    flex: 1,
    alignItems: 'center',
    gap: s.xs,
    minWidth: 32,
  },
  barContainer: {
    width: '100%',
    alignItems: 'center',
    gap: s.xs,
  },
  bar: {
    width: '100%',
    borderRadius: r.sm,
    overflow: 'hidden',
    minHeight: 4,
    flexDirection: 'column-reverse', // Stack from bottom
  },
  barSegment: {
    width: '100%',
  },
  barCount: {
    fontSize: 10,
    fontWeight: '700',
  },
  dateLabel: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: s.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.xs,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 13,
    fontWeight: '700',
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
