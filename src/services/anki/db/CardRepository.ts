/**
 * Card Repository
 * Handles all CRUD operations for cards
 */

import { AnkiCard, AnkiGrave } from '../schema';
import { nowSeconds } from '../time';

export class CardRepository {
  private cards: Map<string, AnkiCard>;
  private graves: AnkiGrave[];
  private usn: number;

  constructor(cards: Map<string, AnkiCard>, graves: AnkiGrave[], usn: number) {
    this.cards = cards;
    this.graves = graves;
    this.usn = usn;
  }

  get(id: string): AnkiCard | undefined {
    return this.cards.get(id);
  }

  getAll(): AnkiCard[] {
    return Array.from(this.cards.values());
  }

  getByDeck(deckId: string): AnkiCard[] {
    return Array.from(this.cards.values()).filter((c) => c.did === deckId);
  }

  add(card: AnkiCard): void {
    this.cards.set(card.id, card);
  }

  update(id: string, updates: Partial<AnkiCard>): void {
    const card = this.cards.get(id);
    if (!card) {
      throw new Error(`Card ${id} not found`);
    }
    this.cards.set(id, {
      ...card,
      ...updates,
      mod: nowSeconds(),
      usn: this.usn,
    });
  }

  delete(id: string): void {
    this.cards.delete(id);
    this.graves.push({
      usn: this.usn,
      oid: id,
      type: 0, // card
    });
  }
}
