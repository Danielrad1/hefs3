/**
 * Sanitization utilities for hints generation
 * Strips HTML, validates content, and prepares clean text for AI
 */

import { logger } from '../../utils/logger';

export interface SanitizedItem {
  id: string;
  model: 'basic' | 'cloze';
  front?: string;
  back?: string;
  cloze?: string;
}

export interface SkippedItem {
  id: string;
  reason: 'image-only-answer' | 'no-cloze-mask' | 'empty-content' | 'invalid-html';
}

export interface SanitizationResult {
  valid: SanitizedItem[];
  skipped: SkippedItem[];
}

/**
 * Strip HTML tags and decode entities
 */
function stripHtml(html: string): string {
  if (!html) return '';
  
  // Remove HTML tags
  let text = html.replace(/<[^>]*>/g, ' ');
  
  // Decode common HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
  
  // Collapse multiple spaces
  text = text.replace(/\s+/g, ' ').trim();
  
  return text;
}

/**
 * Check if text is meaningful (not just image references or empty)
 */
function hasSubstantiveText(text: string): boolean {
  if (!text || text.trim().length === 0) return false;
  
  // Check if it's just image references
  const lowerText = text.toLowerCase();
  const imageOnlyPatterns = [
    /^\s*\[img\]/i,
    /^\s*\[image\]/i,
    /^\s*<img/i,
    /^\s*\[sound:/i,
  ];
  
  if (imageOnlyPatterns.some(pattern => pattern.test(text))) {
    return false;
  }
  
  // Must have at least 3 characters of actual text
  const textOnly = text.replace(/[^a-zA-Z0-9]/g, '');
  return textOnly.length >= 3;
}

/**
 * Validate cloze format
 */
function hasValidClozeMask(cloze: string): boolean {
  if (!cloze) return false;
  
  // Check for {{c1::...}} pattern
  return /\{\{c\d+::[^}]+\}\}/.test(cloze);
}

/**
 * Sanitize and validate items for hints generation
 */
export function sanitizeHintsInput(
  items: Array<{
    id: string;
    model: 'basic' | 'cloze';
    front?: string;
    back?: string;
    cloze?: string;
  }>
): SanitizationResult {
  const valid: SanitizedItem[] = [];
  const skipped: SkippedItem[] = [];
  
  for (const item of items) {
    try {
      if (item.model === 'basic') {
        // Sanitize basic card
        const front = stripHtml(item.front || '');
        const back = stripHtml(item.back || '');
        
        // Skip if no substantive content
        if (!hasSubstantiveText(front) || !hasSubstantiveText(back)) {
          skipped.push({
            id: item.id,
            reason: 'empty-content',
          });
          continue;
        }
        
        // Skip if back is image-only
        if (!hasSubstantiveText(back)) {
          skipped.push({
            id: item.id,
            reason: 'image-only-answer',
          });
          continue;
        }
        
        valid.push({
          id: item.id,
          model: 'basic',
          front,
          back,
        });
      } else {
        // Sanitize cloze card
        const cloze = stripHtml(item.cloze || '');
        
        // Skip if no cloze mask
        if (!hasValidClozeMask(cloze)) {
          skipped.push({
            id: item.id,
            reason: 'no-cloze-mask',
          });
          continue;
        }
        
        // Skip if empty
        if (!hasSubstantiveText(cloze)) {
          skipped.push({
            id: item.id,
            reason: 'empty-content',
          });
          continue;
        }
        
        valid.push({
          id: item.id,
          model: 'cloze',
          cloze,
        });
      }
    } catch (error) {
      logger.error('[HintsSanitizer] Error sanitizing item:', item.id, error);
      skipped.push({
        id: item.id,
        reason: 'invalid-html',
      });
    }
  }
  
  logger.info('[HintsSanitizer] Sanitization complete:', {
    total: items.length,
    valid: valid.length,
    skipped: skipped.length,
  });
  
  if (skipped.length > 0) {
    logger.info('[HintsSanitizer] Skipped items:', skipped);
  }
  
  return { valid, skipped };
}

/**
 * Get human-readable skip reason
 */
export function getSkipReasonMessage(reason: SkippedItem['reason']): string {
  switch (reason) {
    case 'image-only-answer':
      return 'Answer contains only images - needs text';
    case 'no-cloze-mask':
      return 'Missing cloze deletion ({{c1::...}})';
    case 'empty-content':
      return 'Card has no substantive text content';
    case 'invalid-html':
      return 'Failed to parse card content';
    default:
      return 'Unable to process this card';
  }
}
