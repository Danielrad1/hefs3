# Development Environment Setup

## 🎯 ONE-FILE MODE SWITCHING

**Edit `ENV_CONFIG.js` and change ONE LINE:**

```javascript
const CURRENT_MODE = 'local';  // Change to 'cloud' for production
```

That's it! Everything else is automatic.

---

## Quick Start

### Local Mode (default)

```bash
# Terminal 1: Start emulator
cd firebase && ./START_EMULATOR.sh

# Terminal 2: Start app  
npx expo start --clear
```

**Important:** After starting, you must **completely close and reopen** the app in simulator (not just reload).

### Cloud Mode

1. Edit `ENV_CONFIG.js`:
   ```javascript
   const CURRENT_MODE = 'cloud';
   ```

2. Run `./RESET_DEV.sh` and follow instructions

3. Deploy backend changes:
   ```bash
   cd firebase && firebase deploy --only functions:api
   ```

---

## Environment Detection

The app automatically detects which mode it's in:

**On app startup, check logs for:**
```
[ApiService] 🚀 Environment: development-local
[ApiService] 📡 API Base: http://localhost:5001/...
```

**Backend auto-detects emulator:**
```
[Auth] 🔧 Running in EMULATOR mode - bypassing authentication
```

---

## Troubleshooting

### "Network request failed" when using localhost

1. **Check emulator is running:**
   ```bash
   cd firebase
   ./START_EMULATOR.sh
   ```
   Look for: `✅ Emulator started`

2. **Verify app is using localhost:**
   - Check app startup logs for `📡 API Base: http://localhost:5001...`
   - If showing production URL, restart with `npx expo start --clear`

3. **Kill stuck emulator:**
   ```bash
   cd firebase
   ./STOP_EMULATOR.sh
   ./START_EMULATOR.sh
   ```

### Changes not appearing in emulator

The emulator auto-reloads when you save TypeScript files in `firebase/functions/src/`.  
If not working, manually rebuild:
```bash
cd firebase/functions
npm run build
# Emulator will pick up changes
```

### Switch between modes

**Always restart Expo after changing `.env.development`:**
```bash
# Stop Expo (Ctrl+C)
npx expo start --clear
```

---

## File Reference

| File | Purpose |
|------|---------|
| `.env.development` | Dev mode config (toggle local/cloud here) |
| `.env.production` | Production builds only |
| `firebase/START_EMULATOR.sh` | Starts local backend |
| `firebase/STOP_EMULATOR.sh` | Stops local backend |

---

## Current Setup

✅ **Backend:** Auto-detects emulator, bypasses auth  
✅ **Frontend:** Reads from `.env.development`  
✅ **Default mode:** Local emulator  
✅ **One-line switch:** Comment/uncomment in `.env.development`
