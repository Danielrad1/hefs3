import { Image } from 'react-native';
import { getMediaUri } from './mediaHelpers';

type ImgDims = { width: number; height: number };

/**
 * Image cache for preloading images and caching dimensions
 */
class ImageCacheService {
  private preloadedImages = new Set<string>();
  private dims = new Map<string, ImgDims>();

  /**
   * Get dimensions for an image (async, with caching)
   */
  async getDimensions(filename: string): Promise<ImgDims | null> {
    if (this.dims.has(filename)) {
      return this.dims.get(filename)!;
    }

    const uri = getMediaUri(filename);
    
    return new Promise((resolve) => {
      Image.getSize(
        uri,
        (width, height) => {
          const dims = { width, height };
          this.dims.set(filename, dims);
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
      return;
    }

    try {
      const mediaPath = getMediaUri(filename);
      await Image.prefetch(mediaPath);
      this.preloadedImages.add(filename);
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
  }
}

// Global singleton instance
export const ImageCache = new ImageCacheService();
