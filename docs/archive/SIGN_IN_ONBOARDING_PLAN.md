# Sign-In, Onboarding, and Tutorial Upgrade Plan

This plan upgrades the authentication experience with Apple and Google providers, redesigns the sign-in UI, and introduces a first-run onboarding plus a polished tutorial. It is tailored to your current stack (Expo SDK 54, React Native Firebase Auth, your design system, and local persistence).

## Summary
- Add Apple and Google sign-in alongside email
- Redesign sign-in screen (professional, provider-first)
- First-run onboarding: name, study preferences, theme selection
- Post-onboarding tutorial: short, animated walkthrough of the core loop
- Retire the guest/anonymous path to simplify auth
- Per-user onboarding/tutorial completion flags and lightweight analytics

## Current State
- Firebase Auth initialized via iOS plist; using `@react-native-firebase/auth`
  - Reference: `src/config/firebase.ts:19`
- AuthContext currently exposes email plus anonymous flows that will be removed in this upgrade
  - Reference: `src/context/AuthContext.tsx:25`
- Navigation gates app by auth state
  - Reference: `src/navigation/AuthNavigator.tsx:22`
- Design system supports theme preference and rich color schemes with persistence
  - Reference: `src/design/theme.tsx`
- Local-only persistence via single JSON file for DB snapshot
  - Reference: `src/services/anki/PersistenceService.ts`

## Goals
- Offer low-friction, trusted sign-in options (Apple, Google) with graceful error handling
- Present a premium sign-in UI using your design tokens and gradients
- Collect minimal profile + preferences at first sign-in and set the app theme
- Teach the core study loop via a brief, engaging tutorial
- Remove the guest/anonymous entry point to keep the auth experience focused

## Scope
- Client updates only (no backend schema changes); Firebase Console configuration required for providers
- Onboarding data in AsyncStorage keyed by `uid`
- No server profile storage yet; compatible with future cloud backup

---

## Architecture & Libraries
- Firebase Auth: `@react-native-firebase/auth`
- Apple Sign-In (iOS): `expo-apple-authentication` (already in `package.json`)
- Google Sign-In: `expo-auth-session/providers/google` (add dependency `expo-auth-session`)
- Navigation: `@react-navigation/*`
- Animations: `react-native-reanimated`, `expo-haptics`

Expo config updates:
- `app.json` → `plugins`: add `"expo-apple-authentication"`
- `app.json` → add `"scheme": "memorizeapp"` (or your custom scheme) for Google redirect
- `app.config.js` → add `extra.googleIosClientId`, `extra.googleAndroidClientId`, `extra.googleWebClientId`

---

## Phase Plan

### Phase 1 — Apple + Google Providers
1. Add provider methods in `AuthContext`:
   - `signInWithApple()`, `signInWithGoogle()`
   - Remove `signInAnonymously` and other guest helpers; tidy exports
2. Apple flow (iOS):
   - Use `AppleAuthentication.signInAsync` with scopes `FULL_NAME`, `EMAIL`
   - Retrieve `identityToken`, create Firebase credential via `auth.AppleAuthProvider.credential(identityToken)`
   - If name returned on first sign-in, set `displayName` via `updateProfile`
3. Google flow (iOS/Android):
   - Use `Google.useIdTokenAuthRequest` with platform client IDs
   - On success, get `id_token`, create Firebase credential via `auth.GoogleAuthProvider.credential(idToken)`
4. Configure providers in Firebase Console and add Android SHA-1 for Google

Deliverables:
- Context methods implemented and exported
- Basic error mapping and cancellations handled

Acceptance:
- Apple/Google buttons sign users in and update `user` in context
- Guest/anonymous code paths removed from context and UI

### Phase 2 — Sign-In Screen Redesign
1. Present provider buttons first (Apple on iOS, Google on all), then email form
2. Improve validation and error microcopy for email/password
3. Use tokens from design system for consistent colors, typography, spacing, gradients
4. Accessibility: labels, 48px targets, proper focus/disabled states

Deliverables:
- `SignInScreen` updated with `AuthProviderButtons` and refined layout
- Loading per action; disabled states and a11y labels in place
- Guest CTA removed

Acceptance:
- UI looks premium and clean; flows feel snappy and understandable

### Phase 3 — First-Run Onboarding
1. Triggering:
   - After successful sign-in, check `@onboardingCompleted:<uid>`; if absent, show onboarding stack
2. Screens:
   - Welcome: value props + CTA
   - Profile: first/last name, set `displayName`
   - Preferences: daily reminder, schedule preference (morning/evening), daily goal minutes
   - Theme: select color scheme and theme preference (system/light/dark) using your palette UI
   - Summary: show selections and submit
3. Storage:
   - `@userProfile:<uid>`, `@userPrefs:<uid>`, `@onboardingCompleted:<uid>` via `AsyncStorage`
   - Create `UserPrefsService` for typed getters/setters
4. Navigation:
   - Add `OnboardingStack` and route from `AuthNavigator` when needed

Deliverables:
- Onboarding stack with 4–5 quick screens
- Per-uid flags and preferences saved locally

Acceptance:
- New sign-ins enter onboarding once; on relaunch, go directly to app

### Phase 4 — Tutorial Flow
1. Short, 2–4 minute multi-slide tutorial after onboarding
2. Slides cover: how spaced repetition works, decks/cards, study actions, stats, optional AI hints
3. Use reanimated transitions and subtle haptics; optional confetti on completion
4. Store `@tutorialCompleted:<uid>`; add Settings entry “View Tutorial” to replay later

Deliverables:
- `TutorialScreen` and minimal animations; completion flag

Acceptance:
- Tutorial runs once by default; replayable from Settings

### Phase 5 — Data & Edge Cases
- Single DB file implications: clarify that local decks persist across sign-outs (future: per-user DB files)
- Apple name capture on first sign-in only; set immediately
- Terms/Privacy links remain accessible on Sign-In and onboarding

### Phase 6 — QA, Analytics, Release
- QA flows across iOS/Android; handle cancellations, offline, timeouts
- Analytics events (optional): `auth_provider_selected`, `sign_in_success`, `onboarding_completed`, `tutorial_completed`
- Release checklist: Expo plugin, scheme, OAuth client IDs, Android SHA, device testing

---

## Detailed Implementation

### AuthContext Updates
Add to `src/context/AuthContext.tsx` alongside existing methods:
- `signInWithApple`: uses `expo-apple-authentication` → get `identityToken` → Firebase credential → sign in
- `signInWithGoogle`: uses `expo-auth-session/providers/google` → get `id_token` → Firebase credential → sign in
- Map Firebase error codes to friendly messages; bubble to UI

Types update in `src/types/auth.ts` to include new methods in `AuthContextType`.

### Apple Sign-In (iOS)
- Expo config: add plugin `expo-apple-authentication` in `app.json` plugins
- Apple Developer: enable Sign in with Apple for `com.anonymous.memorizeapp`
- Firebase Console: enable Apple provider
- Flow specifics:
  - Request scopes `FULL_NAME`, `EMAIL` once; store name immediately, as subsequent logins won’t return it
  - Build Firebase credential with `identityToken`; sign in

### Google Sign-In (iOS/Android)
- Add dependency: `expo-auth-session`
- Google Cloud: create iOS/Android/Web OAuth clients
- Firebase Console: enable Google provider
- Expo config: add `scheme` to `app.json` (e.g., `memorizeapp`); configure redirect URI automatically via AuthSession
- Flow specifics:
  - Use `Google.useIdTokenAuthRequest`
  - On success, extract `id_token` and call `auth.GoogleAuthProvider.credential(idToken)` → sign in
  - Android: add SHA-1 to Firebase project settings

### Sign-In UI Redesign
- Create `AuthProviderButtons` component (Apple on iOS, Google on all; large, high-contrast)
- Keep email/password form with better validation and microcopy
- Remove the “Continue as Guest” affordance from the layout
- Accessibility: announce, disable properly, maintain focus

### OnboardingStack Structure
Files to add:
- `src/navigation/OnboardingStack.tsx`
- `src/app/Onboarding/WelcomeScreen.tsx`
- `src/app/Onboarding/ProfileScreen.tsx`
- `src/app/Onboarding/PreferencesScreen.tsx`
- `src/app/Onboarding/ThemeScreen.tsx`
- `src/app/Onboarding/SummaryScreen.tsx`
- `src/services/onboarding/UserPrefsService.ts`

Notes:
- Extract your palette grid from `SettingsScreenNew` into a shared component for reuse (optional): `src/components/ThemePaletteGrid.tsx`
- Update `src/navigation/AuthNavigator.tsx` to route to `OnboardingStack` when `user && !completedOnboarding`

### Tutorial Flow
- `src/app/Onboarding/TutorialScreen.tsx` with reanimated transitions and haptics
- Showcase study buttons and a simple card flow; include one “mock review” interaction
- Store `@tutorialCompleted:<uid>`; add a Settings entry to replay (later PR)

### Persistence & Flags (AsyncStorage keys)
- `@onboardingCompleted:<uid>` = `true`
- `@tutorialCompleted:<uid>` = `true`
- `@userProfile:<uid>` = `{ displayName, firstName, lastName }`
- `@userPrefs:<uid>` = `{ dailyReminder, schedule: 'morning'|'evening', goalMinutes, themePreference, colorScheme }`

Create `UserPrefsService` with typed methods:
- `getOnboardingCompleted(uid)`, `setOnboardingCompleted(uid)`
- `getTutorialCompleted(uid)`, `setTutorialCompleted(uid)`
- `getUserProfile(uid)`, `setUserProfile(uid, profile)`
- `getUserPrefs(uid)`, `setUserPrefs(uid, prefs)`

### Navigation Flow
- `AuthNavigator` logic:
  1) `loading` → splash
  2) `!user` → `SignInScreen`
  3) `user && !completedOnboarding` → `OnboardingStack`
  4) `user && completedOnboarding && !tutorialCompleted` → `TutorialScreen`
  5) else → `Tabs`

### Error Handling
- Map Firebase auth errors to friendly text:
  - `auth/wrong-password`, `auth/user-not-found` → “Invalid email or password”
  - `auth/account-exists-with-different-credential` → explain the email is already in use and prompt the user to sign in with that provider
  - `auth/popup-closed-by-user`, `auth/cancelled-popup-request` → “Sign-in cancelled”
- Provider cancellations should not show error alerts; just return to screen

### Analytics (Optional)
- Fire lightweight events (console or analytics library) for:
  - `auth_provider_selected` (provider)
  - `sign_in_success` (provider, new vs returning)
  - `onboarding_completed`
  - `tutorial_completed`

---

## Testing & QA

### Unit
- Mock `@react-native-firebase/auth` and provider modules
- Assert `signInWithApple/Google` call `signInWithCredential`
- Test `UserPrefsService` per-uid reads/writes

### UI (Jest + RN Testing Library)
- Sign-In renders provider buttons appropriately by platform
- Disabled/loading states work; email validation shows errors
- Onboarding advances and persists selections; theme updates visually

### Manual Device
- iOS: Test Apple flow on TestFlight build (entitlements validated)
- Android: Test Google flow with internal or release build (SHA-1 configured)
- Offline and cancelled flows

---

## Release Checklist
- Firebase Console
  - Enable Apple and Google providers
  - Android: add SHA-1/256 from EAS builds
- Apple Developer
  - Enable Sign in with Apple for the bundle identifier
- Expo Config
  - `plugins`: add `expo-apple-authentication`
  - `scheme`: set app scheme for Google redirect
  - `app.config.js`: add Google client IDs under `extra`
- Dependencies
  - Add `expo-auth-session`
- EAS Builds
  - iOS build with updated entitlements
  - Android build; verify Google sign-in end-to-end

---

## Risks & Mitigations
- Apple sign-in capability/configuration issues → Use plugin, confirm entitlements, test on device
- Google ID token/redirect issues → Ensure `scheme` matches; use platform client IDs
- Single DB file across users → Communicate clearly; plan per-user DB files when cloud backup arrives
- Apple full name only first login → Store immediately as `displayName`

---

## Timeline (Suggested)
- Day 1–2: Provider flows in `AuthContext`, Firebase/Expo config, basic UI wiring
- Day 3: Sign-In screen redesign polish + error states
- Day 4–5: Onboarding stack, persistence service, nav gating
- Day 6: Tutorial screen with animations + completion flag
- Day 7: QA on devices; finalize release checklist

---

## Future Extensions
- Per-user DB snapshot files (e.g., `anki-db-<uid>.json`) to isolate local data by account
- Cloud sync integration and server-side user profiles
- Deepening tutorial with interactive “first review” using a sample deck
- AB tests for onboarding variants and theme defaults

---

## Quick File Map (for implementation)
- `src/context/AuthContext.tsx`
- `src/types/auth.ts`
- `src/app/Auth/SignInScreen.tsx`
- `src/navigation/AuthNavigator.tsx`
- `src/navigation/OnboardingStack.tsx` (new)
- `src/app/Onboarding/*` (new screens)
- `src/app/Onboarding/TutorialScreen.tsx` (new)
- `src/services/onboarding/UserPrefsService.ts` (new)
- `src/components/ThemePaletteGrid.tsx` (optional extraction)
- `app.json` (plugins, scheme)
- `app.config.js` (Google client IDs under `extra`)

---

## Acceptance Criteria
- Apple and Google sign-in enabled and functional on device
- Provider-first sign-in UI with accessible, polished buttons
- First-run onboarding collects name, prefs, and theme, persisted per-uid
- Tutorial shows once post-onboarding and is replayable later
- Guest/anonymous path removed; only authenticated users access the app
- Clear error messages and smooth cancellations across flows
