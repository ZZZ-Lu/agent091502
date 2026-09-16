import React, { useEffect, useRef } from 'react';
import { MotionValue } from 'motion/react';
import { CardData, CARD_DIMENSIONS } from './GenerationCard';
import {
  getOrLoadThumbImage,
  getOrCreateMediaThumbnail,
  thumbCache,
} from '../utils/thumbnail';

export interface NanoLodCanvasProps {
  cards: CardData[];
  selectedCardIds: string[];
  scale: MotionValue<number>;
  tx: MotionValue<number>;
  ty: MotionValue<number>;
  isDarkMode: boolean;
  isActive: boolean;
  onReady?: () => void;
  onThumbnailGenerated?: (id: string, thumbnailUrl: string) => void;
}

export const NanoLodCanvas: React.FC<NanoLodCanvasProps> = React.memo(function NanoLodCanvas({
  cards,
  selectedCardIds,
  scale,
  tx,
  ty,
  isDarkMode,
  isActive,
  onReady,
  onThumbnailGenerated,
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const pendingThumbGenRef = useRef<Set<string>>(new Set());

  // Store latest props in refs to avoid re-binding change listeners on every render
  const cardsRef = useRef(cards);
  cardsRef.current = cards;

  const selectedIdsRef = useRef(selectedCardIds);
  selectedIdsRef.current = selectedCardIds;

  const isDarkRef = useRef(isDarkMode);
  isDarkRef.current = isDarkMode;

  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;

  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  const onThumbGenRef = useRef(onThumbnailGenerated);
  onThumbGenRef.current = onThumbnailGenerated;

  // Single-frame draw call
  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas || !isActiveRef.current) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const currentScale = scale.get();
    const currentTx = tx.get();
    const currentTy = ty.get();
    const dpr = window.devicePixelRatio || 1;

    const width = window.innerWidth;
    const height = window.innerHeight;

    // Adjust canvas resolution if viewport size changed
    const targetW = Math.round(width * dpr);
    const targetH = Math.round(height * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const dark = isDarkRef.current;
    const currentCards = cardsRef.current;
    const selectedSet = new Set(selectedIdsRef.current);

    // Compute visible viewport bounds in world coordinates for instant AABB culling
    const vpLeft = -currentTx / currentScale;
    const vpTop = -currentTy / currentScale;
    const vpRight = (width - currentTx) / currentScale;
    const vpBottom = (height - currentTy) / currentScale;

    ctx.save();
    // Normalize to CSS pixel coordinates
    ctx.scale(dpr, dpr);
    // Apply camera world transform
    ctx.translate(currentTx, currentTy);
    ctx.scale(currentScale, currentScale);

    // Color constants matching Nano-LOD design (sharp straight edges / no border radius)
    const colorGenerating = dark ? '#172554' : '#dbeafe';
    const colorMedia = dark ? '#1e1e22' : '#d8d8dc';
    const colorDraft = dark ? '#151518' : '#ebebef';

    const borderNormal = dark ? 'rgba(64, 64, 64, 0.85)' : 'rgba(212, 212, 216, 0.85)';
    const borderSelected = '#3b82f6';

    const iconDraftColor = dark ? 'rgba(64, 64, 64, 0.85)' : 'rgba(212, 212, 216, 0.85)';
    const iconMediaColor = dark ? 'rgba(115, 115, 115, 0.85)' : 'rgba(163, 163, 163, 0.85)';

    // Constant screen-pixel line widths regardless of world scale
    const normalLineWidth = 1 / currentScale;
    const selectedLineWidth = 2.5 / currentScale;

    // First pass: Draw unselected cards
    // Second pass: Draw selected cards on top to avoid border occlusion
    const unselectedCards: CardData[] = [];
    const selectedCards: CardData[] = [];

    for (let i = 0; i < currentCards.length; i++) {
      const card = currentCards[i];
      const dim = CARD_DIMENSIONS[card.ratio] || { width: 480, height: 480 };
      // Instant AABB culling
      if (
        card.x + dim.width < vpLeft ||
        card.x > vpRight ||
        card.y + dim.height < vpTop ||
        card.y > vpBottom
      ) {
        continue;
      }
      if (selectedSet.has(card.id)) {
        selectedCards.push(card);
      } else {
        unselectedCards.push(card);
      }
    }

    const renderCard = (card: CardData, isSelected: boolean) => {
      const dim = CARD_DIMENSIONS[card.ratio] || { width: 480, height: 480 };
      const hasMedia = Boolean(
        card.thumbnailUrl ||
        card.imageUrl ||
        card.originalImageUrl ||
        card.trueOriginalImageUrl ||
        card.fileData ||
        card.originalFileData ||
        card.trueOriginalFileData
      );
      const isGenerating = card.state === 'generating';

      // 1. Solid Base Fill (sharp straight rectangle)
      if (isGenerating) {
        ctx.fillStyle = colorGenerating;
      } else if (hasMedia) {
        ctx.fillStyle = colorMedia;
      } else {
        ctx.fillStyle = colorDraft;
      }
      ctx.fillRect(card.x, card.y, dim.width, dim.height);

      // 2. Draw 64px Ultra-Low-Resolution Thumbnail (with Object-Cover preservation)
      const thumbUrl =
        card.thumbnailUrl ||
        thumbCache.get(card.id) ||
        (card.imageUrl ? thumbCache.get(card.imageUrl) : undefined);

      let hasDrawnThumbnail = false;

      if (thumbUrl) {
        const img = getOrLoadThumbImage(thumbUrl, scheduleDraw);
        if (img && img.complete && img.naturalWidth > 0) {
          const imgW = img.naturalWidth;
          const imgH = img.naturalHeight;
          const cardW = dim.width;
          const cardH = dim.height;

          // Object-cover calculation (no stretch, no distortion, zero black bars)
          const imgAspect = imgW / imgH;
          const cardAspect = cardW / cardH;

          let sx = 0;
          let sy = 0;
          let sw = imgW;
          let sh = imgH;

          if (imgAspect > cardAspect) {
            // Image is wider than card -> crop left & right
            sw = imgH * cardAspect;
            sx = (imgW - sw) / 2;
          } else {
            // Image is taller than card -> crop top & bottom
            sh = imgW / cardAspect;
            sy = (imgH - sh) / 2;
          }

          ctx.drawImage(img, sx, sy, sw, sh, card.x, card.y, cardW, cardH);
          hasDrawnThumbnail = true;
        }
      } else if (hasMedia && !isGenerating) {
        // Trigger background thumbnail generation for visible cards without thumbnail
        if (!pendingThumbGenRef.current.has(card.id)) {
          pendingThumbGenRef.current.add(card.id);
          getOrCreateMediaThumbnail(card).then((generatedUrl) => {
            pendingThumbGenRef.current.delete(card.id);
            if (generatedUrl) {
              onThumbGenRef.current?.(card.id, generatedUrl);
              scheduleDraw();
            }
          });
        }
      }

      // 3. Border (sharp straight outline, no border radius)
      if (isSelected) {
        ctx.strokeStyle = borderSelected;
        ctx.lineWidth = selectedLineWidth;
      } else {
        ctx.strokeStyle = borderNormal;
        ctx.lineWidth = normalLineWidth;
      }
      ctx.strokeRect(card.x, card.y, dim.width, dim.height);

      // 4. Center indicator / video play badge
      const screenW = dim.width * currentScale;

      if (card.isVideo && screenW >= 12) {
        // Video Thumbnail Overlay: semi-transparent circular badge with play triangle
        const cx = card.x + dim.width / 2;
        const cy = card.y + dim.height / 2;
        const badgeRadius = Math.min(dim.width, dim.height) * 0.25;

        // Semi-transparent dark circular backdrop
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.beginPath();
        ctx.arc(cx, cy, badgeRadius, 0, Math.PI * 2);
        ctx.fill();

        // White play triangle
        const triSize = badgeRadius * 0.8;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
        ctx.beginPath();
        ctx.moveTo(cx - triSize * 0.35, cy - triSize * 0.5);
        ctx.lineTo(cx + triSize * 0.55, cy);
        ctx.lineTo(cx - triSize * 0.35, cy + triSize * 0.5);
        ctx.closePath();
        ctx.fill();
      } else if (!hasDrawnThumbnail && screenW >= 12) {
        // Fallback indicator when thumbnail is still generating/loading
        const cx = card.x + dim.width / 2;
        const cy = card.y + dim.height / 2;
        if (hasMedia) {
          const r = Math.max(2.5 / currentScale, 2);
          ctx.fillStyle = iconMediaColor;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fill();
        } else {
          const r = Math.max(1.5 / currentScale, 1.5);
          ctx.fillStyle = iconDraftColor;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    // Render unselected first, then selected on top
    for (let i = 0; i < unselectedCards.length; i++) {
      renderCard(unselectedCards[i], false);
    }
    for (let i = 0; i < selectedCards.length; i++) {
      renderCard(selectedCards[i], true);
    }

    ctx.restore();
    
    if (onReadyRef.current) {
      onReadyRef.current();
    }
  };

  const scheduleDraw = () => {
    if (rafIdRef.current !== null) return;
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      draw();
    });
  };

  // Re-draw when active state changes
  useEffect(() => {
    if (isActive) {
      scheduleDraw();
    } else {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, [isActive]);

  // Re-draw when data changes
  useEffect(() => {
    if (isActive) {
      scheduleDraw();
    }
  }, [cards, selectedCardIds, isDarkMode, isActive]);

  // Listen to MotionValue camera transforms (pan & zoom)
  useEffect(() => {
    if (!isActive) return;

    const unsubScale = scale.on('change', scheduleDraw);
    const unsubTx = tx.on('change', scheduleDraw);
    const unsubTy = ty.on('change', scheduleDraw);

    const handleResize = () => scheduleDraw();
    window.addEventListener('resize', handleResize);

    return () => {
      unsubScale();
      unsubTx();
      unsubTy();
      window.removeEventListener('resize', handleResize);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [scale, tx, ty, isActive]);

  if (!isActive) return null;

  return (
    <canvas
      ref={canvasRef}
      id="nano-lod-canvas"
      className="fixed inset-0 pointer-events-none z-0"
      style={{
        width: '100vw',
        height: '100vh',
      }}
    />
  );
});
