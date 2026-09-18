import React, { useState, useEffect, useRef } from 'react';

interface FpsCounterProps {
  hasActiveTask?: boolean;
}

/**
 * High-performance, zero-overhead real-time FPS Counter.
 * Highly polished visual design: smooth indicator color transitioning, micro-pill structure,
 * and automatic visual collision avoidance (shifts up when the Agent Task window is open).
 */
export const FpsCounter: React.FC<FpsCounterProps> = ({ hasActiveTask = false }) => {
  const [fps, setFps] = useState<number>(60);
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;

    const tick = () => {
      if (!active) return;
      frameCountRef.current++;
      
      const now = performance.now();
      const elapsed = now - lastTimeRef.current;
      
      if (elapsed >= 500) { // Recalculate every 500ms for readable visual stability
        const calculatedFps = Math.round((frameCountRef.current * 1000) / elapsed);
        setFps(calculatedFps);
        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }
      
      rafIdRef.current = requestAnimationFrame(tick);
    };

    rafIdRef.current = requestAnimationFrame(tick);

    return () => {
      active = false;
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  return (
    <div 
      id="fps-counter"
      className={`fixed right-6 z-[100] flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100/90 dark:bg-neutral-800/90 backdrop-blur-md border border-gray-200/80 dark:border-[#404040]/80 shadow-md rounded-[16px] text-[10px] font-bold font-mono select-none transition-all duration-300 ${
        hasActiveTask ? 'bottom-[195px]' : 'bottom-6'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${
        fps >= 58 ? 'bg-emerald-500 animate-pulse' :
        fps >= 45 ? 'bg-teal-500' :
        fps >= 30 ? 'bg-amber-500' :
        'bg-red-500'
      }`} />
      <span className="text-gray-400 dark:text-neutral-500">FPS:</span>
      <span className="text-gray-700 dark:text-neutral-200">{fps}</span>
    </div>
  );
};
