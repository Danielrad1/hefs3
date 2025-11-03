/**
 * Streak Calendar Card - Visual heatmap of study activity
 * Phase 5: Advanced Analytics
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/theme';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';

interface DayActivity {
  date: string; // YYYY-MM-DD
  reviewCount: number;
}

interface StreakCalendarCardProps {
  activities: DayActivity[]; // Last 30-90 days
  currentStreak: number;
  longestStreak: number;
}

export function StreakCalendarCard({
  activities,
  currentStreak,
  longestStreak,
}: StreakCalendarCardProps) {
  const theme = useTheme();

  // Get current month calendar data
  const getMonthCalendar = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    
    // Get first and last day of month
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // Get day of week for first day (0 = Sunday)
    const firstDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    
    const days: Array<{ date: number | null; dateStr: string; reviewCount: number; isToday: boolean }> = [];
    
    // Add empty cells for days before month starts
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push({ date: null, dateStr: '', reviewCount: 0, isToday: false });
    }
    
    // Add actual days of month
    for (let date = 1; date <= daysInMonth; date++) {
      const dateObj = new Date(year, month, date);
      const dateStr = dateObj.toISOString().split('T')[0];
      const activity = activities.find((a) => a.date === dateStr);
      const isToday = dateObj.toDateString() === today.toDateString();
      
      days.push({
        date,
        dateStr,
        reviewCount: activity?.reviewCount || 0,
        isToday,
      });
    }
    
    // Pad the last row with empty cells to always have complete weeks (7 cells per row)
    const remainder = days.length % 7;
    if (remainder !== 0) {
      const emptyCellsNeeded = 7 - remainder;
      for (let i = 0; i < emptyCellsNeeded; i++) {
        days.push({ date: null, dateStr: '', reviewCount: 0, isToday: false });
      }
    }
    
    return {
      days,
      monthName: firstDay.toLocaleString('default', { month: 'long' }),
      year,
    };
  };

  const calendar = getMonthCalendar();
  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      {/* Header with Month/Year */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.monthTitle, { color: theme.colors.textPrimary }]}>
            {calendar.monthName} {calendar.year}
          </Text>
          <View style={styles.streakRow}>
            <Ionicons name="flame" size={14} color={theme.colors.streak} />
            <Text style={[styles.streakText, { color: theme.colors.textMed }]}>
              {currentStreak} day streak
              {longestStreak > currentStreak && ` · Best: ${longestStreak}`}
            </Text>
          </View>
        </View>
      </View>

      {/* Day labels */}
      <View style={styles.dayLabelsRow}>
        {dayLabels.map((label, idx) => (
          <Text
            key={idx}
            style={[styles.dayLabel, { color: theme.colors.textTertiary }]}
          >
            {label}
          </Text>
        ))}
      </View>

      {/* Calendar Grid - chunked into weeks */}
      <View style={styles.grid}>
        {Array.from({ length: Math.ceil(calendar.days.length / 7) }).map((_, weekIdx) => (
          <View key={weekIdx} style={styles.gridRow}>
            {calendar.days.slice(weekIdx * 7, (weekIdx + 1) * 7).map((day, dayIdx) => {
              const hasActivity = day.reviewCount > 0;
              // Use brand primary with intensity based on review count
              const maxReviews = Math.max(...calendar.days.filter(d => d.date !== null).map(d => d.reviewCount), 1);
              const intensity = hasActivity ? Math.min(day.reviewCount / maxReviews, 1) : 0;
              const getActivityColor = () => {
                if (!hasActivity) return theme.colors.border;
                // Brand ramp: overlay.primary → primary based on intensity
                if (intensity < 0.33) return theme.colors.overlay.primary;
                if (intensity < 0.66) return theme.colors.primary + '80';
                return theme.colors.primary;
              };
              
              return (
                <View
                  key={dayIdx}
                  style={[
                    styles.gridCell,
                    day.isToday && styles.todayCell,
                    {
                      backgroundColor: day.date === null ? 'transparent' : getActivityColor(),
                      borderColor: day.isToday ? theme.colors.primary : 'transparent',
                    },
                  ]}
                >
                  {day.date && (
                    <Text
                      style={[
                        styles.dateText,
                        {
                          color: intensity >= 0.66
                            ? theme.colors.onPrimary
                            : day.isToday
                            ? theme.colors.textHigh
                            : theme.colors.textMed,
                          fontWeight: day.isToday ? '800' : '600',
                        },
                      ]}
                    >
                      {day.date}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        ))}
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
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    gap: s.md,
  },
  header: {
    marginBottom: s.sm,
  },
  monthTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.xs,
  },
  streakText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dayLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: s.sm,
  },
  dayLabel: {
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  grid: {
    gap: 6,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 6,
  },
  gridCell: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: r.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  todayCell: {
    borderWidth: 2,
  },
  dateText: {
    fontSize: 13,
    textAlign: 'center',
  },
});
