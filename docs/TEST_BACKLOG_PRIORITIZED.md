# Test Coverage Backlog - Prioritized

**Status:** Post-audit prioritization based on risk assessment

---

## 🚨 P0 - Critical (Block Production Deploy)

### 1. Firebase Functions - Authentication Handlers
**Risk:** High - affects all users, hard to rollback
**Effort:** Medium (2-3 days)
**Files:** `firebase/functions/src/handlers/`

**Tests Needed:**
```typescript
// firebase/functions/src/handlers/__tests__/aiHints.test.ts
describe('aiHints Cloud Function', () => {
  it('requires authentication token');
  it('validates request has cards array');
  it('validates card structure (id, model, front/back/cloze)');
  it('returns 429 if user exceeds rate limit');
  it('calls OpenAI with correct prompt format');
  it('handles OpenAI API errors (timeout, rate limit, invalid key)');
  it('returns structured hints response');
  it('logs errors without exposing API keys');
});

// firebase/functions/src/handlers/__tests__/parse.test.ts
describe('parse Cloud Function', () => {
  it('requires authentication');
  it('rejects files over size limit');
  it('handles Anki APKG parsing');
  it('extracts deck metadata correctly');
  it('handles corrupted files gracefully');
  it('returns proper error messages');
  it('cleans up temp files on error');
});
```

### 2. RevenueCat Webhook Handler
**Risk:** High - monetization bugs = revenue loss
**Effort:** Medium (1-2 days)
**Files:** `firebase/functions/src/handlers/revenuecat-webhook.ts`

**Tests Needed:**
```typescript
describe('RevenueCat Webhook', () => {
  it('verifies webhook signature');
  it('rejects invalid signatures');
  it('handles duplicate events (idempotency key)');
  it('updates Firestore user entitlements on INITIAL_PURCHASE');
  it('updates on RENEWAL');
  it('updates on CANCELLATION');
  it('handles BILLING_ISSUE events');
  it('logs webhook processing for audit');
  it('returns 200 even on processing errors (prevent retry storms)');
});
```

---

## 🔥 P1 - High Priority (Next Sprint)

### 3. Premium Context - Purchase Flows
**Risk:** High - broken purchases = lost revenue
**Effort:** Medium (2-3 days)
**Files:** `src/context/PremiumContext.tsx`

**Tests Needed:**
```typescript
// src/context/__tests__/PremiumContext.test.tsx
import Purchases from 'react-native-purchases';

jest.mock('react-native-purchases');

describe('PremiumContext', () => {
  describe('subscribe', () => {
    it('successfully purchases package');
    it('updates local entitlement state');
    it('handles user cancellation gracefully');
    it('shows error on payment declined');
    it('shows error on network timeout');
    it('retries entitlement check after purchase');
  });

  describe('restore', () => {
    it('restores previous purchases successfully');
    it('shows message when no purchases found');
    it('updates entitlements from restored purchases');
    it('handles network errors during restore');
  });

  describe('entitlement checks', () => {
    it('checks entitlements on app launch');
    it('caches entitlements locally');
    it('falls back to cache when offline');
    it('refreshes cache every 24 hours');
    it('handles expired entitlements');
  });
});
```

### 4. StorageService - Backend File Operations
**Risk:** Medium - affects imports/exports
**Effort:** Small (1 day)
**Files:** `firebase/functions/src/services/storage/`

**Tests Needed:**
```typescript
describe('StorageService', () => {
  it('generates correct Firebase Storage URLs');
  it('generates emulator URLs in dev mode');
  it('creates signed URLs with 1 hour expiration');
  it('retrieves file metadata (size, contentType)');
  it('handles missing files (returns null)');
  it('deletes files and confirms deletion');
  it('handles permission errors gracefully');
  it('respects bucket configuration');
});
```

---

## ⚠️ P2 - Medium Priority (Next Month)

### 5. Card Content Renderer - Transform Logic
**Risk:** Medium - rendering bugs affect UX
**Effort:** Medium (2 days)
**Files:** `src/components/CardContentRendererV2.tsx`, extract to utils

**Refactor + Test:**
```typescript
// src/utils/cardTransforms.ts (NEW - extract from renderer)
export function transformClozeForFront(
  text: string,
  activeIndex: number
): string;

export function transformClozeForBack(
  text: string, 
  activeIndex: number
): string;

export function rewriteMediaSrc(
  html: string,
  mediaDir: string
): string;

// src/utils/__tests__/cardTransforms.test.ts
describe('cloze transforms', () => {
  describe('front side', () => {
    it('replaces {{c1::text}} with [...]');
    it('shows inactive cloze deletions as normal text');
    it('handles multiple cloze in same card');
    it('preserves hint text {{c1::text::hint}}');
    it('handles malformed cloze syntax gracefully');
  });

  describe('back side', () => {
    it('shows {{c1::text}} as plain text');
    it('highlights active cloze deletion');
    it('shows all cloze deletions on back');
  });
});

describe('media src rewriting', () => {
  it('rewrites image src to file:// URIs');
  it('handles missing images gracefully');
  it('preserves external URLs (https://)');
  it('encodes special characters in filenames');
});
```

### 6. DiscoverService - Edge Cases
**Risk:** Low - minor error message issues
**Effort:** Small (2 hours)
**Files:** `src/services/discover/__tests__/DiscoverService.test.ts`

**Add Tests:**
```typescript
describe('Firebase error JSON mapping', () => {
  it('parses 403 Forbidden error JSON');
  it('parses 404 Not Found error JSON');
  it('handles non-JSON error responses');
  it('provides helpful error messages for common cases');
});
```

### 7. NotificationService - Missing Method
**Risk:** Low - minor coverage gap
**Effort:** Trivial (30 min)
**Files:** `src/services/__tests__/NotificationService.test.ts`

**Add Test:**
```typescript
describe('getAllScheduledNotifications', () => {
  it('returns all scheduled notifications');
  it('returns empty array when none scheduled');
  it('formats notification data correctly');
});
```

---

## 🔧 P3 - Low Priority (Nice to Have)

### 8. ApiService - Timeout Test Improvement
**Risk:** Low - code review covers this
**Effort:** Medium (requires refactor or complex mock)
**Files:** `src/services/cloud/__tests__/ApiService.behavior.test.ts`

**Options:**
1. **Refactor for testability:**
```typescript
// Make timeout injectable
class ApiService {
  constructor(
    private timeouts = {
      default: 120000,
      parse: 600000,
      ai: 600000,
    }
  ) {}
}

// Test with custom timeouts
const service = new ApiService({ default: 100, parse: 200 });
```

2. **Mock AbortController:**
```typescript
it('uses 600000ms timeout for /parse/', () => {
  const abortSpy = jest.spyOn(AbortController.prototype, 'abort');
  const timeoutSpy = jest.spyOn(global, 'setTimeout');
  
  ApiService.post('/parse/doc', {});
  
  expect(timeoutSpy).toHaveBeenCalledWith(
    expect.any(Function),
    600000
  );
});
```

3. **Accept as documentation:**
- Current test serves as smoke test
- Manual testing + code review sufficient
- Low risk of timeout regression

**Recommendation:** Option 3 (accept as-is) unless timeout bugs occur

---

## 📊 Summary by Priority

| Priority | Tests | Risk | Effort | ETA |
|----------|-------|------|--------|-----|
| P0 | 2 suites | Critical | 4-5 days | Sprint 1 |
| P1 | 2 suites | High | 3-4 days | Sprint 2 |
| P2 | 3 suites | Medium | 3 days | Month 1 |
| P3 | 1 suite | Low | Variable | Backlog |

**Total Remaining Test Work:** ~10-12 days effort

---

## 🎯 Sprint Planning Recommendation

### Sprint 1 (Current)
- ✅ Complete current test suite improvements
- ✅ Document audit findings
- [ ] Start Firebase Functions tests (aiHints, parse)

### Sprint 2 (Next)
- [ ] Complete Firebase Functions tests (webhook)
- [ ] PremiumContext full coverage
- [ ] StorageService tests

### Sprint 3 (Following)
- [ ] Card rendering transforms (extract + test)
- [ ] DiscoverService edge cases
- [ ] NotificationService completion

### Sprint 4+ (Future)
- [ ] Integration tests for critical paths
- [ ] E2E tests for study flow
- [ ] Performance testing
- [ ] Manual QA checklists

---

## 🚀 Getting Started

### For P0 Firebase Functions:

1. **Setup test environment:**
```bash
cd firebase/functions
npm install --save-dev @types/jest
```

2. **Create test structure:**
```
firebase/functions/src/
├── handlers/
│   ├── __tests__/
│   │   ├── aiHints.test.ts
│   │   ├── parse.test.ts
│   │   └── revenuecat-webhook.test.ts
│   ├── aiHints.ts
│   ├── parse.ts
│   └── revenuecat-webhook.ts
```

3. **Mock Firebase Admin:**
```typescript
jest.mock('firebase-admin', () => ({
  auth: () => ({
    verifyIdToken: jest.fn(),
  }),
  firestore: () => ({
    collection: jest.fn(),
  }),
}));
```

4. **Test authentication first:**
```typescript
it('requires authentication token', async () => {
  const req = { headers: {} };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  
  await aiHintsHandler(req, res);
  
  expect(res.status).toHaveBeenCalledWith(401);
});
```

---

## 📝 Notes

- **P0 items block production** - must be done before launch
- **P1 items prevent revenue loss** - high priority
- **P2 items improve quality** - do when bandwidth allows
- **P3 items are polish** - optional improvements

**All estimates assume:**
- Familiarity with codebase
- Access to Firebase emulator
- Mock RevenueCat available
- No major blockers

**Re-evaluate priorities** if production issues arise in any area.
