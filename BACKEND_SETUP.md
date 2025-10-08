# Backend Setup Guide

## Phase 1 & 2 Complete! ✅

You now have:
- Firebase Functions backend scaffolded
- Client-side ApiService for authenticated requests
- Environment configuration

## Quick Start

### 1. Setup Firebase Project

```bash
cd firebase
npm install
```

**Update `.firebaserc` with your Firebase project ID:**
```json
{
  "projects": {
    "default": "your-actual-firebase-project-id"
  }
}
```

Or use: `firebase use --add` to select interactively

### 2. Update Environment Files

**Edit `.env.development`:**
```bash
API_BASE_URL=http://localhost:5001/YOUR_PROJECT_ID/us-central1/api
```

**Edit `app.config.js`:**
- Update the default `apiBaseUrl` with your project ID

### 3. Start Firebase Emulator

```bash
cd firebase/functions
npm run serve
```

This starts the emulator at http://localhost:5001

### 4. Run Mobile App

In a new terminal:
```bash
cd /Users/danielrad/Desktop/repos/hefs2/memorize-app
npm start
```

## Testing the Connection

### Test 1: Health Check (No Auth Required)

```bash
curl http://localhost:5001/YOUR_PROJECT_ID/us-central1/api/health
```

Expected response:
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

### Test 2: Authenticated Endpoint

1. Sign in to your mobile app
2. Check the console logs for your Firebase token
3. Test with:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5001/YOUR_PROJECT_ID/us-central1/api/user/me
```

Expected response:
```json
{
  "success": true,
  "data": {
    "uid": "...",
    "email": "user@example.com",
    "premium": false
  }
}
```

### Test 3: From Mobile App

Add this to any screen to test:

```typescript
import { ApiService } from '../services/cloud';

// Test health check
const testConnection = async () => {
  try {
    const isHealthy = await ApiService.checkHealth();
    console.log('Backend health:', isHealthy);
    
    // Test authenticated endpoint
    const userInfo = await ApiService.get('/user/me');
    console.log('User info:', userInfo);
  } catch (error) {
    console.error('API test failed:', error);
  }
};
```

## Project Structure

```
memorize-app/
├── firebase/
│   ├── functions/
│   │   ├── src/
│   │   │   ├── index.ts           # Main entry point
│   │   │   ├── config/            # Configuration
│   │   │   ├── middleware/        # Auth & error handling
│   │   │   ├── handlers/          # Endpoint handlers
│   │   │   └── types/             # TypeScript types
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── firebase.json
├── src/
│   └── services/
│       └── cloud/
│           ├── ApiService.ts      # Base HTTP client
│           ├── types.ts           # Shared types
│           └── index.ts           # Exports
├── app.config.js                  # Expo config with env vars
├── .env.development               # Dev environment
└── .env.production                # Prod environment
```

## Available Endpoints

### Public
- `GET /health` - Health check

### Protected (require auth)
- `GET /user/me` - Get current user info

## Next Steps

Once you confirm the connection works:

1. **Phase 3: Cloud Backup**
   - Add backup handlers to Firebase Functions
   - Create CloudBackupService in client
   - Add UI to Settings screen

2. **Phase 4: Discover Content**
   - Set up Firebase Hosting
   - Create deck catalog
   - Update DiscoverScreen

3. **Phase 5: AI Features**
   - Add OpenAI integration to backend
   - Create AiService in client
   - Add AI UI to card editor

## Troubleshooting

### "Module not found: expo-constants"
```bash
npm install expo-constants
npx expo run:ios  # Rebuild dev client
```

### "Cannot find API_BASE_URL"
- Restart Expo dev server after changing .env files
- Check `app.config.js` syntax

### CORS errors
- The backend already allows all origins in development
- Check that you're using the correct URL format

### Firebase emulator not starting
```bash
cd firebase/functions
rm -rf node_modules
npm install
npm run serve
```

## Deploy to Production

When ready to deploy:

```bash
cd firebase
firebase deploy --only functions
```

Update `.env.production` with the deployed URL:
```
API_BASE_URL=https://us-central1-your-project.cloudfunctions.net/api
```
