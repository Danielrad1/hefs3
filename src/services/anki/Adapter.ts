/**
 * Adapter to bootstrap Anki database from seed data
 * Converts simple Card objects to Anki schema
 */

import { Card } from '../../domain/models';
import {
  AnkiCard,
  AnkiNote,
  CardType,
  CardQueue,
  FIELD_SEPARATOR,
  DEFAULT_DECK_ID,
  DEFAULT_MODEL_ID,
  DEFAULT_EASE_FACTOR,
  MODEL_TYPE_IMAGE_OCCLUSION,
} from './schema';
import { InMemoryDb } from './InMemoryDb';
import { nowSeconds, generateId } from './time';
import { logger } from '../../utils/logger';
import * as TemplateEngine from './TemplateEngine';

/**
 * Bootstrap the database with seed cards
 * Creates decks dynamically for any unique deckIds
 */
export function bootstrapFromSeed(db: InMemoryDb, cards: Card[]): void {
  const now = nowSeconds();

  // Collect unique deck IDs and create decks
  const deckIds = new Set(cards.map((c) => c.deckId).filter(Boolean));
  deckIds.forEach((deckId) => {
    if (deckId && !db.getDeck(deckId)) {
      // Create deck if it doesn't exist
      db.addDeck({
        id: deckId,
        name: deckId.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
        desc: '',
        conf: '1', // Use default deck config
        mod: now,
        usn: -1,
        collapsed: false,
        browserCollapsed: false,
      });
    }
  });

  cards.forEach((card, index) => {
    // Create note
    const noteId = generateId() + index; // Ensure unique IDs
    const note: AnkiNote = {
      id: noteId,
      guid: `seed-${noteId}`,
      mid: DEFAULT_MODEL_ID,
      mod: now,
      usn: -1,
      tags: ' ', // empty tags
      flds: `${card.front}${FIELD_SEPARATOR}${card.back}`,
      sfld: 0, // first field for sorting
      csum: hashField(card.front),
      flags: 0,
      data: '',
    };

    // Create card with proper deck
    const cardId = generateId() + index + 1;
    const deckId = card.deckId || DEFAULT_DECK_ID;
    const ankiCard: AnkiCard = {
      id: cardId,
      nid: noteId,
      did: deckId,
      ord: 0, // first card template
      mod: now,
      usn: -1,
      type: CardType.New,
      queue: CardQueue.New,
      due: db.incrementNextPos(), // sequential order
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

    db.addNote(note);
    db.addCard(ankiCard);
  });
}

/**
 * Convert Anki card + note to UI Card
 */
export function toViewCard(ankiCard: AnkiCard, db: InMemoryDb): Card {
  const note = db.getNote(ankiCard.nid);
  if (!note) {
    logger.error(`[Adapter] Note ${ankiCard.nid} not found for card ${ankiCard.id}`);
    logger.error(`[Adapter] This card is orphaned and should be cleaned up`);
    throw new Error(`Note ${ankiCard.nid} not found`);
  }

  const model = db.getModel(note.mid);
  if (!model) {
    throw new Error(`Model ${note.mid} not found`);
  }

  // Handle Image Occlusion cards
  if (model.type === MODEL_TYPE_IMAGE_OCCLUSION) {
    return toImageOcclusionCard(ankiCard, note, db);
  }

  // Handle Cloze cards - pass raw fields to CardContentRenderer for blue placeholder rendering
  // Don't use TemplateEngine which converts {{c1::text::hint}} to [hint] text
  const MODEL_TYPE_CLOZE = 1;
  if (model.type === MODEL_TYPE_CLOZE) {
    const fields = note.flds.split(FIELD_SEPARATOR);
    return {
      id: ankiCard.id,
      front: fields[0] || '',
      back: fields[1] || '',
      deckId: ankiCard.did || DEFAULT_DECK_ID,
    };
  }

  // Standard cards - use TemplateEngine for template rendering
  try {
    const rendered = TemplateEngine.render(model, note, ankiCard.ord, 'q');
    return {
      id: ankiCard.id,
      front: rendered.front,
      back: rendered.back,
      deckId: ankiCard.did || DEFAULT_DECK_ID,
    };
  } catch (error) {
    // Fallback to simple field rendering if template fails
    logger.error(`[Adapter] Template rendering failed for card ${ankiCard.id}:`, error);
    const fields = note.flds.split(FIELD_SEPARATOR);
    return {
      id: ankiCard.id,
      front: fields[0] || '',
      back: fields[1] || '',
      deckId: ankiCard.did || DEFAULT_DECK_ID,
    };
  }
}

/**
 * Convert Image Occlusion note to UI Card
 */
function toImageOcclusionCard(ankiCard: AnkiCard, note: AnkiNote, db: InMemoryDb): Card {
  const fields = note.flds.split(FIELD_SEPARATOR);
  let extraField = fields[1] || '';
  
  // Strip metadata from extraField (targetIndices and svgDim are for internal use)
  extraField = extraField.replace(/targetIndices:[0-9,]+/g, '').replace(/svgDim:[0-9.]+x[0-9.]+/g, '');
  // Remove pipe separators and trim
  extraField = extraField.replace(/^\|+|\|+$/g, '').replace(/\|+/g, '|').trim();

  // Parse occlusion data from note.data
  let occlusionData = '{}';
  let mode: 'hide-one' | 'hide-all' = 'hide-one';
  try {
    if (note.data) {
      const data = JSON.parse(note.data);
      if (data.io) {
        occlusionData = JSON.stringify(data.io);
        if (data.io.mode === 'hide-all') {
          mode = 'hide-all';
        }
        logger.info('[Adapter] IO card data:', {
          noteId: note.id,
          cardId: ankiCard.id,
          image: data.io.image,
          maskCount: data.io.masks?.length,
          mode,
        });
      } else {
        logger.warn('[Adapter] note.data exists but no data.io:', { noteId: note.id, dataKeys: Object.keys(data) });
      }
    } else {
      logger.warn('[Adapter] No note.data for IO note:', { noteId: note.id });
    }
  } catch (e) {
    logger.error('[Adapter] Failed to parse image occlusion data:', e);
  }

  // Always use numeric ord - one card per mask for both hide-one and hide-all
  const ordAttr = String(ankiCard.ord);

  // Front: occlusion element with ord
  const front = `<io-occlude data='${occlusionData}' ord='${ordAttr}'></io-occlude>`;

  // Back: occlusion element with reveal + Extra field
  const back = `<io-occlude data='${occlusionData}' ord='${ordAttr}' reveal='true'></io-occlude>${extraField ? '<br>' + extraField : ''}`;

  return {
    id: ankiCard.id,
    front,
    back,
    deckId: ankiCard.did || DEFAULT_DECK_ID,
  };
}

/**
 * Simple hash for checksum (first 8 hex digits of field)
 * Simplified version - Anki uses SHA1, we'll use a simple hash
 */
function hashField(field: string): number {
  let hash = 0;
  for (let i = 0; i < field.length; i++) {
    const char = field.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash) % 0xffffffff;
}
