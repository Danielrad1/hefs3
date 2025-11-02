/**
 * Add-On Profile Registry
 * 
 * Provides a framework for detecting and handling different Anki add-ons
 * without requiring the actual add-on code. Each profile can:
 * - Match models/notes to determine if they belong to that add-on
 * - Normalize data during import
 * - Register custom template filters
 * 
 * Built-in profiles:
 * - Image Occlusion Enhanced
 * - Hint filters
 * - Cloze Overlapper (detection only)
 */

import { Model, AnkiNote } from './schema';
import { InMemoryDb } from './InMemoryDb';
import { registerFilter } from './TemplateEngine';
import { logger } from '../../utils/logger';

/**
 * Add-on profile interface
 */
export interface AddonProfile {
  /** Unique identifier for this profile */
  id: string;
  
  /** Human-readable name */
  name: string;
  
  /** Match function - returns true if this note/model belongs to this add-on */
  match(model: Model, note?: AnkiNote): boolean;
  
  /** Optional normalization function called during import */
  normalize?(note: AnkiNote, model: Model, db: InMemoryDb): Promise<void>;
  
  /** Optional custom filters for template rendering */
  filters?: Record<string, (content: string, ...args: any[]) => string>;
}

/**
 * Registry of add-on profiles
 */
const profiles: AddonProfile[] = [];

/**
 * Register an add-on profile
 */
export function registerAddonProfile(profile: AddonProfile): void {
  // Check for duplicate IDs
  const existing = profiles.find(p => p.id === profile.id);
  if (existing) {
    logger.warn(`[AddonProfiles] Profile ${profile.id} already registered, replacing`);
    const index = profiles.indexOf(existing);
    profiles[index] = profile;
  } else {
    profiles.push(profile);
    logger.info(`[AddonProfiles] Registered profile: ${profile.name}`);
  }
  
  // Register any custom filters
  if (profile.filters) {
    Object.entries(profile.filters).forEach(([name, fn]) => {
      registerFilter(name, fn);
    });
  }
}

/**
 * Get all registered profiles
 */
export function getProfiles(): AddonProfile[] {
  return [...profiles];
}

/**
 * Find matching profile for a model/note
 */
export function findMatchingProfile(
  model: Model,
  note?: AnkiNote
): AddonProfile | null {
  for (const profile of profiles) {
    if (profile.match(model, note)) {
      return profile;
    }
  }
  return null;
}

/**
 * Normalize a note using matching profile
 */
export async function normalizeWithProfile(
  note: AnkiNote,
  model: Model,
  db: InMemoryDb
): Promise<boolean> {
  const profile = findMatchingProfile(model, note);
  if (profile && profile.normalize) {
    try {
      await profile.normalize(note, model, db);
      logger.info(`[AddonProfiles] Normalized note ${note.id} with ${profile.name}`);
      return true;
    } catch (error) {
      logger.error(`[AddonProfiles] Error normalizing with ${profile.name}:`, error);
      return false;
    }
  }
  return false;
}

// ============================================================================
// Built-in Profiles
// ============================================================================

/**
 * Image Occlusion Enhanced Profile
 */
const imageOcclusionProfile: AddonProfile = {
  id: 'image-occlusion-enhanced',
  name: 'Image Occlusion Enhanced',
  
  match(model: Model, note?: AnkiNote): boolean {
    const modelName = model.name.toLowerCase();
    
    // Match by model name
    if (modelName.includes('image occlusion') || modelName.includes('io')) {
      return true;
    }
    
    // Match by template names
    const templateNames = model.tmpls.map(t => t.name.toLowerCase());
    if (templateNames.some(name => name.includes('hide one') || name.includes('hide all'))) {
      return true;
    }
    
    // Match by field names
    const fieldNames = model.flds.map(f => f.name.toLowerCase());
    const ioFieldKeywords = ['occlusion', 'masks', 'image', 'question mask'];
    if (fieldNames.some(name => ioFieldKeywords.some(keyword => name.includes(keyword)))) {
      return true;
    }
    
    return false;
  },
  
  // Normalization would go here in Phase 3
  // For now, we rely on existing import logic
};

/**
 * Hint Filter Profile
 * 
 * Adds support for {{hint:Field}} filter that shows/hides content
 */
const hintFilterProfile: AddonProfile = {
  id: 'hint-filter',
  name: 'Hint Filter',
  
  match(model: Model): boolean {
    // Check if any template uses hint filter
    const allTemplates = model.tmpls.map(t => t.qfmt + t.afmt).join(' ');
    return /\{\{hint:/i.test(allTemplates);
  },
  
  filters: {
    hint: (content: string) => {
      // In Anki, hints are collapsible
      // For mobile, we'll show them with a label
      if (!content || content.trim().length === 0) {
        return '';
      }
      return `<details><summary>Show Hint</summary>${content}</details>`;
    },
  },
};

/**
 * Cloze Overlapper Profile
 * 
 * Detection only - most cloze overlapper decks work with standard cloze filter
 */
const clozeOverlapperProfile: AddonProfile = {
  id: 'cloze-overlapper',
  name: 'Cloze Overlapper',
  
  match(model: Model): boolean {
    const modelName = model.name.toLowerCase();
    return modelName.includes('overlapp') || modelName.includes('overlap');
  },
  
  // No special handling needed - standard cloze filter handles these
};

// ============================================================================
// Auto-register built-in profiles
// ============================================================================

export function initializeBuiltInProfiles(): void {
  registerAddonProfile(imageOcclusionProfile);
  registerAddonProfile(hintFilterProfile);
  registerAddonProfile(clozeOverlapperProfile);
  
  logger.info('[AddonProfiles] Initialized built-in profiles');
}

// Auto-initialize on module load
initializeBuiltInProfiles();
