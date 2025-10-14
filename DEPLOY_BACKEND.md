# Firebase Backend Setup

## Quick Start (Local Development)

### 1. Start Firebase Emulator
```bash
cd firebase
./START_EMULATOR.sh
```

The emulator will run in the background at:
- **API URL**: `http://127.0.0.1:5001/hefs-b3e45/us-central1/api`
- Already configured in `.env.development`

### 2. Stop Emulator
```bash
cd firebase
./STOP_EMULATOR.sh
```

### 3. Environment Setup
Your OpenAI API key is already in `firebase/functions/.env.local`:
```bash
# firebase/functions/.env.local
OPENAI_API_KEY=sk-...
```

### 4. Test AI Hints
1. Start the emulator (step 1)
2. Start your Expo app: `npm start`
3. Open a deck → "Enable AI Hints"
4. Watch the console for:
   ```
   [AiHintsService] Generating hints for X cards
   [ApiService] POST /ai/hints/generate
   [ApiService] Success: /ai/hints/generate
   ```

### 5. Check Emulator Status
```bash
# See if emulator is running
ps aux | grep firebase

# View emulator logs
cd firebase
tail -f firebase-debug.log
```

---

## Production Deployment (Requires Blaze Plan)

### Prerequisites
1. Install Firebase CLI (if not installed):
```bash
npm install -g firebase-tools
```

2. Login to Firebase:
```bash
firebase login
```

3. **Upgrade to Blaze Plan**: https://console.firebase.google.com/project/hefs-b3e45/usage/details

## Deploy Functions

### Option 1: Deploy All Functions
From the root of the project:
```bash
cd firebase/functions
npm install  # Install dependencies first
cd ../..
firebase deploy --only functions
```

### Option 2: Deploy Only the API Function
```bash
firebase deploy --only functions:api
```

## Verify Deployment
After deployment, you should see output like:
```
✔  functions[api(us-central1)] Successful create operation.
Function URL (api(us-central1)): https://us-central1-YOUR-PROJECT.cloudfunctions.net/api
```

## Update .env Files

### For Development (.env.development)
Update the API URL with your deployed function URL:
```
API_BASE_URL=https://us-central1-YOUR-PROJECT-ID.cloudfunctions.net/api
```

### For Production (.env.production)
```
API_BASE_URL=https://us-central1-YOUR-PROJECT-ID.cloudfunctions.net/api
```

## Test the Deployment

### 1. Test Health Endpoint
```bash
curl https://us-central1-YOUR-PROJECT-ID.cloudfunctions.net/api/health
```

Should return:
```json
{"success": true, "message": "API is healthy"}
```

### 2. Test from the App
1. Restart the Expo development server
2. Try enabling AI hints for a deck
3. Check logs for successful API calls

## Troubleshooting

### "Insufficient permissions" Error
Make sure you're logged in with the correct Google account:
```bash
firebase login --reauth
```

### Functions Install Issues
If `npm install` fails in functions:
```bash
cd firebase/functions
rm -rf node_modules package-lock.json
npm install
```

### Environment Variables
Make sure `firebase/functions/.env` has your OpenAI API key:
```
OPENAI_API_KEY=sk-...
```

## Cost Monitoring
- Firebase Cloud Functions have a free tier
- Monitor usage in Firebase Console > Functions
- OpenAI API costs are logged in function execution logs
