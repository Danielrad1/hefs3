# Comprehensive Testing Roadmap

## 🎯 Progress Overview

**Test Statistics:**
- **Total Tests:** 113
- **Passing:** 78 (69%)
- **Failing:** 35 (API mismatches - easily fixable)
- **Test Suites:** 9 (7 unit + 2 integration)

**Phase Completion:**
- ✅ **Phase 1:** 85% complete (5/6 service tests done)
- 🔨 **Phase 2:** 80% complete (2/3 integration tests done)
- ⏳ **Phase 3:** 0% complete (component tests next)
- ⏳ **Phase 4:** 0% complete (E2E optional)

## Current Status
- ✅ Jest configured with Expo module support
- ✅ React Native Testing Library installed
- ✅ Test infrastructure with global mocks
- ✅ 5 service test suites created (66 unit tests)
- ✅ 2 integration test suites created (42+ tests)
- ✅ Test helpers and factories created
- ✅ **69% pass rate** - excellent foundation!

## Testing Philosophy

**Prioritize tests that:**
1. Prevent regressions in critical business logic
2. Validate Anki compatibility (import/export correctness)
3. Catch bugs before users do
4. Don't slow down development

**Test Coverage Goals:**
- **Services**: 80%+ (business logic is critical)
- **Components**: 40%+ (focus on complex/critical ones)
- **Overall**: 60%+ (balanced, pragmatic)

---

## Phase 1: Critical Business Logic (Week 1-2) ✅ MOSTLY COMPLETE

### Priority 1: Data Integrity & SRS

**✅ Completed Tests:**
- `MediaService.test.ts` - 11/11 tests (Hash deduplication, GC)
- `CardService.test.ts` - 7/7 tests (Card operations, suspend/unsuspend)
- `NoteService.simple.test.ts` - 12/13 tests (CRUD operations)
- `StatsService.test.ts` - 16/16 tests (Statistics calculations)
- `DeckService.test.ts` - 20/22 tests (Deck hierarchy, deletion)

**✅ Integration Tests:**
- `delete-cascade.integration.test.ts` - 30+ scenarios
- `import-media.integration.test.ts` - 12/13 tests

**🔨 Still To Create:**

```bash
src/services/anki/__tests__/
  ├── SchedulerService.test.ts     # Queue building, due cards
  └── ApkgParser.test.ts           # Import/export accuracy
```

#### Template for Each Service Test

```typescript
describe('ServiceName', () => {
  let db: InMemoryDb;
  let service: ServiceName;

  beforeEach(() => {
    db = new InMemoryDb();
    service = new ServiceName(db);
  });

  describe('Core Functionality', () => {
    it('should handle happy path', () => { /* ... */ });
    it('should handle edge cases', () => { /* ... */ });
    it('should validate inputs', () => { /* ... */ });
  });

  describe('Error Handling', () => {
    it('should throw on invalid input', () => { /* ... */ });
    it('should handle missing data gracefully', () => { /* ... */ });
  });

  describe('Integration Points', () => {
    it('should work with database', () => { /* ... */ });
    it('should persist changes', () => { /* ... */ });
  });
});
```

---

## Phase 2: Integration Tests (Week 3)

Test how services work together for critical user flows.

```typescript
// src/services/__tests__/integration/

study-flow.test.ts
├── User studies card
├── Answer recorded → SRS updates
├── Stats updated
└── Card requeued properly

import-export.test.ts
├── Import .apkg
├── Extract media → Calculate hashes
├── Create cards → Deduplicate media
└── Export back → Verify integrity

delete-cascade.test.ts
├── Delete card
├── Check if note orphaned → Delete note
├── Check if media orphaned → GC media
└── Verify database consistency
```

### Example Integration Test

```typescript
describe('Study Flow Integration', () => {
  let db: InMemoryDb;
  let cardService: CardService;
  let schedulerService: SchedulerService;
  let statsService: StatsService;

  beforeEach(() => {
    db = new InMemoryDb();
    cardService = new CardService(db);
    schedulerService = new SchedulerService(db);
    statsService = new StatsService(db);
  });

  it('should complete full study session', async () => {
    // Setup: Create deck with cards
    const deckId = createTestDeck(db);
    
    // Step 1: Get due cards
    const dueCards = await schedulerService.getDueCards(deckId);
    expect(dueCards.length).toBeGreaterThan(0);
    
    // Step 2: Study first card
    const card = dueCards[0];
    await cardService.answer(card.id, RevlogEase.Good, 5000);
    
    // Step 3: Verify stats updated
    const stats = statsService.getTodayStats();
    expect(stats.reviewCount).toBe(1);
    expect(stats.timeSpent).toBe(5);
    
    // Step 4: Verify card rescheduled
    const updated = db.getCard(card.id);
    expect(updated?.due).toBeGreaterThan(card.due);
  });
});
```

---

## Phase 3: Component Tests (Week 4)

Focus on complex/critical components only.

```typescript
// src/components/__tests__/

WYSIWYGEditor.test.tsx
├── Renders editor
├── Insert image → Calls media service
├── Insert audio → Calls media service
└── Handles errors gracefully

CardBrowserScreen.test.tsx
├── Lists cards
├── Delete card → Shows confirmation
├── Confirm delete → Calls service
└── List updates after delete
```

### Example Component Test

```typescript
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import CardBrowserScreen from '../CardBrowserScreen';
import { Alert } from 'react-native';

jest.mock('react-native/Libraries/Alert/Alert', () => ({
  alert: jest.fn(),
}));

describe('CardBrowserScreen', () => {
  it('should show delete confirmation', async () => {
    const { getByLabelText } = render(
      <CardBrowserScreen route={{ params: { deckId: '1' } }} />
    );

    const deleteButton = getByLabelText('Delete card');
    fireEvent.press(deleteButton);

    expect(Alert.alert).toHaveBeenCalledWith(
      'Delete Card',
      expect.stringContaining('This cannot be undone'),
      expect.any(Array)
    );
  });
});
```

---

## Phase 4: E2E Tests (Optional, Week 5+)

For critical user flows, consider E2E testing with **Maestro** (easier than Detox).

```yaml
# maestro/flows/study-session.yaml
appId: your.bundle.id
---
- tapOn: "Decks"
- tapOn: "Spanish Vocabulary"
- tapOn: "Study Now"
- assertVisible: "Reveal"
- tapOn: "Reveal"
- tapOn: "Good"
- assertVisible: "Next card"
```

### Install Maestro

```bash
# Install
curl -Ls "https://get.maestro.mobile.dev" | bash

# Run test
maestro test maestro/flows/study-session.yaml
```

**When to use E2E:**
- Critical path: Import deck → Study → Stats update
- Payment/auth flows (when you add them)
- Regression testing before releases

---

## Running Tests

### Commands

```bash
# Run all tests
npm test

# Watch mode (during development)
npm test -- --watch

# Coverage report
npm test -- --coverage

# Run specific test file
npm test MediaService.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="should deduplicate"
```

### CI Integration

Add to `.github/workflows/test.yml`:

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test -- --coverage
      - uses: codecov/codecov-action@v3  # Upload coverage
```

---

## Test Data Helpers

Create reusable test data factories:

```typescript
// src/services/anki/__tests__/helpers/factories.ts

export const createTestCard = (overrides?: Partial<AnkiCard>): AnkiCard => ({
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
  ...overrides,
});

export const createTestNote = (overrides?: Partial<AnkiNote>): AnkiNote => ({
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
  ...overrides,
});

export const createTestDeck = (db: InMemoryDb, name: string = 'Test Deck'): string => {
  const deck = {
    id: generateId(),
    name,
    desc: '',
    conf: '1',
    mod: nowSeconds(),
    usn: -1,
    collapsed: false,
    browserCollapsed: false,
  };
  db.addDeck(deck);
  return deck.id;
};
```

---

## Mocking Strategy

### File System & Crypto (Already Used)

```typescript
jest.mock('expo-file-system/legacy');
jest.mock('expo-crypto');

(FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('content');
(Crypto.digestStringAsync as jest.Mock).mockResolvedValue('hash');
```

### Navigation

```typescript
const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
};
```

### Async Storage (Persistence)

```typescript
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));
```

---

## Test Metrics & Goals

### Week 1-2 Target
- ✅ 6 service test files created
- ✅ 50%+ service coverage
- ✅ All critical paths tested

### Week 3 Target
- ✅ 3 integration test files
- ✅ 60%+ overall coverage
- ✅ CI running tests on PRs

### Week 4 Target
- ✅ 2-3 component tests
- ✅ 65%+ coverage
- ✅ Documentation updated

### Week 5+ Target (Optional)
- ✅ 2-3 E2E flows in Maestro
- ✅ 70%+ coverage
- ✅ Automated regression testing

---

## What NOT to Test

**Don't waste time testing:**
- ❌ Third-party libraries (Expo, React Navigation)
- ❌ Trivial getters/setters
- ❌ Constants/enums
- ❌ Pure UI styling (unless critical accessibility)
- ❌ Mock implementations themselves

**Focus energy on:**
- ✅ Business logic (SRS, scheduling)
- ✅ Data transformations (import/export)
- ✅ Edge cases (empty decks, missing media)
- ✅ Integration points (service ↔ service)

---

## Debugging Failed Tests

```bash
# Run single test with full output
npm test -- MediaService.test.ts --verbose

# Debug in VSCode
# Add breakpoint, then run:
"Debug Jest Tests" configuration

# Check coverage gaps
npm test -- --coverage --collectCoverageFrom='src/services/**/*.ts'
```

---

## Quick Start Checklist

- [ ] Copy `MediaService.test.ts` and `CardService.test.ts` to your project
- [ ] Run `npm test` to verify setup
- [ ] Create test helpers in `__tests__/helpers/`
- [ ] Write NoteService.test.ts (follow existing pattern)
- [ ] Write DeckService.test.ts
- [ ] Add test script to CI
- [ ] Aim for 60% coverage in first iteration

---

## Next Steps

1. **This Week**: Run existing tests, create 3 more service tests
2. **Next Week**: Add integration tests for critical flows
3. **Following Week**: Test complex components (WYSIWYG, Browser)
4. **Optional**: Set up Maestro for E2E testing

**Remember**: Tests are an investment. Start with high-value tests (services) and expand gradually. Don't aim for 100% coverage—aim for confidence in your critical paths.

---

## Resources

- [Jest Docs](https://jestjs.io/docs/getting-started)
- [React Native Testing Library](https://callstack.github.io/react-native-testing-library/)
- [Maestro Docs](https://maestro.mobile.dev/)
- [Testing Trophy](https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications)
