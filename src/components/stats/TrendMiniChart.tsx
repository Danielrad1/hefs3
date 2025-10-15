/**
 * Trend Mini Chart - Shows 7-day review and time trend sparkline
 * Free tier component - Phase 1 MVP
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/theme';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';

interface TrendPoint {
  date: string;
  value: number;
}

interface TrendMiniChartProps {
  reviewTrend: TrendPoint[]; // Last 7 days
  timeTrend: TrendPoint[]; // Last 7 days (minutes)
  currentValue: number;
  previousValue: number;
  metric: 'reviews' | 'time';
}

export function TrendMiniChart({
  reviewTrend,
  timeTrend,
  currentValue,
  previousValue,
  metric,
}: TrendMiniChartProps) {
  const theme = useTheme();

  const trend = metric === 'reviews' ? reviewTrend : timeTrend;
  const maxValue = Math.max(...trend.map((t) => t.value), 1);

  // Calculate trend direction
  const change = currentValue - previousValue;
  const changePercent = previousValue > 0 ? (change / previousValue) * 100 : 0;
  const isPositive = change > 0;
  const isNeutral = Math.abs(changePercent) < 5;

  const trendColor = isNeutral
    ? theme.colors.textSecondary
    : isPositive
    ? theme.colors.success
    : theme.colors.danger;

  const trendIcon = isNeutral
    ? 'remove-outline'
    : isPositive
    ? 'trending-up'
    : 'trending-down';

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface2 }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View
            style={[
              styles.iconBadge,
              {
                backgroundColor:
                  metric === 'reviews'
                    ? theme.colors.overlay.info
                    : theme.colors.overlay.warning,
              },
            ]}
          >
            <Ionicons
              name={metric === 'reviews' ? 'stats-chart' : 'time-outline'}
              size={20}
              color={metric === 'reviews' ? theme.colors.dataViz.reviews : theme.colors.dataViz.time}
            />
          </View>
          <Text style={[styles.title, { color: theme.colors.textHigh }]}>
            {metric === 'reviews' ? 'Review Trend' : 'Time Trend'}
          </Text>
        </View>
        <View
          style={[
            styles.trendBadge,
            {
              backgroundColor: isNeutral
                ? theme.colors.overlay.info
                : isPositive
                ? theme.colors.overlay.success
                : theme.colors.overlay.danger,
            },
          ]}
        >
          <Ionicons name={trendIcon} size={16} color={trendColor} />
          <Text style={[styles.trendText, { color: trendColor }]}>
            {Math.abs(changePercent).toFixed(0)}%
          </Text>
        </View>
      </View>

      {/* Current Value */}
      <View style={styles.currentValue}>
        <Text
          style={[
            styles.valueText,
            {
              color:
                metric === 'reviews' ? theme.colors.dataViz.reviews : theme.colors.dataViz.time,
            },
          ]}
        >
          {currentValue}
        </Text>
        <Text style={[styles.valueLabel, { color: theme.colors.textMed }]}>
          {metric === 'reviews' ? 'reviews today' : 'minutes today'}
        </Text>
      </View>

      {/* Sparkline Chart */}
      <View style={styles.chartContainer}>
        <View style={styles.chart}>
          {trend.map((point, index) => {
            const height = (point.value / maxValue) * 100;
            const isToday = index === trend.length - 1;
            return (
              <View key={point.date} style={styles.barContainer}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: `${Math.max(height, 2)}%`,
                      backgroundColor: isToday
                        ? metric === 'reviews'
                          ? theme.colors.dataViz.reviews
                          : theme.colors.dataViz.time
                        : theme.colors.surface3,
                    },
                  ]}
                />
              </View>
            );
          })}
        </View>
        <Text style={[styles.chartLabel, { color: theme.colors.textLow }]}>
          Last 7 days
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
    gap: s.md,
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
    fontSize: 16,
    fontWeight: '800',
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.xs,
    paddingHorizontal: s.sm,
    paddingVertical: 4,
    borderRadius: r.full,
  },
  trendText: {
    fontSize: 13,
    fontWeight: '800',
  },
  currentValue: {
    alignItems: 'center',
    gap: 4,
  },
  valueText: {
    fontSize: 36,
    fontWeight: '800',
    lineHeight: 36,
  },
  valueLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  chartContainer: {
    gap: s.xs,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 60,
    gap: 4,
  },
  barContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderRadius: r.sm,
    minHeight: 2,
  },
  chartLabel: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
});
