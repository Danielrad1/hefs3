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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/theme';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';
import { db } from '../../services/anki/InMemoryDb';
import { StatsService, DeckSnapshot, HintStats } from '../../services/anki/StatsService';
import { DeckHealthCard, DeckCountsBar, HintEffectivenessCard, SurvivalCurves } from '../../components/stats';
import { deckMetadataService } from '../../services/anki/DeckMetadataService';

type DeckStatsScreenRouteProp = RouteProp<
  { DeckStats: { deckId: string; deckName: string } },
  'DeckStats'
>;

export default function DeckStatsScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const route = useRoute<DeckStatsScreenRouteProp>();
  const { deckId, deckName } = route.params;

  const [snapshot, setSnapshot] = useState<DeckSnapshot | null>(null);
  const [hintStats, setHintStats] = useState<HintStats | null>(null);
  const [aiHintsEnabled, setAiHintsEnabled] = useState(false);
  const [windowDays, setWindowDays] = useState<7 | 30>(7);
  const [loading, setLoading] = useState(true);
  const [survivalData, setSurvivalData] = useState<{
    youngSurvival: Array<{ interval: number; survivalRate: number }>;
    matureSurvival: Array<{ interval: number; survivalRate: number }>;
    halfLifeYoung: number;
    halfLifeMature: number;
  } | null>(null);

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
      setSnapshot(data);
      setHintStats(hints);
      setSurvivalData(survival);
      setLoading(false);
    }, 0);
  };

  const loadHintSettings = async () => {
    const settings = await deckMetadataService.getAiHintsSettings(deckId);
    setAiHintsEnabled(settings.enabled);
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

      {/* Time Window Toggle */}
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

        {/* Hint Effectiveness - Phase 4 */}
        {aiHintsEnabled && hintStats && (
          <HintEffectivenessCard
            adoptionPct={hintStats.adoptionPct}
            avgDepth={hintStats.avgDepth}
            successAfterHintPct={hintStats.successAfterHintPct}
            successWithoutHintPct={hintStats.successWithoutHintPct}
            weakConcepts={hintStats.weakTags}
          />
        )}

        {/* =================================================================== */}
        {/* CARD DISTRIBUTION */}
        {/* =================================================================== */}

        <DeckCountsBar counts={snapshot.counts} />

        {/* Survival Curves */}
        {survivalData && survivalData.youngSurvival.length > 0 && (
          <SurvivalCurves
            youngSurvival={survivalData.youngSurvival}
            matureSurvival={survivalData.matureSurvival}
            halfLifeYoung={survivalData.halfLifeYoung}
            halfLifeMature={survivalData.halfLifeMature}
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
      </ScrollView>
    </SafeAreaView>
  );
}

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
});
