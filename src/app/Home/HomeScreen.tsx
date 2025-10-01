import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../design/theme';
import { useScheduler } from '../../context/SchedulerProvider';
import { sampleCards } from '../../mocks/sampleCards';
import { db } from '../../services/anki/InMemoryDb';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';

export default function HomeScreen() {
  const theme = useTheme();
  const { bootstrap, stats, decks } = useScheduler();

  // Bootstrap sample data ONLY on first launch (empty database)
  useEffect(() => {
    const allCards = db.getAllCards();
    if (allCards.length === 0) {
      console.log('[HomeScreen] First launch - loading sample decks');
      bootstrap(sampleCards);
    } else {
      console.log('[HomeScreen] Database has', allCards.length, 'cards');
    }
  }, [bootstrap]);

  const totalDue = decks.reduce((sum, d) => sum + d.dueCount, 0);
  const totalCards = decks.reduce((sum, d) => sum + d.cardCount, 0);
  
  // Mock weekly activity - current day (Thursday) is in the middle
  const weeklyActivity = [true, true, true, true, false, null, null]; // M T W Th F S S (null = future)
  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const currentDayIndex = 3; // Thursday (0-indexed)
  const currentStreak = 4;
  
  // Mock stats
  const todayReviewed = 24;
  const todayGoal = 30;
  const weeklyGoal = 150;
  const weeklyProgress = 98;
  const averageAccuracy = 87;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Hero Section */}
        <View style={styles.hero}>
          <View style={styles.heroText}>
            <Text style={[styles.greeting, { color: theme.colors.textPrimary }]}>
              Welcome back! 👋
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
              You're doing amazing
            </Text>
          </View>
          
          {/* Streak Badge - Inline */}
          <View style={[styles.streakBadge, { backgroundColor: theme.colors.accent + '15' }]}>
            <Text style={styles.streakEmoji}>🔥</Text>
            <Text style={[styles.streakNumber, { color: theme.colors.accent }]}>{currentStreak}</Text>
          </View>
        </View>

        {/* Main Focus: Due Today - Large Hero Card */}
        <View style={[styles.heroCard, { backgroundColor: theme.colors.accent }]}>
          <Text style={styles.heroCardLabel}>Cards Due Today</Text>
          <Text style={styles.heroCardValue}>{totalDue}</Text>
          <Text style={styles.heroCardSubtext}>Ready to review</Text>
        </View>

        {/* Two Column Stats */}
        <View style={styles.twoColumnRow}>
          <View style={[styles.smallCard, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.smallCardLabel, { color: theme.colors.textSecondary }]}>Today's Goal</Text>
            <Text style={[styles.smallCardValue, { color: theme.colors.textPrimary }]}>{todayReviewed}/{todayGoal}</Text>
            <View style={styles.miniProgressBar}>
              <View style={[styles.miniProgressFill, { 
                backgroundColor: theme.colors.success,
                width: `${(todayReviewed / todayGoal) * 100}%` 
              }]} />
            </View>
          </View>

          <View style={[styles.smallCard, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.smallCardLabel, { color: theme.colors.textSecondary }]}>Accuracy</Text>
            <Text style={[styles.smallCardValue, { color: theme.colors.success }]}>{averageAccuracy}%</Text>
          </View>
        </View>

        {/* Weekly Activity */}
        <View style={[styles.activityCard, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
            This Week
          </Text>
          <View style={styles.weekGrid}>
            {weeklyActivity.map((completed, index) => {
              const isToday = index === currentDayIndex;
              const isFuture = completed === null;
              
              return (
                <View key={index} style={styles.dayColumn}>
                  <View style={[
                    styles.dayBox,
                    isToday && styles.todayBox,
                    { 
                      backgroundColor: isFuture 
                        ? theme.colors.bg
                        : completed 
                          ? theme.colors.success 
                          : theme.colors.danger + '40',
                      borderColor: isToday
                        ? theme.colors.accent
                        : 'transparent',
                    }
                  ]}>
                    {!isFuture && (
                      <Text style={[
                        styles.dayIcon,
                        { color: completed ? '#FFF' : theme.colors.danger }
                      ]}>
                        {completed ? '✓' : '✕'}
                      </Text>
                    )}
                  </View>
                  <Text style={[
                    styles.dayLabel, 
                    { color: isToday ? theme.colors.accent : theme.colors.textSecondary }
                  ]}>
                    {dayLabels[index]}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Weekly Progress */}
        <View style={[styles.progressCard, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.progressHeader}>
            <View>
              <Text style={[styles.progressTitle, { color: theme.colors.textPrimary }]}>
                Weekly Goal
              </Text>
              <Text style={[styles.progressSubtext, { color: theme.colors.textSecondary }]}>
                {weeklyProgress} of {weeklyGoal} cards
              </Text>
            </View>
            <Text style={[styles.percentageText, { color: theme.colors.accent }]}>
              {Math.round((weeklyProgress / weeklyGoal) * 100)}%
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { 
                  backgroundColor: theme.colors.accent,
                  width: `${(weeklyProgress / weeklyGoal) * 100}%`
                }
              ]} 
            />
          </View>
        </View>

        {/* Bottom Stats Row */}
        <View style={styles.bottomRow}>
          <View style={[styles.miniStatCard, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.miniStatValue, { color: theme.colors.textPrimary }]}>{totalCards}</Text>
            <Text style={[styles.miniStatLabel, { color: theme.colors.textSecondary }]}>Total Cards</Text>
          </View>
          <View style={[styles.miniStatCard, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.miniStatValue, { color: theme.colors.textPrimary }]}>{decks.length}</Text>
            <Text style={[styles.miniStatLabel, { color: theme.colors.textSecondary }]}>Decks</Text>
          </View>
          <View style={[styles.miniStatCard, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.miniStatValue, { color: theme.colors.textPrimary }]}>{stats.reviewCount}</Text>
            <Text style={[styles.miniStatLabel, { color: theme.colors.textSecondary }]}>Reviewed</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: s.lg,
  },
  // Hero Section
  hero: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: s.xl,
  },
  heroText: {
    flex: 1,
  },
  greeting: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: s.xs / 2,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '400',
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.sm,
    paddingVertical: s.sm,
    paddingHorizontal: s.md,
    borderRadius: r.pill,
  },
  streakEmoji: {
    fontSize: 24,
  },
  streakNumber: {
    fontSize: 24,
    fontWeight: '800',
  },
  // Hero Card - Large Due Today
  heroCard: {
    padding: s.xl,
    borderRadius: r.xl,
    marginBottom: s.lg,
    alignItems: 'center',
  },
  heroCardLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: s.sm,
  },
  heroCardValue: {
    fontSize: 72,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 72,
  },
  heroCardSubtext: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    marginTop: s.xs,
  },
  // Two Column Row
  twoColumnRow: {
    flexDirection: 'row',
    gap: s.md,
    marginBottom: s.lg,
  },
  smallCard: {
    flex: 1,
    padding: s.lg,
    borderRadius: r.lg,
  },
  smallCardLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: s.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  smallCardValue: {
    fontSize: 32,
    fontWeight: '800',
  },
  // Activity Card
  activityCard: {
    padding: s.lg,
    borderRadius: r.lg,
    marginBottom: s.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: s.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  weekGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: s.sm,
  },
  dayColumn: {
    flex: 1,
    alignItems: 'center',
    gap: s.sm,
  },
  dayBox: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: r.md,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  todayBox: {
    borderWidth: 4,
  },
  dayIcon: {
    fontSize: 16,
    fontWeight: '700',
  },
  dayLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Progress Card
  progressCard: {
    padding: s.lg,
    borderRadius: r.lg,
    marginBottom: s.lg,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: s.md,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: s.xs / 2,
  },
  progressSubtext: {
    fontSize: 13,
  },
  percentageText: {
    fontSize: 28,
    fontWeight: '800',
  },
  progressBar: {
    height: 10,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: r.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: r.full,
  },
  miniProgressBar: {
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: r.full,
    overflow: 'hidden',
    marginTop: s.sm,
  },
  miniProgressFill: {
    height: '100%',
    borderRadius: r.full,
  },
  // Bottom Row
  bottomRow: {
    flexDirection: 'row',
    gap: s.md,
  },
  miniStatCard: {
    flex: 1,
    padding: s.md,
    borderRadius: r.md,
    alignItems: 'center',
  },
  miniStatValue: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: s.xs / 2,
  },
  miniStatLabel: {
    fontSize: 11,
    textAlign: 'center',
  },
});
