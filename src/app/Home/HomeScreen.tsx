import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isCalculatingRef = React.useRef(false);
  
  // Random motivational messages - must be before any conditional returns
  const getMotivationalMessage = React.useCallback(() => {
    const messages = [
      'Ready to grow?',
      'Keep building knowledge',
      'Your brain is ready',
      'Make today count',
      'Knowledge is power',
      'Stay curious today',
      'Every card counts',
      'You\'re on fire!',
      'Keep the momentum',
      'Time to level up',
    ];
    const randomIndex = Math.floor(Math.random() * messages.length);
    return messages[randomIndex];
  }, []);
  
  // Store motivational message so it doesn't change during the session
  const [motivationalMessage] = React.useState(getMotivationalMessage);

  // Bootstrap sample data ONLY on first launch (empty database)
  useEffect(() => {
    const allCards = db.getAllCards();
    if (allCards.length === 0) {
      bootstrap(sampleCards);
    }
  }, [bootstrap]);

  // Function to refresh stats
  const refreshStats = React.useCallback((forceRefresh = false) => {
    if (isCalculatingRef.current && !forceRefresh) {
      return;
    }
    
    isCalculatingRef.current = true;
    if (forceRefresh) {
      setIsRefreshing(true);
    }
    
    setTimeout(() => {
      const statsService = new StatsService(db);
      const stats = statsService.getHomeStats();
      setHomeStats(stats);
      isCalculatingRef.current = false;
      setIsRefreshing(false);
    }, 0);
  }, []);

  // Pull-to-refresh handler
  const onRefresh = React.useCallback(() => {
    refreshStats(true);
  }, [refreshStats]);

  // Calculate statistics when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      refreshStats();
    }, [refreshStats])
  );

  // User name (TODO: pull from settings/profile)
  const userName = 'Daniel';

  // Get greeting based on time of day - memoize to update properly
  const getGreeting = React.useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  }, []); // Empty deps means it calculates once per mount

  // Show loading state while stats are being calculated
  if (!homeStats) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top']}>
        <View style={[styles.content, { justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={{ color: theme.colors.textSecondary }}>Loading statistics...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top']}>
      <ScrollView 
        contentContainerStyle={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.accent}
            colors={[theme.colors.accent]}
          />
        }
      >
        {/* Header */}
        <View style={styles.headerSection}>
          <Text style={[styles.greetingSmall, { color: theme.colors.textSecondary }]}>
            {getGreeting}, {userName}
          </Text>
          <Text style={[styles.greetingLarge, { color: theme.colors.textPrimary }]}>
            {motivationalMessage}
          </Text>
          
          {/* Centered Streak Badge */}
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
        </View>

        {/* Main CTA: Due Cards */}
        {homeStats.dueCount > 0 ? (
          <Pressable 
            style={styles.heroCard}
            onPress={() => navigation.navigate('Study' as never)}
          >
            <LinearGradient
              colors={['#8B5CF6', '#6366F1']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroGradient}
            >
              <View style={styles.heroContent}>
                <View style={styles.heroIconCircle}>
                  <Ionicons name="book" size={32} color="#FFFFFF" />
                </View>
                <Text style={styles.heroLabel}>Ready to Study</Text>
                <Text style={styles.heroValue}>{homeStats.dueCount}</Text>
                <Text style={styles.heroSubtext}>cards waiting for you</Text>
                <View style={styles.heroButton}>
                  <Text style={styles.heroButtonText}>Start Now</Text>
                  <Ionicons name="arrow-forward" size={20} color="#000" />
                </View>
              </View>
            </LinearGradient>
          </Pressable>
        ) : (
          <View style={[styles.heroCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.completedHero}>
              <View style={[styles.heroIconCircle, { backgroundColor: theme.colors.success + '20' }]}>
                <Ionicons name="checkmark-circle" size={48} color={theme.colors.success} />
              </View>
              <Text style={[styles.heroLabel, { color: theme.colors.textPrimary }]}>All Caught Up!</Text>
              <Text style={[styles.completedSubtext, { color: theme.colors.textSecondary }]}>
                Great work! Check back later for more cards
              </Text>
            </View>
          </View>
        )}

        {/* Today's Progress */}
        {homeStats.todayReviewCount > 0 && (
          <View style={[styles.todayCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.todayHeader}>
              <View style={styles.todayHeaderLeft}>
                <Ionicons name="today" size={24} color={theme.colors.accent} />
                <Text style={[styles.todayTitle, { color: theme.colors.textPrimary }]}>
                  Today's Progress
                </Text>
              </View>
            </View>
            
            <View style={styles.todayStats}>
              <View style={styles.todayStat}>
                <View style={[styles.todayStatIcon, { backgroundColor: theme.colors.info + '15' }]}>
                  <Ionicons name="layers" size={20} color={theme.colors.info} />
                </View>
                <Text style={[styles.todayStatValue, { color: theme.colors.textPrimary }]}>
                  {homeStats.todayReviewCount}
                </Text>
                <Text style={[styles.todayStatLabel, { color: theme.colors.textSecondary }]}>
                  Cards Reviewed
                </Text>
              </View>
              
              <View style={styles.todayStat}>
                <View style={[styles.todayStatIcon, { backgroundColor: theme.colors.success + '15' }]}>
                  <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
                </View>
                <Text style={[styles.todayStatValue, { color: theme.colors.success }]}>
                  {homeStats.todayAccuracy}%
                </Text>
                <Text style={[styles.todayStatLabel, { color: theme.colors.textSecondary }]}>
                  Accuracy
                </Text>
              </View>
              
              <View style={styles.todayStat}>
                <View style={[styles.todayStatIcon, { backgroundColor: theme.colors.warning + '15' }]}>
                  <Ionicons name="time" size={20} color={theme.colors.warning} />
                </View>
                <Text style={[styles.todayStatValue, { color: theme.colors.textPrimary }]}>
                  {homeStats.todayTimeMinutes}m
                </Text>
                <Text style={[styles.todayStatLabel, { color: theme.colors.textSecondary }]}>
                  Study Time
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

        {/* Card Stats Row */}
        <View style={styles.statsRow}>
          <View style={[styles.statPill, { backgroundColor: theme.colors.surface }]}>
            <View style={[styles.statPillIcon, { backgroundColor: '#EC4899' + '15' }]}>
              <Ionicons name="sparkles" size={22} color="#EC4899" />
            </View>
            <View style={styles.statPillContent}>
              <Text style={[styles.statPillValue, { color: theme.colors.textPrimary }]}>
                {homeStats.newCount}
              </Text>
              <Text style={[styles.statPillLabel, { color: theme.colors.textSecondary }]}>
                New
              </Text>
            </View>
          </View>

          <View style={[styles.statPill, { backgroundColor: theme.colors.surface }]}>
            <View style={[styles.statPillIcon, { backgroundColor: theme.colors.info + '15' }]}>
              <Ionicons name="school" size={22} color={theme.colors.info} />
            </View>
            <View style={styles.statPillContent}>
              <Text style={[styles.statPillValue, { color: theme.colors.textPrimary }]}>
                {homeStats.learningCount}
              </Text>
              <Text style={[styles.statPillLabel, { color: theme.colors.textSecondary }]}>
                Learning
              </Text>
            </View>
          </View>
        </View>

        {/* Collection Stats */}
        <View style={styles.collectionRow}>
          <View style={[styles.collectionCard, { backgroundColor: theme.colors.surface }]}>
            <Ionicons name="library" size={28} color={theme.colors.accent} />
            <Text style={[styles.collectionValue, { color: theme.colors.textPrimary }]}>
              {homeStats.totalCardsCount}
            </Text>
            <Text style={[styles.collectionLabel, { color: theme.colors.textSecondary }]}>
              Total Cards
            </Text>
          </View>

          <View style={[styles.collectionCard, { backgroundColor: theme.colors.surface }]}>
            <Ionicons name="albums" size={28} color={theme.colors.success} />
            <Text style={[styles.collectionValue, { color: theme.colors.textPrimary }]}>
              {homeStats.totalDecksCount}
            </Text>
            <Text style={[styles.collectionLabel, { color: theme.colors.textSecondary }]}>
              Decks
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
    padding: s.xl,
    paddingBottom: s.xl * 3,
    gap: s.xl,
  },
  // Header Section
  headerSection: {
    gap: s.md,
    marginBottom: s.sm,
  },
  greetingSmall: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.5,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  greetingLarge: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 38,
    marginBottom: s.xs,
  },
  streakContainer: {
    alignItems: 'center',
    marginTop: s.xs,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.sm,
    paddingVertical: s.md,
    paddingHorizontal: s.xl,
    borderRadius: r.pill,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  streakText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  // Hero Card
  heroCard: {
    borderRadius: r['2xl'],
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  heroGradient: {
    padding: s['2xl'],
  },
  heroContent: {
    alignItems: 'center',
    gap: s.sm,
  },
  heroIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: s.sm,
  },
  heroLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroValue: {
    fontSize: 72,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 72,
  },
  heroSubtext: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: s.md,
  },
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: s.md,
    paddingHorizontal: s.xl,
    borderRadius: r.pill,
    gap: s.sm,
    marginTop: s.sm,
  },
  heroButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000',
  },
  completedHero: {
    padding: s.xl,
    alignItems: 'center',
    gap: s.md,
  },
  completedSubtext: {
    fontSize: 15,
    textAlign: 'center',
  },
  // Today's Progress
  todayCard: {
    padding: s.xl,
    borderRadius: r['2xl'],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  todayHeader: {
    marginBottom: s.lg,
  },
  todayHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.sm,
  },
  todayTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  todayStats: {
    flexDirection: 'row',
    gap: s.md,
  },
  todayStat: {
    flex: 1,
    alignItems: 'center',
    gap: s.sm,
  },
  todayStatIcon: {
    width: 44,
    height: 44,
    borderRadius: r.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  todayStatValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  todayStatLabel: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    opacity: 0.8,
  },
  motivationalText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  // Activity Card
  activityCard: {
    padding: s.xl,
    borderRadius: r['2xl'],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: s.md,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  longestStreakText: {
    fontSize: 12,
    fontWeight: '600',
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
    borderRadius: r.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  todayBox: {
    borderWidth: 2.5,
  },
  dayLabel: {
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dayCount: {
    fontSize: 11,
    fontWeight: '700',
  },
  // Stats Row
  statsRow: {
    flexDirection: 'row',
    gap: s.md,
  },
  statPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: s.lg,
    borderRadius: r.xl,
    gap: s.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  statPillIcon: {
    width: 52,
    height: 52,
    borderRadius: r.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statPillContent: {
    gap: 4,
    flex: 1,
  },
  statPillValue: {
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 28,
  },
  statPillLabel: {
    fontSize: 13,
    fontWeight: '700',
    opacity: 0.8,
  },
  // Collection Stats
  collectionRow: {
    flexDirection: 'row',
    gap: s.md,
  },
  collectionCard: {
    flex: 1,
    padding: s.xl,
    borderRadius: r.xl,
    alignItems: 'center',
    gap: s.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  collectionValue: {
    fontSize: 32,
    fontWeight: '900',
    lineHeight: 32,
  },
  collectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    opacity: 0.9,
  },
  // All-time Card
  allTimeCard: {
    padding: s.xl,
    borderRadius: r['2xl'],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  allTimeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.sm,
    marginBottom: s.md,
  },
  allTimeTitle: {
    fontSize: 20,
    fontWeight: '800',
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
