# Authentication & Backend Architecture – Updated Strategy

This document captures the current requirements, constraints, and the chosen architecture for authentication, cloud features, and future AI capabilities in **memorize-app**.

---

## 1. Requirements (2025-10)

1. **Identity & Access**
   - Email/password sign-in (already working)
   - Optional social login later (Apple / Google)
   - Gate certain features by auth state or subscription tier
2. **Local-First Study Experience**
   - Everything must work offline (SQLite is the source of truth)
   - Sync/backup is a convenience, not a hard requirement
3. **Backup & Restore**
   - Manual export/import today
   - Cloud backup (periodic or on-demand) soon
4. **Discover / Content Distribution**
   - Deliver curated decks from a server
   - Eventually allow dynamic updates without app release
5. **AI Features (Future)**
   - Card generation, smart review suggestions, tagging, etc.
   - Must call 3rd-party model APIs securely (no keys in the client)
6. **Simplicity**
   - Minimize native modules and providers
   - Prefer incremental rollout; backend can start minimal

---

## 2. Constraints & Reality Check

- **Expo + React Native** (development via dev client). Native Firebase pods caused friction beyond Auth.
- **iOS-first**: Android may come later but should not be blocked.
- **SQLite already working** with 2,973 cards; study logic is mature.
- **Time & maintainability**: Solo dev/lean team. Need low-overhead operations.
- **Security**: API keys for AI or storage must not ship with the app.

---

## 3. Current Implementation Snapshot

| Layer           | Status (Oct 2025)                                    |
|-----------------|------------------------------------------------------|
| Identity        | `@react-native-firebase/auth` (v20) + Firebase SDK 10 |
| Data            | Local SQLite via `PersistenceService`                |
| Navigation      | Auth stack enforced (sign-in required)               |
| Discover        | Uses curated in-app mocks (Firestore disabled)       |
| Backup          | Cloud path disabled (Firestore/Storage removed)      |
| AI              | Not implemented                                      |

The build now succeeds because we removed the problematic Firebase Storage and Firestore pods. The app is local-first and stable.

---

## 4. Guiding Principles

1. **Keep Firebase Auth** – it works, is lightweight, and plays nicely with Expo once the native init is patched.
2. **Run everything else over HTTPS** – no more native Firebase Storage/Firestore pods in the client.
3. **One primary backend provider** – stay within the Firebase ecosystem to avoid spreading effort thin.
4. **Incremental rollout** – start with manual backup/export; add cloud endpoints when ready.
5. **Security-first** – AI keys and storage credentials must live server-side.

---

## 5. Recommended Architecture

```
               ┌───────────────────────────────┐
               │           Firebase            │
               │  (single project, 2nd-gen CF) │
               ├──────────────┬────────────────┤
               │ Cloud Functions│ Hosting/Storage│
               └───────┬────────┴──────────┬────┘
                       │                   │
               verifies Firebase      serves signed URLs,
               ID tokens, calls       static JSON, deck
               AI providers           files
                       │                   │
┌──────────────────────▼───────────────────▼──────────────────────┐
│                     memorize-app (client)                       │
│  - Firebase Auth (RNFB v20)                                     │
│  - SQLite (local truth)                                         │
│  - BackupService (HTTP → signed URL → fetch)                    │
│  - DiscoverService (HTTP fetch decks.json)                      │
│  - AiService (HTTP → /ai/generate)                              │
└─────────────────────────────────────────────────────────────────┘
```

### 5.1 Identity
- **Library**: `@react-native-firebase/auth`
- **Flow**: App obtains Firebase ID token (`auth().currentUser.getIdToken()`).
- **Usage**: Attach token to backend requests in `Authorization: Bearer <token>`.
- **Future**: Social providers once needed; no client architecture change required.

### 5.2 Local Data
- **SQLite remains the source of truth** (decks, notes, cards, revlogs, user stats).
- **Conflict strategy**: Last writer wins for backups. Multi-device merge is future work.

### 5.3 Cloud API (Firebase Cloud Functions, 2nd gen)
- **Language/Runtime**: TypeScript on Node 20. Use the new `firebase-functions/v2/https` API, which supports Express-style handlers and async/await out of the box.
- **Deployment Tooling**: `firebase-tools` CLI. Continuous deployment can be wired through GitHub Actions later.
- **Authentication Flow**
  1. Client obtains Firebase ID token via `await auth().currentUser?.getIdToken(true)`.
  2. Token is sent as `Authorization: Bearer <token>` header.
  3. Cloud Function verifies token using `getAuth().verifyIdToken(token)` from `firebase-admin`.
  4. User UID and claims become the server-side identity.
- **Core Functions**
  - `POST /ai/generate`
    - **Input**: `{ prompt: string, deckId?: string, context?: { cardId?: string, fields?: object } }`
    - **Flow**: Verify token ➜ enforce usage quota ➜ call provider (OpenAI SDK, Anthropic, Google Vertex, etc.) ➜ sanitize output ➜ return JSON.
    - **Output**: `{ success: true, result: string | object, tokensUsed: number }`
    - **Security**: Optionally check subscription tier via custom claims (see §5.7).
  - `GET /discover`
    - **Mode A (static)**: Return JSON from Hosting (simple CDN). Makes function optional.
    - **Mode B (dynamic)**: Cloud Function queries Firestore/Storage server-side to build the catalog. Cache result in memory for 5–10 minutes to reduce Firestore reads.
  - `POST /backup/url`
    - **Input**: `{ op: 'put' | 'get' }`
    - **Flow**: Verify token ➜ generate signed URL (Firebase Storage admin SDK) limited to `backups/${uid}/latest.db` ➜ return `{ url, expiresAt }`.
    - **Optional**: Accept `history: true` to version backups (`latest.db` + timestamped).
  - `POST /backup/metadata` (optional)
    - Store/retrieve metadata in Firestore **server-side only**, e.g., upload timestamp, app version, device info.
- **Error Handling Standards**
  - Use consistent JSON error payloads: `{ success: false, code: 'ERR_CODE', message: 'Human readable' }`.
  - Log errors to Cloud Logging with structured context (uid, function, op).
- **Benefits**
  - All provider API keys, secrets, and IAM roles live server-side.
  - The mobile app keeps a tiny bundle (no extra native pods).
  - Functions can enforce quotas, rate limiting, and premium feature gates centrally.

### 5.4 Storage for Decks & Backups
- **Provider**: Firebase Storage, but accessed only through signed URLs.
- **Flow**:
  1. Client requests `POST /backup/url { op: 'put' }` with ID token.
  2. Cloud Function verifies token, returns signed URL scoped to `backups/{uid}/latest.db`.
  3. Client uploads via `fetch(url, { method: 'PUT', body: dbJson })`.
  4. Metadata (timestamp, app version, encrypted flag) stored as object metadata or Firestore document (optional).
  5. Restore uses the same path with `op: 'get'`.
- **Encryption (optional)**: Prior to upload, encrypt SQLite JSON with AES-GCM using a user-supplied passphrase stored in Keychain; decrypt after download.
- **Discover decks**:
  - Host deck manifest (`decks.json`) via Firebase Hosting.
  - Deck files stored alongside (e.g., `decks/spanish-basic.apkg`).
  - Client fetches `https://<project>.web.app/decks.json`.

**Implementation Details Aligned with Current Stack**

- **Uploading from React Native**
  ```ts
  const token = await auth().currentUser?.getIdToken(true);
  const signed = await fetch(`${API_BASE}/backup/url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ op: 'put' }),
  }).then(res => res.json());

  await fetch(signed.url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: dbContent,
  });
  ```
- **Downloading**
  ```ts
  const signed = await fetch(`${API_BASE}/backup/url`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ op: 'get' }),
  }).then(res => res.json());

  const dbContent = await fetch(signed.url).then(res => res.text());
  await FileSystem.writeAsStringAsync(DB_FILE, dbContent);
  ```
- **No native Firebase Storage module** is required. Everything uses standard `fetch`, which is compatible with Expo’s runtime.
- **Metadata retrieval**: use `HEAD` request on the signed URL or a separate `/backup/metadata` endpoint returning stored metadata.

### 5.5 AI Features
- **Service**: Cloud Function `POST /ai/generate`.
- **Inputs**: prompt, selected deck, optional context (e.g., current card).
- **Backend**:
  - Validate ID token.
  - Enforce usage quotas.
  - Call provider (OpenAI, Anthropic, Vertex AI) using server-held API keys.
  - Return sanitized output (card template, hints, etc).
- **Client**: `AiService` orchestrates prompts and displays results.
- **Advantage**: One backend can support multiple AI vendors by swapping integration code.

### 5.6 Future Real-Time Sync (optional)
- With SQLite as truth, real-time multi-device sync is complex (merge conflicts, scheduling). Defer until necessary.
- When ready:
  - Option A: Ship full SQL snapshots via background tasks + conflict resolution.
  - Option B: Introduce Supabase/Postgres for structured sync (requires more work).
  - Option C: Use Firestore server-side, but still via Functions to avoid native pods.

### 5.7 Subscription & Feature Gating
- Continue using **RevenueCat** for cross-platform IAP (separate doc).
- On purchase:
  1. Client notifies backend with purchase token.
  2. Backend verifies via RevenueCat webhook or manual call.
  3. Backend sets Firebase custom claims (`premium: true`) using `getAuth().setCustomUserClaims(uid, { premium: true })`.
  4. Client refreshes ID token (`getIdToken(true)`) to pick up new claim.
- Backend functions can then enforce premium features:
  ```ts
  if (!decodedToken.premium) {
    throw new HttpsError('permission-denied', 'Premium subscription required.');
  }
  ```
- Storing subscription state server-side avoids shipping logic in the client and protects premium endpoints (AI generation, discover downloads, etc.).

### 5.8 Environment & Configuration Management
- **Client (Expo)**:
  - Use `app.config.js` or `.env` with expo-constants for:
    - `API_BASE_URL`
    - Feature flags (e.g., `ENABLE_CLOUD_BACKUP`)
  - For dev builds, point to Firebase emulator suite or staging functions domain.
- **Backend**:
  - Store secrets with `firebase functions:config:set`. Example:
    - `functions:config:set ai.openai_key="sk-..."`
    - `functions:config:set storage.bucket="memorizeapp-backups"`
  - Access inside functions via `process.env` or `functions.config()`.
  - Keep a `.env.local` for emulator use.
- **Emulator Suite**:
  - Use Firebase Emulator Suite for local testing (`firebase emulators:start`).
  - Configure storage emulator for signed URL testing (requires additional setup or integration tests against staging bucket).

### 5.9 Networking & Performance Considerations
- **API Base URL**: Use `https://<region>-<project>.cloudfunctions.net` or custom domain routed through Firebase Hosting.
- **Timeouts**:
  - For AI calls, set Cloud Function timeout to 60–120 seconds.
  - Client should display progress indicators and handle cancellation.
- **Caching**:
  - Discover manifest can be cached on client for 24h with `If-None-Match` headers.
  - Cloud Function responses should include `Cache-Control` directives when safe.
- **Batching AI Calls**: If generating multiple cards, allow backend to process batched prompts in one request to reduce latency and token cost.

### 5.10 Logging & Analytics
- **Server-side Logging**: Use `logger.info({ uid, action: 'backup_put' })` in Cloud Functions to keep structured logs.
- **Client Telemetry**: If analytics is needed, consider using a simple REST endpoint that emits custom events to BigQuery or Google Analytics via Functions, avoiding the client analytics SDK.

---

---

## 6. What We Explicitly Avoid

| Avoid                | Rationale                                                |
|----------------------|----------------------------------------------------------|
| RNFB Firestore pod   | gRPC+C++ build issues on iOS with static frameworks      |
| RNFB Storage pod     | Fails to generate Swift headers under static frameworks  |
| Client-side AI calls | Exposes API keys, no usage control                       |
| Multiple providers   | Prefer a single Firebase project for Auth + backend      |

---

## 7. Implementation Roadmap

### Phase 0 – Done ✅
- Fix Firebase Auth native initialization (AppDelegate.swift).
- Require sign-in before accessing main app.
- Local SQLite database + study features stable.

### Phase 1 – Local Backup & Discover
- Implement **file-based export/import** (already in progress): share SQLite JSON via Files.
- Publish static `decks.json` to Firebase Hosting (manual upload).
- Update `DiscoverScreen` to fetch real manifest.
- Document manual steps in `docs/backup.md` (create if missing), covering how users can export and import via Settings.

### Phase 2 – Backend Scaffold
- Set up Firebase Functions (2nd gen) project.
- Implement `/discover` endpoint (or serve static file) and confirm CORS for Expo dev client (`Access-Control-Allow-Origin: *` during dev).
- Implement `/ai/generate` (no client UI yet, just ensure round-trip works). Mock provider first if needed.
- Implement `/backup/url` returning signed PUT/GET URLs.
- Store metadata (timestamp/version) either in Storage metadata or Firestore (server-side only).

### Phase 3 – Client Integration
- Update `BackupService` to call `/backup/url` and upload/download via fetch.
- Replace mock `DiscoverScreen` data with HTTP fetch.
- Scaffold `AiService` + sample UI (e.g., “generate cloze from selection”).
- Add feature gating based on subscription (check with backend after verifying ID token).

### Phase 4 – Polish & Extras
- Add encryption option for backups (user passphrase).
- Add background reminder to back up (if signed in & >7 days old).
- Collect usage metrics server-side (without adding analytics pods).
- Consider RevenueCat integration for subscriptions (separate doc).

---

## 8. Testing Strategy

- **Client**
  - Unit tests for new services (mock fetch & token retrieval).
  - E2E flows (manual) for sign-in, backup, restore, discover download, AI call.
  - Ensure offline mode gracefully skips cloud features.
- **Expo Dev vs Production**
  - In Expo dev client, functions run against staging environment. Provide toggle in `Settings → Developer` (hidden) to switch endpoints.
  - For production builds (EAS), bake in production base URL via `app.config.js`.
- **Backend**
  - Integration tests for Cloud Functions (using Firebase emulator suite).
  - Token verification tests, quota enforcement, logging.
  - Upload/download tests with signed URLs and Storage emulator.

---

## 9. Monitoring & Operations

- **Firebase Console**
  - Authentication dashboard for user metrics.
  - Cloud Functions logs for AI call usage, errors.
- **Error Reporting**
  - Use Sentry (optional) or Firebase Crashlytics (if later needed).
- **Cost Control**
  - Cloud Functions: free tier should cover dev; monitor invocations.
  - Storage bandwidth: backup blobs are small (SQLite JSON). Encourage incremental backups, maybe prune old ones.
  - AI Providers: enforce quotas per user (daily/weekly).

---

## 10. Summary

- Keep **Firebase Auth** on-device; it’s stable and covers identity.
- Build a **Firebase Cloud Functions** backend that:
  - Verifies ID tokens,
  - Calls AI providers securely,
  - Serves Discover manifest/decks,
  - Issues signed URLs for backups.
- Use **Firebase Storage** and **Hosting** only via HTTPS (no RNFB Storage/Firestore pods).
- Stay **local-first**; sync is optional and can be added later.
- Result: One provider (Firebase) covers auth, backend logic, storage, and hosting while avoiding the native build issues that blocked previous attempts.

This architecture supports today’s features, unlocks AI enhancements, and leaves room for cloud backup and curated content—all without reintroducing brittle native dependencies.
