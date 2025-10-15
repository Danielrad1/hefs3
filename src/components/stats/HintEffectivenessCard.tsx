/**
 * Hint Effectiveness Card - Shows hint usage and success metrics
 * Phase 4: Hint Intelligence
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/theme';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';

interface HintEffectivenessCardProps {
  adoptionPct: number;
  avgDepth: number;
  successAfterHintPct: number;
  successWithoutHintPct: number;
  weakConcepts?: Array<{
    tag: string;
    againRate: number;
    hintUsePct: number;
  }>;
}

export function HintEffectivenessCard({
  adoptionPct,
  avgDepth,
  successAfterHintPct,
  successWithoutHintPct,
  weakConcepts = [],
}: HintEffectivenessCardProps) {
  const theme = useTheme();

  const hasData = adoptionPct > 0;
  const hintsAreHelpful = successAfterHintPct > successWithoutHintPct;
  const effectivenessDelta = successAfterHintPct - successWithoutHintPct;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconBadge, { backgroundColor: theme.colors.overlay.warning }]}>
            <Ionicons name="bulb" size={22} color={theme.colors.warning} />
          </View>
          <View>
            <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
              Hint Intelligence
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
              AI-powered learning support
            </Text>
          </View>
        </View>
      </View>

      {hasData ? (
        <>
          {/* Adoption Rate */}
          <View style={styles.adoptionSection}>
            <View style={styles.adoptionHeader}>
              <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>
                Hint Adoption
              </Text>
              <Text style={[styles.adoptionValue, { color: theme.colors.warning }]}>
                {Math.round(adoptionPct)}%
              </Text>
            </View>
            <View style={[styles.progressBar, { backgroundColor: theme.colors.bg }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: theme.colors.warning,
                    width: `${Math.min(adoptionPct, 100)}%`,
                  },
                ]}
              />
            </View>
            <Text style={[styles.helperText, { color: theme.colors.textTertiary }]}>
              You use hints on {Math.round(adoptionPct)}% of cards
            </Text>
          </View>

          {/* Effectiveness Comparison */}
          <View style={styles.comparisonSection}>
            <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>
              Success Rate Comparison
            </Text>
            <View style={styles.comparisonRow}>
              <View style={styles.comparisonItem}>
                <View style={[styles.comparisonIcon, { backgroundColor: theme.colors.overlay.success }]}>
                  <Ionicons name="bulb" size={20} color={theme.colors.success} />
                </View>
                <Text style={[styles.comparisonLabel, { color: theme.colors.textSecondary }]}>
                  With Hint
                </Text>
                <Text style={[styles.comparisonValue, { color: theme.colors.textPrimary }]}>
                  {Math.round(successAfterHintPct)}%
                </Text>
              </View>

              <View style={styles.comparisonDivider}>
                <Ionicons
                  name={hintsAreHelpful ? 'chevron-forward' : 'remove-outline'}
                  size={20}
                  color={hintsAreHelpful ? theme.colors.success : theme.colors.textSecondary}
                />
              </View>

              <View style={styles.comparisonItem}>
                <View style={[styles.comparisonIcon, { backgroundColor: theme.colors.overlay.info }]}>
                  <Ionicons name="eye-off" size={20} color={theme.colors.info} />
                </View>
                <Text style={[styles.comparisonLabel, { color: theme.colors.textSecondary }]}>
                  Without
                </Text>
                <Text style={[styles.comparisonValue, { color: theme.colors.textPrimary }]}>
                  {Math.round(successWithoutHintPct)}%
                </Text>
              </View>
            </View>

            {/* Delta Badge */}
            {Math.abs(effectivenessDelta) > 5 && (
              <View
                style={[
                  styles.deltaBadge,
                  {
                    backgroundColor: hintsAreHelpful
                      ? theme.colors.overlay.success
                      : theme.colors.overlay.danger,
                  },
                ]}
              >
                <Ionicons
                  name={hintsAreHelpful ? 'trending-up' : 'trending-down'}
                  size={16}
                  color={hintsAreHelpful ? theme.colors.success : theme.colors.danger}
                />
                <Text
                  style={[
                    styles.deltaText,
                    {
                      color: hintsAreHelpful ? theme.colors.success : theme.colors.danger,
                    },
                  ]}
                >
                  {hintsAreHelpful ? '+' : ''}
                  {effectivenessDelta.toFixed(1)}% {hintsAreHelpful ? 'boost' : 'drop'}
                </Text>
              </View>
            )}
          </View>

          {/* Average Depth */}
          <View style={styles.depthSection}>
            <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>
              Average Hint Depth
            </Text>
            <View style={styles.depthIndicator}>
              {[1, 2, 3].map((level) => (
                <View
                  key={level}
                  style={[
                    styles.depthDot,
                    {
                      backgroundColor:
                        level <= avgDepth ? theme.colors.warning : theme.colors.border,
                      opacity: level <= avgDepth ? 1 : 0.3,
                    },
                  ]}
                />
              ))}
              <Text style={[styles.depthText, { color: theme.colors.textPrimary }]}>
                L{Math.round(avgDepth)} avg
              </Text>
            </View>
          </View>

          {/* Weak Concepts */}
          {weakConcepts.length > 0 && (
            <View style={[styles.weakConceptsSection, { backgroundColor: theme.colors.bg }]}>
              <View style={styles.weakConceptsHeader}>
                <Ionicons name="alert-circle-outline" size={16} color={theme.colors.warning} />
                <Text style={[styles.weakConceptsTitle, { color: theme.colors.textSecondary }]}>
                  Cards Needing Attention ({weakConcepts.length})
                </Text>
              </View>
              {weakConcepts.slice(0, 3).map((concept, idx) => (
                <View key={idx} style={styles.weakConceptItem}>
                  <Text style={[styles.weakConceptTag, { color: theme.colors.textPrimary }]}>
                    {concept.tag}
                  </Text>
                  <Text style={[styles.weakConceptStat, { color: theme.colors.warning }]}>
                    {Math.round(concept.hintUsePct)}% hints
                  </Text>
                </View>
              ))}
            </View>
          )}
        </>
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="bulb-outline" size={64} color={theme.colors.textTertiary} />
          <Text style={[styles.emptyTitle, { color: theme.colors.textPrimary }]}>
            No Hint Data Yet
          </Text>
          <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
            Enable AI hints and start studying to see effectiveness analytics
          </Text>
        </View>
      )}
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
  adoptionSection: {
    gap: s.sm,
  },
  adoptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  adoptionValue: {
    fontSize: 24,
    fontWeight: '900',
  },
  progressBar: {
    height: 8,
    borderRadius: r.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: r.full,
  },
  helperText: {
    fontSize: 12,
    fontWeight: '600',
  },
  comparisonSection: {
    gap: s.md,
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.md,
  },
  comparisonItem: {
    flex: 1,
    alignItems: 'center',
    gap: s.xs,
  },
  comparisonIcon: {
    width: 40,
    height: 40,
    borderRadius: r.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  comparisonLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  comparisonValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  comparisonDivider: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  deltaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s.xs,
    paddingHorizontal: s.md,
    paddingVertical: s.sm,
    borderRadius: r.full,
    alignSelf: 'center',
  },
  deltaText: {
    fontSize: 13,
    fontWeight: '800',
  },
  depthSection: {
    gap: s.sm,
  },
  depthIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.xs,
  },
  depthDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  depthText: {
    fontSize: 14,
    fontWeight: '800',
    marginLeft: s.sm,
  },
  weakConceptsSection: {
    padding: s.md,
    borderRadius: r.lg,
    gap: s.sm,
  },
  weakConceptsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.xs,
  },
  weakConceptsTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  weakConceptItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: s.xs,
  },
  weakConceptTag: {
    fontSize: 13,
    fontWeight: '600',
  },
  weakConceptStat: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: s.xl,
    gap: s.md,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 280,
  },
});
