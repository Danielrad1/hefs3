/**
 * Weekly Coach Report - AI-generated insights and recommendations
 * Phase 5: Advanced Analytics
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/theme';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';

interface CoachInsight {
  type: 'success' | 'warning' | 'info' | 'action';
  title: string;
  message: string;
  actionText?: string;
  onAction?: () => void;
}

interface WeeklyCoachReportProps {
  weekStart: string; // YYYY-MM-DD
  weekEnd: string;
  insights: CoachInsight[];
  summary: {
    totalReviews: number;
    avgAccuracy: number;
    streakDays: number;
    cardsAdded: number;
  };
}

export function WeeklyCoachReport({
  weekStart,
  weekEnd,
  insights,
  summary,
}: WeeklyCoachReportProps) {
  const theme = useTheme();

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'success':
        return { name: 'checkmark-circle' as const, color: theme.colors.success };
      case 'warning':
        return { name: 'warning' as const, color: theme.colors.warning };
      case 'info':
        return { name: 'information-circle' as const, color: theme.colors.info };
      case 'action':
        return { name: 'flash' as const, color: theme.colors.accent };
      default:
        return { name: 'bulb' as const, color: theme.colors.textSecondary };
    }
  };

  const formatDateRange = () => {
    const start = new Date(weekStart);
    const end = new Date(weekEnd);
    return `${start.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface2 }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconBadge, { backgroundColor: theme.colors.overlay.primary }]}>
            <Ionicons name="clipboard-outline" size={22} color={theme.colors.primary} />
          </View>
          <View>
            <Text style={[styles.title, { color: theme.colors.textHigh }]}>
              Weekly Coach Report
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.textMed }]}>
              {formatDateRange()}
            </Text>
          </View>
        </View>
      </View>

      {/* Summary Stats */}
      <View style={[styles.summarySection, { backgroundColor: theme.colors.surface2 }]}>
        <Text style={[styles.summaryTitle, { color: theme.colors.textMed }]}>
          This Week's Performance
        </Text>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: theme.colors.textHigh }]}>
              {summary.totalReviews}
            </Text>
            <Text style={[styles.summaryLabel, { color: theme.colors.textMed }]}>
              Reviews
            </Text>
          </View>

          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: theme.colors.textHigh }]} numberOfLines={1}>
              {Math.round(summary.avgAccuracy)}%
            </Text>
            <Text style={[styles.summaryLabel, { color: theme.colors.textMed }]}>
              Accuracy
            </Text>
          </View>

          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: theme.colors.textHigh }]}>
              {summary.streakDays}
            </Text>
            <Text style={[styles.summaryLabel, { color: theme.colors.textMed }]}>
              Streak
            </Text>
          </View>

          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: theme.colors.textHigh }]}>
              {summary.cardsAdded}
            </Text>
            <Text style={[styles.summaryLabel, { color: theme.colors.textMed }]}>
              New Cards
            </Text>
          </View>
        </View>
      </View>

      {/* Insights */}
      <View style={styles.insightsSection}>
        <Text style={[styles.insightsTitle, { color: theme.colors.textHigh }]}>
          Key Insights
        </Text>
        {insights.map((insight, idx) => {
          const iconData = getInsightIcon(insight.type);
          return (
            <View key={idx} style={styles.insightCard}>
              <View style={styles.insightHeader}>
                <View
                  style={[
                    styles.insightIconBadge,
                    {
                      backgroundColor:
                        insight.type === 'success'
                          ? theme.colors.overlay.success
                          : insight.type === 'warning'
                          ? theme.colors.overlay.warning
                          : insight.type === 'info'
                          ? theme.colors.overlay.info
                          : theme.colors.overlay.primary,
                    },
                  ]}
                >
                  <Ionicons name={iconData.name} size={18} color={iconData.color} />
                </View>
                <Text style={[styles.insightTitle, { color: theme.colors.textHigh }]}>
                  {insight.title}
                </Text>
              </View>
              <Text style={[styles.insightMessage, { color: theme.colors.textMed }]}>
                {insight.message}
              </Text>
              {insight.actionText && insight.onAction && (
                <Pressable
                  onPress={insight.onAction}
                  style={[
                    styles.insightAction,
                    {
                      backgroundColor:
                        insight.type === 'success'
                          ? theme.colors.overlay.success
                          : insight.type === 'warning'
                          ? theme.colors.overlay.warning
                          : insight.type === 'info'
                          ? theme.colors.overlay.info
                          : theme.colors.overlay.primary,
                    },
                  ]}
                >
                  <Text style={[styles.insightActionText, { color: iconData.color }]}>
                    {insight.actionText}
                  </Text>
                  <Ionicons name="arrow-forward" size={16} color={iconData.color} />
                </Pressable>
              )}
            </View>
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
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  summarySection: {
    padding: s.lg,
    borderRadius: r.xl,
    gap: s.md,
  },
  summaryTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: s.md,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  insightsSection: {
    gap: s.md,
  },
  insightsTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  insightCard: {
    gap: s.sm,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.sm,
  },
  insightIconBadge: {
    width: 32,
    height: 32,
    borderRadius: r.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  insightTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
  },
  insightMessage: {
    fontSize: 14,
    lineHeight: 20,
    paddingLeft: 40,
  },
  insightAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: s.md,
    paddingVertical: s.sm,
    borderRadius: r.lg,
    marginLeft: 40,
    marginTop: s.xs,
  },
  insightActionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.sm,
    padding: s.md,
    borderRadius: r.lg,
  },
  footerText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
});
