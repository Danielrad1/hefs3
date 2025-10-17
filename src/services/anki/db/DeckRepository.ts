/**
 * Deck Repository
 * Handles all CRUD operations for decks and deck configs
 */

import { Deck, DeckConfig, AnkiCol, AnkiGrave, ColConfig } from '../schema';
import { nowSeconds, nowMillis } from '../time';

export class DeckRepository {
  private decks: Map<string, Deck>;
  private deckConfigs: Map<string, DeckConfig>;
  private getColConfigFn: () => ColConfig | null;
  private getColFn: () => AnkiCol | null;
  private graves: AnkiGrave[];
  private usn: number;

  constructor(
    decks: Map<string, Deck>,
    deckConfigs: Map<string, DeckConfig>,
    getColConfig: () => ColConfig | null,
    getCol: () => AnkiCol | null,
    graves: AnkiGrave[],
    usn: number
  ) {
    this.decks = decks;
    this.deckConfigs = deckConfigs;
    this.getColConfigFn = getColConfig;
    this.getColFn = getCol;
    this.graves = graves;
    this.usn = usn;
  }

  /**
   * Update USN (needed after database restore)
   */
  setUsn(usn: number): void {
    this.usn = usn;
  }

  // Deck operations
  getDeck(id: string): Deck | undefined {
    return this.decks.get(id);
  }

  getAllDecks(): Deck[] {
    return Array.from(this.decks.values());
  }

  addDeck(deck: Deck): void {
    this.decks.set(deck.id, deck);
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
      type: 2, // deck
    });
    this.syncDecksToCol();
  }

  private syncDecksToCol(): void {
    const col = this.getColFn();
    if (!col) return;
    const decksObj: Record<string, Deck> = {};
    this.decks.forEach((deck, id) => {
      decksObj[id] = deck;
    });
    col.decks = JSON.stringify(decksObj);
    col.mod = nowMillis();
  }

  // Deck config operations
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
    const col = this.getColFn();
    if (!col) return;
    const configsObj: Record<string, DeckConfig> = {};
    this.deckConfigs.forEach((config, id) => {
      configsObj[id] = config;
    });
    col.dconf = JSON.stringify(configsObj);
    col.mod = nowMillis();
  }

  getDeckConfigForDeck(deckId: string): DeckConfig | undefined {
    const deck = this.decks.get(deckId);
    if (!deck) return undefined;
    return this.deckConfigs.get(deck.conf);
  }

  getColConfig(): ColConfig {
    const colConfig = this.getColConfigFn();
    if (!colConfig) {
      throw new Error('Collection config not initialized');
    }
    return colConfig;
  }

  /**
   * Increment and return the next position for new cards
   * This is used to maintain sequential ordering of new cards
   */
  incrementNextPos(): number {
    const colConfig = this.getColConfigFn();
    if (!colConfig) {
      throw new Error('Collection config not initialized');
    }
    const currentPos = colConfig.nextPos;
    colConfig.nextPos += 1;

    // Sync to col.conf JSON
    const col = this.getColFn();
    if (col) {
      col.conf = JSON.stringify(colConfig);
      col.mod = nowMillis();
    }

    return currentPos;
  }
}
