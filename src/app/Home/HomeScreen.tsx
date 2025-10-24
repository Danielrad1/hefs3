import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/theme';
import { useScheduler } from '../../context/SchedulerProvider';
import { useAuth } from '../../context/AuthContext';
import { UserPrefsService } from '../../services/onboarding/UserPrefsService';
import { db } from '../../services/anki/InMemoryDb';
import { StatsService, HomeStats, GlobalSnapshot, WeeklyCoachReport as WeeklyCoachReportType } from '../../services/anki/StatsService';
import { BacklogPressureCard, EfficiencyCard, StreakCalendarCard, WeeklyCoachReport, BestHoursCard, AddsTimelineMini, BacklogClearByCard } from '../../components/stats';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';
import { useNavigation } from '@react-navigation/native';
import { FirstRunGuide } from '../../guided/FirstRunGuide';
import OnboardingModal from '../../components/OnboardingModal';
import { useFocusEffect } from '@react-navigation/native';
import { logger } from '../../utils/logger';

export default function HomeScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { bootstrap } = useScheduler();
  const [homeStats, setHomeStats] = useState<HomeStats | null>(null);
  const [globalSnapshot, setGlobalSnapshot] = useState<GlobalSnapshot | null>(null);
  const [weeklyCoachReport, setWeeklyCoachReport] = useState<WeeklyCoachReportType | null>(null);
  const [bestHoursData, setBestHoursData] = useState<any[]>([]);
  const [addsTimelineData, setAddsTimelineData] = useState<any[]>([]);
  const [avgReviewsPerDay, setAvgReviewsPerDay] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [userName, setUserName] = useState<string>('there');
  const isCalculatingRef = React.useRef(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  
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

  // First run: show welcome popup on Home
  useFocusEffect(
    React.useCallback(() => {
      let active = true;
      (async () => {
        try {
          if (!user?.uid) {
            if (active) setShowWelcomeModal(false);
            return;
          }
          const should = await FirstRunGuide.shouldShowWelcome(user.uid);
          if (active) {
            setShowWelcomeModal(should);
          }
        } catch {
          if (active) setShowWelcomeModal(false);
        }
      })();
      return () => { active = false; };
    }, [navigation, user?.uid])
  );

  // Function to refresh stats
  const refreshStats = React.useCallback((forceRefresh = false) => {
    if (isCalculatingRef.current && !forceRefresh) {
      return;
    }
    
    isCalculatingRef.current = true;
    if (forceRefresh) {
      setIsRefreshing(true);
    }
    
    const timer = setTimeout(() => {
      try {
        const statsService = new StatsService(db);
        const stats = statsService.getHomeStats();
        const snapshot = statsService.getGlobalSnapshot({ windowDays: 7 });
        const coachReport = statsService.getWeeklyCoachReport();
        const bestHours = statsService.getBestHours({ days: 30, minReviews: 20 });
        const addsTimeline = statsService.getAddsTimeline({ days: 7 });
        const dailyAverage = statsService.getRecentDailyAverage({ days: 7 });
        setHomeStats(stats);
        setGlobalSnapshot(snapshot);
        setWeeklyCoachReport(coachReport);
        setBestHoursData(bestHours);
        setAddsTimelineData(addsTimeline);
        setAvgReviewsPerDay(dailyAverage.avgReviewsPerDay);
      } catch (error) {
        logger.error('[HomeScreen] Error calculating stats:', error);
      } finally {
        isCalculatingRef.current = false;
        setIsRefreshing(false);
      }
    }, 0);
    
    return () => clearTimeout(timer);
  }, []);

  // Pull-to-refresh handler
  const onRefresh = React.useCallback(() => {
    refreshStats(true);
  }, [refreshStats]);

  // Calculate statistics when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      const cleanup = refreshStats();
      return cleanup;
    }, [refreshStats])
  );

  // Load user profile when screen is focused (updates when returning from settings)
  useFocusEffect(
    React.useCallback(() => {
      const loadUserProfile = async () => {
        if (user?.uid) {
          try {
            const profile = await UserPrefsService.getUserProfile(user.uid);
            if (profile?.displayName) {
              setUserName(profile.displayName);
            } else if (profile?.firstName) {
              setUserName(profile.firstName);
            } else if (user.displayName) {
              setUserName(user.displayName.split(' ')[0]);
            }
          } catch (error) {
            logger.info('[HomeScreen] Error loading user profile:', error);
          }
        }
      };
      loadUserProfile();
    }, [user])
  );

  // Get greeting based on time of day - updates every render to be accurate
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Good Morning';
    if (hour >= 12 && hour < 17) return 'Good Afternoon';
    if (hour >= 17 && hour < 21) return 'Good Evening';
    return 'Good Night';
  };

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
    <>
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
              {getGreeting()}, {userName}
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

        {/* Today's Session - 4-Column Grid */}
        {globalSnapshot && (
          <View style={[styles.sessionCard, { backgroundColor: theme.colors.surface2 }]}>
            <View style={styles.sessionRow}>
              <View style={styles.todayColumn}>
                <Text 
                  style={[styles.todayColumnValue, { color: theme.colors.textHigh }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.5}
                >
                  {globalSnapshot.todayDue}
                </Text>
                <Text 
                  style={[styles.todayColumnLabel, { color: theme.colors.textMed }]}
                  numberOfLines={1}
                >
                  DUE
                </Text>
              </View>

              <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />

              <View style={styles.todayColumn}>
                <Text 
                  style={[styles.todayColumnValue, { color: theme.colors.textHigh }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.5}
                >
                  {globalSnapshot.todayLearn}
                </Text>
                <Text 
                  style={[styles.todayColumnLabel, { color: theme.colors.textMed }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  LEARNING
                </Text>
              </View>

              <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />

              <View style={styles.todayColumn}>
                <Text 
                  style={[styles.todayColumnValue, { color: theme.colors.textHigh }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.5}
                >
                  {globalSnapshot.todayNewLimit}
                </Text>
                <Text 
                  style={[styles.todayColumnLabel, { color: theme.colors.textMed }]}
                  numberOfLines={1}
                >
                  NEW
                </Text>
              </View>

              <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />

              <View style={styles.todayColumn}>
                <Text 
                  style={[styles.todayColumnValue, { color: theme.colors.textHigh }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.5}
                >
                  {homeStats.todayReviewCount > 0 ? `${homeStats.todayAccuracy}%` : '—'}
                </Text>
                <Text 
                  style={[styles.todayColumnLabel, { color: theme.colors.textMed }]}
                  numberOfLines={1}
                >
                  DONE
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Performance & Pace - Merged Card */}
        {globalSnapshot && homeStats.totalReviewsAllTime > 0 && (
          <View style={[styles.performanceCard, { backgroundColor: theme.colors.surface2 }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.textHigh }]}>
              Performance & Pace (7-Day)
            </Text>
            <View style={styles.performanceRow}>
              <View style={styles.performanceItem}>
                <Text style={[styles.performanceLabel, { color: theme.colors.textMed }]}>
                  RETENTION
                </Text>
                <Text style={[styles.performanceValue, { color: theme.colors.textHigh }]}>
                  {Math.round(globalSnapshot.retention7)}%
                </Text>
              </View>
              <View style={styles.performanceItem}>
                <Text style={[styles.performanceLabel, { color: theme.colors.textMed }]}>
                  RPM
                </Text>
                <Text style={[styles.performanceValue, { color: theme.colors.textHigh }]}>
                  {globalSnapshot.reviewsPerMin.toFixed(1)}
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

        {/* Premium Analytics - Inline */}
        {bestHoursData.length > 0 && homeStats.totalReviewsAllTime > 50 && (
          <BestHoursCard data={bestHoursData} variant="compact" />
        )}

        {addsTimelineData.length > 0 && addsTimelineData.some(d => d.count > 0) && (
          <AddsTimelineMini points={addsTimelineData} days={7} />
        )}

        {/* Backlog Management */}
        {globalSnapshot && globalSnapshot.backlogCount > 0 ? (
          avgReviewsPerDay > 0 && (
            <BacklogClearByCard
              backlogCount={globalSnapshot.backlogCount}
              avgReviewsPerDay={avgReviewsPerDay}
              todayNewLimit={globalSnapshot.todayNewLimit}
            />
          )
        ) : (
          globalSnapshot && (
            <BacklogPressureCard
              backlogCount={globalSnapshot.backlogCount}
              medianDaysOverdue={globalSnapshot.backlogMedianDays}
              overduenessIndex={globalSnapshot.overduenessIndex}
            />
          )
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
      {/* Welcome Popup */}
      <OnboardingModal
        visible={showWelcomeModal}
        icon="hand-left-outline"
        helper="Takes ~1 minute"
        title="Welcome to enqode"
        body="Let's do a quick guided start. Tap the Discover tab below to browse curated decks, then import one to begin."
        primaryLabel="Let's Go"
        onPrimary={async () => {
          if (user?.uid) {
            try {
              await FirstRunGuide.markWelcomeShown(user.uid);
            } catch (error) {
              console.error('Error marking welcome modal as shown:', error);
            }
          }
          setShowWelcomeModal(false);
          (navigation as any).navigate?.('Discover');
        }}
      />
    </>
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
    justifyContent: 'space-between',
  },
  todayColumn: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 2,
    minWidth: 0,
  },
  todayColumnValue: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 24,
    marginBottom: 2,
    width: '100%',
    textAlign: 'center',
  },
  todayColumnLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    width: '100%',
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    height: 44,
    marginHorizontal: s.sm,
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
    gap: s.md,
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
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 20,
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
