/**
 * Test suite for DeckMetadataService
 * Tests idempotent loading, metadata persistence, folder management, and AI hints settings
 */

import { DeckMetadataService } from '../DeckMetadataService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock logger
jest.mock('../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('DeckMetadataService', () => {
  let service: DeckMetadataService;

  beforeEach(async () => {
    await AsyncStorage.clear();
    service = new DeckMetadataService();
  });

  describe('load', () => {
    it('loads metadata from AsyncStorage', async () => {
      const testData = {
        'deck1': { deckId: 'deck1', icon: '📚', color: '#FF0000' },
        'deck2': { deckId: 'deck2', icon: '🎯', color: '#00FF00' },
      };
      await AsyncStorage.setItem('@deck_metadata', JSON.stringify(testData));

      await service.load();

      const metadata1 = await service.getMetadata('deck1');
      const metadata2 = await service.getMetadata('deck2');

      expect(metadata1).toEqual(testData.deck1);
      expect(metadata2).toEqual(testData.deck2);
    });

    it('handles missing storage gracefully', async () => {
      await service.load();

      const metadata = await service.getMetadata('nonexistent');
      expect(metadata).toBeNull();
    });

    it('handles corrupted JSON gracefully', async () => {
      await AsyncStorage.setItem('@deck_metadata', 'invalid-json{');

      await service.load();

      // Should not throw, should have empty cache
      const metadata = await service.getMetadata('any');
      expect(metadata).toBeNull();
    });

    it('is idempotent - concurrent calls resolve once', async () => {
      const testData = { 'deck1': { deckId: 'deck1', icon: '📚' } };
      await AsyncStorage.setItem('@deck_metadata', JSON.stringify(testData));

      // Spy on getItem to count calls
      const getItemSpy = jest.spyOn(AsyncStorage, 'getItem');

      // Call load multiple times concurrently
      await Promise.all([
        service.load(),
        service.load(),
        service.load(),
      ]);

      // Should only call getItem once
      expect(getItemSpy).toHaveBeenCalledTimes(1);
    });

    it('returns immediately on subsequent calls after loaded', async () => {
      await service.load();
      
      const getItemSpy = jest.spyOn(AsyncStorage, 'getItem');

      // Second load should not call getItem
      await service.load();

      expect(getItemSpy).not.toHaveBeenCalled();
    });
  });

  describe('setMetadata and updateMetadata', () => {
    it('sets and persists deck metadata', async () => {
      const metadata = {
        deckId: 'deck1',
        icon: '📚',
        color: '#FF0000',
        folder: 'Languages',
      };

      await service.setMetadata(metadata);

      // Verify in memory
      const retrieved = await service.getMetadata('deck1');
      expect(retrieved).toEqual(metadata);

      // Verify persisted
      const stored = await AsyncStorage.getItem('@deck_metadata');
      const parsed = JSON.parse(stored!);
      expect(parsed.deck1).toEqual(metadata);
    });

    it('updates existing metadata', async () => {
      const initial = { deckId: 'deck1', icon: '📚' };
      await service.setMetadata(initial);

      await service.updateMetadata('deck1', { color: '#FF0000', folder: 'Test' });

      const updated = await service.getMetadata('deck1');
      expect(updated).toEqual({
        deckId: 'deck1',
        icon: '📚',
        color: '#FF0000',
        folder: 'Test',
      });
    });

    it('creates metadata when updating non-existent deck', async () => {
      await service.updateMetadata('new-deck', { icon: '🆕', color: '#BLUE' });

      const metadata = await service.getMetadata('new-deck');
      expect(metadata).toEqual({
        deckId: 'new-deck',
        icon: '🆕',
        color: '#BLUE',
      });
    });

    it('survives fresh load after save', async () => {
      await service.setMetadata({ deckId: 'deck1', icon: '📚' });

      // Create new service instance
      const newService = new DeckMetadataService();
      await newService.load();

      const metadata = await newService.getMetadata('deck1');
      expect(metadata).toEqual({ deckId: 'deck1', icon: '📚' });
    });
  });

  describe('deleteMetadata', () => {
    it('deletes metadata from cache and storage', async () => {
      await service.setMetadata({ deckId: 'deck1', icon: '📚' });
      
      let metadata = await service.getMetadata('deck1');
      expect(metadata).not.toBeNull();

      await service.deleteMetadata('deck1');

      metadata = await service.getMetadata('deck1');
      expect(metadata).toBeNull();

      // Verify persisted
      const stored = await AsyncStorage.getItem('@deck_metadata');
      const parsed = JSON.parse(stored!);
      expect(parsed.deck1).toBeUndefined();
    });
  });

  describe('folder management', () => {
    it('loads folder metadata', async () => {
      const folderData = {
        'Languages': { folderName: 'Languages', icon: '🌍', color: '#FF0000' },
        'Science': { folderName: 'Science', icon: '🔬', color: '#00FF00' },
      };
      await AsyncStorage.setItem('@folder_metadata', JSON.stringify(folderData));

      await service.loadFolders();

      const folder1 = await service.getFolderMetadata('Languages');
      const folder2 = await service.getFolderMetadata('Science');

      expect(folder1).toEqual(folderData.Languages);
      expect(folder2).toEqual(folderData.Science);
    });

    it('returns union of folder metadata and deck folders', async () => {
      // Set up folder metadata
      await service.setFolderMetadata({
        folderName: 'Empty Folder',
        icon: '📁',
      });

      // Set up deck with folder
      await service.setMetadata({
        deckId: 'deck1',
        folder: 'Deck Folder',
      });

      const folders = await service.getFolders();

      expect(folders).toContain('Empty Folder');
      expect(folders).toContain('Deck Folder');
      expect(folders).toHaveLength(2);
    });

    it('returns sorted folder list', async () => {
      await service.setFolderMetadata({ folderName: 'Zebra' });
      await service.setFolderMetadata({ folderName: 'Alpha' });
      await service.setFolderMetadata({ folderName: 'Middle' });

      const folders = await service.getFolders();

      expect(folders).toEqual(['Alpha', 'Middle', 'Zebra']);
    });

    it('sets and updates folder metadata', async () => {
      await service.setFolderMetadata({
        folderName: 'Test',
        icon: '📁',
      });

      await service.updateFolderMetadata('Test', { color: '#FF0000' });

      const metadata = await service.getFolderMetadata('Test');
      expect(metadata).toEqual({
        folderName: 'Test',
        icon: '📁',
        color: '#FF0000',
      });
    });

    it('deletes folder metadata', async () => {
      await service.setFolderMetadata({ folderName: 'Test', icon: '📁' });
      
      let metadata = await service.getFolderMetadata('Test');
      expect(metadata).not.toBeNull();

      await service.deleteFolderMetadata('Test');

      metadata = await service.getFolderMetadata('Test');
      expect(metadata).toBeNull();
    });

    it('is idempotent - concurrent folder loads resolve once', async () => {
      const folderData = { 'Test': { folderName: 'Test' } };
      await AsyncStorage.setItem('@folder_metadata', JSON.stringify(folderData));

      const getItemSpy = jest.spyOn(AsyncStorage, 'getItem');

      await Promise.all([
        service.loadFolders(),
        service.loadFolders(),
        service.loadFolders(),
      ]);

      // Should only call getItem once (for folder metadata key)
      const folderCalls = getItemSpy.mock.calls.filter(
        call => call[0] === '@folder_metadata'
      );
      expect(folderCalls).toHaveLength(1);
    });
  });

  describe('AI hints settings', () => {
    it('returns default settings when no metadata exists', async () => {
      const settings = await service.getAiHintsSettings('deck1');

      expect(settings).toEqual({
        enabled: false,
        iconFront: 'bulb-outline',
        iconBack: 'sparkles-outline',
      });
    });

    it('returns custom settings when metadata exists', async () => {
      await service.setMetadata({
        deckId: 'deck1',
        aiHintsEnabled: true,
        aiHintsIconFront: 'custom-front',
        aiHintsIconBack: 'custom-back',
      });

      const settings = await service.getAiHintsSettings('deck1');

      expect(settings).toEqual({
        enabled: true,
        iconFront: 'custom-front',
        iconBack: 'custom-back',
      });
    });

    it('sets AI hints enabled', async () => {
      await service.setAiHintsEnabled('deck1', true);

      const settings = await service.getAiHintsSettings('deck1');
      expect(settings.enabled).toBe(true);

      await service.setAiHintsEnabled('deck1', false);

      const updatedSettings = await service.getAiHintsSettings('deck1');
      expect(updatedSettings.enabled).toBe(false);
    });
  });

  describe('getAllMetadata', () => {
    it('returns empty map before load', () => {
      const allMetadata = service.getAllMetadata();
      expect(allMetadata.size).toBe(0);
    });

    it('returns all metadata after load', async () => {
      await service.setMetadata({ deckId: 'deck1', icon: '📚' });
      await service.setMetadata({ deckId: 'deck2', icon: '🎯' });

      const allMetadata = service.getAllMetadata();

      expect(allMetadata.size).toBe(2);
      expect(allMetadata.get('deck1')?.icon).toBe('📚');
      expect(allMetadata.get('deck2')?.icon).toBe('🎯');
    });
  });

  describe('getAllFolderMetadata', () => {
    it('returns empty map before load', () => {
      const allFolders = service.getAllFolderMetadata();
      expect(allFolders.size).toBe(0);
    });

    it('returns all folder metadata after load', async () => {
      await service.setFolderMetadata({ folderName: 'Folder1', icon: '📁' });
      await service.setFolderMetadata({ folderName: 'Folder2', icon: '📂' });

      const allFolders = service.getAllFolderMetadata();

      expect(allFolders.size).toBe(2);
      expect(allFolders.get('Folder1')?.icon).toBe('📁');
      expect(allFolders.get('Folder2')?.icon).toBe('📂');
    });
  });
});
