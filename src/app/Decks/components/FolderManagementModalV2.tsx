import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ScrollView, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../design/theme';
import { s } from '../../../design/spacing';
import { r } from '../../../design/radii';
import { deckMetadataService, DeckMetadata } from '../../../services/anki/DeckMetadataService';

interface Deck {
  id: string;
  name: string;
}

interface FolderManagementModalProps {
  visible: boolean;
  decks: Deck[];
  onClose: () => void;
  onRefresh: () => void;
}

type TabType = 'folders' | 'assign';

export default function FolderManagementModalV2({
  visible,
  decks,
  onClose,
  onRefresh,
}: FolderManagementModalProps) {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState<TabType>('folders');
  const [folders, setFolders] = useState<string[]>([]);
  const [deckFolderMap, setDeckFolderMap] = useState<Map<string, string>>(new Map());
  const [folderMetadata, setFolderMetadata] = useState<Map<string, any>>(new Map());
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedDecks, setSelectedDecks] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (visible) {
      loadFolders();
    }
  }, [visible]);

  const loadFolders = async () => {
    const allMeta = await deckMetadataService.getAllMetadata();
    const folderMeta = await deckMetadataService.getAllFolderMetadata();
    
    const folderSet = new Set<string>();
    const deckToFolder = new Map<string, string>();
    
    // Add folders that have decks
    allMeta.forEach((meta, deckId) => {
      if (meta.folder) {
        folderSet.add(meta.folder);
        deckToFolder.set(deckId, meta.folder);
      }
    });
    
    // Also add folders that exist in metadata (even if they have no decks)
    folderMeta.forEach((meta, folderName) => {
      folderSet.add(folderName);
    });
    
    setFolders(Array.from(folderSet).sort());
    setDeckFolderMap(deckToFolder);
    setFolderMetadata(folderMeta);
    console.log('[FolderManagementModal] Loaded folders:', Array.from(folderSet));
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      Alert.alert('Error', 'Please enter a folder name');
      return;
    }
    if (folders.includes(newFolderName.trim())) {
      Alert.alert('Error', 'Folder already exists');
      return;
    }
    
    try {
      const trimmedName = newFolderName.trim();
      await deckMetadataService.updateFolderMetadata(trimmedName, { 
        order: folders.length 
      });
      setNewFolderName('');
      
      // Immediately update local state
      setFolders(prev => [...prev, trimmedName].sort());
      
      // Then reload from database to ensure sync
      await loadFolders();
      onRefresh();
      
      console.log('[FolderManagement] Created folder:', trimmedName);
    } catch (error) {
      console.error('[FolderManagement] Error creating folder:', error);
      Alert.alert('Error', 'Failed to create folder');
    }
  };

  const handleDeleteFolder = async (folderName: string) => {
    Alert.alert(
      'Delete Folder',
      `Delete "${folderName}"? All decks will be unassigned.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const allMeta = await deckMetadataService.getAllMetadata();
            for (const [deckId, meta] of allMeta.entries()) {
              if (meta.folder === folderName) {
                await deckMetadataService.updateMetadata(deckId, { folder: undefined });
              }
            }
            await deckMetadataService.deleteFolderMetadata(folderName);
            await loadFolders();
            onRefresh();
          },
        },
      ]
    );
  };

  const handleAssignToFolder = async () => {
    if (selectedDecks.size === 0 || !selectedFolder) {
      Alert.alert('Error', 'Please select at least one deck and a folder');
      return;
    }

    try {
      const decksToAssign = new Set<string>();
      
      for (const deckId of selectedDecks) {
        const deck = decks.find(d => d.id === deckId);
        if (!deck) continue;
        
        decksToAssign.add(deckId);
        
        // Include all children
        decks.forEach(d => {
          if (d.name.startsWith(deck.name + '::')) {
            decksToAssign.add(d.id);
          }
        });
      }
      
      for (const id of decksToAssign) {
        await deckMetadataService.updateMetadata(id, { folder: selectedFolder });
      }
      
      const childrenCount = decksToAssign.size - selectedDecks.size;
      const message = childrenCount > 0
        ? `Assigned ${selectedDecks.size} deck(s) + ${childrenCount} children`
        : `Assigned ${selectedDecks.size} deck(s)`;
      
      Alert.alert('Success', message);
      setSelectedDecks(new Set());
      setSelectedFolder(null);
      await loadFolders();
      onRefresh();
    } catch (error) {
      console.error('[FolderManagement] Error:', error);
      Alert.alert('Error', 'Failed to assign decks');
    }
  };

  const handleRemoveDeckFromFolder = async (deckId: string, deckName: string) => {
    const deck = decks.find(d => d.id === deckId);
    if (!deck) return;
    
    const deckTree = [deckId];
    decks.forEach(d => {
      if (d.name.startsWith(deck.name + '::')) {
        deckTree.push(d.id);
      }
    });
    
    const childCount = deckTree.length - 1;
    const message = childCount > 0
      ? `Remove "${deckName}" and ${childCount} children from folder?`
      : `Remove "${deckName}" from folder?`;
    
    Alert.alert('Remove from Folder', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        onPress: async () => {
          for (const id of deckTree) {
            await deckMetadataService.updateMetadata(id, { folder: undefined });
          }
          await loadFolders();
          onRefresh();
        },
      },
    ]);
  };

  const getDecksInFolder = (folderName: string) => {
    return Array.from(deckFolderMap.entries())
      .filter(([_, folder]) => folder === folderName)
      .map(([deckId]) => decks.find(d => d.id === deckId))
      .filter(Boolean) as Deck[];
  };

  const getRootDecksInFolder = (folderName: string) => {
    const decksInFolder = getDecksInFolder(folderName);
    return decksInFolder.filter(deck => {
      const parts = deck.name.split('::');
      if (parts.length === 1) return true;
      const parentName = parts.slice(0, -1).join('::');
      return !decksInFolder.some(d => d.name === parentName);
    });
  };

  const getUnassignedRootDecks = () => {
    return decks.filter(deck => {
      if (deckFolderMap.has(deck.id)) return false;
      
      const isChildDeck = deck.name.includes('::');
      if (!isChildDeck) return true;
      
      const parts = deck.name.split('::');
      const parentName = parts.slice(0, -1).join('::');
      const hasParent = decks.some(d => d.name === parentName && !deckFolderMap.has(d.id));
      return !hasParent;
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.75)' }]}>
        <View style={[styles.modal, { backgroundColor: theme.colors.surface }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
            <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
              Manage Folders
            </Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color={theme.colors.textSecondary} />
            </Pressable>
          </View>

          {/* Tabs */}
          <View style={[styles.tabs, { borderBottomColor: theme.colors.border }]}>
            <Pressable
              style={[
                styles.tab,
                activeTab === 'folders' && { borderBottomColor: theme.colors.accent }
              ]}
              onPress={() => setActiveTab('folders')}
            >
              <Ionicons 
                name="folder" 
                size={20} 
                color={activeTab === 'folders' ? theme.colors.accent : theme.colors.textSecondary} 
              />
              <Text style={[
                styles.tabText,
                { color: activeTab === 'folders' ? theme.colors.accent : theme.colors.textSecondary }
              ]}>
                Folders ({folders.length})
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.tab,
                activeTab === 'assign' && { borderBottomColor: theme.colors.accent }
              ]}
              onPress={() => setActiveTab('assign')}
            >
              <Ionicons 
                name="add-circle" 
                size={20} 
                color={activeTab === 'assign' ? theme.colors.accent : theme.colors.textSecondary} 
              />
              <Text style={[
                styles.tabText,
                { color: activeTab === 'assign' ? theme.colors.accent : theme.colors.textSecondary }
              ]}>
                Assign Decks
              </Text>
            </Pressable>
          </View>

          {/* Tab Content */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {activeTab === 'folders' ? (
              /* Folders Tab */
              <>
                {/* Create New Folder */}
                <View style={[styles.card, { backgroundColor: theme.colors.bg }]}>
                  <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>
                    Create New Folder
                  </Text>
                  <View style={styles.inputRow}>
                    <TextInput
                      style={[
                        styles.input,
                        { 
                          backgroundColor: theme.colors.surface,
                          color: theme.colors.textPrimary,
                          borderColor: theme.colors.border,
                        }
                      ]}
                      placeholder="Folder name (e.g., Languages)"
                      placeholderTextColor={theme.colors.textSecondary}
                      value={newFolderName}
                      onChangeText={setNewFolderName}
                      onSubmitEditing={handleCreateFolder}
                    />
                    <Pressable
                      style={[styles.createButton, { backgroundColor: theme.colors.accent }]}
                      onPress={handleCreateFolder}
                    >
                      <Ionicons name="add" size={24} color="#FFF" />
                    </Pressable>
                  </View>
                </View>

                {/* Existing Folders */}
                {folders.length > 0 && (
                  <View style={[styles.card, { backgroundColor: theme.colors.bg }]}>
                    <View style={styles.cardHeader}>
                      <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>
                        Your Folders
                      </Text>
                      <Pressable
                        style={[styles.clearAllButton, { borderColor: theme.colors.border }]}
                        onPress={async () => {
                          Alert.alert(
                            'Clear All',
                            'Remove all decks from folders? (folders and decks will NOT be deleted)',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Clear All',
                                style: 'destructive',
                                onPress: async () => {
                                  const allMeta = await deckMetadataService.getAllMetadata();
                                  for (const [deckId, meta] of allMeta.entries()) {
                                    if (meta.folder) {
                                      await deckMetadataService.updateMetadata(deckId, { folder: undefined });
                                    }
                                  }
                                  await loadFolders();
                                  onRefresh();
                                },
                              },
                            ]
                          );
                        }}
                      >
                        <Text style={[styles.clearAllText, { color: theme.colors.textSecondary }]}>
                          Clear All
                        </Text>
                      </Pressable>
                    </View>

                    {folders.map((folder) => {
                      const rootDecks = getRootDecksInFolder(folder);
                      const allDecks = getDecksInFolder(folder);
                      const meta = folderMetadata.get(folder);
                      
                      return (
                        <View key={folder} style={[styles.folderItem, { borderColor: theme.colors.border }]}>
                          <View style={styles.folderHeader}>
                            <View style={styles.folderInfo}>
                              {meta?.icon ? (
                                <View style={[styles.folderIconContainer, { backgroundColor: meta.color || theme.colors.accent }]}>
                                  {meta.icon.length <= 2 && !/^[a-z-]+$/.test(meta.icon) ? (
                                    <Text style={styles.folderEmoji}>{meta.icon}</Text>
                                  ) : (
                                    <Ionicons name={meta.icon as any} size={20} color="#FFF" />
                                  )}
                                </View>
                              ) : (
                                <Ionicons name="folder" size={24} color={meta?.color || theme.colors.accent} />
                              )}
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.folderName, { color: theme.colors.textPrimary }]}>
                                  {folder}
                                </Text>
                                <Text style={[styles.folderCount, { color: theme.colors.textSecondary }]}>
                                  {rootDecks.length} {rootDecks.length === 1 ? 'deck' : 'decks'}
                                  {allDecks.length !== rootDecks.length && ` (${allDecks.length} total)`}
                                </Text>
                              </View>
                            </View>
                            <Pressable
                              onPress={() => handleDeleteFolder(folder)}
                              style={styles.deleteButton}
                            >
                              <Ionicons name="trash-outline" size={20} color={theme.colors.danger} />
                            </Pressable>
                          </View>

                          {/* Decks in folder */}
                          {rootDecks.length > 0 && (
                            <View style={styles.decksList}>
                              {rootDecks.map((deck) => {
                                const childCount = allDecks.filter(d => d.name.startsWith(deck.name + '::')).length;
                                return (
                                  <View key={deck.id} style={[styles.deckItem, { backgroundColor: theme.colors.surface }]}>
                                    <Text style={[styles.deckName, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                                      {deck.name.split('::').pop()}
                                      {childCount > 0 && ` (+${childCount})`}
                                    </Text>
                                    <Pressable
                                      onPress={() => handleRemoveDeckFromFolder(deck.id, deck.name)}
                                      style={styles.removeButton}
                                    >
                                      <Ionicons name="close-circle" size={18} color={theme.colors.textSecondary} />
                                    </Pressable>
                                  </View>
                                );
                              })}
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}

                {folders.length === 0 && (
                  <View style={[styles.emptyState, { backgroundColor: theme.colors.bg }]}>
                    <Ionicons name="folder-open-outline" size={48} color={theme.colors.textSecondary} />
                    <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                      No folders yet
                    </Text>
                    <Text style={[styles.emptyHint, { color: theme.colors.textSecondary }]}>
                      Create a folder to organize your decks
                    </Text>
                  </View>
                )}
              </>
            ) : (
              /* Assign Decks Tab */
              <>
                {/* Select Folder */}
                <View style={[styles.card, { backgroundColor: theme.colors.bg }]}>
                  <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>
                    1. Select Folder
                  </Text>
                  {folders.length > 0 ? (
                    <View style={styles.folderGrid}>
                      {folders.map((folder) => (
                        <Pressable
                          key={folder}
                          style={[
                            styles.folderChip,
                            {
                              backgroundColor: selectedFolder === folder ? theme.colors.accent + '20' : theme.colors.surface,
                              borderColor: selectedFolder === folder ? theme.colors.accent : theme.colors.border,
                            }
                          ]}
                          onPress={() => setSelectedFolder(selectedFolder === folder ? null : folder)}
                        >
                          <Ionicons 
                            name="folder" 
                            size={16} 
                            color={selectedFolder === folder ? theme.colors.accent : theme.colors.textSecondary} 
                          />
                          <Text style={[
                            styles.folderChipText,
                            { color: selectedFolder === folder ? theme.colors.accent : theme.colors.textPrimary }
                          ]} numberOfLines={1}>
                            {folder}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : (
                    <Text style={[styles.hint, { color: theme.colors.textSecondary }]}>
                      Create a folder first in the Folders tab
                    </Text>
                  )}
                </View>

                {/* Select Decks */}
                {selectedFolder && (
                  <View style={[styles.card, { backgroundColor: theme.colors.bg }]}>
                    <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>
                      2. Select Decks
                    </Text>
                    <Text style={[styles.hint, { color: theme.colors.textSecondary }]}>
                      Choose decks to add to "{selectedFolder}"
                    </Text>
                    <View style={styles.deckGrid}>
                      {getUnassignedRootDecks().map((deck) => {
                        const isSelected = selectedDecks.has(deck.id);
                        const childCount = decks.filter(d => d.name.startsWith(deck.name + '::')).length;
                        
                        return (
                          <Pressable
                            key={deck.id}
                            style={[
                              styles.deckChip,
                              {
                                backgroundColor: isSelected ? theme.colors.accent + '20' : theme.colors.surface,
                                borderColor: isSelected ? theme.colors.accent : theme.colors.border,
                              }
                            ]}
                            onPress={() => {
                              setSelectedDecks(prev => {
                                const next = new Set(prev);
                                if (next.has(deck.id)) {
                                  next.delete(deck.id);
                                } else {
                                  next.add(deck.id);
                                }
                                return next;
                              });
                            }}
                          >
                            <Text style={[
                              styles.deckChipText,
                              { color: isSelected ? theme.colors.accent : theme.colors.textPrimary }
                            ]} numberOfLines={2}>
                              {deck.name}
                              {childCount > 0 && ` (+${childCount})`}
                            </Text>
                            {isSelected && (
                              <Ionicons name="checkmark-circle" size={18} color={theme.colors.accent} />
                            )}
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                )}
              </>
            )}

            <View style={{ height: 100 }} />
          </ScrollView>

          {/* Footer */}
          {activeTab === 'assign' && selectedFolder && selectedDecks.size > 0 && (
            <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
              <Pressable
                style={[styles.assignButton, { backgroundColor: theme.colors.accent }]}
                onPress={handleAssignToFolder}
              >
                <Text style={styles.assignButtonText}>
                  Add {selectedDecks.size} to {selectedFolder}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modal: {
    borderTopLeftRadius: r.xl,
    borderTopRightRadius: r.xl,
    maxHeight: '92%',
    height: '92%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: s.lg,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  closeButton: {
    padding: s.xs,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s.sm,
    paddingVertical: s.md,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: s.lg,
  },
  card: {
    padding: s.lg,
    borderRadius: r.lg,
    marginBottom: s.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: s.md,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: s.md,
  },
  inputRow: {
    flexDirection: 'row',
    gap: s.sm,
  },
  input: {
    flex: 1,
    fontSize: 15,
    padding: s.md,
    borderRadius: r.md,
    borderWidth: 1,
  },
  createButton: {
    width: 48,
    height: 48,
    borderRadius: r.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearAllButton: {
    paddingHorizontal: s.md,
    paddingVertical: s.sm,
    borderRadius: r.md,
    borderWidth: 1,
  },
  clearAllText: {
    fontSize: 13,
    fontWeight: '600',
  },
  folderItem: {
    padding: s.md,
    borderRadius: r.md,
    borderWidth: 1,
    marginBottom: s.sm,
  },
  folderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  folderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.md,
    flex: 1,
  },
  folderIconContainer: {
    width: 36,
    height: 36,
    borderRadius: r.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  folderEmoji: {
    fontSize: 20,
  },
  folderName: {
    fontSize: 16,
    fontWeight: '600',
  },
  folderCount: {
    fontSize: 13,
    marginTop: 2,
  },
  deleteButton: {
    padding: s.sm,
  },
  decksList: {
    marginTop: s.md,
    gap: s.sm,
  },
  deckItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: s.sm,
    paddingHorizontal: s.md,
    borderRadius: r.sm,
  },
  deckName: {
    fontSize: 14,
    flex: 1,
  },
  removeButton: {
    padding: s.xs,
  },
  folderGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: s.sm,
  },
  folderChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.xs,
    paddingHorizontal: s.md,
    paddingVertical: s.sm,
    borderRadius: r.full,
    borderWidth: 1.5,
  },
  folderChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  deckGrid: {
    gap: s.sm,
    marginTop: s.md,
  },
  deckChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: s.md,
    borderRadius: r.md,
    borderWidth: 1.5,
  },
  deckChipText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  hint: {
    fontSize: 13,
    marginTop: s.xs,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: s.xl * 2,
    borderRadius: r.lg,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: s.md,
  },
  emptyHint: {
    fontSize: 14,
    marginTop: s.sm,
  },
  footer: {
    padding: s.lg,
    borderTopWidth: 1,
  },
  assignButton: {
    paddingVertical: s.md,
    borderRadius: r.md,
    alignItems: 'center',
  },
  assignButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
