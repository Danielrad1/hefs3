import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../design/theme';
import { usePremium } from '../../context/PremiumContext';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';
import PremiumUpsellModal from '../../components/premium/PremiumUpsellModal';
import { logger } from '../../utils/logger';

type ModelTier = 'basic' | 'advanced';

interface ModelOption {
  tier: ModelTier;
  name: string;
  model: string;
  estimatedTime: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  features: string[];
}

interface AIDeckModelSelectionScreenProps {
  route: {
    params: {
      prompt: string;
      notesText: string;
      noteModel: string;
      itemLimit: number;
    };
  };
  navigation: any;
}

export default function AIDeckModelSelectionScreen({ route, navigation }: AIDeckModelSelectionScreenProps) {
  const theme = useTheme();
  const { isPremiumEffective, usage, subscribe, fetchUsage } = usePremium();
  const { prompt, notesText, noteModel, itemLimit } = route.params;
  const [selectedTier, setSelectedTier] = useState<ModelTier>('basic');
  const [showPremiumModal, setShowPremiumModal] = useState(false);

  // Refresh usage data when screen becomes focused
  useFocusEffect(
    useCallback(() => {
      fetchUsage();
    }, [fetchUsage])
  );

  const modelOptions: ModelOption[] = [
    {
      tier: 'basic',
      name: 'Basic',
      model: '',
      estimatedTime: '~45 seconds',
      description: 'Fast and efficient',
      icon: 'flash',
      color: '#10B981',
      features: [
        'Quick generation',
        'Good quality cards',
        'Perfect for simple topics',
      ],
    },
    {
      tier: 'advanced',
      name: 'Advanced',
      model: '',
      estimatedTime: '~3 minutes',
      description: 'Premium quality with deeper insights',
      icon: 'sparkles',
      color: '#8B5CF6',
      features: [
        'Highest quality',
        'Complex topics',
        'Rich explanations',
        'Better context understanding',
      ],
    },
  ];

  const getUsageInfo = (tier: ModelTier) => {
    if (isPremiumEffective) {
      return { used: 0, limit: 999999, canUse: true };
    }

    // Default limits for free users if usage data isn't loaded yet
    if (!usage) {
      const defaultLimits = tier === 'basic' ? { used: 0, limit: 3 } : { used: 0, limit: 1 };
      return { ...defaultLimits, canUse: true };
    }

    if (tier === 'basic') {
      return {
        used: usage.basicDeckGenerations || 0,
        limit: usage.limits.basicDecks || 3,
        canUse: (usage.basicDeckGenerations || 0) < (usage.limits.basicDecks || 3),
      };
    } else {
      return {
        used: usage.advancedDeckGenerations || 0,
        limit: usage.limits.advancedDecks || 1,
        canUse: (usage.advancedDeckGenerations || 0) < (usage.limits.advancedDecks || 1),
      };
    }
  };

  const handleSelectTier = (tier: ModelTier) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedTier(tier);
  };

  const handleContinue = () => {
    const usageInfo = getUsageInfo(selectedTier);

    // Check if user has quota
    if (!usageInfo.canUse && !isPremiumEffective) {
      Alert.alert(
        'Limit Reached',
        `You've used all ${usageInfo.limit} ${selectedTier} deck generations this month. Upgrade to Premium for unlimited access.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade', onPress: () => setShowPremiumModal(true) },
        ]
      );
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    logger.info('[AIDeckModelSelection] Selected model tier:', selectedTier);

    // Navigate to generating screen with model tier
    navigation.navigate('AIGenerating', {
      prompt,
      notesText,
      noteModel,
      itemLimit,
      modelTier: selectedTier,
    });
  };

  const handleSubscribePress = async () => {
    try {
      await subscribe();
      setShowPremiumModal(false);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to start subscription');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={[styles.backButton, { color: theme.colors.accent }]}>← Back</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>Select Model</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Model Options */}
        <View style={styles.optionsSection}>
          {modelOptions.map((option) => {
            const isSelected = selectedTier === option.tier;
            const usageInfo = getUsageInfo(option.tier);

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
                onPress={() => handleSelectTier(option.tier)}
              >
                {/* Header */}
                <View style={styles.modelCardHeader}>
                  <View style={[styles.modelIcon, { backgroundColor: `${option.color}20` }]}>
                    <Ionicons name={option.icon} size={32} color={option.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modelName, { color: theme.colors.textPrimary }]}>
                      {option.name}
                    </Text>
                  </View>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={28} color={option.color} />
                  )}
                </View>

                {/* Time Estimate */}
                <View style={[styles.timeEstimate, { backgroundColor: theme.colors.surface2 }]}>
                  <Ionicons name="time-outline" size={18} color={theme.colors.textSecondary} />
                  <Text style={[styles.timeText, { color: theme.colors.textSecondary }]}>
                    {option.estimatedTime} for ~{itemLimit} cards
                  </Text>
                </View>

                {/* Usage Badge */}
                {!isPremiumEffective && (
                  <View
                    style={[
                      styles.usageBadge,
                      {
                        backgroundColor: usageInfo.canUse
                          ? `${option.color}15`
                          : theme.colors.danger + '15',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.usageText,
                        {
                          color: usageInfo.canUse ? option.color : theme.colors.danger,
                        },
                      ]}
                    >
                      {usageInfo.used}/{usageInfo.limit} used this month
                      {!usageInfo.canUse && ' - Limit reached'}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Premium Upgrade Banner */}
        {!isPremiumEffective && (
          <Pressable
            style={[styles.upgradeBanner, { backgroundColor: '#8B5CF6' }]}
            onPress={() => setShowPremiumModal(true)}
          >
            <Ionicons name="star" size={24} color="#FFF" />
            <View style={{ flex: 1 }}>
              <Text style={styles.upgradeTitle}>Upgrade to Premium</Text>
              <Text style={styles.upgradeSubtitle}>Unlimited deck generations with both models</Text>
            </View>
            <Ionicons name="arrow-forward" size={20} color="#FFF" />
          </Pressable>
        )}
      </ScrollView>

      {/* Continue Button */}
      <View style={[styles.footer, { backgroundColor: theme.colors.bg }]}>
        <Pressable
          style={[
            styles.continueButton,
            {
              backgroundColor: getUsageInfo(selectedTier).canUse || isPremiumEffective
                ? theme.colors.accent
                : theme.colors.surface2,
            },
          ]}
          onPress={handleContinue}
          disabled={!getUsageInfo(selectedTier).canUse && !isPremiumEffective}
        >
          <Text
            style={[
              styles.continueButtonText,
              {
                color: getUsageInfo(selectedTier).canUse || isPremiumEffective
                  ? '#000'
                  : theme.colors.textLow,
              },
            ]}
          >
            Continue with {selectedTier === 'basic' ? 'Basic' : 'Advanced'} Model
          </Text>
          <Ionicons
            name="arrow-forward"
            size={20}
            color={getUsageInfo(selectedTier).canUse || isPremiumEffective ? '#000' : theme.colors.textLow}
          />
        </Pressable>
      </View>

      <PremiumUpsellModal
        visible={showPremiumModal}
        onClose={() => setShowPremiumModal(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: s.lg,
    paddingVertical: s.md,
  },
  backButton: { fontSize: 17, fontWeight: '600' },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  content: { flex: 1 },
  contentContainer: { padding: s.lg, paddingBottom: s.xl * 2 },
  optionsSection: { gap: s.lg, marginBottom: s.xl },
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
  modelName: { fontSize: 20, fontWeight: '700' },
  timeEstimate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.sm,
    padding: s.sm,
    paddingHorizontal: s.md,
    borderRadius: r.md,
  },
  timeText: { fontSize: 14, fontWeight: '600' },
  usageBadge: {
    padding: s.sm,
    paddingHorizontal: s.md,
    borderRadius: r.md,
    marginTop: s.md,
  },
  usageText: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  upgradeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.md,
    padding: s.lg,
    borderRadius: r.lg,
  },
  upgradeTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFF',
  },
  upgradeSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  footer: {
    padding: s.lg,
    paddingBottom: s.xl,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: s.lg,
    borderRadius: r.lg,
    gap: s.sm,
  },
  continueButtonText: { fontSize: 17, fontWeight: '700' },
});
