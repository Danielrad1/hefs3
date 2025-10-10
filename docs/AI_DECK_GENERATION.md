# AI Deck Generation Feature

Complete end-to-end AI-powered deck generation from natural language prompts or pasted notes.

## Overview

Users can create flashcard decks using AI by:
- **Prompt Mode**: Enter natural language like "top 1000 Spanish verbs" or "MCAT psychology terms"
- **Notes Mode**: Paste study notes and AI extracts key concepts into flashcards

Supports both **Basic** (Q&A) and **Cloze** (fill-in-the-blank) card types.

## Architecture

### Backend (Firebase Functions)

**Location**: `/firebase/functions/src/`

**Key Components**:
- `types/ai.ts` - TypeScript types/schemas for AI requests/responses
- `services/ai/OpenAIProvider.ts` - OpenAI integration with GPT-4o-mini
- `handlers/ai.ts` - Express route handlers for AI endpoints

**Endpoints**:
- `POST /ai/deck/generate` - Generate deck from prompt or notes
- `GET /ai/models` - List available AI models

**Request Schema**:
```typescript
{
  sourceType: 'prompt' | 'notes',
  prompt?: string,              // For prompt mode
  notesText?: string,           // For notes mode
  deckName?: string,            // Optional deck name
  noteModel: 'basic' | 'cloze', // Card type
  itemLimit?: number,           // Max cards (1-1000, default 50)
  languageHints?: string[],     // Optional language codes
  style?: {
    format?: 'qna' | 'glossary' | 'term-def',
    strictJson?: boolean
  }
}
```

**Response Schema**:
```typescript
{
  deckName: string,
  model: 'basic' | 'cloze',
  notes: Array<{
    front?: string,      // For basic cards
    back?: string,       // For basic cards
    cloze?: string,      // For cloze cards ({{c1::term}} syntax)
    tags?: string[]
  }>,
  metadata: {
    modelUsed: string,
    items: number
  }
}
```

### Client (React Native App)

**Location**: `/src/`

**Key Components**:
- `services/ai/AiService.ts` - API client for AI endpoints
- `services/ai/types.ts` - TypeScript types matching backend
- `app/Decks/AIDeckCreatorScreen.tsx` - Creation UI with tabs
- `app/Decks/AIDeckPreviewScreen.tsx` - Preview/edit before saving
- Updated `app/Decks/components/AddDeckModal.tsx` - Added AI option

**Navigation Flow**:
1. Decks → "+" → "Create with AI"
2. AIDeckCreatorScreen (input prompt/notes, configure options)
3. AIDeckPreviewScreen (preview, edit, delete cards)
4. DeckDetailScreen (view created deck)

## Setup Instructions

### Backend Setup

1. **Install Dependencies**:
```bash
cd firebase/functions
npm install
```

2. **Configure OpenAI API Key**:

For local development, set environment variable:
```bash
export OPENAI_API_KEY="sk-your-api-key-here"
```

For production deployment, configure Firebase secret:
```bash
firebase functions:secrets:set OPENAI_API_KEY
```

3. **Build and Deploy**:
```bash
# Build TypeScript
npm run build

# Test locally
npm run serve

# Deploy to production
npm run deploy
```

### Client Setup

1. **Enable AI Features**:

Edit `.env.development`:
```bash
ENABLE_AI_FEATURES=true
```

Edit `.env.production`:
```bash
ENABLE_AI_FEATURES=true
```

2. **No additional dependencies needed** - OpenAI SDK only required on backend

## Usage

### For Users

1. Navigate to **Decks** tab
2. Tap the **"+"** floating button
3. Select **"Create with AI"**
4. Choose mode:
   - **Prompt**: Enter what you want to learn (e.g., "Spanish food vocabulary")
   - **Paste Notes**: Paste your study notes
5. Configure options:
   - Deck name (optional - AI suggests one)
   - Card type: Basic (Q&A) or Cloze (fill-in-blank)
   - Number of cards (1-1000)
6. Tap **"Generate Deck"**
7. Preview and edit cards
8. Tap **"Create Deck"** to save

### Card Types

**Basic Cards** (Q&A):
- Front: Question or term
- Back: Answer or definition
- Example: "What is photosynthesis?" → "Process by which plants convert light into energy"

**Cloze Cards** (Fill-in-blank):
- Single field with `{{c1::answer}}` syntax
- Multiple cloze deletions create multiple cards
- Example: "{{c1::Mitochondria}} is the {{c2::powerhouse}} of the cell"
  - Card 1: "[...] is the powerhouse of the cell" → Answer: Mitochondria
  - Card 2: "Mitochondria is the [...] of the cell" → Answer: powerhouse

## AI Prompt Engineering

### System Prompts

**For Basic Cards**:
- Produces front/back Q&A pairs
- Emphasizes concise questions and focused answers
- One concept per card
- Adds relevant tags

**For Cloze Cards**:
- Uses Anki-compatible `{{c1::term}}` syntax
- Creates multiple cloze deletions when appropriate
- Keeps text concise (1-2 sentences)

### User Prompts

**Prompt Mode**:
```
Create N flashcards about: {user_prompt}
Model: {basic|cloze}
Language hints: {hints}
Output JSON.
```

**Notes Mode**:
```
Convert these notes into flashcards. Identify key concepts:
{user_notes}
Model: {basic|cloze}
Output JSON.
```

## Data Flow

1. User input → AIDeckCreatorScreen
2. API call → ApiService.post('/ai/deck/generate')
3. Backend → OpenAIProvider.generateDeck()
4. OpenAI API → JSON response
5. Parse/validate → GenerateDeckResponse
6. Return to client → AIDeckPreviewScreen
7. User edits/confirms → NoteService.createNote()
8. Save to local DB → PersistenceService.save()
9. Navigate to DeckDetailScreen

## Error Handling

**Backend Errors**:
- Invalid request → 400 with validation error
- Missing API key → 500 configuration error
- AI generation fails → 500 with error message
- Empty/invalid output → Throws error

**Client Errors**:
- Displays user-friendly alerts
- Logs to console for debugging
- Allows retry on failure

## Tagging

All AI-generated cards receive tags:
- `ai` - General AI-generated tag
- `ai:generated` - Specific source tag
- Additional tags from AI response

## Testing

### Manual Test Cases

1. **Prompt Mode - Basic**:
   - Input: "Top 50 Spanish verbs"
   - Expected: 50 basic cards with verb Q&A

2. **Prompt Mode - Cloze**:
   - Input: "MCAT psychology terms"
   - Expected: Psychology terms with cloze deletions

3. **Notes Mode - Basic**:
   - Input: Paste biology chapter notes
   - Expected: Key concepts extracted as Q&A

4. **Edge Cases**:
   - Empty prompt → Error
   - Very large request (1000 cards) → Success
   - Malformed AI output → Error with clear message

### Integration Testing

```bash
# Start emulators
cd firebase
firebase emulators:start

# Test endpoint directly
curl -X POST http://localhost:5001/hefs-b3e45/us-central1/api/ai/deck/generate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sourceType": "prompt",
    "prompt": "Top 10 capitals",
    "noteModel": "basic",
    "itemLimit": 10
  }'
```

## Cost Considerations

**Current Implementation**:
- No cost controls or guardrails
- Uses GPT-4o-mini (cost-effective model)
- ~$0.15 per 1M input tokens
- ~$0.60 per 1M output tokens

**Typical Usage**:
- 50 card generation: ~500 tokens input, ~2000 tokens output
- Cost: ~$0.0015 per deck (less than 1 cent)

**Future Enhancements**:
- Add usage quotas per user
- Implement rate limiting
- Track costs per user/org
- Add spending caps

## Future Improvements

1. **Model Selection**: Allow users to choose GPT-4o vs GPT-4o-mini
2. **Batch Operations**: Generate multiple decks at once
3. **Fine-tuning**: Train on user's existing decks for better style matching
4. **Image Support**: Generate image-based flashcards
5. **Audio Support**: Text-to-speech for language learning
6. **Collaborative Generation**: Share and remix AI-generated decks
7. **Template Library**: Pre-built prompts for common subjects
8. **Quality Scoring**: AI rates card quality and suggests improvements

## Troubleshooting

**"AI service not configured" error**:
- Ensure OPENAI_API_KEY is set in environment
- Check Firebase Functions secrets configuration

**"Generation failed" error**:
- Check OpenAI API quota/billing
- Verify API key is valid
- Check Firebase Functions logs for details

**Empty or invalid output**:
- Try reducing item limit
- Simplify prompt
- Check if AI model is available

**Cards not appearing correctly**:
- Verify model IDs match (basic=1, cloze=1 for MODEL_TYPE_CLOZE)
- Check field mapping in preview screen
- Ensure tags are formatted correctly

## Files Modified/Created

### Backend
- `firebase/functions/package.json` - Added openai dependency
- `firebase/functions/src/types/ai.ts` - NEW
- `firebase/functions/src/services/ai/OpenAIProvider.ts` - NEW
- `firebase/functions/src/handlers/ai.ts` - NEW
- `firebase/functions/src/index.ts` - Added AI routes

### Client
- `src/services/ai/types.ts` - NEW
- `src/services/ai/AiService.ts` - NEW
- `src/app/Decks/AIDeckCreatorScreen.tsx` - NEW
- `src/app/Decks/AIDeckPreviewScreen.tsx` - NEW
- `src/app/Decks/components/AddDeckModal.tsx` - Added AI option
- `src/app/Decks/DecksScreen.tsx` - Wired up AI navigation
- `src/navigation/DecksStack.tsx` - Added AI screens
- `.env.development` - Enabled AI features
- `.env.production` - Can be enabled when ready

## Acceptance Criteria ✅

- [x] User can generate deck via prompt
- [x] User can generate deck via pasted notes
- [x] User can choose Basic or Cloze card type
- [x] Preview screen shows all generated cards
- [x] User can edit cards before creating deck
- [x] User can delete individual cards
- [x] Created deck appears in Decks list
- [x] Cards are immediately studyable
- [x] Clear error messages on failure
- [x] AI tags applied automatically
- [x] Deck name can be customized
- [x] Item limit configurable (1-1000)
