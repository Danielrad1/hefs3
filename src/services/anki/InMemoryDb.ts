/**
 * In-memory database matching Anki schema
 * Coordinates access to data through specialized repositories
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
  MODEL_TYPE_IMAGE_OCCLUSION,
} from './schema';
import { nowSeconds, nowMillis, generateId } from './time';
import { todayUsageRepository } from './db/TodayUsageRepository';
import { logger } from '../../utils/logger';
import {
  CardRepository,
  NoteRepository,
  DeckRepository,
  ModelRepository,
  MediaRepository,
  RevlogRepository,
  StatsRepository,
} from './db';

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
  private models: Map<number, Model> = new Map(); // Anki uses numeric IDs
  private media: Map<string, Media> = new Map();
  private colConfig: ColConfig | null = null;

  // Update sequence number (local changes = -1)
  private usn: number = -1;

  // Repositories
  private cardRepo: CardRepository;
  private noteRepo: NoteRepository;
  private deckRepo: DeckRepository;
  private modelRepo: ModelRepository;
  private mediaRepo: MediaRepository;
  private revlogRepo: RevlogRepository;
  private statsRepo: StatsRepository;

  constructor() {
    // Initialize repositories with getters to access current state
    this.cardRepo = new CardRepository(this.cards, this.graves, this.usn);
    this.noteRepo = new NoteRepository(this.notes, this.graves, this.usn);
    this.deckRepo = new DeckRepository(
      this.decks,
      this.deckConfigs,
      () => this.colConfig,
      () => this.col,
      this.graves,
      this.usn
    );
    this.modelRepo = new ModelRepository(this.models, () => this.col, this.usn);
    this.mediaRepo = new MediaRepository(this.media);
    this.revlogRepo = new RevlogRepository(this.revlog);
    this.statsRepo = new StatsRepository(this.cards);

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
      activeDecks: [], // Empty = use all decks (don't restrict to Default only)
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

    // Create default Image Occlusion model
    const imageOcclusionModel: Model = {
      id: 3,
      name: 'Image Occlusion',
      type: MODEL_TYPE_IMAGE_OCCLUSION,
      mod: now,
      usn: this.usn,
      sortf: 0,
      did: DEFAULT_DECK_ID,
      tmpls: [
        {
          name: 'Image Occlusion',
          ord: 0,
          qfmt: '<io-occlude data="{{OcclusionData}}"></io-occlude>',
          afmt: '<io-occlude data="{{OcclusionData}}" reveal="true"></io-occlude><br>{{Extra}}',
          bqfmt: '',
          bafmt: '',
          did: null,
        },
      ],
      flds: [
        {
          name: 'Image',
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
      css: '.card {\n font-family: arial;\n font-size: 20px;\n text-align: center;\n color: black;\n background-color: white;\n}',
      latexPre: '',
      latexPost: '',
      req: [[0, 'all', [0]]],
      tags: [],
    };

    this.decks.set(DEFAULT_DECK_ID, defaultDeck);
    this.deckConfigs.set('1', defaultDeckConfig);
    this.models.set(DEFAULT_MODEL_ID, basicModel);
    this.models.set(2, clozeModel);
    this.models.set(3, imageOcclusionModel);
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
      models: JSON.stringify({ [DEFAULT_MODEL_ID]: basicModel, '2': clozeModel, '3': imageOcclusionModel }),
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
    return this.cardRepo.get(id);
  }

  getAllCards(): AnkiCard[] {
    return this.cardRepo.getAll();
  }

  getCardsByDeck(deckId: string): AnkiCard[] {
    return this.cardRepo.getByDeck(deckId);
  }

  addCard(card: AnkiCard): void {
    this.cardRepo.add(card);
  }

  updateCard(id: string, updates: Partial<AnkiCard>): void {
    this.cardRepo.update(id, updates);
  }

  deleteCard(id: string): void {
    this.cardRepo.delete(id);
  }

  // ==========================================================================
  // NOTES
  // ==========================================================================

  getNote(id: string): AnkiNote | undefined {
    return this.noteRepo.get(id);
  }

  getAllNotes(): AnkiNote[] {
    return this.noteRepo.getAll();
  }

  addNote(note: AnkiNote): void {
    this.noteRepo.add(note);
  }

  updateNote(id: string, updates: Partial<AnkiNote>): void {
    this.noteRepo.update(id, updates);
  }

  deleteNote(id: string): void {
    this.noteRepo.delete(id);
  }

  // ==========================================================================
  // REVLOG
  // ==========================================================================

  addRevlog(entry: AnkiRevlog): void {
    this.revlogRepo.add(entry);
  }

  getRevlogForCard(cardId: string): AnkiRevlog[] {
    return this.revlogRepo.getForCard(cardId);
  }

  getAllRevlog(): AnkiRevlog[] {
    return this.revlogRepo.getAll();
  }

  // ==========================================================================
  // DECKS & CONFIGS
  // ==========================================================================

  getDeck(id: string): Deck | undefined {
    return this.deckRepo.getDeck(id);
  }

  getAllDecks(): Deck[] {
    return this.deckRepo.getAllDecks();
  }

  addDeck(deck: Deck): void {
    this.deckRepo.addDeck(deck);
  }

  updateDeck(id: string, updates: Partial<Deck>): void {
    this.deckRepo.updateDeck(id, updates);
  }

  deleteDeck(id: string): void {
    this.deckRepo.deleteDeck(id);
  }

  getDeckConfig(id: string): DeckConfig | undefined {
    return this.deckRepo.getDeckConfig(id);
  }

  getAllDeckConfigs(): DeckConfig[] {
    return this.deckRepo.getAllDeckConfigs();
  }

  addDeckConfig(config: DeckConfig): void {
    this.deckRepo.addDeckConfig(config);
  }

  updateDeckConfig(id: string, updates: Partial<DeckConfig>): void {
    this.deckRepo.updateDeckConfig(id, updates);
  }

  getDeckConfigForDeck(deckId: string): DeckConfig | undefined {
    return this.deckRepo.getDeckConfigForDeck(deckId);
  }

  getColConfig(): ColConfig {
    return this.deckRepo.getColConfig();
  }

  /**
   * Increment and return the next position for new cards
   * This is used to maintain sequential ordering of new cards
   */
  incrementNextPos(): number {
    return this.deckRepo.incrementNextPos();
  }

  // ==========================================================================
  // MODELS
  // ==========================================================================

  getModel(id: string | number): Model | undefined {
    return this.modelRepo.get(id);
  }

  getAllModels(): Model[] {
    return this.modelRepo.getAll();
  }

  addModel(model: Model): void {
    this.modelRepo.add(model);
  }

  updateModel(id: string | number, updates: Partial<Model>): void {
    this.modelRepo.update(id, updates);
  }

  deleteModel(id: string | number): void {
    this.modelRepo.delete(id);
  }

  // ==========================================================================
  // MEDIA
  // ==========================================================================

  getMedia(id: string): Media | undefined {
    return this.mediaRepo.get(id);
  }

  getMediaByFilename(filename: string): Media | undefined {
    return this.mediaRepo.getByFilename(filename);
  }

  getMediaByHash(hash: string): Media | undefined {
    return this.mediaRepo.getByHash(hash);
  }

  getAllMedia(): Media[] {
    return this.mediaRepo.getAll();
  }

  addMedia(media: Media): void {
    this.mediaRepo.add(media);
  }

  deleteMedia(id: string): void {
    this.mediaRepo.delete(id);
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
    return this.statsRepo.getStats(deckId);
  }

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  clear(): void {
    logger.info('[InMemoryDb] Clearing all data...');
    this.cards.clear();
    this.notes.clear();
    this.decks.clear();
    this.deckConfigs.clear();
    this.models.clear();
    this.media.clear();
    this.revlog.length = 0; // Clear in-place to maintain repository references
    this.graves.length = 0; // Clear in-place to maintain repository references
    this.col = null;
    this.colConfig = null;
    
    // Reinitialize with defaults
    this.initializeCollection();
    logger.info('[InMemoryDb] Database cleared and reinitialized');
  }

  /**
   * Remove orphaned cards (cards without notes)
   */
  cleanupOrphanedCards(): number {
    const allCards = this.getAllCards();
    let removedCount = 0;
    
    allCards.forEach(card => {
      const note = this.notes.get(card.nid);
      if (!note) {
        logger.warn('[InMemoryDb] Removing orphaned card:', card.id, 'missing note:', card.nid);
        this.cards.delete(card.id);
        removedCount++;
      }
    });
    
    if (removedCount > 0) {
      logger.info('[InMemoryDb] Removed', removedCount, 'orphaned cards');
    }
    
    return removedCount;
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
      timestamp: Date.now(),
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
      todayUsage: todayUsageRepository.toJSON(), // Include today usage data
    };
    return JSON.stringify(snapshot);
  }

  /**
   * Import database from JSON with validation
   * @throws Error if snapshot is invalid or corrupted
   */
  fromJSON(json: string): void {
    let snapshot: any;
    
    // Parse with error handling
    try {
      snapshot = JSON.parse(json);
    } catch (parseError) {
      throw new Error(`Failed to parse database snapshot: ${parseError instanceof Error ? parseError.message : 'Invalid JSON'}`);
    }

    // Validate required fields
    if (!snapshot || typeof snapshot !== 'object') {
      throw new Error('Invalid snapshot: must be an object');
    }
    
    if (!snapshot.version || typeof snapshot.version !== 'number') {
      throw new Error('Invalid snapshot: missing or invalid version');
    }
    
    if (snapshot.version !== 1) {
      throw new Error(`Unsupported snapshot version: ${snapshot.version}`);
    }
    
    // Validate required arrays
    const requiredArrays = ['cards', 'notes', 'decks', 'deckConfigs', 'models', 'media'];
    for (const field of requiredArrays) {
      if (!Array.isArray(snapshot[field])) {
        throw new Error(`Invalid snapshot: ${field} must be an array`);
      }
    }
    
    if (!snapshot.col || typeof snapshot.col !== 'object') {
      throw new Error('Invalid snapshot: col must be an object');
    }

    logger.info('[InMemoryDb] Restoring snapshot from', snapshot.timestamp ? new Date(snapshot.timestamp).toISOString() : 'unknown time');

    // Clear existing data
    this.cards.clear();
    this.notes.clear();
    this.decks.clear();
    this.deckConfigs.clear();
    this.models.clear();
    this.media.clear();
    this.revlog.length = 0; // Clear array in-place to maintain repository references
    this.graves.length = 0; // Clear array in-place to maintain repository references

    // Restore data
    try {
      this.col = snapshot.col;
      snapshot.cards.forEach((card: AnkiCard) => this.cards.set(card.id, card));
      snapshot.notes.forEach((note: AnkiNote) => this.notes.set(note.id, note));
      // Push to arrays in-place to maintain repository references
      if (snapshot.revlog && Array.isArray(snapshot.revlog)) {
        this.revlog.push(...snapshot.revlog);
      }
      if (snapshot.graves && Array.isArray(snapshot.graves)) {
        this.graves.push(...snapshot.graves);
      }
      snapshot.decks.forEach((deck: Deck) => this.decks.set(deck.id, deck));
      snapshot.deckConfigs.forEach((conf: DeckConfig) => this.deckConfigs.set(conf.id, conf));
      // Convert model IDs to numbers (JSON keys are strings)
      snapshot.models.forEach((model: Model) => {
        const numericId = typeof model.id === 'string' ? parseInt(model.id, 10) : model.id;
        this.models.set(numericId, { ...model, id: numericId });
      });
      snapshot.media.forEach((media: Media) => this.media.set(media.id, media));
      this.colConfig = snapshot.colConfig;
      this.usn = snapshot.usn;
      
      // Restore today usage data (backward compatible - optional field)
      if (snapshot.todayUsage) {
        todayUsageRepository.fromJSON(snapshot.todayUsage);
      }
      
      // Propagate USN to all repositories to prevent stale USN values
      this.cardRepo.setUsn(this.usn);
      this.noteRepo.setUsn(this.usn);
      this.deckRepo.setUsn(this.usn);
      this.modelRepo.setUsn(this.usn);
      
      // Cleanup orphaned cards after loading
      const orphanedCount = this.cleanupOrphanedCards();
      if (orphanedCount > 0) {
        logger.info('[InMemoryDb] Cleaned up', orphanedCount, 'orphaned cards after loading');
      }
      
      logger.info('[InMemoryDb] Snapshot restored successfully');
    } catch (restoreError) {
      // If restoration fails, reinitialize to prevent corrupted state
      logger.error('[InMemoryDb] Failed to restore snapshot, reinitializing:', restoreError);
      this.clear();
      throw new Error(`Failed to restore database snapshot: ${restoreError instanceof Error ? restoreError.message : 'Unknown error'}`);
    }
  }
}

// Singleton instance
export const db = new InMemoryDb();
