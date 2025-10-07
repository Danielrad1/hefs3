import { useRef, useState } from 'react';
import { Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { ApkgParser } from '../../../services/anki/ApkgParser';
import { MediaService } from '../../../services/anki/MediaService';
import { db } from '../../../services/anki/InMemoryDb';
import { PersistenceService } from '../../../services/anki/PersistenceService';

export function useDeckImport(onComplete: () => void, onCancel?: () => void) {
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<string>('');
  const cancelRef = useRef(false);

  const handleImportDeck = async () => {
    // Snapshot for rollback on error or cancellation
    let dbSnapshot: string | null = null;
    
    try {
      // Small delay to let any modal close animation complete before opening picker
      await new Promise(resolve => setTimeout(resolve, 300));

      // Let user pick an .apkg file
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/octet-stream', // .apkg files
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets[0];
      
      // Validate file extension
      if (!file.name.endsWith('.apkg')) {
        Alert.alert('Invalid File', 'Please select an Anki deck file (.apkg)');
        return;
      }

      // Check file size and warn about large files
      const fileInfo = await FileSystem.getInfoAsync(file.uri);
      const fileSizeMB = (fileInfo.exists && !fileInfo.isDirectory && (fileInfo as any).size) 
        ? (fileInfo as any).size / (1024 * 1024) 
        : 0;
      
      // Warn about very large files
      if (fileSizeMB > 200) {
        const proceed = await new Promise<boolean>((resolve) => {
          Alert.alert(
            'Very Large Deck',
            `This deck is ${fileSizeMB.toFixed(0)}MB. Import may take 10-15 minutes and use significant memory.\n\nFor faster imports, consider splitting this deck into smaller decks in Anki desktop (recommended: <100MB each).\n\nContinue anyway?`,
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Import Anyway', onPress: () => resolve(true) }
            ]
          );
        });
        if (!proceed) return;
      } else if (fileSizeMB > 100) {
        const proceed = await new Promise<boolean>((resolve) => {
          Alert.alert(
            'Large Deck',
            `This deck is ${fileSizeMB.toFixed(0)}MB. Import may take several minutes.\n\nContinue?`,
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Continue', onPress: () => resolve(true) }
            ]
          );
        });
        if (!proceed) return;
      }

      // Now show progress modal after file is selected
      cancelRef.current = false;
      setImporting(true);
      setImportProgress('Reading file...');
      
      // **CREATE SNAPSHOT BEFORE IMPORT** for safe rollback
      console.log('[DeckImport] Creating database snapshot before import...');
      dbSnapshot = db.toJSON();
      console.log('[DeckImport] Snapshot created successfully');
      
      if (fileSizeMB > 100) {
        setImportProgress(`Reading large file (${fileSizeMB.toFixed(1)}MB)...`);
      } else if (fileSizeMB > 50) {
        setImportProgress(`Reading file (${fileSizeMB.toFixed(1)}MB)...`);
      }
      
      // Parse .apkg with streaming fallback for large files
      const parser = new ApkgParser();
      const parsed = await parser.parse(file.uri, {
        enableStreaming: true,
        onProgress: (msg) => {
          if (cancelRef.current) {
            throw new Error('Import cancelled by user');
          }
          if (typeof msg === 'string' && msg.length > 0) {
            setImportProgress(msg);
          }
        },
      });
      
      if (cancelRef.current) return;
      
      const updateProgress = (msg: string) => {
        if (cancelRef.current) throw new Error('Import cancelled by user');
        setImportProgress(msg);
      };
      
      // Import models from collection
      console.log('[DeckImport] Importing models...');
      if (parsed.col.models) {
        const modelsObj = typeof parsed.col.models === 'string' 
          ? JSON.parse(parsed.col.models) 
          : parsed.col.models;
        const modelsArr = Object.values(modelsObj);
        for (let i = 0; i < modelsArr.length; i++) {
          const model: any = modelsArr[i];
          db.addModel(model);
          if (i % 5 === 0) {
            updateProgress(`Importing models… (${i + 1}/${modelsArr.length})`);
            await new Promise((r) => setTimeout(r, 0));
          }
        }
      }

      // Import deck configs
      console.log('[DeckImport] Importing deck configs...');
      if (parsed.deckConfigs && parsed.deckConfigs.size > 0) {
        const confs = Array.from(parsed.deckConfigs.values());
        for (let i = 0; i < confs.length; i++) {
          db.addDeckConfig(confs[i]);
          if (i % 10 === 0) {
            updateProgress(`Importing deck configs… (${i + 1}/${confs.length})`);
            await new Promise((r) => setTimeout(r, 0));
          }
        }
      }

      // Import decks (chunked)
      console.log('[DeckImport] Importing', parsed.decks.size, 'decks:');
      const decksArr = Array.from(parsed.decks.values());
      for (let i = 0; i < decksArr.length; i++) {
        db.addDeck(decksArr[i]);
        if (i % 10 === 0) {
          updateProgress(`Importing decks… (${i + 1}/${decksArr.length})`);
          await new Promise((r) => setTimeout(r, 0));
        }
      }

      // Import notes (chunked)
      console.log('[DeckImport] Importing', parsed.notes.length, 'notes');
      const NOTES_BATCH = 500;
      for (let i = 0; i < parsed.notes.length; i += NOTES_BATCH) {
        const batch = parsed.notes.slice(i, i + NOTES_BATCH);
        batch.forEach((n) => db.addNote(n));
        updateProgress(`Importing notes… (${Math.min(i + NOTES_BATCH, parsed.notes.length)}/${parsed.notes.length})`);
        await new Promise((r) => setTimeout(r, 0));
      }

      // Import cards (chunked)
      console.log('[DeckImport] Importing', parsed.cards.length, 'cards');
      const CARDS_BATCH = 1000;
      for (let i = 0; i < parsed.cards.length; i += CARDS_BATCH) {
        const batch = parsed.cards.slice(i, i + CARDS_BATCH);
        batch.forEach((c) => db.addCard(c));
        updateProgress(`Importing cards… (${Math.min(i + CARDS_BATCH, parsed.cards.length)}/${parsed.cards.length})`);
        await new Promise((r) => setTimeout(r, 0));
      }

      // Register media files in database
      console.log('[DeckImport] Registering', parsed.mediaFiles.size, 'media files in DB...');
      const mediaService = new MediaService(db);
      const mediaEntries = Array.from(parsed.mediaFiles.entries());
      for (let i = 0; i < mediaEntries.length; i++) {
        if (cancelRef.current) throw new Error('Import cancelled by user');
        
        const [mediaId, filename] = mediaEntries[i];
        try {
          const media = await mediaService.registerExistingMedia(filename);
          if (media && __DEV__) {
            console.log('[DeckImport] - Registered media:', filename);
          } else if (!media) {
            console.warn('[DeckImport] - Could not register media:', filename);
          }
        } catch (error) {
          console.error('[DeckImport] Error registering media:', filename, error);
        }
        
        // Update progress every 10 files
        if (i % 10 === 0 || i === mediaEntries.length - 1) {
          updateProgress(`Registering media… (${i + 1}/${mediaEntries.length})`);
          await new Promise((r) => setTimeout(r, 0));
        }
      }
      
      // Verify what's in the database after import
      const allDecks = db.getAllDecks();
      console.log('[DeckImport] After import, database has', allDecks.length, 'decks:');
      allDecks.forEach(d => {
        const deckCards = db.getCardsByDeck(d.id);
        console.log('[DeckImport] -', d.name, ':', deckCards.length, 'cards');
      });

      updateProgress('Saving...');
      
      // Save database to persistent storage
      await PersistenceService.save(db);
      
      setImportProgress('Complete!');
      
      // Notify parent component
      onComplete();
      
      setImporting(false);
      setImportProgress('');
      
      Alert.alert(
        'Import Successful',
        `Imported ${parsed.cards.length} cards from ${parsed.decks.size} deck(s)`,
        [{ text: 'OK' }]
      );

    } catch (error) {
      console.error('[DeckImport] Import error:', error);
      
      // Reset loading state first
      setImporting(false);
      setImportProgress('');
      
      // Handle cancellation - rollback imported data using snapshot
      if (error instanceof Error && error.message.includes('cancelled')) {
        console.log('[DeckImport] Import cancelled, rolling back to snapshot...');
        
        // Restore database from snapshot
        try {
          if (dbSnapshot) {
            console.log('[DeckImport] Restoring database from snapshot...');
            db.fromJSON(dbSnapshot);
            await PersistenceService.save(db);
            console.log('[DeckImport] Rollback complete - database restored to pre-import state');
          } else {
            console.warn('[DeckImport] No snapshot available, cannot rollback');
          }
          
          // Notify parent to refresh UI
          if (onCancel) {
            onCancel();
          }
        } catch (rollbackError) {
          console.error('[DeckImport] Rollback failed:', rollbackError);
          Alert.alert(
            'Rollback Failed',
            'Could not restore database to previous state. Please restart the app.',
            [{ text: 'OK' }]
          );
        }
        
        return; // Silent return, user cancelled
      }
      
      // Provide user-friendly error messages
      let errorMessage = 'Unknown error occurred';
      if (error instanceof Error) {
        if (
          error.message.includes('String length') ||
          error.message.toLowerCase().includes('string length limit') ||
          error.message.toLowerCase().includes('too large') ||
          error.message.includes('memory limits')
        ) {
          errorMessage = 'File is too large for this device to process. The file exceeds available memory. Try importing on a device with more RAM, or split the deck into smaller files.';
        } else if (error.message.includes('No collection file found')) {
          errorMessage = 'Invalid Anki deck file. The selected file does not contain a valid Anki collection.';
        } else if (error.message.includes('Failed to read file')) {
          errorMessage = 'Could not read the selected file. Please make sure the file is not corrupted and try again.';
        } else if (error.message.includes('HTTP') || error.message.includes('fetch')) {
          errorMessage = 'Could not access the file. Please try selecting the file again or restart the app.';
        } else {
          errorMessage = error.message;
        }
      }
      
      Alert.alert(
        'Import Failed', 
        errorMessage,
        [{ text: 'OK' }]
      );
    } finally {
      // Ensure spinner always stops
      setImporting(false);
      setImportProgress('');
    }
  };
  
  const cancelImport = () => {
    cancelRef.current = true;
    setImporting(false);
    setImportProgress('');
  };

  return {
    importing,
    importProgress,
    handleImportDeck,
    cancelImport,
  };
}
