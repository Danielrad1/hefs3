/**
 * Best Hours Card - Shows when users study best (retention + speed)
 * Premium tier component - Phase 6
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/theme';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';
import { BestHoursData } from '../../services/anki/StatsService';

interface BestHoursCardProps {
  data: BestHoursData[];
  variant?: 'full' | 'compact';
}

export function BestHoursCard({ data, variant = 'full' }: BestHoursCardProps) {
  const theme = useTheme();
  const [showGrid, setShowGrid] = React.useState(false);

  // Create 24-hour grid (0-23)
  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Find data for each hour
  const getHourData = (hour: number): BestHoursData | undefined => {
    return data.find(d => d.hour === hour);
  };

  // Get color based on retention percentage
  const getHourColor = (hourData: BestHoursData | undefined): string => {
    if (!hourData) return theme.colors.border;
    
    const retention = hourData.retentionPct;
    if (retention >= 90) return theme.colors.success;
    if (retention >= 85) return theme.colors.info;
    if (retention >= 80) return theme.colors.primary;
    if (retention >= 75) return theme.colors.warning;
    return theme.colors.danger;
  };

  // Get top 3 hours sorted by weighted score
  const topHours = [...data]
    .sort((a, b) => {
      const scoreA = a.retentionPct * Math.log(a.reviewCount);
      const scoreB = b.retentionPct * Math.log(b.reviewCount);
      return scoreB - scoreA;
    })
    .slice(0, 3);

  // Format hour for display (e.g., "14" -> "2 PM")
  const formatHour = (hour: number): string => {
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    if (hour < 12) return `${hour} AM`;
    return `${hour - 12} PM`;
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface2 }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconBadge, { backgroundColor: theme.colors.overlay.primary }]}>
            <Ionicons name="time-outline" size={22} color={theme.colors.primary} />
          </View>
          <View>
            <Text style={[styles.title, { color: theme.colors.textHigh }]}>
              Best Study Hours
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.textMed }]}>
              Last 30 days
            </Text>
          </View>
        </View>
      </View>

      {/* Top Hours (Always Visible) */}
      {topHours.length > 0 && (
        <View style={styles.topHours}>
          <Text style={[styles.topHoursLabel, { color: theme.colors.textMed }]}>
            {variant === 'compact' ? 'Top 3 Study Hours' : 'Best Study Times'}
          </Text>
          <View style={styles.topHoursList}>
            {topHours.map((hour, idx) => (
              <View
                key={hour.hour}
                style={[
                  styles.topHourBadge,
                  { backgroundColor: theme.colors.bg },
                ]}
              >
                <Ionicons name="time" size={14} color={theme.colors.textMed} />
                <Text style={[styles.topHourText, { color: theme.colors.textHigh }]}>
                  {formatHour(hour.hour)}
                </Text>
                <Text style={[styles.topHourStat, { color: theme.colors.textMed }]}>
                  {Math.round(hour.retentionPct)}%
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Show Full Grid Toggle (only in full variant) */}
      {variant === 'full' && (
        <Pressable
          style={styles.toggleButton}
          onPress={() => setShowGrid(!showGrid)}
        >
          <Text style={[styles.toggleText, { color: theme.colors.primary }]}>
            {showGrid ? 'Hide' : 'Show'} Full Grid
          </Text>
          <Ionicons 
            name={showGrid ? "chevron-up" : "chevron-down"} 
            size={16} 
            color={theme.colors.primary} 
          />
        </Pressable>
      )}

      {/* 24-hour grid (Collapsible, only in full variant) */}
      {variant === 'full' && showGrid && (
        <>
          <View style={styles.gridContainer}>
            {[0, 1, 2, 3].map(row => (
              <View key={row} style={styles.gridRow}>
                {[0, 1, 2, 3, 4, 5].map(col => {
                  const hour = row * 6 + col;
                  const hourData = getHourData(hour);
                  const color = getHourColor(hourData);
                  
                  return (
                    <View
                      key={hour}
                      style={[
                        styles.cell,
                        {
                          backgroundColor: hourData ? color : theme.colors.border,
                          opacity: hourData ? 1 : 0.2,
                        },
                      ]}
                    />
                  );
                })}
              </View>
            ))}
          </View>

          {/* Color Legend */}
          <View style={styles.legend}>
            <Text style={[styles.legendLabel, { color: theme.colors.textMed }]}>Retention:</Text>
            <View style={styles.legendItems}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme.colors.success }]} />
                <Text style={[styles.legendText, { color: theme.colors.textLow }]}>90%+</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme.colors.info }]} />
                <Text style={[styles.legendText, { color: theme.colors.textLow }]}>85%</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme.colors.primary }]} />
                <Text style={[styles.legendText, { color: theme.colors.textLow }]}>80%</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme.colors.warning }]} />
                <Text style={[styles.legendText, { color: theme.colors.textLow }]}>75%</Text>
              </View>
            </View>
          </View>
        </>
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
  premiumBadge: {
    width: 28,
    height: 28,
    borderRadius: r.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridContainer: {
    gap: s.sm,
  },
  gridRow: {
    flexDirection: 'row',
    gap: s.sm,
  },
  cell: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: r.md,
  },
  topHours: {
    gap: s.sm,
  },
  topHoursLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  topHoursList: {
    flexDirection: 'row',
    gap: s.sm,
  },
  topHourBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: s.md,
    paddingVertical: s.sm,
    borderRadius: r.full,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s.xs,
    paddingVertical: s.sm,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '700',
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.sm,
  },
  legendLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  legendItems: {
    flexDirection: 'row',
    gap: s.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 10,
    fontWeight: '600',
  },
  topHourText: {
    fontSize: 13,
    fontWeight: '800',
  },
  topHourStat: {
    fontSize: 11,
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
