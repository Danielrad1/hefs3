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
  Model,
  Media,
  DEFAULT_DECK_ID,
  DEFAULT_MODEL_ID,
  MODEL_TYPE_STANDARD,
  MODEL_TYPE_CLOZE,
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
  private models: Map<number, Model> = new Map();  // Anki uses numeric IDs
  private media: Map<string, Media> = new Map();
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

    // Create default Basic model
    const basicModel: Model = {
      id: DEFAULT_MODEL_ID,
      name: 'Basic',
      type: MODEL_TYPE_STANDARD,
      mod: now,
      usn: this.usn,
      sortf: 0,
      did: DEFAULT_DECK_ID,
      tmpls: [
        {
          name: 'Card 1',
          ord: 0,
          qfmt: '{{Front}}',
          afmt: '{{FrontSide}}\n\n<hr id="answer">\n\n{{Back}}',
          bqfmt: '',
          bafmt: '',
          did: null,
        },
      ],
      flds: [
        {
          name: 'Front',
          ord: 0,
          sticky: false,
          rtl: false,
          font: 'Arial',
          size: 20,
          description: '',
        },
        {
          name: 'Back',
          ord: 1,
          sticky: false,
          rtl: false,
          font: 'Arial',
          size: 20,
          description: '',
        },
      ],
      css: '.card {\n font-family: arial;\n font-size: 20px;\n text-align: center;\n color: black;\n background-color: white;\n}',
      latexPre: '',
      latexPost: '',
      req: [[0, 'all', [0]]],
      tags: [],
    };

    // Create default Cloze model
    const clozeModel: Model = {
      id: 2,
      name: 'Cloze',
      type: MODEL_TYPE_CLOZE,
      mod: now,
      usn: this.usn,
      sortf: 0,
      did: DEFAULT_DECK_ID,
      tmpls: [
        {
          name: 'Cloze',
          ord: 0,
          qfmt: '{{cloze:Text}}',
          afmt: '{{cloze:Text}}<br>{{Extra}}',
          bqfmt: '',
          bafmt: '',
          did: null,
        },
      ],
      flds: [
        {
          name: 'Text',
          ord: 0,
          sticky: false,
          rtl: false,
          font: 'Arial',
          size: 20,
          description: '',
        },
        {
          name: 'Extra',
          ord: 1,
          sticky: false,
          rtl: false,
          font: 'Arial',
          size: 20,
          description: '',
        },
      ],
      css: '.card {\n font-family: arial;\n font-size: 20px;\n text-align: center;\n color: black;\n background-color: white;\n}\n.cloze {\n font-weight: bold;\n color: blue;\n}',
      latexPre: '',
      latexPost: '',
      req: [[0, 'all', [0]]],
      tags: [],
    };

    this.decks.set(DEFAULT_DECK_ID, defaultDeck);
    this.deckConfigs.set('1', defaultDeckConfig);
    this.models.set(DEFAULT_MODEL_ID, basicModel);
    this.models.set(2, clozeModel);
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
      models: JSON.stringify({ [DEFAULT_MODEL_ID]: basicModel, '2': clozeModel }),
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

  updateDeck(id: string, updates: Partial<Deck>): void {
    const deck = this.decks.get(id);
    if (!deck) {
      throw new Error(`Deck ${id} not found`);
    }
    this.decks.set(id, {
      ...deck,
      ...updates,
      mod: nowSeconds(),
      usn: this.usn,
    });
    this.syncDecksToCol();
  }

  deleteDeck(id: string): void {
    this.decks.delete(id);
    this.graves.push({
      usn: this.usn,
      oid: id,
      type: 2,  // deck
    });
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

  getAllDeckConfigs(): DeckConfig[] {
    return Array.from(this.deckConfigs.values());
  }

  addDeckConfig(config: DeckConfig): void {
    this.deckConfigs.set(config.id, config);
    this.syncDeckConfigsToCol();
  }

  updateDeckConfig(id: string, updates: Partial<DeckConfig>): void {
    const config = this.deckConfigs.get(id);
    if (!config) {
      throw new Error(`Deck config ${id} not found`);
    }
    this.deckConfigs.set(id, {
      ...config,
      ...updates,
      mod: nowSeconds(),
      usn: this.usn,
    });
    this.syncDeckConfigsToCol();
  }

  private syncDeckConfigsToCol(): void {
    if (!this.col) return;
    const configsObj: Record<string, DeckConfig> = {};
    this.deckConfigs.forEach((config, id) => {
      configsObj[id] = config;
    });
    this.col.dconf = JSON.stringify(configsObj);
    this.col.mod = nowMillis();
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
  // MODELS
  // ==========================================================================

  getModel(id: string | number): Model | undefined {
    // Accept both string and number, convert to number (Anki uses numbers)
    const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
    return this.models.get(numericId);
  }

  getAllModels(): Model[] {
    return Array.from(this.models.values());
  }

  addModel(model: Model): void {
    // Ensure ID is a number (Anki way)
    const normalizedModel = {
      ...model,
      id: typeof model.id === 'string' ? parseInt(model.id, 10) : model.id,
    };
    this.models.set(normalizedModel.id, normalizedModel);
    this.syncModelsToCol();
  }

  updateModel(id: string | number, updates: Partial<Model>): void {
    const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
    const model = this.models.get(numericId);
    if (!model) {
      throw new Error(`Model ${id} not found`);
    }
    this.models.set(numericId, {
      ...model,
      ...updates,
      mod: nowSeconds(),
      usn: this.usn,
    });
    this.syncModelsToCol();
  }

  deleteModel(id: string | number): void {
    const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
    this.models.delete(numericId);
    this.syncModelsToCol();
  }

  private syncModelsToCol(): void {
    if (!this.col) return;
    const modelsObj: Record<string, Model> = {};
    this.models.forEach((model, id) => {
      modelsObj[id] = model;
    });
    this.col.models = JSON.stringify(modelsObj);
    this.col.mod = nowMillis();
  }

  // ==========================================================================
  // MEDIA
  // ==========================================================================

  getMedia(id: string): Media | undefined {
    return this.media.get(id);
  }

  getMediaByFilename(filename: string): Media | undefined {
    return Array.from(this.media.values()).find((m) => m.filename === filename);
  }

  getMediaBySha1(sha1: string): Media | undefined {
    return Array.from(this.media.values()).find((m) => m.sha1 === sha1);
  }

  getAllMedia(): Media[] {
    return Array.from(this.media.values());
  }

  addMedia(media: Media): void {
    this.media.set(media.id, media);
  }

  deleteMedia(id: string): void {
    this.media.delete(id);
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
    this.models.clear();
    this.media.clear();
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

  // ==========================================================================
  // PERSISTENCE (JSON Snapshots)
  // ==========================================================================

  /**
   * Export database to JSON for persistence
   */
  toJSON(): string {
    const snapshot = {
      version: 1,
      col: this.col,
      cards: Array.from(this.cards.values()),
      notes: Array.from(this.notes.values()),
      revlog: this.revlog,
      graves: this.graves,
      decks: Array.from(this.decks.values()),
      deckConfigs: Array.from(this.deckConfigs.values()),
      models: Array.from(this.models.values()),
      media: Array.from(this.media.values()),
      colConfig: this.colConfig,
      usn: this.usn,
    };
    return JSON.stringify(snapshot);
  }

  /**
   * Import database from JSON
   */
  fromJSON(json: string): void {
    const snapshot = JSON.parse(json);

    // Clear existing data
    this.cards.clear();
    this.notes.clear();
    this.decks.clear();
    this.deckConfigs.clear();
    this.models.clear();
    this.media.clear();
    this.revlog = [];
    this.graves = [];

    // Restore data
    this.col = snapshot.col;
    snapshot.cards.forEach((card: AnkiCard) => this.cards.set(card.id, card));
    snapshot.notes.forEach((note: AnkiNote) => this.notes.set(note.id, note));
    this.revlog = snapshot.revlog || [];
    this.graves = snapshot.graves || [];
    snapshot.decks.forEach((deck: Deck) => this.decks.set(deck.id, deck));
    snapshot.deckConfigs.forEach((conf: DeckConfig) => this.deckConfigs.set(conf.id, conf));
    snapshot.models.forEach((model: Model) => this.models.set(model.id, model));
    snapshot.media.forEach((media: Media) => this.media.set(media.id, media));
    this.colConfig = snapshot.colConfig;
    this.usn = snapshot.usn;
  }
}

// Singleton instance
export const db = new InMemoryDb();
