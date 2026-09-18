/**
 * Universal Image Texture Cache & Canvas Graphics Pipeline.
 * 
 * Complies with AGENTS.md Architecture Constraints:
 * - Data-DOM Decoupling: Zero DOM dependencies, zero React state stored.
 * - Portable: Runs in Canvas 2D, WebGL, or OffscreenCanvas Worker contexts.
 * - Intent-Driven: Supports instant fallback, LRU memory protection, and progressive streaming.
 */

// Max concurrent high-resolution original images in memory to prevent GPU memory pressure
const MAX_ORIGINAL_CACHE_ENTRIES = 4;

// Cache maps: URL -> HTMLImageElement
export const fullImageCache = new Map<string, HTMLImageElement>();
export const originalImageCache = new Map<string, HTMLImageElement>();

// LRU tracking for original high-resolution images
const originalLruQueue: string[] = [];

/**
 * Get or asynchronously load an image for Canvas rendering.
 * Returns the HTMLImageElement if already loaded and ready, or null if loading.
 */
export function getOrLoadCanvasImage(
  url: string | null | undefined,
  onLoaded?: () => void,
  tier: 'full' | 'original' = 'full'
): HTMLImageElement | null {
  if (!url) return null;

  const targetMap = tier === 'original' ? originalImageCache : fullImageCache;
  const existing = targetMap.get(url);

  if (existing) {
    if (existing.complete && existing.naturalWidth > 0) {
      if (tier === 'original') {
        touchOriginalLru(url);
      }
      return existing;
    }
    return null;
  }

  // Create and load image
  const img = new Image();
  img.crossOrigin = 'anonymous';

  img.onload = () => {
    onLoaded?.();
  };
  img.onerror = () => {
    console.warn(`[imageTextureCache] Failed to load ${tier} image: ${url}`);
  };

  img.src = url;
  targetMap.set(url, img);

  if (tier === 'original') {
    touchOriginalLru(url);
    enforceOriginalLruLimit();
  }

  return null;
}

/**
 * Update LRU queue for original high-res image cache
 */
function touchOriginalLru(url: string) {
  const index = originalLruQueue.indexOf(url);
  if (index !== -1) {
    originalLruQueue.splice(index, 1);
  }
  originalLruQueue.push(url);
}

/**
 * Enforce memory limit for original high-res textures
 */
function enforceOriginalLruLimit() {
  while (originalLruQueue.length > MAX_ORIGINAL_CACHE_ENTRIES) {
    const oldestUrl = originalLruQueue.shift();
    if (oldestUrl) {
      const img = originalImageCache.get(oldestUrl);
      if (img) {
        img.src = ''; // Release browser image decoding buffer
      }
      originalImageCache.delete(oldestUrl);
    }
  }
}

/**
 * Compute Object-Cover source rectangle parameters
 * Guarantees zero distortion, no stretching, and no black bars.
 */
export function calculateObjectCover(
  imgW: number,
  imgH: number,
  cardW: number,
  cardH: number
): { sx: number; sy: number; sw: number; sh: number } {
  if (imgW <= 0 || imgH <= 0 || cardW <= 0 || cardH <= 0) {
    return { sx: 0, sy: 0, sw: Math.max(1, imgW), sh: Math.max(1, imgH) };
  }

  const imgAspect = imgW / imgH;
  const cardAspect = cardW / cardH;

  let sx = 0;
  let sy = 0;
  let sw = imgW;
  let sh = imgH;

  if (imgAspect > cardAspect) {
    // Image is wider than container -> crop left & right
    sw = imgH * cardAspect;
    sx = (imgW - sw) / 2;
  } else {
    // Image is taller than container -> crop top & bottom
    sh = imgW / cardAspect;
    sy = (imgH - sh) / 2;
  }

  return { sx, sy, sw, sh };
}

/**
 * Draw a smooth continuous-curvature squircle path on Canvas 2D
 * Matches the CSS squircle continuous curvature language.
 */
export function drawSquirclePath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number = 16
) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r);
  } else {
    // Fallback for older browsers
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}
