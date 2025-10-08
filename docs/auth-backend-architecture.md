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

## 10. Detailed Implementation Guide

This section provides comprehensive step-by-step instructions for implementing the entire backend architecture.

### 10.1 Backend Project Setup

**Directory Structure:**
```
memorize-app/
├── firebase/                    # New backend directory
│   ├── functions/
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── config/
│   │   │   ├── middleware/
│   │   │   ├── services/
│   │   │   ├── handlers/
│   │   │   └── types/
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── firebase.json
│   └── hosting/
└── src/                        # Existing mobile app
```

**Initialize Firebase:**
```bash
cd memorize-app && mkdir firebase && cd firebase
firebase login
firebase init functions
# Select: TypeScript, ESLint, install dependencies
```

**Install Dependencies:**
```bash
cd functions
npm install firebase-admin firebase-functions openai anthropic cors zod
npm install -D @types/cors
```

---

### 10.2 Client-Side Implementation

#### Step 1: Create app.config.js

Convert `app.json` to `app.config.js` for environment variables:

```javascript
// memorize-app/app.config.js
export default ({ config }) => ({
  ...config,
  expo: {
    ...require('./app.json').expo,
    extra: {
      apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:5001',
      enableCloudBackup: process.env.ENABLE_CLOUD_BACKUP !== 'false',
      enableAiFeatures: process.env.ENABLE_AI_FEATURES === 'true',
      environment: process.env.APP_ENV || 'development',
    },
  },
});
```

#### Step 2: Create ApiService Base

```typescript
// src/services/cloud/ApiService.ts
import Constants from 'expo-constants';
import { auth } from '../../config/firebase';

const API_BASE = Constants.expoConfig?.extra?.apiBaseUrl;

export interface ApiError {
  code: string;
  message: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

export class ApiService {
  private static async getAuthHeaders(): Promise<HeadersInit> {
    const token = await auth().currentUser?.getIdToken(true);
    if (!token) {
      throw new Error('Not authenticated');
    }
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  static async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const headers = await this.getAuthHeaders();
      const url = `${API_BASE}${endpoint}`;

      const response = await fetch(url, {
        ...options,
        headers: {
          ...headers,
          ...options.headers,
        },
      });

      const data: ApiResponse<T> = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || 'API request failed');
      }

      return data;
    } catch (error) {
      console.error(`[ApiService] ${endpoint} failed:`, error);
      throw error;
    }
  }

  static async get<T>(endpoint: string): Promise<T> {
    const response = await this.request<T>(endpoint, { method: 'GET' });
    return response.data!;
  }

  static async post<T>(endpoint: string, body?: any): Promise<T> {
    const response = await this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return response.data!;
  }
}
```

#### Step 3: Create CloudBackupService

```typescript
// src/services/cloud/CloudBackupService.ts
import * as FileSystem from 'expo-file-system';
import { ApiService } from './ApiService';
import { DB_FILE_PATH } from '../anki/PersistenceService';

interface SignedUrlResponse {
  url: string;
  expiresAt: number;
}

interface BackupMetadata {
  timestamp: number;
  appVersion: string;
  platform: string;
  cardCount: number;
}

export class CloudBackupService {
  /**
   * Upload database backup to cloud storage
   */
  static async uploadBackup(): Promise<void> {
    try {
      // 1. Read local database file
      const dbContent = await FileSystem.readAsStringAsync(DB_FILE_PATH);
      
      // 2. Get signed URL for upload
      const { url } = await ApiService.post<SignedUrlResponse>('/backup/url', {
        op: 'put',
        filename: 'latest.db',
      });

      // 3. Upload to signed URL
      const uploadResponse = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: dbContent,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status}`);
      }

      console.log('[CloudBackup] Upload successful');
    } catch (error) {
      console.error('[CloudBackup] Upload failed:', error);
      throw error;
    }
  }

  /**
   * Download backup from cloud and restore
   */
  static async downloadBackup(): Promise<void> {
    try {
      // 1. Get signed URL for download
      const { url } = await ApiService.post<SignedUrlResponse>('/backup/url', {
        op: 'get',
        filename: 'latest.db',
      });

      // 2. Download from signed URL
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
      }

      const dbContent = await response.text();

      // 3. Write to local database (creates backup first)
      const backupPath = `${DB_FILE_PATH}.backup`;
      await FileSystem.copyAsync({
        from: DB_FILE_PATH,
        to: backupPath,
      });

      await FileSystem.writeAsStringAsync(DB_FILE_PATH, dbContent);

      console.log('[CloudBackup] Restore successful');
    } catch (error) {
      console.error('[CloudBackup] Download failed:', error);
      throw error;
    }
  }

  /**
   * Check if cloud backup exists
   */
  static async hasCloudBackup(): Promise<boolean> {
    try {
      const metadata = await ApiService.get<any>('/backup/metadata');
      return metadata.exists;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get cloud backup metadata
   */
  static async getBackupMetadata(): Promise<BackupMetadata | null> {
    try {
      return await ApiService.get<BackupMetadata>('/backup/metadata');
    } catch (error) {
      return null;
    }
  }
}
```

#### Step 4: Create AiService

```typescript
// src/services/cloud/AiService.ts
import { ApiService } from './ApiService';

export interface AiGenerateRequest {
  prompt: string;
  deckId?: string;
  provider?: 'openai' | 'anthropic';
  context?: {
    cardId?: string;
    fields?: Record<string, any>;
  };
}

export interface AiGenerateResponse {
  result: string;
  tokensUsed: number;
  provider: string;
}

export interface QuotaInfo {
  used: number;
  limit: number;
  resetAt: number;
}

export class AiService {
  /**
   * Generate card content using AI
   */
  static async generateCard(request: AiGenerateRequest): Promise<string> {
    try {
      const response = await ApiService.post<AiGenerateResponse>(
        '/ai/generate',
        request
      );
      return response.result;
    } catch (error) {
      console.error('[AiService] Generate failed:', error);
      throw error;
    }
  }

  /**
   * Get current AI usage quota
   */
  static async getQuota(): Promise<QuotaInfo> {
    try {
      return await ApiService.get<QuotaInfo>('/ai/quota');
    } catch (error) {
      console.error('[AiService] Failed to get quota:', error);
      throw error;
    }
  }

  /**
   * Generate cloze deletions from text
   */
  static async generateCloze(text: string): Promise<string> {
    const prompt = `Convert this text into a cloze deletion flashcard. Identify the most important terms and wrap them in {{c1::term}} syntax:\n\n${text}`;
    return this.generateCard({ prompt });
  }

  /**
   * Generate multiple choice options
   */
  static async generateChoices(question: string, answer: string): Promise<string[]> {
    const prompt = `Given this Q&A, generate 3 plausible but incorrect multiple choice options:\nQ: ${question}\nA: ${answer}\n\nReturn only the 3 incorrect options, one per line.`;
    const result = await this.generateCard({ prompt });
    return result.split('\n').filter(line => line.trim());
  }
}
```

#### Step 5: Create DiscoverService

```typescript
// src/services/cloud/DiscoverService.ts
import Constants from 'expo-constants';

const HOSTING_BASE = process.env.FIREBASE_HOSTING_URL || 'https://memorize-app.web.app';

export interface DeckManifest {
  id: string;
  name: string;
  description: string;
  cardCount: number;
  downloadUrl: string;
  thumbnail?: string;
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  language: string;
  size: number;
}

export interface DiscoverCatalog {
  decks: DeckManifest[];
  categories: string[];
  lastUpdated: number;
}

export class DiscoverService {
  private static cache: { data: DiscoverCatalog | null; timestamp: number } = {
    data: null,
    timestamp: 0,
  };
  private static CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Fetch available decks from hosting
   */
  static async getCatalog(): Promise<DiscoverCatalog> {
    const now = Date.now();
    
    // Return cached if still valid
    if (this.cache.data && now - this.cache.timestamp < this.CACHE_TTL) {
      return this.cache.data;
    }

    try {
      const response = await fetch(`${HOSTING_BASE}/decks/decks.json`);
      if (!response.ok) {
        throw new Error(`Failed to fetch catalog: ${response.status}`);
      }

      const data: DiscoverCatalog = await response.json();
      this.cache = { data, timestamp: now };
      
      return data;
    } catch (error) {
      console.error('[DiscoverService] Failed to fetch catalog:', error);
      // Return cached data even if expired, or throw
      if (this.cache.data) {
        return this.cache.data;
      }
      throw error;
    }
  }

  /**
   * Download deck file
   */
  static async downloadDeck(deck: DeckManifest): Promise<Blob> {
    try {
      const response = await fetch(deck.downloadUrl);
      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
      }
      return await response.blob();
    } catch (error) {
      console.error('[DiscoverService] Deck download failed:', error);
      throw error;
    }
  }

  /**
   * Clear cache
   */
  static clearCache(): void {
    this.cache = { data: null, timestamp: 0 };
  }
}
```

---

### 10.3 Backend Core Implementation

Complete Firebase Functions code is extensive. Key files are shown below:

#### Main Entry Point

```typescript
// firebase/functions/src/index.ts
import { initializeApp } from 'firebase-admin/app';
import { onRequest } from 'firebase-functions/v2/https';
import { aiHandler } from './handlers/ai';
import { backupHandler } from './handlers/backup';
import { authenticate } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';
import express from 'express';
import cors from 'cors';

initializeApp();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Protected routes
app.use(authenticate);
app.post('/ai/generate', aiHandler.generate);
app.get('/ai/quota', aiHandler.getQuota);
app.post('/backup/url', backupHandler.getSignedUrl);
app.get('/backup/metadata', backupHandler.getMetadata);

app.use(errorHandler);

export const api = onRequest({ timeoutSeconds: 120, memory: '512MiB' }, app);
```

#### AI Handler

```typescript
// firebase/functions/src/handlers/ai.ts
import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { AiGenerateRequestSchema } from '../types';
import { QuotaService } from '../services/quota/QuotaService';
import { OpenAIProvider } from '../services/ai/OpenAIProvider';
import { logger } from 'firebase-functions/v2';

const quotaService = new QuotaService();
const aiProvider = new OpenAIProvider();

export const aiHandler = {
  async generate(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const body = AiGenerateRequestSchema.parse(req.body);

      // Check quota
      const quota = await quotaService.checkAndIncrementQuota(
        user.uid,
        user.premium || false
      );

      logger.info('AI generation request', { uid: user.uid, quota });

      // Generate content
      const result = await aiProvider.generate(body.prompt, {
        maxTokens: 500,
        temperature: 0.7,
      });

      res.json({
        success: true,
        data: {
          result: result.content,
          tokensUsed: result.tokensUsed,
          provider: 'openai',
          quota,
        },
      });
    } catch (error: any) {
      if (error.message === 'Daily quota exceeded') {
        res.status(429).json({
          success: false,
          error: {
            code: 'quota_exceeded',
            message: 'Daily AI generation limit reached',
          },
        });
        return;
      }
      throw error;
    }
  },

  async getQuota(req: Request, res: Response): Promise<void> {
    const user = (req as AuthenticatedRequest).user;
    const quota = await quotaService.getQuotaInfo(user.uid, user.premium || false);
    
    res.json({
      success: true,
      data: quota,
    });
  },
};
```

#### Backup Handler

```typescript
// firebase/functions/src/handlers/backup.ts
import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { BackupUrlRequestSchema } from '../types';
import { StorageService } from '../services/storage/signedUrls';
import { logger } from 'firebase-functions/v2';

const storageService = new StorageService();

export const backupHandler = {
  async getSignedUrl(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const { op, filename } = BackupUrlRequestSchema.parse(req.body);

      const operation = op === 'put' ? 'write' : 'read';
      const result = await storageService.generateSignedUrl(
        user.uid,
        operation,
        filename
      );

      logger.info('Generated signed URL', { uid: user.uid, op, filename });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Signed URL generation failed', error);
      throw error;
    }
  },

  async getMetadata(req: Request, res: Response): Promise<void> {
    const user = (req as AuthenticatedRequest).user;
    const metadata = await storageService.getBackupMetadata(user.uid);
    
    res.json({
      success: true,
      data: metadata,
    });
  },
};
```

---

### 10.4 Deployment

#### Deploy Backend

```bash
cd firebase
firebase deploy --only functions,storage,hosting
```

#### Environment Variables

```bash
# Set production secrets
firebase functions:config:set \
  ai.openai_key="sk-..." \
  ai.anthropic_key="sk-ant-..." \
  storage.bucket="your-project.appspot.com"

# View config
firebase functions:config:get
```

#### Client Environment

Create `.env.production`:
```
API_BASE_URL=https://us-central1-your-project.cloudfunctions.net/api
ENABLE_CLOUD_BACKUP=true
ENABLE_AI_FEATURES=true
APP_ENV=production
```

---

### 10.5 Testing

**Local Development:**
```bash
# Terminal 1: Start emulators
cd firebase
firebase emulators:start

# Terminal 2: Run Expo with local API
cd ..
API_BASE_URL=http://localhost:5001/your-project/us-central1/api npm start
```

**Test Endpoints:**
```bash
# Get auth token from app logs, then:
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5001/your-project/us-central1/api/health
```

---

## 11. Summary

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


# Implementation Plan & Expected Outcomes

## What You're Building

Yes, you're creating a **complete Firebase backend** that your React Native app will communicate with via HTTPS. No more native SDK issues - everything goes through REST APIs.

---

## 📋 Implementation Plan (Phased Approach)

### **Phase 1: Foundation Setup** (2-3 hours)
**What you'll do:**

1. **Create Firebase Backend Project**
   ```bash
   cd /Users/danielrad/Desktop/repos/hefs2/memorize-app
   mkdir firebase && cd firebase
   firebase init functions
   ```

2. **Install Dependencies & Configure**
   - Set up TypeScript, Express, Firebase Admin SDK
   - Configure `firebase.json` with emulators
   - Create basic project structure

3. **Deploy "Hello World" Function**
   ```bash
   firebase deploy --only functions
   ```

**What you'll see:**
- ✅ New `/firebase` directory in your project
- ✅ Function deployed at: `https://us-central1-[project].cloudfunctions.net/api`
- ✅ Can test with: `curl https://[url]/health` → `{"status": "ok"}`

---

### **Phase 2: Client Foundation** (1-2 hours)
**What you'll do:**

1. **Convert app.json → app.config.js**
   - Add environment variables support
   - Configure API_BASE_URL

2. **Create ApiService**
   - Build base HTTP client with token injection
   - Add error handling

3. **Test Authentication Flow**
   - Sign in to app
   - ApiService automatically attaches Firebase token
   - Backend verifies token

**What you'll see:**
- ✅ Environment-based configuration working
- ✅ Can make authenticated API calls from app
- ✅ Console logs showing token verification success

---

### **Phase 3: Cloud Backup** (3-4 hours)
**What you'll do:**

1. **Backend: Implement `/backup/url` endpoint**
   - Generate signed URLs for Firebase Storage
   - Add metadata tracking

2. **Client: Build CloudBackupService**
   - Upload SQLite database to cloud
   - Download and restore from cloud

3. **UI: Add to Settings Screen**
   - "Backup to Cloud" button
   - "Restore from Cloud" button
   - Show last backup timestamp

**What you'll physically see & do:**

✅ **In Settings Screen:**
```
Cloud Backup
├── Last backup: 2 hours ago
├── [Backup Now] button
└── [Restore from Cloud] button
```

✅ **User Flow:**
1. Tap "Backup Now" → Shows loading spinner
2. Database uploads to Firebase Storage
3. Success message: "Backup complete!"
4. Can see backup file in Firebase Console → Storage

✅ **Restore Flow:**
1. Tap "Restore from Cloud"
2. Confirmation dialog: "This will replace your local data"
3. Downloads backup → Replaces SQLite file
4. App refreshes with restored data

✅ **What's Happening Behind the Scenes:**
- App requests signed URL from backend
- Backend verifies your identity
- Returns temporary upload/download URL
- App uploads directly to Storage (no backend bottleneck)
- Your 2,973 cards are safely backed up

---

### **Phase 4: Discover Content** (2-3 hours)
**What you'll do:**

1. **Create Static Deck Catalog**
   - Upload `decks.json` to Firebase Hosting
   - Add sample deck files (.apkg)

2. **Update DiscoverService**
   - Fetch catalog from hosting
   - Download decks via HTTP

3. **Update DiscoverScreen UI**
   - Replace mock data with real catalog
   - Add download functionality

**What you'll physically see & do:**

✅ **In Discover Tab:**
```
Discover New Decks
├── Spanish Basics (500 cards)
│   └── [Download] button
├── Japanese N5 (1000 cards)
│   └── [Download] button
└── Medical Terminology (750 cards)
    └── [Download] button
```

✅ **User Flow:**
1. Open Discover tab → Fetches real deck catalog
2. Browse curated decks with descriptions
3. Tap "Download" → Progress indicator
4. Deck imports automatically
5. Navigate to Decks tab → New deck appears
6. Start studying immediately

✅ **Content Management:**
- Upload new decks to Firebase Hosting
- Update `decks.json` manifest
- Users get new content without app update

---

### **Phase 5: AI Features** (4-6 hours)
**What you'll do:**

1. **Backend: Implement AI Endpoint**
   - Integrate OpenAI API
   - Add quota system (10 free/day, 100 premium/day)
   - Implement rate limiting

2. **Client: Build AiService**
   - Card generation
   - Cloze deletion creation
   - Hint generation

3. **UI: Add AI Features**
   - "Generate with AI" button in card editor
   - Quota indicator
   - Premium upsell when limit reached

**What you'll physically see & do:**

✅ **In Card Editor:**
```
Create New Card
├── Front: [text input]
├── Back: [text input]
└── [✨ Generate with AI] button
```

✅ **User Flow:**
1. Creating a new card about "photosynthesis"
2. Tap "Generate with AI"
3. Enter prompt: "Create a flashcard about photosynthesis for biology students"
4. Loading indicator (2-3 seconds)
5. AI generates:
   - Front: "What is the process by which plants convert light energy into chemical energy?"
   - Back: "Photosynthesis - using chlorophyll to convert CO₂ and H₂O into glucose and O₂"
6. Edit if needed, save card

✅ **Quota System:**
```
AI Usage Today: 7/10
[Generate] ← Works
```

After 10 uses:
```
AI Usage Today: 10/10
[Upgrade to Premium] ← Shows paywall
```

✅ **Other AI Features:**
- Select text → "Convert to Cloze" → Auto-generates {{c1::deletions}}
- Existing card → "Generate Hints" → AI adds memory aids
- Batch generate cards from notes/PDFs

---

## 🎯 Final State: What You'll Have

### **For Users:**

1. **Seamless Cloud Backup**
   - One-tap backup/restore
   - Never lose progress
   - Switch devices easily

2. **Curated Content Library**
   - Download pre-made decks
   - No need to create everything from scratch
   - Community-contributed content

3. **AI-Powered Learning**
   - Generate cards instantly
   - Smart cloze deletions
   - Personalized hints

4. **Premium Features**
   - Gated by subscription
   - Enforced server-side (secure)
   - RevenueCat integration ready

### **For You (Developer):**

1. **Scalable Architecture**
   - Handles thousands of users
   - No native SDK headaches
   - Easy to maintain

2. **Flexible Backend**
   - Add new features without app updates
   - A/B test on server-side
   - Analytics and monitoring

3. **Cost-Effective**
   - Free tier covers development
   - ~$15-60/month at scale
   - AI is main cost (controllable via quotas)

4. **Security Built-In**
   - Token verification on every request
   - API keys never in client
   - User data isolated by UID

---

## 📱 Visual Before/After

### **BEFORE (Current State):**
```
Settings
├── Export Database (manual file)
├── Import Database (manual file)
└── [No cloud features]

Discover
└── [Mock data only]

Card Editor
└── [Manual entry only]
```

### **AFTER (With Backend):**
```
Settings
├── ☁️ Cloud Backup
│   ├── Last backup: 2 hours ago
│   ├── [Backup Now]
│   └── [Restore from Cloud]
├── Export Database (still available)
└── Import Database (still available)

Discover
├── 🌍 Browse 50+ Decks
├── Spanish Basics [Download]
├── Japanese N5 [Download]
└── Medical Terms [Download]

Card Editor
├── ✨ AI Generate
├── 🎯 Auto-Cloze
└── 💡 Generate Hints
```

---

## ⏱️ Total Time Estimate

- **Phase 1 (Foundation):** 2-3 hours
- **Phase 2 (Client Setup):** 1-2 hours  
- **Phase 3 (Backup):** 3-4 hours
- **Phase 4 (Discover):** 2-3 hours
- **Phase 5 (AI):** 4-6 hours

**Total: 12-18 hours** spread over 3-5 days

---

## 🚀 Ready to Start?

I can help you implement this step-by-step. We should start with:

1. **Phase 1: Foundation** - Get the Firebase backend scaffolded
2. **Phase 2: Client Setup** - Create app.config.js and ApiService
3. **Test the connection** - Ensure auth flow works end-to-end

Then we can tackle backup, discover, and AI features incrementally.

**Want me to start with Phase 1 (Firebase backend setup)?** I'll create all the necessary files and configuration.