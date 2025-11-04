# 🔄 Environment Switching Guide

## The One-File Solution

All environment configuration is controlled by **ONE file**: `ENV_CONFIG.js`

## Switch Between Local & Cloud

### Edit ENV_CONFIG.js

```javascript
const CURRENT_MODE = 'local';  // or 'cloud'
```

### Then Reset

```bash
./RESET_DEV.sh
# Follow the instructions it prints
```

---

## Modes Explained

### `'local'` Mode (Default)
- ✅ **Fast iteration** - see changes instantly
- ✅ **No API costs** - everything runs locally  
- ✅ **No auth required** - bypassed automatically
- ⚠️ **Requires emulator** - `cd firebase && ./START_EMULATOR.sh`

### `'cloud'` Mode
- ✅ **Real environment** - production Firebase
- ✅ **No local setup** - just works
- ⚠️ **Requires deployment** - `firebase deploy --only functions:api`
- ⚠️ **API costs apply** - OpenAI charges per request
- ⚠️ **Real auth required** - must be logged in

---

## Verification

After switching modes, you should see:

**Local Mode:**
```
==================================================
🔧 LOCAL EMULATOR MODE
==================================================
Environment: development-local
API Base: http://localhost:5001/enqode-6b13f/us-central1/api
==================================================
```

**Cloud Mode:**
```
==================================================
☁️  PRODUCTION CLOUD MODE
==================================================
Environment: production
API Base: https://us-central1-enqode-6b13f.cloudfunctions.net/api
==================================================
```

---

## Common Issues

### "Still showing wrong mode after switching"

**Solution:** You must **completely close and reopen** the app:
1. In iOS Simulator: Cmd+Shift+H (home)
2. Swipe up from bottom
3. Swipe app upward to close
4. Tap app icon to reopen

**Why:** React Native caches the config. Reload (`r` key) is not enough.

### "Network request failed" in local mode

**Solution:** Start the emulator:
```bash
cd firebase
./START_EMULATOR.sh
```

Look for: `✅ Emulator started`

---

## Files Reference

| File | Purpose |
|------|---------|
| `ENV_CONFIG.js` | **Master switch** - edit this to change modes |
| `app.config.js` | Reads from `ENV_CONFIG.js` (don't edit) |
| `RESET_DEV.sh` | Clears caches and shows instructions |
| `firebase/START_EMULATOR.sh` | Starts local backend |
| `firebase/STOP_EMULATOR.sh` | Stops local backend |

---

## Quick Commands

```bash
# Switch to local mode
# 1. Edit ENV_CONFIG.js: CURRENT_MODE = 'local'
./RESET_DEV.sh
cd firebase && ./START_EMULATOR.sh
# In another terminal:
npx expo start --clear
# Close and reopen app

# Switch to cloud mode  
# 1. Edit ENV_CONFIG.js: CURRENT_MODE = 'cloud'
./RESET_DEV.sh
npx expo start --clear
# Close and reopen app

# Deploy backend changes (cloud mode only)
cd firebase
firebase deploy --only functions:api
```

---

## ✅ Current Setup

- **Single source of truth:** `ENV_CONFIG.js`
- **Frontend:** Auto-detects mode from config
- **Backend:** Auto-detects emulator and bypasses auth
- **One-line switch:** Change `CURRENT_MODE` variable
- **Foolproof:** Can't accidentally mix local/cloud
