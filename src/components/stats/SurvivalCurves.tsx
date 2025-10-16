/**
 * Survival Curves - Retention visualization (APPROXIMATION)
 * Uses heuristic model, not true Kaplan-Meier
 * Phase 5: Advanced Analytics
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/theme';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';

interface SurvivalPoint {
  interval: number; // days
  survivalRate: number; // 0-100
}

interface SurvivalCurvesProps {
  youngSurvival: SurvivalPoint[]; // Cards < 21 days
  matureSurvival: SurvivalPoint[]; // Cards >= 21 days
  halfLifeYoung: number; // days until 50% retention
  halfLifeMature: number;
}

export function SurvivalCurves({
  youngSurvival,
  matureSurvival,
  halfLifeYoung,
  halfLifeMature,
}: SurvivalCurvesProps) {
  const theme = useTheme();

  // Normalize data for visualization (max 100 days).
  const maxInterval = 100;
  const chartWidth = 280;
  const chartHeight = 140;

  const renderCurve = (data: SurvivalPoint[], color: string) => {
    if (data.length < 2) return null;

    const points = data
      .filter((p) => p.interval <= maxInterval)
      .map((p) => ({
        x: (p.interval / maxInterval) * chartWidth,
        y: chartHeight - (Math.min(p.survivalRate, 100) / 100) * chartHeight,
      }));

    // Create SVG-like path with View components
    return points.map((point, idx) => {
      if (idx === points.length - 1) return null;
      const nextPoint = points[idx + 1];

      return (
        <View
          key={idx}
          style={[
            styles.curveLine,
            {
              position: 'absolute',
              left: point.x,
              top: point.y,
              width: nextPoint.x - point.x,
              height: 2,
              backgroundColor: color,
              transform: [
                {
                  rotate: `${Math.atan2(
                    nextPoint.y - point.y,
                    nextPoint.x - point.x
                  )}rad`,
                },
              ],
            },
          ]}
        />
      );
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconBadge, { backgroundColor: theme.colors.overlay.info }]}>
            <Ionicons name="trending-down" size={22} color={theme.colors.info} />
          </View>
          <View>
            <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
              Retention Over Time
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
              % cards remembered vs days since review
            </Text>
          </View>
        </View>
      </View>

      {/* Half-Life Stats */}
      <View style={styles.halfLifeSection}>
        <View style={styles.halfLifeRow}>
          <View style={styles.halfLifeItem}>
            <View style={[styles.halfLifeDot, { backgroundColor: theme.colors.dataViz.young }]} />
            <Text style={[styles.halfLifeLabel, { color: theme.colors.textSecondary }]}>
              Young Cards
            </Text>
            <Text style={[styles.halfLifeValue, { color: theme.colors.textPrimary }]}>
              {halfLifeYoung}d
            </Text>
          </View>
          <View style={styles.halfLifeItem}>
            <View style={[styles.halfLifeDot, { backgroundColor: theme.colors.dataViz.mature }]} />
            <Text style={[styles.halfLifeLabel, { color: theme.colors.textSecondary }]}>
              Mature Cards
            </Text>
            <Text style={[styles.halfLifeValue, { color: theme.colors.textPrimary }]}>
              {halfLifeMature}d
            </Text>
          </View>
        </View>
        <Text style={[styles.halfLifeCaption, { color: theme.colors.textLow }]}>
          Half-life: Days until 50% retention
        </Text>
      </View>

      {/* Chart */}
      <View style={[styles.chartContainer, { backgroundColor: theme.colors.bg }]}>
        {/* Y-axis labels */}
        <View style={styles.yAxis}>
          {[100, 75, 50, 25, 0].map((val) => (
            <Text
              key={val}
              style={[styles.axisLabel, { color: theme.colors.textTertiary }]}
            >
              {val}%
            </Text>
          ))}
        </View>

        {/* Chart area */}
        <View style={[styles.chartArea, { width: chartWidth, height: chartHeight }]}>
          {/* Horizontal grid lines */}
          {[0, 25, 50, 75, 100].map((val) => (
            <View
              key={`h-${val}`}
              style={[
                styles.gridLine,
                {
                  top: chartHeight - (val / 100) * chartHeight,
                  backgroundColor: theme.colors.border + '40',
                },
              ]}
            />
          ))}

          {/* Vertical grid lines (X-axis ticks) */}
          {[0, 20, 40, 60, 80, 100].map((val) => (
            <View
              key={`v-${val}`}
              style={[
                styles.gridLineVertical,
                {
                  left: (val / maxInterval) * chartWidth,
                  backgroundColor: theme.colors.border + '20',
                },
              ]}
            />
          ))}

          {/* Curves */}
          {renderCurve(youngSurvival, theme.colors.dataViz.young)}
          {renderCurve(matureSurvival, theme.colors.dataViz.mature)}

          {/* Data points */}
          {youngSurvival
            .filter((p) => p.interval <= maxInterval)
            .map((p, idx) => (
              <View
                key={`young-${idx}`}
                style={[
                  styles.dataPoint,
                  {
                    left: (p.interval / maxInterval) * chartWidth - 3,
                    top: chartHeight - (Math.min(p.survivalRate, 100) / 100) * chartHeight - 3,
                    backgroundColor: theme.colors.dataViz.young,
                  },
                ]}
              />
            ))}
          {matureSurvival
            .filter((p) => p.interval <= maxInterval)
            .map((p, idx) => (
              <View
                key={`mature-${idx}`}
                style={[
                  styles.dataPoint,
                  {
                    left: (p.interval / maxInterval) * chartWidth - 3,
                    top: chartHeight - (Math.min(p.survivalRate, 100) / 100) * chartHeight - 3,
                    backgroundColor: theme.colors.dataViz.mature,
                  },
                ]}
              />
            ))}
        </View>
      </View>

      {/* X-axis */}
      <View style={styles.xAxisContainer}>
        <View style={styles.xAxis}>
          <Text style={[styles.axisLabel, { color: theme.colors.textTertiary }]}>0</Text>
          <Text style={[styles.axisLabel, { color: theme.colors.textTertiary }]}>20</Text>
          <Text style={[styles.axisLabel, { color: theme.colors.textTertiary }]}>40</Text>
          <Text style={[styles.axisLabel, { color: theme.colors.textTertiary }]}>60</Text>
          <Text style={[styles.axisLabel, { color: theme.colors.textTertiary }]}>80</Text>
          <Text style={[styles.axisLabel, { color: theme.colors.textTertiary }]}>
            {maxInterval}
          </Text>
        </View>
        <Text style={[styles.axisTitle, { color: theme.colors.textMed, textAlign: 'center', marginTop: 4 }]}>
          Days Since Review
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
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  halfLifeSection: {
    gap: s.sm,
  },
  halfLifeRow: {
    flexDirection: 'row',
    gap: s.xl,
  },
  halfLifeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.xs,
  },
  halfLifeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  halfLifeContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  halfLifeLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  halfLifeValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  halfLifeCaption: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  chartContainer: {
    flexDirection: 'row',
    padding: s.md,
    borderRadius: r.lg,
    gap: s.sm,
  },
  yAxis: {
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingRight: s.xs,
    width: 40,
  },
  axisLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  xAxisContainer: {
    gap: 4,
  },
  chartArea: {
    position: 'relative',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
  },
  gridLineVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
  },
  curveLine: {
    position: 'absolute',
  },
  dataPoint: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  xAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 44,
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
