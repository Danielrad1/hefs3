# Testing Quick Start Guide

## ✅ What's Already Set Up

1. **Jest configuration** - `jest.config.js`
2. **Test setup with mocks** - `jest.setup.js`
3. **Two working test files**:
   - `MediaService.test.ts` - Tests your hash fix!
   - `CardService.test.ts` - Tests card operations
4. **Test helpers** - `factories.ts` for creating test data

## 🚀 Run Tests Now

```bash
# Run all tests
npm test

# Watch mode (re-runs on file changes)
npm test -- --watch

# Run specific test
npm test MediaService

# With coverage report
npm test -- --coverage
```

## 📝 What Each Test File Does

### MediaService.test.ts (PRIORITY 1)
**Tests your critical hash fix:**
- ✅ SHA-256 hashing is deterministic
- ✅ Deduplication works by content hash
- ✅ Garbage collection preserves referenced media
- ✅ Filename sanitization prevents path traversal

**Why it matters:** Validates the media hashing fix you just implemented.

### CardService.test.ts
**Tests card querying:**
- ✅ Find cards by deck
- ✅ Find cards by type (new, suspended, etc.)
- ✅ Suspend/unsuspend operations
- ✅ Delete cards and orphaned notes

## 📋 Next Steps (Priority Order)

### Week 1: Core Services (Do This First)
```bash
# Create these test files:
src/services/anki/__tests__/
  ├── NoteService.test.ts       # CRUD + media cleanup
  ├── DeckService.test.ts       # Deck operations
  └── StatsService.test.ts      # Statistics calculations
```

**Why these?** They test your critical business logic where bugs hurt most.

### Week 2: Integration Tests
```bash
src/services/__tests__/integration/
  ├── delete-cascade.test.ts    # Delete → Media GC flow
  └── import-media.test.ts      # Import → Dedupe flow
```

**Why these?** They test how services work together for real user flows.

### Week 3: Component Tests (Optional)
```bash
src/app/Browser/__tests__/
  └── CardBrowserScreen.test.tsx  # Delete button functionality
```

## 🎯 Coverage Goals

- **Services**: 70%+ (your business logic)
- **Components**: 30%+ (focus on critical ones)
- **Overall**: 50-60% (balanced, pragmatic)

## 🔧 Using Test Helpers

Instead of manually creating test data:

```typescript
// ❌ Don't do this
const card = {
  id: 'card1',
  nid: 'note1',
  did: '1',
  ord: 0,
  mod: Math.floor(Date.now() / 1000),
  // ... 15 more fields
};

// ✅ Do this
import { createTestCard } from '../helpers/factories';
const card = createTestCard({ did: '2' }); // Override just what you need
```

**Available helpers:**
- `createTestCard()` - New card with defaults
- `createReviewCard()` - Card that's been studied
- `createTestNote()` - Note with fields
- `createTestDeck()` - Deck
- `createTestMedia()` - Media file
- `createDeckWithCards(5)` - Complete deck with 5 cards

## 🐛 Debugging Failed Tests

```bash
# Run single test with full output
npm test -- MediaService.test.ts --verbose

# See what's covered
npm test -- --coverage --collectCoverageFrom='src/services/**/*.ts'

# Debug in VSCode
# 1. Set breakpoint
# 2. Press F5 or use "Debug Jest Tests" config
```

## 📊 Example Test Output

```
PASS src/services/anki/__tests__/MediaService.test.ts
  MediaService
    Hash Calculation
      ✓ should generate deterministic SHA-256 hashes (15ms)
      ✓ should use SHA-256 algorithm (5ms)
      ✓ should fall back gracefully on hash error (8ms)
    Deduplication
      ✓ should deduplicate identical files by hash (12ms)
      ✓ should store different files separately (10ms)
    Garbage Collection
      ✓ should delete orphaned media files (8ms)
      ✓ should preserve media referenced in notes (6ms)
      ✓ should handle audio references in notes (5ms)

Test Suites: 1 passed, 1 total
Tests:       8 passed, 8 total
Time:        2.156s
```

## ⚠️ Common Issues

### Issue: "Cannot find module 'expo-crypto'"
**Solution:** Already mocked in `jest.setup.js` ✅

### Issue: "FileSystem.getInfoAsync is not a function"
**Solution:** Already mocked in `jest.setup.js` ✅

### Issue: "Test suite must contain at least one test"
**Solution:** Helper files are now ignored in `jest.config.js` ✅

### Issue: Test timeout
**Solution:** Add `jest.setTimeout(10000)` to slow tests

## 📚 Writing Your First Test

**Template for any service:**

```typescript
import { ServiceName } from '../ServiceName';
import { InMemoryDb } from '../InMemoryDb';
import { createTestCard } from '../helpers/factories';

describe('ServiceName', () => {
  let db: InMemoryDb;
  let service: ServiceName;

  beforeEach(() => {
    db = new InMemoryDb();
    service = new ServiceName(db);
  });

  describe('methodName', () => {
    it('should do the expected thing', () => {
      // Arrange: Set up test data
      const card = createTestCard();
      db.addCard(card);

      // Act: Call the method
      const result = service.doSomething(card.id);

      // Assert: Check the result
      expect(result).toBe(expectedValue);
    });
  });
});
```

## 🎓 Best Practices

### ✅ DO
- Test business logic in services
- Use test helpers (factories)
- Mock external dependencies (filesystem, network)
- Focus on critical paths first
- Write tests that fail for the right reasons

### ❌ DON'T
- Test implementation details
- Test third-party libraries
- Aim for 100% coverage
- Write tests that always pass
- Mock everything (test real logic when possible)

## 🚢 CI Integration

Your tests should run on every commit. Add to `.github/workflows/test.yml`:

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm test -- --coverage
```

## 📖 Full Documentation

For comprehensive testing strategy, see:
- **TESTING_ROADMAP.md** - Complete 4-week plan
- **MediaService.test.ts** - Example of well-tested service
- **factories.ts** - All available test helpers

## 🎯 Success Criteria

**You're done with Phase 1 when:**
- [ ] All existing tests pass (`npm test`)
- [ ] MediaService has 80%+ coverage
- [ ] CardService tests validate key operations
- [ ] You've added 2-3 more service tests
- [ ] CI runs tests on every push

**Start here:**
```bash
# Verify tests work
npm test

# Pick a service to test next
# Suggested: NoteService (delete note → media cleanup)
```

---

**Remember:** Tests are an investment. Start small, focus on high-value tests, and expand gradually. You've already got a solid foundation! 🚀
