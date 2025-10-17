**Premium Strategy**

- Goals: introduce a clear premium tier that monetizes high‑value, high‑cost features; provide a generous but limited free tier; make the upsell compelling with concrete learning outcomes; keep enforcement on the server while the client provides a smooth UX.
- Scope gated: AI Deck Generation, AI Hints Generation, Deck Statistics page (advanced stats), and all themes beyond `system`, `light`, `dark`.
- Free tier:
  - Deck AI: 3 free generations per month, max 25 cards per generation.
  - Hints AI: 1 free hints generation per month.
  - Themes: base 3 only.
  - Stats: preview only (locked page/cards with upsell).
- Premium tier: unlimited AI deck generation and hints, full statistics, all themes, cloud backup/prio support (if enabled), ad‑free. Intro offer: 3‑day free trial.

**Pricing & Trials**
- Product: monthly subscription at $9.99 USD. Localized price is shown to the user (e.g., CAD is displayed automatically via the store SDK).
- Trial: 3‑day free trial. Treat trial and grace period as premium for access control.
- Display: never hardcode prices; read localized `priceString` from the IAP SDK (e.g., RevenueCat) and render in paywall and Settings.

**Grand Slam Offer (Paywall Copy)**
- Headline: Learn More in Less Time
- Proof points:
  - “Most people waste hours memorizing the hard way. Our users learn 30% faster — same material, less grind.”
  - “They cut 40% of their revision time and still score just as high — because the cards do the heavy lifting.”
  - “Weeks later, they still remember what others forgot — giving them more time to crush the rest of the exam.”
- Premium Stats value: “Premium stats deliver real‑time insights to optimize your studying — best hours, burnout risk, retention, and what‑if tuning.”
- MCAT angle: “Users mastered MCAT content in 40% less time using our AI‑enabled cards and analytics — that’s a 2‑week buffer to master the rest and score higher!”
- Offer block:
  - AI Deck Generation (unlimited)
  - AI Hints (unlimited)
  - Advanced Stats & Coach
  - All Themes
  - Cloud backup + priority support
  - 3‑day free trial • Cancel anytime

**Architecture Overview**
- Entitlement source of truth: Firebase custom claim `premium` on the ID token.
- Billing: RevenueCat recommended for cross‑platform subscriptions, trials, and localized price strings. Alternative is RN‑IAP with your own server validation.
- Enforcement: Back end enforces quotas and caps. Client performs UX gating but never trusted for security.
- Usage accounting: Firestore monthly counters per user to track free‑tier AI usage.

**Backend Implementation**
- Middleware
  - `authenticate` (existing): verifies Firebase ID token.
  - `requirePremium` (existing): 403 if user is not premium.
  - New `withQuota(kind, limits)` middleware:
    - If `(req as AuthenticatedRequest).user.premium` → skip quota.
    - Else read/update Firestore doc `usage/{uid}/months/{YYYY-MM}` in a transaction.
    - If under limit → allow and increment counter on success; else 403 with `QUOTA_EXCEEDED`.
    - Kinds: `deck` (limit 3), `hints` (limit 1).
- Routes to guard
  - `memorize-app/firebase/functions/src/index.ts`
    - Deck AI: `POST /ai/deck/generate` → `authenticate, withQuota('deck', { freeLimit: 3 })`.
    - Hints AI: `POST /ai/hints/generate` → `authenticate, withQuota('hints', { freeLimit: 1 })`.
    - New: `GET /usage` → returns `{ monthKey, deckGenerations, hintGenerations, limits }` for the current month (for UI banners/counters).
    - New: `POST /iap/revenuecat/webhook` → updates Firebase custom claims based on entitlement status (active/trial/grace → `premium: true`; expired/canceled w/o grace → `premium: false`).
- Deck AI clamp for free users
  - `memorize-app/firebase/functions/src/handlers/ai.ts`: after generating, if not premium, slice result to 25 cards before responding.
- Data model (Firestore)
  - Collection per user: `usage/{uid}/months/{YYYY-MM}` with fields:
    - `deckGenerations: number`
    - `hintGenerations: number`
    - `monthKey: string` (YYYY‑MM for quick reads)
  - No cron required; month partition rolls naturally. Use server‐side timestamps for writes.
- Error responses
  - Use structured API responses already in `ApiService`. For quota exhaustion, return `{ success: false, error: { code: 'QUOTA_EXCEEDED', message } }`.
- Security
  - Never trust client flags. All quotas/caps enforced server‑side. Only accept entitlement from ID token claims.
  - Log usage increments, user ID, monthKey, request IDs to detect abuse.
- Testing
  - Unit test `withQuota` with mocked Firestore transaction.
  - Integration test AI endpoints for: free within limits, free exhausted, premium bypass, and clamp to 25.

**Client Implementation**
- Premium context
  - Add `src/context/PremiumContext.tsx` exposing:
    - `isPremiumEffective`: true if Firebase claim `premium` OR RevenueCat trial/grace active.
    - `subscribe()`: opens paywall; on purchase success, call `auth().currentUser?.getIdToken(true)` to refresh claims, then `refreshEntitlements()`.
    - `usage`: `{ deckLeft, hintsLeft, monthKey }` from `GET /usage`.
    - `loading` and `error` states.
- Paywall modal
  - Add `src/components/premium/PremiumUpsellModal.tsx` with the “Grand Slam” copy above.
  - Fetch offerings/prices from RevenueCat and show localized monthly price string.
  - Include legal footer: auto‑renewing subscription, 3‑day trial, cancel anytime, links to Terms/Privacy.
- Settings
  - `src/app/Settings/SettingsScreen.tsx`
    - Replace the static alert in `handleSubscription` with the paywall modal.
    - Change banner footer to “3‑day free trial • Cancel anytime”.
    - Display current status: Free, Trial, Premium; and usage summary (“3 deck gens/mo • 1 hints gen/mo”).
- Themes gating
  - `src/app/Settings/ThemeSelectionScreen.tsx` and `src/app/Onboarding/ThemeScreen.tsx`
    - Only allow selecting `system`, `light`, `dark` for free users.
    - Other themes show a small lock/“Pro” pill; press → open paywall.
- Stats gating
  - `src/app/Decks/DeckStatsScreen.tsx`
    - If `!isPremiumEffective`, show a locked preview: blurred or skeleton cards with an upsell CTA; block interactions.
    - Optionally wrap premium cards with a `PremiumGate` component that shows children if allowed, else an inline upsell row.
- AI gating (UX)
  - `src/app/Decks/AIDeckCreatorScreen.tsx`
    - Limit card count selector to 25 for free users (disable 50/75/100 with a Pro badge). On disabled selection press → paywall.
    - On generate, handle `QUOTA_EXCEEDED` by showing paywall; otherwise rely on backend clamp.
  - `src/app/Decks/AIHintsConfigScreen.tsx`
    - Show “1 free run/month” banner when not premium.
    - Handle `QUOTA_EXCEEDED` with paywall.
- Legal modal
  - `src/app/Settings/components/LegalModal.tsx`
    - Ensure copy reflects 3‑day trial, auto‑renew, localized pricing, cancellation policy, links.

**RevenueCat Integration (Recommended)**
- Install `react-native-purchases` and configure iOS/Android.
- In `PremiumContext`, initialize Purchases with API key(s), set user ID (Firebase UID), and fetch `CustomerInfo` + `Offerings` on mount.
- Map entitlement state to `isPremiumEffective`:
  - If `customerInfo.entitlements.active['pro']` exists OR `trial/grace` active → treat as premium.
  - After successful purchase, call backend `/iap/revenuecat/webhook` (RevenueCat does this), then refresh Firebase token claims on client.
- Always show localized price using `package.product.priceString`.

**API Contracts**
- `POST /ai/deck/generate`
  - Auth: required.
  - Quota: free limit 3/mo; premium unlimited.
  - Clamp: free users get at most 25 cards.
  - Errors: `QUOTA_EXCEEDED`, `GENERATION_FAILED`, `CONFIGURATION_ERROR`.
- `POST /ai/hints/generate`
  - Auth: required.
  - Quota: free limit 1/mo; premium unlimited.
  - Errors: `QUOTA_EXCEEDED`, `GENERATION_ERROR`, `CONFIGURATION_ERROR`.
- `GET /usage`
  - Returns `{ monthKey, deckGenerations, hintGenerations, limits: { deck: 3, hints: 1 } }`.
- `POST /iap/revenuecat/webhook`
  - Validates RevenueCat signature; updates Firebase custom claims for the user’s UID.

**Analytics & Events**
- Track:
  - Paywall impression → from where (stats, themes, AI screens, settings).
  - CTA clicked, purchase success/failure, restore purchases.
  - Quota approaching (2/3 deck gens used) → show subtle toast.
  - QUOTA_EXCEEDED, conversion funnels per placement.

**Edge Cases & UX**
- Offline: cache `isPremiumEffective` (last known) and `usage` locally for display; backend still enforces quotas.
- Token refresh: after purchase or restore, call `getIdToken(true)` to pick up latest `premium` claim.
- Time zone: compute `YYYY-MM` based on UTC on server; display usage by local time on client (copy should be forgiving).
- Sign out: clear cached usage and premium state.
- Grace period: treat as premium in client; webhook should keep claim true until grace ends.

**Compliance**
- App Store/Play requirements:
  - Show localized price, trial length, and auto‑renewing nature.
  - “Manage subscription” and “Restore purchases” actions in Settings.
  - Terms of Use and Privacy Policy links visible near the CTA.
  - No misleading claims; keep “up to 30% faster / 40% less time” as illustrative marketing.

**Rollout Plan**
1) Backend first: `withQuota`, clamp, `/usage` endpoint, log/metrics.
2) Client gating pass: Themes, Stats, AI screens; surface QUOTA_EXCEEDED gracefully.
3) Paywall integration: PremiumUpsellModal with offerings, trial copy, legal footer.
4) RevenueCat webhook + claims sync; token refresh after purchase.
5) QA pass across platforms; smoke tests for endpoints; stage rollout with feature flag.

**QA Checklist**
- Free user within quota: deck AI returns ≤25; hints AI returns success; usage increments.
- Free user over quota: both endpoints return QUOTA_EXCEEDED; UI upsells.
- Premium user: unlimited; no clamps; Deck Stats screen fully accessible; all themes selectable.
- Trial user: treated as premium; post‑trial expiration flips to free after claim update.
- Price display: matches store localized price (e.g., CAD).
- Legal copy updated (3‑day trial, auto‑renew).

**Future Monetization Ideas**
- Higher AI quotas (or unlimited) per higher tier.
- Weekly Coach email reports; personalized study plans; tag‑level insights.
- Cloud backup history/versioning; restore points; multi‑device sync priority.
- Media helpers: OCR to card, TTS audio generation, image‑to‑cloze.
- Scheduler tuning, streak freeze, “skip‑the‑queue” days.

**Implementation To‑Dos (File Map)**
- Server
  - Add: `firebase/functions/src/middleware/quota.ts`
  - Edit: `firebase/functions/src/index.ts` (wrap AI routes, add `/usage`, add `/iap/revenuecat/webhook`)
  - Edit: `firebase/functions/src/handlers/ai.ts` (clamp 25 for free)
  - Edit: `firebase/functions/src/handlers/aiHints.ts` (quota middleware only)
- Client
  - Add: `src/context/PremiumContext.tsx`
  - Add: `src/components/premium/PremiumUpsellModal.tsx`
  - Edit: `src/app/Settings/SettingsScreen.tsx` (3‑day copy, paywall modal, status)
  - Edit: `src/app/Settings/ThemeSelectionScreen.tsx` and `src/app/Onboarding/ThemeScreen.tsx` (lock non‑base themes)
  - Edit: `src/app/Decks/DeckStatsScreen.tsx` (gate page/sections)
  - Edit: `src/app/Decks/AIDeckCreatorScreen.tsx` (lock >25, upsell on press)
  - Edit: `src/app/Decks/AIHintsConfigScreen.tsx` (usage banner, upsell on quota)
  - Edit: `src/app/Settings/components/LegalModal.tsx` (trial/auto‑renew copy)

**Config & Keys**
- RevenueCat API keys per platform (client) and shared secret (server webhook verification).
- Firebase Admin service account (already present via Functions init).
- ENV: `OPENAI_API_KEY` (already used), `REVENUECAT_WEBHOOK_SECRET`.

**Notes**
- Keep enforcement minimal but robust: blocking free abuse saves AI costs immediately while offering a valuable free experience that converts.
- Centralize all pricing and entitlement logic in PremiumContext + server claims to avoid leaks or drift.

