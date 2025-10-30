import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/theme';
import { usePremium } from '../../context/PremiumContext';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';
import { db } from '../../services/anki/InMemoryDb';
import { AiHintsService } from '../../services/ai/AiHintsService';
import { cardHintsService, CardHintsService } from '../../services/anki/CardHintsService';
import { deckMetadataService } from '../../services/anki/DeckMetadataService';
import { HintsInputItem } from '../../services/ai/types';
import { NetworkService } from '../../services/network/NetworkService';
import PremiumUpsellModal from '../../components/premium/PremiumUpsellModal';
import { logger } from '../../utils/logger';

interface AIHintsConfigScreenProps {
  route: {
    params: {
      deckId: string;
      deckName: string;
      totalCards: number;
    };
  };
  navigation: any;
}

export default function AIHintsConfigScreen({ route, navigation }: AIHintsConfigScreenProps) {
  const theme = useTheme();
  const { isPremiumEffective, usage, subscribe, incrementUsage, fetchUsage } = usePremium();
  const { deckId, deckName, totalCards } = route.params;
  const [showPremiumModal, setShowPremiumModal] = useState(false);

  // Refresh usage data when screen becomes focused
  useFocusEffect(
    useCallback(() => {
      fetchUsage();
    }, [fetchUsage])
  );

  const handleGenerate = async () => {
    try {
      // Check network connectivity
      const isOnline = await NetworkService.isOnline();
      if (!isOnline) {
        Alert.alert(
          'No Internet Connection',
          'AI hints generation requires an internet connection. Please check your network and try again.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Note: Quota checking happens in the model selection screen
      // Users can proceed to select their preferred model tier

      // Get all cards from the deck
      let cards = db.getCardsByDeck(deckId);

      if (cards.length === 0) {
        Alert.alert('No Cards', 'This deck has no cards.');
        return;
      }

      // Limit free users to 250 cards for hint generation
      if (!isPremiumEffective && cards.length > 250) {
        Alert.alert(
          'Upgrade to Premium',
          `Free users can generate hints for up to 250 cards. This deck has ${cards.length} cards.\n\nUpgrade to Premium for unlimited hint generation.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Upgrade', onPress: () => setShowPremiumModal(true) },
          ]
        );
        return;
      }

      // Enforce backend's 500-card limit for all users
      const MAX_HINTS_CARDS = 500;
      if (cards.length > MAX_HINTS_CARDS) {
        Alert.alert(
          'Deck Too Large',
          `AI hints can process up to ${MAX_HINTS_CARDS} cards at a time. This deck has ${cards.length} cards.\n\nWould you like to generate hints for the first ${MAX_HINTS_CARDS} cards?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: `Process ${MAX_HINTS_CARDS}`, 
              onPress: () => {
                // Continue with capped cards
                cards = cards.slice(0, MAX_HINTS_CARDS);
                continueGeneration(cards);
              } 
            },
          ]
        );
        return;
      }

      continueGeneration(cards);
    } catch (error) {
      logger.error('[AIHintsConfig] Error preparing generation:', error);
      
      // Check if quota exceeded
      const errorMessage = error instanceof Error ? error.message : '';
      if (errorMessage.includes('limit reached') || errorMessage.includes('quota')) {
        setShowPremiumModal(true);
      } else {
        Alert.alert('Error', 'Failed to prepare hints generation');
      }
    }
  };

  const continueGeneration = (cards: any[]) => {

    try {
      // Prepare hints input items
      const items: HintsInputItem[] = cards.map(card => {
        const note = db.getNote(card.nid);
        if (!note) {
          throw new Error(`Note not found for card ${card.id}`);
        }
        
        const model = db.getModel(note.mid);
        if (!model) {
          throw new Error(`Model not found for note ${note.id}`);
        }
        
        // Split note fields (they're stored as a delimited string)
        const SEPARATOR = '\x1f'; // Use the actual separator instead of import
        const fields = note.flds.split(SEPARATOR);
        
        // Determine if basic or cloze
        const isCloze = model.type === 1;
        
        if (isCloze) {
          // For cloze, the first field contains the full cloze text
          const clozeText = fields[0] || '';
          const extraInfo = fields[1] || ''; // Additional context if present
          
          return {
            id: String(card.id),
            model: 'cloze' as const,
            cloze: clozeText,
            // Pass the full text as front/back for context
            front: clozeText,
            back: extraInfo || clozeText,
          };
        } else {
          // For basic, get front and back
          const front = fields[0] || '';
          const back = fields[1] || '';
          
          return {
            id: String(card.id),
            model: 'basic' as const,
            front,
            back,
          };
        }
      });

      // Navigate to model selection screen
      navigation.navigate('AIHintsModelSelection', {
        deckId,
        deckName,
        totalCards: cards.length,
        items,
      });
    } catch (error) {
      logger.error('[AIHintsConfig] Error in continueGeneration:', error);
      Alert.alert('Error', 'Failed to prepare hints generation');
    }
  };

  const handleSubscribePress = async () => {
    try {
      await subscribe();
      setShowPremiumModal(false);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to start subscription');
    }
  };

  const allCards = db.getCardsByDeck(deckId);

  const IMPACT_ICON_SIZE = 32;

  const impactHighlights = [
    {
      key: 'retention',
      title: 'Stronger retention',
      subtitle: 'Improved long-term recall',
      icon: 'trending-up' as const,
      accent: '#F472B6',
      background: 'rgba(236, 72, 153, 0.16)',
    },
    {
      key: 'mistakes',
      title: 'Fewer mistakes',
      subtitle: 'On challenging cards',
      icon: 'shield-checkmark' as const,
      accent: '#A855F7',
      background: 'rgba(139, 92, 246, 0.16)',
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={[styles.backButton, { color: theme.colors.accent }]}>← Back</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>AI Hints</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={[styles.iconContainer, { backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}>
            <Ionicons name="bulb" size={64} color="#8B5CF6" />
          </View>
          <Text style={[styles.heroTitle, { color: theme.colors.textPrimary }]}>Learn Faster with AI Hints</Text>
          <Text style={[styles.heroSubtitle, { color: theme.colors.textSecondary }]}>
            AI hints streamline your reviews and help you recall faster
          </Text>
        </View>

        {/* Impact Stats */}
        <View style={styles.impactGrid}>
          {impactHighlights.map(highlight => (
            <View key={highlight.key} style={[styles.impactCard, { backgroundColor: highlight.background }]}>
              <Ionicons
                name={highlight.icon}
                size={IMPACT_ICON_SIZE}
                color={highlight.accent}
                style={styles.impactIcon}
              />
              <Text style={[styles.impactLabel, { color: theme.colors.textPrimary }]}>{highlight.title}</Text>
              <Text style={[styles.impactDetail, { color: theme.colors.textSecondary }]}>{highlight.subtitle}</Text>
            </View>
          ))}
        </View>

        {/* What You Get */}
        <View style={[styles.valueCard, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.valueTitle, { color: theme.colors.textPrimary }]}>What You Get</Text>
          
          <View style={styles.valueItem}>
            <View style={[styles.valueBullet, { backgroundColor: '#8B5CF6' }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.valueItemTitle, { color: theme.colors.textPrimary }]}>3-Level Progressive Hints</Text>
              <Text style={[styles.valueItemDesc, { color: theme.colors.textSecondary }]}>Never get stuck. Get just enough help to recall.</Text>
            </View>
          </View>

          <View style={styles.valueItem}>
            <View style={[styles.valueBullet, { backgroundColor: '#EC4899' }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.valueItemTitle, { color: theme.colors.textPrimary }]}>Memory Techniques</Text>
              <Text style={[styles.valueItemDesc, { color: theme.colors.textSecondary }]}>Mnemonics that make facts stick.</Text>
            </View>
          </View>

          <View style={styles.valueItem}>
            <View style={[styles.valueBullet, { backgroundColor: '#10B981' }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.valueItemTitle, { color: theme.colors.textPrimary }]}>Fewer Study Sessions</Text>
              <Text style={[styles.valueItemDesc, { color: theme.colors.textSecondary }]}>Spend less time to master more material.</Text>
            </View>
          </View>
        </View>

        {/* Deck Info (time estimate removed) */}
        <View style={[styles.deckInfoCard, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.deckInfoRow}>
            <Ionicons name="layers-outline" size={20} color={theme.colors.textSecondary} />
            <Text style={[styles.deckInfoText, { color: theme.colors.textSecondary }]}>
              {allCards.length} cards
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Generate Button */}
      <View style={[styles.footer, { backgroundColor: theme.colors.bg }]}>
        {!isPremiumEffective && (
          <View style={[styles.usageBar, { backgroundColor: theme.colors.surface2 }]}>
            <Ionicons name="information-circle-outline" size={16} color={theme.colors.textMed} />
            <Text style={[styles.usageText, { color: theme.colors.textMed }]}>
              Free hints: {usage?.basicHintGenerations || 0}/{usage?.limits?.basicHints || 3} Basic • {usage?.advancedHintGenerations || 0}/{usage?.limits?.advancedHints || 1} Advanced
            </Text>
          </View>
        )}
        <Pressable
          style={[styles.generateButton, { backgroundColor: theme.colors.accent }]}
          onPress={handleGenerate}
          disabled={allCards.length === 0}
        >
          <Ionicons name="sparkles" size={24} color="#000" style={{ marginRight: s.sm }} />
          <Text style={styles.generateButtonText}>Generate AI Hints</Text>
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
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: s.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  backButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: s.xl,
    gap: s.xl,
    paddingBottom: s.xl * 3,
  },
  heroSection: {
    alignItems: 'center',
    paddingVertical: s.xl,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: s.lg,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: s.sm,
  },
  heroSubtitle: {
    fontSize: 17,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: s.xl,
  },
  impactGrid: {
    flexDirection: 'row',
    gap: s.sm,
  },
  impactCard: {
    flex: 1,
    padding: s.lg,
    paddingVertical: s.xl,
    borderRadius: r.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: s.sm,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  impactIcon: {
    marginBottom: s.xs,
  },
  impactNumber: {
    fontSize: 48,
    fontWeight: '900',
    marginBottom: s.xs,
  },
  impactLabel: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  impactDetail: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    opacity: 0.85,
  },
  valueCard: {
    padding: s.xl,
    borderRadius: r.lg,
  },
  valueTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: s.lg,
  },
  valueItem: {
    flexDirection: 'row',
    gap: s.md,
    marginBottom: s.lg,
  },
  valueBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  valueItemTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  valueItemDesc: {
    fontSize: 14,
    lineHeight: 20,
  },
  deckInfoCard: {
    padding: s.lg,
    borderRadius: r.lg,
  },
  deckInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.sm,
    justifyContent: 'center',
  },
  deckInfoText: {
    fontSize: 14,
  },
  footer: {
    padding: s.xl,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  usageBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.xs,
    padding: s.sm,
    borderRadius: r.md,
    marginBottom: s.md,
  },
  usageText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  generateButton: {
    padding: s.xl,
    borderRadius: r.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  generateButtonText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#000',
  },
  freeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.sm,
    padding: s.md,
    borderRadius: r.lg,
    borderWidth: 1,
  },
  freeBannerText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
});
