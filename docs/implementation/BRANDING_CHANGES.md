# Branding Changes Complete ✅

## Changes Made

### 1. **Tagline Updated**
- Changed from "Learn anything faster with spaced repetition" to **"memorize anything"**
- Updated in: `WelcomeScreen.tsx`

### 2. **Logo Size Increased**
- **WelcomeScreen**: 140px → **180px** (main welcome screen)
- **SignInScreen**: Added **80px** logo at top
- **SignUpScreen**: Added **80px** logo at top

### 3. **Logo Added to Auth Screens**
- SignInScreen now shows enqode logo above "Welcome back"
- SignUpScreen now shows enqode logo above "Create your account"

## App Icon Update Instructions

### Why the app still shows "memorize-app"
The app icon and name are cached by iOS/Android. You need to **rebuild the app** for the changes to take effect.

### How to Update the App Icon

#### Option 1: Quick Test (Expo Go - Limited)
```bash
# Clear cache and restart
npx expo start -c
```
**Note**: Expo Go won't show the updated app name/icon. You need a development build.

#### Option 2: Development Build (Recommended)
```bash
# For iOS
npx expo run:ios

# For Android
npx expo run:android
```

This will:
- Build a native development client with the new bundle identifier (`com.enqode.app`)
- Show the correct app name "enqode" on your home screen
- Display the splash screen with the enqode logo on dark background

#### Option 3: Create a Custom App Icon
If you want a custom app icon (not just the transparent logo):

1. Create a 1024×1024 PNG icon (can be square with background color)
2. Replace `/assets/icon.png` with your new icon
3. For Android adaptive icon, replace `/assets/adaptive-icon.png` (foreground only, transparent)
4. Rebuild the app using Option 2

### Current Icon Configuration
```json
"icon": "./assets/icon.png"  // Main app icon (1024×1024)
"splash.image": "./assets/enqode_main_transparent.png"  // Splash screen ✅
"android.adaptiveIcon.foregroundImage": "./assets/adaptive-icon.png"
"android.adaptiveIcon.backgroundColor": "#0E0E10"  // Dark background ✅
```

### What's Already Updated
✅ App name: "enqode"
✅ Bundle ID: `com.enqode.app` (iOS)
✅ Package: `com.enqode.app` (Android)
✅ Splash screen: enqode logo on dark background
✅ Deep link scheme: `enqode://`
✅ All UI text updated to "enqode"
✅ Legal documents updated
✅ Tagline: "memorize anything"

### Next Steps
1. **Run `npx expo run:ios`** (or `run:android`) to see the changes
2. The app will install with the correct name "enqode"
3. Optionally create a custom square icon for `assets/icon.png`
4. For production builds, increment version in `app.json`

### Why You Must Rebuild
- App name and bundle identifier changes require a native rebuild
- The cached app on your device still has the old metadata
- Expo Go doesn't support custom bundle identifiers
- Development builds are required to see the full branding
