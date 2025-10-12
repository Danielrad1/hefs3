/**
 * Revlog Repository
 * Handles review log operations (review history)
 */

import { AnkiRevlog } from '../schema';

export class RevlogRepository {
  private revlog: AnkiRevlog[];

  constructor(revlog: AnkiRevlog[]) {
    this.revlog = revlog;
  }

  add(entry: AnkiRevlog): void {
    this.revlog.push(entry);
  }

  getForCard(cardId: string): AnkiRevlog[] {
    return this.revlog.filter((r) => r.cid === cardId);
  }

  getAll(): AnkiRevlog[] {
    return [...this.revlog];
  }
}
