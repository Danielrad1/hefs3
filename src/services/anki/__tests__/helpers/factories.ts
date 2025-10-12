/**
 * Test Data Factories - Reusable test data builders
 * Use these to quickly create valid test data in your tests
 */

import { AnkiCard, AnkiNote, Deck, Media, CardType, CardQueue } from '../../schema';
import { nowSeconds, generateId } from '../../time';

let cardCounter = 1;
let noteCounter = 1;
let deckCounter = 1;
let mediaCounter = 1;

/**
 * Reset counters (call in beforeEach if you need deterministic IDs)
 */
export const resetFactories = () => {
  cardCounter = 1;
  noteCounter = 1;
  deckCounter = 1;
  mediaCounter = 1;
};

/**
 * Create a test card with sensible defaults
 */
export const createTestCard = (overrides?: Partial<AnkiCard>): AnkiCard => ({
  id: `card${cardCounter++}`,
  nid: 'note1',
  did: '1',
  ord: 0,
  mod: nowSeconds(),
  usn: -1,
  type: CardType.New,
  queue: CardQueue.New,
  due: 1,
  ivl: 0,
  factor: 2500,
  reps: 0,
  lapses: 0,
  left: 0,
  odue: 0,
  odid: '0',
  flags: 0,
  data: '',
  ...overrides,
});

/**
 * Create a review card (already studied)
 */
export const createReviewCard = (overrides?: Partial<AnkiCard>): AnkiCard => 
  createTestCard({
    type: CardType.Review,
    queue: CardQueue.Review,
    ivl: 7,
    factor: 2500,
    reps: 5,
    due: Math.floor(Date.now() / 1000 / 86400) + 7, // 7 days from now
    ...overrides,
  });

/**
 * Create a learning card (in learning steps)
 */
export const createLearningCard = (overrides?: Partial<AnkiCard>): AnkiCard =>
  createTestCard({
    type: CardType.Learning,
    queue: CardQueue.Learning,
    due: Math.floor(Date.now() / 1000) + 600, // 10 minutes from now
    left: 2001, // 2 reps left, step 1
    ...overrides,
  });

/**
 * Create a test note with sensible defaults
 */
export const createTestNote = (overrides?: Partial<AnkiNote>): AnkiNote => ({
  id: `note${noteCounter++}`,
  guid: `guid${noteCounter}`,
  mid: 1, // Basic model
  mod: nowSeconds(),
  usn: -1,
  tags: ' ',
  flds: 'Front Text\x1fBack Text', // \x1f is field separator
  sfld: 0,
  csum: 12345,
  flags: 0,
  data: '',
  ...overrides,
});

/**
 * Create a cloze note
 */
export const createClozeNote = (text: string = 'This is {{c1::cloze}} deletion'): AnkiNote =>
  createTestNote({
    mid: 2, // Cloze model
    flds: text,
  });

/**
 * Create a note with media
 */
export const createNoteWithMedia = (filename: string = 'image.jpg'): AnkiNote =>
  createTestNote({
    flds: `Front with <img src="${filename}">\x1fBack`,
  });

/**
 * Create a test deck
 */
export const createTestDeck = (name?: string, overrides?: Partial<Deck>): Deck => ({
  id: `${deckCounter++}`,
  name: name || `Test Deck ${deckCounter}`,
  desc: '',
  conf: '1',
  mod: nowSeconds(),
  usn: -1,
  collapsed: false,
  browserCollapsed: false,
  ...overrides,
});

/**
 * Create a test media file
 */
export const createTestMedia = (filename?: string, overrides?: Partial<Media>): Media => ({
  id: `media${mediaCounter++}`,
  filename: filename || `image${mediaCounter}.jpg`,
  mime: 'image/jpeg',
  hash: `hash${mediaCounter}`,
  size: 1024,
  localUri: `file://media/image${mediaCounter}.jpg`,
  created: nowSeconds(),
  ...overrides,
});

/**
 * Create multiple test cards at once
 */
export const createTestCards = (count: number, overrides?: Partial<AnkiCard>): AnkiCard[] =>
  Array.from({ length: count }, () => createTestCard(overrides));

/**
 * Create multiple test notes at once
 */
export const createTestNotes = (count: number, overrides?: Partial<AnkiNote>): AnkiNote[] =>
  Array.from({ length: count }, () => createTestNote(overrides));

/**
 * Create a complete deck with cards
 * Useful for integration tests
 */
export const createDeckWithCards = (cardCount: number = 5) => {
  const deck = createTestDeck();
  const notes = createTestNotes(cardCount, { mid: 1 });
  const cards = notes.map((note, i) =>
    createTestCard({
      nid: note.id,
      did: deck.id,
      ord: 0,
      due: i + 1,
    })
  );

  return { deck, notes, cards };
};

/**
 * Create a study session scenario
 * Mixed card types, ready for testing study flow
 */
export const createStudyScenario = () => {
  const deck = createTestDeck('Study Deck');
  
  return {
    deck,
    newCards: createTestCards(5, { did: deck.id, type: CardType.New }),
    learningCards: createTestCards(3, { 
      did: deck.id, 
      type: CardType.Learning,
      queue: CardQueue.Learning,
      due: Math.floor(Date.now() / 1000) + 300,
    }),
    reviewCards: createTestCards(10, { 
      did: deck.id, 
      type: CardType.Review,
      queue: CardQueue.Review,
      ivl: 7,
      reps: 5,
    }),
  };
};
