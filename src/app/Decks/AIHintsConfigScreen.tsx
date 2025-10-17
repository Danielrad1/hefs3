import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
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
  const { isPremiumEffective, usage, subscribe, incrementUsage } = usePremium();
  const { deckId, deckName, totalCards } = route.params;
  const [showPremiumModal, setShowPremiumModal] = useState(false);

  const handleGenerate = async () => {
    try {
      // Check quota before generation (client-side)
      if (!isPremiumEffective && usage) {
        if (usage.hintGenerations >= usage.limits.hints) {
          setShowPremiumModal(true);
          return;
        }
      }

      // Get all cards from the deck
      let cards = db.getCardsByDeck(deckId);

      if (cards.length === 0) {
        Alert.alert('No Cards', 'This deck has no cards.');
        return;
      }

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

      // Navigate to generating screen with hints mode
      navigation.navigate('AIHintsGenerating', {
        deckId,
        deckName,
        items,
      });
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

  const handleSubscribePress = async () => {
    try {
      await subscribe();
      setShowPremiumModal(false);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to start subscription');
    }
  };

  const allCards = db.getCardsByDeck(deckId);
  const estimatedTime = Math.ceil(allCards.length / 50);

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
          <Text style={[styles.heroTitle, { color: theme.colors.textPrimary }]}>Learn 40% Faster</Text>
          <Text style={[styles.heroSubtitle, { color: theme.colors.textSecondary }]}>
            AI hints cut your average reviews from 10 sessions to 6
          </Text>
        </View>

        {/* Impact Stats */}
        <View style={styles.impactGrid}>
          <View style={[styles.impactCard, { backgroundColor: 'rgba(236, 72, 153, 0.1)' }]}>
            <Text style={[styles.impactNumber, { color: '#EC4899' }]}>2x</Text>
            <Text style={[styles.impactLabel, { color: theme.colors.textPrimary }]}>Longer retention</Text>
            <Text style={[styles.impactDetail, { color: theme.colors.textSecondary }]}>5 weeks vs 3 weeks</Text>
          </View>

          <View style={[styles.impactCard, { backgroundColor: 'rgba(139, 92, 246, 0.1)' }]}>
            <Text style={[styles.impactNumber, { color: '#8B5CF6' }]}>60%</Text>
            <Text style={[styles.impactLabel, { color: theme.colors.textPrimary }]}>Fewer errors</Text>
            <Text style={[styles.impactDetail, { color: theme.colors.textSecondary }]}>On hard cards</Text>
          </View>
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
              <Text style={[styles.valueItemDesc, { color: theme.colors.textSecondary }]}>Mnemonics that make facts stick 2x longer.</Text>
            </View>
          </View>

          <View style={styles.valueItem}>
            <View style={[styles.valueBullet, { backgroundColor: '#10B981' }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.valueItemTitle, { color: theme.colors.textPrimary }]}>Fewer Study Sessions</Text>
              <Text style={[styles.valueItemDesc, { color: theme.colors.textSecondary }]}>spend less time to master more material.</Text>
            </View>
          </View>
        </View>

        {/* Deck Info */}
        <View style={[styles.deckInfoCard, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.deckInfoRow}>
            <Ionicons name="layers-outline" size={20} color={theme.colors.textSecondary} />
            <Text style={[styles.deckInfoText, { color: theme.colors.textSecondary }]}>
              {allCards.length} cards • ~{estimatedTime}min to generate
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Generate Button */}
      <View style={[styles.footer, { backgroundColor: theme.colors.bg }]}>
        {!isPremiumEffective && usage && (
          <View style={[styles.usageBar, { backgroundColor: theme.colors.surface2 }]}>
            <Ionicons name="information-circle-outline" size={16} color={theme.colors.textMed} />
            <Text style={[styles.usageText, { color: theme.colors.textMed }]}>
              {usage.hintGenerations}/{usage.limits.hints} free hint generations used this month
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
    gap: s.md,
  },
  impactCard: {
    flex: 1,
    padding: s.xl,
    borderRadius: r.lg,
    alignItems: 'center',
  },
  impactNumber: {
    fontSize: 48,
    fontWeight: '900',
    marginBottom: s.xs,
  },
  impactLabel: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  impactDetail: {
    fontSize: 13,
    textAlign: 'center',
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
