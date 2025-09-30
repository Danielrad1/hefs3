/**
 * In-memory database matching Anki schema
 * Holds cards, notes, col, revlog, and graves
 */

import {
  AnkiCard,
  AnkiNote,
  AnkiCol,
  AnkiRevlog,
  AnkiGrave,
  DeckConfig,
  ColConfig,
  Deck,
  DEFAULT_DECK_ID,
} from './schema';
import { nowSeconds, nowMillis, generateId } from './time';

export class InMemoryDb {
  // Single collection row
  private col: AnkiCol | null = null;

  // Main tables
  private cards: Map<string, AnkiCard> = new Map();
  private notes: Map<string, AnkiNote> = new Map();
  private revlog: AnkiRevlog[] = [];
  private graves: AnkiGrave[] = [];

  // Parsed JSON configs (cached)
  private decks: Map<string, Deck> = new Map();
  private deckConfigs: Map<string, DeckConfig> = new Map();
  private colConfig: ColConfig | null = null;

  // Update sequence number (local changes = -1)
  private usn: number = -1;

  constructor() {
    this.initializeCollection();
  }

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  private initializeCollection(): void {
    const now = nowSeconds();
    const nowMs = nowMillis();

    // Create default collection
    const defaultDeck: Deck = {
      id: DEFAULT_DECK_ID,
      name: 'Default',
      desc: '',
      conf: '1',
      mod: now,
      usn: this.usn,
      collapsed: false,
      browserCollapsed: false,
    };

    const defaultDeckConfig: DeckConfig = {
      id: '1',
      name: 'Default',
      new: {
        delays: [1, 10],  // 1 min, 10 min
        ints: [1, 4, 7],  // graduating: good=1d, easy=4d
        initialFactor: 2500,
        perDay: 20,
        order: 0,  // sequential
      },
      rev: {
        perDay: 200,
        ease4: 150,  // +0.15 on easy
        ivlFct: 1.0,
        maxIvl: 36500,  // 100 years
        fuzz: 0.05,
      },
      lapse: {
        delays: [10],  // 10 min relearning
        mult: 0.5,  // halve interval on lapse
        minInt: 1,  // minimum 1 day after graduation
        leechAction: 0,  // suspend
        leechFails: 8,
      },
      dyn: false,
      usn: this.usn,
      mod: now,
    };

    const defaultColConfig: ColConfig = {
      activeDecks: [DEFAULT_DECK_ID],
      nextPos: 1,  // next position for new cards
      sortType: 'noteFld',
      sortBackwards: false,
      schedVer: 2,  // v2 scheduler
      rollover: 4,  // 4 AM
    };

    this.decks.set(DEFAULT_DECK_ID, defaultDeck);
    this.deckConfigs.set('1', defaultDeckConfig);
    this.colConfig = defaultColConfig;

    this.col = {
      id: generateId(),
      crt: now,
      mod: nowMs,
      scm: nowMs,
      ver: 11,
      dty: 0,
      usn: this.usn,
      ls: nowMs,
      conf: JSON.stringify(defaultColConfig),
      models: JSON.stringify({}),
      decks: JSON.stringify({ [DEFAULT_DECK_ID]: defaultDeck }),
      dconf: JSON.stringify({ '1': defaultDeckConfig }),
      tags: JSON.stringify({}),
    };
  }

  // ==========================================================================
  // COLLECTION
  // ==========================================================================

  getCol(): AnkiCol {
    if (!this.col) {
      throw new Error('Collection not initialized');
    }
    return this.col;
  }

  updateCol(updates: Partial<AnkiCol>): void {
    if (!this.col) {
      throw new Error('Collection not initialized');
    }
    this.col = { ...this.col, ...updates, mod: nowMillis() };
  }

  // ==========================================================================
  // CARDS
  // ==========================================================================

  getCard(id: string): AnkiCard | undefined {
    return this.cards.get(id);
  }

  getAllCards(): AnkiCard[] {
    return Array.from(this.cards.values());
  }

  getCardsByDeck(deckId: string): AnkiCard[] {
    return Array.from(this.cards.values()).filter((c) => c.did === deckId);
  }

  addCard(card: AnkiCard): void {
    this.cards.set(card.id, card);
  }

  updateCard(id: string, updates: Partial<AnkiCard>): void {
    const card = this.cards.get(id);
    if (!card) {
      throw new Error(`Card ${id} not found`);
    }
    this.cards.set(id, {
      ...card,
      ...updates,
      mod: nowSeconds(),
      usn: this.usn,
    });
  }

  deleteCard(id: string): void {
    this.cards.delete(id);
    this.graves.push({
      usn: this.usn,
      oid: id,
      type: 0,  // card
    });
  }

  // ==========================================================================
  // NOTES
  // ==========================================================================

  getNote(id: string): AnkiNote | undefined {
    return this.notes.get(id);
  }

  getAllNotes(): AnkiNote[] {
    return Array.from(this.notes.values());
  }

  addNote(note: AnkiNote): void {
    this.notes.set(note.id, note);
  }

  updateNote(id: string, updates: Partial<AnkiNote>): void {
    const note = this.notes.get(id);
    if (!note) {
      throw new Error(`Note ${id} not found`);
    }
    this.notes.set(id, {
      ...note,
      ...updates,
      mod: nowSeconds(),
      usn: this.usn,
    });
  }

  deleteNote(id: string): void {
    this.notes.delete(id);
    this.graves.push({
      usn: this.usn,
      oid: id,
      type: 1,  // note
    });
  }

  // ==========================================================================
  // REVLOG
  // ==========================================================================

  addRevlog(entry: AnkiRevlog): void {
    this.revlog.push(entry);
  }

  getRevlogForCard(cardId: string): AnkiRevlog[] {
    return this.revlog.filter((r) => r.cid === cardId);
  }

  getAllRevlog(): AnkiRevlog[] {
    return [...this.revlog];
  }

  // ==========================================================================
  // DECKS & CONFIGS
  // ==========================================================================

  getDeck(id: string): Deck | undefined {
    return this.decks.get(id);
  }

  getAllDecks(): Deck[] {
    return Array.from(this.decks.values());
  }

  addDeck(deck: Deck): void {
    this.decks.set(deck.id, deck);
    // Sync to col.decks JSON
    this.syncDecksToCol();
  }

  private syncDecksToCol(): void {
    if (!this.col) return;
    const decksObj: Record<string, Deck> = {};
    this.decks.forEach((deck, id) => {
      decksObj[id] = deck;
    });
    this.col.decks = JSON.stringify(decksObj);
    this.col.mod = nowMillis();
  }

  getDeckConfig(id: string): DeckConfig | undefined {
    return this.deckConfigs.get(id);
  }

  getDeckConfigForDeck(deckId: string): DeckConfig | undefined {
    const deck = this.decks.get(deckId);
    if (!deck) return undefined;
    return this.deckConfigs.get(deck.conf);
  }

  getColConfig(): ColConfig {
    if (!this.colConfig) {
      throw new Error('Collection config not initialized');
    }
    return this.colConfig;
  }

  // ==========================================================================
  // STATS
  // ==========================================================================

  getStats(deckId?: string): {
    newCount: number;
    learningCount: number;
    reviewCount: number;
    totalCards: number;
  } {
    const cards = deckId
      ? this.getCardsByDeck(deckId)
      : this.getAllCards();

    const newCount = cards.filter((c) => c.type === 0).length;
    const learningCount = cards.filter((c) => c.type === 1 || c.type === 3).length;
    const reviewCount = cards.filter((c) => c.type === 2).length;

    return {
      newCount,
      learningCount,
      reviewCount,
      totalCards: cards.length,
    };
  }

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  clear(): void {
    this.cards.clear();
    this.notes.clear();
    this.decks.clear();
    this.deckConfigs.clear();
    this.revlog = [];
    this.graves = [];
    this.initializeCollection();
  }

  incrementNextPos(): number {
    if (!this.colConfig) {
      throw new Error('Collection config not initialized');
    }
    const nextPos = this.colConfig.nextPos;
    this.colConfig.nextPos += 1;
    return nextPos;
  }
}

// Singleton instance
export const db = new InMemoryDb();
