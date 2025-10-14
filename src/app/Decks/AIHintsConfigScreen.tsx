import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/theme';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';
import { db } from '../../services/anki/InMemoryDb';
import { AiHintsService } from '../../services/ai/AiHintsService';
import { cardHintsService, CardHintsService } from '../../services/anki/CardHintsService';
import { deckMetadataService } from '../../services/anki/DeckMetadataService';
import { HintsInputItem } from '../../services/ai/types';

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
  const { deckId, deckName, totalCards } = route.params;

  const [scope, setScope] = useState<'all' | 'due' | 'new'>('all');
  const [limit, setLimit] = useState<number | null>(null);

  const handleGenerate = async () => {
    try {
      // Get cards based on scope
      let cards = db.getCardsByDeck(deckId);
      const col = db.getCol();

      if (scope === 'due') {
        const now = Math.floor(Date.now() / 1000);
        cards = cards.filter(c => {
          if (c.type === 1 || c.type === 3) {
            return c.due <= now;
          } else {
            const daysSinceCreation = Math.floor((now - col.crt) / 86400);
            return c.due <= daysSinceCreation;
          }
        });
      } else if (scope === 'new') {
        cards = cards.filter(c => c.type === 0);
      }

      // Apply limit if set
      if (limit && cards.length > limit) {
        cards = cards.slice(0, limit);
      }

      if (cards.length === 0) {
        Alert.alert('No Cards', 'No cards match the selected scope.');
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

      // Log estimated cost for debugging
      const estimatedCost = AiHintsService.estimateCost(items.length);
      console.log(`[AIHintsConfig] Estimated cost for ${items.length} cards: $${estimatedCost.toFixed(4)}`);

      // Navigate to generating screen with hints mode
      navigation.navigate('AIHintsGenerating', {
        deckId,
        deckName,
        items,
      });
    } catch (error) {
      console.error('[AIHintsConfig] Error preparing generation:', error);
      Alert.alert('Error', 'Failed to prepare hints generation');
    }
  };

  // Calculate card counts for each scope
  const allCards = db.getCardsByDeck(deckId);
  const col = db.getCol();
  const now = Math.floor(Date.now() / 1000);
  const dueCards = allCards.filter(c => {
    if (c.type === 1 || c.type === 3) {
      return c.due <= now;
    } else {
      const daysSinceCreation = Math.floor((now - col.crt) / 86400);
      return c.due <= daysSinceCreation;
    }
  });
  const newCards = allCards.filter(c => c.type === 0);

  const selectedCount = scope === 'all' ? allCards.length : scope === 'due' ? dueCards.length : newCards.length;
  const finalCount = limit && selectedCount > limit ? limit : selectedCount;
  const estimatedCost = AiHintsService.estimateCost(finalCount);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={[styles.backButton, { color: theme.colors.accent }]}>← Back</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>Enable AI Hints</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={[styles.infoCard, { backgroundColor: theme.colors.surface }]}>
          <Ionicons name="information-circle" size={24} color={theme.colors.accent} />
          <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
            AI Hints provides two types of study aids:{'\n\n'}
            <Text style={{ fontWeight: '600' }}>• Hint</Text> - A subtle clue shown before revealing the answer{'\n'}
            <Text style={{ fontWeight: '600' }}>• Tip</Text> - A memory aid with mnemonics shown after the answer
          </Text>
        </View>

        <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Select Cards</Text>

        {/* Scope Selection */}
        <View style={styles.optionsContainer}>
          <Pressable
            style={[
              styles.optionButton,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              scope === 'all' && { borderColor: theme.colors.accent, borderWidth: 2 },
            ]}
            onPress={() => setScope('all')}
          >
            <View style={styles.optionContent}>
              <Ionicons 
                name={scope === 'all' ? 'radio-button-on' : 'radio-button-off'} 
                size={24} 
                color={scope === 'all' ? theme.colors.accent : theme.colors.textSecondary} 
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionLabel, { color: theme.colors.textPrimary }]}>All Cards</Text>
                <Text style={[styles.optionCount, { color: theme.colors.textSecondary }]}>
                  {allCards.length} cards
                </Text>
              </View>
            </View>
          </Pressable>

          <Pressable
            style={[
              styles.optionButton,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              scope === 'due' && { borderColor: theme.colors.accent, borderWidth: 2 },
            ]}
            onPress={() => setScope('due')}
          >
            <View style={styles.optionContent}>
              <Ionicons 
                name={scope === 'due' ? 'radio-button-on' : 'radio-button-off'} 
                size={24} 
                color={scope === 'due' ? theme.colors.accent : theme.colors.textSecondary} 
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionLabel, { color: theme.colors.textPrimary }]}>Due Cards Only</Text>
                <Text style={[styles.optionCount, { color: theme.colors.textSecondary }]}>
                  {dueCards.length} cards
                </Text>
              </View>
            </View>
          </Pressable>

          <Pressable
            style={[
              styles.optionButton,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              scope === 'new' && { borderColor: theme.colors.accent, borderWidth: 2 },
            ]}
            onPress={() => setScope('new')}
          >
            <View style={styles.optionContent}>
              <Ionicons 
                name={scope === 'new' ? 'radio-button-on' : 'radio-button-off'} 
                size={24} 
                color={scope === 'new' ? theme.colors.accent : theme.colors.textSecondary} 
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionLabel, { color: theme.colors.textPrimary }]}>New Cards Only</Text>
                <Text style={[styles.optionCount, { color: theme.colors.textSecondary }]}>
                  {newCards.length} cards
                </Text>
              </View>
            </View>
          </Pressable>
        </View>

        {/* Limit Option */}
        <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Limit (Optional)</Text>
        <View style={styles.limitContainer}>
          {[50, 100, 200, null].map((limitOption) => (
            <Pressable
              key={limitOption || 'all'}
              style={[
                styles.limitButton,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                limit === limitOption && { borderColor: theme.colors.accent, borderWidth: 2 },
              ]}
              onPress={() => setLimit(limitOption)}
            >
              <Text style={[
                styles.limitText, 
                { color: limit === limitOption ? theme.colors.accent : theme.colors.textPrimary }
              ]}>
                {limitOption || 'No Limit'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Summary */}
        <View style={[styles.summaryCard, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Cards to process:</Text>
            <Text style={[styles.summaryValue, { color: theme.colors.textPrimary }]}>{finalCount}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Estimated time:</Text>
            <Text style={[styles.summaryValue, { color: theme.colors.textPrimary }]}>
              ~{Math.ceil(finalCount / 50)}min
            </Text>
          </View>
        </View>

        {/* Privacy Notice */}
        <View style={[styles.privacyNotice, { backgroundColor: 'rgba(139, 92, 246, 0.1)' }]}>
          <Ionicons name="lock-closed-outline" size={16} color="#8B5CF6" />
          <Text style={[styles.privacyText, { color: theme.colors.textSecondary }]}>
            Card text will be sent to OpenAI to generate hints
          </Text>
        </View>
      </ScrollView>

      {/* Generate Button */}
      <View style={[styles.footer, { backgroundColor: theme.colors.bg }]}>
        <Pressable
          style={[styles.generateButton, { backgroundColor: theme.colors.accent }]}
          onPress={handleGenerate}
          disabled={finalCount === 0}
        >
          <Ionicons name="sparkles" size={20} color="#000" style={{ marginRight: s.sm }} />
          <Text style={styles.generateButtonText}>Generate Hints for {finalCount} Cards</Text>
        </Pressable>
      </View>
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
    paddingBottom: s.xl * 2,
  },
  infoCard: {
    flexDirection: 'row',
    padding: s.lg,
    borderRadius: r.md,
    gap: s.md,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: s.md,
  },
  optionsContainer: {
    gap: s.md,
  },
  optionButton: {
    padding: s.lg,
    borderRadius: r.md,
    borderWidth: 1,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.md,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  optionCount: {
    fontSize: 14,
    marginTop: 2,
  },
  limitContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: s.md,
  },
  limitButton: {
    paddingHorizontal: s.lg,
    paddingVertical: s.md,
    borderRadius: r.md,
    borderWidth: 1,
    minWidth: 80,
    alignItems: 'center',
  },
  limitText: {
    fontSize: 14,
    fontWeight: '600',
  },
  summaryCard: {
    padding: s.lg,
    borderRadius: r.md,
    gap: s.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 15,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  privacyNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.sm,
    padding: s.md,
    borderRadius: r.md,
  },
  privacyText: {
    flex: 1,
    fontSize: 13,
  },
  footer: {
    padding: s.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  generateButton: {
    padding: s.lg,
    borderRadius: r.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
});
