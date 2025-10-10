# AI Deck Generation - Quick Reference

## 🚀 Quick Start

```bash
# 1. Get API key: https://platform.openai.com/api-keys
# 2. Start backend:
export OPENAI_API_KEY="sk-your-key"
cd firebase && firebase emulators:start

# 3. Start app (new terminal):
npm start

# 4. Test: Decks → "+" → "Create with AI"
```

## 📁 Architecture

**Backend**: `firebase/functions/src/`
- `types/ai.ts` - Request/response schemas
- `services/ai/prompts.ts` - AI prompt templates
- `services/ai/OpenAIProvider.ts` - OpenAI integration
- `handlers/ai.ts` - API endpoints

**Client**: `src/`
- `services/ai/AiService.ts` - API client
- `app/Decks/AIDeckCreatorScreen.tsx` - Input UI
- `app/Decks/AIDeckPreviewScreen.tsx` - Preview/edit UI

## 🔌 API Endpoints

**POST /ai/deck/generate**
```typescript
Request: {
  sourceType: 'prompt' | 'notes',
  prompt?: string,
  notesText?: string,
  noteModel: 'basic' | 'cloze',
  itemLimit?: number  // 1-1000, default 50
}

Response: {
  deckName: string,
  model: 'basic' | 'cloze',
  notes: Array<{ front?, back?, cloze?, tags? }>,
  metadata: { modelUsed, items }
}
```

## 🐛 Debugging

**Check logs for**:
- `[OpenAIProvider]` - Backend processing
- `[AIDeckPreview]` - Client-side creation
- Full prompts and AI responses logged
- Filtering/validation counts

**Common issues**:
- `filteredOut > 0` - AI format issues, check prompts
- `skipped > 0` - Missing fields, check validation
- Deck not showing - Fixed with auto-refresh

## 💰 Cost

GPT-5 Nano: ~$0.0011 per 50 cards (< 1 cent)
- Fastest, most cost-efficient GPT-5 model
- 400K context window, 128K max output

## 🔧 Change Model

Edit `firebase/functions/src/config/ai.ts`:
```typescript
defaultModel: 'gpt-5-nano-2025-08-07'
```

## 📖 Full Docs

See `AI_FEATURE_DOCS.md` for complete documentation.
