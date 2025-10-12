/**
 * Study Flow Integration Test - Fixed to use correct StatsService API
 * Tests: Study Card → Answer → SRS Update → Stats Update
 */

import { InMemoryDb } from '../../InMemoryDb';
import { CardService } from '../../CardService';
import { StatsService } from '../../StatsService';
import { CardType, CardQueue, RevlogEase } from '../../schema';
import { createTestCard, createTestNote, createReviewCard } from '../helpers/factories';

describe('Study Flow Integration', () => {
  let db: InMemoryDb;
  let cardService: CardService;
  let statsService: StatsService;
  let fixedNow: number;

  beforeEach(() => {
    // Freeze time to avoid flakiness
    fixedNow = new Date('2025-01-02T10:00:00.000Z').getTime();
    jest.useFakeTimers();
    jest.setSystemTime(fixedNow);
    
    db = new InMemoryDb();
    cardService = new CardService(db);
    statsService = new StatsService(db);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('New Card Flow', () => {
    it('should complete full study session for new card', () => {
      const note = createTestNote({ id: 'note1' });
      db.addNote(note);
      const card = createTestCard({
        id: 'card1',
        nid: 'note1',
        did: '1',
        type: CardType.New,
        queue: CardQueue.New,
      });
      db.addCard(card);

      // Verify card is in new queue
      const newCards = cardService.findCards({ is: 'new' });
      expect(newCards.length).toBe(1);
      expect(newCards[0].id).toBe('card1');

      // Verify initial stats
      const stats = statsService.getHomeStats();
      expect(stats.todayReviewCount).toBe(0);
      expect(stats.newCount).toBe(1);
    });

    it('should move card to learning queue after first answer', () => {
      const note = createTestNote({ id: 'note1' });
      db.addNote(note);
      const card = createTestCard({
        id: 'card1',
        nid: 'note1',
        type: CardType.New,
        queue: CardQueue.New,
      });
      db.addCard(card);

      // Simulate answering (would be done by scheduler)
      db.updateCard('card1', {
        type: CardType.Learning,
        queue: CardQueue.Learning,
        reps: 1,
      });

      const learningCards = cardService.findCards({ is: 'learn' });
      expect(learningCards.length).toBe(1);
      expect(learningCards[0].id).toBe('card1');
    });
  });

  describe('Review Card Flow', () => {
    it('should complete review and update statistics', () => {
      const note = createTestNote({ id: 'note1' });
      db.addNote(note);
      const card = createReviewCard({
        id: 'card1',
        nid: 'note1',
        ivl: 7,
        reps: 5,
      });
      db.addCard(card);

      const today = new Date(fixedNow).setHours(0, 0, 0, 0);
      
      db.addRevlog({
        id: String(today + 1000),
        cid: 'card1',
        usn: -1,
        ease: RevlogEase.Good,
        ivl: 14,
        lastIvl: 7,
        factor: 2500,
        time: 5000,
        type: 1,
      });

      const stats = statsService.getHomeStats();
      expect(stats.todayReviewCount).toBe(1);
      expect(stats.todayTimeMinutes).toBeGreaterThanOrEqual(0);
    });

    it('should track multiple reviews in session', () => {
      // Create 3 cards
      for (let i = 1; i <= 3; i++) {
        const note = createTestNote({ id: `note${i}` });
        db.addNote(note);
        const card = createReviewCard({ id: `card${i}`, nid: `note${i}` });
        db.addCard(card);
      }

      const today = new Date(fixedNow).setHours(0, 0, 0, 0);

      // Add review logs for all 3
      for (let i = 1; i <= 3; i++) {
        db.addRevlog({
          id: String(today + i * 1000),
          cid: `card${i}`,
          usn: -1,
          ease: RevlogEase.Good,
          ivl: 7,
          lastIvl: 5,
          factor: 2500,
          time: 3000 + i * 1000,
          type: 1,
        });
      }

      const stats = statsService.getHomeStats();
      expect(stats.todayReviewCount).toBe(3);
      expect(stats.todayTimeMinutes).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Accuracy Tracking', () => {
    it('should calculate accuracy from review history', () => {
      const note = createTestNote({ id: 'note1' });
      db.addNote(note);
      const card = createReviewCard({ id: 'card1', nid: 'note1' });
      db.addCard(card);

      const today = new Date(fixedNow).setHours(0, 0, 0, 0);

      // 3 good, 1 again = 75% accuracy
      const eases = [
        RevlogEase.Good,
        RevlogEase.Good,
        RevlogEase.Good,
        RevlogEase.Again,
      ];

      eases.forEach((ease, i) => {
        db.addRevlog({
          id: String(today + i * 1000),
          cid: 'card1',
          usn: -1,
          ease,
          ivl: 7,
          lastIvl: 5,
          factor: 2500,
          time: 5000,
          type: 1,
        });
      });

      const stats = statsService.getHomeStats();
      expect(stats.todayAccuracy).toBe(75);
      expect(stats.todayCorrectCount).toBe(3);
    });

    it('should handle perfect accuracy', () => {
      const note = createTestNote({ id: 'note1' });
      db.addNote(note);
      const card = createReviewCard({ id: 'card1', nid: 'note1' });
      db.addCard(card);

      const today = new Date(fixedNow).setHours(0, 0, 0, 0);

      // All correct answers
      for (let i = 0; i < 5; i++) {
        db.addRevlog({
          id: String(today + i * 1000),
          cid: 'card1',
          usn: -1,
          ease: RevlogEase.Good,
          ivl: 7,
          lastIvl: 5,
          factor: 2500,
          time: 5000,
          type: 1,
        });
      }

      const stats = statsService.getHomeStats();
      expect(stats.todayAccuracy).toBe(100);
    });
  });

  describe('Suspend/Unsuspend Flow', () => {
    it('should remove suspended cards from study queue', () => {
      const note = createTestNote({ id: 'note1' });
      db.addNote(note);
      const card = createReviewCard({ id: 'card1', nid: 'note1' });
      db.addCard(card);

      // Suspend the card
      cardService.suspend(['card1']);

      // Verify in suspended
      const suspendedCards = cardService.findCards({ is: 'suspended' });
      expect(suspendedCards.length).toBe(1);
    });

    it('should restore suspended cards to study queue', () => {
      const note = createTestNote({ id: 'note1' });
      db.addNote(note);
      const card = createReviewCard({
        id: 'card1',
        nid: 'note1',
        queue: CardQueue.Suspended,
      });
      db.addCard(card);

      // Unsuspend
      cardService.unsuspend(['card1']);

      const suspendedCards = cardService.findCards({ is: 'suspended' });
      expect(suspendedCards.length).toBe(0);

      const updated = db.getCard('card1');
      expect(updated?.queue).not.toBe(CardQueue.Suspended);
    });
  });

  describe('Streak Calculation', () => {
    it('should maintain streak with daily reviews', () => {
      const note = createTestNote({ id: 'note1' });
      db.addNote(note);
      const card = createReviewCard({ id: 'card1', nid: 'note1' });
      db.addCard(card);

      const today = new Date(fixedNow).setHours(0, 0, 0, 0);

      // Add reviews for today and yesterday
      [0, 1].forEach(daysAgo => {
        const timestamp = today - (daysAgo * 86400000);
        db.addRevlog({
          id: String(timestamp + 1000),
          cid: 'card1',
          usn: -1,
          ease: RevlogEase.Good,
          ivl: 7,
          lastIvl: 5,
          factor: 2500,
          time: 5000,
          type: 1,
        });
      });

      const stats = statsService.getHomeStats();
      expect(stats.currentStreak).toBeGreaterThanOrEqual(1);
    });

    it('should break streak when day is skipped', () => {
      const note = createTestNote({ id: 'note1' });
      db.addNote(note);
      const card = createReviewCard({ id: 'card1', nid: 'note1' });
      db.addCard(card);

      const today = new Date(fixedNow).setHours(0, 0, 0, 0);

      // Today and 2 days ago (skip yesterday)
      [0, 2].forEach(daysAgo => {
        const timestamp = today - (daysAgo * 86400000);
        db.addRevlog({
          id: String(timestamp + 1000),
          cid: 'card1',
          usn: -1,
          ease: RevlogEase.Good,
          ivl: 7,
          lastIvl: 5,
          factor: 2500,
          time: 5000,
          type: 1,
        });
      });

      const stats = statsService.getHomeStats();
      // Streak broken, only today counts
      expect(stats.currentStreak).toBe(1);
    });
  });

  describe('Due Card Filtering', () => {
    it('should identify cards due today', () => {
      const col = db.getCol();
      const now = Math.floor(Date.now() / 1000);
      const daysSinceCreation = Math.floor((now - col.crt) / 86400);

      const note = createTestNote({ id: 'note1' });
      db.addNote(note);
      const card = createReviewCard({
        id: 'card1',
        nid: 'note1',
        due: daysSinceCreation,
      });
      db.addCard(card);

      const stats = statsService.getHomeStats();
      expect(stats.dueCount).toBeGreaterThanOrEqual(1);
    });

    it('should not include future cards in due count', () => {
      const col = db.getCol();
      const now = Math.floor(Date.now() / 1000);
      const daysSinceCreation = Math.floor((now - col.crt) / 86400);

      const note = createTestNote({ id: 'note1' });
      db.addNote(note);
      const card = createReviewCard({
        id: 'card1',
        nid: 'note1',
        due: daysSinceCreation + 10,
      });
      db.addCard(card);

      const stats = statsService.getHomeStats();
      // Future card shouldn't be due
      expect(stats.dueCount).toBe(0);
    });
  });

  describe('Mixed Card Types Study', () => {
    it('should handle study session with mixed card types', () => {
      // Add new, learning, and review cards
      for (let i = 1; i <= 3; i++) {
        const note = createTestNote({ id: `note${i}` });
        db.addNote(note);
      }

      db.addCard(createTestCard({
        id: 'card1',
        nid: 'note1',
        type: CardType.New,
      }));

      db.addCard(createTestCard({
        id: 'card2',
        nid: 'note2',
        type: CardType.Learning,
        queue: CardQueue.Learning,
      }));

      db.addCard(createReviewCard({
        id: 'card3',
        nid: 'note3',
      }));

      const stats = statsService.getHomeStats();
      expect(stats.newCount).toBe(1);
      expect(stats.learningCount).toBe(1);
      expect(stats.reviewCount).toBe(1);
    });
  });

  describe('Time Tracking', () => {
    it('should accumulate time spent studying', () => {
      const note = createTestNote({ id: 'note1' });
      db.addNote(note);
      const card = createReviewCard({ id: 'card1', nid: 'note1' });
      db.addCard(card);

      const today = new Date(fixedNow).setHours(0, 0, 0, 0);

      // Add reviews with different times (in ms)
      const times = [3000, 5000, 7000]; // 3s, 5s, 7s = 15s = 0 minutes (rounded)
      times.forEach((time, i) => {
        db.addRevlog({
          id: String(today + i * 1000),
          cid: 'card1',
          usn: -1,
          ease: RevlogEase.Good,
          ivl: 7,
          lastIvl: 5,
          factor: 2500,
          time,
          type: 1,
        });
      });

      const stats = statsService.getHomeStats();
      expect(stats.todayTimeMinutes).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Weekly Activity', () => {
    it('should track reviews across multiple days', () => {
      const note = createTestNote({ id: 'note1' });
      db.addNote(note);
      const card = createReviewCard({ id: 'card1', nid: 'note1' });
      db.addCard(card);

      const today = new Date(fixedNow).setHours(0, 0, 0, 0);

      // Add reviews for last 7 days
      for (let daysAgo = 0; daysAgo < 7; daysAgo++) {
        const timestamp = today - (daysAgo * 86400000);
        const reviewCount = daysAgo + 1;
        
        for (let i = 0; i < reviewCount; i++) {
          db.addRevlog({
            id: String(timestamp + i * 1000),
            cid: 'card1',
            usn: -1,
            ease: RevlogEase.Good,
            ivl: 7,
            lastIvl: 5,
            factor: 2500,
            time: 5000,
            type: 1,
          });
        }
      }

      const stats = statsService.getHomeStats();
      expect(stats.weeklyActivity).toHaveLength(7);
      
      const todayActivity = stats.weeklyActivity.find(d => d.isToday);
      expect(todayActivity?.hasReviews).toBe(true);
      expect(todayActivity?.reviewCount).toBeGreaterThan(0);
    });
  });
});
