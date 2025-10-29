/**
 * NoteService - High-level operations for note management
 */

import { InMemoryDb } from './InMemoryDb';
import {
  AnkiNote,
  AnkiCard,
  CardType,
  CardQueue,
  FIELD_SEPARATOR,
  DEFAULT_EASE_FACTOR,
  DEFAULT_MODEL_ID,
  MODEL_TYPE_CLOZE,
  MODEL_TYPE_IMAGE_OCCLUSION,
} from './schema';
import { nowSeconds, generateId } from './time';
import { generateGuid } from './guid';
import { calculateChecksum } from './checksum';
import { MediaService } from './MediaService';
import { logger } from '../../utils/logger';

export interface CreateNoteParams {
  modelId: string | number; // Accept both for flexibility
  deckId: string;
  fields: string[];
  tags?: string[];
}

export interface UpdateNoteParams {
  fields?: string[];
  tags?: string[];
  deckId?: string;
}

export class NoteService {
  private mediaService: MediaService;

  constructor(private db: InMemoryDb) {
    this.mediaService = new MediaService(db);
  }

  /**
   * Create a new note and generate cards
   */
  createNote(params: CreateNoteParams): AnkiNote {
    const model = this.db.getModel(params.modelId);
    if (!model) {
      throw new Error(`Model ${params.modelId} not found`);
    }

    const deck = this.db.getDeck(params.deckId);
    if (!deck) {
      throw new Error(`Deck ${params.deckId} not found`);
    }

    if (params.fields.length !== model.flds.length) {
      throw new Error(`Expected ${model.flds.length} fields, got ${params.fields.length}`);
    }

    const now = nowSeconds();
    const noteId = generateId();

    // Create note (Anki-compatible format)
    const note: AnkiNote = {
      id: noteId,
      guid: generateGuid(), // Proper base91 GUID
      mid: params.modelId,
      mod: now,
      usn: -1, // -1 = local changes not synced
      tags:
        params.tags && params.tags.length > 0
          ? ` ${params.tags.join(' ')} ` // Surrounding spaces required!
          : ' ', // Empty tags is single space
      flds: params.fields.join(FIELD_SEPARATOR), // \x1F separator
      sfld: 0,
      csum: calculateChecksum(params.fields[model.sortf] || ''), // SHA1-based checksum
      flags: 0,
      data: '',
    };

    this.db.addNote(note);

    // Generate cards based on model type
    this.generateCards(note, model, params.deckId);

    return note;
  }

  /**
   * Update an existing note
   */
  updateNote(noteId: string, params: UpdateNoteParams): void {
    const note = this.db.getNote(noteId);
    if (!note) {
      throw new Error(`Note ${noteId} not found`);
    }

    const model = this.db.getModel(note.mid);
    if (!model) {
      throw new Error(`Model ${note.mid} not found`);
    }

    const updates: Partial<AnkiNote> = {};

    if (params.fields) {
      if (params.fields.length !== model.flds.length) {
        throw new Error(`Expected ${model.flds.length} fields, got ${params.fields.length}`);
      }
      updates.flds = params.fields.join(FIELD_SEPARATOR);
      updates.csum = calculateChecksum(params.fields[model.sortf] || ''); // Proper checksum
    }

    if (params.tags !== undefined) {
      updates.tags =
        params.tags.length > 0
          ? ` ${params.tags.join(' ')} ` // Surrounding spaces!
          : ' '; // Empty tags is single space
    }

    this.db.updateNote(noteId, updates);

    // Regenerate cards if fields changed (for cloze and image occlusion notes)
    if (
      params.fields &&
      (model.type === MODEL_TYPE_CLOZE || model.type === MODEL_TYPE_IMAGE_OCCLUSION)
    ) {
      // Delete existing cards
      const existingCards = this.db.getAllCards().filter((c) => c.nid === noteId);
      existingCards.forEach((card) => this.db.deleteCard(card.id));

      // Get deck from first card or use model's default deck
      const deckId = params.deckId || existingCards[0]?.did || model.did;

      // IMPORTANT: Refetch note after update to get latest data (including note.data)
      const updatedNote = this.db.getNote(noteId);
      if (!updatedNote) {
        throw new Error(`Note ${noteId} not found after update`);
      }

      logger.info(
        '[NoteService] Refetched note for card generation, data exists:',
        !!updatedNote.data,
      );

      // Regenerate cards with updated note
      this.generateCards(updatedNote, model, deckId);
    }
  }

  /**
   * Delete a note and all its cards
   */
  async deleteNote(noteId: string): Promise<void> {
    const note = this.db.getNote(noteId);
    if (!note) {
      throw new Error(`Note ${noteId} not found`);
    }

    // Delete all cards for this note
    const cards = this.db.getAllCards().filter((c) => c.nid === noteId);
    cards.forEach((card) => this.db.deleteCard(card.id));

    // Delete the note
    this.db.deleteNote(noteId);

    // Clean up orphaned media files
    logger.info('[NoteService] Cleaning up orphaned media files...');
    const deletedCount = await this.mediaService.gcUnused();
    logger.info(`[NoteService] Deleted ${deletedCount} orphaned media files`);
  }

  /**
   * Get a note by ID
   */
  getNote(noteId: string): AnkiNote | undefined {
    return this.db.getNote(noteId);
  }

  /**
   * Get all notes
   */
  getAllNotes(): AnkiNote[] {
    return this.db.getAllNotes();
  }

  /**
   * Change note type (model)
   */
  changeNoteType(
    noteId: string,
    targetModelId: string,
    fieldMapping: Record<number, number>,
  ): void {
    const note = this.db.getNote(noteId);
    if (!note) {
      throw new Error(`Note ${noteId} not found`);
    }

    const targetModel = this.db.getModel(targetModelId);
    if (!targetModel) {
      throw new Error(`Target model ${targetModelId} not found`);
    }

    const oldFields = note.flds.split(FIELD_SEPARATOR);
    const newFields = new Array(targetModel.flds.length).fill('');

    // Map old fields to new fields
    Object.entries(fieldMapping).forEach(([oldIdx, newIdx]) => {
      const oldIndex = parseInt(oldIdx);
      if (oldFields[oldIndex] !== undefined) {
        newFields[newIdx] = oldFields[oldIndex];
      }
    });

    // Delete old cards
    const existingCards = this.db.getAllCards().filter((c) => c.nid === noteId);
    const deckId = existingCards[0]?.did || targetModel.did;
    existingCards.forEach((card) => this.db.deleteCard(card.id));

    // Update note
    this.db.updateNote(noteId, {
      mid: targetModelId,
      flds: newFields.join(FIELD_SEPARATOR),
      csum: calculateChecksum(newFields[targetModel.sortf] || ''),
    });

    // Generate new cards
    const updatedNote = this.db.getNote(noteId)!;
    this.generateCards(updatedNote, targetModel, deckId);
  }

  /**
   * Generate cards for a note based on its model
   */
  private generateCards(note: AnkiNote, model: any, deckId: string): void {
    const now = nowSeconds();

    if (model.type === MODEL_TYPE_CLOZE) {
      // Generate cards for each cloze deletion
      const fields = note.flds.split(FIELD_SEPARATOR);
      const clozeField = fields[0] || '';
      const clozeIndices = this.extractClozeIndices(clozeField);

      clozeIndices.forEach((clozeIndex) => {
        const cardId = generateId();
        const card: AnkiCard = {
          id: cardId,
          nid: note.id,
          did: deckId,
          ord: clozeIndex - 1, // ord is 0-based, cloze is 1-based
          mod: now,
          usn: -1,
          type: CardType.New,
          queue: CardQueue.New,
          due: this.db.incrementNextPos(),
          ivl: 0,
          factor: DEFAULT_EASE_FACTOR,
          reps: 0,
          lapses: 0,
          left: 0,
          odue: 0,
          odid: '0',
          flags: 0,
          data: '',
        };
        this.db.addCard(card);
      });
    } else if (model.type === MODEL_TYPE_IMAGE_OCCLUSION) {
      logger.info('[NoteService] Generating IO cards for note', note.id);
      logger.info('[NoteService] Note data:', note.data?.substring(0, 200));

      const { masks, mode } = this.parseImageOcclusionData(note);

      if (mode === 'hide-all') {
        const cardId = generateId();
        logger.info(
          '[NoteService] Creating single hide-all card',
          cardId,
          'mask count:',
          masks.length,
        );
        const card: AnkiCard = {
          id: cardId,
          nid: note.id,
          did: deckId,
          ord: 0,
          mod: now,
          usn: -1,
          type: CardType.New,
          queue: CardQueue.New,
          due: this.db.incrementNextPos(),
          ivl: 0,
          factor: DEFAULT_EASE_FACTOR,
          reps: 0,
          lapses: 0,
          left: 0,
          odue: 0,
          odid: '0',
          flags: 0,
          data: '',
        };
        this.db.addCard(card);
      } else {
        masks.forEach((_, maskIndex) => {
          const cardId = generateId();
          logger.info('[NoteService] Creating card for mask index', maskIndex, 'card ID:', cardId);
          const card: AnkiCard = {
            id: cardId,
            nid: note.id,
            did: deckId,
            ord: maskIndex, // ord = mask index (0-based)
            mod: now,
            usn: -1,
            type: CardType.New,
            queue: CardQueue.New,
            due: this.db.incrementNextPos(),
            ivl: 0,
            factor: DEFAULT_EASE_FACTOR,
            reps: 0,
            lapses: 0,
            left: 0,
            odue: 0,
            odid: '0',
            flags: 0,
            data: '',
          };
          this.db.addCard(card);
        });
      }
    } else {
      // Standard model: generate one card per template
      model.tmpls.forEach((template: any) => {
        const cardId = generateId();
        const card: AnkiCard = {
          id: cardId,
          nid: note.id,
          did: deckId,
          ord: template.ord,
          mod: now,
          usn: -1,
          type: CardType.New,
          queue: CardQueue.New,
          due: this.db.incrementNextPos(),
          ivl: 0,
          factor: DEFAULT_EASE_FACTOR,
          reps: 0,
          lapses: 0,
          left: 0,
          odue: 0,
          odid: '0',
          flags: 0,
          data: '',
        };
        this.db.addCard(card);
      });
    }
  }

  /**
   * Extract cloze indices from text (e.g., {{c1::...}} {{c3::...}} => [1, 3])
   */
  private extractClozeIndices(text: string): number[] {
    const clozeRegex = /{{c(\d+)::/g;
    const indices = new Set<number>();
    let match;

    while ((match = clozeRegex.exec(text)) !== null) {
      indices.add(parseInt(match[1]));
    }

    return Array.from(indices).sort((a, b) => a - b);
  }

  /**
   * Parse image occlusion data from note
   */
  private parseImageOcclusionData(note: AnkiNote): { masks: any[]; mode: 'hide-one' | 'hide-all' } {
    try {
      if (!note.data) {
        logger.warn('[NoteService] No note.data found for IO note', note.id);
        return { masks: [], mode: 'hide-one' };
      }

      const data = JSON.parse(note.data);
      const ioData = data?.io || {};
      const masks = Array.isArray(ioData.masks) ? ioData.masks : [];
      const mode = ioData.mode === 'hide-all' ? 'hide-all' : 'hide-one';

      logger.info('[NoteService] Parsed IO data', {
        noteId: note.id,
        maskCount: masks.length,
        mode,
      });

      return { masks, mode };
    } catch (error) {
      logger.error('[NoteService] Failed to parse IO data for note', note.id, error);
      return { masks: [], mode: 'hide-one' };
    }
  }
}
