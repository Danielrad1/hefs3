/**
 * TemplateEngine - Renders Anki card templates (qfmt/afmt) with field substitution,
 * sections, and filters to achieve parity with Anki desktop's template system.
 * 
 * Supports:
 * - Field substitution: {{FieldName}}
 * - Conditional sections: {{#Field}}...{{/Field}}, {{^Field}}...{{/Field}}
 * - FrontSide: {{FrontSide}} on back side
 * - Filters: cloze:, type:, text:, and extensible registry
 */

import { Model, AnkiNote } from './schema';
import { logger } from '../../utils/logger';

/**
 * Filter function type - transforms field content
 */
type FilterFn = (
  fieldContent: string,
  fieldName: string,
  ord: number,
  which: 'q' | 'a',
  note: AnkiNote
) => string;

/**
 * Registry of template filters
 */
const filterRegistry: Record<string, FilterFn> = {};

/**
 * Register a custom filter
 */
export function registerFilter(name: string, fn: FilterFn): void {
  filterRegistry[name.toLowerCase()] = fn;
}

/**
 * Build case-insensitive field name to content map
 */
function buildFieldMap(model: Model, note: AnkiNote): Map<string, string> {
  const fields = note.flds.split('\x1f');
  const map = new Map<string, string>();
  
  model.flds.forEach((fieldDef, index) => {
    const content = fields[index] || '';
    // Store with lowercase key for case-insensitive lookup
    map.set(fieldDef.name.toLowerCase(), content);
  });
  
  return map;
}

/**
 * Get field content by name (case-insensitive)
 */
function getField(fieldMap: Map<string, string>, fieldName: string): string {
  return fieldMap.get(fieldName.toLowerCase()) || '';
}

/**
 * Check if field is "truthy" (non-empty after HTML strip)
 */
function isTruthy(content: string): boolean {
  const stripped = content.replace(/<[^>]*>/g, '').trim();
  return stripped.length > 0;
}

/**
 * Process conditional sections {{#Field}}...{{/Field}} and {{^Field}}...{{/Field}}
 */
function processSections(template: string, fieldMap: Map<string, string>): string {
  let result = template;
  
  // Process positive sections {{#Field}}...{{/Field}}
  result = result.replace(
    /\{\{#([^}]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g,
    (match, fieldName, content) => {
      const fieldContent = getField(fieldMap, fieldName.trim());
      return isTruthy(fieldContent) ? content : '';
    }
  );
  
  // Process negative sections {{^Field}}...{{/Field}}
  result = result.replace(
    /\{\{\^([^}]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g,
    (match, fieldName, content) => {
      const fieldContent = getField(fieldMap, fieldName.trim());
      return isTruthy(fieldContent) ? '' : content;
    }
  );
  
  return result;
}

/**
 * Apply filter to field content
 */
function applyFilter(
  filterName: string,
  fieldContent: string,
  fieldName: string,
  ord: number,
  which: 'q' | 'a',
  note: AnkiNote
): string {
  const lowerFilter = filterName.toLowerCase();
  
  // Check registry first
  if (filterRegistry[lowerFilter]) {
    return filterRegistry[lowerFilter](fieldContent, fieldName, ord, which, note);
  }
  
  // Built-in filters
  switch (lowerFilter) {
    case 'text':
      // Strip HTML tags
      return fieldContent.replace(/<[^>]*>/g, '');
      
    case 'type':
      // Type answer - just return content (typing UI not implemented)
      return fieldContent;
      
    case 'cloze':
      // Cloze handling - registered separately based on model type
      // If not registered, return unchanged
      logger.warn(`[TemplateEngine] cloze filter used but not registered`);
      return fieldContent;
      
    default:
      // Unknown filter - log once and passthrough
      logger.warn(`[TemplateEngine] Unknown filter: ${filterName}, passing through content`);
      return fieldContent;
  }
}

/**
 * Substitute field references with content, handling filters
 */
function substituteFields(
  template: string,
  fieldMap: Map<string, string>,
  ord: number,
  which: 'q' | 'a',
  note: AnkiNote
): string {
  // Match {{filter:Field}} or {{Field}}
  return template.replace(
    /\{\{([^}]+)\}\}/g,
    (match, content) => {
      const trimmed = content.trim();
      
      // Skip {{FrontSide}} - handled separately after rendering
      if (trimmed === 'FrontSide') {
        return match; // Return as-is, will be replaced later
      }
      
      const parts = content.split(':');
      
      if (parts.length === 2) {
        // Has filter: {{filter:FieldName}}
        const [filterName, fieldName] = parts.map((p: string) => p.trim());
        const fieldContent = getField(fieldMap, fieldName);
        return applyFilter(filterName, fieldContent, fieldName, ord, which, note);
      } else if (parts.length === 1) {
        // No filter: {{FieldName}}
        const fieldName = parts[0].trim();
        return getField(fieldMap, fieldName);
      }
      
      // Multiple colons or invalid - return as-is
      return match;
    }
  );
}

/**
 * Register cloze filter for cloze-type models
 */
function registerClozeFilter(): void {
  registerFilter('cloze', (fieldContent, fieldName, ord, which, note) => {
    // Cloze deletion handling
    // Format: {{c1::text}} or {{c1::text::hint}}
    // On front (q): replace active cloze with [...]
    // On back (a): show all cloze deletions as plain text
    
    const clozeIndex = ord + 1; // Anki uses 1-indexed cloze
    
    if (which === 'q') {
      // Front side: hide active cloze
      return fieldContent.replace(
        /\{\{c(\d+)::([^:}]+)(?:::([^}]+))?\}\}/g,
        (match, index, text, hint) => {
          const cNum = parseInt(index, 10);
          if (cNum === clozeIndex) {
            // Active cloze - show as [...]
            return hint ? `[${hint}]` : '[...]';
          }
          // Inactive cloze - show as plain text
          return text;
        }
      );
    } else {
      // Back side: show all cloze as plain text
      return fieldContent.replace(
        /\{\{c\d+::([^:}]+)(?:::([^}]+))?\}\}/g,
        (match, text) => text
      );
    }
  });
}

/**
 * Render a card template to HTML
 */
export function render(
  model: Model,
  note: AnkiNote,
  ord: number,
  which: 'q' | 'a'
): { front: string; back: string } {
  // Ensure cloze filter is registered for cloze models
  if (model.type === 1 && !filterRegistry['cloze']) {
    registerClozeFilter();
  }
  
  const fieldMap = buildFieldMap(model, note);
  const template = model.tmpls[ord];
  
  if (!template) {
    logger.error(`[TemplateEngine] No template at ord ${ord} for model ${model.id}`);
    // Fallback to first two fields
    const fields = note.flds.split('\x1f');
    return {
      front: fields[0] || '',
      back: fields[1] || '',
    };
  }
  
  // Render front (question)
  const processedQfmt = processSections(template.qfmt, fieldMap);
  const front = substituteFields(processedQfmt, fieldMap, ord, 'q', note);
  
  // Render back (answer)
  let processedAfmt = processSections(template.afmt, fieldMap);
  let back = substituteFields(processedAfmt, fieldMap, ord, 'a', note);
  
  // Handle {{FrontSide}} - only valid on back
  back = back.replace(/\{\{FrontSide\}\}/g, front);
  
  return { front, back };
}

/**
 * Render just the front of a card
 */
export function renderFront(model: Model, note: AnkiNote, ord: number): string {
  return render(model, note, ord, 'q').front;
}

/**
 * Render just the back of a card
 */
export function renderBack(model: Model, note: AnkiNote, ord: number): string {
  return render(model, note, ord, 'a').back;
}
