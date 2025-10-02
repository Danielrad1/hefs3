import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
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
import { useDeckImport } from './hooks/useDeckImport';
import DeckCard from './components/DeckCard';
import AddDeckModal from './components/AddDeckModal';
import ImportProgressModal from './components/ImportProgressModal';
import CreateDeckForm from './components/CreateDeckForm';
import { buildDeckTree, filterDecks, DeckWithStats, DeckNode } from './utils/deckTreeUtils';

export default function DecksScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const { decks, setDeck: setCurrentDeck, currentDeckId, reload } = useScheduler();
  const [expandedDecks, setExpandedDecks] = useState<Set<string>>(new Set());
  const [isCreatingDeck, setIsCreatingDeck] = useState(false);
  const [newDeckName, setNewDeckName] = useState('');
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [selectedDeck, setSelectedDeck] = useState<DeckWithStats | null>(null);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [deckToRename, setDeckToRename] = useState<DeckWithStats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [addDeckModalVisible, setAddDeckModalVisible] = useState(false);

  const deckService = React.useMemo(() => new DeckService(db), []);
  const cardService = React.useMemo(() => new CardService(db), []);
  
  // Use import hook
  const { importing, importProgress, handleImportDeck } = useDeckImport(reload);

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

  const handleDeckLongPress = (deck: DeckWithStats) => {
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
    // Find the full deck object
    const deck = decks.find(d => d.id === deckId);
    if (deck) {
      setDeckToRename(deck);
    }
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

  const getDeckActions = (deck: DeckWithStats): DeckAction[] => {
    const actions: DeckAction[] = [
      {
        id: 'study',
        label: 'Study Now',
        icon: 'book-outline',
        onPress: () => handleDeckPress(deck.id),
      },
      {
        id: 'rename',
        label: 'Rename',
        icon: 'create-outline',
        onPress: () => handleRenameDeck(deck.id, deck.name),
      },
      {
        id: 'suspend',
        label: 'Suspend All Cards',
        icon: 'pause-outline',
        onPress: () => handleSuspendAll(deck.id),
      },
    ];

    // Only allow deleting non-default decks
    if (deck.id !== '1') {
      actions.push({
        id: 'delete',
        label: 'Delete Deck',
        icon: 'trash-outline',
        destructive: true,
        onPress: () => handleDeleteDeck(deck.id, deck.name),
      });
    }

    return actions;
  };

  const handleAllDecks = () => {
    setCurrentDeck(null);  // null = all decks
    navigation.navigate('Study' as never);
  };

  // Build tree structure from flat deck list
  const deckTree = React.useMemo(() => buildDeckTree(decks), [decks]);

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
      const hasChildren = node.children.length > 0;
      const isExpanded = expandedDecks.has(node.deck.name);

      elements.push(
        <DeckCard
          key={node.deck.id}
          deck={node.deck}
          level={node.level}
          hasChildren={hasChildren}
          isExpanded={isExpanded}
          isCurrentDeck={currentDeckId === node.deck.id}
          onPress={() => {
            if (hasChildren) {
              toggleExpand(node.deck.name);
            } else {
              handleDeckPress(node.deck.id);
            }
          }}
          onLongPress={() => {
            setSelectedDeck(node.deck);
            setActionSheetVisible(true);
          }}
          onMorePress={() => {
            setSelectedDeck(node.deck);
            setActionSheetVisible(true);
          }}
        />
      );

      // Render children if expanded
      if (isExpanded && hasChildren) {
        elements.push(...renderDeckNode(node.children, node.level + 1));
      }
    });

    return elements;
  };

  // Filter decks by search query
  const filteredDecks = React.useMemo(() => filterDecks(decks, searchQuery), [decks, searchQuery]);

  // Build tree from filtered decks
  const filteredDeckTree = React.useMemo(() => {
    const tree: any[] = [];
    const map = new Map<string, any>();

    filteredDecks.forEach(deck => {
      const node = {
        deck,
        level: 0,
        children: [],
      };
      map.set(deck.name, node);
    });

    filteredDecks.forEach(deck => {
      const node = map.get(deck.name);
      if (!node) return;

      const parts = deck.name.split('::');
      if (parts.length > 1) {
        const parentName = parts.slice(0, -1).join('::');
        const parent = map.get(parentName);
        if (parent) {
          parent.children.push(node);
          node.level = parent.level + 1;
        } else {
          tree.push(node);
        }
      } else {
        tree.push(node);
      }
    });

    return tree;
  }, [filteredDecks]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
            Decks
          </Text>
          <Pressable
            style={[styles.addButton, { backgroundColor: theme.colors.accent }]}
            onPress={() => setAddDeckModalVisible(true)}
          >
            <Text style={styles.addButtonText}>+</Text>
          </Pressable>
        </View>

        {/* Search Bar */}
        <View style={[styles.searchContainer, { backgroundColor: theme.colors.surface }]}>
          <Ionicons name="search" size={20} color={theme.colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.colors.textPrimary }]}
            placeholder="Search decks..."
            placeholderTextColor={theme.colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={theme.colors.textSecondary} />
            </Pressable>
          )}
        </View>

        {/* Create deck input */}
        {isCreatingDeck && (
          <CreateDeckForm
            value={newDeckName}
            onChangeText={setNewDeckName}
            onCancel={() => {
              setIsCreatingDeck(false);
              setNewDeckName('');
            }}
            onCreate={handleCreateDeck}
          />
        )}

        {/* Render deck tree */}
        {filteredDecks.length > 0 ? (
          renderDeckNode(filteredDeckTree, 0)
        ) : (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
              {searchQuery ? 'No decks found' : 'No decks yet'}
            </Text>
          </View>
        )}
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

      {/* Add Deck Options Modal */}
      <AddDeckModal
        visible={addDeckModalVisible}
        onCreateNew={() => {
          setAddDeckModalVisible(false);
          setIsCreatingDeck(true);
        }}
        onImport={() => {
          setAddDeckModalVisible(false);
          handleImportDeck();
        }}
        onCancel={() => setAddDeckModalVisible(false)}
      />

      {/* Import Progress Modal */}
      <ImportProgressModal visible={importing} progress={importProgress} />
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: r.lg,
    paddingHorizontal: s.md,
    paddingVertical: s.sm,
    marginBottom: s.md,
    gap: s.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  emptyState: {
    padding: s.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
  },
});
