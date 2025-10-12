/**
 * Shared types for .apkg parsing
 */

import { AnkiCard, AnkiNote, AnkiCol, Deck, DeckConfig, AnkiRevlog } from '../schema';

export interface ApkgParseResult {
  col: AnkiCol;
  cards: AnkiCard[];
  notes: AnkiNote[];
  decks: Map<string, Deck>;
  deckConfigs: Map<string, DeckConfig>;
  mediaFiles: Map<string, string>; // mediaId -> filename
  revlog: AnkiRevlog[]; // Review history for progress preservation
}

export interface ApkgParseOptions {
  // Enable native streaming unzip (requires expo-zip or react-native-zip-archive)
  enableStreaming?: boolean;
  // Report human-readable progress strings to the UI
  onProgress?: (message: string) => void;
}

export interface StreamingUnzipResult {
  collectionPath: string;
  extractedDir: string;
}
