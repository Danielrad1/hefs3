# AI Deck Generation - Complete Documentation

## Quick Start

```bash
# 1. Get OpenAI API key from: https://platform.openai.com/api-keys

# 2. Start backend with API key
export OPENAI_API_KEY="sk-your-key-here"
cd firebase
firebase emulators:start

# 3. Start app (in another terminal)
cd memorize-app
npm start

# 4. Test: Decks → "+" → "Create with AI" → "Top 10 world capitals"
```

## Overview

End-to-end AI-powered deck generation using OpenAI GPT-4o-mini. Users can create flashcard decks from natural language prompts or pasted notes, supporting both Basic (Q&A) and Cloze (fill-in-blank) card types.

**Cost**: ~$0.0015 per 50-card deck (less than 1 cent)

## Architecture

### Backend (Firebase Functions)

**Location**: `firebase/functions/src/`

```
firebase/functions/src/
├── types/
│   └── ai.ts                    # Request/response types, Zod schemas
├── services/ai/
│   ├── prompts.ts              # AI prompt templates (system & user)
│   └── OpenAIProvider.ts       # OpenAI integration, generation logic
└── handlers/
    └── ai.ts                   # Express route handlers
```

**Key Files**:

1. **`types/ai.ts`** - Type definitions
   - `GenerateDeckRequest` - Input schema with Zod validation
   - `GenerateDeckResponse` - Output schema
   - `GeneratedNote` - Individual note structure
   - `AIProvider` - Provider interface

2. **`services/ai/prompts.ts`** - Prompt management
   - `getSystemPrompt(noteModel)` - Returns system prompt for Basic/Cloze
   - `buildUserPrompt(params)` - Builds user prompt from request
   - Separated for easy maintenance and iteration

3. **`services/ai/OpenAIProvider.ts`** - Core generation
   - Implements `AIProvider` interface
   - Calls OpenAI API with structured prompts
   - Parses and validates JSON responses
   - Filters invalid notes
   - Comprehensive logging throughout

4. **`handlers/ai.ts`** - API endpoints
   - `POST /ai/deck/generate` - Generate deck
   - `GET /ai/models` - List available models
   - Request validation with Zod
   - Error handling

### Client (React Native)

**Location**: `src/`

```
src/
├── services/ai/
│   ├── types.ts                # Client-side types (matches backend)
│   └── AiService.ts            # API client
└── app/Decks/
    ├── AIDeckCreatorScreen.tsx # Creation UI (tabs, inputs)
    └── AIDeckPreviewScreen.tsx # Preview/edit before saving
```

**Key Files**:

1. **`services/ai/AiService.ts`** - API integration
   - `generateDeck(request)` - Calls backend endpoint
   - `getModels()` - Fetches available models
   - Uses existing `ApiService` for auth

2. **`app/Decks/AIDeckCreatorScreen.tsx`** - Input screen
   - Tabbed interface: Prompt vs Notes mode
   - Card type selector: Basic vs Cloze
   - Item limit, deck name, language hints
   - Generates and navigates to preview

3. **`app/Decks/AIDeckPreviewScreen.tsx`** - Preview screen
   - Lists all generated notes
   - Inline editing per note
   - Delete individual notes
   - Creates deck with NoteService/DeckService
   - Auto-refreshes deck list on success

## Data Flow

```
User Input (AIDeckCreatorScreen)
    ↓
AiService.generateDeck()
    ↓
POST /ai/deck/generate (Backend)
    ↓
OpenAIProvider.generateDeck()
    ↓
Build prompts (prompts.ts)
    ↓
OpenAI API call
    ↓
Parse & validate JSON response
    ↓
Filter invalid notes
    ↓
Return GenerateDeckResponse
    ↓
AIDeckPreviewScreen (edit/review)
    ↓
User confirms
    ↓
NoteService.createNote() for each note
    ↓
PersistenceService.save()
    ↓
Navigate to DeckDetailScreen
```

## API Endpoints

### POST /ai/deck/generate

**Request**:
```typescript
{
  sourceType: 'prompt' | 'notes',
  prompt?: string,              // For prompt mode
  notesText?: string,           // For notes mode
  deckName?: string,            // Optional
  noteModel: 'basic' | 'cloze', // Default: 'basic'
  itemLimit?: number,           // 1-1000, default: 50
  languageHints?: string[],     // Optional
  style?: {
    format?: 'qna' | 'glossary' | 'term-def',
    strictJson?: boolean
  }
}
```

**Response**:
```typescript
{
  deckName: string,
  model: 'basic' | 'cloze',
  notes: Array<{
    front?: string,      // For basic
    back?: string,       // For basic
    cloze?: string,      // For cloze ({{c1::term}} syntax)
    tags?: string[]
  }>,
  metadata: {
    modelUsed: string,   // e.g., "OpenAI (gpt-4o-mini)"
    items: number
  }
}
```

### GET /ai/models

**Response**:
```typescript
[
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'OpenAI',
    capabilities: {
      maxTokens: 16000,
      supportsJson: true
    }
  }
]
```

## Prompt Engineering

### System Prompts

**Basic Cards**:
- Produces front/back Q&A pairs
- Emphasizes concise questions (1-2 sentences)
- Focused answers (2-3 sentences)
- One concept per card

**Cloze Cards**:
- Uses Anki-compatible `{{c1::term}}` syntax
- Multiple cloze deletions per note allowed
- Keeps text concise (1-2 sentences)
- Each cloze index creates separate card

### User Prompts

**Prompt Mode**:
```
Create {itemLimit} flashcards about: {prompt}
Model: {basic|cloze}
Language hints: {hints}
Output JSON only. No additional text.
```

**Notes Mode**:
```
Convert these notes into flashcards. Identify key concepts:
{notesText}
Model: {basic|cloze}
Output JSON only. No additional text.
```

## Logging

### Backend Logs (Firebase Emulator)

All logs prefixed with `[OpenAIProvider]`:

1. **Request info**: source type, model, item limit, prompt/notes length
2. **Full system prompt**: Complete prompt sent to AI
3. **Full user prompt**: Complete user request
4. **API call status**: Success/failure
5. **Token usage**: prompt_tokens, completion_tokens, total_tokens
6. **Full AI response**: Complete JSON payload from OpenAI
7. **Sample notes**: First 3 notes with structure
8. **Parsing results**: Raw count, valid count, filtered count
9. **Individual note processing**: Each note's validation and normalization
10. **Final response**: Deck name, note count, model

### Client Logs (React Native)

All logs prefixed with `[AIDeckPreview]`:

1. **Creation start**: Deck name, note count, model
2. **Deck creation**: Deck ID and name
3. **Model ID**: Which model being used
4. **Note processing**: Each note (1/N, 2/N, etc.)
5. **Note validation**: Front/back or cloze presence
6. **Note creation**: Note ID for each created note
7. **Summary**: Total, created, skipped counts
8. **Persistence**: Save confirmation
9. **Verification**: Final card count in deck

## Setup

### Backend Setup

1. **Install dependencies**:
```bash
cd firebase/functions
npm install
```

2. **Set OpenAI API key**:
```bash
# Local development
export OPENAI_API_KEY="sk-your-key-here"

# Production
firebase functions:secrets:set OPENAI_API_KEY
```

3. **Build and run**:
```bash
npm run build
cd ..
firebase emulators:start
```

### Client Setup

Already configured! Just ensure:
- `.env.development` has `ENABLE_AI_FEATURES=true`
- App is running and connected to emulators

## Navigation Flow

```
Decks Screen
    ↓ (Tap "+" button)
AddDeckModal
    ↓ (Select "Create with AI")
AIDeckCreatorScreen
    ↓ (Enter prompt/notes, configure options)
    ↓ (Tap "Generate Deck")
AIDeckPreviewScreen
    ↓ (Review, edit, delete cards)
    ↓ (Tap "Create Deck")
DeckDetailScreen (new deck)
```

## Cost Information

**Model**: GPT-4o-mini
- Input: ~$0.15 per 1M tokens
- Output: ~$0.60 per 1M tokens

**Typical Usage**:
- 50-card deck: ~$0.0015 (less than 1 cent)
- 1000 decks: ~$1.50

## Debugging

### Missing Cards

1. **Check backend logs** for `filteredOut` count
2. **Check sample notes** for structure issues
3. **Verify field names** match expected (front/back or cloze)
4. **Check client logs** for skipped count
5. **Verify final card count** matches created count

### Common Issues

**Issue**: Cards filtered out on backend
- **Cause**: AI didn't follow JSON format
- **Check**: Full AI response payload
- **Fix**: Adjust prompts in `prompts.ts`

**Issue**: Cards skipped on client
- **Cause**: Missing required fields
- **Check**: Client validation logs
- **Fix**: Verify note structure

**Issue**: Deck not appearing
- **Cause**: Screen not refreshing
- **Fix**: Already fixed with `useFocusEffect`

## Testing

### Manual Tests

1. **Prompt Mode - Basic**: "Top 10 world capitals"
2. **Prompt Mode - Cloze**: "Basic chemistry terms"
3. **Notes Mode**: Paste study notes
4. **Large Deck**: "Top 100 Spanish verbs"
5. **Navigation**: Verify deck appears immediately

### Expected Log Output

**Success Case**:
```
[OpenAIProvider] Starting generation: { sourceType: 'prompt', noteModel: 'basic', itemLimit: 20 }
[OpenAIProvider] ========== SYSTEM PROMPT ==========
[full prompt]
[OpenAIProvider] ========== END SYSTEM PROMPT ==========
[OpenAIProvider] ========== USER PROMPT ==========
[full prompt]
[OpenAIProvider] ========== END USER PROMPT ==========
[OpenAIProvider] Calling OpenAI API...
[OpenAIProvider] API call successful
[OpenAIProvider] Token usage: { prompt_tokens: 150, completion_tokens: 800 }
[OpenAIProvider] ========== AI RESPONSE PAYLOAD ==========
[full JSON]
[OpenAIProvider] ========== END AI RESPONSE PAYLOAD ==========
[OpenAIProvider] Sample notes (first 3): [...]
[OpenAIProvider] After filtering: { originalCount: 20, validCount: 20, filteredOut: 0 }
[AIDeckPreview] Note creation summary: { total: 20, created: 20, skipped: 0 }
[AIDeckPreview] Verification - cards in deck: 20
```

## Future Enhancements

1. **Model Selection**: Let users choose GPT-4o vs GPT-4o-mini
2. **Cost Controls**: Usage quotas, rate limiting
3. **Template Library**: Pre-built prompts for common subjects
4. **Image Support**: AI-generated images for cards
5. **Audio Support**: Text-to-speech for language learning
6. **Batch Generation**: Multiple decks at once
7. **Quality Scoring**: AI rates card quality
8. **Fine-tuning**: Train on user's existing decks

## Files Summary

### Backend (3 new, 2 modified)
- ⭐ `firebase/functions/src/types/ai.ts`
- ⭐ `firebase/functions/src/services/ai/prompts.ts`
- ⭐ `firebase/functions/src/services/ai/OpenAIProvider.ts`
- ⭐ `firebase/functions/src/handlers/ai.ts`
- `firebase/functions/src/index.ts` (added routes)
- `firebase/functions/package.json` (added openai)

### Client (4 new, 4 modified)
- ⭐ `src/services/ai/types.ts`
- ⭐ `src/services/ai/AiService.ts`
- ⭐ `src/app/Decks/AIDeckCreatorScreen.tsx`
- ⭐ `src/app/Decks/AIDeckPreviewScreen.tsx`
- `src/app/Decks/components/AddDeckModal.tsx` (added AI option)
- `src/app/Decks/DecksScreen.tsx` (added useFocusEffect)
- `src/navigation/DecksStack.tsx` (added routes)
- `.env.development` (enabled AI features)

---

**Status**: ✅ Complete and production-ready with comprehensive logging
