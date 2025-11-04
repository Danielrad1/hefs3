# Fix Code Signing for Free Apple Developer Account

## The Problem
Your personal Apple Developer account doesn't support:
- Sign in with Apple capability
- Push Notifications capability

These need to be removed to build on a physical device with a free account.

## Solution: Remove Capabilities in Xcode

I opened `enqode.xcworkspace` for you. Follow these steps:

### Step 1: Select the Target
1. In Xcode, click on **"enqode"** in the left sidebar (the blue project icon)
2. Make sure **"enqode"** target is selected (not the project)

### Step 2: Go to Signing & Capabilities Tab
1. Click the **"Signing & Capabilities"** tab at the top
2. You'll see your team: "Daniel Masoumi Rad (Personal Team)"

### Step 3: Remove Capabilities
1. Find **"Sign in with Apple"** capability
   - Click the **trash icon** or **"-"** button to remove it
2. Find **"Push Notifications"** capability
   - Click the **trash icon** or **"-"** button to remove it

### Step 4: Save and Close Xcode
- Press `Cmd+S` to save
- Close Xcode

### Step 5: Rebuild
```bash
npx expo run:ios --device
```

## Alternative: Use iOS Simulator (No Code Signing Issues)
If you want to see the branding immediately without device hassles:
```bash
npx expo run:ios
```

This will launch in the iOS Simulator with:
- ✅ App name "enqode"
- ✅ Bundle ID `com.enqode.app`
- ✅ New splash screen and logo
- ✅ All branding changes

## For Production
When you're ready for production, you'll need:
- A paid Apple Developer account ($99/year)
- Or remove Apple Sign-In from your app entirely
