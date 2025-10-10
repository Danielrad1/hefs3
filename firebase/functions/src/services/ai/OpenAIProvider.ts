import OpenAI from 'openai';
import { AIProvider, GenerateDeckRequest, GenerateDeckResponse, GeneratedNote } from '../../types/ai';
import { getSystemPrompt, buildUserPrompt } from './prompts';
import { AI_CONFIG } from '../../config/ai';

/**
 * OpenAI provider for deck generation
 */
export class OpenAIProvider implements AIProvider {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string = AI_CONFIG.defaultModel) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
    console.log(`[OpenAIProvider] Initialized with model: ${this.model}`);
  }

  getName(): string {
    return `OpenAI (${this.model})`;
  }

  async generateDeck(request: GenerateDeckRequest): Promise<GenerateDeckResponse> {
    console.log('[OpenAIProvider] Starting generation:', {
      sourceType: request.sourceType,
      noteModel: request.noteModel,
      itemLimit: request.itemLimit,
      promptLength: request.prompt?.length,
      notesLength: request.notesText?.length,
    });

    const systemPrompt = getSystemPrompt(request.noteModel);
    const userPrompt = buildUserPrompt({
      sourceType: request.sourceType,
      prompt: request.prompt,
      notesText: request.notesText,
      noteModel: request.noteModel,
      itemLimit: request.itemLimit,
      languageHints: request.languageHints,
      style: request.style,
    });

    console.log('[OpenAIProvider] System prompt length:', systemPrompt.length);
    console.log('[OpenAIProvider] User prompt length:', userPrompt.length);
    
    // Log full prompts for debugging
    console.log('[OpenAIProvider] ========== SYSTEM PROMPT ==========');
    console.log(systemPrompt);
    console.log('[OpenAIProvider] ========== END SYSTEM PROMPT ==========');
    
    console.log('[OpenAIProvider] ========== USER PROMPT ==========');
    console.log(userPrompt);
    console.log('[OpenAIProvider] ========== END USER PROMPT ==========');

    try {
      console.log('[OpenAIProvider] Calling OpenAI API...');
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        // Note: GPT-5 Nano only supports default temperature (1)
        // temperature: 0.7, // Removed for GPT-5 Nano compatibility
      });

      console.log('[OpenAIProvider] API call successful');
      
      // Calculate cost based on token usage
      const usage = completion.usage;
      if (usage) {
        const modelConfig = AI_CONFIG.models.find(m => m.id === this.model);
        if (modelConfig) {
          const inputCost = (usage.prompt_tokens / 1_000_000) * modelConfig.pricing.inputPer1M;
          const outputCost = (usage.completion_tokens / 1_000_000) * modelConfig.pricing.outputPer1M;
          const totalCost = inputCost + outputCost;
          
          console.log('[OpenAIProvider] ========== TOKEN USAGE & COST ==========');
          console.log(`[OpenAIProvider] Model: ${modelConfig.name} (${this.model})`);
          console.log(`[OpenAIProvider] Input tokens: ${usage.prompt_tokens.toLocaleString()}`);
          console.log(`[OpenAIProvider] Output tokens: ${usage.completion_tokens.toLocaleString()}`);
          console.log(`[OpenAIProvider] Total tokens: ${usage.total_tokens.toLocaleString()}`);
          console.log(`[OpenAIProvider] Input cost: $${inputCost.toFixed(6)} (${usage.prompt_tokens.toLocaleString()} tokens @ $${modelConfig.pricing.inputPer1M}/1M)`);
          console.log(`[OpenAIProvider] Output cost: $${outputCost.toFixed(6)} (${usage.completion_tokens.toLocaleString()} tokens @ $${modelConfig.pricing.outputPer1M}/1M)`);
          console.log(`[OpenAIProvider] TOTAL COST: $${totalCost.toFixed(6)}`);
          console.log('[OpenAIProvider] ========================================');
        } else {
          console.log('[OpenAIProvider] Token usage:', usage);
        }
      }

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from AI provider');
      }

      console.log('[OpenAIProvider] Response length:', content.length);
      
      // Log full AI response payload
      console.log('[OpenAIProvider] ========== AI RESPONSE PAYLOAD ==========');
      console.log(content);
      console.log('[OpenAIProvider] ========== END AI RESPONSE PAYLOAD ==========');
      
      const parsed = JSON.parse(content);
      console.log('[OpenAIProvider] Parsed response:', {
        hasDeckName: !!parsed.deckName,
        deckName: parsed.deckName,
        notesCount: parsed.notes?.length || 0,
      });
      
      // Log first 3 notes as samples
      if (parsed.notes && parsed.notes.length > 0) {
        console.log('[OpenAIProvider] Sample notes (first 3):');
        parsed.notes.slice(0, 3).forEach((note: any, i: number) => {
          console.log(`[OpenAIProvider] Note ${i}:`, JSON.stringify(note, null, 2));
        });
      }

      const response = this.parseResponse(parsed, request);
      console.log('[OpenAIProvider] Final response:', {
        deckName: response.deckName,
        notesCount: response.notes.length,
        model: response.model,
      });

      return response;
    } catch (error) {
      console.error('[OpenAIProvider] Generation failed:', error);
      throw new Error(`AI generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private parseResponse(parsed: any, request: GenerateDeckRequest): GenerateDeckResponse {
    console.log('[OpenAIProvider] Parsing response, raw notes count:', parsed.notes?.length || 0);
    if (!parsed.notes || !Array.isArray(parsed.notes)) {
      throw new Error('Invalid response: missing or invalid notes array');
    }

    // Validate and normalize notes
    const notes: GeneratedNote[] = parsed.notes
      .filter((note: any, index: number) => {
        const isValid = request.noteModel === 'basic' 
          ? (note.front && note.back)
          : (note.cloze && note.cloze.includes('{{c'));
        
        if (!isValid) {
          console.log(`[OpenAIProvider] Filtered out invalid note at index ${index}:`, note);
        }
        return isValid;
      })
      .map((note: any, index: number) => {
        const normalized: GeneratedNote = {};
        
        if (request.noteModel === 'basic') {
          normalized.front = String(note.front).trim();
          normalized.back = String(note.back).trim();
          console.log(`[OpenAIProvider] Normalized basic note ${index}:`, {
            frontLength: normalized.front.length,
            backLength: normalized.back.length,
          });
        } else {
          normalized.cloze = String(note.cloze).trim();
          console.log(`[OpenAIProvider] Normalized cloze note ${index}:`, {
            clozeLength: normalized.cloze.length,
          });
        }

        if (note.tags && Array.isArray(note.tags)) {
          normalized.tags = note.tags.map((t: any) => String(t).trim()).filter(Boolean);
        }

        return normalized;
      });

    console.log('[OpenAIProvider] After filtering and normalization:', {
      originalCount: parsed.notes.length,
      validCount: notes.length,
      filteredOut: parsed.notes.length - notes.length,
    });

    if (notes.length === 0) {
      throw new Error('No valid notes generated');
    }

    // Generate deck name if not provided
    let deckName = parsed.deckName || request.deckName;
    if (!deckName) {
      if (request.sourceType === 'prompt') {
        deckName = request.prompt?.substring(0, 50) || 'AI Generated Deck';
      } else {
        deckName = 'AI Generated Deck';
      }
    }

    return {
      deckName: deckName.trim(),
      model: request.noteModel,
      notes,
      metadata: {
        modelUsed: this.getName(),
        items: notes.length,
      },
    };
  }
}
