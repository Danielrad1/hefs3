# Firebase Backend for memorize-app

## Setup

1. **Install dependencies:**
   ```bash
   cd functions
   npm install
   ```

2. **Configure Firebase project:**
   - Update `.firebaserc` with your Firebase project ID
   - Or run: `firebase use --add` to select interactively

3. **Run locally with emulator:**
   ```bash
   npm run serve
   ```
   This starts the Firebase emulator at http://localhost:5001

4. **Deploy to Firebase:**
   ```bash
   npm run deploy
   ```

## Available Endpoints

### Public Endpoints
- `GET /health` - Health check

### Protected Endpoints (require Authorization header)
- `GET /user/me` - Get current user info

## Testing

### Test health endpoint:
```bash
curl http://localhost:5001/your-project/us-central1/api/health
```

### Test authenticated endpoint:
```bash
# Get token from mobile app logs, then:
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5001/your-project/us-central1/api/user/me
```

## Environment Variables

For local development, create `functions/.env.local`:
```
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

## Structure

```
functions/
├── src/
│   ├── index.ts           # Main entry point
│   ├── config/            # Configuration and constants
│   ├── middleware/        # Auth and error handling
│   ├── handlers/          # Route handlers
│   ├── services/          # Business logic (AI, storage, etc)
│   └── types/             # TypeScript types
├── package.json
└── tsconfig.json
```
