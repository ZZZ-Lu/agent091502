import React, { useState, useRef, useEffect } from 'react';
import { motion, MotionValue, useTransform, useMotionValue, animate, AnimatePresence } from 'motion/react';

interface AgentCursorProps {
  agentState: {
    x: number;
    y: number;
    visible: boolean;
    isActive: boolean;
    isMoving: boolean;
    speak?: string;
  };
  transform: {
    tx: MotionValue<number>;
    ty: MotionValue<number>;
    tScale: MotionValue<number>;
  };
  isIdle?: boolean;
  isZooming?: boolean;
  onDragAgent?: (newCanvasX: number, newCanvasY: number) => void;
}

const CURSOR_FLOAT_VARIANTS = {
  floating: {
    y: [0, -6],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      repeatType: 'reverse' as const,
      ease: 'easeInOut',
    },
  },
  still: {
    y: 0,
    transition: {
      duration: 0.2,
      ease: 'easeOut',
    },
  },
};

export function AgentCursor({ agentState, transform, isIdle = true, isZooming = false, onDragAgent }: AgentCursorProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ pointerX: number; pointerY: number; startCanvasX: number; startCanvasY: number } | null>(null);

  // Animate the agent's canvas position smoothly when moved programmatically
  const agentCanvasX = useMotionValue(agentState.x);
  const agentCanvasY = useMotionValue(agentState.y);

  useEffect(() => {
    if (isDragging) {
      agentCanvasX.set(agentState.x);
      agentCanvasY.set(agentState.y);
    } else {
      const transition = isZooming 
        ? { type: 'tween', duration: 0.15, ease: 'easeOut' }
        : agentState.isMoving 
          ? { type: 'spring', damping: 28, stiffness: 450, mass: 0.35 }
          : { duration: 0 };
          
      animate(agentCanvasX, agentState.x, transition as any);
      animate(agentCanvasY, agentState.y, transition as any);
    }
  }, [agentState.x, agentState.y, isDragging, isZooming, agentState.isMoving, agentCanvasX, agentCanvasY]);

  // Derive screen position instantly from canvas position and viewport transform
  const targetScreenX = useTransform(
    [agentCanvasX, transform.tx, transform.tScale],
    ([ax, tx, s]: any[]) => ax * s + tx
  );
  
  const targetScreenY = useTransform(
    [agentCanvasY, transform.ty, transform.tScale],
    ([ay, ty, s]: any[]) => ay * s + ty
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    setIsDragging(true);
    dragStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      startCanvasX: agentState.x,
      startCanvasY: agentState.y
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !dragStartRef.current) return;
    e.stopPropagation();
    e.preventDefault();

    const dx = (e.clientX - dragStartRef.current.pointerX) / transform.tScale.get();
    const dy = (e.clientY - dragStartRef.current.pointerY) / transform.tScale.get();

    const newX = dragStartRef.current.startCanvasX + dx;
    const newY = dragStartRef.current.startCanvasY + dy;

    onDragAgent?.(newX, newY);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    e.stopPropagation();
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    setIsDragging(false);
    dragStartRef.current = null;
  };

  return (
    <motion.div
      className="fixed top-0 left-0 z-[9999] flex items-start select-none"
      style={{ x: targetScreenX, y: targetScreenY }}
      initial={false}
      animate={{ 
        opacity: agentState.visible ? 1 : 0,
        scale: agentState.isActive ? 0.9 : isDragging ? 1.08 : 1
      }}
      transition={{ 
        opacity: { duration: 0.2 },
        scale: { type: 'spring', damping: 15, stiffness: 200 }
      }}
    >
      <motion.div
        className="relative group cursor-grab active:cursor-grabbing p-2 -m-2 touch-none pointer-events-auto"
        variants={CURSOR_FLOAT_VARIANTS}
        animate={!isDragging && isIdle ? 'floating' : 'still'}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <svg
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="drop-shadow-lg relative z-10 transition-transform group-hover:scale-110 active:scale-95"
          style={{ marginLeft: '-4.5px', marginTop: '-3.5px' }}
        >
          <path
            d="M4.5 3.5L19.5 11.5L12 13L10.5 20.5L4.5 3.5Z"
            fill="#8b5cf6" 
            stroke="white"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      </motion.div>
      
      {/* Speaking Text UI without bubble */}
      <AnimatePresence mode="wait">
        {agentState.speak && (
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0 }}
            className="absolute left-8 top-8 z-0 pointer-events-none whitespace-nowrap overflow-hidden"
          >
            <motion.p
              initial={{ display: 'none' }}
              animate={{ display: 'block' }}
              className="text-[13px] font-medium text-slate-700 dark:text-slate-200 drop-shadow-md tracking-wide"
              style={{ textShadow: '0 1px 2px rgba(0,0,0,0.1), 0 0 8px rgba(255,255,255,0.8)' }}
            >
              {agentState.speak}
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}


