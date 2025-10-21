# Enqode Brand Integration Guide

This document explains exactly where to place the new brand assets (logo and app icon) and how to rename the app to “enqode” across iOS, Android, web, and the app UI.

## Files You Added
- `assets/enqode_main_transparent.png` — transparent logo (for splash, screens, and marketing)
- `assets/enqode_app_main_image_for_homescreen.png` — large hero/marketing image

Existing Expo image slots:
- `assets/icon.png` — app icon (1024×1024)
- `assets/adaptive-icon.png` — Android adaptive icon foreground (transparent)
- `assets/splash-icon.png` — current splash image
- `assets/favicon.png` — web favicon

## Rename The App
Edit `app.json` and change the following:
- name: set to `enqode`
- slug: set to `enqode` (affects Expo URLs)
- scheme: set to `enqode` (deep links)
- ios.bundleIdentifier: set to your identifier, e.g. `com.enqode.app`
- android.package: set to your identifier, e.g. `com.enqode.app`

File references:
- app.json:3 — "name"
- app.json:4 — "slug"
- app.json:11 — "scheme"
- app.json:24 — ios.bundleIdentifier
- app.json:35 — android.package

Tip: search the codebase for any user‑facing “Memorize” strings and replace with “enqode”. Screens to double‑check: `src/app/Auth/WelcomeScreen.tsx`, `src/app/Auth/SignInScreen.tsx`, onboarding screens.

## Icons (All Platforms)
- Replace `assets/icon.png` with your final 1024×1024 icon (no transparency needed).
- Referenced at:
  - app.json:7 — "icon": "./assets/icon.png"
  - app.json:48 — notifications plugin icon

## Android Adaptive Icon
- Replace `assets/adaptive-icon.png` with a foreground‑only PNG (transparent background, safe padding).
- Optional: set your brand background color for the icon ring.
  - app.json:31 — android.adaptiveIcon.foregroundImage
  - app.json:32 — android.adaptiveIcon.backgroundColor

## Splash Screen (Use Transparent Logo)
Recommended: use the transparent logo centered on a brand background.
- Update app.json:13 — `splash.image` to `./assets/enqode_main_transparent.png`
- Optional: set `splash.backgroundColor` to your brand background (e.g., `#0E0E10`).
- Resize mode `contain` is already set (good for transparent logos).

## Web Favicon
- Replace `assets/favicon.png` to match your icon (32×32 or 48×48 PNG).
- Referenced at app.json:39 — `web.favicon`.

## iOS Asset Catalog (if building natively)
If you open the native iOS workspace, also update the Xcode asset catalog so it matches the Expo config:
- Replace: `ios/memorizeapp/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png`
- Xcode will generate sizes at build time when using EAS; this is only needed if customizing locally.

## In‑App Logo Usage
Keep the transparent logo in `assets/` (or create `assets/brand/`). Import and use wherever needed:
```
const logo = require('../assets/enqode_main_transparent.png');
// <Image source={logo} style={{ width: 160, height: 160 }} />
```
Suggested places:
- `src/app/Auth/WelcomeScreen.tsx`
- `src/app/Auth/SignInScreen.tsx`
- `src/app/Onboarding/*`
- `src/app/Home/HomeScreen.tsx`

## Typography (Inter)
Expo supports Inter. Ensure any headings that display the brand name use Inter:
```
<Text style={{ fontFamily: 'Inter', fontWeight: '700', fontSize: 28 }}>enqode</Text>
```
If Inter isn’t yet loaded, install and load via `expo-font` or use the Expo Google Fonts package.

## Brand Colors
Primary brand purple used across themes:
- Base: `#8B5CF6`
- Hover/pressed: `#7C3AED`
These are already used in the Sunset scheme (`src/design/theme.tsx`). Consider aligning splash background with the dark app background: `#0E0E10`.

## Post‑Change Checklist
- Replace/point images in `app.json` as described above.
- Clear caches once: `expo start -c`.
- Verify:
  - App name shows “enqode” on device home screen and inside onboarding/welcome.
  - Splash shows the transparent logo on the intended background.
  - Android adaptive icon has correct foreground and background.
  - Web favicon updates on `expo start --web`.
- For production, increment `version` in `app.json` and update iOS/Android build numbers as needed.

## Quick Reference — Exact Paths
- App name/slug/scheme: `memorize-app/app.json`
- Icon/adaptive/splash/notifications: `memorize-app/app.json`
- Favicon: `memorize-app/app.json`
- iOS icon (native): `memorize-app/ios/memorizeapp/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png`
- Assets directory: `memorize-app/assets/`

---
When you’re ready, I can also update `app.json` for you to point `splash.image` to the new transparent logo and change the name/slug/scheme to “enqode”.

