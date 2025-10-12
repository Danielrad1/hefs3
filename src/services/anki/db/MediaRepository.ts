/**
 * Media Repository
 * Handles all CRUD operations for media files
 */

import { Media } from '../schema';

export class MediaRepository {
  private media: Map<string, Media>;

  constructor(media: Map<string, Media>) {
    this.media = media;
  }

  get(id: string): Media | undefined {
    return this.media.get(id);
  }

  getByFilename(filename: string): Media | undefined {
    return Array.from(this.media.values()).find((m) => m.filename === filename);
  }

  getByHash(hash: string): Media | undefined {
    return Array.from(this.media.values()).find((m) => m.hash === hash);
  }

  getAll(): Media[] {
    return Array.from(this.media.values());
  }

  add(media: Media): void {
    this.media.set(media.id, media);
  }

  delete(id: string): void {
    this.media.delete(id);
  }
}
