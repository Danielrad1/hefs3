import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../design/theme';
import { s } from '../../../design/spacing';
import { r } from '../../../design/radii';

type ModelTier = 'basic' | 'advanced';

interface ModelSelectionStepProps {
  selectedTier: ModelTier;
  onSelectTier: (tier: ModelTier) => void;
  itemLimit: number;
}

export default function ModelSelectionStep({
  selectedTier,
  onSelectTier,
  itemLimit,
}: ModelSelectionStepProps) {
  const theme = useTheme();

  const modelOptions = [
    {
      tier: 'basic' as const,
      name: 'Basic',
      estimatedTime: '~45 seconds',
      description: 'Fast and efficient',
      icon: 'flash' as const,
      color: '#10B981',
      features: ['Quick generation', 'Good quality cards', 'Perfect for simple topics'],
    },
    {
      tier: 'advanced' as const,
      name: 'Advanced',
      estimatedTime: '~3 minutes',
      description: 'Premium quality with deeper insights',
      icon: 'sparkles' as const,
      color: '#8B5CF6',
      features: ['Highest quality', 'Complex topics', 'Better context understanding'],
    },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Select Model</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          Choose the AI model for your deck generation
        </Text>
      </View>

      <View style={styles.options}>
        {modelOptions.map((option) => {
          const isSelected = selectedTier === option.tier;

          return (
            <Pressable
              key={option.tier}
              style={[
                styles.modelCard,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: isSelected ? option.color : theme.colors.border,
                },
                isSelected && styles.modelCardSelected,
              ]}
              onPress={() => onSelectTier(option.tier)}
            >
              <View style={styles.modelCardHeader}>
                <View style={[styles.modelIcon, { backgroundColor: `${option.color}20` }]}>
                  <Ionicons name={option.icon} size={32} color={option.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modelName, { color: theme.colors.textPrimary }]}>
                    {option.name}
                  </Text>
                </View>
                {isSelected && <Ionicons name="checkmark-circle" size={28} color={option.color} />}
              </View>

              <View style={[styles.timeEstimate, { backgroundColor: theme.colors.surface2 }]}>
                <Ionicons name="time-outline" size={18} color={theme.colors.textSecondary} />
                <Text style={[styles.timeText, { color: theme.colors.textSecondary }]}>
                  {option.estimatedTime} for ~{itemLimit} cards
                </Text>
              </View>

              <Text style={[styles.modelDescription, { color: theme.colors.textSecondary }]}>
                {option.description}
              </Text>

              <View style={styles.featuresList}>
                {option.features.map((feature, index) => (
                  <View key={index} style={styles.featureItem}>
                    <Ionicons name="checkmark" size={16} color={option.color} />
                    <Text style={[styles.featureText, { color: theme.colors.textMed }]}>
                      {feature}
                    </Text>
                  </View>
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: s.lg,
  },
  header: {
    marginBottom: s.xl,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: s.xs,
  },
  subtitle: {
    fontSize: 16,
  },
  options: {
    gap: s.lg,
  },
  modelCard: {
    borderRadius: r.xl,
    borderWidth: 2,
    padding: s.lg,
    gap: s.md,
  },
  modelCardSelected: {
    borderWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  modelCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.md,
    marginBottom: s.md,
  },
  modelIcon: {
    width: 64,
    height: 64,
    borderRadius: r.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modelName: {
    fontSize: 20,
    fontWeight: '700',
  },
  timeEstimate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.sm,
    padding: s.sm,
    paddingHorizontal: s.md,
    borderRadius: r.md,
  },
  timeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modelDescription: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: s.sm,
    marginBottom: s.xs,
  },
  featuresList: {
    gap: s.sm,
    marginTop: s.md,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.sm,
  },
  featureText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
