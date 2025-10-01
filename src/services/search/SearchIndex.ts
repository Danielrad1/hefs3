/**
 * SearchIndex - Full-text search for notes
 * Simple token-based search with ranking
 */

import { AnkiNote } from '../anki/schema';
import { InMemoryDb } from '../anki/InMemoryDb';

interface IndexedNote {
  noteId: string;
  deckIds: string[]; // Decks this note's cards are in
  tokens: string[]; // Normalized tokens for search
  rawText: string; // Raw text for preview
  tags: string[];
}

export class SearchIndex {
  private index: Map<string, IndexedNote> = new Map();

  constructor(private db: InMemoryDb) {}

  /**
   * Index all notes in the database
   */
  indexAll(): void {
    this.index.clear();
    const notes = this.db.getAllNotes();
    notes.forEach((note) => this.indexNote(note));
    console.log(`[SearchIndex] Indexed ${notes.length} notes`);
  }

  /**
   * Index a single note
   */
  indexNote(note: AnkiNote): void {
    // Get decks for this note's cards
    const cards = this.db.getAllCards().filter((c) => c.nid === note.id);
    const deckIds = Array.from(new Set(cards.map((c) => c.did)));

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

    this.index.forEach((indexed) => {
      // Filter by deck if specified
      if (options?.deckId) {
        const deck = this.db.getDeck(options.deckId);
        if (deck) {
          // Check if any of this note's cards are in the deck or its children
          const deckName = deck.name;
          const matchesDeck = indexed.deckIds.some((deckId) => {
            const cardDeck = this.db.getDeck(deckId);
            return (
              cardDeck &&
              (cardDeck.name === deckName || cardDeck.name.startsWith(deckName + '::'))
            );
          });
          if (!matchesDeck) return;
        }
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
