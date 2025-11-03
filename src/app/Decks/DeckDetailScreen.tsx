/**
 * DeckDetailScreen - Stats, actions, and entry point for a specific deck
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/theme';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';
import { db } from '../../services/anki/InMemoryDb';
import { DeckService } from '../../services/anki/DeckService';
import { CardService } from '../../services/anki/CardService';
import { PersistenceService } from '../../services/anki/PersistenceService';
import { useScheduler } from '../../context/SchedulerProvider';
import { CardQueue } from '../../services/anki/schema';
import { isDue } from '../../services/anki/time';
import { TodayCountsService } from '../../services/anki/TodayCountsService';
import TextInputModal from '../../components/TextInputModal';
import { deckMetadataService } from '../../services/anki/DeckMetadataService';
import { cardHintsService } from '../../services/anki/CardHintsService';

interface DeckDetailScreenProps {
  route: {
    params: {
      deckId: string;
    };
  };
  navigation: any;
}

export default function DeckDetailScreen({ route, navigation }: DeckDetailScreenProps) {
  const theme = useTheme();
  const { reload, setDeck } = useScheduler();
  const { deckId } = route.params;
  
  const [deckService] = useState(() => new DeckService(db));
  const [cardService] = useState(() => new CardService(db));
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [nextDueSeconds, setNextDueSeconds] = useState<number | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [aiHintsEnabled, setAiHintsEnabled] = useState(false);

  const deck = db.getDeck(deckId);
  const cards = db.getCardsByDeck(deckId);
  const col = db.getCol();

  // Load AI hints settings and refresh stats on focus
  useFocusEffect(
    React.useCallback(() => {
      deckMetadataService.getAiHintsSettings(deckId).then((settings) => {
        setAiHintsEnabled(settings.enabled);
      });
      // Force refresh of stats when returning from study
      setRefreshTrigger(prev => prev + 1);
    }, [deckId])
  );
  
  // Calculate stats using proper isDue logic
  const newCards = cards.filter((c) => c.type === 0);
  const learningCards = cards.filter((c) => c.type === 1 || c.type === 3);
  const reviewCards = cards.filter((c) => c.type === 2);
  const suspendedCards = cards.filter((c) => c.queue === CardQueue.Suspended);
  
  // Use TodayCountsService for accurate due count with daily limits
  // Recalculate when refreshTrigger changes
  const todayCountsService = React.useMemo(() => new TodayCountsService(db), [refreshTrigger]);
  const deckCounts = React.useMemo(() => todayCountsService.getDeckTodayCounts(deckId), [deckId, refreshTrigger]);
  const dueTodayCount = deckCounts.dueTodayTotal;
  
  // Use proper isDue function to check if cards are actually available
  const actuallyDueCards = cards.filter((c) => isDue(c.due, c.type, col));
  
  // Calculate studied vs not studied
  const studiedCards = reviewCards.length; // Cards that have been reviewed
  const notStudiedCards = newCards.length; // Cards never seen
  const inProgressCards = learningCards.length; // Currently learning
  
  // Calculate next card due time for THIS deck
  useEffect(() => {
    const now = Math.floor(Date.now() / 1000);
    const col = db.getCol();
    
    // Find ALL cards that are not yet due (including review cards scheduled for future days)
    const notYetDueCards = cards
      .filter(c => c.queue !== CardQueue.Suspended) // Exclude suspended
      .filter(c => !isDue(c.due, c.type, col)) // Not due yet
      .map(c => ({ due: c.due, type: c.type, id: c.id }));
    
    if (notYetDueCards.length > 0) {
      // Find the next card that will become due
      const nextDueTimes = notYetDueCards
        .map(({ due, type }) => {
          // For learning cards (type 1, 3), due is a timestamp
          if (type === 1 || type === 3) {
            return due; // Already in seconds
          }
          // For new/review cards (type 0, 2), due is days since collection creation
          // Convert to timestamp: collection creation + (due * 86400)
          else {
            const daysTimestamp = col.crt + (due * 86400);
            return daysTimestamp;
          }
        })
        .filter(dueTime => dueTime > now)
        .sort((a, b) => a - b);
      
      if (nextDueTimes.length > 0) {
        const secondsUntilDue = nextDueTimes[0] - now;
        setNextDueSeconds(secondsUntilDue);
      } else {
        setNextDueSeconds(null);
      }
    } else {
      // All cards are either due now or there are no cards
      if (actuallyDueCards.length > 0) {
        setNextDueSeconds(0);
      } else {
        setNextDueSeconds(null);
      }
    }
  }, [cards, actuallyDueCards.length, refreshTrigger]);
  
  // Timer display - updates every second
  useEffect(() => {
    if (nextDueSeconds === 0) {
      setTimeRemaining('All cards available now!');
    } else if (nextDueSeconds && nextDueSeconds > 0) {
      // Store the target time
      const targetTime = Math.floor(Date.now() / 1000) + nextDueSeconds;
      
      const updateTimer = () => {
        const now = Math.floor(Date.now() / 1000);
        const remaining = targetTime - now;
        
        if (remaining <= 0) {
          setTimeRemaining('All cards available now!');
          setRefreshTrigger(prev => prev + 1); // Trigger recalculation
          reload(); // Refresh scheduler
        } else {
          // Format time based on duration - only show hours and minutes
          const hours = Math.floor(remaining / 3600);
          const minutes = Math.floor((remaining % 3600) / 60);
          
          if (hours > 0) {
            setTimeRemaining(`Next card in ${hours}h ${minutes}m`);
          } else if (minutes > 0) {
            setTimeRemaining(`Next card in ${minutes}m`);
          } else {
            setTimeRemaining('Next card in <1m');
          }
        }
      };
      
      updateTimer(); // Initial update
      // Update every minute instead of every second
      const interval = setInterval(updateTimer, 60000);
      return () => clearInterval(interval);
    } else {
      setTimeRemaining('No cards due today');
    }
  }, [nextDueSeconds, reload]);

  const handleStudy = () => {
    if (actuallyDueCards.length === 0) {
      Alert.alert('No Cards Due', 'This deck has no cards to study right now.');
      return;
    }
    // Set the active deck in scheduler
    setDeck(deckId);
    // Navigate to Study tab in bottom navigation
    const parent = navigation.getParent();
    if (parent) {
      parent.navigate('Study');
    }
  };

  const handleBrowseCards = () => {
    navigation.navigate('DeckBrowser', { deckId });
  };

  const handleEnableAiHints = () => {
    if (!deck) return;
    
    // If hints are already enabled, go to management screen
    // Otherwise, go to configuration screen
    if (aiHintsEnabled) {
      navigation.navigate('ManageHints', {
        deckId,
        deckName: deck.name,
        totalCards: cards.length,
      });
    } else {
      navigation.navigate('AIHintsConfig', {
        deckId,
        deckName: deck.name,
        totalCards: cards.length,
      });
    }
  };

  const handleRenameDeck = () => {
    if (!deck) return;
    setRenameModalVisible(true);
  };

  const handleRenameConfirm = async (newName: string) => {
    if (!newName.trim()) {
      setRenameModalVisible(false);
      return;
    }

    try {
      deckService.renameDeck(deckId, newName.trim());
      await PersistenceService.save(db);
      reload();
      setRenameModalVisible(false);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to rename deck');
      setRenameModalVisible(false);
    }
  };

  const handleSuspendAll = async () => {
    const unsuspendedCards = cards.filter(c => c.queue !== CardQueue.Suspended);
    
    if (unsuspendedCards.length === 0) {
      Alert.alert('No Cards', 'All cards are already suspended');
      return;
    }
    
    Alert.alert(
      'Suspend All Cards',
      `Suspend ${unsuspendedCards.length} cards in this deck?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Suspend',
          onPress: async () => {
            try {
              cardService.suspend(unsuspendedCards.map((c) => c.id));
              await PersistenceService.save(db);
              reload();
              Alert.alert('Success', `Suspended ${unsuspendedCards.length} cards`);
            } catch (error) {
              Alert.alert('Error', 'Failed to suspend cards');
            }
          },
        },
      ]
    );
  };

  const handleUnsuspendAll = async () => {
    if (suspendedCards.length === 0) {
      Alert.alert('No Cards', 'No suspended cards in this deck');
      return;
    }
    
    Alert.alert(
      'Unsuspend All Cards',
      `Unsuspend ${suspendedCards.length} cards in this deck?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unsuspend',
          onPress: async () => {
            try {
              cardService.unsuspend(suspendedCards.map((c) => c.id));
              await PersistenceService.save(db);
              reload();
              Alert.alert('Success', `Unsuspended ${suspendedCards.length} cards`);
            } catch (error) {
              Alert.alert('Error', 'Failed to unsuspend cards');
            }
          },
        },
      ]
    );
  };

  const handleDeleteDeck = () => {
    if (!deck) return;
    
    Alert.alert(
      'Delete Deck',
      `This will permanently delete "${deck.name}" and all ${cards.length} cards. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              await deckService.deleteDeck(deckId, { deleteCards: true });
              await PersistenceService.save(db);
              reload();
              navigation.goBack();
            } catch (error) {
              Alert.alert('Error', error instanceof Error ? error.message : 'Failed to delete deck');
            }
          },
        },
      ]
    );
  };

  if (!deck) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]}>
        <Text style={[styles.errorText, { color: theme.colors.danger }]}>
          Deck not found
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={[styles.backButton, { color: theme.colors.accent }]}>← Back</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]} numberOfLines={1}>
          {deck.name.split('::').pop()}
        </Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Stats Cards */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: theme.colors.surface2 }]}>
            <Text style={[styles.statNumber, { color: theme.colors.textHigh }]}>{dueTodayCount}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textMed }]}>DUE TODAY</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.colors.surface2 }]}>
            <Text style={[styles.statNumber, { color: theme.colors.textHigh }]}>{cards.length}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textMed }]}>TOTAL CARDS</Text>
          </View>
        </View>

        {/* Progress Chart */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface2 }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textHigh }]}>Progress</Text>
          
          {/* Simple bar chart */}
          <View style={styles.chartContainer}>
            <View style={styles.barChart}>
              <View style={styles.barRow}>
                <View style={styles.barLabelContainer}>
                  <Text style={[styles.barLabel, { color: theme.colors.textHigh }]}>Studied</Text>
                  <Text style={[styles.barCount, { color: theme.colors.textHigh }]}>{studiedCards}</Text>
                </View>
                <View style={styles.barContainer}>
                  <View 
                    style={[
                      styles.bar, 
                      { 
                        backgroundColor: theme.colors.dataViz.mature,
                        width: cards.length > 0 ? `${(studiedCards / cards.length) * 100}%` : '0%'
                      }
                    ]} 
                  />
                </View>
              </View>
              
              <View style={styles.barRow}>
                <View style={styles.barLabelContainer}>
                  <Text style={[styles.barLabel, { color: theme.colors.textHigh }]}>Learning</Text>
                  <Text style={[styles.barCount, { color: theme.colors.textHigh }]}>{inProgressCards}</Text>
                </View>
                <View style={styles.barContainer}>
                  <View 
                    style={[
                      styles.bar, 
                      { 
                        backgroundColor: theme.colors.dataViz.young,
                        width: cards.length > 0 ? `${(inProgressCards / cards.length) * 100}%` : '0%'
                      }
                    ]} 
                  />
                </View>
              </View>
              
              <View style={styles.barRow}>
                <View style={styles.barLabelContainer}>
                  <Text style={[styles.barLabel, { color: theme.colors.textHigh }]}>Not Started</Text>
                  <Text style={[styles.barCount, { color: theme.colors.textHigh }]}>{notStudiedCards}</Text>
                </View>
                <View style={styles.barContainer}>
                  <View 
                    style={[
                      styles.bar, 
                      { 
                        backgroundColor: theme.colors.dataViz.new,
                        width: cards.length > 0 ? `${(notStudiedCards / cards.length) * 100}%` : '0%'
                      }
                    ]} 
                  />
                </View>
              </View>
            </View>
          </View>
          
          {/* Next card timer - always visible */}
          {timeRemaining && (
            <View style={[styles.timerContainer, { backgroundColor: theme.colors.bg }]}>
              <Text style={[styles.timerLabel, { color: theme.colors.textMed }]}>
                Card Status
              </Text>
              <Text style={[
                styles.timerValue, 
                { color: theme.colors.textHigh }
              ]}>
                {timeRemaining}
              </Text>
            </View>
          )}
        </View>

        {/* Primary Actions */}
        <View style={styles.primaryActions}>
          <Pressable
            style={[styles.primaryButton, { backgroundColor: theme.colors.primary }]}
            onPress={handleStudy}
          >
            <Ionicons name="book-outline" size={20} color={theme.colors.onPrimary} style={{ marginRight: s.sm }} />
            <Text style={[styles.primaryButtonText, { color: theme.colors.onPrimary }]}>Study Now</Text>
          </Pressable>
          <Pressable
            style={[styles.secondaryButton, { backgroundColor: theme.colors.surface2, borderWidth: 1, borderColor: theme.colors.border }]}
            onPress={handleBrowseCards}
          >
            <Ionicons name="search-outline" size={20} color={theme.colors.textHigh} style={{ marginRight: s.sm }} />
            <Text style={[styles.secondaryButtonText, { color: theme.colors.textHigh }]}>Browse Cards</Text>
          </Pressable>
        </View>

        {/* Secondary Actions */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface2 }]}>
          <Pressable 
            style={styles.actionRow} 
            onPress={() => navigation.navigate('DeckStats', { deckId, deckName: deck.name })}
          >
            <Ionicons name="stats-chart-outline" size={22} color={theme.colors.textHigh} />
            <Text style={[styles.actionLabel, { color: theme.colors.textHigh }]}>View Statistics</Text>
            <Ionicons name="chevron-forward" size={24} color={theme.colors.textMed} />
          </Pressable>
          
          <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
          
          <Pressable style={styles.actionRow} onPress={handleEnableAiHints}>
            <Ionicons 
              name={aiHintsEnabled ? "bulb" : "bulb-outline"} 
              size={22} 
              color={theme.colors.textHigh} 
            />
            <Text style={[styles.actionLabel, { color: theme.colors.textHigh }]}>
              {aiHintsEnabled ? 'Manage AI Hints' : 'Enable AI Hints'}
            </Text>
            <Ionicons name="chevron-forward" size={24} color={theme.colors.textMed} />
          </Pressable>
          
          <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
          
          <Pressable style={styles.actionRow} onPress={handleRenameDeck}>
            <Ionicons name="create-outline" size={22} color={theme.colors.textHigh} />
            <Text style={[styles.actionLabel, { color: theme.colors.textHigh }]}>Rename Deck</Text>
            <Ionicons name="chevron-forward" size={24} color={theme.colors.textMed} />
          </Pressable>
          
          <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
          
          <Pressable style={styles.actionRow} onPress={handleSuspendAll}>
            <Ionicons name="pause-outline" size={22} color={theme.colors.textHigh} />
            <Text style={[styles.actionLabel, { color: theme.colors.textHigh }]}>Suspend All Cards</Text>
            <Ionicons name="chevron-forward" size={24} color={theme.colors.textMed} />
          </Pressable>
          
          {suspendedCards.length > 0 && (
            <>
              <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
              <Pressable style={styles.actionRow} onPress={handleUnsuspendAll}>
                <Ionicons name="play-outline" size={22} color={theme.colors.textHigh} />
                <Text style={[styles.actionLabel, { color: theme.colors.textHigh }]}>Unsuspend All Cards</Text>
                <Ionicons name="chevron-forward" size={24} color={theme.colors.textMed} />
              </Pressable>
            </>
          )}
          
          <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
          
          <Pressable 
            style={styles.actionRow} 
            onPress={() => navigation.navigate('DeckOptions', { deckId })}
          >
            <Ionicons name="options-outline" size={22} color={theme.colors.textHigh} />
            <Text style={[styles.actionLabel, { color: theme.colors.textHigh }]}>Study Options</Text>
            <Ionicons name="chevron-forward" size={24} color={theme.colors.textMed} />
          </Pressable>
          
          {deckId !== '1' && (
            <>
              <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
              <Pressable style={styles.actionRow} onPress={handleDeleteDeck}>
                <Ionicons name="trash-outline" size={22} color={theme.colors.danger} />
                <Text style={[styles.actionLabel, { color: theme.colors.danger }]}>Delete Deck</Text>
                <Ionicons name="chevron-forward" size={24} color={theme.colors.textMed} />
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>

      {/* Rename Modal */}
      <TextInputModal
        visible={renameModalVisible}
        title="Rename Deck"
        message="Enter new name:"
        defaultValue={deck?.name || ''}
        placeholder="Deck name"
        onConfirm={handleRenameConfirm}
        onCancel={() => setRenameModalVisible(false)}
        confirmText="Rename"
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
    padding: s.lg,
    gap: s.xl,
    paddingBottom: s.xl * 2,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: s.md,
  },
  statCard: {
    flex: 1,
    padding: s.xl,
    borderRadius: r.md,
    alignItems: 'center',
    minHeight: 100,
  },
  statNumber: {
    fontSize: 36,
    fontWeight: '700',
    marginBottom: s.xs,
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    padding: s.xl,
    borderRadius: r.md,
    minHeight: 180,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: s.lg,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: s.md,
    minHeight: 44,
  },
  statRowLabel: {
    fontSize: 15,
  },
  statRowValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  primaryActions: {
    gap: s.md,
  },
  primaryButton: {
    padding: s.lg,
    borderRadius: r.md,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '700',
  },
  secondaryButton: {
    padding: s.lg,
    borderRadius: r.md,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 18,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: s.md,
    gap: s.md,
  },
  actionLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    padding: s.xl,
  },
  chartContainer: {
    marginTop: s.md,
  },
  barChart: {
    gap: s.lg,
  },
  barRow: {
    gap: s.sm,
  },
  barLabelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  barLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  barCount: {
    fontSize: 16,
    fontWeight: '700',
  },
  barContainer: {
    height: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 6,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: 6,
    minWidth: 4,
  },
  timerContainer: {
    marginTop: s.xl,
    padding: s.lg,
    borderRadius: r.md,
    alignItems: 'center',
    gap: s.sm,
  },
  timerLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  timerValue: {
    fontSize: 24,
    fontWeight: '700',
  },
});
