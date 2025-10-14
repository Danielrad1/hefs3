import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Card hint metadata stored locally (multi-level hints with HTML)
 */
export interface CardHint {
  cardId: string;
  // Multi-level hints for progressive disclosure (HTML formatted)
  hintL1: string; // Minimal - schema/constraint only
  hintL2: string; // Constraint - add relational cue
  hintL3: string; // Partial-info - more scaffolding
  tip: string;    // Post-reveal elaboration (HTML formatted)
  obstacle?: 'confusable' | 'mechanism' | 'intuition' | 'decay'; // Diagnosed retrieval obstacle
  // Optional metadata
  confusableContrast?: string; // What it was contrasted against
  tipType?: 'mechanism' | 'structure' | 'concrete-to-rule' | 'mnemonic';
  model?: string;
  version?: string;
  createdAt: number;
  contentHash?: string;
  
  // Legacy support (will be removed)
  frontHint?: string;
  backTip?: string;
}

/**
 * Service to manage AI-generated hints for cards
 * Stores hints in AsyncStorage with content hash for staleness detection
 */
export class CardHintsService {
  private cache: Map<string, CardHint> = new Map();
  private deckIndexCache: Map<string, Set<string>> = new Map();
  private loaded = false;

  /**
   * Generate content hash for a card to detect changes
   * Simple hash function for React Native (no crypto module)
   */
  static generateContentHash(content: { front?: string; back?: string; cloze?: string }): string {
    const text = `${content.front || ''}|${content.back || ''}|${content.cloze || ''}`;
    
    // Simple hash function (djb2)
    let hash = 5381;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) + hash) + text.charCodeAt(i);
    }
    return Math.abs(hash).toString(36).substring(0, 16);
  }

  /**
   * Load all hints from storage
   */
  async load(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const hintKeys = keys.filter(k => k.startsWith('@card_hints:'));
      
      if (hintKeys.length > 0) {
        const entries = await AsyncStorage.multiGet(hintKeys);
        for (const [key, value] of entries) {
          if (value) {
            const hint: CardHint = JSON.parse(value);
            this.cache.set(hint.cardId, hint);
          }
        }
      }

      // Load deck indices
      const indexKeys = keys.filter(k => k.startsWith('@deck_hints_index:'));
      if (indexKeys.length > 0) {
        const indexEntries = await AsyncStorage.multiGet(indexKeys);
        for (const [key, value] of indexEntries) {
          if (value) {
            const deckId = key.replace('@deck_hints_index:', '');
            const cardIds: string[] = JSON.parse(value);
            this.deckIndexCache.set(deckId, new Set(cardIds));
          }
        }
      }

      this.loaded = true;
      console.log('[CardHintsService] Loaded', this.cache.size, 'hints');
    } catch (error) {
      console.error('[CardHintsService] Failed to load:', error);
      this.cache = new Map();
      this.loaded = true;
    }
  }

  /**
   * Get hint for a specific card
   */
  async get(cardId: string): Promise<CardHint | null> {
    if (!this.loaded) {
      await this.load();
    }
    return this.cache.get(cardId) || null;
  }

  /**
   * Get hints for multiple cards
   */
  async getMany(cardIds: string[]): Promise<Map<string, CardHint>> {
    if (!this.loaded) {
      await this.load();
    }

    const results = new Map<string, CardHint>();
    for (const cardId of cardIds) {
      const hint = this.cache.get(cardId);
      if (hint) {
        results.set(cardId, hint);
      }
    }
    return results;
  }

  /**
   * Set hint for a card
   */
  async set(deckId: string, cardId: string, hint: Omit<CardHint, 'cardId'>): Promise<void> {
    if (!this.loaded) {
      await this.load();
    }

    const fullHint: CardHint = {
      cardId,
      ...hint,
    };

    this.cache.set(cardId, fullHint);
    await AsyncStorage.setItem(`@card_hints:${cardId}`, JSON.stringify(fullHint));

    // Update deck index
    let deckCardIds = this.deckIndexCache.get(deckId);
    if (!deckCardIds) {
      deckCardIds = new Set();
      this.deckIndexCache.set(deckId, deckCardIds);
    }
    deckCardIds.add(cardId);
    await AsyncStorage.setItem(
      `@deck_hints_index:${deckId}`,
      JSON.stringify(Array.from(deckCardIds))
    );
  }

  /**
   * Set multiple hints at once (batch operation)
   */
  async setMany(deckId: string, hints: CardHint[]): Promise<void> {
    if (!this.loaded) {
      await this.load();
    }

    const pairs: Array<[string, string]> = [];
    const cardIds: string[] = [];

    for (const hint of hints) {
      this.cache.set(hint.cardId, hint);
      pairs.push([`@card_hints:${hint.cardId}`, JSON.stringify(hint)]);
      cardIds.push(hint.cardId);
    }

    await AsyncStorage.multiSet(pairs);

    // Update deck index
    let deckCardIds = this.deckIndexCache.get(deckId);
    if (!deckCardIds) {
      deckCardIds = new Set();
      this.deckIndexCache.set(deckId, deckCardIds);
    }
    for (const cardId of cardIds) {
      deckCardIds.add(cardId);
    }
    await AsyncStorage.setItem(
      `@deck_hints_index:${deckId}`,
      JSON.stringify(Array.from(deckCardIds))
    );

    console.log('[CardHintsService] Saved', hints.length, 'hints for deck', deckId);
  }

  /**
   * Check if a deck has any hints
   */
  async hasDeckHints(deckId: string): Promise<boolean> {
    if (!this.loaded) {
      await this.load();
    }
    const cardIds = this.deckIndexCache.get(deckId);
    return cardIds ? cardIds.size > 0 : false;
  }

  /**
   * Get all card IDs that have hints for a deck
   */
  async getDeckHintCardIds(deckId: string): Promise<string[]> {
    if (!this.loaded) {
      await this.load();
    }
    const cardIds = this.deckIndexCache.get(deckId);
    return cardIds ? Array.from(cardIds) : [];
  }

  /**
   * Mark a hint as stale (content has changed)
   */
  async markStale(cardId: string): Promise<void> {
    const hint = await this.get(cardId);
    if (hint) {
      hint.contentHash = undefined; // Mark as stale by removing hash
      await AsyncStorage.setItem(`@card_hints:${cardId}`, JSON.stringify(hint));
      this.cache.set(cardId, hint);
    }
  }

  /**
   * Delete hint for a card
   */
  async delete(cardId: string): Promise<void> {
    this.cache.delete(cardId);
    await AsyncStorage.removeItem(`@card_hints:${cardId}`);
  }

  /**
   * Invalidate all hints for a deck
   */
  async invalidateForDeck(deckId: string): Promise<void> {
    if (!this.loaded) {
      await this.load();
    }

    const cardIds = this.deckIndexCache.get(deckId);
    if (cardIds && cardIds.size > 0) {
      const keys = Array.from(cardIds).map(id => `@card_hints:${id}`);
      await AsyncStorage.multiRemove(keys);
      
      for (const cardId of cardIds) {
        this.cache.delete(cardId);
      }
    }

    this.deckIndexCache.delete(deckId);
    await AsyncStorage.removeItem(`@deck_hints_index:${deckId}`);

    console.log('[CardHintsService] Invalidated hints for deck', deckId);
  }

  /**
   * Check if a hint is stale based on content hash
   */
  isStale(hint: CardHint, currentContent: { front?: string; back?: string; cloze?: string }): boolean {
    if (!hint.contentHash) {
      return true; // No hash = consider stale
    }
    const currentHash = CardHintsService.generateContentHash(currentContent);
    return hint.contentHash !== currentHash;
  }
}

// Singleton instance
export const cardHintsService = new CardHintsService();
