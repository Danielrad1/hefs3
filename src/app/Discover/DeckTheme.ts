import { DeckManifest } from '../../services/discover/DiscoverService';

// Seeded hash function for stable randomness
function hashInt(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h = (h ^ str.charCodeAt(i)) * 16777619;
  }
  return Math.abs(h);
}

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

// Glyph can be emoji or icon
export type Glyph = { kind: 'emoji' | 'icon'; value: string };

// Massive emoji pools per domain (15-20 each)
const EMOJI_VARIANTS: Record<string, Glyph[]> = {
  language: [
    { kind: 'emoji', value: '💬' },
    { kind: 'emoji', value: '🗣️' },
    { kind: 'emoji', value: '📘' },
    { kind: 'emoji', value: '📕' },
    { kind: 'emoji', value: '📗' },
    { kind: 'emoji', value: '📙' },
    { kind: 'emoji', value: '🌐' },
    { kind: 'emoji', value: '🗨️' },
    { kind: 'emoji', value: '💭' },
    { kind: 'emoji', value: '🔤' },
    { kind: 'emoji', value: '🔡' },
    { kind: 'emoji', value: '🔠' },
    { kind: 'emoji', value: '🗯️' },
    { kind: 'emoji', value: '📖' },
    { kind: 'emoji', value: '✍️' },
    { kind: 'emoji', value: '🖊️' },
    { kind: 'emoji', value: '📝' },
    { kind: 'emoji', value: '🎓' },
  ],
  medical: [
    { kind: 'emoji', value: '🧪' },
    { kind: 'emoji', value: '🧬' },
    { kind: 'emoji', value: '🫀' },
    { kind: 'emoji', value: '💊' },
    { kind: 'emoji', value: '💉' },
    { kind: 'emoji', value: '🩺' },
    { kind: 'emoji', value: '🔬' },
    { kind: 'emoji', value: '🧫' },
    { kind: 'emoji', value: '🦠' },
    { kind: 'emoji', value: '🧠' },
    { kind: 'emoji', value: '🫁' },
    { kind: 'emoji', value: '🦴' },
    { kind: 'emoji', value: '🩸' },
    { kind: 'emoji', value: '⚕️' },
    { kind: 'emoji', value: '🏥' },
    { kind: 'emoji', value: '🥼' },
    { kind: 'emoji', value: '🔭' },
    { kind: 'emoji', value: '⚗️' },
  ],
  law: [
    { kind: 'emoji', value: '⚖️' },
    { kind: 'emoji', value: '📜' },
    { kind: 'emoji', value: '🏛️' },
    { kind: 'emoji', value: '👨‍⚖️' },
    { kind: 'emoji', value: '👩‍⚖️' },
    { kind: 'emoji', value: '📋' },
    { kind: 'emoji', value: '📄' },
    { kind: 'emoji', value: '📃' },
    { kind: 'emoji', value: '🔏' },
    { kind: 'emoji', value: '🔐' },
    { kind: 'emoji', value: '⚔️' },
    { kind: 'emoji', value: '🛡️' },
    { kind: 'emoji', value: '💼' },
    { kind: 'emoji', value: '🎓' },
    { kind: 'emoji', value: '🏦' },
    { kind: 'emoji', value: '🏢' },
  ],
  music: [
    { kind: 'emoji', value: '🎵' },
    { kind: 'emoji', value: '🎶' },
    { kind: 'emoji', value: '🎧' },
    { kind: 'emoji', value: '🎤' },
    { kind: 'emoji', value: '🎸' },
    { kind: 'emoji', value: '🎹' },
    { kind: 'emoji', value: '🎺' },
    { kind: 'emoji', value: '🎷' },
    { kind: 'emoji', value: '🥁' },
    { kind: 'emoji', value: '🎻' },
    { kind: 'emoji', value: '🪕' },
    { kind: 'emoji', value: '🪗' },
    { kind: 'emoji', value: '🎼' },
    { kind: 'emoji', value: '🎙️' },
    { kind: 'emoji', value: '📻' },
    { kind: 'emoji', value: '🔊' },
  ],
  geography: [
    { kind: 'emoji', value: '🌍' },
    { kind: 'emoji', value: '🌎' },
    { kind: 'emoji', value: '🌏' },
    { kind: 'emoji', value: '🗺️' },
    { kind: 'emoji', value: '🧭' },
    { kind: 'emoji', value: '📍' },
    { kind: 'emoji', value: '🏔️' },
    { kind: 'emoji', value: '🏝️' },
    { kind: 'emoji', value: '🏜️' },
    { kind: 'emoji', value: '🌋' },
    { kind: 'emoji', value: '🗻' },
    { kind: 'emoji', value: '🏞️' },
    { kind: 'emoji', value: '🌅' },
    { kind: 'emoji', value: '🌆' },
    { kind: 'emoji', value: '🗾' },
  ],
  general: [
    { kind: 'emoji', value: '✨' },
    { kind: 'emoji', value: '📚' },
    { kind: 'emoji', value: '💡' },
    { kind: 'emoji', value: '⭐' },
    { kind: 'emoji', value: '🌟' },
    { kind: 'emoji', value: '💫' },
    { kind: 'emoji', value: '🎯' },
    { kind: 'emoji', value: '🚀' },
    { kind: 'emoji', value: '🔥' },
    { kind: 'emoji', value: '⚡' },
    { kind: 'emoji', value: '🎨' },
    { kind: 'emoji', value: '🧩' },
    { kind: 'emoji', value: '🎲' },
    { kind: 'emoji', value: '🔮' },
    { kind: 'emoji', value: '🏆' },
    { kind: 'emoji', value: '🎪' },
    { kind: 'emoji', value: '🎭' },
    { kind: 'emoji', value: '🎬' },
  ],
};

// Uniform neutral palette for all decks (dark slate like criminal law)
const PALETTES = {
  language: [
    ['#334155', '#1E293B'],
    ['#475569', '#334155'],
    ['#1E293B', '#0F172A'],
  ],
  medical: [
    ['#334155', '#1E293B'],
    ['#475569', '#334155'],
    ['#1E293B', '#0F172A'],
  ],
  law: [
    ['#334155', '#1E293B'],
    ['#475569', '#334155'],
    ['#1E293B', '#0F172A'],
  ],
  music: [
    ['#334155', '#1E293B'],
    ['#475569', '#334155'],
    ['#1E293B', '#0F172A'],
  ],
  geography: [
    ['#334155', '#1E293B'],
    ['#475569', '#334155'],
    ['#1E293B', '#0F172A'],
  ],
  general: [
    ['#334155', '#1E293B'],
    ['#475569', '#334155'],
    ['#1E293B', '#0F172A'],
  ],
};

export type ShapeVariant = 'blob1' | 'blob2' | 'rings' | 'corner-circles' | 'diagonal';
export type PatternVariant = 'dots' | 'diagonal' | 'grid' | 'wave' | 'none';
export type BadgeType = 'difficulty' | 'new' | 'top' | 'hot' | 'language' | null;
export type CoinVariant = 'circle' | 'squircle' | 'ring';
export type CompositionVariant = 'center' | 'topLeft';

function getDomain(deck: DeckManifest): string {
  const tags = deck.tags.join(' ').toLowerCase();
  if (/(spanish|french|korean|japanese|chinese|german|italian|russian|portuguese|arabic|language)/.test(tags)) return 'language';
  if (/(mcat|medical|anatomy|bio|physiology|chem|physics|muscle)/.test(tags)) return 'medical';
  if (/(law|bar|ube|constitutional|torts|contracts|supreme|criminal)/.test(tags)) return 'law';
  if (/(music|guitar|song|theory|chromatic)/.test(tags)) return 'music';
  if (/(geography|uk|region|cities)/.test(tags)) return 'geography';
  return 'general';
}

export interface DeckGlyphs {
  primary: Glyph;
  coinVariant: CoinVariant;
  composition: CompositionVariant;
  rotation: number;
  sizeVariation: number; // -4 to +4
}

// Icon pools per domain (for primary glyph)
const ICON_VARIANTS: Record<string, Glyph[]> = {
  language: [
    { kind: 'icon', value: 'book' },
    { kind: 'icon', value: 'library' },
    { kind: 'icon', value: 'language' },
    { kind: 'icon', value: 'chatbubbles' },
    { kind: 'icon', value: 'chatbox-ellipses' },
    { kind: 'icon', value: 'globe' },
    { kind: 'icon', value: 'school' },
  ],
  medical: [
    { kind: 'icon', value: 'medical' },
    { kind: 'icon', value: 'flask' },
    { kind: 'icon', value: 'pulse' },
    { kind: 'icon', value: 'fitness' },
    { kind: 'icon', value: 'body' },
  ],
  law: [
    { kind: 'icon', value: 'briefcase' },
    { kind: 'icon', value: 'document-text' },
    { kind: 'icon', value: 'shield' },
    { kind: 'icon', value: 'business' },
  ],
  music: [
    { kind: 'icon', value: 'musical-notes' },
    { kind: 'icon', value: 'headset' },
    { kind: 'icon', value: 'mic' },
  ],
  geography: [
    { kind: 'icon', value: 'globe' },
    { kind: 'icon', value: 'map' },
    { kind: 'icon', value: 'compass' },
    { kind: 'icon', value: 'location' },
  ],
  general: [
    { kind: 'icon', value: 'book' },
    { kind: 'icon', value: 'bulb' },
    { kind: 'icon', value: 'star' },
    { kind: 'icon', value: 'rocket' },
  ],
};

// Icon badges for top-right corner
const BADGE_ICONS = ['star', 'star-outline', 'bookmark', 'bookmark-outline', 'heart', 'heart-outline', 'flame', 'flash', 'trophy', 'ribbon'];

export function getDeckGlyphs(deck: DeckManifest, adjacentEmojis: string[] = []): DeckGlyphs {
  const seed = hashInt(deck.id);
  const domain = getDomain(deck) as keyof typeof EMOJI_VARIANTS;
  
  // Primary: 75% icon, 25% emoji
  const useIcon = (seed % 4) !== 0;
  let primary: Glyph;
  
  if (useIcon) {
    primary = pick(ICON_VARIANTS[domain] || ICON_VARIANTS.general, seed);
  } else {
    // Emoji as primary - avoid adjacent duplicates
    primary = pick(EMOJI_VARIANTS[domain], seed);
    let attempts = 0;
    while (adjacentEmojis.includes(primary.value) && attempts < 10) {
      const newSeed = seed + attempts + 1;
      primary = pick(EMOJI_VARIANTS[domain], newSeed);
      attempts++;
    }
  }
  
  // Coin variant
  const coinVariant = pick<CoinVariant>(['circle', 'squircle', 'ring'], Math.floor(seed / 11));
  
  // Composition
  const composition = pick<CompositionVariant>(['center', 'topLeft'], Math.floor(seed / 5));
  
  // Subtle rotation (-2 to 2 degrees)
  const rotation = ((seed % 5) - 2) * 0.8;
  
  // Size variation (-4 to +4)
  const sizeVariation = ((seed % 9) - 4);
  
  return { primary, coinVariant, composition, rotation, sizeVariation };
}

export interface DeckTheme {
  colors: [string, string];
  angle: { x: number; y: number };
  pattern: PatternVariant;
  shape: ShapeVariant;
  badge: BadgeType;
  accentColor: string;
}

export function buildDeckTheme(deck: DeckManifest): DeckTheme {
  const seed = hashInt(deck.id);
  const domain = getDomain(deck) as keyof typeof PALETTES;
  
  // Pick palette and optionally reverse it
  const palette = pick(PALETTES[domain], seed);
  const colors: [string, string] = (seed % 3) === 0 ? [palette[1], palette[0]] : [palette[0], palette[1]];
  
  // Seeded gradient angle
  const angleVariant = seed % 8;
  const angle = {
    x: angleVariant % 2,
    y: Math.floor(angleVariant / 2) % 2,
  };
  
  // Seeded pattern
  const pattern = pick<PatternVariant>(
    ['dots', 'diagonal', 'grid', 'wave', 'none'],
    Math.floor(seed / 7)
  );
  
  // Seeded shape
  const shape = pick<ShapeVariant>(
    ['blob1', 'blob2', 'rings', 'corner-circles', 'diagonal'],
    Math.floor(seed / 11)
  );
  
  // Badge logic
  let badge: BadgeType = null;
  if (deck.cardCount > 4000) {
    badge = 'top';
  } else if (seed % 5 === 0) {
    badge = 'hot';
  } else if (deck.difficulty === 'beginner') {
    badge = 'new';
  } else {
    badge = 'difficulty';
  }
  
  // Accent color (lighter version of first color for badges/accents)
  const accentColor = colors[0];
  
  return {
    colors,
    angle,
    pattern,
    shape,
    badge,
    accentColor,
  };
}

export function getBadgeInfo(badge: BadgeType, difficulty: string, language: string): { label: string; color: string; emoji?: string } {
  switch (badge) {
    case 'top':
      return { label: 'Top 10', color: '#FFD700' };
    case 'hot':
      return { label: 'Hot', color: '#FF4500', emoji: '🔥' };
    case 'new':
      return { label: 'New', color: '#10B981' };
    case 'difficulty':
      return {
        label: difficulty === 'beginner' ? 'Easy' : difficulty === 'intermediate' ? 'Med' : 'Hard',
        color: difficulty === 'beginner' ? '#10B981' : difficulty === 'intermediate' ? '#F59E0B' : '#EF4444',
      };
    case 'language':
      return { label: language, color: '#6366F1' };
    default:
      return { label: '', color: '#6366F1' };
  }
}
