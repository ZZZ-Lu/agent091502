import { AspectRatio, CARD_DIMENSIONS } from '../components/GenerationCard';

export interface CardBounds {
  id: string;
  x: number;
  y: number;
  ratio: AspectRatio;
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
export function getCardDimensions(ratio: AspectRatio): { width: number; height: number } {
  const dim = CARD_DIMENSIONS[ratio] || CARD_DIMENSIONS['3:4'];
  const visualWidth = Math.max(dim.width, 480);
  const visualHeight = dim.height + 220; // 12px gap + ~200px bottom panel
  return { width: visualWidth, height: visualHeight };
}

/**
 * Determines whether a card's axis-aligned bounding box intersects with
 * a circle defined by:
 * - Center: Center of the screen/page (viewportWidth / 2, viewportHeight / 2)
 * - Diameter: Page/viewport width (viewportWidth)
 * - Radius: viewportWidth / 2
 *
 * This function performs pure mathematical collision detection between an AABB and a circle
 * in screen space, completely decoupled from DOM or rendering layers.
 */
export function isCardIntersectingCircle(
  card: CardBounds,
  viewport: CanvasViewport
): boolean {
  const { viewportWidth, viewportHeight, scale, tx, ty } = viewport;
  if (viewportWidth <= 0 || scale <= 0) return true;

  // Screen circle definitions: Center = (scx, scy), Diameter = viewportWidth, Radius = viewportWidth / 2
  const scx = viewportWidth / 2;
  const scy = viewportHeight / 2;
  const screenRadius = viewportWidth / 2;

  // Card dimensions in canvas coordinates
  const { width: cardWidth, height: cardHeight } = getCardDimensions(card.ratio);

  // Card AABB in screen coordinates
  const cardLeft = card.x * scale + tx;
  const cardTop = card.y * scale + ty;
  const cardRight = cardLeft + cardWidth * scale;
  const cardBottom = cardTop + cardHeight * scale;

  // Find the closest point on the card rectangle to the circle center (scx, scy)
  const closestX = Math.max(cardLeft, Math.min(scx, cardRight));
  const closestY = Math.max(cardTop, Math.min(scy, cardBottom));

  // Squared Euclidean distance from closest point to circle center
  const dx = closestX - scx;
  const dy = closestY - scy;
  const distSq = dx * dx + dy * dy;

  return distSq <= screenRadius * screenRadius;
}
