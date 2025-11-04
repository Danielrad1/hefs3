# Test Strategy and Authoring Guide (Single‑Source Plan)

This document explains, in actionable detail, how to author high‑quality tests for every major feature without writing the tests here. Follow the step‑by‑step instructions to produce failing‑first, deterministic unit/integration tests. UI/E2E are intentionally out of scope; we focus on logic and contracts.

## Global Guidelines

- Contract-first: assert observable outputs, side effects, and error messages.
- Deterministic: no real network/storage/time; use mocks and fake timers.
- Triangulate: happy path, edge cases, and failure branches for each unit.
- Fast feedback: keep tests isolated; reset mocks and storage between cases.
- Readability: arrange/act/assert, explicit expectations and failure messages.

## Tooling Setup

- Preset: `jest-expo` (already in jest.config.js)
- Setup file: `jest.setup.js` (already mocks Reanimated, FileSystem, Crypto, Alert)
- Add when needed (per test file):
  - `@react-native-async-storage/async-storage/jest/async-storage-mock`
  - `expo-notifications` manual mock (schedule/cancel/getPermissions)
  - `expo-constants` stub for `expoConfig.extra`
  - `global.fetch` stub with `{ ok, status, headers.get(), json(), text() }`
  - Fake timers: `jest.useFakeTimers()` for time‑dependent logic

Directory conventions: co‑locate suites under the relevant feature path in `__tests__` folders (e.g., `src/services/cloud/__tests__/...`). Test file names should describe the contract, e.g., `ApiService.behavior.test.ts`.

---

## Feature‑by‑Feature Authoring Instructions

### 1) Cloud API Service
File: `src/services/cloud/ApiService.ts`

What to test
- Offline guard: when `NetworkService.isOnline()` is false, `.get/.post` reject with the “No internet connection” message.
- Timeout mapping: when fetch rejects with `{ name: 'AbortError' }`, error message matches the timeout guidance.
- Non‑JSON responses: for `401/403/429/5xx` with non‑JSON content‑type, map to friendly messages as coded.
- JSON success: resolve with `data` payload when `success: true`.
- Health check timeout: `checkHealth()` returns false on abort.

How to write it
- Mock `NetworkService.isOnline` per test.
- Stub `global.fetch` to return `{ ok, status, headers: { get: () => 'text/html' }, text: async () => '...' }` for non‑JSON branches.
- For timeouts, reject with `Object.assign(new Error('x'), { name: 'AbortError' })`.
- For JSON success, return `{ ok: true, headers: { get: ()=>'application/json'}, json: async () => ({ success:true, data:{...} }) }`.
- Assert thrown error messages precisely (e.g., contains “Authentication failed” for 401).

Failure signals to assert
- Meaningful messages for each code path; ensure translation from status→message is correct.

Edge cases
- 413 status triggers “File too large” message.
- Network failures (“Failed to fetch”) map to server‑unreachable message.

### 2) Notification Service
File: `src/services/NotificationService.ts`

What to test
- Enabling notifications requests/grants permission and sets up Android channels (mocked).
- Enabling daily reminder schedules a repeating CALENDAR trigger with the configured `hour`/`minute` and stores the identifier.
- Changing reminder time when enabled cancels the old and re‑schedules new with updated time.
- Disabling notifications cancels all scheduled notifications and disables daily reminder state.

How to write it
- Mock `expo-notifications`: `getPermissionsAsync`, `requestPermissionsAsync`, `scheduleNotificationAsync`, `cancelScheduledNotificationAsync`, `cancelAllScheduledNotificationsAsync`, `setNotificationChannelAsync`, plus enums used in the code.
- Use AsyncStorage mock; clear between tests.
- Use assertions on `scheduleNotificationAsync` call arguments: `trigger.type === CALENDAR`, `repeats === true`, `hour/minute` values.

Edge cases
- Permission denied → `setNotificationsEnabled(true)` returns false and doesn’t schedule.
- Time already passed today → service chooses tomorrow (assert via scheduling logs or inject a clock abstraction if needed; otherwise assert repeating calendar trigger fields only).

### 3) Search Index
File: `src/services/search/SearchIndex.ts`

What to test
- HTML stripping and tokenization lower‑case rules.
- Ranking heuristic: exact match > startsWith > partial substring.
- Deck hierarchy filtering: parent deck filter includes child `parent::child` decks.
- Tag filtering.
- Updates: `updateNote()` and `removeNote()` reflect in search results.

How to write it
- Use `InMemoryDb` to add decks, notes, and cards; then `new SearchIndex(db).indexAll()`.
- Build a few notes so that specific queries produce deterministic ordering.
- After note edits, call `updateNote` and re‑search; then `removeNote` and assert missing.

Edge cases
- Empty query returns empty list.
- Limit option truncates results.

### 4) Hints Sanitizer
File: `src/services/ai/HintsSanitizer.ts`

What to test
- Basic: skip when front/back are image‑only or non‑substantive; accept valid text.
- Cloze: skip when no `{{cN::...}}`; accept when present.
- Entity decoding and whitespace collapse produce expected sanitized strings.
- `getSkipReasonMessage` returns correct human‑readable messages for every code.

How to write it
- Call `sanitizeHintsInput([...])` with a mix of valid/invalid items.
- Assert `valid` contains expected IDs and `skipped` contains correct reasons.

Failure signals
- Misclassified items; incorrect reason texts.

### 5) First‑Run Guide Flags
File: `src/guided/FirstRunGuide.ts`

What to test
- `shouldShowWelcome/Discover/Study` gating behaviors.
- `mark...Shown`, `completeDiscover` (schedules study), `completeStudy` update state.
- `resetAll` wipes all flags.

How to write it
- Mock AsyncStorage; clear between tests.
- Call the flows in sequence; assert booleans at each step.

Edge cases
- Missing/invalid `uid` → functions are no‑ops; should not throw.

### 6) Media Helpers
File: `src/utils/mediaHelpers.ts`

What to test
- `getMediaUri` percent‑encodes filename only (not the directory).
- `sanitizeMediaFilename` strips traversal attempts and both `/` and `\` separators, enforces length limit.

How to write it
- Pass tricky inputs like `'..\\..//bad/..//file.jpg'` and expect `'file.jpg'`.
- Long names: ensure final length ≤ 200 with extension preserved.

### 7) Deck/Folder Metadata
File: `src/services/anki/DeckMetadataService.ts`

What to test
- Idempotent load: concurrent `load()` calls resolve once (reentrancy).
- Set/update/delete deck metadata persists to AsyncStorage and survives a fresh `load()`.
- Folder metadata load/save and `getFolders()` union of folder store and deck metadata.
- AI hints settings defaults and overrides via `setAiHintsEnabled`.

How to write it
- Mock AsyncStorage; verify saved JSON shapes using `.getItem()` values.
- Call `load()` twice concurrently (Promise.all) and ensure it doesn’t double‑load caches.

### 8) Discover Catalog and Downloads
File: `src/services/discover/DiscoverService.ts`

What to test
- Cache TTL: after first `getCatalog()`, subsequent calls within TTL return cached (assert `fetch` called once); after TTL, refetch.
- Stale fallback: if fetch fails, returns previously cached value.
- Download success path: verifies `createDownloadResumable` progress callback is invoked (throttled) and file verification passes.
- Small/invalid file handling: when downloaded file is very small, read content and map Firebase errors (404/403) to explicit messages.

How to write it
- Mock `global.fetch` for catalog endpoint.
- Mock `expo-file-system/legacy` `createDownloadResumable` to invoke progress and resolve to a mock `uri`; mock `getInfoAsync` to simulate size conditions and `readAsStringAsync` for tiny files.

Edge cases
- Invalid `downloadUrl` (missing http/https) throws validation error before download begins.

### 9) Scheduler Provider (integration glue)
File: `src/context/SchedulerProvider.tsx`

What to test
- Sibling burying policy: non‑IO cards bury siblings; IO cards do not.
- Save debounce: reviews trigger a debounced save, which clears/re‑applies burying only for non‑IO.

How to write it
- Use `InMemoryDb` with notes of different models (standard vs IO) and a small mock scheduler exposed via dependency seams if needed (or spy on `db` and PersistenceService calls).
- Use fake timers to flush the save debounce (`setTimeout(..., 500)`).
- Assert call ordering: `clearBuriedSiblings` → `PersistenceService.save` → (re)bury for non‑IO.

Note: unit coverage for algorithmic promotion/intervals is in `SchedulerV2` tests; focus here on provider‑level policy and persistence orchestration.

### 10) Stats/Forecast
File: `src/services/anki/StatsService.ts`

What to test
- `getGlobalSnapshot()` computes due counts with deck limits and `isDue` logic.
- Again/retention rates over windows (7/30‑day) given a constructed revlog set.
- Backlog median days and overdueness index calculations.

How to write it
- Seed `InMemoryDb` with cards and revlog spanning days; assert returned numbers (use simple constructed scenarios for deterministic results).

### 11) Anki Import Pipeline
Files: `src/services/anki/apkg/*`, `src/services/anki/ApkgParser.ts`

What to test
- UnzipStrategy: missing `collection.anki2` → meaningful error; large file guard triggers user‑facing guidance message.
- MediaExtractor: no `media` file in zip yields empty map (no crash); dedup logic respects filenames.
- ApkgParser: orchestrates streaming unzip path when `enableStreaming: true`; invokes `onProgress` with informative messages.

How to write it
- These use JSZip/expo FS in prod; for unit tests, stub out zip inputs to simulate presence/absence of entries and invoke relevant functions with mocked dependencies.

### 12) Firebase Functions
Files: `firebase/functions/src/handlers/*.ts`, `services/storage/StorageService.ts`

AI Hints Handler (`aiHints.ts`)
- Validates request against zod schema; missing/invalid → 400 with error payload.
- Missing `OPENAI_API_KEY` → 503/500 with “service not configured” message (as coded).
- Provider success returns normalized deck/hints payload; errors surface as handled 500.

Parse Handler (`parse.ts`)
- Reject legacy `doc` with UNSUPPORTED_FORMAT.
- DOCX happy path returns text; PDF happy path calls PDFExtract and returns joined text; no text → NO_TEXT.

RevenueCat Webhook (`revenuecat.ts`)
- Missing/invalid bearer token → 401.
- Idempotency: same event ID returns early (Firestore check mocked) without side effects.
- Custom claim updates applied on success; robust to Firestore unavailability (logs but continues).

StorageService
- Emulator URLs: honor `STORAGE_EMULATOR_HOST` and bucket; result is HTTP with encoded path.
- Prod signed URLs: `getSignedUrl` called with correct action and expiry; error path throws friendly message.

How to write them
- Use Express req/res test doubles (plain objects with spies for `status`/`json`).
- Mock `firebase-admin` modules (`getAuth`, `getFirestore`, `getStorage`).
- For StorageService, stub `file.getSignedUrl`, `file.exists`, and `file.getMetadata`.

### 13) Template Engine (future)
Reference: `docs/all_decks_compatibility.md`

When implemented, tests should cover:
- Field substitution; sections `{{#Field}}/{{^Field}}` truthiness based on trimmed HTML.
- `{{FrontSide}}` computed behavior.
- `cloze:Field` for given `ord` front/back semantics.
- Unknown filter → passthrough + single log.

---

## Authoring Pattern (per test file)

- Arrange: Create minimal fixtures (e.g., `InMemoryDb`, notes/cards, mocks).
- Act: Call public function(s) under test.
- Assert: Check returned values, thrown errors, storage/network/method call arguments.
- Reset: `jest.resetAllMocks()` and storage clear between tests.

## Failure‑First Technique

Before implementing each test body, write the expectation first and run to see it fail. Then implement the subject logic/test scaffolding until it passes. For error branches, explicitly flip one expectation at a time to ensure the test fails when it should.

## What “High Quality” Means Here

- Asserts the exact user‑facing message where relevant.
- Covers at least one failure per public branch.
- Uses fake timers and avoids nondeterministic sleeps.
- Avoids incidental UI concerns; sticks to logic and contracts.
- Keeps tests small and named by behavior (“maps 401 non‑JSON to auth message”).

## Optional Enhancements

- Property‑style tests for filename sanitization (fuzz a set of separator/traversal patterns).
- Lightweight golden fixtures for Stats/Forecast tiny scenarios (documented inputs/outputs).
- Test data builders for common Anki entities (note, card, deck) to reduce duplication.

---

This guide is the single source for authoring tests across the codebase. Follow each section to create suites that reliably catch regressions and are safe to run in CI.

