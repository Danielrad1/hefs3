# Anki-Compatible SRS Scheduler Implementation

## Overview

Replaced mock data with a fully functional, Anki-compatible in-memory SRS scheduler that follows Anki's exact database schema and scheduling algorithms.

## Architecture

### Core Components

1. **`src/services/anki/schema.ts`**
   - Exact Anki schema types: `AnkiCard`, `AnkiNote`, `AnkiCol`, `AnkiRevlog`, `AnkiGrave`
   - Enums matching Anki: `CardType`, `CardQueue`, `RevlogEase`, `RevlogType`
   - Config types: `DeckConfig`, `ColConfig`, `Deck`
   - All IDs stored as strings for 64-bit precision

2. **`src/services/anki/time.ts`**
   - Time utilities for Anki's day boundary semantics (default 4:00 AM)
   - `daysSinceCrt()`: Convert timestamps to days since collection creation
   - `daysToTimestamp()`: Convert days back to timestamps
   - `getDayStart()`: Calculate Anki day boundaries
   - `isDue()`: Check if card is due based on type

3. **`src/services/anki/InMemoryDb.ts`**
   - In-memory database mirroring Anki's SQLite structure
   - Maintains: `col` (single row), `cards`, `notes`, `revlog`, `graves`
   - Cached parsed JSON configs: decks, dconf, models
   - CRUD operations with automatic `mod` and `usn` updates
   - Stats computation by deck

4. **`src/services/anki/SchedulerV2.ts`**
   - Implements Anki V2 scheduler with SM-2 algorithm
   - **Queue selection**: learning → review → new (by due order)
   - **Learning steps**: New cards follow `delays` (default [1, 10] minutes)
   - **Review scheduling**: Uses `ivl` (days) and `factor` (permille)
   - **Lapses**: Decrease ease factor, go to relearning steps
   - **Ease factor updates**: Clamp to MIN_EASE_FACTOR (1300)
   - **Interval calculation**: Good = `ivl * factor`, Hard = `ivl * 1.2`, Easy = `ivl * factor * 1.3`
   - **Fuzz**: ±5% randomization on intervals ≥2 days

5. **`src/services/anki/Adapter.ts`**
   - `bootstrapFromSeed()`: Convert simple `Card[]` to Anki schema
   - `toViewCard()`: Convert Anki card + note back to UI `Card`
   - Creates notes with fields separated by `0x1F`
   - Generates unique IDs with checksums

6. **`src/context/SchedulerProvider.tsx`**
   - React context providing scheduler state and methods
   - Exports: `current`, `next`, `cardType`, `answer()`, `bootstrap()`, `stats`
   - Maps `Difficulty` to `RevlogEase` (1-4)
   - Handles 3-button vs 4-button mapping for learning vs review

## Anki Schema Compliance

### Cards Table
```typescript
{
  id: string,           // card ID (stringified int64)
  nid: string,          // note ID
  did: string,          // deck ID
  ord: number,          // ordinal (template index)
  mod: number,          // last modified (epoch seconds)
  usn: number,          // update sequence (-1 for local)
  type: CardType,       // 0=new, 1=learning, 2=review, 3=relearning
  queue: CardQueue,     // scheduling queue
  due: number,          // new=order, learn=seconds, review=days since crt
  ivl: number,          // interval in days
  factor: number,       // ease factor (permille, e.g., 2500 = 2.5)
  reps: number,         // review count
  lapses: number,       // lapse count
  left: number,         // a*1000+b (a=reps left, b=total steps)
  odue: number,         // original due (filtered decks)
  odid: string,         // original deck
  flags: number,        // user flags
  data: string,         // unused
}
```

### Revlog Table
```typescript
{
  id: string,           // epoch milliseconds
  cid: string,          // card ID
  usn: number,
  ease: RevlogEase,     // 1=Again, 2=Hard, 3=Good, 4=Easy
  ivl: number,          // negative=seconds (learn), positive=days (review)
  lastIvl: number,      // previous interval
  factor: number,       // ease factor (permille)
  time: number,         // response time (milliseconds)
  type: RevlogType,     // 0=learn, 1=review, 2=relearn
}
```

## Scheduling Algorithm

### New Cards → Learning
- **Again**: Start at first learning step (1 min)
- **Good**: Next learning step or graduate if last step
- **Easy**: Graduate immediately with easy interval (4 days)

### Learning Cards
- **Again**: Restart at first step
- **Good**: Advance to next step or graduate
- **Easy**: Graduate with easy interval

### Review Cards
- **Again**: Lapse → relearning, decrease ease factor, track lapses
- **Hard**: New interval = `ivl * 1.2`, ease factor -= 150
- **Good**: New interval = `ivl * (factor/1000)`
- **Easy**: New interval = `ivl * (factor/1000) * 1.3`, ease factor += 150

### Relearning (after lapse)
- Follow lapse.delays (default [10] minutes)
- Graduate back to review with `max(lapse.minInt, ivl)`

## UI Integration

### StudyScreen Changes
- Removed `useState(sampleCards)` and `currentIndex`
- Uses `useScheduler()` hook for `current`, `next`, `cardType`
- Calls `bootstrap(sampleCards)` on mount
- `handleAnswer()` calculates response time and calls `answer(difficulty, ms)`
- Renders only current + next card (no array mapping)

### RightRail Updates
- Accepts `cardType: CardType | null`
- **Learning cards** (new/learning/relearning): Shows 3 buttons (Again, Good, Easy)
- **Review cards**: Shows 4 buttons (Again, Hard, Good, Easy)
- Matches Anki UX exactly

### Root App
- Wrapped with `<SchedulerProvider>` in `src/index.tsx`

## Default Configuration

```typescript
new: {
  delays: [1, 10],           // minutes
  ints: [1, 4, 7],          // good, easy, unused (days)
  initialFactor: 2500,      // 2.5x
  perDay: 20,
}
rev: {
  perDay: 200,
  ease4: 150,               // +0.15 on easy
  ivlFct: 1.0,
  maxIvl: 36500,            // 100 years
  fuzz: 0.05,
}
lapse: {
  delays: [10],             // minutes
  mult: 0.5,                // halve interval
  minInt: 1,                // min 1 day
  leechAction: 0,           // suspend
  leechFails: 8,
}
```

## Queue Priority

1. **Learning/Relearning** cards where `due ≤ now` (epoch seconds)
2. **Review** cards where `due ≤ daysSinceCrt(now)` (days)
3. **New** cards by `due` order (position)

## Future Roadmap

### Phase 2: Persistence
- AsyncStorage snapshot/restore for app reload
- Serialize InMemoryDb to JSON

### Phase 3: SQLite
- expo-sqlite integration
- Mirror Anki tables exactly
- Support .anki2 import

### Phase 4: Anki Import
- Parse col.anki2 (SQLite database)
- Read cards, notes, decks, dconf, models
- Template rendering for note types
- Cloze deletion support
- Import revlog history

## Testing

To test the scheduler:
1. Launch app → navigates to Study screen
2. Tap card to reveal answer
3. See 3 buttons for new cards (Again, Good, Easy)
4. Answer with any difficulty
5. Card schedules according to SM-2
6. Next card appears immediately
7. RightRail shows correct button count based on card state

## Files Created

- `src/services/anki/schema.ts` (270 lines)
- `src/services/anki/time.ts` (150 lines)
- `src/services/anki/InMemoryDb.ts` (310 lines)
- `src/services/anki/SchedulerV2.ts` (470 lines)
- `src/services/anki/Adapter.ts` (90 lines)
- `src/context/SchedulerProvider.tsx` (150 lines)

## Files Modified

- `src/app/Study/StudyScreen.tsx` (removed mock data, integrated scheduler)
- `src/app/Study/RightRail.tsx` (added cardType prop, conditional buttons)
- `src/index.tsx` (wrapped with SchedulerProvider)

---

**Total**: ~1,440 lines of scheduler code + Anki schema compliance
