import { Image } from 'react-native';
import { getMediaUri } from './mediaHelpers';

type ImgDims = { width: number; height: number };

/**
 * Image cache for preloading images and caching dimensions
 * Uses LRU eviction to prevent unbounded memory growth
 */
class ImageCacheService {
  private static readonly MAX_CACHE_SIZE = 200;
  
  private preloadedImages = new Set<string>();
  private dims = new Map<string, ImgDims>();
  // Track access order for LRU
  private accessOrder: string[] = [];

  /**
   * Track access for LRU eviction
   */
  private trackAccess(filename: string): void {
    // Remove if exists (will add to end)
    const index = this.accessOrder.indexOf(filename);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(filename);
  }

  /**
   * Evict least recently used entries if over limit
   */
  private evictIfNeeded(): void {
    while (this.dims.size > ImageCacheService.MAX_CACHE_SIZE) {
      const lru = this.accessOrder.shift();
      if (lru) {
        this.dims.delete(lru);
        this.preloadedImages.delete(lru);
      }
    }
  }

  /**
   * Get dimensions for an image (async, with caching)
   */
  async getDimensions(filename: string): Promise<ImgDims | null> {
    if (this.dims.has(filename)) {
      this.trackAccess(filename);
      return this.dims.get(filename)!;
    }

    const uri = getMediaUri(filename);
    
    return new Promise((resolve) => {
      Image.getSize(
        uri,
        (width, height) => {
          const dims = { width, height };
          this.dims.set(filename, dims);
          this.trackAccess(filename);
          this.evictIfNeeded();
          resolve(dims);
        },
        () => resolve(null)
      );
    });
  }

  /**
   * Get cached dimensions synchronously (returns null if not cached)
   */
  getCachedDimensions(filename: string): ImgDims | null {
    return this.dims.get(filename) || null;
  }

  /**
   * Check if all images in HTML have cached dimensions
   * Returns true if ready to render without layout shift
   */
  areImageDimensionsReady(html: string): boolean {
    const imageFiles = this.extractImageUrls(html);
    
    // If no images, always ready
    if (imageFiles.length === 0) {
      return true;
    }

    // Check if all images have cached dimensions
    return imageFiles.every(filename => {
      const dims = this.getCachedDimensions(filename);
      return dims !== null;
    });
  }

  /**
   * Extract image filenames from HTML content
   */
  extractImageUrls(html: string): string[] {
    const images: string[] = [];
    const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/gi;
    let match;
    
    while ((match = imgRegex.exec(html)) !== null) {
      const src = match[1];
      if (src.includes('media/')) {
        const filename = src.split('media/').pop();
        if (filename) {
          images.push(decodeURIComponent(filename));
        }
      } else {
        images.push(src);
      }
    }
    
    return images;
  }

  /**
   * Preload dimensions for all images in HTML
   */
  async ensureDimensionsFromHtml(html: string): Promise<void> {
    const files = this.extractImageUrls(html);
    await Promise.all(files.map((f) => this.getDimensions(f)));
  }

  /**
   * Preload an image into memory cache
   */
  async preloadImage(filename: string): Promise<void> {
    if (this.preloadedImages.has(filename)) {
      this.trackAccess(filename);
      return;
    }

    try {
      const mediaPath = getMediaUri(filename);
      await Image.prefetch(mediaPath);
      this.preloadedImages.add(filename);
      this.trackAccess(filename);
      this.evictIfNeeded();
    } catch (error) {
      // Silent fail
    }
  }

  /**
   * Preload all images from HTML content
   */
  async preloadImagesFromHtml(html: string): Promise<void> {
    const imageUrls = this.extractImageUrls(html);
    const promises = imageUrls.map(url => this.preloadImage(url));
    Promise.all(promises).catch(() => {});
  }

  /**
   * Clear the cache
   */
  clear(): void {
    this.preloadedImages.clear();
    this.dims.clear();
    this.accessOrder = [];
  }
  
  /**
   * Get cache statistics (for debugging)
   */
  getStats(): { size: number; maxSize: number; preloaded: number } {
    return {
      size: this.dims.size,
      maxSize: ImageCacheService.MAX_CACHE_SIZE,
      preloaded: this.preloadedImages.size,
    };
  }
}

// Global singleton instance
export const ImageCache = new ImageCacheService();
