/**
 * .apkg Parser
 * Orchestrates the parsing of Anki .apkg files using modular components
 */

import * as FileSystem from 'expo-file-system/legacy';
import {
  ApkgParseResult,
  ApkgParseOptions,
  ProgressReporter,
  UnzipStrategy,
  SqliteParser,
  MediaExtractor,
} from './apkg';

// Re-export types for backward compatibility
export type { ApkgParseResult, ApkgParseOptions } from './apkg';

export class ApkgParser {
  private tempDir = `${FileSystem.documentDirectory}temp/`;
  private mediaDir = `${FileSystem.documentDirectory}media/`;
  
  private unzipStrategy: UnzipStrategy;
  private sqliteParser: SqliteParser;
  private mediaExtractor: MediaExtractor;

  constructor() {
    this.unzipStrategy = new UnzipStrategy(this.tempDir);
    this.sqliteParser = new SqliteParser();
    this.mediaExtractor = new MediaExtractor(this.mediaDir);
  }

  /**
   * Parse an .apkg file from a URI
   */
  async parse(fileUri: string, options: ApkgParseOptions = {}): Promise<ApkgParseResult> {
    console.log('[ApkgParser] Starting parse:', fileUri);
    const progress = new ProgressReporter(options);

    // Check file size first
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (!fileInfo.exists) {
      throw new Error('File does not exist');
    }

    const fileSizeMB = fileInfo.size ? fileInfo.size / (1024 * 1024) : 0;
    console.log('[ApkgParser] File size:', fileSizeMB.toFixed(2), 'MB');

    // Warn about very large files but don't block them
    if (fileSizeMB > 500) {
      console.warn(
        '[ApkgParser] Very large file detected:',
        fileSizeMB.toFixed(2),
        'MB - this will take significant time and memory'
      );
    } else if (fileSizeMB > 100) {
      console.warn('[ApkgParser] Large file detected:', fileSizeMB.toFixed(2), 'MB - this may take a while');
    }

    // Ensure directories exist
    await this.ensureDirectories();

    // If streaming is enabled, try native unzip first. This keeps memory low.
    if (options.enableStreaming === true) {
      progress.report('Unzipping (streaming)…');
      const streamed = await this.unzipStrategy.tryStreamingUnzip(fileUri, options);
      if (streamed) {
        // We have extracted files on disk; proceed without JSZip
        const { collectionPath, extractedDir } = streamed;
        console.log('[ApkgParser] Streaming unzip path active. Collection at:', collectionPath);

        // Parse SQLite
        console.log('[ApkgParser] Parsing SQLite database (streaming path)...');
        progress.report('Parsing database…');
        const result = await this.sqliteParser.parse(collectionPath);

        // Extract media by moving/copying from extracted dir
        console.log('[ApkgParser] Extracting media files (streaming path)...');
        progress.report('Placing media files…');
        const mediaMap = await this.mediaExtractor.extractFromFs(extractedDir, options);
        result.mediaFiles = mediaMap;

        // Best-effort cleanup of extracted dir
        console.log('[ApkgParser] Cleaning up extracted directory...');
        try {
          await FileSystem.deleteAsync(extractedDir, { idempotent: true });
        } catch {}
        console.log('[ApkgParser] Cleanup complete');

        console.log('[ApkgParser] Parse complete (streaming path)!');
        progress.report('Completed');
        return result;
      } else {
        console.log('[ApkgParser] Streaming unzip not available; falling back to JSZip path.');
      }
    }

    // JSZip path (memory-based)
    let zip: any;
    try {
      progress.report('Reading file…');
      zip = await this.unzipStrategy.readAndUnzipWithJSZip(fileUri, fileSizeMB);
      console.log('[ApkgParser] File loaded successfully');
      progress.report('Processing archive…');
    } catch (error) {
      if (error instanceof Error) {
        if (
          error.message.includes('String length') ||
          error.message.includes('Maximum string length')
        ) {
          throw new Error(
            `File too large to process. The file exceeds JavaScript's string length limit. Try importing a smaller deck or splitting the deck into multiple files.`
          );
        }
        throw new Error(`Failed to read file: ${error.message}`);
      }
      throw new Error('Failed to read file: Unknown error');
    }

    // Extract collection from zip and write to disk
    console.log('[ApkgParser] Processing archive...');
    progress.report('Writing database file…');
    const collectionPath = await this.unzipStrategy.extractCollectionFromZip(zip);

    // Parse SQLite
    console.log('[ApkgParser] Parsing SQLite database...');
    progress.report('Parsing database…');
    const result = await this.sqliteParser.parse(collectionPath);

    // Extract media
    console.log('[ApkgParser] Extracting media files...');
    progress.report('Extracting media…');
    const mediaMap = await this.mediaExtractor.extractFromZip(zip, options);
    result.mediaFiles = mediaMap;

    console.log('[ApkgParser] Parse complete!');
    progress.report('Completed');
    return result;
  }


  /**
   * Ensure required directories exist
   */
  private async ensureDirectories(): Promise<void> {
    const tempInfo = await FileSystem.getInfoAsync(this.tempDir);
    if (!tempInfo.exists) {
      await FileSystem.makeDirectoryAsync(this.tempDir, { intermediates: true });
    }

    const mediaInfo = await FileSystem.getInfoAsync(this.mediaDir);
    if (!mediaInfo.exists) {
      await FileSystem.makeDirectoryAsync(this.mediaDir, { intermediates: true });
    }
  }

  /**
   * Clean up temp and media files
   */
  async cleanup(): Promise<void> {
    await FileSystem.deleteAsync(this.tempDir, { idempotent: true });
    await FileSystem.deleteAsync(this.mediaDir, { idempotent: true });
  }
}
