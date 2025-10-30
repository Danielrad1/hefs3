/**
 * Test suite for SearchIndex
 * Tests HTML stripping, tokenization, ranking heuristics, deck hierarchy filtering, and updates
 */

import { SearchIndex } from '../SearchIndex';
import { InMemoryDb } from '../../anki/InMemoryDb';
import { AnkiNote, AnkiCard, Deck } from '../../anki/schema';

// Mock logger
jest.mock('../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('SearchIndex', () => {
  let db: InMemoryDb;
  let searchIndex: SearchIndex;

  beforeEach(() => {
    db = new InMemoryDb();
    searchIndex = new SearchIndex(db);
  });

  describe('HTML stripping and tokenization', () => {
    it('strips HTML tags from note fields', () => {
      const note: AnkiNote = {
        id: 'note1',
        guid: 'guid1',
        mid: 'model1',
        mod: Date.now(),
        usn: -1,
        tags: '',
        flds: '<b>Hello</b> <i>World</i>',
        sfld: 0,
        csum: 0,
        flags: 0,
        data: '',
      };

      db.addNote(note);
      searchIndex.indexAll();

      const results = searchIndex.search('hello world');
      expect(results).toContain('note1');
    });

    it('decodes HTML entities', () => {
      const note: AnkiNote = {
        id: 'note1',
        guid: 'guid1',
        mid: 'model1',
        mod: Date.now(),
        usn: -1,
        tags: '',
        flds: 'Test&nbsp;&amp;&lt;&gt;',
        sfld: 0,
        csum: 0,
        flags: 0,
        data: '',
      };

      db.addNote(note);
      searchIndex.indexAll();

      const results = searchIndex.search('test');
      expect(results).toContain('note1');
    });

    it('normalizes whitespace', () => {
      const note: AnkiNote = {
        id: 'note1',
        guid: 'guid1',
        mid: 'model1',
        mod: Date.now(),
        usn: -1,
        tags: '',
        flds: 'Multiple    spaces   and\n\nnewlines',
        sfld: 0,
        csum: 0,
        flags: 0,
        data: '',
      };

      db.addNote(note);
      searchIndex.indexAll();

      const results = searchIndex.search('multiple spaces');
      expect(results).toContain('note1');
    });

    it('converts to lowercase for case-insensitive search', () => {
      const note: AnkiNote = {
        id: 'note1',
        guid: 'guid1',
        mid: 'model1',
        mod: Date.now(),
        usn: -1,
        tags: '',
        flds: 'JavaScript Programming',
        sfld: 0,
        csum: 0,
        flags: 0,
        data: '',
      };

      db.addNote(note);
      searchIndex.indexAll();

      const results = searchIndex.search('javascript');
      expect(results).toContain('note1');
    });
  });

  describe('ranking heuristics', () => {
    beforeEach(() => {
      // Create notes with different match types
      const exactMatch: AnkiNote = {
        id: 'exact',
        guid: 'guid1',
        mid: 'model1',
        mod: Date.now(),
        usn: -1,
        tags: '',
        flds: 'python',
        sfld: 0,
        csum: 0,
        flags: 0,
        data: '',
      };

      const startsWithMatch: AnkiNote = {
        id: 'starts',
        guid: 'guid2',
        mid: 'model1',
        mod: Date.now(),
        usn: -1,
        tags: '',
        flds: 'python programming',
        sfld: 0,
        csum: 0,
        flags: 0,
        data: '',
      };

      const partialMatch: AnkiNote = {
        id: 'partial',
        guid: 'guid3',
        mid: 'model1',
        mod: Date.now(),
        usn: -1,
        tags: '',
        flds: 'I love python language',
        sfld: 0,
        csum: 0,
        flags: 0,
        data: '',
      };

      db.addNote(exactMatch);
      db.addNote(startsWithMatch);
      db.addNote(partialMatch);
      searchIndex.indexAll();
    });

    it('ranks exact match highest', () => {
      const results = searchIndex.search('python');
      
      // All should match
      expect(results).toContain('exact');
      expect(results).toContain('starts');
      expect(results).toContain('partial');
      
      // Exact should be first (or tied for first)
      const exactIndex = results.indexOf('exact');
      expect(exactIndex).toBeLessThanOrEqual(1);
    });

    it('ranks startsWith higher than partial substring', () => {
      const results = searchIndex.search('prog');
      
      expect(results).toContain('starts');
      
      // If partial also matches "prog", starts should rank higher
      const startsIndex = results.indexOf('starts');
      const partialIndex = results.indexOf('partial');
      
      if (partialIndex !== -1) {
        expect(startsIndex).toBeLessThan(partialIndex);
      }
    });
  });

  describe('deck hierarchy filtering', () => {
    beforeEach(() => {
      // Create parent deck
      const parentDeck: Deck = {
        id: 'parent',
        name: 'Languages',
        mod: Date.now(),
        usn: -1,
        collapsed: false,
        browserCollapsed: false,
        desc: '',
        conf: '1',
      };

      // Create child deck with :: separator
      const childDeck: Deck = {
        ...parentDeck,
        id: 'child',
        name: 'Languages::Spanish',
      };

      db.addDeck(parentDeck);
      db.addDeck(childDeck);

      // Add notes with cards in different decks
      const parentNote: AnkiNote = {
        id: 'note1',
        guid: 'guid1',
        mid: 'model1',
        mod: Date.now(),
        usn: -1,
        tags: '',
        flds: 'parent content',
        sfld: 0,
        csum: 0,
        flags: 0,
        data: '',
      };

      const childNote: AnkiNote = {
        id: 'note2',
        guid: 'guid2',
        mid: 'model1',
        mod: Date.now(),
        usn: -1,
        tags: '',
        flds: 'child content',
        sfld: 0,
        csum: 0,
        flags: 0,
        data: '',
      };

      db.addNote(parentNote);
      db.addNote(childNote);

      // Add cards to associate notes with decks
      const parentCard: AnkiCard = {
        id: 'card1',
        nid: 'note1',
        did: 'parent',
        ord: 0,
        mod: Date.now(),
        usn: -1,
        type: 0,
        queue: 0,
        due: 0,
        ivl: 0,
        factor: 2500,
        reps: 0,
        lapses: 0,
        left: 0,
        odue: 0,
        odid: '0',
        flags: 0,
        data: '',
      };

      const childCard: AnkiCard = {
        ...parentCard,
        id: 'card2',
        nid: 'note2',
        did: 'child',
      };

      db.addCard(parentCard);
      db.addCard(childCard);

      searchIndex.indexAll();
    });

    it('includes child decks when filtering by parent deck', () => {
      const results = searchIndex.search('content', { deckId: 'parent' });
      
      // Should include both parent and child notes
      expect(results).toContain('note1');
      expect(results).toContain('note2');
    });

    it('excludes parent when filtering by child deck', () => {
      const results = searchIndex.search('content', { deckId: 'child' });
      
      // Should only include child note
      expect(results).toContain('note2');
      expect(results).not.toContain('note1');
    });
  });

  describe('tag filtering', () => {
    beforeEach(() => {
      const taggedNote: AnkiNote = {
        id: 'note1',
        guid: 'guid1',
        mid: 'model1',
        mod: Date.now(),
        usn: -1,
        tags: 'important reviewed',
        flds: 'tagged content',
        sfld: 0,
        csum: 0,
        flags: 0,
        data: '',
      };

      const untaggedNote: AnkiNote = {
        id: 'note2',
        guid: 'guid2',
        mid: 'model1',
        mod: Date.now(),
        usn: -1,
        tags: '',
        flds: 'untagged content',
        sfld: 0,
        csum: 0,
        flags: 0,
        data: '',
      };

      db.addNote(taggedNote);
      db.addNote(untaggedNote);
      searchIndex.indexAll();
    });

    it('filters by tag', () => {
      const results = searchIndex.search('content', { tag: 'important' });
      
      expect(results).toContain('note1');
      expect(results).not.toContain('note2');
    });

    it('returns empty when tag does not match', () => {
      const results = searchIndex.search('content', { tag: 'nonexistent' });
      
      expect(results).toHaveLength(0);
    });
  });

  describe('updateNote and removeNote', () => {
    it('updates search results after note update', () => {
      const note: AnkiNote = {
        id: 'note1',
        guid: 'guid1',
        mid: 'model1',
        mod: Date.now(),
        usn: -1,
        tags: '',
        flds: 'original content',
        sfld: 0,
        csum: 0,
        flags: 0,
        data: '',
      };

      db.addNote(note);
      searchIndex.indexAll();

      // Original search works
      let results = searchIndex.search('original');
      expect(results).toContain('note1');

      // Update note
      const updatedNote = { ...note, flds: 'updated content' };
      db.updateNote(note.id, { flds: 'updated content' });
      searchIndex.updateNote(updatedNote);

      // Old search no longer works
      results = searchIndex.search('original');
      expect(results).not.toContain('note1');

      // New search works
      results = searchIndex.search('updated');
      expect(results).toContain('note1');
    });

    it('removes note from search after removeNote', () => {
      const note: AnkiNote = {
        id: 'note1',
        guid: 'guid1',
        mid: 'model1',
        mod: Date.now(),
        usn: -1,
        tags: '',
        flds: 'searchable content',
        sfld: 0,
        csum: 0,
        flags: 0,
        data: '',
      };

      db.addNote(note);
      searchIndex.indexAll();

      // Note is searchable
      let results = searchIndex.search('searchable');
      expect(results).toContain('note1');

      // Remove note
      searchIndex.removeNote('note1');

      // Note is no longer searchable
      results = searchIndex.search('searchable');
      expect(results).not.toContain('note1');
    });
  });

  describe('edge cases', () => {
    it('returns empty list for empty query', () => {
      const note: AnkiNote = {
        id: 'note1',
        guid: 'guid1',
        mid: 'model1',
        mod: Date.now(),
        usn: -1,
        tags: '',
        flds: 'content',
        sfld: 0,
        csum: 0,
        flags: 0,
        data: '',
      };

      db.addNote(note);
      searchIndex.indexAll();

      const results = searchIndex.search('');
      expect(results).toHaveLength(0);
    });

    it('limits results when limit option is provided', () => {
      // Add many notes
      for (let i = 0; i < 50; i++) {
        const note: AnkiNote = {
          id: `note${i}`,
          guid: `guid${i}`,
          mid: 'model1',
          mod: Date.now(),
          usn: -1,
          tags: '',
          flds: `test content ${i}`,
          sfld: 0,
          csum: 0,
          flags: 0,
          data: '',
        };
        db.addNote(note);
      }

      searchIndex.indexAll();

      const results = searchIndex.search('test', { limit: 10 });
      expect(results.length).toBeLessThanOrEqual(10);
    });

    it('handles notes with no matches', () => {
      const note: AnkiNote = {
        id: 'note1',
        guid: 'guid1',
        mid: 'model1',
        mod: Date.now(),
        usn: -1,
        tags: '',
        flds: 'content',
        sfld: 0,
        csum: 0,
        flags: 0,
        data: '',
      };

      db.addNote(note);
      searchIndex.indexAll();

      const results = searchIndex.search('nonexistent');
      expect(results).toHaveLength(0);
    });
  });

  describe('getPreview', () => {
    it('returns preview text for a note', () => {
      const note: AnkiNote = {
        id: 'note1',
        guid: 'guid1',
        mid: 'model1',
        mod: Date.now(),
        usn: -1,
        tags: '',
        flds: 'This is some content',
        sfld: 0,
        csum: 0,
        flags: 0,
        data: '',
      };

      db.addNote(note);
      searchIndex.indexAll();

      const preview = searchIndex.getPreview('note1');
      expect(preview).toBe('This is some content');
    });

    it('truncates long text with ellipsis', () => {
      const longText = 'a'.repeat(200);
      const note: AnkiNote = {
        id: 'note1',
        guid: 'guid1',
        mid: 'model1',
        mod: Date.now(),
        usn: -1,
        tags: '',
        flds: longText,
        sfld: 0,
        csum: 0,
        flags: 0,
        data: '',
      };

      db.addNote(note);
      searchIndex.indexAll();

      const preview = searchIndex.getPreview('note1', 50);
      expect(preview.length).toBeLessThanOrEqual(54); // 50 + '...'
      expect(preview.endsWith('...')).toBe(true);
    });
  });
});
