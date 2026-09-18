import React, { useEffect, useRef } from 'react';
import { MotionValue } from 'motion/react';
import { CardData, getCardSize } from './GenerationCard';
import {
  getOrLoadThumbImage,
  getOrCreateMediaThumbnail,
  thumbCache,
} from '../utils/thumbnail';
import { calculateObjectCover, fullImageCache } from '../utils/imageTextureCache';

export interface NanoLodCanvasProps {
  cards: CardData[];
  selectedCardIds: string[];
  pickerSession?: {
    targetCardId: string;
    selectedCardIds: string[];
  } | null;
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
  pickerSession,
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

  const pickerSessionRef = useRef(pickerSession);
  pickerSessionRef.current = pickerSession;

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
    const pickerSession = pickerSessionRef.current;

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
    // Matches DOM bg-gray-100 (#f3f4f6) and dark:bg-neutral-800 (#262626)
    const colorGenerating = dark ? '#262626' : '#f3f4f6';
    const colorMedia = dark ? '#262626' : '#f3f4f6';
    const colorDraft = dark ? '#262626' : '#f3f4f6';

    const borderNormal = dark ? 'rgba(64, 64, 64, 0.85)' : 'rgba(212, 212, 216, 0.85)';
    const borderSelected = '#3b82f6';
    const borderPickerTarget = '#3b82f6';
    const borderPickerSelected = '#2563eb';

    const iconDraftColor = dark ? 'rgba(64, 64, 64, 0.85)' : 'rgba(212, 212, 216, 0.85)';
    const iconMediaColor = dark ? 'rgba(115, 115, 115, 0.85)' : 'rgba(163, 163, 163, 0.85)';

    // Constant screen-pixel line widths regardless of world scale
    const normalLineWidth = 1 / currentScale;
    const selectedLineWidth = 2 / currentScale;
    const pickerSelectedLineWidth = 4 / currentScale;

    // First pass: Draw unselected cards
    // Second pass: Draw selected cards on top to avoid border occlusion
    const unselectedCards: CardData[] = [];
    const selectedCards: CardData[] = [];

    for (let i = 0; i < currentCards.length; i++) {
      const card = currentCards[i];
      const dim = getCardSize(card);
      // Instant AABB culling
      if (
        card.x + dim.width < vpLeft ||
        card.x > vpRight ||
        card.y + dim.height < vpTop ||
        card.y > vpBottom
      ) {
        continue;
      }
      const isSelected = selectedSet.has(card.id);
      const isPickerTarget = pickerSession?.targetCardId === card.id;
      const isPickerSelected = pickerSession ? pickerSession.selectedCardIds.includes(card.id) : false;
      
      if (isSelected || isPickerTarget || isPickerSelected) {
        selectedCards.push(card);
      } else {
        unselectedCards.push(card);
      }
    }

    const renderCard = (card: CardData) => {
      const isSelected = selectedSet.has(card.id);
      const isPickerTarget = pickerSession?.targetCardId === card.id;
      const pickerSelectionIndex = pickerSession ? pickerSession.selectedCardIds.indexOf(card.id) + 1 : 0;
      const isPickerSelected = pickerSelectionIndex > 0;

      const dim = getCardSize(card);
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

      // 2. Draw 64px Ultra-Low-Resolution Thumbnail or cached Full Image (with Object-Cover preservation)
      // PERFORMANCE: Skip drawing images completely in macro view (zoom < 0.10) to save GPU texture rendering and use color blocks
      const isMacroView = currentScale < 0.10;
      
      let hasDrawnThumbnail = false;
      
      if (!isMacroView) {
        const thumbUrl =
          card.thumbnailUrl ||
          thumbCache.get(card.id) ||
          (card.imageUrl ? thumbCache.get(card.imageUrl) : undefined);

        let drawSourceImg: HTMLImageElement | null = null;
        if (thumbUrl) {
          drawSourceImg = getOrLoadThumbImage(thumbUrl, scheduleDraw);
        } else if (card.imageUrl && fullImageCache.has(card.imageUrl)) {
          const cached = fullImageCache.get(card.imageUrl);
          if (cached && cached.complete && cached.naturalWidth > 0) {
            drawSourceImg = cached;
          }
        }

        if (drawSourceImg && drawSourceImg.complete && drawSourceImg.naturalWidth > 0) {
          const { sx, sy, sw, sh } = calculateObjectCover(
            drawSourceImg.naturalWidth,
            drawSourceImg.naturalHeight,
            dim.width,
            dim.height
          );
          ctx.drawImage(drawSourceImg, sx, sy, sw, sh, card.x, card.y, dim.width, dim.height);
          hasDrawnThumbnail = true;
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
      }

      // Add missing dark filter for videos in Nano LOD to match Micro LOD's bg-black/25
      if (card.isVideo && hasDrawnThumbnail) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.fillRect(card.x, card.y, dim.width, dim.height);
      }

      // 3. Border (sharp straight outline, no border radius)
      if (isPickerSelected) {
        ctx.strokeStyle = borderPickerSelected;
        ctx.lineWidth = pickerSelectedLineWidth;
        ctx.strokeRect(card.x, card.y, dim.width, dim.height);
      } else if (isPickerTarget) {
        ctx.strokeStyle = borderPickerTarget;
        ctx.lineWidth = selectedLineWidth;
        ctx.strokeRect(card.x, card.y, dim.width, dim.height);
      } else if (isSelected) {
        ctx.strokeStyle = borderSelected;
        ctx.lineWidth = selectedLineWidth;
        ctx.strokeRect(card.x, card.y, dim.width, dim.height);
      } else {
        ctx.strokeStyle = borderNormal;
        ctx.lineWidth = normalLineWidth;
        ctx.strokeRect(card.x, card.y, dim.width, dim.height);
      }

      // 4. Center indicator / video play badge
      const screenW = dim.width * currentScale;

      if (card.isVideo && screenW >= 12) {
        // Video Thumbnail Overlay: semi-transparent circular badge with play triangle
        const cx = card.x + dim.width / 2;
        const cy = card.y + dim.height / 2;
        const badgeRadius = Math.min(dim.width, dim.height) * 0.25;

        // Semi-transparent circular backdrop matching DOM's bg-white/20 dark:bg-black/30
        ctx.fillStyle = dark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.2)';
        ctx.beginPath();
        ctx.arc(cx, cy, badgeRadius, 0, Math.PI * 2);
        ctx.fill();

        // Border matching DOM's border-white/30 dark:border-white/10
        ctx.lineWidth = 1;
        ctx.strokeStyle = dark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.3)';
        ctx.stroke();

        // White play triangle (matches DOM text-white/85)
        const triSize = badgeRadius * 0.8;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
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

      // 5. Picker Session Badges
      if (isPickerSelected && screenW >= 24) {
        // Draw picker index badge on top left
        const badgeSize = Math.max(16 / currentScale, 12);
        const padding = Math.max(4 / currentScale, 2);
        const fontSize = Math.max(10 / currentScale, 8);
        
        ctx.fillStyle = borderPickerSelected;
        ctx.beginPath();
        // A simple square or slightly rounded rect for canvas mode
        ctx.rect(card.x + padding, card.y + padding, badgeSize, badgeSize);
        ctx.fill();
        
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pickerSelectionIndex.toString(), card.x + padding + badgeSize / 2, card.y + padding + badgeSize / 2 + (1/currentScale));
      } else if (isPickerTarget && screenW >= 40) {
        // Draw "当前目标" badge
        const fontSize = Math.max(10 / currentScale, 8);
        const paddingX = Math.max(8 / currentScale, 4);
        const paddingY = Math.max(4 / currentScale, 2);
        
        ctx.font = `bold ${fontSize}px sans-serif`;
        const metrics = ctx.measureText("当前目标");
        const w = metrics.width + paddingX * 2;
        const h = fontSize + paddingY * 2;
        
        const badgeX = card.x - paddingX;
        const badgeY = card.y - h;
        
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath();
        ctx.rect(badgeX, badgeY, w, h);
        ctx.fill();
        
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText("当前目标", badgeX + w/2, badgeY + h/2 + (1/currentScale));
      }
    };

    // Render unselected first, then selected on top
    for (let i = 0; i < unselectedCards.length; i++) {
      renderCard(unselectedCards[i]);
    }
    for (let i = 0; i < selectedCards.length; i++) {
      renderCard(selectedCards[i]);
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
  }, [cards, selectedCardIds, pickerSession, isDarkMode, isActive]);

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
