import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/theme';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';
import { db } from '../../services/anki/InMemoryDb';
import { cardHintsService } from '../../services/anki/CardHintsService';
import { deckMetadataService } from '../../services/anki/DeckMetadataService';
import { HintsInputItem } from '../../services/ai/types';
import { NetworkService } from '../../services/network/NetworkService';
import { logger } from '../../utils/logger';

interface ManageHintsScreenProps {
  route: {
    params: {
      deckId: string;
      deckName: string;
      totalCards: number;
    };
  };
  navigation: any;
}

export default function ManageHintsScreen({ route, navigation }: ManageHintsScreenProps) {
  const theme = useTheme();
  const { deckId, deckName, totalCards } = route.params;
  
  const [loading, setLoading] = useState(true);
  const [cardsWithHints, setCardsWithHints] = useState(0);

  useEffect(() => {
    loadHintsMetadata();
  }, [deckId]);

  const loadHintsMetadata = async () => {
    try {
      setLoading(true);
      const cards = db.getCardsByDeck(deckId);
      const cardIds = cards.map(c => String(c.id));
      const hints = await cardHintsService.getMany(cardIds);
      
      // Count cards that have hints (getMany returns a Map)
      const count = hints.size;
      setCardsWithHints(count);
    } catch (error) {
      logger.error('[ManageHints] Error loading metadata:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = () => {
    Alert.alert(
      'Regenerate Hints?',
      `This will replace existing hints for all ${totalCards} cards. This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Regenerate',
          style: 'destructive',
          onPress: async () => {
            try {
              // Check network connectivity
              const isOnline = await NetworkService.isOnline();
              if (!isOnline) {
                Alert.alert(
                  'No Internet Connection',
                  'AI hints generation requires an internet connection. Please check your network and try again.'
                );
                return;
              }

              // Get all cards from the deck
              const cards = db.getCardsByDeck(deckId);

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
                
                // Split note fields
                const SEPARATOR = '\x1f';
                const fields = note.flds.split(SEPARATOR);
                
                // Determine if basic or cloze
                const isCloze = model.type === 1;
                
                if (isCloze) {
                  const clozeText = fields[0] || '';
                  const extraInfo = fields[1] || '';
                  
                  return {
                    id: String(card.id),
                    model: 'cloze' as const,
                    cloze: clozeText,
                    front: clozeText,
                    back: extraInfo || clozeText,
                  };
                } else {
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

              // Navigate to model selection screen for regeneration
              navigation.navigate('AIHintsModelSelection', {
                deckId,
                deckName,
                totalCards: items.length,
                items,
              });
            } catch (error) {
              logger.error('[ManageHints] Error preparing regeneration:', error);
              Alert.alert('Error', 'Failed to prepare hints regeneration');
            }
          },
        },
      ]
    );
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete All Hints?',
      'This will permanently delete all hints for this deck. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete all hints for this deck
              await cardHintsService.invalidateForDeck(deckId);
              
              // Disable hints for this deck
              await deckMetadataService.setAiHintsEnabled(deckId, false);
              
              navigation.goBack();
            } catch (error) {
              logger.error('[ManageHints] Error deleting hints:', error);
              Alert.alert('Error', 'Failed to delete hints');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={[styles.backButton, { color: theme.colors.accent }]}>← Back</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>Manage Hints</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.accent} />
            <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
              Loading hints data...
            </Text>
          </View>
        ) : (
          <>
            {/* Status Card */}
            <View style={[styles.statusCard, { backgroundColor: theme.colors.surface }]}>
              <View style={[styles.statusIcon, { backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}>
                <Ionicons name="bulb" size={48} color="#8B5CF6" />
              </View>
              <Text style={[styles.statusTitle, { color: theme.colors.textPrimary }]}>
                AI Hints Active
              </Text>
              <Text style={[styles.statusSubtitle, { color: theme.colors.textSecondary }]}>
                Your deck is powered by smart hints
              </Text>
            </View>

            {/* Stats */}
            <View style={[styles.statsSection, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, { color: '#8B5CF6' }]}>
                  {cardsWithHints}
                </Text>
                <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                  Cards with hints
                </Text>
              </View>
            </View>

            {/* Actions */}
            <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
              <Pressable style={styles.actionRow} onPress={handleRegenerate}>
                <Ionicons name="refresh-outline" size={22} color={theme.colors.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.actionLabel, { color: theme.colors.textPrimary }]}>
                    Regenerate Hints
                  </Text>
                  <Text style={[styles.actionDesc, { color: theme.colors.textSecondary }]}>
                    Create new hints for all cards
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color={theme.colors.textSecondary} />
              </Pressable>

              <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

              <Pressable style={styles.actionRow} onPress={handleDelete}>
                <Ionicons name="trash-outline" size={22} color={theme.colors.danger} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.actionLabel, { color: theme.colors.danger }]}>
                    Delete Hints
                  </Text>
                  <Text style={[styles.actionDesc, { color: theme.colors.textSecondary }]}>
                    Remove all hints from this deck
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color={theme.colors.textSecondary} />
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
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
    padding: s.lg,
    gap: s.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: s['2xl'],
  },
  loadingText: {
    fontSize: 16,
    marginTop: s.md,
  },
  statusCard: {
    padding: s.xl,
    borderRadius: r.lg,
    alignItems: 'center',
  },
  statusIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: s.md,
  },
  statusTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: s.xs,
  },
  statusSubtitle: {
    fontSize: 15,
    textAlign: 'center',
  },
  statsSection: {
    padding: s.xl,
    borderRadius: r.lg,
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 40,
    fontWeight: '900',
    marginBottom: s.xs,
  },
  statLabel: {
    fontSize: 14,
    textAlign: 'center',
  },
  section: {
    borderRadius: r.lg,
    overflow: 'hidden',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: s.lg,
    gap: s.md,
  },
  actionLabel: {
    fontSize: 17,
    fontWeight: '600',
  },
  actionDesc: {
    fontSize: 13,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginLeft: s.lg + 22 + s.md,
  },
});
