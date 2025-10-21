import OpenAI from 'openai';
import { AIProvider, GenerateDeckRequest, GenerateDeckResponse, GeneratedNote, GenerateHintsRequest, GenerateHintsResponse, HintsOutputItem } from '../../types/ai';
import { getSystemPrompt, buildUserPrompt } from './prompts';
import { getHintsSystemPrompt, buildHintsUserPrompt } from './prompts.hints';
import { AI_CONFIG } from '../../config/ai';
import { logger } from '../../utils/logger';

/**
 * OpenAI provider for deck generation
 */
export class OpenAIProvider implements AIProvider {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string = AI_CONFIG.defaultModel) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
    logger.info(`[OpenAIProvider] Initialized with model: ${this.model}`);
  }

  getName(): string {
    return `OpenAI (${this.model})`;
  }

  async generateDeck(request: GenerateDeckRequest): Promise<GenerateDeckResponse> {
    logger.info('[OpenAIProvider] Starting generation:', {
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

    logger.debug('[OpenAIProvider] System prompt length:', systemPrompt.length);
    logger.debug('[OpenAIProvider] User prompt length:', userPrompt.length);
    
    // Estimate token count (rough approximation: 1 token ≈ 4 characters)
    const estimatedTokens = Math.ceil((systemPrompt.length + userPrompt.length) / 4);
    const modelConfig = AI_CONFIG.models.find(m => m.id === this.model);
    const maxTokens = modelConfig?.capabilities.maxTokens || 128000;
    
    logger.info('[OpenAIProvider] Estimated input tokens:', estimatedTokens.toLocaleString());
    logger.info('[OpenAIProvider] Model max tokens:', maxTokens.toLocaleString());
    
    // Check if input is too large (leaving room for output)
    const maxInputTokens = maxTokens * 0.90; // Reserve 10% for output (~40k tokens for GPT-5)
    if (estimatedTokens > maxInputTokens) {
      throw new Error(
        `Input is too large. Estimated ${estimatedTokens.toLocaleString()} tokens, ` +
        `but model limit is ${maxTokens.toLocaleString()} tokens (allowing ${maxInputTokens.toLocaleString()} for input). ` +
        `Try reducing the amount of text or splitting it into multiple decks.`
      );
    }
    
    // NEVER log full prompts in production (contains user content)
    logger.debug('[OpenAIProvider] ========== SYSTEM PROMPT ==========');
    logger.debug(systemPrompt);
    logger.debug('[OpenAIProvider] ========== END SYSTEM PROMPT ==========');
    
    logger.debug('[OpenAIProvider] ========== USER PROMPT ==========');
    logger.debug(userPrompt);
    logger.debug('[OpenAIProvider] ========== END USER PROMPT ==========');

    try {
      logger.info('[OpenAIProvider] Calling OpenAI API...');
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

      logger.info('[OpenAIProvider] API call successful');
      
      // Calculate cost based on token usage
      const usage = completion.usage;
      if (usage) {
        const modelConfig = AI_CONFIG.models.find(m => m.id === this.model);
        if (modelConfig) {
          const inputCost = (usage.prompt_tokens / 1_000_000) * modelConfig.pricing.inputPer1M;
          const outputCost = (usage.completion_tokens / 1_000_000) * modelConfig.pricing.outputPer1M;
          const totalCost = inputCost + outputCost;
          
          logger.info('[OpenAIProvider] ========== TOKEN USAGE & COST ==========');
          logger.info(`[OpenAIProvider] Model: ${modelConfig.name} (${this.model})`);
          logger.info(`[OpenAIProvider] Input tokens: ${usage.prompt_tokens.toLocaleString()}`);
          logger.info(`[OpenAIProvider] Output tokens: ${usage.completion_tokens.toLocaleString()}`);
          logger.info(`[OpenAIProvider] Total tokens: ${usage.total_tokens.toLocaleString()}`);
          logger.info(`[OpenAIProvider] Input cost: $${inputCost.toFixed(6)} (${usage.prompt_tokens.toLocaleString()} tokens @ $${modelConfig.pricing.inputPer1M}/1M)`);
          logger.info(`[OpenAIProvider] Output cost: $${outputCost.toFixed(6)} (${usage.completion_tokens.toLocaleString()} tokens @ $${modelConfig.pricing.outputPer1M}/1M)`);
          logger.info(`[OpenAIProvider] TOTAL COST: $${totalCost.toFixed(6)}`);
          logger.info('[OpenAIProvider] ========================================');
        } else {
          logger.info('[OpenAIProvider] Token usage:', usage);
        }
      }

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from AI provider');
      }

      logger.debug('[OpenAIProvider] Response length:', content.length);
      
      // NEVER log full AI response in production (contains user content)
      logger.debug('[OpenAIProvider] ========== AI RESPONSE PAYLOAD ==========');
      logger.debug(content);
      logger.debug('[OpenAIProvider] ========== END AI RESPONSE PAYLOAD ==========');
      
      const parsed = JSON.parse(content);
      const actualCount = parsed.notes?.length || 0;
      const requestedCount = request.itemLimit;
      
      logger.info('[OpenAIProvider] Parsed response:', {
        hasDeckName: !!parsed.deckName,
        deckName: parsed.deckName,
        notesCount: actualCount,
        requestedCount: requestedCount,
      });
      
      // Log card count mismatch but don't reject
      if (actualCount !== requestedCount) {
        logger.warn(`[OpenAIProvider] ⚠️ Card count mismatch! Requested: ${requestedCount}, Got: ${actualCount}`);
        logger.warn(`[OpenAIProvider] Accepting response anyway (validation disabled)`);
      }
      
      // Log first 3 notes as samples (debug only - contains user content)
      if (parsed.notes && parsed.notes.length > 0) {
        logger.debug('[OpenAIProvider] Sample notes (first 3):');
        parsed.notes.slice(0, 3).forEach((note: any, i: number) => {
          logger.debug(`[OpenAIProvider] Note ${i}:`, JSON.stringify(note, null, 2));
        });
      }

      const response = this.parseResponse(parsed, request);
      logger.info('[OpenAIProvider] Final response:', {
        deckName: response.deckName,
        notesCount: response.notes.length,
        model: response.model,
      });

      return response;
    } catch (error) {
      logger.error('[OpenAIProvider] Generation failed:', error);
      
      // Handle specific OpenAI errors
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        
        // Token limit errors
        if (errorMessage.includes('maximum context length') || 
            errorMessage.includes('token limit') ||
            errorMessage.includes('context_length_exceeded')) {
          const modelConfig = AI_CONFIG.models.find(m => m.id === this.model);
          const maxTokens = modelConfig?.capabilities.maxTokens || 'unknown';
          throw new Error(
            `Input is too large. Your text exceeds the model's token limit of ${maxTokens.toLocaleString()} tokens. ` +
            `Try reducing the amount of text or splitting it into multiple decks.`
          );
        }
        
        // Rate limit errors
        if (errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
          throw new Error(
            'API rate limit exceeded. Please wait a moment and try again.'
          );
        }
        
        // Invalid API key
        if (errorMessage.includes('api key') || errorMessage.includes('unauthorized')) {
          throw new Error(
            'Invalid API key. Please check your OpenAI API key configuration.'
          );
        }
        
        throw new Error(`AI generation failed: ${error.message}`);
      }
      
      throw new Error('AI generation failed: Unknown error');
    }
  }

  async generateHints(request: GenerateHintsRequest): Promise<GenerateHintsResponse> {
    logger.info('[OpenAIProvider] Starting hints generation:', {
      itemsCount: request.items.length,
      deckName: request.options?.deckName,
      style: request.options?.style,
    });

    // Group items by model type for consistent prompts
    const basicItems = request.items.filter(item => item.model === 'basic');
    const clozeItems = request.items.filter(item => item.model === 'cloze');

    const allResults: HintsOutputItem[] = [];

    // Process basic cards in parallel batches
    if (basicItems.length > 0) {
      const results = await this.generateHintsParallel(basicItems, 'basic', request.options);
      allResults.push(...results);
    }

    // Process cloze cards in parallel batches
    if (clozeItems.length > 0) {
      const results = await this.generateHintsParallel(clozeItems, 'cloze', request.options);
      allResults.push(...results);
    }

    logger.info('[OpenAIProvider] Hints generation complete:', {
      totalRequested: request.items.length,
      successfulResults: allResults.length,
    });

    return {
      items: allResults,
      metadata: {
        modelUsed: this.getName(),
        totalItems: request.items.length,
        successfulItems: allResults.length,
      },
    };
  }

  /**
   * Process hints generation in parallel batches
   * Splits items into batches of 10 and processes them concurrently
   */
  private async generateHintsParallel(
    items: Array<{ id: string; model: 'basic' | 'cloze'; front?: string; back?: string; cloze?: string; tags?: string[]; context?: string }>,
    noteModel: 'basic' | 'cloze',
    options?: any // Accept all HintsOptions
  ): Promise<HintsOutputItem[]> {
    const BATCH_SIZE = 10;
    const batches: Array<typeof items> = [];
    
    // Split into batches of 10
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      batches.push(items.slice(i, i + BATCH_SIZE));
    }

    logger.info(`[OpenAIProvider] Processing ${items.length} items in ${batches.length} parallel batches of ${BATCH_SIZE}`);

    // Process all batches in parallel using Promise.all
    const startTime = Date.now();
    const batchPromises = batches.map((batch, index) => 
      this.generateHintsForBatch(batch, noteModel, options)
        .then(results => {
          logger.info(`[OpenAIProvider] Batch ${index + 1}/${batches.length} complete (${results.length} items)`);
          return results;
        })
        .catch(error => {
          logger.error(`[OpenAIProvider] Batch ${index + 1}/${batches.length} failed:`, error);
          // Return empty array on error to not block other batches
          return [];
        })
    );

    // Wait for all batches to complete
    const batchResults = await Promise.all(batchPromises);
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);

    // Flatten results from all batches
    const allResults = batchResults.flat();

    logger.info(`[OpenAIProvider] Parallel processing complete in ${elapsedTime}s:`, {
      totalBatches: batches.length,
      totalItems: items.length,
      successfulItems: allResults.length,
      failedItems: items.length - allResults.length,
    });

    return allResults;
  }

  private async generateHintsForBatch(
    items: Array<{ id: string; model: 'basic' | 'cloze'; front?: string; back?: string; cloze?: string; tags?: string[]; context?: string }>,
    noteModel: 'basic' | 'cloze',
    options?: any // Accept all HintsOptions
  ): Promise<HintsOutputItem[]> {
    const systemPrompt = getHintsSystemPrompt(noteModel);
    
    // Strip unnecessary fields to reduce prompt size
    const strippedItems = items.map(item => ({
      id: item.id,
      model: item.model,
      ...(item.front && { front: item.front }),
      ...(item.back && { back: item.back }),
      ...(item.cloze && { cloze: item.cloze }),
    }));
    
    // All instructions are in system prompt (cached), user prompt is just card data
    const userPrompt = buildHintsUserPrompt({
      items: strippedItems,
      deckName: options?.deckName,
      languageHints: options?.languageHints,
    });

    logger.debug('[OpenAIProvider] Hints system prompt length:', systemPrompt.length);
    logger.debug('[OpenAIProvider] Hints user prompt length:', userPrompt.length);
    logger.debug('[OpenAIProvider] ===== SYSTEM PROMPT =====');
    logger.debug(systemPrompt);
    logger.debug('[OpenAIProvider] ===== USER PROMPT =====');
    logger.debug(userPrompt);
    logger.debug('[OpenAIProvider] ===== END PROMPTS =====');

    try {
      logger.info('[OpenAIProvider] Calling OpenAI API for hints...');
      logger.info('[OpenAIProvider] Model:', this.model);
      logger.info('[OpenAIProvider] API base URL:', (this.client as any).baseURL);
      
      logger.info('[OpenAIProvider] Request params:', {
        model: this.model,
        systemPromptLength: systemPrompt.length,
        userPromptLength: userPrompt.length,
        responseFormat: 'json_object',
      });
      
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        // Note: GPT-5 Nano only supports default temperature (1)
      });

      logger.info('[OpenAIProvider] Hints API call successful');

      // Log token usage
      const usage = completion.usage;
      if (usage) {
        const modelConfig = AI_CONFIG.models.find(m => m.id === this.model);
        if (modelConfig) {
          const inputCost = (usage.prompt_tokens / 1_000_000) * modelConfig.pricing.inputPer1M;
          const outputCost = (usage.completion_tokens / 1_000_000) * modelConfig.pricing.outputPer1M;
          const totalCost = inputCost + outputCost;
          
          logger.info('[OpenAIProvider] Hints token usage:', {
            input: usage.prompt_tokens,
            output: usage.completion_tokens,
            total: usage.total_tokens,
            cost: `$${totalCost.toFixed(6)}`,
          });
        }
      }

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from AI provider');
      }

      logger.debug('[OpenAIProvider] Raw AI response (first 500 chars):', content.substring(0, 500));

      const parsed = JSON.parse(content);
      logger.info('[OpenAIProvider] Hints response parsed:', {
        itemsCount: parsed.items?.length || 0,
        requestedCount: items.length,
      });

      return this.parseHintsResponse(parsed, items, content);
    } catch (error: any) {
      logger.error('[OpenAIProvider] Hints generation failed:', error);
      logger.error('[OpenAIProvider] Error type:', error?.constructor?.name);
      logger.error('[OpenAIProvider] Error message:', error instanceof Error ? error.message : String(error));
      
      if (error instanceof Error) {
        throw new Error(`Hints generation failed: ${error.message}`);
      }
      
      throw new Error('Hints generation failed: Unknown error');
    }
  }

  private parseHintsResponse(
    parsed: any,
    requestedItems: Array<{ id: string }>,
    rawContent?: string
  ): HintsOutputItem[] {
    if (!parsed.items || !Array.isArray(parsed.items)) {
      throw new Error('Invalid response: missing or invalid items array');
    }

    const results: HintsOutputItem[] = [];
    const requestedIds = new Set(requestedItems.map(i => i.id));

    for (const item of parsed.items) {
      // Validate structure
      if (!item.id || !requestedIds.has(item.id)) {
        logger.warn('[OpenAIProvider] Skipping item with invalid/unknown ID:', item.id);
        continue;
      }

      // Extract all 3 hint levels (HTML formatted)
      const hintL1 = String(item.hintL1 || '').trim();
      const hintL2 = String(item.hintL2 || '').trim();
      const hintL3 = String(item.hintL3 || '').trim();
      const tip = String(item.tip || '').trim();
      const obstacle = item.obstacle || 'mechanism'; // Default to mechanism if not provided

      // Log warnings but accept all items
      if (!hintL1 || !hintL2 || !hintL3) {
        logger.warn('[OpenAIProvider] Missing hint levels for', item.id, {
          hasL1: !!hintL1,
          hasL2: !!hintL2,
          hasL3: !!hintL3,
          hasTip: !!tip,
          obstacle,
          hasError: !!item.error,
          errorMessage: item.error,
          rawItem: JSON.stringify(item).substring(0, 200),
        });
        // Continue processing - accept incomplete items
      }

      if (hintL1.length > 180 || hintL2.length > 180 || hintL3.length > 180) {
        logger.warn('[OpenAIProvider] Hint length exceeds limit for', item.id, {
          l1Length: hintL1.length,
          l2Length: hintL2.length,
          l3Length: hintL3.length,
        });
        // Continue processing - accept long hints
      }

      if (!tip) {
        logger.warn('[OpenAIProvider] Missing tip for', item.id);
        // Continue processing - accept missing tip
      } else if (tip.length > 320) {
        logger.warn('[OpenAIProvider] Tip length exceeds limit for', item.id, {
          tipLength: tip.length,
        });
        // Continue processing - accept long tips
      }

      results.push({
        id: item.id,
        hintL1,
        hintL2,
        hintL3,
        tip,
        obstacle,
        metadata: item.metadata,
      });
    }

    const missingIds = requestedItems
      .map(r => r.id)
      .filter(id => !results.find(r => r.id === id));

    logger.info('[OpenAIProvider] Parsed hints results:', {
      requested: requestedItems.length,
      received: parsed.items.length,
      valid: results.length,
      missing: missingIds.length,
      missingIds: missingIds.length > 0 ? missingIds : undefined,
    });

    if (missingIds.length > 0 && rawContent) {
      logger.debug('[OpenAIProvider] Checking raw content for missing IDs...');
      missingIds.forEach(id => {
        const inRawContent = rawContent.includes(`"id":"${id}"`);
        logger.debug(`  ${id}: ${inRawContent ? 'PRESENT in raw response' : 'NOT in raw response'}`);
      });
    }

    return results;
  }

  private parseResponse(parsed: any, request: GenerateDeckRequest): GenerateDeckResponse {
    logger.debug('[OpenAIProvider] Parsing response, raw notes count:', parsed.notes?.length || 0);
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
          logger.debug(`[OpenAIProvider] Filtered out invalid note at index ${index}:`, note);
        }
        return isValid;
      })
      .map((note: any, index: number) => {
        const normalized: GeneratedNote = {};
        
        if (request.noteModel === 'basic') {
          normalized.front = String(note.front).trim();
          normalized.back = String(note.back).trim();
          logger.debug(`[OpenAIProvider] Normalized basic note ${index}:`, {
            frontLength: normalized.front.length,
            backLength: normalized.back.length,
          });
        } else {
          normalized.cloze = String(note.cloze).trim();
          logger.debug(`[OpenAIProvider] Normalized cloze note ${index}:`, {
            clozeLength: normalized.cloze.length,
          });
        }

        if (note.tags && Array.isArray(note.tags)) {
          normalized.tags = note.tags.map((t: any) => String(t).trim()).filter(Boolean);
        }

        return normalized;
      });

    logger.info('[OpenAIProvider] After filtering and normalization:', {
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
