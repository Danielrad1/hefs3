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
  DEFAULT_EASE_FACTOR,
} from './schema';
import { InMemoryDb } from './InMemoryDb';
import { nowSeconds, generateId } from './time';

/**
 * Bootstrap the database with seed cards
 */
export function bootstrapFromSeed(db: InMemoryDb, cards: Card[]): void {
  const now = nowSeconds();
  const col = db.getCol();

  cards.forEach((card, index) => {
    // Create note
    const noteId = generateId() + index;  // Ensure unique IDs
    const note: AnkiNote = {
      id: noteId,
      guid: `seed-${noteId}`,
      mid: '1',  // default model
      mod: now,
      usn: -1,
      tags: ' ',  // empty tags
      flds: `${card.front}${FIELD_SEPARATOR}${card.back}`,
      sfld: 0,  // first field for sorting
      csum: hashField(card.front),
      flags: 0,
      data: '',
    };

    // Create card
    const cardId = generateId() + index + 1;
    const ankiCard: AnkiCard = {
      id: cardId,
      nid: noteId,
      did: card.deckId || DEFAULT_DECK_ID,
      ord: 0,  // first card template
      mod: now,
      usn: -1,
      type: CardType.New,
      queue: CardQueue.New,
      due: db.incrementNextPos(),  // sequential order
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
    throw new Error(`Note ${ankiCard.nid} not found`);
  }

  const fields = note.flds.split(FIELD_SEPARATOR);
  const front = fields[0] || '';
  const back = fields[1] || '';

  return {
    id: ankiCard.id,
    front,
    back,
    deckId: ankiCard.did,
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
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash) % 0xFFFFFFFF;
}
