# Phase 0 — Project Scaffolding (React Native)

## Overview
This phase creates a clean React Native (TypeScript) app with a TikTok-style navigation skeleton that runs on device (iOS first), supports light/dark themes, and includes a minimal design system, haptics, and tab navigation.

## Tech Stack
- **Runtime**: React Native 0.75+ with Hermes
- **Language**: TypeScript
- **Project flavor**: Expo + Dev Client (EAS)
- **Navigation**: @react-navigation/native + @react-navigation/bottom-tabs + react-native-screens
- **Gestures & Animations**: react-native-gesture-handler + Reanimated 3
- **Lists/Feeds**: FlashList (Shopify) for future performance needs
- **WebView**: react-native-webview
- **Haptics**: expo-haptics
- **Theming**: token-based (colors/typography/spacing/radii/shadows) + system dark mode
- **State mgmt**: Zustand (simple, fast) or Context for Phase 0
- **Testing**: Jest + React Native Testing Library

## Definition of Done
- [x] App builds and runs on an iOS device/simulator via `npx expo run:ios`
- [x] Tabs present: Home/Stats, Decks, Study, Settings
- [x] Study screen fills the viewport and shows a right-side difficulty rail with haptics
- [x] Light/Dark theme toggles with system setting and applies throughout
- [x] Codebase includes design tokens, shared components, and basic lint/test scaffolding

## Next Steps
- Phase 1 (UI polish): vertical snap pager (Reanimated), reveal/back flow, micro-animations
- Phase 2 (domain models & in-memory services): swap mocks for interfaces, wire the Study UI to fake data
- Phase 3 (DB): add react-native-quick-sqlite (JSI), define schema + migrations, and wire search
