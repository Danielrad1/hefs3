/**
 * CardService Tests - Card operations and querying
 * Note: SRS scheduling logic is in SchedulerService
 */

import { CardService } from '../CardService';
import { InMemoryDb } from '../InMemoryDb';
import { CardType, CardQueue } from '../schema';

describe('CardService', () => {
  let db: InMemoryDb;
  let cardService: CardService;

  beforeEach(() => {
    db = new InMemoryDb();
    cardService = new CardService(db);
  });

  describe('Find Cards', () => {
    it('should find cards by deck', () => {
      const deck = db.getDeck('1');
      db.addCard({
        id: 'card1',
        nid: 'note1',
        did: '1',
        ord: 0,
        mod: Math.floor(Date.now() / 1000),
        usn: -1,
        type: CardType.New,
        queue: CardQueue.New,
        due: 1,
        ivl: 0,
        factor: 2500,
        reps: 0,
        lapses: 0,
        left: 0,
        odue: 0,
        odid: '0',
        flags: 0,
        data: '',
      });

      const cards = cardService.findCards({ deck: deck?.name });
      expect(cards.length).toBe(1);
      expect(cards[0].did).toBe('1');
    });

    it('should find new cards', () => {
      db.addCard({
        id: 'card1',
        nid: 'note1',
        did: '1',
        ord: 0,
        mod: Math.floor(Date.now() / 1000),
        usn: -1,
        type: CardType.New,
        queue: CardQueue.New,
        due: 1,
        ivl: 0,
        factor: 2500,
        reps: 0,
        lapses: 0,
        left: 0,
        odue: 0,
        odid: '0',
        flags: 0,
        data: '',
      });

      const cards = cardService.findCards({ is: 'new' });
      expect(cards.length).toBe(1);
      expect(cards[0].type).toBe(CardType.New);
    });

    it('should find suspended cards', () => {
      db.addCard({
        id: 'card1',
        nid: 'note1',
        did: '1',
        ord: 0,
        mod: Math.floor(Date.now() / 1000),
        usn: -1,
        type: CardType.Review,
        queue: CardQueue.Suspended,
        due: 100,
        ivl: 7,
        factor: 2500,
        reps: 5,
        lapses: 0,
        left: 0,
        odue: 0,
        odid: '0',
        flags: 0,
        data: '',
      });

      const cards = cardService.findCards({ is: 'suspended' });
      expect(cards.length).toBe(1);
      expect(cards[0].queue).toBe(CardQueue.Suspended);
    });
  });

  describe('Suspend/Unsuspend', () => {
    it('should suspend cards', () => {
      const card = {
        id: 'card1',
        nid: 'note1',
        did: '1',
        ord: 0,
        mod: Math.floor(Date.now() / 1000),
        usn: -1,
        type: CardType.Review,
        queue: CardQueue.Review,
        due: 100,
        ivl: 7,
        factor: 2500,
        reps: 5,
        lapses: 0,
        left: 0,
        odue: 0,
        odid: '0',
        flags: 0,
        data: '',
      };
      db.addCard(card);

      cardService.suspend(['card1']);

      const updated = db.getCard('card1');
      expect(updated?.queue).toBe(CardQueue.Suspended);
    });

    it('should unsuspend cards', () => {
      const card = {
        id: 'card1',
        nid: 'note1',
        did: '1',
        ord: 0,
        mod: Math.floor(Date.now() / 1000),
        usn: -1,
        type: CardType.Review,
        queue: CardQueue.Suspended,
        due: 100,
        ivl: 7,
        factor: 2500,
        reps: 5,
        lapses: 0,
        left: 0,
        odue: 0,
        odid: '0',
        flags: 0,
        data: '',
      };
      db.addCard(card);

      cardService.unsuspend(['card1']);

      const updated = db.getCard('card1');
      expect(updated?.queue).not.toBe(CardQueue.Suspended);
    });
  });

  describe('Delete Cards', () => {
    it('should delete cards and orphaned notes', async () => {
      // Create note and card
      db.addNote({
        id: 'note1',
        guid: 'guid1',
        mid: 1,
        mod: 123456,
        usn: -1,
        tags: ' ',
        flds: 'Front\x1fBack',
        sfld: 0,
        csum: 12345,
        flags: 0,
        data: '',
      });

      db.addCard({
        id: 'card1',
        nid: 'note1',
        did: '1',
        ord: 0,
        mod: 123456,
        usn: -1,
        type: CardType.New,
        queue: CardQueue.New,
        due: 1,
        ivl: 0,
        factor: 2500,
        reps: 0,
        lapses: 0,
        left: 0,
        odue: 0,
        odid: '0',
        flags: 0,
        data: '',
      });

      await cardService.deleteCards(['card1']);

      expect(db.getCard('card1')).toBeUndefined();
      expect(db.getNote('note1')).toBeUndefined();
    });

    it('should preserve notes with remaining cards', async () => {
      db.addNote({
        id: 'note1',
        guid: 'guid1',
        mid: 2, // Cloze type
        mod: 123456,
        usn: -1,
        tags: ' ',
        flds: '{{c1::Front}}{{c2::Back}}',
        sfld: 0,
        csum: 12345,
        flags: 0,
        data: '',
      });

      // Two cards from same note
      db.addCard({
        id: 'card1',
        nid: 'note1',
        did: '1',
        ord: 0,
        mod: 123456,
        usn: -1,
        type: CardType.New,
        queue: CardQueue.New,
        due: 1,
        ivl: 0,
        factor: 2500,
        reps: 0,
        lapses: 0,
        left: 0,
        odue: 0,
        odid: '0',
        flags: 0,
        data: '',
      });

      db.addCard({
        id: 'card2',
        nid: 'note1',
        did: '1',
        ord: 1,
        mod: 123456,
        usn: -1,
        type: CardType.New,
        queue: CardQueue.New,
        due: 2,
        ivl: 0,
        factor: 2500,
        reps: 0,
        lapses: 0,
        left: 0,
        odue: 0,
        odid: '0',
        flags: 0,
        data: '',
      });

      await cardService.deleteCards(['card1']);

      expect(db.getCard('card1')).toBeUndefined();
      expect(db.getCard('card2')).toBeDefined();
      expect(db.getNote('note1')).toBeDefined(); // Note should remain
    });
  });
});
