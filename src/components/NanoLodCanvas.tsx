import React, { useEffect, useRef } from 'react';
import { MotionValue } from 'motion/react';
import { CardData, getCardSize } from './GenerationCard';
import {
  getOrLoadThumbImage,
  getOrCreateMediaThumbnail,
  thumbCache,
} from '../utils/thumbnail';
import { calculateObjectCover, fullImageCache } from '../utils/imageTextureCache';
import { getNanoLodThreshold } from '../utils/viewportCulling';

export interface NanoLodCanvasProps {
  cards: CardData[];
  selectedCardIds: string[];
  renderedCardIds?: Set<string>;
  pickerSession?: {
    targetCardId: string;
    selectedReferences?: Array<{
      url: string;
      name?: string;
      fileData?: Blob;
      sourceCardId?: string;
    }>;
    selectedCardIds?: string[];
  } | null;
  scale: MotionValue<number>;
  tx: MotionValue<number>;
  ty: MotionValue<number>;
  isDarkMode: boolean;
  isOverviewMode?: boolean;
  dotModeThreshold?: number;
  isActive: boolean;
  onReady?: () => void;
  onThumbnailGenerated?: (id: string, thumbnailUrl: string) => void;
}

export const DEFAULT_OVERVIEW_DOT_THRESHOLD = 0;

interface BakedSnapshot {
  canvas: HTMLCanvasElement;
  bounds: { minX: number; minY: number; width: number; height: number };
  dark: boolean;
  cardsCount: number;
  selectedKey: string;
}

export const NanoLodCanvas: React.FC<NanoLodCanvasProps> = React.memo(function NanoLodCanvas({
  cards,
  selectedCardIds,
  renderedCardIds,
  pickerSession,
  scale,
  tx,
  ty,
  isDarkMode,
  isOverviewMode = false,
  dotModeThreshold = DEFAULT_OVERVIEW_DOT_THRESHOLD,
  isActive,
  onReady,
  onThumbnailGenerated,
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const pendingThumbGenRef = useRef<Set<string>>(new Set());
  const bakedSnapshotRef = useRef<BakedSnapshot | null>(null);

  // Store latest props in refs to avoid re-binding change listeners on every render
  const cardsRef = useRef(cards);
  cardsRef.current = cards;

  const selectedIdsRef = useRef(selectedCardIds);
  selectedIdsRef.current = selectedCardIds;

  const renderedIdsRef = useRef(renderedCardIds);
  renderedIdsRef.current = renderedCardIds;

  const pickerSessionRef = useRef(pickerSession);
  pickerSessionRef.current = pickerSession;

  const isDarkRef = useRef(isDarkMode);
  isDarkRef.current = isDarkMode;

  const isOverviewModeRef = useRef(isOverviewMode);
  isOverviewModeRef.current = isOverviewMode;

  const dotThresholdRef = useRef(dotModeThreshold);
  dotThresholdRef.current = dotModeThreshold;

  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;

  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  const onThumbGenRef = useRef(onThumbnailGenerated);
  onThumbGenRef.current = onThumbnailGenerated;

  // Builds or retrieves cached static snapshot texture for Overview Mode
  const getOrBuildOverviewSnapshot = (
    currentCards: CardData[],
    dark: boolean,
    selectedSet: Set<string>,
    pickerSession: NanoLodCanvasProps['pickerSession']
  ): BakedSnapshot | null => {
    if (currentCards.length === 0) return null;

    const selectedKey = Array.from(selectedSet).sort().join(',') + (pickerSession ? `_picker_${pickerSession.targetCardId}` : '');
    const cached = bakedSnapshotRef.current;
    if (
      cached &&
      cached.dark === dark &&
      cached.cardsCount === currentCards.length &&
      cached.selectedKey === selectedKey
    ) {
      return cached;
    }

    // 1. Calculate overall world bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < currentCards.length; i++) {
      const card = currentCards[i];
      const dim = getCardSize(card);
      if (card.x < minX) minX = card.x;
      if (card.y < minY) minY = card.y;
      if (card.x + dim.width > maxX) maxX = card.x + dim.width;
      if (card.y + dim.height > maxY) maxY = card.y + dim.height;
    }
    if (minX === Infinity) return null;

    const padding = 100;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;
    const worldW = maxX - minX;
    const worldH = maxY - minY;

    // 2. Determine texture size (bounded to max 2560px)
    const maxTextureEdge = 2560;
    const scaleRatio = Math.min(1.0, maxTextureEdge / Math.max(worldW, worldH));
    const textureW = Math.max(128, Math.min(maxTextureEdge, Math.round(worldW * scaleRatio)));
    const textureH = Math.max(128, Math.min(maxTextureEdge, Math.round(worldH * scaleRatio)));

    let offscreen: HTMLCanvasElement;
    if (cached && cached.canvas) {
      offscreen = cached.canvas;
      if (offscreen.width !== textureW || offscreen.height !== textureH) {
        offscreen.width = textureW;
        offscreen.height = textureH;
      }
    } else {
      offscreen = document.createElement('canvas');
      offscreen.width = textureW;
      offscreen.height = textureH;
    }

    const offCtx = offscreen.getContext('2d');
    if (!offCtx) return null;

    offCtx.clearRect(0, 0, textureW, textureH);
    offCtx.save();
    offCtx.scale(scaleRatio, scaleRatio);
    offCtx.translate(-minX, -minY);

    // Sharp rectangle rendering strictly adhering to card ratio and dimensions
    const colorGenerating = dark ? '#262626' : '#f3f4f6';
    const colorMedia = dark ? '#262626' : '#f3f4f6';
    const colorDraft = dark ? '#262626' : '#f3f4f6';
    const borderNormal = dark ? 'rgba(64, 64, 64, 0.85)' : 'rgba(212, 212, 216, 0.85)';
    const borderSelected = '#3b82f6';
    const normalLineWidth = 1.5 / scaleRatio;
    const selectedLineWidth = 3.5 / scaleRatio;

    for (let i = 0; i < currentCards.length; i++) {
      const card = currentCards[i];
      const dim = getCardSize(card);
      const isSelected = selectedSet.has(card.id);
      const hasMedia = Boolean(
        card.thumbnailUrl || card.imageUrl || card.originalImageUrl || card.trueOriginalImageUrl || card.fileData || card.originalFileData || card.trueOriginalFileData
      );

      // Fill proportional rectangle
      offCtx.fillStyle = card.state === 'generating' ? colorGenerating : hasMedia ? colorMedia : colorDraft;
      offCtx.fillRect(card.x, card.y, dim.width, dim.height);

      // Thumbnail cover if available in cache
      const thumbUrl =
        card.thumbnailUrl ||
        thumbCache.get(card.id) ||
        (card.imageUrl ? thumbCache.get(card.imageUrl) : undefined) ||
        card.imageUrl ||
        card.originalImageUrl;

      let drawSourceImg: HTMLImageElement | null = null;
      if (thumbUrl) {
        drawSourceImg = getOrLoadThumbImage(thumbUrl, scheduleDraw);
      } else if (card.imageUrl && fullImageCache.has(card.imageUrl)) {
        const cachedImg = fullImageCache.get(card.imageUrl);
        if (cachedImg && cachedImg.complete && cachedImg.naturalWidth > 0) {
          drawSourceImg = cachedImg;
        }
      }

      if (drawSourceImg && drawSourceImg.complete && drawSourceImg.naturalWidth > 0) {
        const { sx, sy, sw, sh } = calculateObjectCover(
          drawSourceImg.naturalWidth,
          drawSourceImg.naturalHeight,
          dim.width,
          dim.height
        );
        offCtx.drawImage(drawSourceImg, sx, sy, sw, sh, card.x, card.y, dim.width, dim.height);
      }

      // Proportional rectangle stroke border
      offCtx.strokeStyle = isSelected ? borderSelected : borderNormal;
      offCtx.lineWidth = isSelected ? selectedLineWidth : normalLineWidth;
      offCtx.strokeRect(card.x, card.y, dim.width, dim.height);
    }

    offCtx.restore();

    const result: BakedSnapshot = {
      canvas: offscreen,
      bounds: { minX, minY, width: worldW, height: worldH },
      dark,
      cardsCount: currentCards.length,
      selectedKey,
    };
    bakedSnapshotRef.current = result;
    return result;
  };

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
    const selectedIds = selectedIdsRef.current || [];
    const pickerSession = pickerSessionRef.current;

    // Check if dragging locally in Nano LOD
    const dragging = (window as any).__nanoDragging;

    ctx.save();
    // Normalize to CSS pixel coordinates
    ctx.scale(dpr, dpr);
    // Apply camera world transform
    ctx.translate(currentTx, currentTy);
    ctx.scale(currentScale, currentScale);

    // PERFORMANCE HIGHWAY: In Overview Mode, draw the single baked snapshot texture in O(1) time
    if (isOverviewModeRef.current && !dragging) {
      const selectedSet = new Set<string>(selectedIds);
      const snapshot = getOrBuildOverviewSnapshot(currentCards, dark, selectedSet, pickerSession);
      if (snapshot) {
        ctx.drawImage(
          snapshot.canvas,
          0,
          0,
          snapshot.canvas.width,
          snapshot.canvas.height,
          snapshot.bounds.minX,
          snapshot.bounds.minY,
          snapshot.bounds.width,
          snapshot.bounds.height
        );
      }
      ctx.restore();
      if (onReadyRef.current) {
        onReadyRef.current();
      }
      return;
    }

    // Reset baked snapshot when leaving overview mode to free memory
    if (bakedSnapshotRef.current) {
      bakedSnapshotRef.current = null;
    }

    // Compute visible viewport bounds in world coordinates for instant AABB culling
    const vpLeft = -currentTx / currentScale;
    const vpTop = -currentTy / currentScale;
    const vpRight = (width - currentTx) / currentScale;
    const vpBottom = (height - currentTy) / currentScale;

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

      // Determine real-time dragging position for visibility test
      let cx = card.x;
      let cy = card.y;
      if (dragging) {
        const isThisDragging = dragging.isDraggingSelected 
          ? dragging.selectedCardIds.includes(card.id) 
          : card.id === dragging.cardId;
        if (isThisDragging) {
          cx += dragging.dx;
          cy += dragging.dy;
        }
      }

      // Instant AABB culling with dragging offset
      if (
        cx + dim.width < vpLeft ||
        cx > vpRight ||
        cy + dim.height < vpTop ||
        cy > vpBottom
      ) {
        continue;
      }
      const isSelected = selectedIds.includes(card.id);
      const isPickerTarget = pickerSession?.targetCardId === card.id;
      let isPickerSelected = false;
      if (pickerSession) {
        if (pickerSession.selectedReferences) {
          isPickerSelected = pickerSession.selectedReferences.some(ref => 
            ref.sourceCardId === card.id || 
            (ref.url && (ref.url === card.imageUrl || ref.url === card.originalImageUrl || ref.url === card.thumbnailUrl))
          );
        } else if (pickerSession.selectedCardIds) {
          isPickerSelected = pickerSession.selectedCardIds.includes(card.id);
        }
      }
      
      if (isSelected || isPickerTarget || isPickerSelected) {
        selectedCards.push(card);
      } else {
        unselectedCards.push(card);
      }
    }

    const renderCard = (card: CardData) => {
      // In scale >= threshold, if this card is already mounted in the DOM, skip drawing it on Canvas
      const renderedSet = renderedIdsRef.current;
      if (currentScale >= getNanoLodThreshold() && renderedSet && renderedSet.has(card.id)) {
        return;
      }

      const isSelected = selectedIds.includes(card.id);
      const isPickerTarget = pickerSession?.targetCardId === card.id;
      
      let pickerSelectionIndex = 0;
      if (pickerSession) {
        if (pickerSession.selectedReferences) {
          const idx = pickerSession.selectedReferences.findIndex(ref => 
            ref.sourceCardId === card.id || 
            (ref.url && (ref.url === card.imageUrl || ref.url === card.originalImageUrl || ref.url === card.thumbnailUrl))
          );
          if (idx !== -1) {
            pickerSelectionIndex = idx + 1;
          }
        } else if (pickerSession.selectedCardIds) {
          const idx = pickerSession.selectedCardIds.indexOf(card.id);
          if (idx !== -1) {
            pickerSelectionIndex = idx + 1;
          }
        }
      }
      const isPickerSelected = pickerSelectionIndex > 0;

      const dim = getCardSize(card);

      // --- CALCULATE REALTIME NANO DRAGGING OFFSET ---
      let cardX = card.x;
      let cardY = card.y;
      if (dragging) {
        const isThisDragging = dragging.isDraggingSelected 
          ? dragging.selectedCardIds.includes(card.id) 
          : card.id === dragging.cardId;
        if (isThisDragging) {
          cardX += dragging.dx;
          cardY += dragging.dy;
        }
      }

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

      // 1. Solid Base Fill (sharp straight rectangle for maximum throughput)
      if (isGenerating) {
        ctx.fillStyle = colorGenerating;
      } else if (hasMedia) {
        ctx.fillStyle = colorMedia;
      } else {
        ctx.fillStyle = colorDraft;
      }
      ctx.fillRect(cardX, cardY, dim.width, dim.height);

      // 2. Draw Ultra-Low-Resolution Thumbnail or cached Image (with Object-Cover preservation)
      let hasDrawnThumbnail = false;
      const thumbUrl =
        card.thumbnailUrl ||
        thumbCache.get(card.id) ||
        (card.imageUrl ? thumbCache.get(card.imageUrl) : undefined) ||
        card.imageUrl ||
        card.originalImageUrl;

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
        ctx.drawImage(drawSourceImg, sx, sy, sw, sh, cardX, cardY, dim.width, dim.height);
        // Add dark filter for videos in Nano LOD to match Micro LOD's bg-black/25
        if (card.isVideo) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
          ctx.fillRect(cardX, cardY, dim.width, dim.height);
        }
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

      // 3. Border (sharp straight rectangle stroke)
      if (isPickerSelected) {
        ctx.strokeStyle = borderPickerSelected;
        ctx.lineWidth = pickerSelectedLineWidth;
      } else if (isPickerTarget) {
        ctx.strokeStyle = borderPickerTarget;
        ctx.lineWidth = selectedLineWidth;
      } else if (isSelected) {
        ctx.strokeStyle = borderSelected;
        ctx.lineWidth = selectedLineWidth;
      } else {
        ctx.strokeStyle = borderNormal;
        ctx.lineWidth = normalLineWidth;
      }
      ctx.strokeRect(cardX, cardY, dim.width, dim.height);

      // 4. Center indicator / video play badge
      const screenW = dim.width * currentScale;

      if (card.isVideo && screenW >= 12) {
        // Video Thumbnail Overlay: semi-transparent circular badge with play triangle
        const cx = cardX + dim.width / 2;
        const cy = cardY + dim.height / 2;
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
        const cx = cardX + dim.width / 2;
        const cy = cardY + dim.height / 2;
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
        ctx.rect(cardX + padding, cardY + padding, badgeSize, badgeSize);
        ctx.fill();
        
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pickerSelectionIndex.toString(), cardX + padding + badgeSize / 2, cardY + padding + badgeSize / 2 + (1/currentScale));
      } else if (isPickerTarget && screenW >= 40) {
        // Draw "当前目标" badge
        const fontSize = Math.max(10 / currentScale, 8);
        const paddingX = Math.max(8 / currentScale, 4);
        const paddingY = Math.max(4 / currentScale, 2);
        
        ctx.font = `bold ${fontSize}px sans-serif`;
        const metrics = ctx.measureText("当前目标");
        const w = metrics.width + paddingX * 2;
        const h = fontSize + paddingY * 2;
        
        const badgeX = cardX - paddingX;
        const badgeY = cardY - h;
        
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
  }, [cards, selectedCardIds, renderedCardIds, pickerSession, isDarkMode, isOverviewMode, dotModeThreshold, isActive]);

  // Listen to custom nano dragging event for local, non-react repaint
  useEffect(() => {
    if (!isActive) return;
    const handleNanoDragging = () => {
      scheduleDraw();
    };
    window.addEventListener('nano-dragging', handleNanoDragging);
    return () => {
      window.removeEventListener('nano-dragging', handleNanoDragging);
    };
  }, [isActive]);

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
