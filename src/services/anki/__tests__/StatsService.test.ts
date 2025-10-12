/**
 * StatsService Tests - Fixed to use actual getHomeStats() API
 */

import { StatsService } from '../StatsService';
import { InMemoryDb } from '../InMemoryDb';
import { RevlogEase, CardType, CardQueue } from '../schema';
import { createTestCard, createReviewCard, createTestNote } from './helpers/factories';

describe('StatsService', () => {
  let db: InMemoryDb;
  let statsService: StatsService;
  let fixedNow: number;

  beforeEach(() => {
    // Freeze time to avoid midnight rollover flakiness
    fixedNow = new Date('2025-10-12T15:00:00.000Z').getTime();
    jest.useFakeTimers();
    jest.setSystemTime(fixedNow);
    
    db = new InMemoryDb();
    statsService = new StatsService(db);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Today Statistics', () => {
    it('should calculate reviews done today', () => {
      const today = new Date(fixedNow).setHours(0, 0, 0, 0);

      // Add reviews from today
      db.addRevlog({
        id: String(today + 1000),
        cid: 'card1',
        usn: -1,
        ease: RevlogEase.Good,
        ivl: 7,
        lastIvl: 5,
        factor: 2500,
        time: 5000,
        type: 1,
      });

      db.addRevlog({
        id: String(today + 2000),
        cid: 'card2',
        usn: -1,
        ease: RevlogEase.Good,
        ivl: 10,
        lastIvl: 7,
        factor: 2500,
        time: 3000,
        type: 1,
      });

      const stats = statsService.getHomeStats();
      expect(stats.todayReviewCount).toBe(2);
    });

    it('should calculate accuracy correctly', () => {
      const today = new Date(fixedNow).setHours(0, 0, 0, 0);

      // 3 good, 1 again = 75% accuracy
      const eases = [RevlogEase.Good, RevlogEase.Good, RevlogEase.Good, RevlogEase.Again];
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

    it('should calculate time spent in minutes', () => {
      const today = new Date(fixedNow).setHours(0, 0, 0, 0);

      // 3 reviews: 60s, 120s, 180s = 360s = 6 minutes
      [60000, 120000, 180000].forEach((time, i) => {
        db.addRevlog({
          id: String(today + i * 1000),
          cid: `card${i}`,
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
      expect(stats.todayTimeMinutes).toBe(6);
    });
  });

  describe('Streak Calculation', () => {
    it('should calculate current streak', () => {
      const today = new Date(fixedNow).setHours(0, 0, 0, 0);

      // Add reviews for today and yesterday (2-day streak)
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
      expect(stats.currentStreak).toBe(2);
    });

    it('should break streak when day is skipped', () => {
      const today = new Date(fixedNow).setHours(0, 0, 0, 0);

      // Reviews today and 2 days ago (skip yesterday)
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
      expect(stats.currentStreak).toBe(1); // Only today
    });

    it('should track longest streak', () => {
      const today = new Date(fixedNow).setHours(0, 0, 0, 0);

      // 5-day streak, then gap, then 3-day streak
      // Longest should be 5
      [0, 1, 2, 7, 8, 9, 10, 11].forEach(daysAgo => {
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
      expect(stats.longestStreak).toBe(5);
    });
  });

  describe('Due Count Calculation', () => {
    it('should count due cards correctly', () => {
      const col = db.getCol();
      const now = Math.floor(Date.now() / 1000);
      const daysSinceCreation = Math.floor((now - col.crt) / 86400);

      const note = createTestNote({ id: 'note1' });
      db.addNote(note);
      
      // Add due card
      db.addCard(createReviewCard({
        id: 'card1',
        nid: 'note1',
        type: CardType.Review,
        due: daysSinceCreation, // Due today
      }));

      const stats = statsService.getHomeStats();
      expect(stats.dueCount).toBeGreaterThanOrEqual(1);
    });

    it('should not count suspended cards as due', () => {
      const note = createTestNote({ id: 'note1' });
      db.addNote(note);
      
      db.addCard(createTestCard({
        id: 'card1',
        nid: 'note1',
        type: CardType.Review,
        queue: CardQueue.Suspended,
      }));

      const stats = statsService.getHomeStats();
      expect(stats.dueCount).toBe(0);
    });
  });

  describe('Card Breakdown', () => {
    it('should count cards by type', () => {
      // Add new, learning, and review cards
      for (let i = 1; i <= 3; i++) {
        const note = createTestNote({ id: `note${i}` });
        db.addNote(note);
      }

      db.addCard(createTestCard({
        id: 'card1',
        nid: 'note1',
        type: CardType.New,
        queue: CardQueue.New,
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
        type: CardType.Review,
        queue: CardQueue.Review,
      }));

      const stats = statsService.getHomeStats();
      expect(stats.newCount).toBe(1);
      expect(stats.learningCount).toBe(1);
      expect(stats.reviewCount).toBe(1);
    });
  });

  describe('Weekly Activity', () => {
    it('should show activity for last 7 days', () => {
      const today = new Date(fixedNow).setHours(0, 0, 0, 0);

      // Add reviews for each of last 7 days
      for (let daysAgo = 0; daysAgo < 7; daysAgo++) {
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
      }

      const stats = statsService.getHomeStats();
      expect(stats.weeklyActivity).toHaveLength(7);
      
      // All days should have reviews
      const daysWithReviews = stats.weeklyActivity.filter(d => d.hasReviews);
      expect(daysWithReviews.length).toBe(7);
    });

    it('should show empty days correctly', () => {
      const today = new Date(fixedNow).setHours(0, 0, 0, 0);

      // Only add review for today
      db.addRevlog({
        id: String(today + 1000),
        cid: 'card1',
        usn: -1,
        ease: RevlogEase.Good,
        ivl: 7,
        lastIvl: 5,
        factor: 2500,
        time: 5000,
        type: 1,
      });

      const stats = statsService.getHomeStats();
      expect(stats.weeklyActivity).toHaveLength(7);
      
      const todayActivity = stats.weeklyActivity.find(d => d.isToday);
      expect(todayActivity?.hasReviews).toBe(true);
      expect(todayActivity?.reviewCount).toBe(1);
    });
  });

  describe('All-Time Statistics', () => {
    it('should count total reviews', () => {
      const today = new Date(fixedNow).setHours(0, 0, 0, 0);

      // Add 5 reviews
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
      expect(stats.totalReviewsAllTime).toBe(5);
    });

    it('should count total cards', () => {
      // Add 3 cards
      for (let i = 1; i <= 3; i++) {
        const note = createTestNote({ id: `note${i}` });
        db.addNote(note);
        db.addCard(createTestCard({ id: `card${i}`, nid: `note${i}` }));
      }

      const stats = statsService.getHomeStats();
      expect(stats.totalCardsCount).toBe(3);
    });

    it('should count decks excluding default', () => {
      // Default deck '1' exists
      // Add 2 more decks
      db.addDeck({ id: '2', name: 'Deck 1', mod: 123, conf: '1' });
      db.addDeck({ id: '3', name: 'Deck 2', mod: 123, conf: '1' });

      const stats = statsService.getHomeStats();
      expect(stats.totalDecksCount).toBe(2); // Exclude default
    });
  });

  describe('Edge Cases', () => {
    it('should handle no data gracefully', () => {
      const stats = statsService.getHomeStats();
      
      expect(stats.todayReviewCount).toBe(0);
      expect(stats.todayAccuracy).toBe(0);
      expect(stats.todayTimeMinutes).toBe(0);
      expect(stats.currentStreak).toBe(0);
      expect(stats.longestStreak).toBe(0);
      expect(stats.totalReviewsAllTime).toBe(0);
      expect(stats.weeklyActivity).toHaveLength(7);
    });

    it('should handle reviews with zero time', () => {
      const today = new Date(fixedNow).setHours(0, 0, 0, 0);

      db.addRevlog({
        id: String(today + 1000),
        cid: 'card1',
        usn: -1,
        ease: RevlogEase.Good,
        ivl: 7,
        lastIvl: 5,
        factor: 2500,
        time: 0, // Zero time
        type: 1,
      });

      const stats = statsService.getHomeStats();
      expect(stats.todayTimeMinutes).toBe(0);
      expect(stats.todayReviewCount).toBe(1);
    });

    it('should handle 100% accuracy', () => {
      const today = new Date(fixedNow).setHours(0, 0, 0, 0);

      // All correct
      for (let i = 0; i < 3; i++) {
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

    it('should handle 0% accuracy', () => {
      const today = new Date(fixedNow).setHours(0, 0, 0, 0);

      // All wrong
      for (let i = 0; i < 3; i++) {
        db.addRevlog({
          id: String(today + i * 1000),
          cid: 'card1',
          usn: -1,
          ease: RevlogEase.Again,
          ivl: 7,
          lastIvl: 5,
          factor: 2500,
          time: 5000,
          type: 1,
        });
      }

      const stats = statsService.getHomeStats();
      expect(stats.todayAccuracy).toBe(0);
      expect(stats.todayCorrectCount).toBe(0);
    });
  });
});
