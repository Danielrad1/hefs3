import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../design/theme';
import { useScheduler } from '../../context/SchedulerProvider';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';
import DeckActionSheet, { DeckAction } from '../../components/DeckActionSheet';
import TextInputModal from '../../components/TextInputModal';
import { DeckService } from '../../services/anki/DeckService';
import { CardService } from '../../services/anki/CardService';
import { db } from '../../services/anki/InMemoryDb';
import { PersistenceService } from '../../services/anki/PersistenceService';

interface DeckNode {
  deck: { id: string; name: string; cardCount: number; dueCount: number };
  children: DeckNode[];
  level: number;
}

export default function DecksScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const { decks, currentDeckId, setDeck, reload } = useScheduler();
  const [expandedDecks, setExpandedDecks] = useState<Set<string>>(new Set());
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [selectedDeck, setSelectedDeck] = useState<{ id: string; name: string } | null>(null);
  const [isCreatingDeck, setIsCreatingDeck] = useState(false);
  const [newDeckName, setNewDeckName] = useState('');
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [deckToRename, setDeckToRename] = useState<{ id: string; name: string } | null>(null);

  const deckService = React.useMemo(() => new DeckService(db), []);
  const cardService = React.useMemo(() => new CardService(db), []);

  // Log decks whenever they change
  React.useEffect(() => {
    console.log('[DecksScreen] Received', decks.length, 'decks from scheduler:');
    decks.forEach(d => {
      console.log('[DecksScreen] -', d.name, ':', d.cardCount, 'cards,', d.dueCount, 'due');
    });
  }, [decks]);

  const handleDeckPress = (deckId: string) => {
    // Navigate to Deck Detail screen
    (navigation as any).navigate('DeckDetail', { deckId });
  };

  const handleDeckLongPress = (deck: { id: string; name: string }) => {
    setSelectedDeck(deck);
    setActionSheetVisible(true);
  };

  const handleCreateDeck = async () => {
    if (!newDeckName.trim()) {
      Alert.alert('Error', 'Deck name cannot be empty');
      return;
    }

    try {
      deckService.createDeck(newDeckName.trim());
      await PersistenceService.save(db);
      setNewDeckName('');
      setIsCreatingDeck(false);
      reload();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to create deck');
    }
  };

  const handleRenameDeck = (deckId: string, oldName: string) => {
    setDeckToRename({ id: deckId, name: oldName });
    setRenameModalVisible(true);
  };

  const handleRenameConfirm = async (newName: string) => {
    if (!deckToRename || !newName.trim()) {
      setRenameModalVisible(false);
      setDeckToRename(null);
      return;
    }

    try {
      deckService.renameDeck(deckToRename.id, newName.trim());
      await PersistenceService.save(db);
      reload();
      setRenameModalVisible(false);
      setDeckToRename(null);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to rename deck');
      setRenameModalVisible(false);
      setDeckToRename(null);
    }
  };

  const handleDeleteDeck = (deckId: string, deckName: string) => {
    const cards = db.getCardsByDeck(deckId);
    Alert.alert(
      'Delete Deck',
      `This will permanently delete "${deckName}" and all ${cards.length} cards. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              deckService.deleteDeck(deckId, { deleteCards: true });
              await PersistenceService.save(db);
              reload();
            } catch (error) {
              console.error('Error deleting deck:', error);
              Alert.alert('Error', error instanceof Error ? error.message : 'Failed to delete deck');
            }
          },
        },
      ]
    );
  };

  const handleSuspendAll = async (deckId: string) => {
    try {
      const cards = cardService.findCards({ deck: deckService.getDeck(deckId)?.name });
      cardService.suspend(cards.map((c) => c.id));
      await PersistenceService.save(db);
      reload();
      Alert.alert('Success', 'All cards in deck have been suspended');
    } catch (error) {
      Alert.alert('Error', 'Failed to suspend cards');
    }
  };

  const getDeckActions = (deck: { id: string; name: string }): DeckAction[] => {
    const actions: DeckAction[] = [
      {
        id: 'study',
        label: 'Study Now',
        icon: '📚',
        onPress: () => handleDeckPress(deck.id),
      },
      {
        id: 'rename',
        label: 'Rename',
        icon: '✏️',
        onPress: () => handleRenameDeck(deck.id, deck.name),
      },
      {
        id: 'suspend',
        label: 'Suspend All Cards',
        icon: '⏸️',
        onPress: () => handleSuspendAll(deck.id),
      },
    ];

    // Only allow deleting non-default decks
    if (deck.id !== '1') {
      actions.push({
        id: 'delete',
        label: 'Delete Deck',
        icon: '🗑️',
        destructive: true,
        onPress: () => handleDeleteDeck(deck.id, deck.name),
      });
    }

    return actions;
  };

  const handleAllDecks = () => {
    setDeck(null);  // null = all decks
    navigation.navigate('Study' as never);
  };

  // Build tree structure from flat deck list
  const buildDeckTree = React.useMemo(() => {
    const tree: DeckNode[] = [];
    const deckMap = new Map<string, DeckNode>();

    // Filter out Default deck and sort by name
    const sortedDecks = [...decks]
      .filter(d => d.id !== '1' && d.name !== 'Default')
      .sort((a, b) => a.name.localeCompare(b.name));

    sortedDecks.forEach(deck => {
      const parts = deck.name.split('::');
      const node: DeckNode = {
        deck: { ...deck }, // Clone so we can update stats
        children: [],
        level: parts.length - 1,
      };

      deckMap.set(deck.name, node);

      if (parts.length === 1) {
        // Root level deck
        tree.push(node);
      } else {
        // Child deck - find parent
        const parentName = parts.slice(0, -1).join('::');
        const parent = deckMap.get(parentName);
        if (parent) {
          parent.children.push(node);
        } else {
          // Parent doesn't exist, add as root
          tree.push(node);
        }
      }
    });

    // Calculate cumulative stats for parent decks (bottom-up)
    const calculateStats = (node: DeckNode): { cardCount: number; dueCount: number } => {
      if (node.children.length === 0) {
        // Leaf node - use its own stats
        return {
          cardCount: node.deck.cardCount,
          dueCount: node.deck.dueCount,
        };
      }

      // Parent node - sum all children
      let totalCards = node.deck.cardCount; // Start with own cards
      let totalDue = node.deck.dueCount;

      node.children.forEach(child => {
        const childStats = calculateStats(child);
        totalCards += childStats.cardCount;
        totalDue += childStats.dueCount;
      });

      // Update parent's stats to reflect children
      node.deck.cardCount = totalCards;
      node.deck.dueCount = totalDue;

      return { cardCount: totalCards, dueCount: totalDue };
    };

    // Calculate stats for all trees
    tree.forEach(node => calculateStats(node));

    return tree;
  }, [decks]);

  const toggleExpand = (deckName: string) => {
    setExpandedDecks(prev => {
      const next = new Set(prev);
      if (next.has(deckName)) {
        next.delete(deckName);
      } else {
        next.add(deckName);
      }
      return next;
    });
  };

  const totalDue = decks.reduce((sum, d) => sum + d.dueCount, 0);
  const totalCards = decks.reduce((sum, d) => sum + d.cardCount, 0);

  // Render deck node recursively
  const renderDeckNode = (nodes: DeckNode[], parentLevel: number): React.ReactNode[] => {
    const elements: React.ReactNode[] = [];

    nodes.forEach((node) => {
      const parts = node.deck.name.split('::');
      const leafName = parts[parts.length - 1];
      const hasChildren = node.children.length > 0;
      const isExpanded = expandedDecks.has(node.deck.name);
      const indent = node.level * 20;

      elements.push(
        <Pressable
          key={node.deck.id}
          style={[
            styles.deckCard,
            {
              backgroundColor: theme.colors.surface,
              borderColor: currentDeckId === node.deck.id ? theme.colors.accent : 'transparent',
              borderWidth: 2,
              marginLeft: indent,
            },
          ]}
          onPress={() => {
            if (hasChildren) {
              toggleExpand(node.deck.name);
            } else {
              handleDeckPress(node.deck.id);
            }
          }}
        >
          <View style={styles.deckInfo}>
            {hasChildren && (
              <Text style={[styles.expandIcon, { color: theme.colors.textSecondary }]}>
                {isExpanded ? '▼' : '▶'}
              </Text>
            )}
            <View style={{ flex: 1 }}>
              <Text style={[styles.deckName, { color: theme.colors.textPrimary }]}>
                {leafName}
              </Text>
            </View>
            <Text style={[styles.cardCount, { color: theme.colors.textSecondary }]}>
              {node.deck.dueCount} due · {node.deck.cardCount} total
            </Text>
          </View>
        </Pressable>
      );

      // Render children if expanded
      if (isExpanded && hasChildren) {
        elements.push(...renderDeckNode(node.children, node.level + 1));
      }
    });

    return elements;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
            Decks
          </Text>
          <Pressable
            style={[styles.addButton, { backgroundColor: theme.colors.accent }]}
            onPress={() => setIsCreatingDeck(true)}
          >
            <Text style={styles.addButtonText}>+</Text>
          </Pressable>
        </View>

        {/* Create deck input */}
        {isCreatingDeck && (
          <View style={[styles.createDeckCard, { backgroundColor: theme.colors.surface }]}>
            <TextInput
              style={[styles.input, { color: theme.colors.textPrimary, borderColor: theme.colors.border }]}
              placeholder="Enter deck name (e.g., Parent::Child)"
              placeholderTextColor={theme.colors.textSecondary}
              value={newDeckName}
              onChangeText={setNewDeckName}
              autoFocus
            />
            <View style={styles.createActions}>
              <Pressable
                style={[styles.createButton, { backgroundColor: theme.colors.surface }]}
                onPress={() => {
                  setIsCreatingDeck(false);
                  setNewDeckName('');
                }}
              >
                <Text style={[styles.createButtonText, { color: theme.colors.textSecondary }]}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                style={[styles.createButton, { backgroundColor: theme.colors.accent }]}
                onPress={handleCreateDeck}
              >
                <Text style={[styles.createButtonText, { color: '#000' }]}>
                  Create
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Render deck tree */}
        {renderDeckNode(buildDeckTree, 0)}
      </ScrollView>

      {/* Deck Action Sheet */}
      {selectedDeck && (
        <DeckActionSheet
          visible={actionSheetVisible}
          deckName={selectedDeck.name}
          actions={getDeckActions(selectedDeck)}
          onClose={() => {
            setActionSheetVisible(false);
            setSelectedDeck(null);
          }}
        />
      )}

      {/* Rename Modal */}
      <TextInputModal
        visible={renameModalVisible}
        title="Rename Deck"
        message="Enter new name:"
        defaultValue={deckToRename?.name || ''}
        placeholder="Deck name"
        onConfirm={handleRenameConfirm}
        onCancel={() => {
          setRenameModalVisible(false);
          setDeckToRename(null);
        }}
        confirmText="Rename"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: s.lg,
    gap: s.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: s.md,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#000',
  },
  createDeckCard: {
    padding: s.md,
    borderRadius: r.md,
    marginBottom: s.md,
    gap: s.md,
  },
  input: {
    padding: s.md,
    borderRadius: r.sm,
    borderWidth: 1,
    fontSize: 16,
  },
  createActions: {
    flexDirection: 'row',
    gap: s.sm,
    justifyContent: 'flex-end',
  },
  createButton: {
    paddingVertical: s.sm,
    paddingHorizontal: s.lg,
    borderRadius: r.sm,
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  deckCard: {
    padding: s.md,
    borderRadius: r.md,
    marginBottom: s.xs,
  },
  deckInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.sm,
  },
  expandIcon: {
    fontSize: 14,
    width: 20,
    textAlign: 'center',
  },
  deckName: {
    fontSize: 16,
    fontWeight: '600',
  },
  deckPath: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 2,
  },
  cardCount: {
    fontSize: 13,
  },
});
