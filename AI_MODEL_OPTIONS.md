# AI Model Options for Deck Generation

## Current Model: `gpt-4o-mini` ⚡

**Speed:** Fast (2-5 seconds for 50 cards)  
**Cost:** $0.15 per 1M input tokens, $0.60 per 1M output tokens  
**Quality:** Excellent for flashcard generation

---

## Available Models (Ranked by Speed)

### 1. **GPT-4o Mini** ⚡⚡⚡ (CURRENT - RECOMMENDED)
- **Model ID:** `gpt-4o-mini`
- **Speed:** Very Fast
- **Cost:** Very Low ($0.15/$0.60 per 1M tokens)
- **Quality:** Excellent for flashcards
- **Best For:** Fast, cost-effective deck generation

### 2. **GPT-5 Nano** ⚡⚡⚡
- **Model ID:** `gpt-5-nano-2025-08-07`
- **Speed:** Fastest
- **Cost:** Lowest ($0.05/$0.40 per 1M tokens)
- **Quality:** Good for simple flashcards
- **Best For:** Maximum speed and cost savings
- **Note:** May be less creative than GPT-4o-mini

### 3. **GPT-5 Mini** ⚡⚡
- **Model ID:** `gpt-5-mini`
- **Speed:** Fast
- **Cost:** Low ($0.25/$2.00 per 1M tokens)
- **Quality:** Better reasoning than Nano
- **Best For:** Balanced performance

### 4. **GPT-4o** ⚡
- **Model ID:** `gpt-4o`
- **Speed:** Moderate (10-15 seconds for 50 cards)
- **Cost:** High ($2.50/$10.00 per 1M tokens)
- **Quality:** Very high quality
- **Best For:** Complex topics requiring nuance

### 5. **GPT-5** 🐢
- **Model ID:** `gpt-5`
- **Speed:** Slow (15-30 seconds for 50 cards)
- **Cost:** Highest ($1.25/$5.00 per 1M tokens)
- **Quality:** Best reasoning and creativity
- **Best For:** Maximum quality, complex subjects

---

## How to Change Models

Edit `/firebase/functions/src/config/ai.ts`:

```typescript
export const AI_CONFIG = {
  defaultModel: 'gpt-4o-mini', // Change this line
  // ...
}
```

Then rebuild:
```bash
cd firebase/functions
npm run build
```

The emulator will auto-reload.

---

## Speed Comparison (50 cards)

| Model | Typical Time | Cost per 50 cards |
|-------|-------------|-------------------|
| GPT-5 Nano | 2-4 sec | ~$0.001 |
| GPT-4o Mini | 2-5 sec | ~$0.002 |
| GPT-5 Mini | 3-6 sec | ~$0.005 |
| GPT-4o | 10-15 sec | ~$0.015 |
| GPT-5 | 15-30 sec | ~$0.010 |

---

## Recommendations by Use Case

**Fast Prototyping:** `gpt-5-nano` or `gpt-4o-mini`  
**Production (Balanced):** `gpt-4o-mini` ✅ (current)  
**High Quality:** `gpt-4o` or `gpt-5`  
**Cost Optimization:** `gpt-5-nano`  
**Medical/Legal/Complex:** `gpt-5`
