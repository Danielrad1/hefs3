import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/theme';
import { useScheduler } from '../../context/SchedulerProvider';
import { sampleCards } from '../../mocks/sampleCards';
import { db } from '../../services/anki/InMemoryDb';
import { StatsService, HomeStats } from '../../services/anki/StatsService';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';

export default function HomeScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const { bootstrap } = useScheduler();
  const [homeStats, setHomeStats] = useState<HomeStats | null>(null);
  const isCalculatingRef = React.useRef(false);

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

  // Function to refresh stats
  const refreshStats = React.useCallback(() => {
    if (isCalculatingRef.current) {
      console.log('[HomeScreen] Already calculating, skipping...');
      return;
    }
    
    console.log('[HomeScreen] Starting stats calculation...');
    isCalculatingRef.current = true;
    
    setTimeout(() => {
      console.log('[HomeScreen] Calculating stats from database...');
      const statsService = new StatsService(db);
      const stats = statsService.getHomeStats();
      console.log('[HomeScreen] Stats calculated:', {
        dueCount: stats.dueCount,
        totalCards: stats.totalCardsCount,
        todayReviews: stats.todayReviewCount,
      });
      setHomeStats(stats);
      isCalculatingRef.current = false;
      console.log('[HomeScreen] Stats set, rendering complete');
    }, 0);
  }, []);

  // Calculate statistics only when screen is focused (handles both first load and returns)
  useFocusEffect(
    React.useCallback(() => {
      console.log('[HomeScreen] useFocusEffect triggered, homeStats:', !!homeStats, 'isCalculating:', isCalculatingRef.current);
      // Only refresh if stats are missing and not already calculating
      if (!homeStats && !isCalculatingRef.current) {
        console.log('[HomeScreen] Calling refreshStats from useFocusEffect');
        refreshStats();
      }
    }, [homeStats, refreshStats])
  );

  // Show loading state while stats are being calculated
  if (!homeStats) {
    console.log('[HomeScreen] Rendering loading state, isCalculating:', isCalculatingRef.current);
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top']}>
        <View style={[styles.content, { justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={{ color: theme.colors.textSecondary }}>Loading statistics...</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  console.log('[HomeScreen] Rendering home screen with stats');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Streak Badge */}
        {homeStats.currentStreak > 0 && (
          <View style={styles.streakContainer}>
            <View style={[styles.streakBadge, { backgroundColor: theme.colors.warning + '15' }]}>
              <Ionicons name="flame" size={20} color={theme.colors.warning} />
              <Text style={[styles.streakText, { color: theme.colors.warning }]}>
                {homeStats.currentStreak} day streak
              </Text>
            </View>
          </View>
        )}

        {/* Main CTA: Due Cards */}
        {homeStats.dueCount > 0 ? (
          <Pressable 
            style={[styles.heroCard, { backgroundColor: theme.colors.surface }]}
            onPress={() => navigation.navigate('Study' as never)}
          >
            <Text style={[styles.heroCardLabel, { color: theme.colors.textSecondary }]}>Cards Due</Text>
            <Text style={[styles.heroCardValue, { color: theme.colors.info }]}>{homeStats.dueCount}</Text>
            <View style={styles.heroCardAction}>
              <Text style={[styles.heroCardActionText, { color: theme.colors.textPrimary }]}>Start Studying</Text>
              <Ionicons name="arrow-forward" size={20} color={theme.colors.info} />
            </View>
          </Pressable>
        ) : (
          <View style={[styles.heroCard, { backgroundColor: theme.colors.surface }]}>
            <Ionicons name="checkmark-circle" size={48} color={theme.colors.success} style={{ marginBottom: s.md }} />
            <Text style={[styles.heroCardLabel, { color: theme.colors.textPrimary }]}>All Caught Up!</Text>
            <Text style={[styles.heroCardSubtext, { color: theme.colors.textSecondary }]}>
              No cards due right now
            </Text>
          </View>
        )}

        {/* Today's Progress */}
        {homeStats.todayReviewCount > 0 && (
          <View style={[styles.todayCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.todayHeader}>
              <Text style={[styles.todayTitle, { color: theme.colors.textPrimary }]}>
                Today's Progress
              </Text>
              <Ionicons name="calendar-outline" size={20} color={theme.colors.textSecondary} />
            </View>
            
            <View style={styles.todayStats}>
              <View style={styles.todayStat}>
                <Text style={[styles.todayStatValue, { color: theme.colors.textPrimary }]}>
                  {homeStats.todayReviewCount}
                </Text>
                <Text style={[styles.todayStatLabel, { color: theme.colors.textSecondary }]}>
                  Cards
                </Text>
              </View>
              
              <View style={styles.todayStatDivider} />
              
              <View style={styles.todayStat}>
                <Text style={[styles.todayStatValue, { color: theme.colors.success }]}>
                  {homeStats.todayAccuracy}%
                </Text>
                <Text style={[styles.todayStatLabel, { color: theme.colors.textSecondary }]}>
                  Accuracy
                </Text>
              </View>
              
              <View style={styles.todayStatDivider} />
              
              <View style={styles.todayStat}>
                <Text style={[styles.todayStatValue, { color: theme.colors.textPrimary }]}>
                  {homeStats.todayTimeMinutes}m
                </Text>
                <Text style={[styles.todayStatLabel, { color: theme.colors.textSecondary }]}>
                  Time
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Weekly Activity */}
        <View style={[styles.activityCard, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.activityHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
              This Week
            </Text>
            {homeStats.longestStreak > homeStats.currentStreak && (
              <Text style={[styles.longestStreakText, { color: theme.colors.textSecondary }]}>
                Best: {homeStats.longestStreak} days
              </Text>
            )}
          </View>
          
          <View style={styles.weekGrid}>
            {homeStats.weeklyActivity.map((day, index) => (
              <View key={day.date} style={styles.dayColumn}>
                <View style={[
                  styles.dayBox,
                  day.isToday && styles.todayBox,
                  { 
                    backgroundColor: day.isFuture 
                      ? theme.colors.bg
                      : day.hasReviews 
                        ? theme.colors.success 
                        : theme.colors.surface,
                    borderColor: day.isToday
                      ? theme.colors.textSecondary
                      : day.hasReviews 
                        ? theme.colors.success
                        : theme.colors.bg,
                    borderWidth: 2,
                  }
                ]}>
                  {day.hasReviews && (
                    <Ionicons 
                      name="checkmark" 
                      size={16} 
                      color="#FFF"
                    />
                  )}
                </View>
                <Text style={[
                  styles.dayLabel, 
                  { color: day.isToday ? theme.colors.textPrimary : theme.colors.textSecondary }
                ]}>
                  {day.dayLabel}
                </Text>
                {day.reviewCount > 0 && (
                  <Text style={[styles.dayCount, { color: theme.colors.textTertiary }]}>
                    {day.reviewCount}
                  </Text>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Card Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
            <View style={[styles.statIconContainer, { backgroundColor: theme.colors.textSecondary + '20' }]}>
              <Ionicons name="library" size={20} color={theme.colors.textSecondary} />
            </View>
            <Text style={[styles.statValue, { color: theme.colors.textPrimary }]}>
              {homeStats.totalCardsCount}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
              Total Cards
            </Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
            <View style={[styles.statIconContainer, { backgroundColor: theme.colors.success + '15' }]}>
              <Ionicons name="albums" size={20} color={theme.colors.success} />
            </View>
            <Text style={[styles.statValue, { color: theme.colors.textPrimary }]}>
              {homeStats.totalDecksCount}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
              Decks
            </Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
            <View style={[styles.statIconContainer, { backgroundColor: theme.colors.warning + '15' }]}>
              <Ionicons name="sparkles" size={20} color={theme.colors.warning} />
            </View>
            <Text style={[styles.statValue, { color: theme.colors.textPrimary }]}>
              {homeStats.newCount}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
              New
            </Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
            <View style={[styles.statIconContainer, { backgroundColor: theme.colors.info + '15' }]}>
              <Ionicons name="school" size={20} color={theme.colors.info} />
            </View>
            <Text style={[styles.statValue, { color: theme.colors.textPrimary }]}>
              {homeStats.learningCount}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
              Learning
            </Text>
          </View>
        </View>

        {/* All-time Stats */}
        {homeStats.totalReviewsAllTime > 0 && (
          <View style={[styles.allTimeCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.allTimeHeader}>
              <Ionicons name="trophy" size={24} color={theme.colors.warning} />
              <Text style={[styles.allTimeTitle, { color: theme.colors.textPrimary }]}>
                All-Time Stats
              </Text>
            </View>
            <View style={styles.allTimeStats}>
              <Text style={[styles.allTimeValue, { color: theme.colors.textPrimary }]}>
                {homeStats.totalReviewsAllTime.toLocaleString()}
              </Text>
              <Text style={[styles.allTimeLabel, { color: theme.colors.textSecondary }]}>
                Total Reviews
              </Text>
            </View>
          </View>
        )}
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
    paddingBottom: s.xl * 2,
  },
  // Streak Badge
  streakContainer: {
    alignItems: 'flex-start',
    marginBottom: s.lg,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.xs,
    paddingVertical: s.sm,
    paddingHorizontal: s.md,
    borderRadius: r.pill,
  },
  streakText: {
    fontSize: 15,
    fontWeight: '700',
  },
  // Hero Card - Main CTA
  heroCard: {
    padding: s.xl,
    borderRadius: r.xl,
    marginBottom: s.lg,
    alignItems: 'center',
  },
  heroCardLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: s.sm,
  },
  heroCardValue: {
    fontSize: 64,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 64,
    marginBottom: s.md,
  },
  heroCardSubtext: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
  },
  heroCardAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.sm,
    marginTop: s.md,
  },
  heroCardActionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Today's Progress Card
  todayCard: {
    padding: s.lg,
    borderRadius: r.lg,
    marginBottom: s.lg,
  },
  todayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: s.md,
  },
  todayTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  todayStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  todayStat: {
    alignItems: 'center',
    flex: 1,
  },
  todayStatValue: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: s.xs,
  },
  todayStatLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  todayStatDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  // Activity Card
  activityCard: {
    padding: s.lg,
    borderRadius: r.lg,
    marginBottom: s.lg,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: s.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  longestStreakText: {
    fontSize: 12,
    fontWeight: '600',
  },
  weekGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: s.xs,
  },
  dayColumn: {
    flex: 1,
    alignItems: 'center',
    gap: s.xs,
  },
  dayBox: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: r.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  todayBox: {
    borderWidth: 3,
  },
  dayLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  dayCount: {
    fontSize: 9,
    fontWeight: '600',
  },
  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: s.md,
    marginBottom: s.lg,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    padding: s.md,
    borderRadius: r.lg,
    alignItems: 'center',
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: r.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: s.sm,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: s.xs / 2,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  // All-time Card
  allTimeCard: {
    padding: s.lg,
    borderRadius: r.lg,
    marginBottom: s.lg,
  },
  allTimeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.sm,
    marginBottom: s.md,
  },
  allTimeTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  allTimeStats: {
    alignItems: 'center',
  },
  allTimeValue: {
    fontSize: 36,
    fontWeight: '900',
    marginBottom: s.xs,
  },
  allTimeLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
});
