/**
 * Leeches List - Shows problem cards with high lapses
 * Premium tier component - Phase 6
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/theme';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';

interface Leech {
  cardId: string;
  lapses: number;
  factor: number;
  reps: number;
  question: string;
}

interface LeechesListProps {
  leeches: Leech[];
}

export function LeechesList({ leeches }: LeechesListProps) {
  const theme = useTheme();

  // Format ease factor for display (2500 -> 250%)
  const formatFactor = (factor: number): string => {
    return `${Math.round(factor / 10)}%`;
  };

  // Get color based on lapses severity
  const getLapsesColor = (lapses: number): string => {
    if (lapses >= 15) return theme.colors.danger;
    if (lapses >= 10) return theme.colors.warning;
    return theme.colors.info;
  };

  if (leeches.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.surface2 }]}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.iconBadge, { backgroundColor: theme.colors.overlay.success }]}>
              <Ionicons name="happy-outline" size={22} color={theme.colors.success} />
            </View>
            <View>
              <Text style={[styles.title, { color: theme.colors.textHigh }]}>
                Leeches
              </Text>
              <Text style={[styles.subtitle, { color: theme.colors.success }]}>
                No problem cards
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.infoBox, { backgroundColor: theme.colors.bg }]}>
          <Ionicons name="information-circle-outline" size={16} color={theme.colors.textMed} />
          <Text style={[styles.infoText, { color: theme.colors.textMed }]}>
            No cards with 8+ lapses detected. Great memory retention!
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface2 }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconBadge, { backgroundColor: theme.colors.overlay.warning }]}>
            <Ionicons name="alert-circle-outline" size={22} color={theme.colors.warning} />
          </View>
          <View>
            <Text style={[styles.title, { color: theme.colors.textHigh }]}>
              Leeches
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.textMed }]}>
              {leeches.length} problem card{leeches.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
      </View>

      {/* Leeches List - No nested scroll, parent ScrollView handles it */}
      <View style={styles.listContent}>
        {leeches.map((leech, index) => (
          <View
            key={leech.cardId}
            style={[styles.leechCard, { backgroundColor: theme.colors.bg }]}
          >
            {/* Rank */}
            <View style={styles.leechRank}>
              <Text style={[styles.rankNumber, { color: getLapsesColor(leech.lapses) }]}>
                #{index + 1}
              </Text>
            </View>

            {/* Content */}
            <View style={styles.leechContent}>
              <Text
                style={[styles.questionText, { color: theme.colors.textHigh }]}
                numberOfLines={2}
              >
                {leech.question}
              </Text>

              {/* Stats Row */}
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Ionicons name="close-circle" size={14} color={getLapsesColor(leech.lapses)} />
                  <Text style={[styles.statValue, { color: getLapsesColor(leech.lapses) }]}>
                    {leech.lapses}
                  </Text>
                  <Text style={[styles.statLabel, { color: theme.colors.textLow }]}>
                    lapses
                  </Text>
                </View>

                <View style={styles.statItem}>
                  <Ionicons name="repeat" size={14} color={theme.colors.textMed} />
                  <Text style={[styles.statValue, { color: theme.colors.textHigh }]}>
                    {leech.reps}
                  </Text>
                  <Text style={[styles.statLabel, { color: theme.colors.textLow }]}>
                    reviews
                  </Text>
                </View>

                <View style={styles.statItem}>
                  <Ionicons name="trending-down" size={14} color={theme.colors.info} />
                  <Text style={[styles.statValue, { color: theme.colors.textHigh }]}>
                    {formatFactor(leech.factor)}
                  </Text>
                  <Text style={[styles.statLabel, { color: theme.colors.textLow }]}>
                    ease
                  </Text>
                </View>
              </View>
            </View>
          </View>
        ))}
      </View>

      {/* Info */}
      <View style={[styles.infoBox, { backgroundColor: theme.colors.bg }]}>
        <Ionicons name="information-circle-outline" size={16} color={theme.colors.textMed} />
        <Text style={[styles.infoText, { color: theme.colors.textMed }]}>
          Cards with 8+ lapses. Consider editing, suspending, or breaking down complex cards.
        </Text>
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
  listContent: {
    gap: s.md,
  },
  leechCard: {
    padding: s.md,
    borderRadius: r.lg,
    flexDirection: 'row',
    gap: s.md,
  },
  leechRank: {
    justifyContent: 'center',
  },
  rankNumber: {
    fontSize: 16,
    fontWeight: '800',
  },
  leechContent: {
    flex: 1,
    gap: s.sm,
  },
  questionText: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: 'row',
    gap: s.lg,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
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
