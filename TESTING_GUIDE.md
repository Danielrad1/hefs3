# Backend Testing Guide

## Prerequisites

You should have completed Phase 1 & 2:
- ✅ Firebase backend scaffolded
- ✅ ApiService created
- ✅ app.config.js with environment variables

## Step-by-Step Testing

### Step 1: Install Firebase Backend Dependencies

```bash
cd firebase/functions
npm install
```

This installs all required packages (express, firebase-admin, firebase-functions, etc.)

### Step 2: Update Firebase Project ID

**Option A: Edit `.firebaserc` manually:**
```json
{
  "projects": {
    "default": "your-actual-firebase-project-id"
  }
}
```

**Option B: Use Firebase CLI:**
```bash
cd firebase
firebase use --add
# Select your project from the list
```

**Find your project ID:**
- Go to https://console.firebase.google.com
- Open your project
- Settings → General → Project ID

### Step 3: Update Environment Configuration

**Edit `.env.development`:**
```bash
# Replace YOUR_PROJECT_ID with your actual Firebase project ID
API_BASE_URL=http://localhost:5001/YOUR_PROJECT_ID/us-central1/api
ENABLE_CLOUD_BACKUP=false
ENABLE_AI_FEATURES=false
APP_ENV=development
```

**Example:**
If your project ID is `memorize-app-12345`:
```bash
API_BASE_URL=http://localhost:5001/memorize-app-12345/us-central1/api
```

### Step 4: Start Firebase Emulator

```bash
cd firebase/functions
npm run serve
```

**Expected output:**
```
✔  functions[us-central1-api]: http function initialized (http://localhost:5001/...)
┌─────────────────────────────────────────────────────────────┐
│ ✔  All emulators ready! It is now safe to connect your app. │
└─────────────────────────────────────────────────────────────┘
```

**Emulator UI:** http://localhost:4000

### Step 5: Test Backend Directly (Terminal)

In a new terminal:

```bash
# Test health endpoint (no auth required)
curl http://localhost:5001/YOUR_PROJECT_ID/us-central1/api/health
```

**Expected response:**
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": 1696790400000,
    "version": "1.0.0"
  }
}
```

✅ If you see this, your backend is working!

### Step 6: Start Mobile App

In a new terminal:

```bash
cd /Users/danielrad/Desktop/repos/hefs2/memorize-app
npm start
```

Press `i` for iOS simulator (or scan QR code)

### Step 7: Add Developer Tools to Settings Screen

**Edit `src/app/Settings/SettingsScreen.tsx`:**

Add import:
```typescript
import { DeveloperSection } from './components/DeveloperSection';
```

Add the component (somewhere in your ScrollView):
```typescript
<DeveloperSection />
```

**Rebuild dev client (one time only):**
```bash
npx expo run:ios
```

This is needed because we added `expo-constants`.

### Step 8: Test from Mobile App

1. **Sign in** to the app (required for authenticated endpoints)

2. **Navigate to Settings screen**

3. **Test Health Check:**
   - Tap "Test Health Check" button
   - Should show: ✅ "Health check passed!"

4. **Test Authenticated API:**
   - Tap "Test Authenticated API" button
   - Should show alert with your email and UID

5. **Check Console Logs:**
   - Look for `[Developer]` and `[ApiService]` logs
   - Verify token is being sent
   - Verify responses are received

## Troubleshooting

### Error: "Cannot read property 'apiBaseUrl'"

**Cause:** Expo hasn't picked up the new app.config.js

**Fix:**
```bash
# Stop Expo
# Delete cache
rm -rf .expo
# Restart
npm start
```

### Error: "Network request failed"

**Possible causes:**

1. **Emulator not running**
   ```bash
   cd firebase/functions
   npm run serve
   ```

2. **Wrong URL in .env.development**
   - Check PROJECT_ID matches your Firebase project
   - Use `localhost`, not `127.0.0.1`

3. **iOS simulator can't reach localhost**
   - Try using your computer's local IP instead:
   ```bash
   API_BASE_URL=http://192.168.1.XXX:5001/PROJECT_ID/us-central1/api
   ```

### Error: "Module not found: expo-constants"

**Fix:**
```bash
npm install expo-constants
npx expo run:ios  # Rebuild dev client
```

### Error: "Invalid or expired token"

**Cause:** User not signed in, or token expired

**Fix:**
- Make sure you're signed in to the app
- Try signing out and back in
- Check Firebase Auth is working

### Health check works, but authenticated endpoint fails

**Debug steps:**

1. Tap "Show Auth Token" in Developer Tools
2. Check console for the token
3. Copy token and test manually:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5001/PROJECT_ID/us-central1/api/user/me
```

If curl works but app doesn't, check:
- ApiService is getting the token correctly
- Headers are being sent properly

## Success Checklist

- [ ] Backend dependencies installed
- [ ] Firebase project ID configured
- [ ] Emulator running on http://localhost:5001
- [ ] Health check passes (curl)
- [ ] Mobile app builds and runs
- [ ] DeveloperSection shows in Settings
- [ ] "Test Health Check" button works
- [ ] "Test Authenticated API" button works
- [ ] Console logs show successful API calls

## Next Steps

Once all tests pass, you're ready for:

**Phase 3: Cloud Backup**
- Implement `/backup/url` endpoint
- Create CloudBackupService
- Add backup UI to Settings

Want to proceed? Let me know and I'll implement Phase 3!

## Common Commands Reference

```bash
# Start emulator
cd firebase/functions && npm run serve

# Start mobile app
npm start

# Rebuild iOS dev client
npx expo run:ios

# Check emulator logs
cd firebase/functions && npm run logs

# Deploy to production
cd firebase && firebase deploy --only functions
```
