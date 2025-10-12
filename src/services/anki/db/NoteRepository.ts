/**
 * Note Repository
 * Handles all CRUD operations for notes
 */

import { AnkiNote, AnkiGrave } from '../schema';
import { nowSeconds } from '../time';

export class NoteRepository {
  private notes: Map<string, AnkiNote>;
  private graves: AnkiGrave[];
  private usn: number;

  constructor(notes: Map<string, AnkiNote>, graves: AnkiGrave[], usn: number) {
    this.notes = notes;
    this.graves = graves;
    this.usn = usn;
  }

  get(id: string): AnkiNote | undefined {
    return this.notes.get(id);
  }

  getAll(): AnkiNote[] {
    return Array.from(this.notes.values());
  }

  add(note: AnkiNote): void {
    this.notes.set(note.id, note);
  }

  update(id: string, updates: Partial<AnkiNote>): void {
    const note = this.notes.get(id);
    if (!note) {
      throw new Error(`Note ${id} not found`);
    }
    this.notes.set(id, {
      ...note,
      ...updates,
      mod: nowSeconds(),
      usn: this.usn,
    });
  }

  delete(id: string): void {
    this.notes.delete(id);
    this.graves.push({
      usn: this.usn,
      oid: id,
      type: 1, // note
    });
  }
}
