/**
 * What-If Simulator - Forecast workload with different settings
 * Phase 5: Advanced Analytics
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/theme';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';

interface SimulationResult {
  days: number;
  avgDailyReviews: number;
  avgDailyMinutes: number;
  peakDay: number;
  peakReviews: number;
}

interface WhatIfSimulatorProps {
  currentNewPerDay: number;
  currentReviews: number;
  onSimulate: (newPerDay: number, targetDays: number) => SimulationResult;
}

export function WhatIfSimulator({
  currentNewPerDay,
  currentReviews,
  onSimulate,
}: WhatIfSimulatorProps) {
  const theme = useTheme();
  const [newPerDay, setNewPerDay] = useState(currentNewPerDay);
  const [targetDays, setTargetDays] = useState(30);
  const [result, setResult] = useState<SimulationResult | null>(null);

  const presets = [
    { label: 'Conservative', value: Math.max(5, Math.floor(currentNewPerDay * 0.5)) },
    { label: 'Current', value: currentNewPerDay },
    { label: 'Aggressive', value: currentNewPerDay * 2 },
  ];

  const handleSimulate = () => {
    const simResult = onSimulate(newPerDay, targetDays);
    setResult(simResult);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconBadge, { backgroundColor: theme.colors.overlay.primary }]}>
            <Ionicons name="flask" size={22} color={theme.colors.accent} />
          </View>
          <View>
            <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
              What-If Simulator
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
              Forecast your workload
            </Text>
          </View>
        </View>
      </View>

      {/* Presets */}
      <View style={styles.presetsSection}>
        <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>
          New Cards Per Day
        </Text>
        <View style={styles.presetsRow}>
          {presets.map((preset) => (
            <Pressable
              key={preset.label}
              onPress={() => setNewPerDay(preset.value)}
              style={[
                styles.presetButton,
                {
                  backgroundColor:
                    newPerDay === preset.value
                      ? theme.colors.accent
                      : theme.colors.bg,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.presetLabel,
                  {
                    color:
                      newPerDay === preset.value
                        ? theme.colors.onPrimary
                        : theme.colors.textPrimary,
                  },
                ]}
              >
                {preset.label}
              </Text>
              <Text
                style={[
                  styles.presetValue,
                  {
                    color:
                      newPerDay === preset.value
                        ? theme.colors.onPrimary
                        : theme.colors.textSecondary,
                  },
                ]}
              >
                {preset.value}/day
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Custom Input */}
      <View style={styles.inputSection}>
        <View style={styles.inputRow}>
          <Pressable
            onPress={() => setNewPerDay(Math.max(1, newPerDay - 1))}
            style={[styles.stepperButton, { backgroundColor: theme.colors.bg }]}
          >
            <Ionicons name="remove" size={20} color={theme.colors.textPrimary} />
          </Pressable>
          <View style={styles.inputDisplay}>
            <Text style={[styles.inputValue, { color: theme.colors.textPrimary }]}>
              {newPerDay}
            </Text>
            <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>
              new/day
            </Text>
          </View>
          <Pressable
            onPress={() => setNewPerDay(newPerDay + 1)}
            style={[styles.stepperButton, { backgroundColor: theme.colors.bg }]}
          >
            <Ionicons name="add" size={20} color={theme.colors.textPrimary} />
          </Pressable>
        </View>
      </View>

      {/* Simulate Button */}
      <Pressable
        onPress={handleSimulate}
        style={[styles.simulateButton, { backgroundColor: theme.colors.accent }]}
      >
        <Ionicons name="play" size={20} color="#000" />
        <Text style={styles.simulateButtonText}>Run Simulation</Text>
      </Pressable>

      {/* Results */}
      {result && (
        <View style={[styles.resultsSection, { backgroundColor: theme.colors.bg }]}>
          <View style={styles.resultHeader}>
            <Ionicons name="analytics-outline" size={18} color={theme.colors.accent} />
            <Text style={[styles.resultTitle, { color: theme.colors.textPrimary }]}>
              {targetDays}-Day Forecast
            </Text>
          </View>

          <View style={styles.resultsGrid}>
            <View style={styles.resultItem}>
              <Text style={[styles.resultValue, { color: theme.colors.accent }]}>
                {Math.round(result.avgDailyReviews)}
              </Text>
              <Text style={[styles.resultLabel, { color: theme.colors.textSecondary }]}>
                Avg Daily Reviews
              </Text>
            </View>

            <View style={styles.resultItem}>
              <Text style={[styles.resultValue, { color: theme.colors.warning }]}>
                {Math.round(result.avgDailyMinutes)}m
              </Text>
              <Text style={[styles.resultLabel, { color: theme.colors.textSecondary }]}>
                Avg Time/Day
              </Text>
            </View>

            <View style={styles.resultItem}>
              <Text style={[styles.resultValue, { color: theme.colors.danger }]}>
                {result.peakReviews}
              </Text>
              <Text style={[styles.resultLabel, { color: theme.colors.textSecondary }]}>
                Peak Reviews
              </Text>
            </View>
          </View>

          {/* Insight */}
          <View style={styles.insightBox}>
            <Ionicons name="bulb-outline" size={16} color={theme.colors.info} />
            <Text style={[styles.insightText, { color: theme.colors.textSecondary }]}>
              {result.avgDailyReviews > currentReviews * 1.5
                ? `⚠️ This will increase your workload by ${Math.round(
                    ((result.avgDailyReviews - currentReviews) / currentReviews) * 100
                  )}%`
                : result.avgDailyReviews < currentReviews * 0.8
                ? `✓ This will reduce your daily load to ~${Math.round(
                    result.avgDailyMinutes
                  )} min/day`
                : '✓ Sustainable pace with steady growth'}
            </Text>
          </View>
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
  presetsSection: {
    gap: s.sm,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  presetsRow: {
    flexDirection: 'row',
    gap: s.sm,
  },
  presetButton: {
    flex: 1,
    padding: s.md,
    borderRadius: r.lg,
    borderWidth: 2,
    alignItems: 'center',
    gap: 2,
  },
  presetLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  presetValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  inputSection: {
    gap: s.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.md,
  },
  stepperButton: {
    width: 48,
    height: 48,
    borderRadius: r.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputDisplay: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  inputValue: {
    fontSize: 36,
    fontWeight: '900',
    lineHeight: 36,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  simulateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s.sm,
    padding: s.lg,
    borderRadius: r.xl,
  },
  simulateButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000',
  },
  resultsSection: {
    padding: s.lg,
    borderRadius: r.xl,
    gap: s.md,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.xs,
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  resultsGrid: {
    flexDirection: 'row',
    gap: s.md,
  },
  resultItem: {
    flex: 1,
    alignItems: 'center',
    gap: s.xs,
  },
  resultValue: {
    fontSize: 24,
    fontWeight: '900',
  },
  resultLabel: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  insightBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.sm,
    padding: s.sm,
  },
  insightText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
});
