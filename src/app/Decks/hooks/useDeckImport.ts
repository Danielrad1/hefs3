import { useRef, useState } from 'react';
import { Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { ApkgParser } from '../../../services/anki/ApkgParser';
import { MediaService } from '../../../services/anki/MediaService';
import { NoteService } from '../../../services/anki/NoteService';
import { db } from '../../../services/anki/InMemoryDb';
import { PersistenceService } from '../../../services/anki/PersistenceService';
import { MODEL_TYPE_IMAGE_OCCLUSION } from '../../../services/anki/schema';
import { logger } from '../../../utils/logger';

export function useDeckImport(onComplete: () => void, onCancel?: () => void) {
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<string>('');
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [pendingImport, setPendingImport] = useState<{
    fileUri: string;
    fileName: string;
    hasProgress: boolean;
    progressStats?: { reviewedCards: number; totalCards: number };
  } | null>(null);
  const cancelRef = useRef(false);

  const handleImportDeck = async () => {
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

      // START LOADING IMMEDIATELY - show feedback right away
      setImporting(true);
      setImportProgress('Analyzing deck...');

      // Quick parse to check for progress data
      const parser = new ApkgParser();
      const parsed = await parser.parse(file.uri, {
        enableStreaming: true,
        onProgress: (msg) => {
          // Show progress during analysis phase too
          if (typeof msg === 'string' && msg.length > 0) {
            setImportProgress(msg);
          }
        },
      });

      // Check if deck has progress
      const hasProgress = parsed.revlog && parsed.revlog.length > 0;
      const reviewedCards = hasProgress 
        ? new Set(parsed.revlog.map(r => r.cid)).size 
        : 0;

      if (hasProgress) {
        // Hide loading, show options modal
        setImporting(false);
        setImportProgress('');
        setPendingImport({
          fileUri: file.uri,
          fileName: file.name,
          hasProgress: true,
          progressStats: {
            reviewedCards,
            totalCards: parsed.cards.length,
          },
        });
        setShowOptionsModal(true);
      } else {
        // No progress, import directly (keep loading active)
        await performImport(file.uri, file.name, false);
      }
    } catch (error: any) {
      logger.error('[DeckImport] Import error:', error);
      setImporting(false);
      setImportProgress('');
      Alert.alert('Import Failed', 'Unable to import deck. Please try again.');
    }
  };

  const performImport = async (fileUri: string, fileName: string, preserveProgress: boolean) => {
    // Snapshot for rollback on error or cancellation
    let dbSnapshot: string | null = null;
    
    try {
      setShowOptionsModal(false);
      setPendingImport(null);
      
      // Now show progress modal
      cancelRef.current = false;
      setImporting(true);
      setImportProgress('Reading file...');
      
      // **CREATE SNAPSHOT BEFORE IMPORT** for safe rollback
      logger.info('[DeckImport] Creating database snapshot before import...');
      dbSnapshot = db.toJSON();
      logger.info('[DeckImport] Snapshot created successfully');
      
      // Parse .apkg with streaming fallback for large files
      const parser = new ApkgParser();
      const parsed = await parser.parse(fileUri, {
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
      logger.info('[DeckImport] Importing models...');
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
      logger.info('[DeckImport] Importing deck configs...');
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
      logger.info('[DeckImport] Importing', parsed.decks.size, 'decks:');
      const decksArr = Array.from(parsed.decks.values());
      for (let i = 0; i < decksArr.length; i++) {
        db.addDeck(decksArr[i]);
        if (i % 10 === 0) {
          updateProgress(`Importing decks… (${i + 1}/${decksArr.length})`);
          await new Promise((r) => setTimeout(r, 0));
        }
      }

      // Import notes (chunked)
      logger.info('[DeckImport] Importing', parsed.notes.length, 'notes');
      const NOTES_BATCH = 500;
      for (let i = 0; i < parsed.notes.length; i += NOTES_BATCH) {
        const batch = parsed.notes.slice(i, i + NOTES_BATCH);
        batch.forEach((n) => db.addNote(n));
        updateProgress(`Importing notes… (${Math.min(i + NOTES_BATCH, parsed.notes.length)}/${parsed.notes.length})`);
        await new Promise((r) => setTimeout(r, 0));
      }

      // Import cards (chunked)
      logger.info('[DeckImport] Importing', parsed.cards.length, 'cards');
      const CARDS_BATCH = 1000;
      for (let i = 0; i < parsed.cards.length; i += CARDS_BATCH) {
        const batch = parsed.cards.slice(i, i + CARDS_BATCH);
        batch.forEach((c) => db.addCard(c));
        updateProgress(`Importing cards… (${Math.min(i + CARDS_BATCH, parsed.cards.length)}/${parsed.cards.length})`);
        await new Promise((r) => setTimeout(r, 0));
      }

      // Convert Image Occlusion notes from Anki format
      updateProgress('Converting Image Occlusion notes...');
      await convertImageOcclusionNotes(updateProgress, preserveProgress);

      // Register media files in database (batch processing for performance)
      logger.info('[DeckImport] Registering', parsed.mediaFiles.size, 'media files in DB...');
      const mediaService = new MediaService(db);
      const filenames = Array.from(parsed.mediaFiles.values());
      
      if (filenames.length > 0) {
        await mediaService.batchRegisterExistingMedia(filenames, (current, total) => {
          if (cancelRef.current) throw new Error('Import cancelled by user');
          updateProgress(`Registering media… (${current}/${total})`);
        });
        logger.info('[DeckImport] Registered', filenames.length, 'media files');
      }

      // Import review history if preserving progress
      if (preserveProgress && parsed.revlog && parsed.revlog.length > 0) {
        logger.info('[DeckImport] Importing', parsed.revlog.length, 'review history entries');
        updateProgress(`Importing progress… (${parsed.revlog.length} reviews)`);
        parsed.revlog.forEach((entry) => db.addRevlog(entry));
        logger.info('[DeckImport] Progress imported successfully');
      }
      
      // Verify what's in the database after import
      const allDecks = db.getAllDecks();
      logger.info('[DeckImport] After import, database has', allDecks.length, 'decks:');
      allDecks.forEach(d => {
        const deckCards = db.getCardsByDeck(d.id);
        logger.info('[DeckImport] -', d.name, ':', deckCards.length, 'cards');
      });

      updateProgress('Saving...');
      
      // Save database to persistent storage
      await PersistenceService.save(db);
      
      setImportProgress('Complete!');
      
      // Notify parent component
      onComplete();
      
      setImporting(false);
      setImportProgress('');
      
      const progressMsg = preserveProgress && parsed.revlog.length > 0
        ? ` with ${parsed.revlog.length} reviews`
        : '';
      
      Alert.alert(
        'Import Successful',
        `Imported ${parsed.cards.length} cards from ${parsed.decks.size} deck(s)${progressMsg}`,
        [{ text: 'OK' }]
      );

    } catch (error) {
      logger.error('[DeckImport] Import error:', error);
      
      // Reset loading state first
      setImporting(false);
      setImportProgress('');
      
      // Handle cancellation - rollback imported data using snapshot
      if (error instanceof Error && error.message.includes('cancelled')) {
        logger.info('[DeckImport] Import cancelled, rolling back to snapshot...');
        
        // Restore database from snapshot
        try {
          if (dbSnapshot) {
            logger.info('[DeckImport] Restoring database from snapshot...');
            db.fromJSON(dbSnapshot);
            await PersistenceService.save(db);
            logger.info('[DeckImport] Rollback complete - database restored to pre-import state');
          } else {
            logger.warn('[DeckImport] No snapshot available, cannot rollback');
          }
          
          // Notify parent to refresh UI
          if (onCancel) {
            onCancel();
          }
        } catch (rollbackError) {
          logger.error('[DeckImport] Rollback failed:', rollbackError);
          Alert.alert(
            'Import Error',
            'Please restart the app to continue.',
            [{ text: 'OK' }]
          );
        }
        
        return; // Silent return, user cancelled
      }
      
      // Provide graceful user-friendly error messages without technical details
      let errorMessage = 'Unable to import deck. Please try again.';
      if (error instanceof Error) {
        if (
          error.message.includes('String length') ||
          error.message.toLowerCase().includes('string length limit') ||
          error.message.toLowerCase().includes('too large') ||
          error.message.includes('memory limits')
        ) {
          errorMessage = 'This deck is too large to import on your device. Try splitting it into smaller decks.';
        } else if (error.message.includes('No collection file found')) {
          errorMessage = 'This file doesn\'t appear to be a valid Anki deck. Please check the file and try again.';
        } else if (error.message.includes('Failed to read file')) {
          errorMessage = 'Unable to read the file. Please try selecting it again.';
        } else if (error.message.includes('HTTP') || error.message.includes('fetch')) {
          errorMessage = 'Unable to access the file. Please try again.';
        }
        // Don't expose technical error messages to users
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

  /**
   * Convert Image Occlusion notes from Anki format to our internal format
   */
  const convertImageOcclusionNotes = async (
    updateProgress: (msg: string) => void,
    preserveProgress: boolean
  ) => {
    const noteService = new NoteService(db);
    
    // Find all IO models (check for Anki IO Enhanced naming patterns)
    const allModels = db.getAllModels();
    const ioModels = allModels.filter(m => 
      m.name.toLowerCase().includes('image occlusion') ||
      m.name.toLowerCase().includes('io')
    );

    if (ioModels.length === 0) {
      logger.info('[DeckImport] No Image Occlusion models detected');
      return;
    }

    logger.info('[DeckImport] Found', ioModels.length, 'IO model(s):', ioModels.map(m => m.name).join(', '));

    let convertedCount = 0;
    let errorCount = 0;

    // Process each IO model
    for (const ioModel of ioModels) {
      const notes = db.getAllNotes().filter(n => n.mid === ioModel.id);
      
      if (notes.length === 0) continue;

      logger.info('[DeckImport] Converting', notes.length, 'notes from model:', ioModel.name);
      
      for (let i = 0; i < notes.length; i++) {
        const note = notes[i];
        
        try {
          // Parse fields - Anki IO Enhanced typically has: Image, Header, Back Extra, Notes, Masks
          const fields = note.flds.split('\x1f');
          const imageField = fields[0] || '';
          
          // Extract image filename from field (may contain HTML)
          const imageMatch = imageField.match(/src=["']([^"']+)["']/);
          const imageFilename = imageMatch ? imageMatch[1] : imageField.trim();
          
          // Try to parse masks from various field positions
          let masks: any[] = [];
          let extra = '';
          
          // Look for JSON mask data in fields
          for (let fieldIdx = 0; fieldIdx < fields.length; fieldIdx++) {
            const field = fields[fieldIdx];
            
            // Try parsing as JSON
            if (field.includes('[') && field.includes(']')) {
              try {
                const parsed = JSON.parse(field);
                if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].x !== undefined) {
                  masks = parsed;
                  break;
                }
              } catch (e) {
                // Not JSON, continue
              }
            }
            
            // Check for SVG-based masks (older format)
            if (field.includes('<rect') || field.includes('<svg')) {
              masks = parseSVGMasks(field);
              if (masks.length > 0) break;
            }
          }
          
          // If no masks found, try to extract from note tags or guess 1 mask
          if (masks.length === 0) {
            logger.warn('[DeckImport] No masks found for note', note.id, '- creating default mask');
            masks = [{ id: 'm1', x: 0.3, y: 0.3, w: 0.4, h: 0.4 }];
          }
          
          // Get extra field (typically field index 2 or 3)
          extra = fields[2] || fields[1] || '';
          
          // Create our internal IO data structure
          const ioData = {
            io: {
              version: 1,
              image: imageFilename,
              mode: 'hide-one' as const, // Default to hide-one
              masks: masks.map((m, idx) => ({
                id: m.id || `m${idx + 1}`,
                x: typeof m.x === 'number' ? m.x : 0.3,
                y: typeof m.y === 'number' ? m.y : 0.3,
                w: typeof m.w === 'number' ? m.w : 0.4,
                h: typeof m.h === 'number' ? m.h : 0.4,
              })),
            },
          };
          
          // Map to our IO model (ID: 3)
          note.mid = 3; // Our Image Occlusion model
          note.flds = [imageFilename, extra].join('\x1f');
          note.data = JSON.stringify(ioData);
          
          // Update note in DB
          db.updateNote(note.id, {
            mid: 3,
            flds: note.flds,
            data: note.data,
          });
          
          // Delete old cards and regenerate
          const oldCards = db.getAllCards().filter(c => c.nid === note.id);
          oldCards.forEach(c => db.deleteCard(c.id));
          
          // Regenerate cards for our model
          noteService.updateNote(note.id, {
            fields: [imageFilename, extra],
          });
          
          convertedCount++;
          
          if (i % 10 === 0) {
            updateProgress(`Converting IO notes… (${i + 1}/${notes.length})`);
            await new Promise((r) => setTimeout(r, 0));
          }
        } catch (error) {
          errorCount++;
          logger.error('[DeckImport] Failed to convert IO note', note.id, error);
          // Continue with other notes
        }
      }
    }
    
    if (convertedCount > 0) {
      logger.info('[DeckImport] Converted', convertedCount, 'IO notes successfully' + (errorCount > 0 ? `, ${errorCount} failed` : ''));
    }
  };

  /**
   * Parse SVG-based masks from older Anki IO format
   */
  const parseSVGMasks = (svgContent: string): any[] => {
    const masks: any[] = [];
    
    // Extract viewBox to get dimensions
    const viewBoxMatch = svgContent.match(/viewBox=["']([^"']+)["']/);
    let viewBoxWidth = 100;
    let viewBoxHeight = 100;
    
    if (viewBoxMatch) {
      const parts = viewBoxMatch[1].split(/\s+/);
      if (parts.length >= 4) {
        viewBoxWidth = parseFloat(parts[2]);
        viewBoxHeight = parseFloat(parts[3]);
      }
    }
    
    // Extract rect elements
    const rectRegex = /<rect[^>]*>/g;
    let match;
    let maskIdx = 0;
    
    while ((match = rectRegex.exec(svgContent)) !== null) {
      const rectTag = match[0];
      
      // Extract attributes
      const xMatch = rectTag.match(/x=["']([^"']+)["']/);
      const yMatch = rectTag.match(/y=["']([^"']+)["']/);
      const widthMatch = rectTag.match(/width=["']([^"']+)["']/);
      const heightMatch = rectTag.match(/height=["']([^"']+)["']/);
      
      if (xMatch && yMatch && widthMatch && heightMatch) {
        const x = parseFloat(xMatch[1]);
        const y = parseFloat(yMatch[1]);
        const w = parseFloat(widthMatch[1]);
        const h = parseFloat(heightMatch[1]);
        
        // Normalize to 0-1 range
        masks.push({
          id: `m${++maskIdx}`,
          x: x / viewBoxWidth,
          y: y / viewBoxHeight,
          w: w / viewBoxWidth,
          h: h / viewBoxHeight,
        });
      }
    }
    
    return masks;
  };

  return {
    importing,
    importProgress,
    handleImportDeck,
    cancelImport,
    showOptionsModal,
    pendingImport,
    onImportWithProgress: () => pendingImport && performImport(pendingImport.fileUri, pendingImport.fileName, true),
    onImportFresh: () => pendingImport && performImport(pendingImport.fileUri, pendingImport.fileName, false),
    onCancelOptions: () => {
      setShowOptionsModal(false);
      setPendingImport(null);
    },
  };
}
