import { AspectRatio, CARD_DIMENSIONS, getCardSize } from '../components/GenerationCard';

export interface CardBounds {
  id: string;
  x: number;
  y: number;
  ratio: AspectRatio;
  customWidth?: number;
  customHeight?: number;
}

export interface CanvasViewport {
  viewportWidth: number;
  viewportHeight: number;
  scale: number;
  tx: number;
  ty: number;
}

/**
 * Calculates visual dimensions of a card in canvas world coordinates.
 * Includes the image area, gap, and bottom prompt/action panel.
 */
export function getCardDimensions(card: CardBounds): { width: number; height: number } {
  const dim = getCardSize(card);
  const visualWidth = Math.max(dim.width, 480);
  const visualHeight = dim.height + 220; // 12px gap + ~200px bottom panel
  return { width: visualWidth, height: visualHeight };
}

/**
 * Determines whether a card's axis-aligned bounding box intersects with
 * a rectangle defined by the viewport plus a pre-load buffer.
 *
 * This function performs pure mathematical AABB vs AABB collision detection
 * in screen space, completely decoupled from DOM or rendering layers.
 */
export function isCardIntersectingRectangle(
  card: CardBounds,
  viewport: CanvasViewport
): boolean {
  const { viewportWidth, viewportHeight, scale, tx, ty } = viewport;
  if (viewportWidth <= 0 || viewportHeight <= 0 || scale <= 0) return true;

  // Card dimensions in canvas coordinates
  const { width: cardWidth, height: cardHeight } = getCardDimensions(card);

  // Card AABB in screen coordinates
  const cardLeft = card.x * scale + tx;
  const cardTop = card.y * scale + ty;
  const cardRight = cardLeft + cardWidth * scale;
  const cardBottom = cardTop + cardHeight * scale;

  // Add a 150px buffer zone outside the screen edges for smooth pre-loading
  const buffer = 150;

  return (
    cardLeft <= viewportWidth + buffer &&
    cardRight >= -buffer &&
    cardTop <= viewportHeight + buffer &&
    cardBottom >= -buffer
  );
}

/**
 * Dynamic LOD-Adaptive Mounting Quotas
 * 
 * Returns the maximum number of DOM cards allowed to mount into the DOM per animation frame.
 * Prioritizes 60fps zooming and panning fluid motion by deferring DOM node mounting.
 * 
 * - While actively zooming or dragging: Quota is 0 (pure GPU matrix transform, 0 new DOM reflows).
 * - Nano-LOD (scale < 0.60): Quota is 0 (pure 2D Canvas rendering, 0 DOM cards).
 * - Micro-LOD (0.60 <= scale < 1.00): High density, gentle progressive reveal: 2 cards / frame.
 * - Standard-LOD (1.00 <= scale < 2.00): Standard workspace view: 2 cards / frame.
 * - Macro-LOD (scale >= 2.00): Close-up with heavy 4K texture workloads: 1 card / frame.
 */
export function getLodMountQuota(scale: number, isInteracting: boolean = false): number {
  if (isInteracting) return 0;
  if (scale < 0.60) return 0;
  if (scale < 1.00) return 2;
  if (scale < 2.00) return 2;
  return 1;
}
