# Two-Flow Guided Tour (Discover Import + Study Gestures)

This plan adds a premium, minimal first‑run guide that teaches two things only:

- Import a deck from Discover
- How to study using swipe directions (no tap ratings)

It’s designed to feel professional and “human-led”: soft spotlights, concise callouts, a ghost‑hand showing gestures, and subtle haptics. It uses only React Native + Reanimated + your existing design system and hooks.

## Goals

- Coach users through their first deck import from Discover.
- Teach swipe directions on Study (Left/Right/Up/Down) with on-card demos.
- Keep it short (60–90s), polished, and resilient across devices.
- Persist progress per user; easy to replay from Settings.

## User Experience Script

Entry (after UnifiedOnboarding onComplete):
- Auto-navigate to Discover, fade in the coach overlay.

Flow 1: Import From Discover
- Step 1 — Focus a featured deck card
  - Title: Add Your First Deck
  - Body: Pick a curated deck to start right now.
  - Action: Next
- Step 2 — Focus the “Download Deck” button in Deck Detail
  - Title: Add To Your Library
  - Body: Download and import. You can study immediately.
  - Action: Download Deck (must finish download/import to advance)
- Completion Tip (light, non-blocking, bottom callout)
  - Body: Pro tip: Import your own decks or use AI to create more from Decks.

Flow 2: Study Basics (Gestures)
- Auto-navigate to Study (gated: run only if a current deck and card exist).
- Step 1 — Focus the card swipe area
  - Title: Learn by Swiping
  - Body: Left = Hard, Right = Easy, Up = Good, Down = Again.
  - Demo: Ghost-hand performs short swipes in each direction with subtle haptics.
- Step 2 — Focus the same area; show a “Try It” prompt
  - Title: Try a Swipe
  - Body: Reveal the answer, then swipe to rate your recall.
  - Action: Got It (unlocked only after the user performs a swipe)

Controls everywhere: Next, Back, Skip. Light haptic on step change, success haptic on flow completion.

## Visual & Motion Design

- Spotlight overlay: 4 animated rectangles around the target (no mask). Dims screen using theme colors; animates smoothly between steps.
- Callout card: Rounded, shadowed, elevated card using your theme tokens with an arrow pointing at the target.
- Ghost-hand: A small circle that moves/presses/fades to demo taps and swipes.
- Haptics: Use `useHaptics()` — selection on step, success on flow complete. During swipe demo, map directions to subtle cues.
- Colors: Match StudyScreen overlays for direction association:
  - Left (Hard): orange `rgba(249, 115, 22, α)`
  - Right (Easy): blue `rgba(59, 130, 246, α)`
  - Up (Good): green `rgba(16, 185, 129, α)`
  - Down (Again): red `rgba(239, 68, 68, α)`

## Architecture & Files

Add a lightweight “coach” system. No extra native deps.

- `src/coach/CoachTypes.ts`: Step/Flow types and rect type.
- `src/coach/CoachContext.tsx`: Global manager storing current flow, step index, measured targets, and public API (`start`, `next`, `back`, `skip`, `registerTarget`). Persists progress.
- `src/coach/useCoachTarget.ts`: Hook to measure a view in window coordinates and register it by `id`.
- `src/coach/CoachSpotlight.tsx`: Full-screen overlay rendering the dim, spotlight hole, callout, and ghost-hand.
- `src/coach/flows/discover.ts`, `study.ts`, `index.ts`: Declarative step lists for both flows.
- `src/coach/storage.ts`: AsyncStorage helpers: `@coach:version`, `@coach:discoverImport:<uid>`, `@coach:studyGestures:<uid>`.
- `src/navigation/navigationRef.ts`: Global `NavigationContainerRef` for cross-screen steps.

Mount points:
- `src/index.tsx`: Wrap app with `<CoachProvider>` and render `<CoachSpotlight />` above navigation.
- Optionally add a Settings toggle “Replay Guided Tour”.

## Types (minimal)

```ts
// src/coach/CoachTypes.ts
export type Rect = { x: number; y: number; width: number; height: number };

export type CoachStep = {
  id: string;
  screen: 'Discover' | 'DeckDetailModal' | 'Study';
  targetId: string; // registered via useCoachTarget
  title: string;
  body?: string;
  arrow?: 'top' | 'bottom' | 'left' | 'right';
  waitForTarget?: boolean; // default true
  pauseMs?: number;        // small delays for layout
  requireUserAction?: boolean; // waits until a predicate returns true
  demo?: { type: 'swipe'; directions: Array<'left'|'right'|'up'|'down'> };
  navigate?: () => void;   // optional programmatic navigation
};

export type CoachFlow = { id: 'discoverImport' | 'studyGestures'; steps: CoachStep[] };
```

## Hook: Target Registration

```ts
// src/coach/useCoachTarget.ts
import { useCallback, useRef } from 'react';
import { findNodeHandle, UIManager } from 'react-native';
import { useCoach } from './CoachContext';

export function useCoachTarget(id: string) {
  const { registerTarget } = useCoach();
  const ref = useRef<any>(null);

  const measure = useCallback(() => {
    const node = ref.current ? findNodeHandle(ref.current) : null;
    if (!node) return;
    UIManager.measureInWindow(node, (x, y, width, height) => {
      registerTarget(id, { x, y, width, height });
    });
  }, [id, registerTarget]);

  return { ref, onLayout: measure, measure };
}
```

Attach `ref`/`onLayout` to any target view (buttons, list items, containers).

## Overlay: Spotlight + Callout + Ghost‑Hand

- Spotlight: compute 4 rectangles based on `target` rect and the screen size; animate their sizes/positions with Reanimated when the step changes.
- Callout: position near target, auto-flip arrow if near edges; buttons: Next, Back, Skip.
- Ghost-hand: for Study demo, move a small circle along short paths left/right/up/down with easing; trigger a tiny haptic per direction.

Pseudo-layout:

```tsx
// src/coach/CoachSpotlight.tsx
// read current step, get Rect from context; draw 4 Views to create a "hole".
// place a Callout near the rect; optionally render GhostHand over the rect.
```

## Flows (declarative)

```ts
// src/coach/flows/discover.ts
import { CoachFlow } from '../CoachTypes';
import { navigation } from '../../navigation/navigationRef';

export const discoverImport: CoachFlow = {
  id: 'discoverImport',
  steps: [
    {
      id: 'discover-card',
      screen: 'Discover',
      targetId: 'Discover.FeaturedCard',
      title: 'Add Your First Deck',
      body: 'Pick a curated deck to start right now.',
      navigate: () => navigation.navigate('Discover' as never),
    },
    {
      id: 'deck-detail-download',
      screen: 'DeckDetailModal',
      targetId: 'DeckDetail.DownloadButton',
      title: 'Add To Your Library',
      body: 'Download and import. You can study immediately.',
      waitForTarget: true,
    },
  ],
};
```

```ts
// src/coach/flows/study.ts
import { CoachFlow } from '../CoachTypes';
import { navigation } from '../../navigation/navigationRef';

export const studyGestures: CoachFlow = {
  id: 'studyGestures',
  steps: [
    {
      id: 'study-swipes',
      screen: 'Study',
      targetId: 'Study.CardSwipeArea',
      title: 'Learn by Swiping',
      body: 'Left = Hard, Right = Easy, Up = Good, Down = Again.',
      navigate: () => navigation.navigate('Study' as never),
      demo: { type: 'swipe', directions: ['left', 'right', 'up', 'down'] },
    },
    {
      id: 'study-try',
      screen: 'Study',
      targetId: 'Study.CardSwipeArea',
      title: 'Try a Swipe',
      body: 'Reveal the answer, then swipe to rate your recall.',
    },
  ],
};
```

```ts
// src/coach/flows/index.ts
export * from './discover';
export * from './study';
```

## Integration Points (exact files)

Root overlay host
- File: `src/index.tsx`
  - Wrap providers with `<CoachProvider>`.
  - Render `<CoachSpotlight />` just after `<RootNav />` so it overlays app screens.
  - Start the guide after onboarding completion (see below).

Navigation ref
- File: `src/navigation/navigationRef.ts`
  - Add a `createNavigationContainerRef` and export it.
- File: `src/navigation/RootNav.tsx`
  - Pass `ref={navigationRef}` to `<NavigationContainer>`.

Start flows after onboarding
- File: `src/navigation/AuthNavigator.tsx`
  - After UnifiedOnboarding completes, call `CoachManager.start('discoverImport')`.
  - On `discoverImport` completion, if a current deck + card exist, chain `studyGestures`; else, set a flag to run `studyGestures` when Study has a current card next time.

Discover targets
- File: `src/app/Discover/DiscoverScreen.tsx`
  - Featured deck card: attach `useCoachTarget('Discover.FeaturedCard')` to the first visible deck card `Pressable` (spread `{ref, onLayout}` to its root view).
  - When `selectedDeck` is set and the modal opens, the modal’s “Download Deck” button becomes the next target.

Deck Detail modal target
- File: `src/app/Discover/DeckDetailModal.tsx`
  - Attach `useCoachTarget('DeckDetail.DownloadButton')` to the `Pressable` download button in the footer.

Study targets
- File: `src/app/Study/StudyScreen.tsx`
  - Card swipe area: attach `useCoachTarget('Study.CardSwipeArea')` to the `View` wrapping the card stack (`styles.cardStack`). For reliable measurement, attach to the `Animated.View` containing the current `CardPage`.
  - The demo will overlay a ghost-hand within this rect and animate the four directions.

Gating: Study availability
- `StudyScreen` shows an empty state if `currentDeckId === null` or `!current`.
- CoachManager should:
  - If no current card exists at the time of `studyGestures` start, pause and set a flag in storage; auto-run `studyGestures` when Study has a current card (listen via an event or call `CoachManager.resumeWhen(predicate)` that polls `useScheduler().current`).
- Require an actual swipe: listen for the first `handleSwipeChange` with enough distance or `handleAnswer` call before enabling “Got It”.
- Require an actual import: listen for the Discover flow import completion (hook into `handleDownload` / `importDeckFile` success or `useScheduler().reload()` delta) before advancing past the download step; surface error copy and keep the callout active if import fails.

Adaptive branching
- After import success, add a quick branch:
  - If the import took longer than N seconds or failed once, show a supportive tip (“Need help? Open Decks → ••• for manual import.”) before completing the flow.
- During Study flow, track the first swipe direction:
  - If the user swipes down (Again) or left (Hard), pause and show a micro-step with a ghost-hand replay and a reminder about direction meanings.
  - If they swipe right/up cleanly, fast-forward to completion without the remedial beat.
- Store these outcomes (e.g., `@coach:discoverImport:status` and `@coach:studyGestures:firstSwipe`) so the tour remembers whether to show follow-up coaching when replayed.

## Persistence & Replay

- Per user keys (via AsyncStorage):
  - `@coach:version` = '1' (bump to re-run after major changes)
  - `@coach:discoverImport:<uid>` = 'true'
  - `@coach:studyGestures:<uid>` = 'true'
- Add a Settings toggle “Replay Guided Tour” that clears these two flags for the current user and restarts `discoverImport`.

## Haptics Mapping (using useHaptics)

- Step change: `selection()`
- Flow complete: `success()`
- Ghost-hand demo per direction (very light):
  - left → `warning()`
  - right → `success()`
  - up → `success()`
  - down → `error()`

This mirrors the color/emotion mapping already used in `StudyScreen`.

## Copy (final)

Discover
- Add Your First Deck — Pick a curated deck to start right now.
- Add To Your Library — Download and import. You can study immediately.
- Tip — Pro tip: Import your own decks or use AI to create more from Decks.

Study
- Learn by Swiping — Left = Hard, Right = Easy, Up = Good, Down = Again.
- Try a Swipe — Reveal the answer, then swipe to rate your recall.

## Implementation Details & Snippets

Overlay spotlight mechanics (4-rect)
```tsx
// Pseudocode inside CoachSpotlight
const screen = useWindowDimensions();
const target = useCoach().getTarget(step.targetId);

// Animate rect with Reanimated shared values
const x = useSharedValue(target?.x ?? 0);
const y = useSharedValue(target?.y ?? 0);
const w = useSharedValue(target?.width ?? screen.width);
const h = useSharedValue(target?.height ?? 0);

useEffect(() => {
  if (!target) return;
  x.value = withTiming(target.x, { duration: 250 });
  y.value = withTiming(target.y, { duration: 250 });
  w.value = withTiming(target.width, { duration: 250 });
  h.value = withTiming(target.height, { duration: 250 });
}, [target]);

// Render 4 Views: top, left, right, bottom around the target
```

Ghost-hand demo
```tsx
// src/coach/ghostHand.tsx (concept)
// Render a small circle that animates short swipes inside the target rect.
// For each direction: translate a few pixels, scale 0.9→1.0, fade.
```

Navigation ref
```ts
// src/navigation/navigationRef.ts
import { createNavigationContainerRef } from '@react-navigation/native';
export const navigationRef = createNavigationContainerRef();
export const navigation = {
  navigate: (...args: Parameters<typeof navigationRef.navigate>) => {
    if (navigationRef.isReady()) navigationRef.navigate(...args);
  },
};

// src/navigation/RootNav.tsx
// <NavigationContainer ref={navigationRef} theme={navTheme}>...
```

Start sequence after onboarding
```tsx
// src/navigation/AuthNavigator.tsx
// After UnifiedOnboarding onComplete:
//   CoachManager.start('discoverImport');
// When discoverImport finishes, attempt CoachManager.start('studyGestures'),
// or set a pending flag if no current card yet.
```

Registering targets (examples)
```tsx
// DiscoverScreen.tsx — first card
const cardTarget = useCoachTarget('Discover.FeaturedCard');
<Pressable {...cardTarget} ...>

// DeckDetailModal.tsx — download button
const downloadTarget = useCoachTarget('DeckDetail.DownloadButton');
<Pressable {...downloadTarget} ...>

// StudyScreen.tsx — card swipe area (current card wrapper)
const swipeTarget = useCoachTarget('Study.CardSwipeArea');
<Animated.View {...swipeTarget} style={styles.cardWrapper}>...
```

## Edge Cases & Behavior

- No internet / download fails: allow Next/Skip; present a non-blocking note “You can import later from Discover”.
- No current deck after import: don’t start Study flow until `useScheduler().current` exists.
- Modal layout jitter: set `pauseMs: 150` before measuring modal targets.
- Accessibility: mark overlay blocks as `accessible={false}`; focus the callout; ensure copy is readable in both themes.

## QA Checklist

- Works on small and large screens, light/dark themes.
- Overlay covers entire app, including modals.
- Targets measured reliably after navigation and animations settle.
- Haptics trigger once per step; success haptic at flow completion.
- Persistence flags prevent re-show on next app launch; Settings replay works.

## Delivery Plan (1–1.5 days)

1) Scaffold coach core (context, hook, overlay, storage, nav ref).
2) Instrument targets in Discover, DeckDetailModal, Study.
3) Author the two flows and copy; wire to onboarding completion.
4) Gate Study flow on card availability; add pending resume.
5) Polish (haptics, callout placement, ghost-hand pacing), QA.

---

This plan stays strictly minimal (only Discover import and Study gestures) while delivering a high-end, human-guided feel. It matches your current UI, gesture model, colors, and hooks to ensure fast, low-risk integration.
