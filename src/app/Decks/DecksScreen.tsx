import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/theme';
import { useScheduler } from '../../context/SchedulerProvider';
import { useAuth } from '../../context/AuthContext';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';
import DeckActionSheet, { DeckAction } from '../../components/DeckActionSheet';
import { FirstRunGuide } from '../../guided/FirstRunGuide';
import OnboardingModal from '../../components/OnboardingModal';
import TextInputModal from '../../components/TextInputModal';
import { DeckService } from '../../services/anki/DeckService';
import { CardService } from '../../services/anki/CardService';
import { db } from '../../services/anki/InMemoryDb';
import { PersistenceService } from '../../services/anki/PersistenceService';
import { useDeckImport } from './hooks/useDeckImport';
import DeckCard from './components/DeckCard';
import FolderCard from './components/FolderCard';
import AddDeckModal from './components/AddDeckModal';
import ImportProgressModal from './components/ImportProgressModal';
import ImportOptionsModal from './components/ImportOptionsModal';
import CreateDeckForm from './components/CreateDeckForm';
import DeckCustomizationModal from './components/DeckCustomizationModalV2';
import FolderCustomizationModal from './components/FolderCustomizationModalV2';
import FolderManagementModal from './components/FolderManagementModalV2';
import { buildDeckTree, filterDecks, DeckWithStats, DeckNode } from './utils/deckTreeUtils';
import { deckMetadataService, DeckMetadata, FolderMetadata } from '../../services/anki/DeckMetadataService';

export default function DecksScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const { decks, setDeck: setCurrentDeck, currentDeckId, reload } = useScheduler();
  const { user } = useAuth();
  const uid = user?.uid || null;
  const [expandedDecks, setExpandedDecks] = useState<Set<string>>(new Set());
  const [isCreatingDeck, setIsCreatingDeck] = useState(false);
  const [newDeckName, setNewDeckName] = useState('');
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [selectedDeck, setSelectedDeck] = useState<DeckWithStats | null>(null);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [deckToRename, setDeckToRename] = useState<DeckWithStats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [addDeckModalVisible, setAddDeckModalVisible] = useState(false);
  const [customizationModalVisible, setCustomizationModalVisible] = useState(false);
  const [deckToCustomize, setDeckToCustomize] = useState<DeckWithStats | null>(null);
  const [deckMetadata, setDeckMetadata] = useState<Map<string, DeckMetadata>>(new Map());
  const [folderMetadata, setFolderMetadata] = useState<Map<string, FolderMetadata>>(new Map());
  const [folderModalVisible, setFolderModalVisible] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [folderCustomizationModalVisible, setFolderCustomizationModalVisible] = useState(false);
  const [folderToCustomize, setFolderToCustomize] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [folderActionSheetVisible, setFolderActionSheetVisible] = useState(false);
  const [showStudyModal, setShowStudyModal] = useState(false);

  const deckService = React.useMemo(() => new DeckService(db), []);
  const cardService = React.useMemo(() => new CardService(db), []);
  
  // Use import hook
  const { 
    importing, 
    importProgress, 
    handleImportDeck, 
    cancelImport,
    showOptionsModal,
    pendingImport,
    onImportWithProgress,
    onImportFresh,
    onCancelOptions,
  } = useDeckImport(reload, reload);

  // Load metadata on mount and when screen focuses
  const loadMetadata = React.useCallback(async () => {
    const metadata = await deckMetadataService.getAllMetadata();
    const folderMeta = await deckMetadataService.getAllFolderMetadata();
    setDeckMetadata(metadata);
    setFolderMetadata(folderMeta);
  }, []);

  // Reload decks and metadata when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      reload();
      loadMetadata();
      if (!uid) {
        setShowStudyModal(false);
        return;
      }
      FirstRunGuide.shouldShowStudy(uid)
        .then(setShowStudyModal)
        .catch(() => setShowStudyModal(false));
    }, [reload, loadMetadata, uid])
  );

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
              await deckService.deleteDeck(deckId, { deleteCards: true });
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

  const handleCustomizeDeck = (deck: DeckWithStats) => {
    setDeckToCustomize(deck);
    setCustomizationModalVisible(true);
    setActionSheetVisible(false);
  };

  const handleSaveCustomization = async (updates: Partial<Omit<DeckMetadata, 'deckId'>>) => {
    if (!deckToCustomize) return;
    
    await deckMetadataService.updateMetadata(deckToCustomize.id, updates);
    await loadMetadata();
    setCustomizationModalVisible(false);
  };

  const handleSaveFolderCustomization = async (updates: Partial<Omit<FolderMetadata, 'folderName'>>) => {
    if (!folderToCustomize) return;
    
    await deckMetadataService.updateFolderMetadata(folderToCustomize, updates);
    await loadMetadata();
    setFolderCustomizationModalVisible(false);
  };

  const getFolderActions = (folderName: string): DeckAction[] => {
    return [
      {
        id: 'customize',
        label: 'Customize',
        icon: 'color-palette-outline',
        onPress: () => {
          setFolderToCustomize(folderName);
          setFolderCustomizationModalVisible(true);
          setFolderActionSheetVisible(false);
        },
      },
      {
        id: 'delete',
        label: 'Delete Folder',
        icon: 'trash-outline',
        onPress: async () => {
          setFolderActionSheetVisible(false);
          Alert.alert(
            'Delete Folder',
            `Delete "${folderName}"? All decks in this folder will be unassigned.`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                  // Remove folder assignment from all decks
                  const allMeta = await deckMetadataService.getAllMetadata();
                  for (const [deckId, meta] of allMeta.entries()) {
                    if (meta.folder === folderName) {
                      await deckMetadataService.updateMetadata(deckId, { folder: undefined });
                    }
                  }
                  // Delete folder metadata
                  await deckMetadataService.deleteFolderMetadata(folderName);
                  await loadMetadata();
                  reload();
                },
              },
            ]
          );
        },
      },
    ];
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
        id: 'customize',
        label: 'Customize',
        icon: 'color-palette-outline',
        onPress: () => handleCustomizeDeck(deck),
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

  const toggleFolder = (folderName: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderName)) {
        next.delete(folderName);
      } else {
        next.add(folderName);
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
          metadata={deckMetadata.get(node.deck.id)}
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

  // Group decks by folder
  const groupedDecks = React.useMemo(() => {
    const folders: Record<string, DeckWithStats[]> = {};
    const unassigned: DeckWithStats[] = [];

    // Initialize all folders from metadata (including empty ones)
    folderMetadata.forEach((meta, folderName) => {
      if (!folders[folderName]) {
        folders[folderName] = [];
      }
    });

    // Assign decks to their folders
    filteredDecks.forEach(deck => {
      const meta = deckMetadata.get(deck.id);
      if (meta?.folder) {
        if (!folders[meta.folder]) {
          folders[meta.folder] = [];
        }
        folders[meta.folder].push(deck);
      } else {
        unassigned.push(deck);
      }
    });

    // Sort folders by order
    const sortedFolders = Object.keys(folders).sort((a, b) => {
      const orderA = folderMetadata.get(a)?.order ?? 999;
      const orderB = folderMetadata.get(b)?.order ?? 999;
      return orderA - orderB;
    });

    return { folders, sortedFolders, unassigned };
  }, [filteredDecks, deckMetadata, folderMetadata]);

  // Build tree from unassigned decks only (decks not in folders)
  const unassignedDeckTree = React.useMemo(() => {
    const tree: any[] = [];
    const map = new Map<string, any>();
    
    // Only build tree for unassigned decks
    const unassignedDecks = groupedDecks.unassigned;

    unassignedDecks.forEach(deck => {
      const node = {
        deck,
        level: 0,
        children: [],
      };
      map.set(deck.name, node);
    });

    unassignedDecks.forEach(deck => {
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
  }, [groupedDecks.unassigned]);

  // Build trees for all folders ONCE (not inside map loop)
  const folderDeckTrees = React.useMemo(() => {
    const trees: Record<string, DeckNode[]> = {};
    
    groupedDecks.sortedFolders.forEach(folderName => {
      const decksInFolder = groupedDecks.folders[folderName];
      const tree: DeckNode[] = [];
      const map = new Map<string, DeckNode>();
      
      // Create nodes for all decks
      decksInFolder.forEach(deck => {
        const node: DeckNode = {
          deck,
          level: 1, // Start at level 1 since they're inside a folder
          children: [],
        };
        map.set(deck.name, node);
      });
      
      // Build parent-child relationships based on :: notation
      decksInFolder.forEach(deck => {
        const node = map.get(deck.name);
        if (!node) return;
        
        const parts = deck.name.split('::');
        if (parts.length > 1) {
          // This is a child deck
          const parentName = parts.slice(0, -1).join('::');
          const parent = map.get(parentName);
          if (parent) {
            parent.children.push(node);
            node.level = parent.level + 1;
          } else {
            // Parent not in folder, treat as root
            tree.push(node);
          }
        } else {
          // No ::, it's a root deck
          tree.push(node);
        }
      });
      
      trees[folderName] = tree;
    });
    
    return trees;
  }, [groupedDecks.folders, groupedDecks.sortedFolders]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top']}>
      <OnboardingModal
        visible={showStudyModal}
        icon="albums-outline"
        title="Open Your Deck"
        body="Tap your newly imported deck, then press Study Now to begin."
        primaryLabel="Got it"
        onPrimary={() => setShowStudyModal(false)}
      />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
            Decks
          </Text>
          <Pressable
            style={[styles.headerButton, { backgroundColor: theme.colors.surface2 }]}
            onPress={() => setFolderModalVisible(true)}
          >
            <Ionicons name="folder-outline" size={24} color={theme.colors.primary} />
          </Pressable>
        </View>

        {/* Search Bar */}
        <View style={[styles.searchContainer, { backgroundColor: theme.colors.surface2 }]}>
          <Ionicons name="search" size={20} color={theme.colors.textMed} />
          <TextInput
            style={[styles.searchInput, { color: theme.colors.textHigh }]}
            placeholder="Search decks..."
            placeholderTextColor={theme.colors.textMed}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={theme.colors.textMed} />
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

        {/* Render folders and decks */}
        {filteredDecks.length > 0 ? (
          <>
            {/* Render folders */}
            {groupedDecks.sortedFolders.map(folderName => {
              const decksInFolder = groupedDecks.folders[folderName];
              const isExpanded = expandedFolders.has(folderName);
              const folderTree = folderDeckTrees[folderName] || [];
              
              // Calculate folder stats
              const folderTotalCards = decksInFolder.reduce((sum, deck) => sum + deck.cardCount, 0);
              const folderDueCards = decksInFolder.reduce((sum, deck) => sum + deck.dueCount, 0);
              
              return (
                <View key={`folder-${folderName}`}>
                  <FolderCard
                    folderName={folderName}
                    metadata={folderMetadata.get(folderName)}
                    deckCount={decksInFolder.length}
                    totalCards={folderTotalCards}
                    dueCards={folderDueCards}
                    isExpanded={isExpanded}
                    onPress={() => toggleFolder(folderName)}
                    onLongPress={() => {
                      setSelectedFolder(folderName);
                      setFolderActionSheetVisible(true);
                    }}
                    onMorePress={() => {
                      setSelectedFolder(folderName);
                      setFolderActionSheetVisible(true);
                    }}
                  />
                  {isExpanded && renderDeckNode(folderTree, 1)}
                </View>
              );
            })}
            
            {/* Render unassigned decks with hierarchy */}
            {renderDeckNode(unassignedDeckTree, 0)}
          </>
        ) : (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: theme.colors.textMed }]}>
              {searchQuery ? 'No decks found' : 'No decks yet'}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Floating Add Deck Button */}
      <Pressable
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        onPress={() => setAddDeckModalVisible(true)}
      >
        <Text style={[styles.fabIcon, { color: theme.colors.onPrimary }]}>+</Text>
      </Pressable>

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

      {/* Folder Action Sheet */}
      {selectedFolder && (
        <DeckActionSheet
          visible={folderActionSheetVisible}
          deckName={selectedFolder}
          actions={getFolderActions(selectedFolder)}
          onClose={() => {
            setFolderActionSheetVisible(false);
            setSelectedFolder(null);
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
        onCreateWithAI={() => {
          setAddDeckModalVisible(false);
          navigation.navigate('AIDeckCreator' as never);
        }}
        onImport={() => {
          setAddDeckModalVisible(false);
          handleImportDeck();
        }}
        onCancel={() => setAddDeckModalVisible(false)}
      />

      {/* Import Options Modal */}
      <ImportOptionsModal
        visible={showOptionsModal}
        deckName={pendingImport?.fileName || ''}
        hasProgress={pendingImport?.hasProgress || false}
        progressStats={pendingImport?.progressStats}
        onImportWithProgress={onImportWithProgress}
        onImportFresh={onImportFresh}
        onCancel={onCancelOptions}
      />

      {/* Import Progress Modal */}
      <ImportProgressModal 
        visible={importing} 
        progress={importProgress}
        onCancel={cancelImport}
      />

      {/* Deck Customization Modal */}
      {deckToCustomize && (
        <DeckCustomizationModal
          visible={customizationModalVisible}
          deckName={deckToCustomize.name}
          currentMetadata={deckMetadata.get(deckToCustomize.id) || null}
          onSave={handleSaveCustomization}
          onClose={() => {
            setCustomizationModalVisible(false);
            setDeckToCustomize(null);
          }}
        />
      )}

      {/* Folder Customization Modal */}
      {folderToCustomize && (
        <FolderCustomizationModal
          visible={folderCustomizationModalVisible}
          folderName={folderToCustomize}
          currentMetadata={folderMetadata.get(folderToCustomize) || null}
          onSave={handleSaveFolderCustomization}
          onClose={() => {
            setFolderCustomizationModalVisible(false);
            setFolderToCustomize(null);
          }}
        />
      )}

      {/* Folder Management Modal */}
      <FolderManagementModal
        visible={folderModalVisible}
        decks={decks.map(d => ({ id: d.id, name: d.name }))}
        onClose={() => setFolderModalVisible(false)}
        onRefresh={() => {
          reload();
          loadMetadata();
        }}
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
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: r.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    position: 'absolute',
    right: s.lg,
    bottom: s.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabIcon: {
    fontSize: 32,
    fontWeight: '300',
    marginTop: -2,
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
