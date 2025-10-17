/**
 * Deck Stats Screen - Comprehensive deck analytics
 * Accessible from DeckDetailScreen
 * Phase 2: Professional stats integration
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
// BlurView can be added later with: npx expo install expo-blur
import { useTheme } from '../../design/theme';
import { usePremium } from '../../context/PremiumContext';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';
import { db } from '../../services/anki/InMemoryDb';
import { StatsService, DeckSnapshot, HintStats } from '../../services/anki/StatsService';
import { DeckHealthCard, DeckCountsBar, HintEffectivenessCard, SurvivalCurves, ForecastChart, AnswerButtonsDistribution, LeechesList } from '../../components/stats';
import { deckMetadataService } from '../../services/anki/DeckMetadataService';
import PremiumUpsellModal from '../../components/premium/PremiumUpsellModal';

type DeckStatsScreenRouteProp = RouteProp<
  { DeckStats: { deckId: string; deckName: string } },
  'DeckStats'
>;

export default function DeckStatsScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const route = useRoute<DeckStatsScreenRouteProp>();
  const { deckId, deckName } = route.params;
  const { isPremiumEffective, subscribe } = usePremium();

  const [snapshot, setSnapshot] = useState<DeckSnapshot | null>(null);
  const [hintStats, setHintStats] = useState<HintStats | null>(null);
  const [aiHintsEnabled, setAiHintsEnabled] = useState(false);
  const [windowDays, setWindowDays] = useState<7 | 30>(7);
  const [loading, setLoading] = useState(true);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [survivalData, setSurvivalData] = useState<{
    youngSurvival: Array<{ interval: number; survivalRate: number }>;
    matureSurvival: Array<{ interval: number; survivalRate: number }>;
    halfLifeYoung: number;
    halfLifeMature: number;
  } | null>(null);
  const [forecastData, setForecastData] = useState<any[]>([]);
  const [answerDistribution, setAnswerDistribution] = useState<any[]>([]);
  const [leeches, setLeeches] = useState<any[]>([]);

  useEffect(() => {
    loadStats();
    loadHintSettings();
  }, [deckId, windowDays]);

  const loadStats = () => {
    setLoading(true);
    setTimeout(() => {
      const statsService = new StatsService(db);
      const data = statsService.getDeckSnapshot(deckId, { windowDays });
      const hints = statsService.getHintStats({ deckId, days: windowDays });
      const survival = statsService.getSurvivalCurves(deckId);
      const forecast = statsService.getForecast({ days: windowDays === 7 ? 7 : 30, deckId });
      const leechesData = statsService.getLeeches({ deckId, limit: 10 });
      
      // Calculate answer button distribution
      const revlog = db.getAllRevlog().filter(r => {
        const card = db.getCard(r.cid);
        return card?.did === deckId;
      });
      const windowStart = Date.now() - windowDays * 86400000;
      const windowRevlog = revlog.filter(r => parseInt(r.id, 10) >= windowStart);
      
      // Group by state (Learn=type 0/2, Young=ivl<21, Mature=ivl>=21)
      // NOTE: "New" is not a revlog type - cards appear as Learn on first review
      const distributions = [
        { state: 'Learn' as const, again: 0, hard: 0, good: 0, easy: 0, total: 0 },
        { state: 'Young' as const, again: 0, hard: 0, good: 0, easy: 0, total: 0 },
        { state: 'Mature' as const, again: 0, hard: 0, good: 0, easy: 0, total: 0 },
      ];
      
      for (const r of windowRevlog) {
        let stateIdx = 0;
        // Learn: revlog.type 0 (Learn) or 2 (Relearn)
        if (r.type === 0 || r.type === 2) {
          stateIdx = 0; // Learn
        }
        // Review entries split by interval
        else if (r.type === 1) {
          if (r.lastIvl < 21) {
            stateIdx = 1; // Young
          } else {
            stateIdx = 2; // Mature
          }
        }
        
        const dist = distributions[stateIdx];
        dist.total++;
        if (r.ease === 1) dist.again++;
        else if (r.ease === 2) dist.hard++;
        else if (r.ease === 3) dist.good++;
        else if (r.ease === 4) dist.easy++;
      }
      
      setSnapshot(data);
      setHintStats(hints);
      setSurvivalData(survival);
      setForecastData(forecast);
      setAnswerDistribution(distributions.filter(d => d.total > 0));
      setLoading(false);
    }, 0);
  };

  const loadHintSettings = async () => {
    const meta = await deckMetadataService.getMetadata(deckId);
    setAiHintsEnabled(meta?.aiHintsEnabled || false);
  };

  const handleSubscribePress = async () => {
    try {
      await subscribe();
      setShowPremiumModal(false);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to start subscription');
    }
  };

  if (loading || !snapshot) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.bg }]}
        edges={['top']}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
            Calculating statistics...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.bg }]}
      edges={['top']}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [
            styles.backButton,
            { opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>
            Statistics
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
            {deckName}
          </Text>
        </View>
        <View style={styles.backButton} />
      </View>

      {/* Time Window Toggle - Only show for premium users */}
      {isPremiumEffective && (
        <View style={styles.windowToggle}>
          <Pressable
            onPress={() => setWindowDays(7)}
            style={[
              styles.toggleButton,
              {
                backgroundColor:
                  windowDays === 7 ? theme.colors.primary : 'transparent',
              },
            ]}
          >
            <Text
              style={[
                styles.toggleText,
                {
                  color: windowDays === 7 ? theme.colors.onPrimary : theme.colors.textSecondary,
                  fontWeight: windowDays === 7 ? '700' : '600',
                },
              ]}
            >
              7 Days
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setWindowDays(30)}
            style={[
              styles.toggleButton,
              {
                backgroundColor:
                  windowDays === 30 ? theme.colors.primary : 'transparent',
              },
            ]}
          >
            <Text
              style={[
                styles.toggleText,
                {
                  color: windowDays === 30 ? theme.colors.onPrimary : theme.colors.textSecondary,
                  fontWeight: windowDays === 30 ? '700' : '600',
                },
              ]}
            >
              30 Days
            </Text>
          </Pressable>
        </View>
      )}

      <View style={{ flex: 1 }}>
        {/* Show blurred stats for free users */}
        {!isPremiumEffective && (
          <>
            <View style={[styles.blurredBackground, { opacity: 0.15 }]}>
              <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                scrollEnabled={false}
              >
                <DeckHealthCard
                  difficultyIndex={snapshot.difficultyIndex}
                  retention={{
                    young7: snapshot.retention.young7,
                    mature7: snapshot.retention.mature7,
                  }}
                  throughput={{
                    rpm: snapshot.throughput.rpm,
                    secPerReview: snapshot.throughput.secPerReview,
                  }}
                  estTimeMinutes={Math.round(snapshot.today.estTimeP50Sec / 60)}
                />
              </ScrollView>
            </View>
            
            {/* Unlock overlay */}
            <View style={[styles.unlockOverlay, { backgroundColor: theme.colors.bg + 'F5' }]}>
              <ScrollView contentContainerStyle={styles.unlockContent}>
                <View style={[styles.unlockIcon, { backgroundColor: theme.colors.accent + '20' }]}>
                  <Ionicons name="bar-chart" size={48} color={theme.colors.accent} />
                </View>
                <Text style={[styles.unlockTitle, { color: theme.colors.textPrimary }]}>
                  Unlock Advanced Analytics
                </Text>
                <Text style={[styles.unlockSubtitle, { color: theme.colors.textSecondary }]}>
                  Study more efficiently and faster with data-driven insights
                </Text>
                
                <View style={styles.statsList}>
                  <StatBenefit 
                    icon="trending-up"
                    title="Know when you'll be ready"
                    description="See exactly when material sticks long-term."
                    theme={theme}
                  />
                  <StatBenefit 
                    icon="calendar"
                    title="Catch weak spots early"
                    description="Focus study time where it matters most."
                    theme={theme}
                  />
                  <StatBenefit 
                    icon="flash"
                    title="Study at peak hours"
                    description="Schedule when your brain learns fastest."
                    theme={theme}
                  />
                  <StatBenefit 
                    icon="pulse"
                    title="Track what sticks"
                    description="See how long material stays in memory."
                    theme={theme}
                  />
                </View>
                
                <Pressable
                  style={[styles.unlockButton, { backgroundColor: theme.colors.accent }]}
                  onPress={() => setShowPremiumModal(true)}
                >
                  <Ionicons name="sparkles" size={20} color="#000" />
                  <Text style={styles.unlockButtonText}>Unlock Premium Analytics</Text>
                </Pressable>
              </ScrollView>
            </View>
          </>
        )}
        
        {/* Full stats for premium users */}
        {isPremiumEffective && (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
          {/* Deck Health Summary - Hero Card */}
        <DeckHealthCard
          difficultyIndex={snapshot.difficultyIndex}
          retention={{
            young7: snapshot.retention.young7,
            mature7: snapshot.retention.mature7,
          }}
          throughput={{
            rpm: snapshot.throughput.rpm,
            secPerReview: snapshot.throughput.secPerReview,
          }}
          estTimeMinutes={Math.round(snapshot.today.estTimeP50Sec / 60)}
        />

        {/* Retention Grid */}
        <View style={[styles.retentionCard, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>
            Retention
          </Text>
          <View style={styles.retentionGrid}>
            <View style={[styles.retentionItem, { backgroundColor: theme.colors.overlay.success }]}>
              <Text style={[styles.retentionLabel, { color: theme.colors.textSecondary }]}>
                Young
              </Text>
              <Text style={[styles.retentionValue, { color: theme.colors.textPrimary }]}>
                {Math.round(
                  windowDays === 7 ? snapshot.retention.young7 : snapshot.retention.young30
                )}%
              </Text>
            </View>
            <View style={[styles.retentionItem, { backgroundColor: theme.colors.overlay.success }]}>
              <Text style={[styles.retentionLabel, { color: theme.colors.textSecondary }]}>
                Mature
              </Text>
              <Text style={[styles.retentionValue, { color: theme.colors.textPrimary }]}>
                {Math.round(
                  windowDays === 7 ? snapshot.retention.mature7 : snapshot.retention.mature30
                )}%
              </Text>
            </View>
          </View>
        </View>

        {/* Compact Metrics Grid */}
        <View style={styles.metricsGrid}>
          <View style={[styles.metricCard, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>
              Avg Ease
            </Text>
            <Text style={[styles.metricValue, { color: theme.colors.textPrimary }]}>
              {(snapshot.avgEase / 100).toFixed(2)}
            </Text>
          </View>

          <View style={[styles.metricCard, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>
              Reviews/Min
            </Text>
            <Text style={[styles.metricValue, { color: theme.colors.textPrimary }]}>
              {snapshot.throughput.rpm.toFixed(1)}
            </Text>
          </View>

          <View style={[styles.metricCard, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>
              Lapses/100
            </Text>
            <Text style={[styles.metricValue, { color: theme.colors.textPrimary }]}>
              {snapshot.lapsesPer100.toFixed(1)}
            </Text>
          </View>
        </View>

        {/* Premium upgrade prompt */}
        {!isPremiumEffective && (
          <Pressable 
            style={[styles.upgradeCard, { backgroundColor: theme.colors.accent + '15', borderColor: theme.colors.accent + '40' }]}
            onPress={() => setShowPremiumModal(true)}
          >
            <View style={[styles.upgradeIcon, { backgroundColor: theme.colors.accent + '20' }]}>
              <Ionicons name="bar-chart" size={32} color={theme.colors.accent} />
            </View>
            <Text style={[styles.upgradeTitle, { color: theme.colors.textPrimary }]}>
              Unlock Advanced Analytics
            </Text>
            <Text style={[styles.upgradeSubtitle, { color: theme.colors.textMed }]}>
              See forecasts, survival curves, answer patterns, and get AI-powered study recommendations
            </Text>
            <View style={[styles.upgradeButton, { backgroundColor: theme.colors.accent }]}>
              <Ionicons name="sparkles" size={16} color="#000" />
              <Text style={styles.upgradeButtonText}>Upgrade to Premium</Text>
            </View>
          </Pressable>
        )}

        {/* Hint Effectiveness - Phase 4 - Premium only */}
        {isPremiumEffective && aiHintsEnabled && hintStats && (
          <HintEffectivenessCard
            adoptionPct={hintStats.adoptionPct}
            avgDepth={hintStats.avgDepth}
            successAfterHintPct={hintStats.successAfterHintPct}
            successWithoutHintPct={hintStats.successWithoutHintPct}
            weakConcepts={hintStats.weakTags}
          />
        )}

        {/* Advanced stats - Premium only */}
        {isPremiumEffective && (
          <>
        {/* =================================================================== */}
        {/* CARD DISTRIBUTION */}
        {/* =================================================================== */}

        <DeckCountsBar counts={snapshot.counts} />

        {/* Answer Buttons Distribution - Premium */}
        {answerDistribution.length > 0 && (
          <AnswerButtonsDistribution distributions={answerDistribution} />
        )}

        {/* Survival Curves */}
        {survivalData && survivalData.youngSurvival.length > 0 && (
          <SurvivalCurves
            youngSurvival={survivalData.youngSurvival}
            matureSurvival={survivalData.matureSurvival}
            halfLifeYoung={survivalData.halfLifeYoung}
            halfLifeMature={survivalData.halfLifeMature}
          />
        )}

        {/* Leeches List - Premium */}
        {leeches.length > 0 && <LeechesList leeches={leeches} />}

        {/* Forecast Chart - Premium */}
        {forecastData.length > 0 && (
          <ForecastChart
            points={forecastData}
            stacked={true}
            days={windowDays === 7 ? 7 : 30}
          />
        )}

        {/* =================================================================== */}
        {/* HELP & INFO */}
        {/* =================================================================== */}

        {/* Info Card */}
        <View style={[styles.infoCard, { backgroundColor: theme.colors.overlay.info }]}>
          <View style={[styles.infoIcon, { backgroundColor: theme.colors.overlay.info }]}>
            <Ionicons name="information-circle" size={24} color={theme.colors.info} />
          </View>
          <View style={styles.infoContent}>
            <Text style={[styles.infoTitle, { color: theme.colors.info }]}>
              About These Stats
            </Text>
            <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
              Statistics are calculated from your review history over the selected time window.
              {'\n\n'}
              <Text style={{ fontWeight: '700' }}>Young cards</Text> have intervals under 21 days.
              {'\n'}
              <Text style={{ fontWeight: '700' }}>Mature cards</Text> have intervals of 21 days or more.
            </Text>
          </View>
        </View>
          </>
        )}
        </ScrollView>
        )}
      </View>

      <PremiumUpsellModal
        visible={showPremiumModal}
        onClose={() => setShowPremiumModal(false)}
      />
    </SafeAreaView>
  );
}

// Helper component for stat benefits
function StatBenefit({ icon, title, description, theme }: { icon: keyof typeof Ionicons.glyphMap; title: string; description: string; theme: any }) {
  return (
    <View style={statBenefitStyles.container}>
      <View style={[statBenefitStyles.icon, { backgroundColor: theme.colors.accent + '15' }]}>
        <Ionicons name={icon} size={24} color={theme.colors.accent} />
      </View>
      <View style={statBenefitStyles.content}>
        <Text style={[statBenefitStyles.title, { color: theme.colors.textPrimary }]}>{title}</Text>
        <Text style={[statBenefitStyles.description, { color: theme.colors.textMed }]}>{description}</Text>
      </View>
    </View>
  );
}

const statBenefitStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: s.md,
    marginBottom: s.lg,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: r.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: s.xs / 2,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: s.lg,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: s.lg,
    paddingVertical: s.md,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  windowToggle: {
    flexDirection: 'row',
    marginHorizontal: s.xl,
    marginBottom: s.lg,
    gap: s.sm,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: s.md,
    borderRadius: r.lg,
    alignItems: 'center',
  },
  toggleText: {
    fontSize: 14,
  },
  scrollContent: {
    padding: s.xl,
    paddingTop: 0,
    gap: s.xl,
    paddingBottom: s.xl * 3,
  },
  // Hero Stats
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: s.xl,
    borderRadius: r['2xl'],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  heroStat: {
    flex: 1,
    alignItems: 'center',
  },
  heroStatValue: {
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 32,
    marginBottom: 4,
  },
  heroStatLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroDivider: {
    width: 1,
    height: 40,
    marginHorizontal: s.md,
  },
  // Retention Card
  retentionCard: {
    padding: s.xl,
    borderRadius: r['2xl'],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: s.lg,
  },
  retentionGrid: {
    flexDirection: 'row',
    gap: s.md,
  },
  retentionItem: {
    flex: 1,
    alignItems: 'center',
    padding: s.lg,
    borderRadius: r.lg,
  },
  retentionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: s.xs,
  },
  retentionValue: {
    fontSize: 36,
    fontWeight: '800',
    lineHeight: 36,
  },
  // Metrics Grid
  metricsGrid: {
    flexDirection: 'row',
    gap: s.md,
  },
  metricCard: {
    flex: 1,
    padding: s.lg,
    borderRadius: r.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: s.xs,
    textAlign: 'center',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 24,
  },
  divider: {
    height: 1,
  },
  infoCard: {
    flexDirection: 'row',
    padding: s.xl,
    borderRadius: r.xl,
    gap: s.md,
  },
  infoIcon: {
    width: 44,
    height: 44,
    borderRadius: r.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContent: {
    flex: 1,
    gap: s.xs,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  infoText: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '500',
  },
  // Unlock overlay for free users
  blurredBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  unlockOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
  },
  unlockContent: {
    padding: s.xl,
    alignItems: 'center',
  },
  unlockIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: s.lg,
  },
  unlockTitle: {
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: s.sm,
  },
  unlockSubtitle: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: s.xl,
  },
  statsList: {
    width: '100%',
    marginBottom: s.xl,
  },
  unlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.sm,
    paddingHorizontal: s.xl,
    paddingVertical: s.lg,
    borderRadius: r.lg,
  },
  unlockButtonText: {
    fontSize: 17,
    fontWeight: '900',
    color: '#000',
  },
  // Upgrade card
  upgradeCard: {
    borderWidth: 2,
    borderRadius: r.xl,
    padding: s.xl,
    alignItems: 'center',
    gap: s.md,
  },
  upgradeIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: s.xs,
  },
  upgradeTitle: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  upgradeSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: s.sm,
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.xs,
    paddingHorizontal: s.lg,
    paddingVertical: s.md,
    borderRadius: r.lg,
  },
  upgradeButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#000',
  },
});
