# Test Coverage Audit - External Review Findings

## Executive Summary

External audit identified **strong core coverage** with specific gaps in:
1. Firebase Functions (server-side)
2. Premium/RevenueCat flows
3. Card rendering transforms
4. Storage service

**Current Coverage:** 97.8% of tests passing, excellent coverage on client business logic.

---

## ✅ Coverage Strengths (Keep These!)

### API Layer - Comprehensive ✅
- Error mapping: 401/403/429/413/5xx/504
- Offline handling
- Timeout behavior (with noted weakness)
- Network failures
- Authentication flows

### NotificationService - Thorough ✅
- Permission paths (granted, denied, undetermined)
- Android notification channels
- CALENDAR trigger scheduling
- Reschedule on time zone changes
- Cancel operations
- Persistence layer

### SearchIndex - Complete ✅
- HTML/entity handling
- Ranking algorithm
- Deck hierarchy (parent::child notation)
- Tag filtering
- Note updates
- Result limits

### DiscoverService - Solid ✅
- TTL cache expiration
- Stale fallback on network failure
- URL validation
- Pre-existing file cleanup
- Progress callbacks
- Size checks
- Download error handling

### Import Pipeline - Well Covered ✅
**UnzipStrategy:**
- Missing file handling
- Encoding issues
- Base64 writing
- Streaming unzip placeholders
- Large file guard messages

**MediaExtractor:**
- Media file extraction
- Path sanitization
- Error handling

### SchedulerProvider - Good ✅
- Sibling burying policy (IO vs non-IO cards)
- Debounced save ordering (clear → save → re-bury)
- Answer recording

### DeckMetadataService - Strong ✅
- Idempotent loads
- Updates and deletes
- Folder union operations
- Sorting
- AI hints flags

### StatsService - Robust ✅
- Home screen snapshot
- Retention calculations
- Backlog analysis
- Efficiency metrics
- Forecast projections
- Fixed time to avoid rollover flakiness

---

## 🚨 Critical Gaps (High Priority)

### 1. Firebase Functions (Server-Side) - NOT TESTED ❌

**Location:** `firebase/functions/src/`

**Missing Coverage:**
- `aiHints` handler
  - Authentication/authorization
  - Rate limiting
  - Input validation
  - OpenAI API integration
  - Error handling
  - Response formatting
  
- `parse` handler
  - Authentication
  - File size limits
  - Parsing logic
  - Timeout handling
  - Error responses

- RevenueCat webhook handler
  - Webhook signature verification
  - Idempotency (duplicate events)
  - Entitlement updates
  - User claim synchronization
  - Error logging

**Risk:** High - server bugs affect all users, harder to rollback

**Recommendation:**
```typescript
// firebase/functions/src/__tests__/aiHints.test.ts
describe('aiHints function', () => {
  it('rejects unauthenticated requests');
  it('validates card content structure');
  it('handles OpenAI API errors gracefully');
  it('returns properly formatted hints');
  it('respects rate limits per user');
});

// firebase/functions/src/__tests__/revenuecat-webhook.test.ts
describe('RevenueCat webhook', () => {
  it('verifies webhook signature');
  it('handles duplicate events (idempotency)');
  it('updates user entitlements correctly');
  it('logs errors without exposing sensitive data');
});
```

### 2. Premium/RevenueCat Flows - NOT TESTED ❌

**Location:** `src/context/PremiumContext.tsx`

**Missing Coverage:**
- `subscribe()` flow
  - RevenueCat purchase initiation
  - Success handling
  - Cancellation handling
  - Error scenarios (payment declined, network issues)
  
- `restore()` purchases
  - Successful restoration
  - No purchases found
  - Network errors
  
- Entitlement fallback logic
  - Cache vs live checks
  - Offline behavior
  - Error surfacing to UI

**Risk:** High - monetization bugs = revenue loss

**Recommendation:**
```typescript
// src/context/__tests__/PremiumContext.test.tsx
jest.mock('react-native-purchases');

describe('PremiumContext', () => {
  it('successfully subscribes to premium');
  it('handles payment cancellation gracefully');
  it('restores previous purchases');
  it('falls back to cached entitlements offline');
  it('surfaces payment errors to user');
  it('checks entitlement on app launch');
});
```

### 3. StorageService - NOT TESTED ❌

**Location:** `firebase/functions/src/services/storage/StorageService.ts`

**Missing Coverage:**
- Emulator URL generation
- Signed URL generation
- Metadata retrieval
- File deletion
- Error path handling
- Bucket configuration

**Risk:** Medium - storage issues affect imports/exports

**Recommendation:**
```typescript
// firebase/functions/src/services/storage/__tests__/StorageService.test.ts
describe('StorageService', () => {
  it('generates correct emulator URLs');
  it('creates signed URLs with expiration');
  it('retrieves file metadata');
  it('handles missing files gracefully');
  it('deletes files and cleans up');
  it('respects bucket configuration');
});
```

---

## ⚠️ Medium Priority Gaps

### 4. Card Rendering Transforms - UNDER-TESTED

**Location:** `src/components/CardContentRendererV2.tsx`

**Missing Coverage:**
- Cloze front/back transforms
  - `{{c1::text}}` → `[...]` on front
  - `{{c1::text}}` → `text` on back
  - Multiple cloze deletions
  - Nested cloze (edge case)
  
- Image src rewriting
  - Local media paths → URI conversion
  - Error handling for missing images
  
- HTML sanitization
  - XSS prevention
  - Allowed tags/attributes

**Risk:** Medium - rendering bugs affect study experience

**Recommendation:** Factor pure transform functions for testability
```typescript
// src/utils/clozeTransforms.ts (extract from renderer)
export function transformClozeForFront(text: string, activeIndex: number): string;
export function transformClozeForBack(text: string, activeIndex: number): string;

// src/utils/__tests__/clozeTransforms.test.ts
describe('cloze transforms', () => {
  it('hides active cloze on front');
  it('shows active cloze on back');
  it('handles multiple cloze deletions');
  it('preserves hint text');
});
```

### 5. DiscoverService Edge Cases

**Missing:**
- Small file Firebase error JSON mapping (403/404 content parsing)
- Explicit assertion on error message formats

**Recommendation:** Add 1-2 targeted tests for error content parsing

### 6. NotificationService - Minor Gap

**Missing:**
- `getAllScheduledNotifications()` method coverage

**Recommendation:** Easy win, add simple test

---

## 🔧 Test Quality Issues (Fixed/Documented)

### 1. Weak Test: ApiService Timeout ⚠️
**Status:** DOCUMENTED with TODO

**Issue:** Test only asserts `fetch` was called, doesn't verify 600000ms timeout value

**Current Code:**
```typescript
it('uses longer timeout for /parse/ endpoints', async () => {
  // TODO: Doesn't verify actual timeout value
  expect(fetchSpy).toHaveBeenCalled(); // Always passes
});
```

**Improvement Options:**
1. Mock `AbortController` to capture timeout
2. Refactor `ApiService` to inject timeout config for testability
3. Convert to integration test that actually times out

**Priority:** Low - code review + manual testing covers this

### 2. Misleading Test Name ✅ FIXED
**Status:** FIXED

**Before:**
```typescript
it('throws if path separators remain after sanitization', () => {
  // Doesn't test throw, just validates removal
});
```

**After:**
```typescript
it('ensures no path separators remain after sanitization', () => {
  // Accurate name
});
```

### 3. "Documentation" Style Tests
**Examples:**
- "does not require authentication" for health endpoint
- Broad condition checks

**Assessment:** OK but low signal - keep them but don't rely on them for regression detection

---

## 🎯 Flakiness Risks (Low)

**Time-based Logic:** ✅ Well handled
- Fake timers in use
- `setSystemTime` for deterministic dates
- Good practices

**SchedulerProvider Mocks:** ⚠️ Adequate but could be tighter
- If save timing internals change, tests might false-pass
- **Recommendation:** Keep assertions tight on operation order

---

## 📊 Priority Matrix

### Priority 1 (High Risk - Do First)
1. **Firebase Functions tests** (server-side)
   - aiHints handler
   - parse handler  
   - RevenueCat webhook
   
2. **Premium/RevenueCat flows**
   - Subscribe
   - Restore
   - Entitlement checks

### Priority 2 (Medium Risk)
3. **StorageService** (backend)
4. **Card rendering transforms** (client)
5. **ApiService timeout** improvement

### Priority 3 (Low Risk - Nice to Have)
6. DiscoverService error JSON parsing
7. NotificationService `getAllScheduledNotifications`
8. Backup/restore UI (if/when added)

---

## 🚀 Recommended Action Plan

### Week 1: Backend Critical Path
- [ ] Add Firebase Functions test suite
  - Auth checks
  - Input validation
  - Error handling
  - RevenueCat webhook idempotency
- [ ] Add StorageService tests

### Week 2: Monetization Flow
- [ ] Add PremiumContext tests
  - Mock `react-native-purchases`
  - Test subscribe/restore flows
  - Test error scenarios
- [ ] Manual QA on payment flows

### Week 3: Rendering Quality
- [ ] Extract cloze transform functions
- [ ] Add cloze transform tests
- [ ] Add image src rewrite tests
- [ ] Test HTML sanitization

### Week 4: Polish
- [ ] Fix ApiService timeout test (or document why it's OK)
- [ ] Add DiscoverService error parsing tests
- [ ] Add NotificationService coverage
- [ ] Review and tighten SchedulerProvider assertions

---

## 💡 Testing Best Practices Applied

**What's Working:**
✅ Behavior-oriented tests (not implementation details)
✅ Fake timers for time-based logic
✅ Proper mocking boundaries
✅ Clear test names
✅ Good arrange/act/assert structure
✅ Error path coverage

**Areas for Improvement:**
⚠️ More integration tests for server paths
⚠️ Premium flow manual QA checklist
⚠️ Rendering edge case documentation

---

## Bottom Line

**For day-to-day client refactors:** ✅ Solid guard rails in place

**For backend and monetization:** 🚨 Add coverage before production issues arise

**For rendering quirks:** ⚠️ Add targeted tests, especially cloze transforms

**Overall Assessment:** Strong foundation, focused gaps that can be systematically addressed.
