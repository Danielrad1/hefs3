/**
 * SearchIndex - Full-text search for notes
 * Simple token-based search with ranking
 */

import { AnkiNote } from '../anki/schema';
import { InMemoryDb } from '../anki/InMemoryDb';
import { logger } from '../../utils/logger';

interface IndexedNote {
  noteId: string;
  deckIds: string[]; // Decks this note's cards are in
  tokens: string[]; // Normalized tokens for search
  rawText: string; // Raw text for preview
  tags: string[];
}

export class SearchIndex {
  private index: Map<string, IndexedNote> = new Map();
  private noteToCardsCache: Map<string, string[]> = new Map();

  constructor(private db: InMemoryDb) {}

  /**
   * Index all notes in the database
   */
  indexAll(): void {
    this.index.clear();
    this.noteToCardsCache.clear();
    
    // Pre-compute note→card lookup to avoid O(n²)
    const allCards = this.db.getAllCards();
    allCards.forEach((card) => {
      const existing = this.noteToCardsCache.get(card.nid) || [];
      existing.push(card.did);
      this.noteToCardsCache.set(card.nid, existing);
    });
    
    const notes = this.db.getAllNotes();
    notes.forEach((note) => this.indexNote(note));
    logger.info(`[SearchIndex] Indexed ${notes.length} notes`);
  }

  /**
   * Index a single note
   */
  indexNote(note: AnkiNote): void {
    // Use cached note→card lookup for O(1) performance
    const cardDeckIds = this.noteToCardsCache.get(note.id) || [];
    const deckIds = Array.from(new Set(cardDeckIds));

    // Strip HTML and tokenize
    const rawText = this.stripHtml(note.flds);
    const tokens = this.tokenize(rawText);

    // Extract tags
    const tags = note.tags
      .trim()
      .split(/\s+/)
      .filter((t) => t.length > 0);

    this.index.set(note.id, {
      noteId: note.id,
      deckIds,
      tokens,
      rawText,
      tags,
    });
  }

  /**
   * Update a note in the index
   */
  updateNote(note: AnkiNote): void {
    this.indexNote(note);
  }

  /**
   * Remove a note from the index
   */
  removeNote(noteId: string): void {
    this.index.delete(noteId);
  }

  /**
   * Search notes by text query
   * Returns note IDs ranked by relevance
   */
  search(query: string, options?: { deckId?: string; tag?: string; limit?: number }): string[] {
    const queryTokens = this.tokenize(query.toLowerCase());
    
    if (queryTokens.length === 0) {
      return [];
    }

    const results: Array<{ noteId: string; score: number }> = [];

    // Pre-compute deck hierarchy for filtering
    let targetDeckIds: Set<string> | null = null;
    if (options?.deckId) {
      targetDeckIds = this.getDeckAndChildren(options.deckId);
    }

    this.index.forEach((indexed) => {
      // Filter by deck if specified (using deck ID hierarchy)
      if (targetDeckIds && !indexed.deckIds.some(deckId => targetDeckIds!.has(deckId))) {
        return;
      }

      // Filter by tag if specified
      if (options?.tag && !indexed.tags.includes(options.tag)) {
        return;
      }

      // Calculate relevance score
      let score = 0;

      queryTokens.forEach((queryToken) => {
        indexed.tokens.forEach((indexToken) => {
          if (indexToken.includes(queryToken)) {
            // Exact match scores higher than partial match
            if (indexToken === queryToken) {
              score += 10;
            } else if (indexToken.startsWith(queryToken)) {
              score += 5;
            } else {
              score += 2;
            }
          }
        });

        // Bonus for tag matches
        indexed.tags.forEach((tag) => {
          if (tag.toLowerCase().includes(queryToken)) {
            score += 15;
          }
        });
      });

      if (score > 0) {
        results.push({ noteId: indexed.noteId, score });
      }
    });

    // Sort by score (descending)
    results.sort((a, b) => b.score - a.score);

    // Apply limit
    const limit = options?.limit || 100;
    return results.slice(0, limit).map((r) => r.noteId);
  }

  /**
   * Get preview text for a note
   */
  getPreview(noteId: string, maxLength: number = 100): string {
    const indexed = this.index.get(noteId);
    if (!indexed) return '';

    if (indexed.rawText.length <= maxLength) {
      return indexed.rawText;
    }

    return indexed.rawText.substring(0, maxLength) + '...';
  }

  /**
   * Strip HTML tags from text
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]+>/g, ' ') // Remove HTML tags
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/\x1f/g, ' ') // Replace field separator
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Tokenize text into normalized words
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .split(/\s+/)
      .filter((token) => token.length > 1); // Filter out single chars
  }

  /**
   * Get deck and all its children IDs
   * Uses deck hierarchy (parent::child) to find descendants
   */
  private getDeckAndChildren(deckId: string): Set<string> {
    const deck = this.db.getDeck(deckId);
    if (!deck) return new Set([deckId]);
    
    const deckIds = new Set<string>([deckId]);
    const allDecks = this.db.getAllDecks();
    
    // Find all decks that are children of this deck
    // A child deck's name starts with "parent::child"
    allDecks.forEach((d) => {
      if (d.id !== deckId && d.name.startsWith(deck.name + '::')) {
        deckIds.add(d.id);
      }
    });
    
    return deckIds;
  }

  /**
   * Get index statistics
   */
  getStats() {
    return {
      totalNotes: this.index.size,
      totalTokens: Array.from(this.index.values()).reduce(
        (sum, indexed) => sum + indexed.tokens.length,
        0
      ),
    };
  }
}
