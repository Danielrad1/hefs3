/**
 * Exact Anki database schema types
 * Mirrors Anki's SQLite schema for full compatibility
 */

// ============================================================================
// ENUMS
// ============================================================================

/** cards.type: Card lifecycle state */
export enum CardType {
  New = 0,
  Learning = 1,
  Review = 2,
  Relearning = 3,
}

/** cards.queue: Scheduling queue */
export enum CardQueue {
  SchedBuried = -3,  // user buried (sched2)
  UserBuried = -2,   // sched buried (sched2) or buried (sched1)
  Suspended = -1,    // suspended
  New = 0,           // new
  Learning = 1,      // learning
  Review = 2,        // review (due)
  DayLearn = 3,      // in learning, next rev ≥ 1 day away
  Preview = 4,       // preview (not currently used)
}

/** revlog.ease: Answer button pressed */
export enum RevlogEase {
  // Review cards
  Again = 1,
  Hard = 2,
  Good = 3,
  Easy = 4,
}

/** revlog.type: Type of review */
export enum RevlogType {
  Learn = 0,      // learning
  Review = 1,     // review
  Relearn = 2,    // relearning
  Filtered = 3,   // (cram) filtered
  Manual = 4,     // manual reschedule
  Resched = 5,    // rescheduled
}

/** graves.type: Type of deleted object */
export enum GraveType {
  Card = 0,
  Note = 1,
  Deck = 2,
}

// ============================================================================
// CORE TYPES
// ============================================================================

/** col table (single row) - Collection metadata */
export interface AnkiCol {
  id: string;           // collection ID (stringified int64)
  crt: number;          // creation time (epoch seconds)
  mod: number;          // last modified time (epoch milliseconds)
  scm: number;          // schema mod time (epoch milliseconds)
  ver: number;          // version
  dty: number;          // dirty (unused)
  usn: number;          // update sequence number
  ls: number;           // last sync time (epoch milliseconds)
  conf: string;         // JSON config
  models: string;       // JSON note types
  decks: string;        // JSON decks
  dconf: string;        // JSON deck configs
  tags: string;         // JSON tags
}

/** cards table - Individual card scheduling data */
export interface AnkiCard {
  id: string;           // card ID (stringified int64)
  nid: string;          // note ID
  did: string;          // deck ID
  ord: number;          // ordinal (which card template)
  mod: number;          // last modified (epoch seconds)
  usn: number;          // update sequence number
  type: CardType;       // 0=new, 1=learning, 2=review, 3=relearning
  queue: CardQueue;     // scheduling queue
  due: number;          // depends on type: new=order, learn/relearn=epoch seconds, review=days since col.crt
  ivl: number;          // interval in days (learning=0)
  factor: number;       // ease factor (permille, e.g., 2500 = 2.5)
  reps: number;         // number of reviews
  lapses: number;       // number of lapses
  left: number;         // a*1000+b: a=reps left today, b=reps to graduation
  odue: number;         // original due (for filtered decks)
  odid: string;         // original deck ID
  flags: number;        // user-defined flags
  data: string;         // unused
}

/** notes table - Note content (Anki "note" = front/back/etc.) */
export interface AnkiNote {
  id: string;           // note ID (stringified int64)
  guid: string;         // globally unique ID
  mid: string | number; // model (note type) ID - Anki uses numbers
  mod: number;          // last modified (epoch seconds)
  usn: number;          // update sequence number
  tags: string;         // space-separated tags with surrounding spaces
  flds: string;         // 0x1F-separated field values
  sfld: number;         // sort field (for searching)
  csum: number;         // checksum of first field (first 8 hex of sha1, as int)
  flags: number;        // unused
  data: string;         // unused
}

/** revlog table - Review history */
export interface AnkiRevlog {
  id: string;           // review ID (epoch milliseconds, stringified)
  cid: string;          // card ID
  usn: number;          // update sequence number
  ease: RevlogEase;     // button pressed (1-4)
  ivl: number;          // interval: negative=seconds for learn, positive=days
  lastIvl: number;      // previous interval
  factor: number;       // ease factor after review (permille)
  time: number;         // time taken (milliseconds)
  type: RevlogType;     // 0=learn, 1=review, 2=relearn, 3=filtered, 4=manual, 5=resched
}

/** graves table - Deleted objects */
export interface AnkiGrave {
  usn: number;          // update sequence number
  oid: string;          // original ID
  type: GraveType;      // 0=card, 1=note, 2=deck
}

// ============================================================================
// CONFIG TYPES (parsed from JSON fields)
// ============================================================================

/** Deck configuration (from col.dconf) */
export interface DeckConfig {
  id: string;
  name: string;
  new: {
    delays: number[];        // learning steps in minutes
    ints: [number, number, number];  // [good, easy, unused] graduating intervals in days
    initialFactor: number;   // starting ease factor (permille)
    perDay: number;          // new cards per day
    order: number;           // 0=sequential, 1=random
  };
  rev: {
    perDay: number;          // reviews per day
    ease4: number;           // easy bonus (added to factor, permille)
    ivlFct: number;          // interval factor (multiplier)
    maxIvl: number;          // maximum interval in days
    fuzz: number;            // fuzz factor (0-1)
  };
  lapse: {
    delays: number[];        // relearning steps in minutes
    mult: number;            // interval multiplier on lapse
    minInt: number;          // minimum interval after graduation
    leechAction: number;     // 0=suspend, 1=tag
    leechFails: number;      // leech threshold
  };
  dyn: boolean;              // is filtered deck
  usn: number;
  mod: number;
  
  // Algorithm selection (optional, defaults to 'sm2')
  algo?: 'sm2' | 'fsrs' | 'leitner' | 'ai';
  
  // Algorithm-specific parameters (optional)
  algoParams?: {
    // FSRS parameters
    fsrs?: {
      retention: number;       // target retention (0-1, e.g., 0.9)
      weights?: number[];      // trained FSRS weights
      dailyMinutes?: number;   // daily study time budget (for AI mode)
    };
    // Leitner parameters
    leitner?: {
      intervals: number[];     // box intervals in days
      dropBoxes: number;       // how many boxes to drop on wrong answer
    };
    // AI mode parameters
    ai?: {
      goal: 'retention' | 'time' | 'balanced';
      dailyMinutes: number;    // daily study time budget
      retention: number;       // target retention
    };
  };
}

/** Collection config (from col.conf) */
export interface ColConfig {
  activeDecks: string[];     // active deck IDs
  nextPos: number;           // next position for new cards
  sortType: string;
  sortBackwards: boolean;
  schedVer: number;          // 1 or 2 (v2 scheduler)
  rollover: number;          // hour of day rollover (0-23, default 4)
  // ... other fields as needed
}

/** Deck definition (from col.decks) */
export interface Deck {
  id: string;
  name: string;
  desc: string;
  conf: string;              // deck config ID
  mod: number;
  usn: number;
  collapsed: boolean;
  browserCollapsed: boolean;
}

/** Model/NoteType definition (from col.models) */
export interface Model {
  id: number;  // Anki uses numeric IDs (timestamps)
  name: string;
  type: number;              // 0=standard, 1=cloze
  mod: number;
  usn: number;
  sortf: number;             // sort field index
  did: string;               // default deck ID
  tmpls: Template[];         // card templates
  flds: Field[];             // field definitions
  css: string;               // shared CSS
  latexPre: string;
  latexPost: string;
  req: any[];                // template requirements
  tags: string[];            // tags to add to new notes
}

/** Field definition within a Model */
export interface Field {
  name: string;
  ord: number;               // ordinal/position
  sticky: boolean;           // preserve value when adding cards
  rtl: boolean;              // right-to-left
  font: string;
  size: number;              // font size
  description: string;
}

/** Card template within a Model */
export interface Template {
  name: string;
  ord: number;               // ordinal/position
  qfmt: string;              // question format (front)
  afmt: string;              // answer format (back)
  bqfmt: string;             // browser question format
  bafmt: string;             // browser answer format
  did: string | null;        // override deck ID
}

/** Media file */
export interface Media {
  id: string;
  filename: string;
  mime: string;
  hash: string;              // content hash (SHA-256 hex)
  size: number;
  localUri: string;          // local file path
  created: number;           // epoch seconds
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const FIELD_SEPARATOR = '\x1f';
export const DEFAULT_DECK_ID = '1';
export const DEFAULT_MODEL_ID = 1;  // Anki uses numeric IDs
export const DEFAULT_EASE_FACTOR = 2500;  // 2.5 in permille
export const MIN_EASE_FACTOR = 1300;      // 1.3 in permille
export const MAX_EASE_FACTOR = 2600;      // 2.6 in permille (not enforced by Anki, but reasonable cap)

// Model types
export const MODEL_TYPE_STANDARD = 0;
export const MODEL_TYPE_CLOZE = 1;
export const MODEL_TYPE_IMAGE_OCCLUSION = 2;
