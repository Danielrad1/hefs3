# Test Implementation Status

This document tracks the implementation status of the test suite as outlined in `test update.md`.

## ✅ Completed Test Suites

### 1. Media Helpers (`src/utils/__tests__/mediaHelpers.test.ts`)
**Status:** ✅ Complete

Tests implemented:
- URI generation with percent-encoding
- Path separator stripping (forward/backward slashes)
- Path traversal prevention
- Filename length limiting with extension preservation
- Integration tests combining sanitization and URI generation

### 2. Cloud API Service (`src/services/cloud/__tests__/ApiService.behavior.test.ts`)
**Status:** ✅ Complete

Tests implemented:
- Offline guard preventing requests when NetworkService.isOnline() is false
- Timeout mapping (AbortError → user-friendly message)
- Non-JSON error response mapping (401, 403, 413, 429, 500, 502, 503, 504)
- JSON success response handling
- Health check endpoint (no auth required)
- POST request body serialization
- Network failure handling

### 3. Notification Service (`src/services/__tests__/NotificationService.test.ts`)
**Status:** ✅ Complete

Tests implemented:
- Permission requesting and checking
- Android notification channel setup
- Daily reminder scheduling with CALENDAR trigger
- Reminder time updates with rescheduling
- Notification enabling/disabling cascade behavior
- Settings persistence in AsyncStorage
- Notification identifier storage
- Immediate notification sending

### 4. Search Index (`src/services/search/__tests__/SearchIndex.test.ts`)
**Status:** ✅ Complete

Tests implemented:
- HTML tag stripping and entity decoding
- Tokenization with lowercase conversion
- Ranking heuristics (exact > startsWith > partial)
- Deck hierarchy filtering (parent includes children via `::`)
- Tag filtering
- Note updates and removals reflected in search
- Empty query handling
- Result limiting
- Preview generation

### 5. Hints Sanitizer (`src/services/ai/__tests__/HintsSanitizer.test.ts`)
**Status:** ✅ Complete

Tests implemented:
- Basic card validation (front/back text required)
- Cloze card validation ({{c1::...}} mask required)
- HTML stripping and entity decoding
- Whitespace collapse
- Image-only detection ([img], [image], <img>, [sound:])
- Empty/non-substantive content detection (< 3 alphanumeric chars)
- Skip reason message generation
- Mixed valid/invalid batch processing
- Error handling (invalid HTML, null values)

### 6. First-Run Guide (`src/guided/__tests__/FirstRunGuide.test.ts`)
**Status:** ✅ Complete

Tests implemented:
- Welcome, Discover, Study gating logic
- State transitions (mark shown, complete flows)
- UID validation (null/undefined/empty handling as no-ops)
- Complete flow sequence testing
- resetAll() functionality
- Multi-user isolation

### 7. Deck Metadata Service (`src/services/anki/__tests__/DeckMetadataService.test.ts`)
**Status:** ✅ Complete

Tests implemented:
- Idempotent loading (concurrent calls resolve once)
- Metadata set/update/delete with persistence
- Folder metadata management
- getFolders() union of folder store and deck metadata
- AI hints settings defaults and overrides
- Corrupted JSON handling
- Fresh load after save verification

### 8. Discover Service (`src/services/discover/__tests__/DiscoverService.test.ts`)
**Status:** ✅ Complete

Tests implemented:
- Cache TTL behavior (24 hours)
- Stale fallback on fetch failure
- Download URL validation (HTTP/HTTPS required)
- File verification (exists, non-zero size)
- Progress callback invocation (throttled)
- Existing file deletion before download
- Force refresh bypassing cache

### 9. Stats Service (`src/services/anki/__tests__/StatsService.test.ts`)
**Status:** ✅ Already Exists

This test file was already present in the codebase and covers:
- Global snapshot with due counts
- Retention rate calculations
- Backlog metrics

---

## 📋 Remaining Test Suites

The following test suites are outlined in `test update.md` but require additional implementation. These are more complex integration tests that involve mocking multiple dependencies or require careful setup.

### 10. Scheduler Provider Integration
**File:** `src/context/__tests__/SchedulerProvider.test.tsx`
**Status:** ⏳ Not Yet Implemented

**Requirements:**
- Test sibling burying policy (non-IO cards bury siblings, IO cards do not)
- Test save debounce behavior (500ms setTimeout)
- Test clearBuriedSiblings → PersistenceService.save → re-bury sequence
- Use InMemoryDb with notes of different models
- Use fake timers to control debounce

**Complexity:** High - requires mocking React context, InMemoryDb, PersistenceService, and using fake timers.

### 11. Anki Import Pipeline
**Files:** 
- `src/services/anki/apkg/__tests__/UnzipStrategy.test.ts`
- `src/services/anki/apkg/__tests__/MediaExtractor.test.ts`
- `src/services/anki/__tests__/ApkgParser.test.ts`

**Status:** ⏳ Not Yet Implemented

**Requirements:**

**UnzipStrategy:**
- Missing `collection.anki2` → meaningful error
- Large file guard triggers user-facing message
- Mock JSZip to simulate zip entries

**MediaExtractor:**
- No `media` file in zip yields empty map
- Deduplication logic respects filenames
- Mock zip file structure

**ApkgParser:**
- Orchestrates streaming unzip when `enableStreaming: true`
- Invokes `onProgress` with informative messages
- Mock dependencies (JSZip, expo-file-system)

**Complexity:** High - requires mocking file system operations and zip file structures.

### 12. Firebase Functions
**Files:**
- `firebase/functions/src/handlers/__tests__/aiHints.test.ts`
- `firebase/functions/src/handlers/__tests__/parse.test.ts`
- `firebase/functions/src/handlers/__tests__/revenuecat.test.ts`
- `firebase/functions/src/services/storage/__tests__/StorageService.test.ts`

**Status:** ⏳ Not Yet Implemented

**Requirements:**

**aiHints Handler:**
- Validate request against zod schema (missing/invalid → 400)
- Missing `OPENAI_API_KEY` → 503/500 with "service not configured"
- Provider success returns normalized deck/hints payload
- Mock Express req/res, OpenAI provider

**parse Handler:**
- Reject legacy `doc` with UNSUPPORTED_FORMAT
- DOCX happy path returns text
- PDF happy path calls PDFExtract and returns joined text
- No text → NO_TEXT error
- Mock file parsing libraries

**revenuecat Webhook:**
- Missing/invalid bearer token → 401
- Idempotency check (same event ID returns early)
- Custom claim updates on success
- Robust to Firestore unavailability
- Mock firebase-admin, Firestore

**StorageService:**
- Emulator URLs honor `STORAGE_EMULATOR_HOST`
- Prod signed URLs call `getSignedUrl` with correct params
- Error path throws friendly message
- Mock firebase-admin storage

**Complexity:** Very High - requires mocking Firebase Admin SDK, Express, and external APIs.

---

## 📊 Summary

**Completed:** 9/12 test suites (75%)
**Remaining:** 3 complex integration test areas

All core service logic tests are complete. The remaining tests involve:
1. React context integration testing
2. File system and zip manipulation mocking
3. Firebase Admin SDK and Cloud Function mocking

These can be implemented when additional integration testing infrastructure is in place or when the specific features need testing before deployment.

---

## 🎯 Next Steps

1. **Run existing tests:** `npm test` or `yarn test`
2. **Verify coverage:** Check that the implemented tests pass
3. **Implement remaining tests incrementally** as needed for CI/CD or feature development
4. **Add test data builders** (optional enhancement) to reduce duplication in test fixtures

All implemented tests follow the principles outlined in `test update.md`:
- Contract-first assertions
- Deterministic (mocked dependencies)
- Triangulated (happy path, edge cases, failures)
- Fast feedback (isolated, reset between tests)
- Readable (arrange/act/assert)
