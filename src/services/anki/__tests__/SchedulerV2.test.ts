/**
 * SchedulerV2 Tests - Queue selection, answering, transitions
 */

import { SchedulerV2 } from '../SchedulerV2';
import { InMemoryDb } from '../InMemoryDb';
import { CardType, CardQueue, RevlogEase } from '../schema';
import { createTestCard, createTestNote, createReviewCard } from './helpers/factories';

describe('SchedulerV2', () => {
  let db: InMemoryDb;
  let scheduler: SchedulerV2;
  let fixedNow: number;

  beforeEach(() => {
    // Freeze time for deterministic tests
    fixedNow = new Date('2025-01-15T10:00:00.000Z').getTime();
    jest.useFakeTimers();
    jest.setSystemTime(fixedNow);
    
    db = new InMemoryDb();
    scheduler = new SchedulerV2(db);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Queue Selection - getNext()', () => {
    it('should return null when no cards available', () => {
      const next = scheduler.getNext();
      expect(next).toBeNull();
    });

    it('should prioritize learning cards over others', () => {
      const note1 = createTestNote({ id: 'note1' });
      const note2 = createTestNote({ id: 'note2' });
      const note3 = createTestNote({ id: 'note3' });
      db.addNote(note1);
      db.addNote(note2);
      db.addNote(note3);

      // Add learning, review, and new cards
      const now = Math.floor(Date.now() / 1000);
      
      db.addCard(createTestCard({
        id: 'new1',
        nid: 'note1',
        type: CardType.New,
        queue: CardQueue.New,
      }));

      db.addCard(createReviewCard({
        id: 'review1',
        nid: 'note2',
        type: CardType.Review,
        queue: CardQueue.Review,
        due: 0, // Due today
      }));

      db.addCard(createTestCard({
        id: 'learning1',
        nid: 'note3',
        type: CardType.Learning,
        queue: CardQueue.Learning,
        due: now - 100, // Due now
      }));

      const next = scheduler.getNext();
      expect(next?.id).toBe('learning1');
    });

    it('should prioritize review cards over new cards', () => {
      const note1 = createTestNote({ id: 'note1' });
      const note2 = createTestNote({ id: 'note2' });
      db.addNote(note1);
      db.addNote(note2);

      db.addCard(createTestCard({
        id: 'new1',
        nid: 'note1',
        type: CardType.New,
        queue: CardQueue.New,
      }));

      db.addCard(createReviewCard({
        id: 'review1',
        nid: 'note2',
        type: CardType.Review,
        queue: CardQueue.Review,
        due: 0, // Due today
      }));

      const next = scheduler.getNext();
      expect(next?.id).toBe('review1');
    });

    it('should return new cards when no learning or review cards', () => {
      const note = createTestNote({ id: 'note1' });
      db.addNote(note);

      db.addCard(createTestCard({
        id: 'new1',
        nid: 'note1',
        type: CardType.New,
        queue: CardQueue.New,
      }));

      const next = scheduler.getNext();
      expect(next?.id).toBe('new1');
    });

    it('should skip suspended cards', () => {
      const note1 = createTestNote({ id: 'note1' });
      const note2 = createTestNote({ id: 'note2' });
      db.addNote(note1);
      db.addNote(note2);

      db.addCard(createTestCard({
        id: 'suspended1',
        nid: 'note1',
        type: CardType.New,
        queue: CardQueue.Suspended,
      }));

      db.addCard(createTestCard({
        id: 'new1',
        nid: 'note2',
        type: CardType.New,
        queue: CardQueue.New,
      }));

      const next = scheduler.getNext();
      expect(next?.id).toBe('new1');
    });

    it('should filter by deck when deckId provided', () => {
      const note1 = createTestNote({ id: 'note1' });
      const note2 = createTestNote({ id: 'note2' });
      db.addNote(note1);
      db.addNote(note2);

      db.addCard(createTestCard({
        id: 'card1',
        nid: 'note1',
        did: '1',
        type: CardType.New,
        queue: CardQueue.New,
      }));

      db.addCard(createTestCard({
        id: 'card2',
        nid: 'note2',
        did: '2',
        type: CardType.New,
        queue: CardQueue.New,
      }));

      const next = scheduler.getNext('1');
      expect(next?.id).toBe('card1');
      expect(next?.did).toBe('1');
    });

    it('should sort learning cards by due time', () => {
      const note1 = createTestNote({ id: 'note1' });
      const note2 = createTestNote({ id: 'note2' });
      db.addNote(note1);
      db.addNote(note2);

      const now = Math.floor(Date.now() / 1000);

      db.addCard(createTestCard({
        id: 'learning2',
        nid: 'note2',
        type: CardType.Learning,
        queue: CardQueue.Learning,
        due: now + 100, // Due later
      }));

      db.addCard(createTestCard({
        id: 'learning1',
        nid: 'note1',
        type: CardType.Learning,
        queue: CardQueue.Learning,
        due: now - 100, // Due earlier
      }));

      const next = scheduler.getNext();
      expect(next?.id).toBe('learning1');
    });
  });

  describe('Answer Transitions - answer()', () => {
    it('should graduate new card to review on Easy', () => {
      const note = createTestNote({ id: 'note1' });
      db.addNote(note);

      const card = createTestCard({
        id: 'card1',
        nid: 'note1',
        type: CardType.New,
        queue: CardQueue.New,
      });
      db.addCard(card);

      scheduler.answer('card1', RevlogEase.Easy, 5000);

      const updated = db.getCard('card1');
      expect(updated?.type).toBe(CardType.Review);
      expect(updated?.queue).toBe(CardQueue.Review);
      expect(updated?.ivl).toBeGreaterThan(0);
    });

    it('should move new card to learning on Good', () => {
      const note = createTestNote({ id: 'note1' });
      db.addNote(note);

      const card = createTestCard({
        id: 'card1',
        nid: 'note1',
        type: CardType.New,
        queue: CardQueue.New,
      });
      db.addCard(card);

      scheduler.answer('card1', RevlogEase.Good, 5000);

      const updated = db.getCard('card1');
      expect(updated?.type).toBe(CardType.Learning);
      expect(updated?.queue).toBe(CardQueue.Learning);
    });

    it('should increase interval on review card Good answer', () => {
      const note = createTestNote({ id: 'note1' });
      db.addNote(note);

      const card = createReviewCard({
        id: 'card1',
        nid: 'note1',
        ivl: 7,
        factor: 2500,
      });
      db.addCard(card);

      scheduler.answer('card1', RevlogEase.Good, 5000);

      const updated = db.getCard('card1');
      expect(updated?.ivl).toBeGreaterThan(7);
    });

    it('should reset card on Again answer', () => {
      const note = createTestNote({ id: 'note1' });
      db.addNote(note);

      const card = createReviewCard({
        id: 'card1',
        nid: 'note1',
        ivl: 7,
        reps: 5,
      });
      db.addCard(card);

      scheduler.answer('card1', RevlogEase.Again, 5000);

      const updated = db.getCard('card1');
      expect(updated?.type).toBe(CardType.Relearning);
      expect(updated?.lapses).toBeGreaterThan(0);
    });

    it('should create revlog entry on answer', () => {
      const note = createTestNote({ id: 'note1' });
      db.addNote(note);

      const card = createTestCard({
        id: 'card1',
        nid: 'note1',
        type: CardType.New,
      });
      db.addCard(card);

      const revlogBefore = db.getAllRevlog().length;
      scheduler.answer('card1', RevlogEase.Good, 5000);
      const revlogAfter = db.getAllRevlog().length;

      expect(revlogAfter).toBe(revlogBefore + 1);
    });

    it('should increment reps counter', () => {
      const note = createTestNote({ id: 'note1' });
      db.addNote(note);

      const card = createReviewCard({
        id: 'card1',
        nid: 'note1',
        reps: 5,
      });
      db.addCard(card);

      scheduler.answer('card1', RevlogEase.Good, 5000);

      const updated = db.getCard('card1');
      expect(updated?.reps).toBe(6);
    });
  });

  describe('Card Counts', () => {
    it('should return zero counts for empty deck', () => {
      const stats = db.getStats();
      
      expect(stats.newCount).toBe(0);
      expect(stats.learningCount).toBe(0);
      expect(stats.reviewCount).toBe(0);
    });

    it('should count cards by type', () => {
      const note1 = createTestNote({ id: 'note1' });
      const note2 = createTestNote({ id: 'note2' });
      const note3 = createTestNote({ id: 'note3' });
      db.addNote(note1);
      db.addNote(note2);
      db.addNote(note3);

      db.addCard(createTestCard({
        id: 'new1',
        nid: 'note1',
        type: CardType.New,
        queue: CardQueue.New,
      }));

      const now = Math.floor(Date.now() / 1000);
      db.addCard(createTestCard({
        id: 'learning1',
        nid: 'note2',
        type: CardType.Learning,
        queue: CardQueue.Learning,
        due: now - 100,
      }));

      db.addCard(createReviewCard({
        id: 'review1',
        nid: 'note3',
        type: CardType.Review,
        queue: CardQueue.Review,
        due: 0,
      }));

      const stats = db.getStats();
      
      expect(stats.newCount).toBe(1);
      expect(stats.learningCount).toBe(1);
      expect(stats.reviewCount).toBe(1);
    });

    it('should not count suspended cards', () => {
      const note = createTestNote({ id: 'note1' });
      db.addNote(note);

      db.addCard(createTestCard({
        id: 'suspended1',
        nid: 'note1',
        type: CardType.New,
        queue: CardQueue.Suspended,
      }));

      const stats = db.getStats();
      expect(stats.newCount).toBe(0);
    });

    it('should filter counts by deck', () => {
      const note1 = createTestNote({ id: 'note1' });
      const note2 = createTestNote({ id: 'note2' });
      db.addNote(note1);
      db.addNote(note2);

      db.addCard(createTestCard({
        id: 'card1',
        nid: 'note1',
        did: '1',
        type: CardType.New,
        queue: CardQueue.New,
      }));

      db.addCard(createTestCard({
        id: 'card2',
        nid: 'note2',
        did: '2',
        type: CardType.New,
        queue: CardQueue.New,
      }));

      const stats = db.getStats('1');
      expect(stats.newCount).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty database', () => {
      const next = scheduler.getNext();
      expect(next).toBeNull();

      const stats = db.getStats();
      expect(stats.newCount).toBe(0);
      expect(stats.learningCount).toBe(0);
      expect(stats.reviewCount).toBe(0);
    });

    it('should handle all cards suspended', () => {
      const note = createTestNote({ id: 'note1' });
      db.addNote(note);

      db.addCard(createTestCard({
        id: 'card1',
        nid: 'note1',
        type: CardType.New,
        queue: CardQueue.Suspended,
      }));

      const next = scheduler.getNext();
      expect(next).toBeNull();
    });

    it('should handle nonexistent deck', () => {
      const next = scheduler.getNext('nonexistent');
      expect(next).toBeNull();

      const stats = db.getStats('nonexistent');
      expect(stats.newCount).toBe(0);
    });
  });
});
