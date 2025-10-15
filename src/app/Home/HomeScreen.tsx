import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/theme';
import { useScheduler } from '../../context/SchedulerProvider';
import { sampleCards } from '../../mocks/sampleCards';
import { db } from '../../services/anki/InMemoryDb';
import { StatsService, HomeStats, GlobalSnapshot, WeeklyCoachReport as WeeklyCoachReportType } from '../../services/anki/StatsService';
import { StatsCardToday, RetentionCard, BacklogPressureCard, EfficiencyCard, StreakCalendarCard, WeeklyCoachReport } from '../../components/stats';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';

export default function HomeScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const { bootstrap } = useScheduler();
  const [homeStats, setHomeStats] = useState<HomeStats | null>(null);
  const [globalSnapshot, setGlobalSnapshot] = useState<GlobalSnapshot | null>(null);
  const [weeklyCoachReport, setWeeklyCoachReport] = useState<WeeklyCoachReportType | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isCalculatingRef = React.useRef(false);
  
  // Contextual motivational message
  const getMotivationalMessage = React.useCallback(() => {
    if (!homeStats || !globalSnapshot) return 'Keep building knowledge';
    
    const streak = homeStats.currentStreak;
    const due = globalSnapshot.todayDue;
    const hour = new Date().getHours();
    const isEvening = hour >= 17;
    
    // Priority: streak protection > due-focused > time-based > default
    if (streak > 0 && due <= 5 && due > 0) {
      return `Protect your ${streak}-day streak`;
    }
    if (due > 0 && due <= 20) {
      return `Clear ${due} to win the day`;
    }
    if (due > 20) {
      return 'Small steps beat big backlogs';
    }
    if (isEvening) {
      return 'Finish strong tonight';
    }
    return 'Keep building knowledge';
  }, [homeStats, globalSnapshot]);
  
  const motivationalMessage = getMotivationalMessage();

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
      const snapshot = statsService.getGlobalSnapshot({ windowDays: 7 });
      const coachReport = statsService.getWeeklyCoachReport();
      setHomeStats(stats);
      setGlobalSnapshot(snapshot);
      setWeeklyCoachReport(coachReport);
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
          {/* Greeting with inline streak */}
          <View style={styles.greetingRow}>
            <Text style={[styles.greetingSmall, { color: theme.colors.textMed }]}>
              {getGreeting}, {userName}
            </Text>
            {homeStats.currentStreak > 0 && (
              <View style={[styles.streakBadge, { backgroundColor: theme.colors.overlay.streak }]}>
                <Ionicons name="flame" size={20} color={theme.colors.streak} />
                <Text style={[styles.streakText, { color: theme.colors.streak }]}>
                  {homeStats.currentStreak}
                </Text>
              </View>
            )}
          </View>
          
          <Text style={[styles.greetingLarge, { color: theme.colors.textHigh }]} numberOfLines={2}>
            {motivationalMessage}
          </Text>
        </View>

        {/* Main CTA: Due Cards */}
        {globalSnapshot && globalSnapshot.todayDue > 0 ? (
          <Pressable 
            style={styles.heroCard}
            onPress={() => navigation.navigate('Study' as never)}
          >
            <LinearGradient
              colors={theme.colors.primaryGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroGradient}
            >
              <View style={styles.heroContent}>
                <View style={styles.heroIconCircle}>
                  <Ionicons name="book" size={32} color={theme.colors.onPrimary} />
                </View>
                <Text style={[styles.heroLabel, { color: theme.colors.onPrimary }]}>READY TO STUDY</Text>
                <Text style={[styles.heroCta, { color: theme.colors.onPrimary }]}>Start Now</Text>
              </View>
            </LinearGradient>
          </Pressable>
        ) : (
          <View style={[styles.heroCard, { backgroundColor: theme.colors.surface2 }]}>
            <View style={styles.completedHero}>
              <View style={[styles.heroIconCircle, { backgroundColor: theme.colors.overlay.success }]}>
                <Ionicons name="checkmark-circle" size={48} color={theme.colors.success} />
              </View>
              <Text style={[styles.heroLabel, { color: theme.colors.textHigh }]}>All Caught Up!</Text>
              <Text style={[styles.completedSubtext, { color: theme.colors.textMed }]}>
                Great work! Check back later for more cards
              </Text>
            </View>
          </View>
        )}

        {/* Today's Session - Clean & Focused */}
        {globalSnapshot && (
          <View style={[styles.sessionCard, { backgroundColor: theme.colors.surface2 }]}>
            <View style={styles.sessionRow}>
              <View style={styles.mainStat}>
                <Text style={[styles.mainStatLabel, { color: theme.colors.textMed }]}>
                  DUE TODAY
                </Text>
                <Text style={[styles.mainStatValue, { color: theme.colors.textHigh }]}>
                  {globalSnapshot.todayDue}
                </Text>
              </View>

              <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />

              <View style={styles.secondaryStat}>
                <Text style={[styles.secondaryStatValue, { color: theme.colors.textHigh }]}>
                  {globalSnapshot.todayLearn}
                </Text>
                <Text style={[styles.secondaryStatLabel, { color: theme.colors.textMed }]}>
                  LEARNING
                </Text>
              </View>

              <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />

              <View style={styles.secondaryStat}>
                <Text style={[styles.secondaryStatValue, { color: theme.colors.textHigh }]}>
                  {globalSnapshot.todayNewLimit}
                </Text>
                <Text style={[styles.secondaryStatLabel, { color: theme.colors.textMed }]}>
                  NEW
                </Text>
              </View>

              {homeStats.todayReviews > 0 && (
                <>
                  <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />
                  <View style={styles.secondaryStat}>
                    <Text style={[styles.secondaryStatValue, { color: theme.colors.textHigh }]}>
                      {homeStats.todayAccuracy}%
                    </Text>
                    <Text style={[styles.secondaryStatLabel, { color: theme.colors.textMed }]}>
                      DONE
                    </Text>
                  </View>
                </>
              )}
            </View>
          </View>
        )}

        {/* Performance Stats - Minimal */}
        {globalSnapshot && homeStats.totalReviewsAllTime > 0 && (
          <View style={[styles.performanceCard, { backgroundColor: theme.colors.surface2 }]}>
            <View style={styles.performanceRow}>
              <View style={styles.performanceItem}>
                <Text style={[styles.performanceLabel, { color: theme.colors.textMed }]}>
                  7-DAY RETENTION
                </Text>
                <Text style={[styles.performanceValue, { color: theme.colors.textHigh }]}>
                  {Math.round(globalSnapshot.retention7)}%
                </Text>
              </View>
              <View style={styles.performanceItem}>
                <Text style={[styles.performanceLabel, { color: theme.colors.textMed }]}>
                  REVIEWS
                </Text>
                <Text style={[styles.performanceValue, { color: theme.colors.textHigh }]}>
                  {homeStats.totalReviewsAllTime.toLocaleString()}
                </Text>
              </View>
              <View style={styles.performanceItem}>
                <Text style={[styles.performanceLabel, { color: theme.colors.textMed }]}>
                  CARDS
                </Text>
                <Text style={[styles.performanceValue, { color: theme.colors.textHigh }]}>
                  {homeStats.totalCardsCount}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Activity Calendar - Full Month View */}
        {globalSnapshot && (
          <StreakCalendarCard
            activities={homeStats.weeklyActivity.map(day => ({
              date: day.date,
              reviewCount: day.reviewCount,
            }))}
            currentStreak={globalSnapshot.streak}
            longestStreak={globalSnapshot.bestStreak}
          />
        )}

        {/* =================================================================== */}
        {/* INSIGHTS & RECOMMENDATIONS */}
        {/* =================================================================== */}

        {globalSnapshot && (
          <BacklogPressureCard
            backlogCount={globalSnapshot.backlogCount}
            medianDaysOverdue={globalSnapshot.backlogMedianDays}
            overduenessIndex={globalSnapshot.overduenessIndex}
          />
        )}

        {weeklyCoachReport && homeStats.totalReviewsAllTime > 0 && (
          <WeeklyCoachReport
            weekStart={weeklyCoachReport.weekStart}
            weekEnd={weeklyCoachReport.weekEnd}
            insights={weeklyCoachReport.insights}
            summary={weeklyCoachReport.summary}
          />
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
    paddingTop: s.lg,
    gap: s.sm,
    marginBottom: s.xl,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  greetingSmall: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  greetingLarge: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 42,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: r.pill,
  },
  streakText: {
    fontSize: 18,
    fontWeight: '800',
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
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: s.sm,
  },
  heroLabel: {
    fontSize: 16,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroCta: {
    fontSize: 20,
    fontWeight: '800',
  },
  heroValue: {
    fontSize: 72,
    fontWeight: '800',
    lineHeight: 72,
  },
  heroSubtext: {
    fontSize: 15,
    marginBottom: s.md,
  },
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: s.md,
    paddingHorizontal: s.xl,
    borderRadius: r.pill,
    gap: s.sm,
    marginTop: s.sm,
  },
  heroButtonText: {
    fontSize: 17,
    fontWeight: '700',
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
  // Session Card - Minimal Horizontal Layout
  sessionCard: {
    padding: s.xl,
    borderRadius: r['2xl'],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mainStat: {
    flex: 2,
  },
  mainStatLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  mainStatValue: {
    fontSize: 36,
    fontWeight: '800',
    lineHeight: 36,
  },
  secondaryStat: {
    flex: 1,
    alignItems: 'center',
  },
  secondaryStatValue: {
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 24,
    marginBottom: 2,
  },
  secondaryStatLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    height: 44,
    marginHorizontal: s.lg,
  },
  // Performance Card
  performanceCard: {
    padding: s.xl,
    borderRadius: r['2xl'],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  performanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  performanceItem: {
    flex: 1,
    alignItems: 'center',
  },
  performanceLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  performanceValue: {
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 24,
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
});
