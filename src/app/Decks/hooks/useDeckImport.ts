import { useRef, useState } from 'react';
import { Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { ApkgParser } from '../../../services/anki/ApkgParser';
import { MediaService } from '../../../services/anki/MediaService';
import { NoteService } from '../../../services/anki/NoteService';
import { db } from '../../../services/anki/InMemoryDb';
import { PersistenceService } from '../../../services/anki/PersistenceService';
import { MODEL_TYPE_IMAGE_OCCLUSION, AnkiNote } from '../../../services/anki/schema';
import { generateId } from '../../../services/anki/time';
import { logger } from '../../../utils/logger';
import { MEDIA_DIR, sanitizeMediaFilename } from '../../../utils/mediaHelpers';

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
          
          // Detect and mark Image Occlusion models
          const modelName = model.name?.toLowerCase() || '';
          if (modelName.includes('image occlusion') || modelName.includes('io')) {
            model.type = 2; // MODEL_TYPE_IMAGE_OCCLUSION
            logger.info('[DeckImport] Detected IO model:', model.name, '(id:', model.id, ')');
          }
          
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

      // Convert Image Occlusion notes from Anki format (only from this import)
      updateProgress('Converting Image Occlusion notes...');
      await convertImageOcclusionNotes(updateProgress, preserveProgress, parsed.notes);

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
   * Only processes notes from the current import, not all notes in database
   */
  const convertImageOcclusionNotes = async (
    updateProgress: (msg: string) => void,
    preserveProgress: boolean,
    importedNotes: AnkiNote[]
  ) => {
    const noteService = new NoteService(db);

    const truncate = (value: string, max: number = 120) =>
      value.length > max ? `${value.slice(0, max)}…` : value;
    
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

    logger.info(
      '[DeckImport] Found',
      ioModels.length,
      'IO model(s):',
      ioModels.map(m => `${m.id}:${m.name}`).join(', '),
    );

    let convertedCount = 0;
    let errorCount = 0;

    // Process each IO model - ONLY notes from this import
    for (const ioModel of ioModels) {
      // Filter to only notes from this import that match this IO model
      const notes = importedNotes.filter(n => Number(n.mid) === Number(ioModel.id));
      
      if (notes.length === 0) {
        logger.warn('[DeckImport][IO] No notes found for model', ioModel.id, ioModel.name);
        continue;
      }

      logger.info('[DeckImport] Converting', notes.length, 'notes from model:', `${ioModel.id}:${ioModel.name}`);
      
      // Detect IO mode from model template names
      const templateNames = ioModel.tmpls.map(t => t.name.toLowerCase()).join(' ');
      const isHideAll = templateNames.includes('hide all') || templateNames.includes('hideall');
      const detectedMode = isHideAll ? 'hide-all' : 'hide-one';
      logger.info('[DeckImport][IO] Detected mode from templates:', detectedMode);
      
      for (let i = 0; i < notes.length; i++) {
        const note = notes[i];
        
        try {
          // Parse fields - Anki IO Enhanced typically has: Image, Header, Back Extra, Notes, Masks
          const fields = note.flds.split('\x1f');
          logger.debug('[DeckImport][IO] Raw fields for note', note.id, fields.map((field, idx) => `[#${idx}] ${truncate(field)}`));

          // Search for image across all fields (field[2] usually has the actual image)
          let imageField = '';
          let rawImageFilename = '';
          
          for (const field of fields) {
            const match = field.match(/src=["']([^"']+\.(?:png|jpg|jpeg|gif|svg|webp))["']/i);
            if (match) {
              imageField = field;
              rawImageFilename = match[1];
              break;
            }
          }
          
          // Fallback to field[0] if no image found
          if (!rawImageFilename) {
            imageField = fields[0] || '';
            const imageMatch = imageField.match(/src=["']([^"']+)["']/);
            rawImageFilename = imageMatch ? imageMatch[1] : imageField.trim();
          }
          
          const sanitizedImageFilename = sanitizeMediaFilename(rawImageFilename.replace(/^media:/i, '').trim());

          logger.debug('[DeckImport][IO] Note', note.id, 'image field extracted', {
            rawImageField: truncate(imageField),
            rawImageFilename,
            sanitizedImageFilename,
          });

          if (!sanitizedImageFilename) {
            logger.error('[DeckImport][IO] Unable to determine image filename for note', note.id, 'raw value:', rawImageFilename);
            continue;
          }

          const mediaRecord = db.getMediaByFilename(sanitizedImageFilename);
          if (!mediaRecord) {
            logger.warn('[DeckImport][IO] Media not found for note', note.id, 'filename:', sanitizedImageFilename || '(empty)');
          } else {
            logger.debug('[DeckImport][IO] Media found for note', note.id, mediaRecord.filename, 'size:', mediaRecord.size);
          }
          
          // Try to parse masks from various field positions
          let masks: any[] = [];
          let maskSource: string | null = null;
          let extra = '';
          let detectedIsHideAll = false; // From cloze parsing
          const svgFilenames = new Set<string>();
          
          // Look for mask data in fields
          for (let fieldIdx = 0; fieldIdx < fields.length; fieldIdx++) {
            const field = fields[fieldIdx];
            
            // Try parsing cloze-based masks (Anki 2.1.50+ format)
            // Format: {{c1::image-occlusion:rect:left=.2704:top=.4914:width=.1938:height=.0245:oi=1}}
            if (field.includes('image-occlusion:rect:')) {
              const result = parseClozeBasedMasks(field, note.id, fieldIdx);
              if (result.masks.length > 0) {
                masks = result.masks;
                detectedIsHideAll = result.isHideAll;
                maskSource = `cloze-field-${fieldIdx}`;
                break;
              }
            }
            
            // Try parsing as JSON
            if (field.includes('[') && field.includes(']')) {
              try {
                const parsed = JSON.parse(field);
                if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].x !== undefined) {
                  masks = parsed;
                  maskSource = `json-field-${fieldIdx}`;
                  break;
                }
              } catch (e) {
                logger.debug('[DeckImport][IO] JSON parse failed for note', note.id, 'field', fieldIdx, e);
              }
            }
            
            // Check for SVG-based masks (older format)
            if (field.includes('<rect') || field.includes('<svg')) {
              const svgMasks = parseSVGMasks(field, note.id, fieldIdx);
              if (svgMasks.length > 0) {
                masks = svgMasks;
                maskSource = `svg-field-${fieldIdx}`;
                break;
              }
            }

            // Collect referenced SVG media files (e.g., <img src="mask.svg">)
            const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
            let imgMatch;
            while ((imgMatch = imgRegex.exec(field)) !== null) {
              const srcValue = imgMatch[1];
              if (srcValue && srcValue.trim().toLowerCase().endsWith('.svg')) {
                svgFilenames.add(srcValue.trim());
              }
            }
          }

          // Detect hide-all mode from SVG filename pattern
          // Files ending with -O.svg = "Occlude all" = hide-all mode
          const hasOccludeAllSvg = Array.from(svgFilenames).some(name => 
            name.toLowerCase().includes('-o.svg') || name.toLowerCase().includes('-occlude.svg')
          );
          if (hasOccludeAllSvg) {
            detectedIsHideAll = true;
          }

          // Attempt to load masks from SVG media files when not embedded directly
          if (masks.length === 0 && svgFilenames.size > 0) {
            // OLD ANKI IO FORMAT (hide-all mode):
            // - ao-O.svg = ALL possible mask positions (39 total, shown as yellow/faint)
            // - ao-X-Q.svg = TARGET masks for this specific card (e.g., 5-11 masks, shown as red/highlighted)
            // - We need BOTH: all positions from -O.svg, target indices from -Q.svg
            
            // Extract note identifier from first field (e.g., "ao-1" from "c8bf...ao-1")
            const firstField = fields[0] || '';
            const noteIdMatch = firstField.match(/-ao-(\d+)/i);
            const noteNumber = noteIdMatch ? noteIdMatch[1] : null;
            
            // Step 1: Parse -O.svg to get ALL mask positions and SVG dimensions
            let allMasks: any[] = [];
            let svgRefDimensions: { w: number; h: number } | null = null;
            const oSvgFile = Array.from(svgFilenames).find(name => 
              name.toLowerCase().includes('-o.svg')
            );
            
            if (oSvgFile) {
              const normalizedOName = sanitizeMediaFilename(oSvgFile.replace(/^media:/i, '').trim());
              const encodedOName = encodeURIComponent(normalizedOName);
              const oSvgPath = `${MEDIA_DIR}${encodedOName}`;
              
              try {
                const oSvgContent = await FileSystem.readAsStringAsync(oSvgPath);
                allMasks = parseSVGMasks(oSvgContent, note.id, undefined, normalizedOName);
                
                // Extract SVG dimensions while we have the content
                const svgMatch = oSvgContent.match(/<svg[^>]*>/);
                if (svgMatch) {
                  const svgTag = svgMatch[0];
                  const widthMatch = svgTag.match(/width=["']([^"']+)["']/);
                  const heightMatch = svgTag.match(/height=["']([^"']+)["']/);
                  
                  if (widthMatch && heightMatch) {
                    svgRefDimensions = {
                      w: parseFloat(widthMatch[1]),
                      h: parseFloat(heightMatch[1])
                    };
                  } else {
                    const viewBoxMatch = svgTag.match(/viewBox=["']([^"']+)["']/);
                    if (viewBoxMatch) {
                      const parts = viewBoxMatch[1].split(/\s+/);
                      if (parts.length >= 4) {
                        svgRefDimensions = {
                          w: parseFloat(parts[2]),
                          h: parseFloat(parts[3])
                        };
                      }
                    }
                  }
                }
                
                logger.info('[DeckImport][IO] ===== OLD-STYLE PARSING =====');
                logger.info('[DeckImport][IO] -O.svg file:', normalizedOName);
                logger.info('[DeckImport][IO] SVG reference dimensions:', svgRefDimensions);
                logger.info('[DeckImport][IO] Total masks from -O.svg:', allMasks.length);
                logger.info('[DeckImport][IO] First 3 masks:', allMasks.slice(0, 3));
              } catch (error) {
                logger.warn('[DeckImport][IO] Failed to parse -O.svg:', error);
              }
            }
            
            // Step 2: Derive target indices using robust priority pipeline
            // (checks Extra field, -A.svg set difference, -Q.svg style clustering, fallback)
            const { targetIndices, method } = await deriveTargetIndices(
              allMasks,
              svgFilenames,
              noteNumber,
              extra
            );
            
            logger.info('[DeckImport][IO] ===== TARGET DETECTION =====');
            logger.info('[DeckImport][IO] Method:', method);
            logger.info('[DeckImport][IO] Target indices:', targetIndices);
            logger.info('[DeckImport][IO] Targets:', targetIndices.length, 'of', allMasks.length, 'masks');
            
            // Use all masks from -O.svg as the base
            if (allMasks.length > 0) {
              masks = allMasks;
              maskSource = `svg-media-hideall (${allMasks.length} total, ${targetIndices.length} targets)`;
              
              // Store target indices AND SVG dimensions in extra field
              // Format: "targetIndices:0,5,12,...|svgDim:781x862" 
              let extraParts: string[] = [];
              if (targetIndices.length > 0) {
                extraParts.push(`targetIndices:${targetIndices.join(',')}`);
              }
              if (svgRefDimensions) {
                extraParts.push(`svgDim:${svgRefDimensions.w}x${svgRefDimensions.h}`);
              }
              extra = extraParts.join('|');
              
              logger.info('[DeckImport][IO] ===== FINAL DATA =====');
              logger.info('[DeckImport][IO] Using', allMasks.length, 'masks from -O.svg');
              logger.info('[DeckImport][IO] Target indices:', targetIndices);
              logger.info('[DeckImport][IO] SVG dimensions:', svgRefDimensions);
              logger.info('[DeckImport][IO] Extra field:', extra);
            }
          }
          
          // If no masks found, try to extract from note tags or guess 1 mask
          if (masks.length === 0) {
            logger.warn('[DeckImport][IO] No masks found for note', note.id, '- creating default mask');
            masks = [{ id: 'm1', x: 0.3, y: 0.3, w: 0.4, h: 0.4 }];
            maskSource = 'default-fallback';
          }

          // Get extra field (typically field index 2 or 3)
          // ONLY read from old fields if we haven't computed new metadata
          // Strip all <img> tags since the image is in the IO data structure
          if (!extra) {
            extra = fields[2] || fields[1] || '';
            extra = extra.replace(/<img[^>]*>/gi, '').trim();
          }

          // Deduplicate masks (some decks reference both Q/A SVGs with identical rects)
          // CRITICAL: Only accept masks with finite coordinates to prevent NaN/null leaks
          const dedupedMaskMap = new Map<string, any>();
          const keyFor = (m: any) => {
            // Use 5 decimal places for matching with slight tolerance
            const round = (value: number) => value.toFixed(5);
            return `${round(m.x)}-${round(m.y)}-${round(m.w)}-${round(m.h)}`;
          };
          
          masks.forEach((mask) => {
            // Validate ALL coordinates are finite before accepting
            if (mask && 
                Number.isFinite(mask.x) && Number.isFinite(mask.y) && 
                Number.isFinite(mask.w) && Number.isFinite(mask.h)) {
              const key = keyFor(mask);
              if (!dedupedMaskMap.has(key)) {
                dedupedMaskMap.set(key, mask);
              }
            } else {
              logger.warn('[DeckImport][IO] Skipping mask with non-finite coordinates:', mask);
            }
          });

          const normalizedMasks = Array.from(dedupedMaskMap.values()).map((m, idx) => ({
            id: m.id || `m${idx + 1}`,
            x: m.x,
            y: m.y,
            w: m.w,
            h: m.h,
          }));

          if (normalizedMasks.length === 0) {
            logger.warn('[DeckImport][IO] No usable masks after parsing/dedupe for note', note.id, '- creating default mask');
            normalizedMasks.push({ id: 'm1', x: 0.3, y: 0.3, w: 0.4, h: 0.4 });
            maskSource = maskSource ? `${maskSource}-fallback` : 'dedupe-fallback';
          }

          logger.debug('[DeckImport][IO] Note', note.id, 'mask summary', {
            maskSource,
            maskCount: normalizedMasks.length,
            sampleMask: normalizedMasks[0],
            svgRefs: Array.from(svgFilenames),
          });

          // Create our internal IO data structure
          // Priority for mode detection:
          // 1. Cloze-based detection (detectedIsHideAll from parsing)
          // 2. Template-based detection (detectedMode from template names)
          // 3. Default to hide-one
          let finalMode: 'hide-one' | 'hide-all' = 'hide-one';
          if (detectedIsHideAll) {
            finalMode = 'hide-all';
          } else if (detectedMode === 'hide-all') {
            finalMode = 'hide-all';
          }
          
          // Extract target indices from extra field if present
          let targetIndices: number[] = [];
          const targetMatch = extra.match(/targetIndices:([0-9,]+)/);
          if (targetMatch) {
            targetIndices = targetMatch[1].split(',').map(n => parseInt(n, 10)).filter(n => !isNaN(n));
          }
          
          // Extract SVG reference dimensions from extra field
          let svgRefDimensions: { w: number; h: number } | undefined;
          const svgDimMatch = extra.match(/svgDim:([0-9.]+)x([0-9.]+)/);
          if (svgDimMatch) {
            svgRefDimensions = {
              w: parseFloat(svgDimMatch[1]),
              h: parseFloat(svgDimMatch[2])
            };
          }
          
          const ioData = {
            io: {
              version: 1,
              image: sanitizedImageFilename,
              mode: finalMode,
              masks: normalizedMasks,
              // Store target indices for hide-all mode
              // These indicate which masks should be highlighted as targets
              ...(targetIndices.length > 0 && { targetIndices }),
              // Store SVG reference dimensions for proper scaling
              ...(svgRefDimensions && { svgRefDimensions }),
            },
          };

          logger.info('[DeckImport][IO] ===== CREATED IODATA =====');
          logger.info('[DeckImport][IO] Note:', note.id);
          logger.info('[DeckImport][IO] Image:', sanitizedImageFilename);
          logger.info('[DeckImport][IO] Mode:', finalMode);
          logger.info('[DeckImport][IO] Total masks:', normalizedMasks.length);
          logger.info('[DeckImport][IO] Target indices:', targetIndices);
          logger.info('[DeckImport][IO] SVG ref dimensions:', svgRefDimensions);
          logger.info('[DeckImport][IO] Mask source:', maskSource);
          logger.info('[DeckImport][IO] Sample mask:', normalizedMasks[0]);

          // Keep note on its existing model - don't try to remap to Model 3
          // The imported model should already be type IMAGE_OCCLUSION
          note.flds = [sanitizedImageFilename, extra].join('\x1f');
          note.data = JSON.stringify(ioData);

          // Update note in DB (keep existing mid)
          db.updateNote(note.id, {
            flds: note.flds,
            data: note.data,
          });

          logger.debug('[DeckImport][IO] Updated note', note.id, {
            mid: note.mid,
            fields: note.flds,
            maskCount: ioData.io.masks.length,
            mode: ioData.io.mode,
          });

          // Delete old cards and regenerate
          const oldCards = db.getAllCards().filter(c => c.nid === note.id);
          const deckId = oldCards[0]?.did || db.getAllDecks()[0]?.id || '1';
          const originalCardCount = oldCards.length;
          
          oldCards.forEach(c => db.deleteCard(c.id));

          logger.debug('[DeckImport][IO] Removed', oldCards.length, 'legacy card(s) for note', note.id);

          // Regenerate cards - preserve original card count from imported deck
          // In hide-all mode: typically 1 card per note
          // In hide-one mode: 1 card per mask
          const now = Math.floor(Date.now() / 1000);
          let cardsToGenerate = originalCardCount;
          
          // Safety: If original had 0 cards, default based on mode
          if (cardsToGenerate === 0) {
            cardsToGenerate = finalMode === 'hide-all' ? 1 : normalizedMasks.length;
          }
          
          for (let cardIdx = 0; cardIdx < cardsToGenerate; cardIdx++) {
            const card: any = {
              id: generateId(),
              nid: note.id,
              did: deckId,
              ord: cardIdx,
              mod: now,
              usn: -1,
              type: 0, // CardType.New
              queue: 0, // CardQueue.New
              due: db.incrementNextPos(),
              ivl: 0,
              factor: 2500,
              reps: 0,
              lapses: 0,
              left: 0,
              odue: 0,
              odid: '0',
              flags: 0,
              data: '',
            };
            db.addCard(card);
          }

          logger.debug('[DeckImport][IO] Generated', cardsToGenerate, 'cards for note', note.id, '(original had', originalCardCount, ')');

          convertedCount++;
          
          if (i % 10 === 0) {
            updateProgress(`Converting IO notes… (${i + 1}/${notes.length})`);
            await new Promise((r) => setTimeout(r, 0));
          }
        } catch (error) {
          errorCount++;
          logger.error('[DeckImport][IO] Failed to convert note', note.id, error);
          // Continue with other notes
        }
      }
    }

    if (convertedCount > 0) {
      logger.info('[DeckImport] Converted', convertedCount, 'IO notes successfully' + (errorCount > 0 ? `, ${errorCount} failed` : ''));
    }
  };

  /**
   * Parse cloze-based masks from Anki 2.1.50+ format
   * Format: {{c1::image-occlusion:rect:left=.2704:top=.4914:width=.1938:height=.0245:oi=1}}
   * 
   * Returns: { masks: Mask[], isHideAll: boolean }
   * isHideAll is true when all masks share the same cloze number (c1, c1, c1...)
   */
  const parseClozeBasedMasks = (fieldContent: string, noteId?: string, fieldIdx?: number): { masks: any[]; isHideAll: boolean } => {
    const masks: any[] = [];
    const clozeNumbers = new Set<number>();
    
    // Match all cloze deletions with image-occlusion rect data
    const clozeRegex = /\{\{c(\d+)::image-occlusion:rect:([^}]+)\}\}/g;
    let match;
    let maskIdx = 0;
    
    while ((match = clozeRegex.exec(fieldContent)) !== null) {
      const clozeNum = parseInt(match[1], 10);
      const rectData = match[2];
      
      clozeNumbers.add(clozeNum);
      
      // Parse rect parameters
      const params: Record<string, number> = {};
      const paramPairs = rectData.split(':');
      
      for (const pair of paramPairs) {
        const [key, value] = pair.split('=');
        if (key && value) {
          params[key] = parseFloat(value);
        }
      }
      
      // Extract coordinates (already normalized 0-1)
      if (params.left !== undefined && params.top !== undefined && 
          params.width !== undefined && params.height !== undefined) {
        masks.push({
          id: `m${++maskIdx}`,
          x: params.left,
          y: params.top,
          w: params.width,
          h: params.height,
        });
      }
    }
    
    // Determine mode: if all masks share ONE cloze number, it's hide-all
    const isHideAll = clozeNumbers.size === 1 && masks.length > 1;
    
    logger.debug('[DeckImport][IO] Cloze parse result', {
      noteId,
      fieldIdx,
      maskCount: masks.length,
      uniqueClozeNumbers: clozeNumbers.size,
      isHideAll,
    });
    
    return { masks, isHideAll };
  };

  /**
   * Parse SVG-based masks from older Anki IO format with transform support
   * Returns masks with optional style information for target detection
   */
  const parseSVGMasks = (svgContent: string, noteId?: string, fieldIdx?: number, filename?: string, includeStyles = false): any[] => {
    const masks: any[] = [];
    let transformsUsed = 0;
    let skippedInvalid = 0;
    
    // Extract SVG dimensions - try width/height first, then viewBox (case-insensitive)
    const svgMatch = svgContent.match(/<svg[^>]*>/i);
    let refWidth = 100;
    let refHeight = 100;
    
    if (svgMatch) {
      const svgTag = svgMatch[0];
      
      // Try explicit width/height first (case-insensitive, handle units)
      const widthMatch = svgTag.match(/width=["']([^"']+)["']/i);
      const heightMatch = svgTag.match(/height=["']([^"']+)["']/i);
      
      if (widthMatch && heightMatch) {
        refWidth = parseFloat(widthMatch[1]);
        refHeight = parseFloat(heightMatch[1]);
      } else {
        // Fall back to viewBox
        const viewBoxMatch = svgTag.match(/viewBox=["']([^"']+)["']/i);
        if (viewBoxMatch) {
          const parts = viewBoxMatch[1].split(/\s+/);
          if (parts.length >= 4) {
            refWidth = parseFloat(parts[2]);
            refHeight = parseFloat(parts[3]);
          }
        }
      }
    }
    
    /**
     * Parse transform attribute (translate, matrix)
     * Returns { tx, ty } offset to apply
     */
    const parseTransform = (transformStr: string): { tx: number; ty: number } => {
      let tx = 0, ty = 0;
      
      // Parse translate(x[,y])
      const translateMatch = transformStr.match(/translate\s*\(\s*([^,)]+)(?:\s*,\s*([^)]+))?\s*\)/i);
      if (translateMatch) {
        tx += parseFloat(translateMatch[1]) || 0;
        ty += parseFloat(translateMatch[2] || '0') || 0;
      }
      
      // Parse matrix(a,b,c,d,e,f) - e,f are tx,ty
      const matrixMatch = transformStr.match(/matrix\s*\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^)]+)\s*\)/i);
      if (matrixMatch) {
        tx += parseFloat(matrixMatch[5]) || 0;
        ty += parseFloat(matrixMatch[6]) || 0;
      }
      
      return { tx, ty };
    };
    
    /**
     * Find parent <g> transforms by scanning backwards from rect position
     * This is a pragmatic string-based approach for nested transforms
     */
    const findParentTransforms = (svgContent: string, rectStartPos: number): { tx: number; ty: number } => {
      let tx = 0, ty = 0;
      const scanBack = svgContent.substring(Math.max(0, rectStartPos - 2000), rectStartPos);
      
      // Find all <g> tags with transforms that haven't been closed
      const gTags: Array<{ transform: string; closedAt: number }> = [];
      const gRegex = /<g\s+([^>]*)>/gi;
      let gMatch;
      
      while ((gMatch = gRegex.exec(scanBack)) !== null) {
        const attrs = gMatch[1];
        const transformMatch = attrs.match(/transform=["']([^"']+)["']/i);
        if (transformMatch) {
          gTags.push({ transform: transformMatch[1], closedAt: -1 });
        }
      }
      
      // Check which <g> tags are still open (not followed by </g>)
      gTags.forEach((g) => {
        const afterG = scanBack.substring(scanBack.lastIndexOf(`transform="${g.transform}"`));
        if (!afterG.includes('</g>') || afterG.lastIndexOf('<g') > afterG.lastIndexOf('</g>')) {
          const offset = parseTransform(g.transform);
          tx += offset.tx;
          ty += offset.ty;
        }
      });
      
      return { tx, ty };
    };
    
    // Extract rect elements (case-insensitive)
    const rectRegex = /<rect[^>]*>/gi;
    let match;
    let maskIdx = 0;
    
    while ((match = rectRegex.exec(svgContent)) !== null) {
      const rectTag = match[0];
      const rectPos = match.index;
      
      // Extract attributes (case-insensitive, handle units via parseFloat)
      const xMatch = rectTag.match(/\bx=["']([^"']+)["']/i);
      const yMatch = rectTag.match(/\by=["']([^"']+)["']/i);
      const widthMatch = rectTag.match(/\bwidth=["']([^"']+)["']/i);
      const heightMatch = rectTag.match(/\bheight=["']([^"']+)["']/i);
      
      // Parse base coordinates (may be missing if transform-only)
      let x = xMatch ? parseFloat(xMatch[1]) : 0;
      let y = yMatch ? parseFloat(yMatch[1]) : 0;
      const w = widthMatch ? parseFloat(widthMatch[1]) : 0;
      const h = heightMatch ? parseFloat(heightMatch[1]) : 0;
      
      // Apply rect's own transform attribute
      const transformMatch = rectTag.match(/\btransform=["']([^"']+)["']/i);
      if (transformMatch) {
        const offset = parseTransform(transformMatch[1]);
        x += offset.tx;
        y += offset.ty;
        transformsUsed++;
      }
      
      // Apply inline style transform
      const styleMatch = rectTag.match(/\bstyle=["']([^"']+)["']/i);
      if (styleMatch) {
        const styleStr = styleMatch[1];
        const styleTransformMatch = styleStr.match(/transform:\s*([^;]+)/i);
        if (styleTransformMatch) {
          const offset = parseTransform(styleTransformMatch[1]);
          x += offset.tx;
          y += offset.ty;
          transformsUsed++;
        }
      }
      
      // Apply parent <g> transforms
      const parentOffset = findParentTransforms(svgContent, rectPos);
      x += parentOffset.tx;
      y += parentOffset.ty;
      if (parentOffset.tx !== 0 || parentOffset.ty !== 0) {
        transformsUsed++;
      }
      
      // Validate all coordinates are finite numbers
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) {
        logger.warn(`[DeckImport][IO] Skipping invalid rect in ${filename || 'field'}: x=${x}, y=${y}, w=${w}, h=${h}`);
        skippedInvalid++;
        continue;
      }
      
      // Skip zero-size rects
      if (w <= 0 || h <= 0) {
        skippedInvalid++;
        continue;
      }
      
      // Extract style information if requested (for target detection)
      let fill = '';
      let stroke = '';
      let fillOpacity = '';
      let strokeOpacity = '';
      
      if (includeStyles) {
        const fillMatch = rectTag.match(/\bfill=["']([^"']+)["']/i);
        const strokeMatch = rectTag.match(/\bstroke=["']([^"']+)["']/i);
        if (fillMatch) fill = fillMatch[1].toLowerCase().trim();
        if (strokeMatch) stroke = strokeMatch[1].toLowerCase().trim();
        
        // Check both attribute and inline style for opacity
        const fillOpacityMatch = rectTag.match(/\bfill-opacity=["']([^"']+)["']/i);
        const strokeOpacityMatch = rectTag.match(/\bstroke-opacity=["']([^"']+)["']/i);
        if (fillOpacityMatch) fillOpacity = fillOpacityMatch[1];
        if (strokeOpacityMatch) strokeOpacity = strokeOpacityMatch[1];
        
        if (styleMatch) {
          const styleStr = styleMatch[1];
          const styleFillMatch = styleStr.match(/fill:\s*([^;]+)/i);
          const styleStrokeMatch = styleStr.match(/stroke:\s*([^;]+)/i);
          const styleFillOpacityMatch = styleStr.match(/fill-opacity:\s*([^;]+)/i);
          const styleStrokeOpacityMatch = styleStr.match(/stroke-opacity:\s*([^;]+)/i);
          if (styleFillMatch) fill = styleFillMatch[1].toLowerCase().trim();
          if (styleStrokeMatch) stroke = styleStrokeMatch[1].toLowerCase().trim();
          if (styleFillOpacityMatch) fillOpacity = styleFillOpacityMatch[1];
          if (styleStrokeOpacityMatch) strokeOpacity = styleStrokeOpacityMatch[1];
        }
      }
      
      // Normalize to 0-1 range
      const normalized: any = {
        id: `m${++maskIdx}`,
        x: x / refWidth,
        y: y / refHeight,
        w: w / refWidth,
        h: h / refHeight,
      };
      
      // Add style info if requested
      if (includeStyles) {
        normalized.fill = fill;
        normalized.stroke = stroke;
        normalized.fillOpacity = fillOpacity;
        normalized.strokeOpacity = strokeOpacity;
      }
      
      // Final validation of normalized values
      if (Number.isFinite(normalized.x) && Number.isFinite(normalized.y) && 
          Number.isFinite(normalized.w) && Number.isFinite(normalized.h)) {
        masks.push(normalized);
      } else {
        logger.warn(`[DeckImport][IO] Normalized values invalid for ${filename || 'field'}: ${JSON.stringify(normalized)}`);
        skippedInvalid++;
      }
    }
    
    logger.debug('[DeckImport][IO] SVG parse result', {
      noteId,
      fieldIdx,
      filename,
      refWidth,
      refHeight,
      maskCount: masks.length,
      transformsUsed,
      skippedInvalid,
    });

    return masks;
  };

  /**
   * Derive target indices for old-style IO decks using robust priority pipeline
   */
  const deriveTargetIndices = async (
    allMasks: any[],
    svgFilenames: Set<string>,
    noteNumber: string | null,
    existingExtra: string
  ): Promise<{ targetIndices: number[]; method: string }> => {
    const makeKey = (m: any) => {
      const round = (v: number) => Math.round(v * 100000) / 100000;
      return `${round(m.x)}_${round(m.y)}_${round(m.w)}_${round(m.h)}`;
    };
    
    // Build index for all masks
    const allMasksIndex = new Map<string, number>();
    allMasks.forEach((mask, index) => {
      allMasksIndex.set(makeKey(mask), index);
    });
    
    // Priority 1: Check Extra field for pre-computed targetIndices
    if (existingExtra && existingExtra.includes('targetIndices:')) {
      const match = existingExtra.match(/targetIndices:([0-9,]+)/);
      if (match) {
        const indices = match[1].split(',').map(s => parseInt(s, 10)).filter(n => !isNaN(n) && n < allMasks.length);
        if (indices.length > 0) {
          logger.info('[DeckImport][IO] Using existing targetIndices from Extra field:', indices);
          return { targetIndices: indices, method: 'extra-field' };
        }
      }
    }
    
    // Priority 2: Use -A.svg (answer overlay) to compute set difference
    const aSvgFile = Array.from(svgFilenames).find(name => {
      const normalized = name.toLowerCase();
      return noteNumber ? normalized.includes(`-ao-${noteNumber}-a.svg`) : normalized.includes('-a.svg');
    });
    
    if (aSvgFile) {
      try {
        const normalizedAName = sanitizeMediaFilename(aSvgFile.replace(/^media:/i, '').trim());
        const encodedAName = encodeURIComponent(normalizedAName);
        const aSvgPath = `${MEDIA_DIR}${encodedAName}`;
        const aSvgContent = await FileSystem.readAsStringAsync(aSvgPath);
        const answerMasks = parseSVGMasks(aSvgContent, undefined, undefined, normalizedAName);
        
        logger.info('[DeckImport][IO] -A.svg file:', normalizedAName, 'masks:', answerMasks.length);
        
        // Set difference: targets = O - A (masks present in O but not in A)
        const answerKeys = new Set(answerMasks.map(makeKey));
        const targetIndices: number[] = [];
        allMasks.forEach((mask, index) => {
          if (!answerKeys.has(makeKey(mask))) {
            targetIndices.push(index);
          }
        });
        
        if (targetIndices.length > 0 && targetIndices.length < allMasks.length) {
          logger.info('[DeckImport][IO] Derived targets from O-A difference:', targetIndices.length, 'targets');
          return { targetIndices, method: 'set-difference-A' };
        }
      } catch (error) {
        logger.warn('[DeckImport][IO] Failed to use -A.svg for target detection:', error);
      }
    }
    
    // Priority 3: Parse -Q.svg with style information and cluster by color
    const qSvgFile = Array.from(svgFilenames).find(name => {
      const normalized = name.toLowerCase();
      return noteNumber ? normalized.includes(`-ao-${noteNumber}-q.svg`) : normalized.includes('-q.svg');
    });
    
    if (qSvgFile) {
      try {
        const normalizedQName = sanitizeMediaFilename(qSvgFile.replace(/^media:/i, '').trim());
        const encodedQName = encodeURIComponent(normalizedQName);
        const qSvgPath = `${MEDIA_DIR}${encodedQName}`;
        const qSvgContent = await FileSystem.readAsStringAsync(qSvgPath);
        const qMasksWithStyles = parseSVGMasks(qSvgContent, undefined, undefined, normalizedQName, true);
        
        logger.info('[DeckImport][IO] -Q.svg file:', normalizedQName, 'masks:', qMasksWithStyles.length);
        
        // Match Q masks to O masks and build style groups
        const colorGroups = new Map<string, number[]>(); // color -> list of indices
        
        qMasksWithStyles.forEach((qMask) => {
          const key = makeKey(qMask);
          const oIndex = allMasksIndex.get(key);
          
          if (oIndex !== undefined) {
            // Normalize color: prefer fill, fallback to stroke
            let color = qMask.fill || qMask.stroke || 'none';
            // Normalize hex to lowercase
            color = color.replace(/\s+/g, '');
            
            if (!colorGroups.has(color)) {
              colorGroups.set(color, []);
            }
            colorGroups.get(color)!.push(oIndex);
          }
        });
        
        logger.info('[DeckImport][IO] Color groups found:', Array.from(colorGroups.entries()).map(([c, indices]) => `${c}: ${indices.length}`));
        
        // If we have exactly 2 color groups, assume minority is targets
        if (colorGroups.size === 2) {
          const groups = Array.from(colorGroups.values()).sort((a, b) => a.length - b.length);
          const minorityGroup = groups[0];
          const majorityGroup = groups[1];
          
          // Sanity check: minority should be meaningful but clearly smaller
          if (minorityGroup.length > 0 && minorityGroup.length < majorityGroup.length * 0.8) {
            logger.info('[DeckImport][IO] Detected targets from color clustering (minority):', minorityGroup.length);
            return { targetIndices: minorityGroup.sort((a, b) => a - b), method: 'style-clustering' };
          }
        }
        
        // Fallback: try opacity-based detection
        const opacityGroups = new Map<string, number[]>();
        qMasksWithStyles.forEach((qMask) => {
          const key = makeKey(qMask);
          const oIndex = allMasksIndex.get(key);
          
          if (oIndex !== undefined) {
            const opacity = qMask.fillOpacity || qMask.strokeOpacity || '1';
            if (!opacityGroups.has(opacity)) {
              opacityGroups.set(opacity, []);
            }
            opacityGroups.get(opacity)!.push(oIndex);
          }
        });
        
        if (opacityGroups.size === 2) {
          const groups = Array.from(opacityGroups.values()).sort((a, b) => a.length - b.length);
          const minorityGroup = groups[0];
          const majorityGroup = groups[1];
          
          if (minorityGroup.length > 0 && minorityGroup.length < majorityGroup.length * 0.8) {
            logger.info('[DeckImport][IO] Detected targets from opacity clustering:', minorityGroup.length);
            return { targetIndices: minorityGroup.sort((a, b) => a - b), method: 'opacity-clustering' };
          }
        }
        
        // Last resort for Q: assume ALL matched masks are targets (old behavior, but log warning)
        const allQIndices = qMasksWithStyles
          .map(qMask => allMasksIndex.get(makeKey(qMask)))
          .filter((idx): idx is number => idx !== undefined)
          .sort((a, b) => a - b);
        
        if (allQIndices.length > 0) {
          logger.warn('[DeckImport][IO] Could not cluster targets; using ALL Q masks as targets (may be incorrect):', allQIndices.length);
          return { targetIndices: allQIndices, method: 'all-Q-fallback' };
        }
      } catch (error) {
        logger.warn('[DeckImport][IO] Failed to parse -Q.svg for target detection:', error);
      }
    }
    
    // Final fallback: treat as hide-one or create single default target
    logger.warn('[DeckImport][IO] No usable target detection method; defaulting to first mask as target');
    return { targetIndices: [0], method: 'default-fallback' };
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
