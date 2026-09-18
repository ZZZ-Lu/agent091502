import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { AgentCursor } from './components/AgentCursor';
import { AgentContextMenu } from './components/AgentContextMenu';
import { GenerationCard, CardData, CARD_DIMENSIONS, getCardSize } from './components/GenerationCard';
import { NanoLodCanvas } from './components/NanoLodCanvas';
import { FpsCounter } from './components/FpsCounter';
import { generateImageThumbnail, generateVideoThumbnail, getOrCreateMediaThumbnail, MAX_THUMBNAIL_EDGE } from './utils/thumbnail';
import { fastGetImageDimensions } from './utils/imageHeader';
import { isCardIntersectingRectangle, getLodMountQuota } from './utils/viewportCulling';
import { Plus, Minus, Undo2, Redo2, Bot, Sun, Moon, Settings, RefreshCw, Sparkles, Send, X } from 'lucide-react';
import { loadCards, saveCards, deleteCardsForProject, requestPersistence, loadAgentTraces, saveAgentTraces } from './db';
import { SettingsPage } from './components/SettingsPage';
import { ProjectScriptBible } from './components/ProjectScriptBible';
import { ScriptProject, DEFAULT_PROJECT } from './types/script';
import { ScriptView } from './agent/scriptTools';
import type { AgentToolCall, AgentTurnResult } from './agent/protocol';
import { AgentRuntime, type RuntimeTask } from './agent/runtime';
import { snapshotRuntimeTask, type AgentRuntimeTrace } from './agent/debugTrace';
import { assetExtractionService } from './services/assetExtractionService';
import { AGENT_TOOL_REGISTRY, getAgentToolConfig } from './agent/toolRegistry';
import { getPageComponentDefinition, type MouseActionName } from './agent/pageComponentRegistry';
import { AnimatePresence, motion, useMotionValue, animate, useMotionTemplate, useMotionValueEvent, useTransform } from 'motion/react';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Reads only the portion of a textarea that is currently rendered in its
 * viewport. The temporary mirror is measurement infrastructure, never state:
 * the full textarea value is not returned to the Agent or persisted here.
 */
const getVisibleTextareaSnapshot = (textarea: HTMLTextAreaElement) => {
  const { value, scrollTop, clientHeight, scrollHeight } = textarea;
  const empty = {
    visibleText: '',
    characterRange: { start: 0, end: 0 },
    scroll: { top: 0, height: scrollHeight, viewportHeight: clientHeight, atTop: true, atBottom: true },
  };
  if (!value) return empty;

  const style = window.getComputedStyle(textarea);
  const mirror = document.createElement('div');
  const copiedProperties = [
    'boxSizing', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
    'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'lineHeight',
    'textTransform', 'wordSpacing', 'wordBreak', 'wordWrap', 'tabSize',
  ] as const;
  mirror.style.position = 'fixed';
  mirror.style.left = '-100000px';
  mirror.style.top = '0';
  mirror.style.visibility = 'hidden';
  mirror.style.pointerEvents = 'none';
  mirror.style.overflow = 'hidden';
  mirror.style.width = `${textarea.clientWidth}px`;
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.overflowWrap = 'break-word';
  copiedProperties.forEach(property => { mirror.style[property] = style[property]; });
  const textNode = document.createTextNode(value);
  mirror.appendChild(textNode);
  document.body.appendChild(mirror);

  try {
    const mirrorTop = mirror.getBoundingClientRect().top;
    const topAt = (offset: number) => {
      const safe = Math.min(Math.max(offset, 0), Math.max(value.length - 1, 0));
      const range = document.createRange();
      range.setStart(textNode, safe);
      range.setEnd(textNode, Math.min(safe + 1, value.length));
      const rect = range.getClientRects()[0];
      return (rect?.top ?? mirror.scrollHeight) - mirrorTop;
    };
    const firstAtOrAfter = (verticalOffset: number) => {
      let low = 0;
      let high = value.length;
      while (low < high) {
        const middle = Math.floor((low + high) / 2);
        if (topAt(middle) < verticalOffset) low = middle + 1;
        else high = middle;
      }
      return low;
    };
    const start = firstAtOrAfter(Math.max(0, scrollTop - 2));
    const end = Math.min(value.length, Math.max(start, firstAtOrAfter(scrollTop + clientHeight + 2) + 1));
    return {
      visibleText: value.slice(start, Math.min(end, start + 2000)),
      characterRange: { start, end: Math.min(end, start + 2000) },
      scroll: {
        top: Math.round(scrollTop),
        height: Math.round(scrollHeight),
        viewportHeight: Math.round(clientHeight),
        atTop: scrollTop <= 1,
        atBottom: scrollTop + clientHeight >= scrollHeight - 2,
      },
    };
  } finally {
    mirror.remove();
  }
};

type AgentTaskLog = {
  id: string;
  title: string;
  status: 'running' | 'completed' | 'failed' | 'waiting_user' | 'paused' | 'cancelled';
  events: Array<{ id: string; text: string; kind: 'work' | 'tool' | 'answer' }>;
};

type ScriptSelection = {
  text: string;
  start: number;
  end: number;
  lineStart: number;
  lineEnd: number;
} | null;

interface MediaDimensions {
  width: number;
  height: number;
}

const getImageDimensions = (url: string): Promise<MediaDimensions> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 420, height: 560 });
    img.src = url;
  });
};

const getVideoDimensions = (url: string): Promise<MediaDimensions> => {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => resolve({ width: video.videoWidth, height: video.videoHeight });
    video.onerror = () => resolve({ width: 640, height: 360 });
    video.src = url;
  });
};

const compressAndResizeImage = (file: File, maxDim = 1200, quality = 0.85): Promise<Blob> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.naturalWidth;
        let height = img.naturalHeight;
        
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          canvas.toBlob((blob) => {
            resolve(blob || file);
          }, mimeType, quality);
        } else {
          resolve(file);
        }
      };
      img.onerror = () => resolve(file);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
};

const getClosestAspectRatio = (width: number, height: number): '1:1' | '3:4' | '9:16' | '16:9' => {
  if (!width || !height) return '3:4';
  const fileRatio = width / height;
  const presets: { ratio: '1:1' | '3:4' | '9:16' | '16:9'; value: number }[] = [
    { ratio: '1:1', value: 1.0 },
    { ratio: '3:4', value: 0.75 },
    { ratio: '9:16', value: 0.5625 },
    { ratio: '16:9', value: 1.7778 }
  ];

  let closestRatio: '1:1' | '3:4' | '9:16' | '16:9' = '3:4';
  let minDiff = Infinity;

  presets.forEach((preset) => {
    const diff = Math.abs(fileRatio - preset.value);
    if (diff < minDiff) {
      minDiff = diff;
      closestRatio = preset.ratio;
    }
  });

  return closestRatio;
};

// Isolated Zoom Indicator HUD: Subscribes to tScale without triggering App root re-renders
const ZoomControlGroup: React.FC<{
  tScale: any;
  isOverviewMode: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
}> = React.memo(({ tScale, isOverviewMode, onZoomIn, onZoomOut, onZoomReset }) => {
  const [scaleVal, setScaleVal] = useState(() => tScale.get());

  useEffect(() => {
    let rafId: number | null = null;
    const unsub = tScale.on('change', (s: number) => {
      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          rafId = null;
          setScaleVal(s);
        });
      }
    });
    return () => {
      unsub();
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [tScale]);

  const pct = Math.round(scaleVal * 100);
  let text = "";
  let colorClass = "";
  if (pct < 60) {
    text = "远景";
    colorClass = "text-blue-500 dark:text-blue-400";
  } else if (pct < 100) {
    text = "中景";
    colorClass = "text-emerald-500 dark:text-emerald-400";
  } else if (pct < 200) {
    text = "近景";
    colorClass = "text-amber-500 dark:text-amber-400";
  } else {
    text = "特写";
    colorClass = "text-rose-500 dark:text-rose-400";
  }

  return (
    <div 
      className="fixed bottom-6 left-6 z-50 flex items-center bg-gray-100/90 dark:bg-neutral-800/90 backdrop-blur-md border border-gray-200/80 dark:border-[#404040]/80 shadow-md rounded-[20px] corner-squircle p-1.5 gap-1 select-none"
      onPointerDown={e => e.stopPropagation()}
    >
      <button
        onClick={onZoomOut}
        disabled={isOverviewMode}
        className="p-1.5 rounded-xl corner-squircle hover:bg-gray-200 dark:hover:bg-neutral-700 disabled:opacity-40 transition-colors"
        title="缩小"
      >
        <Minus className="w-3.5 h-3.5 text-gray-700 dark:text-neutral-300" />
      </button>
      
      <button
        onClick={onZoomReset}
        className="px-2 py-1 rounded-xl corner-squircle hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors text-[11px] font-bold font-mono text-gray-800 dark:text-neutral-200 min-w-[54px] flex items-center justify-center gap-1.5"
        title="重置到 100%"
      >
        {isOverviewMode ? (
          <span className="text-blue-500 dark:text-blue-400 font-semibold tracking-wide">
            全景
          </span>
        ) : (
          <>
            <span className={colorClass}>{text}</span>
            <span>{pct}%</span>
          </>
        )}
      </button>

      <button
        onClick={onZoomIn}
        disabled={scaleVal >= 4.99}
        className="p-1.5 rounded-xl corner-squircle hover:bg-gray-200 dark:hover:bg-neutral-700 disabled:opacity-40 transition-colors"
        title="放大"
      >
        <Plus className="w-3.5 h-3.5 text-gray-700 dark:text-neutral-300" />
      </button>
    </div>
  );
});

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Replace useState with useMotionValue for high-frequency transforms
  const initialTransform = useMemo(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('canvas_transform');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) { }
      }
    }
    return { x: 0, y: 0, scale: 1 };
  }, []);

  const tx = useMotionValue(initialTransform.x);
  const ty = useMotionValue(initialTransform.y);
  const tScale = useMotionValue(initialTransform.scale);
  
  // Create derived motion values for the infinite background grid
  const gridBackgroundPosition = useMotionTemplate`${tx}px ${ty}px`;
  const gridBackgroundSize = useTransform(tScale, (s: any) => `${s * 48}px ${s * 48}px`);

  // Inject real-time scale as CSS variable for GPU-accelerated constant-width borders
  const updateCurrentScale = (latestScale: number) => {
    const workspace = document.getElementById('canvas-workspace');
    if (workspace) {
      workspace.style.setProperty('--current-scale', latestScale.toString());
    }
  };
  
  useMotionValueEvent(tScale, "change", updateCurrentScale);
  
  // Set initial scale on mount
  useEffect(() => {
    updateCurrentScale(tScale.get());
  }, []);

  const transformValues = useMemo(() => ({ tx, ty, tScale }), [tx, ty, tScale]);
  const targetTransform = useRef({ x: initialTransform.x, y: initialTransform.y, scale: initialTransform.scale });

  // Load canvas transform per project
  // DEFERRED to a child component or moved down where currentProjectId is defined.
  // For now, we will just use a generic motion value init, and we will sync the values later down in the file.

  // Debounced persistence for transform
  // We will handle the actual saving in a separate useEffect below once currentProjectId is defined.
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const saveTransform = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        const data = JSON.stringify({ x: tx.get(), y: ty.get(), scale: tScale.get() });
        // Legacy fallback only for now, actual project-specific save happens below
        localStorage.setItem('canvas_transform', data); 
      }, 300);
    };
    const unsubX = tx.on('change', saveTransform);
    const unsubY = ty.on('change', saveTransform);
    const unsubS = tScale.on('change', saveTransform);
    return () => { unsubX(); unsubY(); unsubS(); clearTimeout(timeout); };
  }, [tx, ty, tScale]);

  // Theme State
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme_mode');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  const [showSettings, setShowSettings] = useState(false);
  const showSettingsRef = useRef(showSettings);
  useEffect(() => {
    showSettingsRef.current = showSettings;
  }, [showSettings]);

  const [isOverviewMode, setIsOverviewMode] = useState(false);
  const isOverviewModeRef = useRef(false);
  const preOverviewTransform = useRef<{ x: number, y: number, scale: number } | null>(null);
  const isSpacePressedRef = useRef(false);
  const wheelZoomOutAccumulatorRef = useRef(0);
  const [showOverviewPromptToast, setShowOverviewPromptToast] = useState(false);
  const [overviewPromptProgress, setOverviewPromptProgress] = useState(0);
  const overviewToastTimerRef = useRef<NodeJS.Timeout | null>(null);
  const resetOverviewPromptRef = useRef<() => void>(() => {});
  const enterOverviewModeRef = useRef<() => void>(() => {});
  const exitOverviewToOriginalRef = useRef<() => void>(() => {});

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    localStorage.setItem('theme_mode', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // Projects & Script Bible State
  const [projects, setProjects] = useState<ScriptProject[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('script_projects');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          // Filter out legacy sample project if present
          const filtered = Array.isArray(parsed) 
            ? parsed.filter((p: ScriptProject) => p && p.id !== 'proj_blackstone_night' && p.name !== '黑石之夜')
            : [];
          if (filtered.length > 0) {
            return filtered.map((p: Partial<ScriptProject>) => ({
              ...DEFAULT_PROJECT,
              ...p,
              characters: Array.isArray(p.characters) ? p.characters : [],
              locations: Array.isArray(p.locations) ? p.locations : [],
              props: Array.isArray(p.props) ? p.props : [],
              scenes: Array.isArray(p.scenes) ? p.scenes : [],
              scriptText: typeof p.scriptText === 'string' ? p.scriptText : '',
              universe: { ...DEFAULT_PROJECT.universe, ...(p.universe || {}) },
            }));
          }
        } catch (e) {
          console.error('Failed to parse saved projects', e);
        }
      }
    }
    return [DEFAULT_PROJECT];
  });

  const [currentProjectId, setCurrentProjectId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const savedId = localStorage.getItem('current_project_id');
      if (savedId && savedId !== 'proj_blackstone_night') return savedId;
    }
    return DEFAULT_PROJECT.id;
  });
  const rawProject = projects.find(p => p.id === currentProjectId) || projects[0] || DEFAULT_PROJECT;
  const currentProject = useMemo<ScriptProject>(() => ({
    ...DEFAULT_PROJECT,
    ...rawProject,
    characters: Array.isArray(rawProject.characters) ? rawProject.characters : [],
    locations: Array.isArray(rawProject.locations) ? rawProject.locations : [],
    props: Array.isArray(rawProject.props) ? rawProject.props : [],
    scenes: Array.isArray(rawProject.scenes) ? rawProject.scenes : [],
    scriptText: typeof rawProject.scriptText === 'string' ? rawProject.scriptText : '',
    universe: { ...DEFAULT_PROJECT.universe, ...(rawProject.universe || {}) },
  }), [rawProject]);

  const [isScriptDrawerOpen, setIsScriptDrawerOpen] = useState(false);
  const [isScriptTocOpen, setIsScriptTocOpen] = useState(false);
  const [isScriptTocAtBottom, setIsScriptTocAtBottom] = useState(false);
  const [tocScrollRequest, setTocScrollRequest] = useState<{ id: number; delta: number } | null>(null);
  const [scriptViewRequest, setScriptViewRequest] = useState<ScriptView>('script');
  const [requestedTocItemId, setRequestedTocItemId] = useState<string | null>(null);
  const [scriptSelection, setScriptSelection] = useState<ScriptSelection>(null);
  const scriptViewRef = useRef({ drawerOpen: false, tocOpen: false, tocAtBottom: false, activeView: 'script' as ScriptView, activeEpisodeId: null as string | null });
  const [agentTask, setAgentTask] = useState<AgentTaskLog | null>(null);
  const agentTaskScrollRef = useRef<HTMLDivElement>(null);
  const [isTaskChatOpen, setIsTaskChatOpen] = useState(false);
  const [taskChatMessage, setTaskChatMessage] = useState('');
  const taskChatInputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (agentTaskScrollRef.current) {
      agentTaskScrollRef.current.scrollTop = agentTaskScrollRef.current.scrollHeight;
    }
  }, [agentTask?.events]);
  const [agentRuntimeTraces, setAgentRuntimeTraces] = useState<AgentRuntimeTrace[]>([]);
  
  useEffect(() => {
    loadAgentTraces().then(saved => {
      if (saved && saved.length > 0) setAgentRuntimeTraces(saved);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (agentRuntimeTraces.length > 0) {
      saveAgentTraces(agentRuntimeTraces).catch(console.error);
    }
  }, [agentRuntimeTraces]);

  // An Agent may act only on a target it has actually received from page.inspect.
  // This closes the gap between a semantic target registry and human-visible UI.
  const observedTargetsByTaskRef = useRef(new Map<string, Set<string>>());

  const setDrawerOpen = useCallback((open: boolean) => {
    scriptViewRef.current.drawerOpen = open;
    setIsScriptDrawerOpen(open);
    if (!open) {
      scriptViewRef.current.tocOpen = false;
      setIsScriptTocOpen(false);
      setScriptSelection(null);
    }
  }, []);
  const setTocOpen = useCallback((open: boolean) => {
    scriptViewRef.current.tocOpen = open;
    setIsScriptTocOpen(open);
  }, []);
  const setTocAtBottom = useCallback((atBottom: boolean) => {
    scriptViewRef.current.tocAtBottom = atBottom;
    setIsScriptTocAtBottom(atBottom);
  }, []);

  useEffect(() => {
    scriptViewRef.current = {
      drawerOpen: isScriptDrawerOpen,
      tocOpen: isScriptTocOpen,
      tocAtBottom: isScriptTocAtBottom,
      activeView: scriptViewRef.current.activeView,
      activeEpisodeId: scriptViewRef.current.activeEpisodeId,
    };
  }, [isScriptDrawerOpen, isScriptTocOpen, isScriptTocAtBottom]);

  const setScriptView = useCallback((view: ScriptView) => {
    scriptViewRef.current.activeView = view;
    setScriptViewRequest(view);
  }, []);

  const handleTocItemOpened = useCallback((item: { id: string; type: string }) => {
    scriptViewRef.current.activeEpisodeId = item.type === 'episode' ? item.id : null;
    setRequestedTocItemId(null);
  }, []);

  // Sync projects to localStorage
  useEffect(() => {
    localStorage.setItem('script_projects', JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    localStorage.setItem('current_project_id', currentProjectId);
  }, [currentProjectId]);

  const handleRenameProject = (projectId: string, newName: string) => {
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, name: newName, updatedAt: Date.now() } : p));
  };

  const handleUpdateCurrentProject = (updated: Partial<ScriptProject>) => {
    setProjects(prev => prev.map(p => p.id === currentProject.id ? { ...p, ...updated, updatedAt: Date.now() } : p));
  };

  const handleRequestGenerateAsset = (assetName: string, promptText: string) => {
    const centerX = (window.innerWidth / 2 - tx.get()) / tScale.get();
    const centerY = (window.innerHeight / 2 - ty.get()) / tScale.get();

    const newId = Math.random().toString(36).substring(2, 11);
    const newCard: CardData = {
      id: newId,
      x: centerX - 210,
      y: centerY - 280,
      state: 'draft',
      ratio: '3:4',
      res: '2K',
      prompt: promptText,
      imageUrl: null
    };

    setCards(prev => [...prev, newCard]);
    setSelectedCardIds([newId]);
    setDrawerOpen(false);
  };

  const [isDragging, setIsDragging] = useState(false);
  const [isZooming, setIsZooming] = useState(false);
  const isZoomingRef = useRef(false);
  const zoomTimeoutRef = useRef<NodeJS.Timeout>();
  const doubleClickTimeoutRef = useRef<NodeJS.Timeout>();
  const lastPointer = useRef({ x: 0, y: 0 });
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [selectionBox, setSelectionBox] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    initialSelectedIds: string[];
  } | null>(null);

  // Agent State
  const [agentState, setAgentState] = useState<{
    x: number;
    y: number;
    visible: boolean;
    isActive: boolean;
    isMoving: boolean;
    speak?: string;
  }>(() => ({ 
    x: typeof window !== 'undefined' ? window.innerWidth - 80 : 0, 
    y: typeof window !== 'undefined' ? window.innerHeight - 150 : 0, 
    visible: true, 
    isActive: false,
    isMoving: false
  }));
  const [isAgentRunning, setIsAgentRunning] = useState(false);
  const [agentPrompt, setAgentPrompt] = useState("");
  const [agentQuestion, setAgentQuestion] = useState<{ question: string, resolve: (val: string) => void } | null>(null);
  const [isAgentThinking, setIsAgentThinking] = useState(false);

  const isUserPointerDownRef = useRef(false);
  const runtimeRef = useRef<AgentRuntime | null>(null);
  const activeTaskIdRef = useRef<string | null>(null);

  useEffect(() => {
    const onDown = () => { isUserPointerDownRef.current = true; };
    const onUp = () => { isUserPointerDownRef.current = false; };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, []);

  const panToCanvasPos = (canvasX: number, canvasY: number) => {
    if (isUserPointerDownRef.current) return;
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') && !activeEl.hasAttribute('data-agent-target')) return;
    
    const targetTx = window.innerWidth / 2 - canvasX * tScale.get();
    const targetTy = window.innerHeight / 2 - canvasY * tScale.get();
    
    targetTransform.current.x = targetTx;
    targetTransform.current.y = targetTy;

    animate(tx, targetTx, { duration: 0.4, ease: [0.33, 1, 0.68, 1] });
    animate(ty, targetTy, { duration: 0.4, ease: [0.33, 1, 0.68, 1] });
  };

  // State for Cards & History
  const [isLoading, setIsLoading] = useState(true);
  const [history, setHistory] = useState<{ past: CardData[][], present: CardData[], future: CardData[][] }>({
    past: [],
    present: [],
    future: []
  });
  const cards = history.present;
  const cardsRef = useRef<CardData[]>(cards);
  cardsRef.current = cards;
  const clipboardRef = useRef<CardData[]>([]);

  // Canvas Reference Picker Session State
  const [pickerSession, setPickerSession] = useState<{
    targetCardId: string;
    selectedCardIds: string[];
    initialCamera: { x: number; y: number; scale: number };
  } | null>(null);
  const pickerSessionRef = useRef(pickerSession);
  pickerSessionRef.current = pickerSession;

  const nanoDragRef = useRef<{
    cardId: string;
    startX: number;
    startY: number;
    didMove: boolean;
    initialCards: { id: string; x: number; y: number }[];
  } | null>(null);
  const loadedProjectIdRef = useRef<string | null>(null);

  const setCards = (updater: CardData[] | ((prev: CardData[]) => CardData[]), pushToHistory = true) => {
    setHistory(curr => {
      const nextPresent = typeof updater === 'function' ? updater(curr.present) : updater;
      if (pushToHistory) {
        const newPast = [...curr.past, curr.present].slice(-50); // limit history length to 50
        return { past: newPast, present: nextPresent, future: [] };
      } else {
        return { ...curr, present: nextPresent };
      }
    });
  };

  // --- Local File Drag and Drop Support ---
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Simple validation to ensure drag is actually leaving the container
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      if (
        e.clientX < rect.left ||
        e.clientX >= rect.right ||
        e.clientY < rect.top ||
        e.clientY >= rect.bottom
      ) {
        setIsDragOver(false);
      }
    } else {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (!e.dataTransfer || !e.dataTransfer.files) return;
    const files = Array.from(e.dataTransfer.files) as File[];
    if (files.length === 0) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Calculate canvas drop coordinates
    const dropClientX = e.clientX;
    const dropClientY = e.clientY;
    const dropCanvasX = (dropClientX - tx.get()) / tScale.get();
    const dropCanvasY = (dropClientY - ty.get()) / tScale.get();

    // Step 1: Ultra-fast header parsing (<1ms per image) to get true aspect ratio immediately
    const cardInitPromises = files.map(async (file, index) => {
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      if (!isImage && !isVideo) return null;

      const fileUrl = URL.createObjectURL(file);
      let width = 0;
      let height = 0;

      try {
        if (isImage) {
          const dims = await fastGetImageDimensions(file);
          width = dims.width;
          height = dims.height;
        } else if (isVideo) {
          const dims = await getVideoDimensions(fileUrl);
          width = dims.width;
          height = dims.height;
        }
      } catch (err) {
        console.warn('Fast dimensions parsing failed, fallback:', err);
      }

      // Preserve natural aspect ratio and scale to standard visual area
      const ratio = getClosestAspectRatio(width, height);
      let customWidth: number | undefined;
      let customHeight: number | undefined;
      if (width > 0 && height > 0) {
        const TARGET_AREA = 230400; // 480x480 standard equivalent
        const scaleFactor = Math.sqrt(TARGET_AREA / (width * height));
        customWidth = Math.round(width * scaleFactor);
        customHeight = Math.round(height * scaleFactor);
      }

      const dim = customWidth && customHeight ? { width: customWidth, height: customHeight } : CARD_DIMENSIONS[ratio];
      const newId = Math.random().toString(36).substring(2, 11);
      const offset = index * 40;

      // Card is created immediately at the exact aspect ratio with the image visible!
      const initialCard: CardData = {
        id: newId,
        x: dropCanvasX - dim.width / 2 + offset,
        y: dropCanvasY - dim.height / 2 + offset,
        state: 'generating', // shows the sleek loading spinner overlay on top of the image
        ratio: ratio,
        res: '2K',
        prompt: `Dropped local ${isVideo ? 'video' : 'image'}: ${file.name}`,
        imageUrl: fileUrl, // Visible on the canvas instantly!
        isVideo: isVideo,
        customWidth: customWidth,
        customHeight: customHeight,
        fileName: file.name,
        nativeWidth: width,
        nativeHeight: height,
      };

      return {
        card: initialCard,
        file,
        fileUrl,
        isImage,
        isVideo,
        width,
        height,
      };
    });

    const parsedItems = (await Promise.all(cardInitPromises)).filter(Boolean);
    if (parsedItems.length === 0) return;

    // Immediately place all cards on canvas with their true aspect ratio and visible image!
    const initialCards = parsedItems.map(item => item!.card);
    setCards(prev => [...prev, ...initialCards]);
    setSelectedCardIds(initialCards.map(c => c.id));

    // Step 2: Background processing (non-blocking) - compress preview, check texture limits, generate thumbnails
    parsedItems.forEach(async (item) => {
      if (!item) return;
      const { file, fileUrl, isImage, isVideo, width, height, card } = item;

      let processedFile: Blob = file;
      let originalFileData: Blob | undefined = undefined;
      let trueOriginalFileData: Blob | undefined = undefined;
      let originalImageUrl: string | undefined = undefined;
      let trueOriginalImageUrl: string | undefined = undefined;

      if (isImage) {
        try {
          // Generate 1200px preview for optimal performance when zoomed
          processedFile = await compressAndResizeImage(file, 1200);

          // Check if original is > 4K (4096px) (GPU texture limit safety & LOD optimization)
          const MAX_TEXTURE_DIM = 4096;
          if (width > MAX_TEXTURE_DIM || height > MAX_TEXTURE_DIM) {
            trueOriginalFileData = file;
            trueOriginalImageUrl = fileUrl;

            // Create a safe 4K proxy for the "original" view in the UI to prevent GPU crashes and optimize VRAM
            originalFileData = await compressAndResizeImage(file, MAX_TEXTURE_DIM, 0.9);
            originalImageUrl = URL.createObjectURL(originalFileData);
          } else {
            // Under 4K, original file is proxy itself
            originalFileData = file;
            originalImageUrl = fileUrl;
          }
        } catch (err) {
          console.error("Failed to process image in background", err);
          processedFile = await compressAndResizeImage(file, 1200);
          originalFileData = file;
          originalImageUrl = fileUrl;
        }
      }

      const processedFileUrl = URL.createObjectURL(processedFile);

      let thumbnailUrl: string | undefined;
      try {
        if (isVideo) {
          thumbnailUrl = await generateVideoThumbnail(processedFile, MAX_THUMBNAIL_EDGE);
        } else {
          thumbnailUrl = await generateImageThumbnail(processedFile, MAX_THUMBNAIL_EDGE);
        }
      } catch (thumbErr) {
        console.warn('Could not pre-generate thumbnail on drop:', thumbErr);
      }

      // Step 3: Seamlessly complete import - spinner fades away, optimized preview & thumbnail saved
      setCards(prev => prev.map(c => c.id === card.id ? {
        ...c,
        state: 'completed',
        imageUrl: processedFileUrl,
        fileData: processedFile,
        originalFileData: originalFileData,
        trueOriginalFileData: trueOriginalFileData,
        originalImageUrl: originalImageUrl,
        trueOriginalImageUrl: trueOriginalImageUrl,
        thumbnailUrl: thumbnailUrl,
      } : c));
    });
  }, [tx, ty, tScale]);


  // --- Canvas Transform Project Sync ---
  // Load canvas transform per project
  useEffect(() => {
    if (currentProjectId) {
      const saved = localStorage.getItem(`canvas_transform_${currentProjectId}`);
      let x = 0, y = 0, scale = 1;
      let hasSaved = false;
      
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          x = parsed.x; y = parsed.y; scale = parsed.scale;
          hasSaved = true;
        } catch (e) {}
      } else if (currentProjectId === DEFAULT_PROJECT.id) {
        // Fallback to legacy global key for the default project
        const legacy = localStorage.getItem('canvas_transform');
        if (legacy) {
          try {
            const parsed = JSON.parse(legacy);
            x = parsed.x; y = parsed.y; scale = parsed.scale;
            hasSaved = true;
          } catch (e) {}
        }
      }

      if (hasSaved) {
        tx.set(x);
        ty.set(y);
        tScale.set(scale);
        targetTransform.current = { x, y, scale };
      } else {
        // Center default positions if no save
        tx.set(0); ty.set(0); tScale.set(1);
        targetTransform.current = { x: 0, y: 0, scale: 1 };
      }
    }
  }, [currentProjectId, tx, ty, tScale]);

  // Project-specific debounced persistence for transform
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const saveTransform = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (currentProjectId) {
            const data = JSON.stringify({ x: tx.get(), y: ty.get(), scale: tScale.get() });
            localStorage.setItem(`canvas_transform_${currentProjectId}`, data);
        }
      }, 300);
    };
    const unsubX = tx.on('change', saveTransform);
    const unsubY = ty.on('change', saveTransform);
    const unsubS = tScale.on('change', saveTransform);
    return () => { unsubX(); unsubY(); unsubS(); clearTimeout(timeout); };
  }, [tx, ty, tScale, currentProjectId]);
  // -------------------------------------

  const handleSelectProject = (projectId: string) => {
    if (projectId === currentProjectId) return;
    // Save current cards first before switching
    if (loadedProjectIdRef.current === currentProjectId && !isLoading) {
      saveCards(cardsRef.current, currentProjectId).catch(console.error);
    }
    loadedProjectIdRef.current = null;
    setIsLoading(true);
    setCurrentProjectId(projectId);
  };

  const handleCreateProject = async (name: string) => {
    // Save current project's cards first
    if (loadedProjectIdRef.current === currentProjectId && !isLoading) {
      await saveCards(cardsRef.current, currentProjectId).catch(console.error);
    }
    loadedProjectIdRef.current = null;
    setIsLoading(true);

    const newId = `proj_${Date.now()}`;
    const newProj: ScriptProject = {
      ...DEFAULT_PROJECT,
      id: newId,
      name,
      logline: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      characters: [],
      locations: [],
      props: [],
      scriptText: ''
    };

    // Create a pristine initial card for the new project
    const initialNewCards: CardData[] = [{
      id: `card_${Date.now()}_1`,
      x: 360,
      y: 120,
      state: 'draft',
      ratio: '3:4',
      res: '2K',
      prompt: '',
      imageUrl: null
    }];
    await saveCards(initialNewCards, newId).catch(console.error);

    setProjects(prev => [newProj, ...prev]);
    setCurrentProjectId(newId);
  };

  const handleDeleteProject = async (projectId: string) => {
    if (projects.length <= 1) return;
    await deleteCardsForProject(projectId).catch(console.error);
    setProjects(prev => {
      const remaining = prev.filter(p => p.id !== projectId);
      if (currentProjectId === projectId) {
        loadedProjectIdRef.current = null;
        setIsLoading(true);
        setCurrentProjectId(remaining[0].id);
      }
      return remaining;
    });
  };

  // Load cards from IndexedDB whenever currentProjectId changes
  useEffect(() => {
    let mounted = true;
    const fetchProjectCards = async () => {
      setIsLoading(true);
      await requestPersistence();
      
      // Artificial delay to allow the Gaussian blur mask to fade in smoothly
      // and hide the jump cut, especially on smaller projects.
      await sleep(250);

      try {
        const saved = await loadCards(currentProjectId);
        if (!mounted) return;
        
        if (saved && saved.length > 0) {
          const processedSaved = saved.map(card => {
            const updates: any = {};
            if (card.fileData) {
              updates.imageUrl = URL.createObjectURL(card.fileData);
            }
            if (card.originalFileData) {
              updates.originalImageUrl = URL.createObjectURL(card.originalFileData);
            }
            if (card.trueOriginalFileData) {
              updates.trueOriginalImageUrl = URL.createObjectURL(card.trueOriginalFileData);
            }
            // Restore local reference image Blob URLs to prevent broken image references on reload
            if (card.referenceImages && card.referenceImages.length > 0) {
              updates.referenceImages = card.referenceImages.map(ref => {
                if (ref.fileData) {
                  return {
                    ...ref,
                    url: URL.createObjectURL(ref.fileData)
                  };
                }
                return ref;
              });
              if (updates.referenceImages[0]?.url) {
                updates.referenceImageUrl = updates.referenceImages[0].url;
              }
            } else if (card.referenceImageFileData) {
              updates.referenceImageUrl = URL.createObjectURL(card.referenceImageFileData);
            }
            return {
              ...card,
              ...updates
            };
          });
          setHistory({ past: [], present: processedSaved, future: [] });
          loadedProjectIdRef.current = currentProjectId;

          // Asynchronously pre-generate 64px thumbnails for historical cards missing them
          setTimeout(() => {
            if (!mounted) return;
            processedSaved.forEach(async (card) => {
              if (!card.thumbnailUrl && (card.fileData || card.imageUrl || card.originalImageUrl)) {
                const thumb = await getOrCreateMediaThumbnail(card);
                if (thumb && mounted) {
                  setCards(prev => prev.map(c => c.id === card.id ? { ...c, thumbnailUrl: thumb } : c), false);
                }
              }
            });
          }, 300);
        } else {
          // If this is the default project, check if legacy un-scoped cards exist first
          let fallbackCards: CardData[] | null = null;
          if (currentProjectId === DEFAULT_PROJECT.id) {
            fallbackCards = await loadCards(); // legacy un-scoped key
          }
          if (fallbackCards && fallbackCards.length > 0) {
            const processedFallback = fallbackCards.map(card => {
              const updates: any = {};
              if (card.fileData) {
                updates.imageUrl = URL.createObjectURL(card.fileData);
              }
              if (card.originalFileData) {
                updates.originalImageUrl = URL.createObjectURL(card.originalFileData);
              }
              if (card.trueOriginalFileData) {
                updates.trueOriginalImageUrl = URL.createObjectURL(card.trueOriginalFileData);
              }
              // Restore local reference image Blob URLs to prevent broken image references on reload for legacy scoped cards
              if (card.referenceImages && card.referenceImages.length > 0) {
                updates.referenceImages = card.referenceImages.map(ref => {
                  if (ref.fileData) {
                    return {
                      ...ref,
                      url: URL.createObjectURL(ref.fileData)
                    };
                  }
                  return ref;
                });
                if (updates.referenceImages[0]?.url) {
                  updates.referenceImageUrl = updates.referenceImages[0].url;
                }
              } else if (card.referenceImageFileData) {
                updates.referenceImageUrl = URL.createObjectURL(card.referenceImageFileData);
              }
              return {
                ...card,
                ...updates
              };
            });
            setHistory({ past: [], present: processedFallback, future: [] });
            await saveCards(processedFallback, currentProjectId).catch(console.error);
          } else {
            const initialCards: CardData[] = [{
              id: `card_${Date.now()}_1`,
              x: 360,
              y: 120,
              state: 'draft',
              ratio: '3:4',
              res: '2K',
              prompt: '',
              imageUrl: null
            }];
            setHistory({ past: [], present: initialCards, future: [] });
            await saveCards(initialCards, currentProjectId).catch(console.error);
          }
          loadedProjectIdRef.current = currentProjectId;
        }
      } catch (e) {
        console.error('Failed to load project cards from DB:', e);
      } finally {
        if (mounted) {
          setIsLoading(false);
          setSelectedCardIds([]);
        }
      }
    };
    fetchProjectCards();
    return () => { mounted = false; };
  }, [currentProjectId]);

  // Save cards to IndexedDB for current project ONLY when cards belong to current project
  useEffect(() => {
    if (!isLoading && currentProjectId && loadedProjectIdRef.current === currentProjectId) {
      saveCards(cards, currentProjectId).catch(console.error);
    }
  }, [cards, isLoading, currentProjectId]);

  const handleUpdateCard = useCallback((id: string, updates: Partial<CardData>, isSignificant = false) => {
    const isOnlyPrompt = Object.keys(updates).length === 1 && 'prompt' in updates;
    const shouldPush = isSignificant && !isOnlyPrompt;
    setCards(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c), shouldPush);
  }, []);

  // Start Canvas Reference Picker Session
  const handleStartCanvasPicker = useCallback((targetCardId: string) => {
    const currentCamera = {
      x: tx.get(),
      y: ty.get(),
      scale: tScale.get()
    };
    
    // Find already existing references on the target card to pre-populate the picker
    const targetCard = cards.find(c => c.id === targetCardId);
    const existingRefs = targetCard?.referenceImages && targetCard.referenceImages.length > 0
      ? targetCard.referenceImages
      : targetCard?.referenceImageUrl
        ? [{ url: targetCard.referenceImageUrl, name: targetCard.referenceImageName, fileData: targetCard.referenceImageFileData }]
        : [];
    const existingUrls = new Set(existingRefs.map(r => r.url).filter(Boolean));
    
    const initialSelectedCardIds = cards
      .filter(c => {
        const img = c.imageUrl || c.originalImageUrl || c.thumbnailUrl;
        return img && existingUrls.has(img);
      })
      .map(c => c.id);

    setPickerSession({
      targetCardId,
      selectedCardIds: initialSelectedCardIds,
      initialCamera: currentCamera
    });
  }, [tx, ty, tScale, cards]);

  // Toggle a card selection in picker session
  const handleTogglePickerCard = useCallback((cardId: string) => {
    setPickerSession(prev => {
      if (!prev) return null;
      if (prev.targetCardId === cardId) return prev; // Cannot pick target itself
      const isSelected = prev.selectedCardIds.includes(cardId);
      const nextSelected = isSelected
        ? prev.selectedCardIds.filter(id => id !== cardId)
        : [...prev.selectedCardIds, cardId];
      return { ...prev, selectedCardIds: nextSelected };
    });
  }, []);

  // Cancel picker session and fly back
  const handleCancelPickerSession = useCallback(() => {
    if (!pickerSession) return;
    const { initialCamera } = pickerSession;
    
    // Sync the virtual camera target position to prevent wheel jump
    targetTransform.current = {
      x: initialCamera.x,
      y: initialCamera.y,
      scale: initialCamera.scale
    };

    // Animate smoothly back to initial camera
    animate(tx, initialCamera.x, { duration: 0.4, ease: [0.16, 1, 0.3, 1] });
    animate(ty, initialCamera.y, { duration: 0.4, ease: [0.16, 1, 0.3, 1] });
    animate(tScale, initialCamera.scale, { duration: 0.4, ease: [0.16, 1, 0.3, 1] });
    setPickerSession(null);
  }, [pickerSession, tx, ty, tScale]);

  // Confirm picker session and apply reference images
  const handleConfirmPickerSession = useCallback(() => {
    if (!pickerSession) return;
    const { targetCardId, selectedCardIds, initialCamera } = pickerSession;
    
    if (selectedCardIds.length > 0) {
      const targetCard = cardsRef.current.find(c => c.id === targetCardId);
      const pickedCards = cardsRef.current.filter(c => selectedCardIds.includes(c.id));
      
      const newReferences = pickedCards.map(c => ({
        url: c.imageUrl || c.originalImageUrl || c.thumbnailUrl || '',
        name: c.fileName ? c.fileName.replace(/\.[^/.]+$/, "") : (c.prompt ? (c.prompt.length > 14 ? c.prompt.slice(0, 14) + '...' : c.prompt) : '画布卡片'),
        fileData: c.trueOriginalFileData || c.originalFileData || c.fileData
      })).filter(r => Boolean(r.url));

      const existingRefs = targetCard?.referenceImages && targetCard.referenceImages.length > 0
        ? targetCard.referenceImages
        : targetCard?.referenceImageUrl
          ? [{ url: targetCard.referenceImageUrl, name: targetCard.referenceImageName, fileData: targetCard.referenceImageFileData }]
          : [];

      // Preserve existing non-canvas references (e.g., raw local uploads directly to card)
      const canvasCardUrls = new Set(cardsRef.current.map(c => c.imageUrl || c.originalImageUrl || c.thumbnailUrl).filter(Boolean));
      const nonCanvasRefs = existingRefs.filter(ref => !canvasCardUrls.has(ref.url));

      const mergedRefs = [...nonCanvasRefs, ...newReferences];
      
      if (mergedRefs.length > 0) {
        handleUpdateCard(targetCardId, {
          referenceImages: mergedRefs,
          referenceImageUrl: mergedRefs[0].url,
          referenceImageName: mergedRefs.length > 1 ? `参考图 (${mergedRefs.length})` : mergedRefs[0].name,
          referenceImageFileData: mergedRefs[0].fileData
        }, true);
      } else {
        handleUpdateCard(targetCardId, {
          referenceImages: [],
          referenceImageUrl: null,
          referenceImageName: undefined,
          referenceImageFileData: undefined
        }, true);
      }
    } else {
      // If all selections are removed, clear reference images on the card
      handleUpdateCard(targetCardId, {
        referenceImages: [],
        referenceImageUrl: null,
        referenceImageName: undefined,
        referenceImageFileData: undefined
      }, true);
    }

    // Cinematic fly back to target card position
    const targetCard = cardsRef.current.find(c => c.id === targetCardId);
    const finalX = targetCard ? -targetCard.x * initialCamera.scale + window.innerWidth / 2 - (CARD_DIMENSIONS[targetCard.ratio]?.width || 320) * initialCamera.scale / 2 : initialCamera.x;
    const finalY = targetCard ? -targetCard.y * initialCamera.scale + window.innerHeight / 2 - (CARD_DIMENSIONS[targetCard.ratio]?.height || 320) * initialCamera.scale / 2 : initialCamera.y;

    // Sync the virtual camera target position to prevent wheel jump
    targetTransform.current = {
      x: finalX,
      y: finalY,
      scale: initialCamera.scale
    };

    animate(tx, finalX, { duration: 0.45, ease: [0.16, 1, 0.3, 1] });
    animate(ty, finalY, { duration: 0.45, ease: [0.16, 1, 0.3, 1] });
    animate(tScale, initialCamera.scale, { duration: 0.45, ease: [0.16, 1, 0.3, 1] });

    setPickerSession(null);
  }, [pickerSession, handleUpdateCard, tx, ty, tScale]);

  const selectedCardIdsRef = useRef(selectedCardIds);
  useEffect(() => {
    selectedCardIdsRef.current = selectedCardIds;
  }, [selectedCardIds]);

  // --- Viewport Circular Culling (Virtualization) ---
  // Circle geometry: Center = (viewportWidth / 2, viewportHeight / 2), Diameter = viewportWidth, Radius = viewportWidth / 2.
  // Cards whose AABB intersects with this circular boundary are mounted; non-intersecting cards are unmounted to save performance.
  const [visibleCardIdSet, setVisibleCardIdSet] = useState<Set<string>>(() => new Set());

  const updateCircularCulling = useCallback(() => {
    if (typeof window === 'undefined') return;
    const vp = {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      tx: tx.get(),
      ty: ty.get(),
      scale: tScale.get()
    };

    const currentCards = cardsRef.current;
    const selectedIds = selectedCardIdsRef.current;
    const nextSet = new Set<string>();

    for (const card of currentCards) {
      if (selectedIds.includes(card.id) || isCardIntersectingRectangle(card, vp)) {
        nextSet.add(card.id);
      }
    }

    setVisibleCardIdSet(prev => {
      if (prev.size === nextSet.size) {
        let identical = true;
        for (const id of nextSet) {
          if (!prev.has(id)) {
            identical = false;
            break;
          }
        }
        if (identical) return prev;
      }
      return nextSet;
    });
  }, [tx, ty, tScale]);

  // Initial and window resize listeners
  useEffect(() => {
    updateCircularCulling();
    window.addEventListener('resize', updateCircularCulling);
    return () => window.removeEventListener('resize', updateCircularCulling);
  }, [updateCircularCulling]);

  // Immediate sync when cards collection or active selection changes
  useEffect(() => {
    updateCircularCulling();
  }, [cards, selectedCardIds, updateCircularCulling]);

  // High-performance batched check (via rAF) during canvas panning/zooming
  useEffect(() => {
    let rafId: number | null = null;
    const scheduleCheck = () => {
      // Intent-driven lazy restoration: pause culling queries while actively zooming/dragging to maintain 60fps
      if (isZoomingRef.current || isDraggingCanvasRef.current || (window as any).isDraggingCard) {
        return;
      }
      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          rafId = null;
          updateCircularCulling();
        });
      }
    };

    const unsubX = tx.on('change', scheduleCheck);
    const unsubY = ty.on('change', scheduleCheck);
    const unsubScale = tScale.on('change', scheduleCheck);

    return () => {
      unsubX();
      unsubY();
      unsubScale();
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [tx, ty, tScale, updateCircularCulling]);

  // Micro-LOD state tracking (scale < 0.60)
  const [isMicroLod, setIsMicroLod] = useState(() => tScale.get() < 0.60);
  // Nano-LOD state tracking (scale < 0.60)
  const [isNanoLod, setIsNanoLod] = useState(() => tScale.get() < 0.60);
  // Extended Nano-LOD state to act as a backend backdrop during DOM card fade-in
  const [isNanoCanvasActive, setIsNanoCanvasActive] = useState(() => tScale.get() < 0.60);
  // Extended DOM card state to act as a frontend backdrop while Canvas prepares to render
  const [isDomCardsActive, setIsDomCardsActive] = useState(() => tScale.get() >= 0.60);

  const handleNanoCanvasReady = useCallback(() => {
    if (isNanoLod) {
      setIsDomCardsActive(false);
    }
  }, [isNanoLod]);

  useEffect(() => {
    if (isNanoLod) {
      setIsNanoCanvasActive(true);
      // isDomCardsActive will be disabled by the onReady callback from NanoLodCanvas once its first frame renders
    } else {
      setIsDomCardsActive(true);
      // Give DOM cards a brief window to mount and paint before destroying the backdrop Canvas
      const t = setTimeout(() => setIsNanoCanvasActive(false), 150);
      return () => clearTimeout(t);
    }
  }, [isNanoLod]);

  useEffect(() => {
    const unsub = tScale.on('change', (s) => {
      const isMicro = s < 0.60;
      const isNano = s < 0.60;
      
      setIsMicroLod(isMicro);
      setIsNanoLod(isNano);
    });
    return unsub;
  }, [tScale]);

  // Set of DOM-mounted card IDs (asynchronous frame-budgeted progressive mounting)
  const [renderedCardIds, setRenderedCardIds] = useState<Set<string>>(() => new Set());
  const [mountEpoch, setMountEpoch] = useState(0);

  const handleCardDrag = useCallback((id: string, dx: number, dy: number) => {
    // No-op. Real-time dragging is now fully handled in DOM by GenerationCard.tsx (Master-Slave architecture).
    // This function is kept to avoid prop-type errors if needed, though we removed it from GenerationCard's active calls.
  }, []);

  const handleCardDragEnd = useCallback((id: string, totalDx: number, totalDy: number) => {
    if (Math.abs(totalDx) < 0.5 && Math.abs(totalDy) < 0.5) return;
    setCards(prev => {
      const selectedIds = selectedCardIdsRef.current;
      const isDraggingSelected = selectedIds.includes(id);
      
      return prev.map(c => {
        if (isDraggingSelected ? selectedIds.includes(c.id) : c.id === id) {
          return { ...c, x: c.x + totalDx, y: c.y + totalDy };
        }
        return c;
      });
    }, true);
  }, []);

  const handleCardSelect = useCallback((e: React.PointerEvent, id: string) => {
    setContextMenus(prev => {
      const next = { ...prev };
      delete next['user'];
      return next;
    });
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      setSelectedCardIds(prev => prev.includes(id) ? prev.filter(cid => cid !== id) : [...prev, id]);
    } else {
      setSelectedCardIds(prev => (prev.length === 1 && prev[0] === id) ? prev : [id]);
    }
  }, []);

  const handleCardSelectWrapped = useCallback((e: React.PointerEvent, id: string) => {
    const session = pickerSessionRef.current;
    if (session) {
      if (id !== session.targetCardId) {
        e.stopPropagation();
        handleTogglePickerCard(id);
      }
    } else {
      handleCardSelect(e, id);
    }
  }, [handleCardSelect, handleTogglePickerCard]);

  const handleCardDelete = useCallback((id: string) => {
    setCards(prev => prev.filter(c => c.id !== id));
    setSelectedCardIds(prev => prev.filter(cid => cid !== id));
  }, []);

  // State for Context Menu
  const [contextMenus, setContextMenus] = useState<Record<string, { x: number, y: number, canvasX: number, canvasY: number, targetId?: string | null }>>({});

  // Undo / Redo logic
  const undo = () => {
    setHistory(curr => {
      if (curr.past.length === 0) return curr;
      const previous = curr.past[curr.past.length - 1];
      return {
        past: curr.past.slice(0, -1),
        present: previous,
        future: [curr.present, ...curr.future]
      };
    });
  };

  const redo = () => {
    setHistory(curr => {
      if (curr.future.length === 0) return curr;
      const next = curr.future[0];
      return {
        past: [...curr.past, curr.present],
        present: next,
        future: curr.future.slice(1)
      };
    });
  };

  // Global keydown for deletion and undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName;
      const isInputActive = activeTag === 'TEXTAREA' || activeTag === 'INPUT' || document.activeElement?.hasAttribute('contenteditable');
      const isSpaceKey = e.code === 'Space' || e.key === ' ' || e.keyCode === 32;

      if (isSpaceKey && !isInputActive) {
        if (isSpacePressedRef.current || isOverviewModeRef.current) {
          e.preventDefault();
          return;
        }
        e.preventDefault();
        isSpacePressedRef.current = true;
        enterOverviewModeRef.current();
      }

      if ((e.ctrlKey || e.metaKey) && !isInputActive) {
        if (e.code === 'KeyZ' || e.key.toLowerCase() === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            redo();
          } else {
            undo();
          }
          return;
        }
        if (e.code === 'KeyY' || e.key.toLowerCase() === 'y') {
          e.preventDefault();
          redo();
          return;
        }
        // Copy (Ctrl+C)
        if (e.code === 'KeyC' || e.key.toLowerCase() === 'c') {
          const currentSelection = selectedCardIdsRef.current;
          if (currentSelection.length > 0) {
            e.preventDefault();
            clipboardRef.current = cardsRef.current.filter(c => currentSelection.includes(c.id));
          }
          return;
        }
        // Paste (Ctrl+V)
        if (e.code === 'KeyV' || e.key.toLowerCase() === 'v') {
          if (clipboardRef.current.length > 0) {
            e.preventDefault();
            const newSelectedIds: string[] = [];
            const newCards = clipboardRef.current.map(c => {
              const newId = Math.random().toString(36).substring(2, 11);
              newSelectedIds.push(newId);
              return {
                ...c,
                id: newId,
                x: c.x + 200, // Offset for visibility
                y: c.y + 200,
                // Make sure to reset state to draft if we want, or keep it. We'll just keep it exactly as is, maybe without imageUrl?
                // For now, exact clone is fine.
              };
            });
            setCards(prev => [...prev, ...newCards], true);
            setSelectedCardIds(newSelectedIds);
          }
          return;
        }
      }

      if (e.code === 'Backspace' || e.code === 'Delete' || e.key === 'Backspace' || e.key === 'Delete') {
        if (isInputActive) return;
        const currentSelection = selectedCardIdsRef.current;
        if (currentSelection.length > 0) {
          setCards(prev => prev.filter(c => !currentSelection.includes(c.id)));
          setSelectedCardIds([]);
        }
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName;
      const isInputActive = activeTag === 'TEXTAREA' || activeTag === 'INPUT' || document.activeElement?.hasAttribute('contenteditable');
      const isSpaceKey = e.code === 'Space' || e.key === ' ' || e.keyCode === 32;

      if (isSpaceKey) {
        isSpacePressedRef.current = false;
        if (!isInputActive && (preOverviewTransform.current || isOverviewModeRef.current)) {
          exitOverviewToOriginalRef.current();
        }
      }
    };

    const handleBlur = () => {
      isSpacePressedRef.current = false;
      if (preOverviewTransform.current || isOverviewModeRef.current) {
        exitOverviewToOriginalRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []); // We use refs for state to avoid re-binding on every selection change

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;
    const canvasX = (cursorX - tx.get()) / tScale.get();
    const canvasY = (cursorY - ty.get()) / tScale.get();
    
    const cardElement = (e.target as Element).closest('[data-card-id]');
    let targetId = cardElement ? cardElement.getAttribute('data-card-id') : null;
    
    // In Nano-LOD mode, cards are rendered via Hybrid Canvas (no DOM data-card-id).
    // Perform instant world-coordinate hit-testing to identify the target card.
    if (!targetId && isNanoLod) {
      for (let i = cards.length - 1; i >= 0; i--) {
        const c = cards[i];
        const dim = getCardSize(c);
        if (canvasX >= c.x && canvasX <= c.x + dim.width && canvasY >= c.y && canvasY <= c.y + dim.height) {
          targetId = c.id;
          break;
        }
      }
    }
    
    if (targetId && !selectedCardIds.includes(targetId)) {
      setSelectedCardIds([targetId]);
    } else if (!targetId) {
      setSelectedCardIds([]);
    }

    const ownerId = e.nativeEvent.isTrusted ? 'user' : 'agent';
    
    setContextMenus(prev => ({
      ...prev,
      [ownerId]: {
        x: e.clientX,
        y: e.clientY,
        canvasX,
        canvasY,
        targetId
      }
    }));

    if (ownerId === 'user' && !isAgentRunning) {
      setAgentState(prev => ({
        ...prev,
        x: canvasX - 15 / tScale.get(), // Fly to the left of the speech bubble
        y: canvasY - 25 / tScale.get(), // Fly slightly above the menu
        isMoving: true,
        visible: true
      }));
      setTimeout(() => {
        setAgentState(prev => ({ ...prev, isMoving: false }));
      }, 400);
    }
  };

  const handleCreateCard = (ownerId: string = 'user') => {
    const menu = contextMenus[ownerId];
    if (!menu) return;
    const newId = Math.random().toString(36).substring(2, 11);
    const newCard: CardData = {
      id: newId,
      x: menu.canvasX,
      y: menu.canvasY,
      state: 'draft',
      ratio: '3:4',
      res: '2K',
      prompt: '',
      imageUrl: null
    };
    setCards(prev => [...prev, newCard]);
    if (ownerId === 'user') setSelectedCardIds([newCard.id]);
    
    setContextMenus(prev => {
      const next = { ...prev };
      delete next[ownerId];
      return next;
    });
    return newId;
  };

  const inspectPage = useCallback(async (options: Record<string, unknown> = {}) => {
    // If the script drawer is open and in script view, but the textarea is still settling (due to the 210ms anti-jank delay),
    // wait a brief moment for it to mount so the observation accurately reflects the visible state.
    if (scriptViewRef.current.drawerOpen && scriptViewRef.current.activeView === 'script' && !document.querySelector('[data-agent-target="script.text"]')) {
      await sleep(120);
    }
    const scope = typeof options.scope === 'string' ? options.scope : 'overview';
    const candidates = Array.from(document.querySelectorAll<HTMLElement>('[data-agent-target]'));
    const scopeElement = candidates.find(element => element.dataset.agentTarget === scope);
    const offset = Math.max(0, Math.floor(Number(options.offset) || 0));
    const limit = Math.min(100, Math.max(1, Math.floor(Number(options.limit) || 40)));
    const view = scriptViewRef.current;
    const isVisible = (element: HTMLElement) => {
      const rect = element.getBoundingClientRect();
      let top = Math.max(0, rect.top), bottom = Math.min(window.innerHeight, rect.bottom);
      let left = Math.max(0, rect.left), right = Math.min(window.innerWidth, rect.right);
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        const bounds = parent.getBoundingClientRect();
        if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) { top = Math.max(top, bounds.top); bottom = Math.min(bottom, bounds.bottom); }
        if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) { left = Math.max(left, bounds.left); right = Math.min(right, bounds.right); }
      }
      const style = getComputedStyle(element);
      return bottom > top && right > left && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const scopedComponents = candidates.flatMap((element) => {
      if (scope === 'overview' ? element.dataset.agentTarget?.startsWith('script.toc.item.') : !scopeElement || !(element === scopeElement || scopeElement.contains(element))) return [];
      const rect = element.getBoundingClientRect();
      const visible = rect.width > 0 && rect.height > 0
        && rect.bottom >= 0 && rect.right >= 0
        && rect.top <= window.innerHeight && rect.left <= window.innerWidth;
      if (!visible || !isVisible(element)) return [];
      const id = element.dataset.agentTarget!;
      const definition = getPageComponentDefinition(id);
      const actions = (element.dataset.agentActions || '').split(' ').filter(Boolean);
      if (actions.length === 0) return [];
      
      const isSelected = element.getAttribute('aria-selected') === 'true' || element.getAttribute('aria-current') === 'true' || element.getAttribute('aria-current') === 'page' || element.getAttribute('aria-expanded') === 'true' || element.getAttribute('aria-pressed') === 'true';
      const isDisabled = element.hasAttribute('disabled') || (element as HTMLButtonElement).disabled === true || element.getAttribute('aria-disabled') === 'true';
      const badge = element.dataset.agentBadge || (id === 'script.toc.open' ? element.querySelector('.rounded-full')?.textContent?.trim() : undefined);
      const isInput = element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement;
      const inputValue = isInput ? (element as HTMLInputElement | HTMLTextAreaElement).value : undefined;
      const placeholder = isInput ? (element as HTMLInputElement | HTMLTextAreaElement).placeholder : undefined;

      let label = id.startsWith('script.toc.item.')
        ? element.textContent?.trim().replace(/\s+/g, ' ') || id
        : (id === 'script.toc.open' && badge
            ? `${definition?.label || '目录按钮'} (${badge})`
            : definition?.label || element.getAttribute('aria-label') || element.textContent?.trim().slice(0, 40) || id);

      if (id === 'script.search.counter') {
        const counterText = element.textContent?.trim();
        if (counterText) label = `搜索匹配: ${counterText}`;
      } else if (id === 'script.replace.feedback') {
        const feedbackText = element.textContent?.trim();
        if (feedbackText) label = `替换反馈: "${feedbackText}"`;
      } else if (id === 'script.text') {
        label = `${definition?.label || '剧本文本编辑区'} [正文未直接展开，可申请查看]`;
      } else if (isInput) {
        if (inputValue) {
          label += ` [当前内容: "${inputValue.slice(0, 30)}"]`;
        } else if (placeholder) {
          label += ` [提示: "${placeholder.slice(0, 25)}"]`;
        }
      }

      if (isSelected) {
        label += ' (已选)';
      }
      if (isDisabled) {
        label += ' (禁用)';
      }

      const numericBadge = badge !== undefined && !isNaN(Number(badge)) ? Number(badge) : badge;

      return [{
        id,
        label,
        ...(inputValue !== undefined && id !== 'script.text' ? { text: inputValue.slice(0, 100) } : {}),
        ...(numericBadge !== undefined ? { badge: numericBadge } : {}),
        ...(id === 'script.toc.open' && numericBadge !== undefined ? { episodeCount: numericBadge } : {}),
        actionSet: actions.join(' '),
      }];
    });
    const selected = scopedComponents.slice(offset, offset + limit);
    const actionSets = Object.fromEntries([...new Set(selected.map(item => item.actionSet))].map((value, index) => [`a${index}`, value.split(' ')]));
    const components = selected.map(item => ({ ...item, actionSet: Object.keys(actionSets).find(key => actionSets[key].join(' ') === item.actionSet)! }));
    const tocList = document.querySelector<HTMLElement>('[data-agent-target="script.toc.list"]');
    const tocButton = document.querySelector<HTMLElement>('[data-agent-target="script.toc.open"]');
    const tocBadge = tocButton?.dataset.agentBadge || tocButton?.querySelector('.rounded-full')?.textContent?.trim();
    const numericTocBadge = tocBadge !== undefined && !isNaN(Number(tocBadge)) ? Number(tocBadge) : tocBadge;

    const searchPanel = document.querySelector<HTMLElement>('[data-agent-target="script.search.panel"]');
    const searchInput = document.querySelector<HTMLInputElement>('[data-agent-target="script.search.input"]');
    const replaceInput = document.querySelector<HTMLInputElement>('[data-agent-target="script.replace.input"]');
    const searchCounter = document.querySelector<HTMLElement>('[data-agent-target="script.search.counter"]');
    const caseButton = document.querySelector<HTMLElement>('[data-agent-target="script.search.case"]');
    const replaceFeedbackEl = document.querySelector<HTMLElement>('[data-agent-target="script.replace.feedback"]');
    const searchOpenButton = document.querySelector<HTMLElement>('[data-agent-target="script.search.open"]');
    const isSearchPanelVisible = Boolean(searchPanel && isVisible(searchPanel));

    const textArea = document.querySelector<HTMLTextAreaElement>('[data-agent-target="script.text"]');
    const isExplicitTextScope = scope === 'script.text' || Boolean(scopeElement && (scopeElement === textArea || scopeElement.contains(textArea)));
    const textViewport = textArea && isVisible(textArea) && isExplicitTextScope ? getVisibleTextareaSnapshot(textArea) : null;
    return {
      scope,
      status: scope === 'overview' || (scopeElement && isVisible(scopeElement)) ? 'visible' : 'not_visible',
      pagination: { offset, returned: components.length, truncated: offset + components.length < scopedComponents.length, nextOffset: offset + components.length < scopedComponents.length ? offset + components.length : null },
      actionSets,
      notices: Array.from(document.querySelectorAll<HTMLElement>('[role="alert"], [role="status"], [role="dialog"]')).filter(isVisible).map(element => ({ role: element.getAttribute('role'), label: element.getAttribute('aria-label') || element.textContent?.trim().slice(0, 200) })),
      project: { id: currentProject.id, name: currentProject.name },
      script: {
        drawerOpen: view.drawerOpen,
        activeView: view.activeView,
        tocOpen: view.tocOpen,
        search: {
          isOpen: isSearchPanelVisible,
          buttonVisible: Boolean(searchOpenButton && isVisible(searchOpenButton)),
          ...(isSearchPanelVisible ? {
            searchText: searchInput?.value || '',
            replaceText: replaceInput?.value || '',
            matchStatus: searchCounter?.textContent?.trim() || (searchInput?.value ? '无匹配' : '未搜索'),
            isCaseSensitive: caseButton?.getAttribute('aria-pressed') === 'true',
            ...(replaceFeedbackEl && isVisible(replaceFeedbackEl) ? { feedback: replaceFeedbackEl.textContent?.trim() } : {}),
          } : {}),
        },
        tocButton: tocButton && isVisible(tocButton) ? {
          visible: true,
          label: '目录',
          badge: numericTocBadge,
          episodeCount: numericTocBadge,
        } : undefined,
        directory: scope === 'script.toc.list' && tocList && isVisible(tocList)
          ? { atTop: tocList.scrollTop <= 1, atBottom: tocList.scrollTop + tocList.clientHeight >= tocList.scrollHeight - 1, progress: tocList.scrollHeight <= tocList.clientHeight ? 1 : tocList.scrollTop / (tocList.scrollHeight - tocList.clientHeight) }
          : undefined,
        text: textArea && isVisible(textArea)
          ? (textViewport
              ? {
                  status: 'visible',
                  visibleText: textViewport.visibleText,
                  characterRange: textViewport.characterRange,
                  scroll: textViewport.scroll,
                  selection: scriptSelection,
                  hint: '当前为申请查看的正文视口片段。如需翻阅更多，可使用 mouse.scroll 滚动后再观察。',
                }
              : {
                  status: 'visible',
                  hint: '剧本正文未直接展开注入上下文。如需阅读当前正文视野，可调用 page.inspect({ scope: "script.text" }) 申请查看；或通过目录、搜索定位。',
                  scroll: {
                    atTop: textArea.scrollTop <= 1,
                    atBottom: textArea.scrollTop + textArea.clientHeight >= textArea.scrollHeight - 2,
                  },
                }
            )
          : { status: 'not_visible' },
      },
      components,
    };
  }, [currentProject.id, currentProject.name, scriptSelection]);

  // The cursor is the Agent's public action path. It performs the same visible
  // UI step a person would take; only the resulting page observation exposes data.
  const animateMouseAction = useCallback(async (action: MouseActionName, targetId: string, arguments_: Record<string, unknown>) => {
    const target = document.querySelector(`[data-agent-target="${targetId}"]`);
    if (!(target instanceof HTMLElement)) throw new Error(`当前页面找不到操作目标：${targetId}`);
    const supportedActions = (target.dataset.agentActions || '').split(' ').filter(Boolean);
    if (!supportedActions.includes(action)) throw new Error(`组件 ${targetId} 不支持动作：${action}`);
    const rect = target.getBoundingClientRect();
    setAgentState(prev => ({ ...prev, x: (rect.left + rect.width / 2 - tx.get()) / tScale.get(), y: (rect.top + rect.height / 2 - ty.get()) / tScale.get(), visible: true, isMoving: true }));
    await sleep(350);
    setAgentState(prev => ({ ...prev, isMoving: false, isActive: action !== 'mouse.move' && action !== 'mouse.hover' }));
    // The semantic UI adapter below applies the same page transition after the
    // visible cursor action has reached the target.
    if (action === 'mouse.hover') await sleep(Number(arguments_.duration || 350));
    else if (action === 'mouse.longPress') await sleep(Math.min(Math.max(Number(arguments_.duration || 700), 400), 2000));
    else await sleep(150);
    setAgentState(prev => ({ ...prev, isActive: false }));
    await sleep(120);
    return { action, targetId };
  }, [inspectPage, tScale, tx, ty]);

  // Animate cursor movement to visually focus and inspect a specific target component
  const animateMoveToTarget = useCallback(async (targetId: string) => {
    let target = document.querySelector(`[data-agent-target="${targetId}"]`);
    if (!target) {
      await sleep(80);
      target = document.querySelector(`[data-agent-target="${targetId}"]`);
    }
    if (target instanceof HTMLElement) {
      const rect = target.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && rect.bottom >= 0 && rect.top <= window.innerHeight && rect.right >= 0 && rect.left <= window.innerWidth) {
        const centerX = rect.width > 360 ? rect.left + Math.min(rect.width / 2, 240) : rect.left + rect.width / 2;
        const centerY = rect.height > 200 ? rect.top + Math.min(rect.height / 4, 90) : rect.top + rect.height / 2;
        const targetX = (centerX - tx.get()) / tScale.get();
        const targetY = (centerY - ty.get()) / tScale.get();

        setAgentState(prev => ({
          ...prev,
          x: targetX,
          y: targetY,
          visible: true,
          isMoving: true,
          isActive: false,
        }));

        await sleep(350);
        setAgentState(prev => ({ ...prev, isMoving: false, isActive: false }));
        await sleep(160);
      }
    }
  }, [tScale, tx, ty]);

  // Helper to ensure smooth scroll animations finish completely and layout settles before page observation
  const scrollElementAndWait = (element: HTMLElement, delta: number): Promise<void> => {
    return new Promise((resolve) => {
      const maxScroll = Math.max(0, element.scrollHeight - element.clientHeight);
      if (maxScroll <= 0) {
        resolve();
        return;
      }

      const startingScroll = element.scrollTop;
      if ((delta > 0 && startingScroll >= maxScroll - 1) || (delta < 0 && startingScroll <= 1)) {
        resolve();
        return;
      }

      let settledTimer: any = null;
      let safetyTimer: any = null;
      let lastTop = element.scrollTop;
      let stableCount = 0;
      let hasMoved = false;

      const cleanup = () => {
        element.removeEventListener('scrollend', onScrollEnd);
        element.removeEventListener('scroll', onScroll);
        if (settledTimer) clearInterval(settledTimer);
        if (safetyTimer) clearTimeout(safetyTimer);
      };

      const done = () => {
        cleanup();
        requestAnimationFrame(() => {
          setTimeout(resolve, 60);
        });
      };

      const onScrollEnd = () => {
        done();
      };

      const onScroll = () => {
        hasMoved = true;
        stableCount = 0;
        lastTop = element.scrollTop;
      };

      element.addEventListener('scrollend', onScrollEnd, { once: true });
      element.addEventListener('scroll', onScroll, { passive: true });

      settledTimer = setInterval(() => {
        const current = element.scrollTop;
        if (Math.abs(current - lastTop) < 1) {
          stableCount++;
          if ((hasMoved && stableCount >= 3) || stableCount >= 5) {
            done();
          }
        } else {
          hasMoved = true;
          stableCount = 0;
          lastTop = current;
        }
      }, 40);

      safetyTimer = setTimeout(done, 1200);

      element.scrollBy({ top: delta, behavior: 'smooth' });
    });
  };

  // This adapter maps a visible component to its real UI transition. It never
  // returns project facts; a later page.inspect remains the only evidence path.
  const applyPageCommand = useCallback(async (action: MouseActionName, targetId: string, arguments_: Record<string, unknown>) => {
    if (action === 'mouse.click') {
      const target = document.querySelector(`[data-agent-target="${targetId}"]`);
      if (target instanceof HTMLElement) {
        // Dispatch both native click and React-compatible MouseEvent to ensure maximum compatibility
        target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
        target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
        // target.click() inherently dispatches a native click event that bubbles and triggers React's onClick.
        // Doing both dispatchEvent('click') AND .click() causes a double-fire, which breaks toggle buttons (prev => !prev).
        target.click();
      } else {
        // Manual fallback for critical global state views just in case the element wasn't found in DOM
        if (targetId === 'script-bible-toggle') setDrawerOpen(!scriptViewRef.current.drawerOpen);
        else if (targetId === 'script.close') setDrawerOpen(false);
        else if (targetId === 'script.view.script') setScriptView('script');
        else if (targetId === 'script.view.assets') setScriptView('assets');
        else if (targetId === 'script.view.universe') setScriptView('universe');
        else if (targetId === 'script.toc.open') setTocOpen(!scriptViewRef.current.tocOpen);
        else if (targetId.startsWith('script.toc.item.')) {
          setRequestedTocItemId(targetId.replace('script.toc.item.', ''));
        }
      }
    }
    if (action === 'mouse.scroll') {
      let delta = 480;
      if (arguments_.direction === 'top') delta = -999999;
      else if (arguments_.direction === 'bottom') delta = 999999;
      else if (arguments_.direction === 'up') delta = -480;
      else if (arguments_.direction === 'down') delta = 480;
      else {
        const requestedDelta = Number(arguments_.delta);
        if (Number.isFinite(requestedDelta) && requestedDelta !== 0) delta = requestedDelta;
      }
      
      if (targetId === 'script.toc.list') {
        setTocOpen(true);
      }

      const target = document.querySelector(`[data-agent-target="${targetId}"]`);
      if (target instanceof HTMLElement) {
        await scrollElementAndWait(target, delta);
        if (targetId === 'script.toc.list') {
          const atBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 2;
          setTocAtBottom(atBottom);
        }
      }
    }
    if (action === 'mouse.drag' && targetId === 'script.text') {
      const target = document.querySelector(`[data-agent-target="${targetId}"]`);
      const start = Number(arguments_.start);
      const end = Number(arguments_.end);
      if (target instanceof HTMLTextAreaElement && Number.isInteger(start) && Number.isInteger(end)) {
        target.focus({ preventScroll: true });
        target.setSelectionRange(Math.max(0, start), Math.max(0, end));
        target.dispatchEvent(new Event('select', { bubbles: true }));
      }
    }
    if (action === 'mouse.type') {
      const target = document.querySelector(`[data-agent-target="${targetId}"]`);
      const text = typeof arguments_.text === 'string' ? arguments_.text : '';
      if ((target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) && typeof text === 'string') {
        const shouldClear = arguments_.clear === true;
        const start = shouldClear ? 0 : (target.selectionStart || 0);
        const end = shouldClear ? target.value.length : (target.selectionEnd || 0);
        target.focus({ preventScroll: true });
        
        // For React 16+, we must bypass the synthetic value setter to trigger a real onChange
        const prototype = target instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
        
        if (nativeInputValueSetter) {
          const currentValue = target.value;
          const newValue = (shouldClear ? '' : currentValue.substring(0, start)) + text + (shouldClear ? '' : currentValue.substring(end));
          nativeInputValueSetter.call(target, newValue);
          target.dispatchEvent(new Event('input', { bubbles: true }));
          target.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          target.setRangeText(text, start, end, 'end');
          target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
        }
      }
    }
    if (action === 'mouse.keyPress') {
      const target = document.querySelector(`[data-agent-target="${targetId}"]`);
      const key = typeof arguments_.key === 'string' ? arguments_.key : '';
      const shiftKey = Boolean(arguments_.shiftKey || arguments_.shift);
      if (target instanceof HTMLElement && key) {
        target.focus({ preventScroll: true });
        // Use a more complete mock for React's synthetic event system
        const keydownEvent = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key, code: key === 'Enter' ? 'Enter' : undefined, shiftKey });
        target.dispatchEvent(keydownEvent);
        target.dispatchEvent(new KeyboardEvent('keypress', { bubbles: true, cancelable: true, key, shiftKey }));
        target.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key, shiftKey }));
      }
    }
    // Allow React to mount any target needed by the next presentation step.
    // When toggling drawers or views with 200ms+ transition locks, wait for layout to settle completely.
    if (action !== 'mouse.scroll') {
      const isDrawerOrViewToggle = targetId === 'script-bible-toggle' || targetId.startsWith('script.view.') || targetId === 'script.toc.open' || targetId === 'script.search.open';
      const isSearchOrReplaceAction = targetId.startsWith('script.search.') || targetId.startsWith('script.replace.');
      await sleep(isDrawerOrViewToggle ? 280 : (isSearchOrReplaceAction ? 220 : 180));
    }
  }, [setDrawerOpen, setScriptView, setTocOpen, setTocAtBottom]);

  const executeAgentTool = useCallback(async (call: AgentToolCall, task: RuntimeTask, signal?: AbortSignal) => {
    if (signal?.aborted) return { aborted: true };
    const rememberObservation = (page: Awaited<ReturnType<typeof inspectPage>>) => {
      observedTargetsByTaskRef.current.set(task.id, new Set(page.components.map(component => component.id)));
      return page;
    };
    if (call.name === 'page.inspect') {
      const scope = typeof call.arguments?.scope === 'string' && call.arguments.scope !== 'overview'
        ? call.arguments.scope
        : (typeof call.arguments?.targetId === 'string' && call.arguments.targetId !== 'overview' ? call.arguments.targetId : undefined);

      if (scope) {
        await animateMoveToTarget(scope);
        if (signal?.aborted) return { aborted: true };
      }
      return rememberObservation(await inspectPage(call.arguments));
    }
    if (call.name === 'guide.lookup') {
      const query = String(call.arguments.query || '');
      return {
        query,
        guidance: /搜索|替换|查找|replace|search/i.test(query)
          ? '操作说明：在剧本正文视图中，点击二级菜单的“搜索替换按钮(script.search.open)”展开面板；在“搜索输入框(script.search.input)”输入目标关键词（可点击“区分大小写切换(script.search.case)”）；通过“下一个匹配项(script.search.next)”或“上一个匹配项(script.search.prev)”在正文中高亮定位；在“替换输入框(script.replace.input)”中输入新文本，可执行“单处替换(script.replace.single)”或“全部替换(script.replace.all)”。操作说明不包含当前项目的具体文本内容。'
          : /正文|文本|阅读|内容|script\.text/.test(query)
          ? '操作说明：页面观察默认不直接展开剧本正文全文。若需阅读正文当前视野，可调用 page.inspect 并指定 scope 为 "script.text" 申请查看；也可通过目录快速跳转或通过搜索定位特定内容。'
          : /剧本|目录|集数|分集/.test(query)
          ? '操作说明：先通过左上角“剧本”入口打开剧本面板；从当前可见的面板按钮进入“目录”；目录可滚动，需以页面观察到的最后可见条目和到底状态作为依据。操作说明不包含当前项目的集数、目录或剧本内容。'
          : '操作说明只描述界面如何操作，不提供当前项目的隐藏数据。先用 page.inspect 了解用户此刻可见的页面与目标。',
      };
    }
    if (call.name === 'ui.actAndObserve') {
      const action = call.arguments.action as MouseActionName;
      const targetId = String(call.arguments.targetId || '');
      if (!action?.startsWith('mouse.')) throw new Error('ui.actAndObserve 缺少合法鼠标动作。');

      if (!observedTargetsByTaskRef.current.get(task.id)?.has(targetId)) {
        throw new Error(`尚未从 page.inspect 观察到可操作目标：${targetId}`);
      }

      await animateMouseAction(action, targetId, call.arguments.arguments as Record<string, unknown> || {});
      if (signal?.aborted) return { aborted: true };
      await applyPageCommand(action, targetId, call.arguments.arguments as Record<string, unknown> || {});

      // Use the provided observe payload, or fallback to sensible defaults
      const observePayload = (call.arguments.observe && typeof call.arguments.observe === 'object')
        ? (call.arguments.observe as Record<string, unknown>)
        : { scope: (action === 'mouse.scroll' || action === 'mouse.type') ? targetId : 'overview' };

      const observeScope = typeof observePayload?.scope === 'string' && observePayload.scope !== 'overview' ? observePayload.scope : undefined;
      if (observeScope && observeScope !== targetId) {
        await animateMoveToTarget(observeScope);
        if (signal?.aborted) return { aborted: true };
      }

      return { action, targetId, page: rememberObservation(await inspectPage(observePayload)) };
    }
    if (call.name === 'user.ask') {
      const question = String(call.arguments.question || '需要您的确认或输入：');
      task.negotiationLog.push({ role: 'agent', content: question, timestamp: Date.now() });
      return new Promise<string>((resolve) => {
        setAgentQuestion({
          question,
          resolve: (answer: string) => {
            const finalAnswer = answer || '（用户未回答）';
            task.negotiationLog.push({ role: 'user', content: finalAnswer, timestamp: Date.now() });
            task.lastUserInputAt = Date.now();
            setAgentQuestion(null);
            resolve(finalAnswer);
          }
        });
      });
    }
    throw new Error(`未注册工具：${call.name}`);
  }, [animateMouseAction, applyPageCommand, inspectPage]);

  const updateAgentRuntimeTrace = useCallback((task: RuntimeTask, update?: (trace: AgentRuntimeTrace) => AgentRuntimeTrace) => {
    const taskSnapshot = snapshotRuntimeTask(task);
    setAgentRuntimeTraces(current => {
      const now = Date.now();
      const existing = current.find(trace => trace.taskId === task.id);
      const base: AgentRuntimeTrace = existing || {
        id: `trace_${task.id}`,
        taskId: task.id,
        goal: task.goal,
        createdAt: now,
        updatedAt: now,
        task: taskSnapshot,
        turns: [],
      };
      const next = update ? update({ ...base, task: taskSnapshot, updatedAt: now }) : { ...base, task: taskSnapshot, updatedAt: now };
      return [...current.filter(trace => trace.taskId !== task.id), next].slice(-12);
    });
  }, []);

  const handleRunAgent = async (overrideMessage?: string) => {
    const rawMessage = overrideMessage !== undefined ? overrideMessage : agentPrompt;
    if (!rawMessage.trim()) return;
    if (isAgentRunning || isAgentThinking) return;
    const userMessage = rawMessage.trim();
    if (overrideMessage === undefined) {
      setAgentPrompt('');
    }
    setIsAgentThinking(true);
    setIsAgentRunning(true);

    try {
      const agentModel = assetExtractionService.getNodeModels().agentModel;
      const isDashscopeModel = agentModel.startsWith('qwen') || agentModel.includes('glm') || agentModel.includes('ZHIPU') || agentModel.includes('zhipu');
      const savedKey = isDashscopeModel
        ? (localStorage.getItem('qwen_api_key') || localStorage.getItem('glm_api_key') || localStorage.getItem('deepseek_api_key'))
        : localStorage.getItem('deepseek_api_key');
      const toolConfig = getAgentToolConfig();
      const enabledTools = AGENT_TOOL_REGISTRY.filter((tool) => toolConfig[tool.id]).map((tool) => tool.id);

      let runtime = runtimeRef.current;
      let isNewTask = false;
      let taskId = activeTaskIdRef.current;

      const existingTask = runtime && taskId ? runtime.getTask(taskId) : undefined;
      if (!runtime || !taskId || !existingTask || ['cancelled', 'failed'].includes(existingTask.status)) {
        isNewTask = true;
        taskId = `task_${Date.now().toString(36)}`;
        activeTaskIdRef.current = taskId;
        runtime = new AgentRuntime({
          requestTurn: async (task: RuntimeTask, requireTool, signal) => {
            const turnId = `${task.id}:turn:${task.turn}`;
            const startedAt = Date.now();
            const requestBody = {
              userMessage, // Can remove if server uses negotiationLog
              history: task.history,
              events: task.events,
              observations: task.observations,
              project: { id: currentProject.id, name: currentProject.name },
              task: { 
                id: task.id, 
                goal: task.goal, 
                title: task.title, 
                plan: task.plan, 
                progress: task.progress, 
                subGoal: task.subGoal, 
                notes: task.notes, 
                turn: task.turn, 
                pendingCallIds: task.pendingCallIds,
                negotiationLog: task.negotiationLog,
                lastGoalUpdatedAt: task.lastGoalUpdatedAt,
                lastUserInputAt: task.lastUserInputAt
              },
              apiKey: savedKey, modelType: agentModel, enabledTools, requireTool,
            };
            updateAgentRuntimeTrace(task, trace => ({
              ...trace,
              turns: [...trace.turns.filter(turn => turn.id !== turnId), {
                id: turnId,
                turn: task.turn,
                requireTool,
                startedAt,
                taskBefore: snapshotRuntimeTask(task),
              }],
            }));
            try {
              const res = await fetch('/api/agent/turn', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
                signal,
              });
              const body = await res.json().catch(() => ({}));
              if (!res.ok) throw new Error(body.error || 'Agent 轮次失败');
              const result = body as AgentTurnResult;
              updateAgentRuntimeTrace(task, trace => ({
                ...trace,
                turns: trace.turns.map(turn => turn.id === turnId ? {
                  ...turn,
                  completedAt: Date.now(),
                  transport: result.debug,
                  parsedResult: result,
                } : turn),
              }));
              
              if (result.speak) {
                setAgentState(prev => ({ ...prev, speak: result.speak }));
              }
              
              return result;
            } catch (error) {
              if (signal?.aborted || (error instanceof Error && error.name === 'AbortError')) {
                return { narration: [], toolCalls: [], complete: false };
              }
              const message = error instanceof Error ? error.message : 'Agent 轮次失败';
              updateAgentRuntimeTrace(task, trace => ({
                ...trace,
                turns: trace.turns.map(turn => turn.id === turnId ? { ...turn, completedAt: Date.now(), error: message } : turn),
              }));
              throw error;
            }
          },
          executeTool: (call, task, signal) => executeAgentTool(call, task, signal),
          requireVisibleInteraction: true,
          isParallelSafe: (call) => {
            if (call.name === 'guide.lookup') return true;
            if (call.name === 'page.inspect') {
              const scope = typeof call.arguments?.scope === 'string' ? call.arguments.scope : 'overview';
              return !scope || scope === 'overview';
            }
            return false;
          },
          onTaskChange: (task) => {
            updateAgentRuntimeTrace(task);
            const status = task.status;
            setAgentTask({
              id: task.id,
              title: task.title,
              status,
              events: task.events.slice(-16).map(event => ({
                id: event.id,
                text: event.text,
                kind: event.type === 'tool' ? 'tool' : event.type === 'answer' ? 'answer' : 'work',
              })),
            });
          },
        });
        runtimeRef.current = runtime;
      }

      let task: RuntimeTask;
      if (isNewTask) {
        task = runtime.createTask({ id: taskId!, sessionId: currentProject.id, goal: userMessage });
        updateAgentRuntimeTrace(task);
        // Auto inspect if enabled
        if (localStorage.getItem('auto_inspect_on_launch') !== 'false') {
          try {
            const initObservation = await inspectPage({ scope: 'overview' });
            observedTargetsByTaskRef.current.set(task.id, new Set(initObservation.components.map(component => component.id)));
            
            task.observations.push({
              role: 'tool',
              content: {
                name: 'page.inspect',
                status: 'succeeded',
                output: initObservation
              }
            });
            
            task.events.push({
              id: `auto_${Date.now()}`,
              taskId: task.id,
              turnId: `${task.id}:turn:0`,
              type: 'tool',
              toolName: 'page.inspect',
              text: '首轮自动执行 page.inspect (overview) 获取最新状态',
              status: 'succeeded',
              output: initObservation,
              createdAt: Date.now()
            });
          } catch (e) {
            console.error("Auto inspect failed", e);
          }
        }
      } else {
        runtime.addUserInput(taskId!, userMessage);
        task = runtime.requireTask(taskId!);
      }

      await runtime.wake(taskId!);
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      setAgentTask(previous => previous ? {
        ...previous,
        status: 'failed',
        events: [...previous.events, { id: `${Date.now()}_${Math.random()}`, text: err.message || 'Agent 执行失败', kind: 'answer' }].slice(-16),
      } : previous);
    } finally {
      setIsAgentThinking(false);
      setIsAgentRunning(false);
      setTimeout(() => {
        setAgentState(prev => ({ ...prev, speak: undefined }));
      }, 5000); // Clear speak text 5 seconds after the agent stops
    }
  };

  const handlePauseTask = () => {
    if (!runtimeRef.current || !activeTaskIdRef.current) return;
    runtimeRef.current.pause(activeTaskIdRef.current);
    setIsAgentRunning(false);
    setIsAgentThinking(false);
  };

  const handleResumeTask = async () => {
    if (!runtimeRef.current || !activeTaskIdRef.current) return;
    setIsAgentRunning(true);
    try {
      await runtimeRef.current.resume(activeTaskIdRef.current);
    } catch (err: any) {
      console.error('Resume failed:', err);
    } finally {
      setIsAgentRunning(false);
      setIsAgentThinking(false);
    }
  };

  const handleCancelTask = () => {
    if (!runtimeRef.current || !activeTaskIdRef.current) return;
    runtimeRef.current.cancel(activeTaskIdRef.current);
    setIsAgentRunning(false);
    setIsAgentThinking(false);
    setAgentState(prev => ({ ...prev, isMoving: false, isActive: false, visible: false }));
  };

  const handleSendTaskChat = async () => {
    const msg = taskChatMessage.trim();
    if (!msg) return;
    setTaskChatMessage('');
    setIsTaskChatOpen(false);
    await handleRunAgent(msg);
  };

  // Close user context menu on any pointer down
  useEffect(() => {
    const closeMenu = (e: PointerEvent) => {
      setContextMenus(prev => {
        const clickerId = e.isTrusted ? 'user' : 'agent';
        
        // Only the clicker can close their own menu by clicking outside
        if (prev[clickerId]) {
          const next = { ...prev };
          delete next[clickerId];
          return next;
        }
        
        return prev;
      });
    };
    document.addEventListener('pointerdown', closeMenu);
    return () => document.removeEventListener('pointerdown', closeMenu);
  }, []);

  const isDraggingCanvasRef = useRef(false);

  // Intent-driven lazy restoration logic
  const restoreCanvasStyles = useCallback(() => {
    // If the user is actively dragging the canvas OR a card, strictly forbid restoration
    if (isDraggingCanvasRef.current || (window as any).isDraggingCard) return;
    
    // Garbage Collection / Mount Trigger: Update circular culling bounds
    updateCircularCulling();
    
    // Restore accurate LOD states now that the user has stopped zooming or dragging
    const currentScale = tScale.get();
    setIsMicroLod(currentScale < 0.60);
    setIsNanoLod(currentScale < 0.60);
    setMountEpoch(n => (n + 1) % 1000000);
    
    const workspace = document.getElementById('canvas-workspace');
    if (workspace) {
      if (workspace.getAttribute('data-zooming') === 'true') {
        // 2. Bypass transition storm: Instantly restore styles without CSS interpolation (Fixes end stutter)
        workspace.style.transition = 'none';
        workspace.setAttribute('data-zooming', 'false');
        isZoomingRef.current = false;
        setIsZooming(false); // MUST sync React state so it doesn't revert on next render
        void workspace.offsetHeight;
        requestAnimationFrame(() => {
          workspace.style.transition = '';
        });
      }
    }
  }, [updateCircularCulling, tScale]);

  useEffect(() => {
    (window as any).resetGlobalZoomTimer = () => {
      clearTimeout(zoomTimeoutRef.current);
      const idleDelay = tScale.get() >= 0.60 ? 150 : 2000;
      zoomTimeoutRef.current = setTimeout(restoreCanvasStyles, idleDelay);
    };
    return () => { delete (window as any).resetGlobalZoomTimer; };
  }, [restoreCanvasStyles, tScale]);

  const resetOverviewPrompt = useCallback(() => {
    wheelZoomOutAccumulatorRef.current = 0;
    if (overviewToastTimerRef.current) {
      clearTimeout(overviewToastTimerRef.current);
      overviewToastTimerRef.current = null;
    }
    setShowOverviewPromptToast(false);
    setOverviewPromptProgress(0);
  }, []);
  resetOverviewPromptRef.current = resetOverviewPrompt;

  const enterOverviewMode = useCallback(() => {
    resetOverviewPrompt();
    if (isOverviewModeRef.current) return;

    // Save current transform state to revert if needed
    if (!preOverviewTransform.current) {
      preOverviewTransform.current = {
        x: targetTransform.current.x,
        y: targetTransform.current.y,
        scale: targetTransform.current.scale
      };
    }

    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    
    // Calculate world bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    if (cardsRef.current.length === 0) {
       minX = -1000; minY = -1000; maxX = 1000; maxY = 1000;
    } else {
       cardsRef.current.forEach(c => {
         const dim = getCardSize(c);
         if (c.x < minX) minX = c.x;
         if (c.y < minY) minY = c.y;
         if (c.x + dim.width > maxX) maxX = c.x + dim.width;
         if (c.y + dim.height > maxY) maxY = c.y + dim.height;
       });
    }
    
    // Add padding
    const padding = 1500;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;
    
    const worldW = maxX - minX;
    const worldH = maxY - minY;
    
    // Calculate scale to fit screen
    const targetScale = Math.min(rect.width / worldW, rect.height / worldH);
    
    // Calculate tx and ty to center the bounding box
    const targetTx = (rect.width / 2) - ((minX + maxX) / 2) * targetScale;
    const targetTy = (rect.height / 2) - ((minY + maxY) / 2) * targetScale;
    
    targetTransform.current = { x: targetTx, y: targetTy, scale: targetScale };
    
    // Prepare LOD transition
    const workspace = document.getElementById('canvas-workspace');
    if (workspace && workspace.getAttribute('data-zooming') !== 'true') {
      workspace.setAttribute('data-zooming', 'true');
      isZoomingRef.current = true;
      setIsZooming(true);
    }
    clearTimeout(zoomTimeoutRef.current);
    zoomTimeoutRef.current = setTimeout(restoreCanvasStyles, 2000);
    
    const animConfig: any = { type: 'tween', duration: 0.4, ease: [0.16, 1, 0.3, 1] };
    animate(tScale, targetScale, animConfig);
    animate(tx, targetTx, animConfig);
    animate(ty, targetTy, animConfig);

    setIsOverviewMode(true);
    isOverviewModeRef.current = true;
  }, [tScale, tx, ty, restoreCanvasStyles, resetOverviewPrompt]);

  const exitOverviewToOriginal = useCallback(() => {
    resetOverviewPrompt();
    if (preOverviewTransform.current) {
      const { x, y, scale } = preOverviewTransform.current;
      targetTransform.current = { x, y, scale };
      
      const animConfig: any = { type: 'tween', duration: 0.4, ease: [0.16, 1, 0.3, 1] };
      animate(tScale, scale, animConfig);
      animate(tx, x, animConfig);
      animate(ty, y, animConfig);
      
      clearTimeout(zoomTimeoutRef.current);
      zoomTimeoutRef.current = setTimeout(restoreCanvasStyles, 400);
      
      preOverviewTransform.current = null;
    }
    setIsOverviewMode(false);
    isOverviewModeRef.current = false;
  }, [tScale, tx, ty, restoreCanvasStyles, resetOverviewPrompt]);

  enterOverviewModeRef.current = enterOverviewMode;
  exitOverviewToOriginalRef.current = exitOverviewToOriginal;

  const animateZoomTo = useCallback((newScale: number) => {
    resetOverviewPrompt();
    preOverviewTransform.current = null;
    setIsOverviewMode(false);
    isOverviewModeRef.current = false;

    const prevScale = tScale.get();
    if (Math.abs(prevScale - newScale) < 0.001) return;
    
    // 1. Degrade styles during active animation to keep frames buttery smooth (Intent-Driven Lazy Restoration)
    const workspace = document.getElementById('canvas-workspace');
    if (workspace && workspace.getAttribute('data-zooming') !== 'true') {
      workspace.setAttribute('data-zooming', 'true');
      isZoomingRef.current = true;
      setIsZooming(true);
    }
    
    // 2. Clear previous restoration timers
    clearTimeout(zoomTimeoutRef.current);
    
    // 3. Set restoration timer based on target scale
    const idleDelay = newScale >= 0.60 ? 150 : 2000;
    zoomTimeoutRef.current = setTimeout(restoreCanvasStyles, idleDelay);

    // 4. Calculate coordinate transition zooming toward center of screen
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const scaleRatio = newScale / prevScale;
    
    const newX = centerX - (centerX - tx.get()) * scaleRatio;
    const newY = centerY - (centerY - ty.get()) * scaleRatio;
    
    targetTransform.current = { x: newX, y: newY, scale: newScale };
    
    animate(tScale, newScale, { type: 'tween', duration: 0.22, ease: 'easeOut' });
    animate(tx, newX, { type: 'tween', duration: 0.22, ease: 'easeOut' });
    animate(ty, newY, { type: 'tween', duration: 0.22, ease: 'easeOut' });
  }, [tScale, tx, ty, restoreCanvasStyles, resetOverviewPrompt]);

  const handleZoomIn = useCallback(() => {
    resetOverviewPrompt();
    preOverviewTransform.current = null;
    setIsOverviewMode(false);
    isOverviewModeRef.current = false;
    const prevScale = tScale.get();
    const newScale = Math.min(prevScale * 1.2, 5);
    animateZoomTo(newScale);
  }, [tScale, animateZoomTo, resetOverviewPrompt]);

  const handleZoomOut = useCallback(() => {
    const prevScale = tScale.get();
    if (prevScale <= 0.105) {
      wheelZoomOutAccumulatorRef.current += 1;
      const progress = Math.min(1, wheelZoomOutAccumulatorRef.current / 8);
      setOverviewPromptProgress(progress);
      setShowOverviewPromptToast(true);

      if (overviewToastTimerRef.current) {
        clearTimeout(overviewToastTimerRef.current);
      }
      overviewToastTimerRef.current = setTimeout(() => {
        resetOverviewPrompt();
      }, 1800);

      if (wheelZoomOutAccumulatorRef.current >= 8) {
        resetOverviewPrompt();
        enterOverviewMode();
      }
      return;
    }
    const newScale = Math.max(prevScale / 1.2, 0.1);
    animateZoomTo(newScale);
  }, [tScale, animateZoomTo, enterOverviewMode, resetOverviewPrompt]);

  const handleZoomReset = useCallback(() => {
    preOverviewTransform.current = null;
    setIsOverviewMode(false);
    isOverviewModeRef.current = false;
    animateZoomTo(1);
  }, [animateZoomTo]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    // 1. Ignore double-clicks on interactive elements (inputs, textareas, buttons, modal dialogs, etc.)
    const target = e.target as HTMLElement | null;
    if (!target) return;
    if (target.closest('input, textarea, select, button, [contenteditable="true"], [role="button"], [role="dialog"], aside, [data-prevent-canvas-wheel]')) {
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    // Prevent default selection side-effects
    e.preventDefault();
    window.getSelection()?.removeAllRanges();

    clearTimeout(doubleClickTimeoutRef.current);

    const rect = container.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;

    // Calculate clicked world position
    const currentScale = tScale.get();
    const currentTx = tx.get();
    const currentTy = ty.get();
    const worldX = (cursorX - currentTx) / currentScale;
    const worldY = (cursorY - currentTy) / currentScale;

    // Intent-Driven Lazy Restoration: degrade heavy effects during rapid tween
    const workspace = document.getElementById('canvas-workspace');
    if (workspace && workspace.getAttribute('data-zooming') !== 'true') {
      workspace.setAttribute('data-zooming', 'true');
      isZoomingRef.current = true;
      setIsZooming(true);
    }

    // Direct Double Click Zoom Toggle:
    // If zoomed in (scale >= 0.20), zoom directly out to 10% (0.1) anchored at the exact mouse cursor position
    // If zoomed out (scale < 0.20), zoom directly into 100% (1.0) anchored at the exact mouse cursor position
    if (currentScale >= 0.20) {
      const targetScale = 0.1;
      const targetTx = cursorX - worldX * targetScale;
      const targetTy = cursorY - worldY * targetScale;

      targetTransform.current = { x: targetTx, y: targetTy, scale: targetScale };

      clearTimeout(zoomTimeoutRef.current);
      zoomTimeoutRef.current = setTimeout(restoreCanvasStyles, 2000);

      animate(tScale, targetScale, { type: 'tween', duration: 0.40, ease: [0.16, 1, 0.3, 1] });
      animate(tx, targetTx, { type: 'tween', duration: 0.40, ease: [0.16, 1, 0.3, 1] });
      animate(ty, targetTy, { type: 'tween', duration: 0.40, ease: [0.16, 1, 0.3, 1] });
    } else {
      // Zoom directly into 100% anchored at the exact mouse cursor position
      const targetScale = 1.0;
      const targetTx = cursorX - worldX * targetScale;
      const targetTy = cursorY - worldY * targetScale;

      targetTransform.current = { x: targetTx, y: targetTy, scale: targetScale };

      clearTimeout(zoomTimeoutRef.current);
      zoomTimeoutRef.current = setTimeout(restoreCanvasStyles, 150);

      animate(tScale, targetScale, { type: 'tween', duration: 0.36, ease: [0.16, 1, 0.3, 1] });
      animate(tx, targetTx, { type: 'tween', duration: 0.36, ease: [0.16, 1, 0.3, 1] });
      animate(ty, targetTy, { type: 'tween', duration: 0.36, ease: [0.16, 1, 0.3, 1] });
    }
  }, [tScale, tx, ty, restoreCanvasStyles]);

    useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // If settings page is currently open, never zoom canvas and let settings page scroll naturally
      if (showSettingsRef.current) {
        return;
      }

      // If wheel event originated from an overlay (drawer, modal, dropdown, scrollable area, editor), don't zoom canvas
      // For inputs/textareas, only prevent zoom if they are actively focused.
      const target = e.target as HTMLElement | null;
      if (target) {
        const closestInput = target.closest('textarea, input, select') as HTMLElement | null;
        const isFocusedInput = closestInput && document.activeElement === closestInput;
        
        const isInsideOverlay = target.closest(
          '[data-prevent-canvas-wheel], [data-modal], aside, .overflow-y-auto, .overflow-x-auto, .overflow-auto, [role="dialog"]'
        );

        if (isFocusedInput || isInsideOverlay) {
          return;
        }
      }

      e.preventDefault();
      clearTimeout(doubleClickTimeoutRef.current);
      
      // Per user request: Mouse wheel directly zooms the canvas (no Ctrl required).
      // If deltaY is 0 (e.g. pure horizontal trackpad swipe), we ignore it since zoom relies on vertical scroll axis.
      if (e.deltaY === 0) return;

      // If currently in overview mode:
      if (isOverviewModeRef.current) {
        // Scrolling up (zooming in) breaks out of overview focused on mouse cursor position
        if (e.deltaY < -15) {
          const rect = container.getBoundingClientRect();
          const cursorX = e.clientX - rect.left;
          const cursorY = e.clientY - rect.top;
          const currentScale = tScale.get();
          const worldX = (cursorX - tx.get()) / currentScale;
          const worldY = (cursorY - ty.get()) / currentScale;

          const targetScale = preOverviewTransform.current ? preOverviewTransform.current.scale : 1.0;
          const targetTx = cursorX - worldX * targetScale;
          const targetTy = cursorY - worldY * targetScale;

          targetTransform.current = { x: targetTx, y: targetTy, scale: targetScale };

          const animConfig: any = { type: 'tween', duration: 0.4, ease: [0.16, 1, 0.3, 1] };
          animate(tScale, targetScale, animConfig);
          animate(tx, targetTx, animConfig);
          animate(ty, targetTy, animConfig);

          clearTimeout(zoomTimeoutRef.current);
          zoomTimeoutRef.current = setTimeout(restoreCanvasStyles, 400);

          preOverviewTransform.current = null;
          setIsOverviewMode(false);
          isOverviewModeRef.current = false;
          return;
        }
        // Ignore further wheel zoom out while in overview
        return;
      }

      const prevTarget = targetTransform.current;

      // Special breakout to Overview Mode when already at 10% min zoom and continuing to scroll out:
      if (prevTarget.scale <= 0.105 && e.deltaY > 0) {
        const isDiscreteWheel = Math.abs(e.deltaY) >= 20;
        const step = isDiscreteWheel ? 1 : Math.max(e.deltaY / 100, 0.25);
        wheelZoomOutAccumulatorRef.current += step;
        const progress = Math.min(1, wheelZoomOutAccumulatorRef.current / 8);
        setOverviewPromptProgress(progress);
        setShowOverviewPromptToast(true);

        if (overviewToastTimerRef.current) {
          clearTimeout(overviewToastTimerRef.current);
        }
        overviewToastTimerRef.current = setTimeout(() => {
          resetOverviewPromptRef.current();
        }, 1800);

        if (wheelZoomOutAccumulatorRef.current >= 8) {
          resetOverviewPromptRef.current();
          enterOverviewModeRef.current();
          return;
        }
        return;
      } else if (e.deltaY < 0) {
        if (wheelZoomOutAccumulatorRef.current > 0 || overviewToastTimerRef.current) {
          resetOverviewPromptRef.current();
        }
      }

      const isDiscrete = Math.abs(e.deltaY) >= 20;
      
      // 1. Bypass React's 16ms delay: synchronously mutate DOM for immediate style degradation (Fixes start stutter)
      const workspace = document.getElementById('canvas-workspace');
      if (workspace && workspace.getAttribute('data-zooming') !== 'true') {
        workspace.setAttribute('data-zooming', 'true');
        isZoomingRef.current = true;
        setIsZooming(true);
      }

      // 2. Clear the fallback timeout on every wheel tick
      clearTimeout(zoomTimeoutRef.current);
      
      // Continuous pinch on touchpad produces smaller deltaY, discrete mouse wheel produces larger deltaY
      const zoomSensitivity = isDiscrete ? 0.002 : 0.004;
      const delta = -e.deltaY * zoomSensitivity;
      
      const newScale = Math.min(Math.max(0.1, prevTarget.scale * Math.exp(delta)), 5);
      
      // 3. LOD Rasterization Strategy:
      // If zoomed in (scale >= 0.60), restore quickly (150ms) for crisp text.
      // If zoomed out (scale < 0.60), restore slowly (2000ms) to prevent massive reflow stutters.
      const idleDelay = newScale >= 0.60 ? 150 : 2000;
      zoomTimeoutRef.current = setTimeout(restoreCanvasStyles, idleDelay);
      
      const rect = container.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      
      const scaleRatio = newScale / prevTarget.scale;
      const newX = cursorX - (cursorX - prevTarget.x) * scaleRatio;
      const newY = cursorY - (cursorY - prevTarget.y) * scaleRatio;
      
      targetTransform.current = { x: newX, y: newY, scale: newScale };

      if (isDiscrete) {
        animate(tScale, newScale, { type: 'tween', duration: 0.15, ease: 'easeOut' });
        animate(tx, newX, { type: 'tween', duration: 0.15, ease: 'easeOut' });
        animate(ty, newY, { type: 'tween', duration: 0.15, ease: 'easeOut' });
      } else {
        tScale.set(newScale);
        tx.set(newX);
        ty.set(newY);
      }
    };

    const preventGesture = (e: Event) => e.preventDefault();
    container.addEventListener('gesturestart', preventGesture);
    container.addEventListener('gesturechange', preventGesture);
    container.addEventListener('gestureend', preventGesture);
    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('gesturestart', preventGesture);
      container.removeEventListener('gesturechange', preventGesture);
      container.removeEventListener('gestureend', preventGesture);
      container.removeEventListener('wheel', handleWheel);
    };
  }, [tx, ty, tScale, restoreCanvasStyles]);

  const onPointerDown = (e: React.PointerEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (e.button === 0 && (preOverviewTransform.current || isOverviewModeRef.current)) {
      e.stopPropagation();
      e.preventDefault();
      
      const currentScale = tScale.get();
      const currentTx = tx.get();
      const currentTy = ty.get();
      
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      
      const worldX = (clickX - currentTx) / currentScale;
      const worldY = (clickY - currentTy) / currentScale;
      
      const targetScale = preOverviewTransform.current ? preOverviewTransform.current.scale : 1.0;
      const targetTx = clickX - worldX * targetScale;
      const targetTy = clickY - worldY * targetScale;
      
      targetTransform.current = { x: targetTx, y: targetTy, scale: targetScale };
      
      const animConfig: any = { type: 'tween', duration: 0.4, ease: [0.16, 1, 0.3, 1] };
      animate(tScale, targetScale, animConfig);
      animate(tx, targetTx, animConfig);
      animate(ty, targetTy, animConfig);
      
      clearTimeout(zoomTimeoutRef.current);
      zoomTimeoutRef.current = setTimeout(restoreCanvasStyles, 400);
      
      // Clear overview state to commit the new position
      preOverviewTransform.current = null;
      setIsOverviewMode(false);
      isOverviewModeRef.current = false;
      return;
    }

    if (e.button === 0) {
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
        const canvasX = (cursorX - tx.get()) / tScale.get();
        const canvasY = (cursorY - ty.get()) / tScale.get();

        // In Nano-LOD mode, DOM cards are unmounted for 60fps performance.
        // Hit-test against pure world coordinates to select or drag cards:
        if (isNanoLod) {
          let clickedCard: CardData | undefined;
          for (let i = cards.length - 1; i >= 0; i--) {
            const c = cards[i];
            const dim = getCardSize(c);
            if (canvasX >= c.x && canvasX <= c.x + dim.width && canvasY >= c.y && canvasY <= c.y + dim.height) {
              clickedCard = c;
              break;
            }
          }

          if (clickedCard && pickerSession) {
            e.stopPropagation();
            handleTogglePickerCard(clickedCard.id);
            return;
          }

          if (clickedCard) {
            handleCardSelect(e, clickedCard.id);
            nanoDragRef.current = {
              cardId: clickedCard.id,
              startX: e.clientX,
              startY: e.clientY,
              didMove: false,
              initialCards: cards.map(c => ({ id: c.id, x: c.x, y: c.y })),
            };
            containerRef.current?.setPointerCapture(e.pointerId);
            return;
          }
        }

        const isBackgroundTarget = 
          e.target === containerRef.current || 
          (e.target as Element).id === 'grid-bg-overlay' || 
          (e.target as Element).id === 'nano-lod-canvas' ||
          (e.target as Element).id === 'canvas-workspace';

        if (isBackgroundTarget) {
          if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
            setSelectedCardIds([]);
          }
          setSelectionBox({
            startX: canvasX,
            startY: canvasY,
            currentX: canvasX,
            currentY: canvasY,
            initialSelectedIds: e.shiftKey || e.ctrlKey || e.metaKey ? [...selectedCardIds] : []
          });
        }
    }
    // Only start dragging on middle click
    if (e.button !== 1) return;
    
    // Bypass React state to eliminate the 16ms start-of-drag stutter
    isDraggingCanvasRef.current = true;
    
    // Instead of forcing a React re-render immediately with setIsDragging(true) which blocks the main thread,
    // we use document.body.style.cursor to update the cursor instantly without React.
    document.body.style.cursor = 'grabbing';
    
    // Note: We deliberately DO NOT set data-zooming=true here anymore.
    // Pure translation (dragging) is hardware accelerated and composited easily by the GPU even with heavy box-shadows.
    // Toggling the shadows OFF here was actually causing a style recalculation stutter!
    
    lastPointer.current = { x: e.clientX, y: e.clientY };
    containerRef.current?.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (isDraggingCanvasRef.current) {
      const dx = e.clientX - lastPointer.current.x;
      const dy = e.clientY - lastPointer.current.y;
      lastPointer.current = { x: e.clientX, y: e.clientY };
      
      const newX = tx.get() + dx;
      const newY = ty.get() + dy;
      
      targetTransform.current.x = newX;
      targetTransform.current.y = newY;
      
      tx.set(newX);
      ty.set(newY);
    } else if (nanoDragRef.current) {
      const currentScale = tScale.get();
      const dx = (e.clientX - nanoDragRef.current.startX) / currentScale;
      const dy = (e.clientY - nanoDragRef.current.startY) / currentScale;
      if (Math.hypot(e.clientX - nanoDragRef.current.startX, e.clientY - nanoDragRef.current.startY) > 3) {
        nanoDragRef.current.didMove = true;
      }
      if (nanoDragRef.current.didMove) {
        const draggingId = nanoDragRef.current.cardId;
        const isDraggingSelected = selectedCardIdsRef.current.includes(draggingId);
        const initMap = new Map<string, { id: string; x: number; y: number }>(
          nanoDragRef.current.initialCards.map(c => [c.id, c])
        );
        setCards(prev => prev.map(c => {
          if (isDraggingSelected ? selectedCardIdsRef.current.includes(c.id) : c.id === draggingId) {
            const init = initMap.get(c.id);
            if (init) return { ...c, x: init.x + dx, y: init.y + dy };
          }
          return c;
        }), false);
      }
    } else if (selectionBox) {
      const canvasX = (e.clientX - tx.get()) / tScale.get();
      const canvasY = (e.clientY - ty.get()) / tScale.get();
      
      setSelectionBox(prev => prev ? { ...prev, currentX: canvasX, currentY: canvasY } : null);
      
      const minX = Math.min(selectionBox.startX, canvasX);
      const maxX = Math.max(selectionBox.startX, canvasX);
      const minY = Math.min(selectionBox.startY, canvasY);
      const maxY = Math.max(selectionBox.startY, canvasY);
      
      const newlySelected = cards.filter(card => {
        const dim = getCardSize(card);
        const cw = dim.width;
        const ch = dim.height;
        return (
          card.x < maxX && 
          card.x + cw > minX && 
          card.y < maxY && 
          card.y + ch > minY
        );
      }).map(c => c.id);
      
      // Merge with initial selection if modifiers were used
      const merged = new Set([...selectionBox.initialSelectedIds, ...newlySelected]);
      setSelectedCardIds(Array.from(merged));
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    isDraggingCanvasRef.current = false;
    document.body.style.cursor = 'default';
    
    if (nanoDragRef.current) {
      if (nanoDragRef.current.didMove) {
        // Record moved cards into history on pointer release
        setCards(prev => [...prev], true);
      }
      nanoDragRef.current = null;
    }

    // Instead of forcing a restore immediately after a middle-click drag,
    // we assume the user might drag or zoom again very soon.
    // So we reset the "idle" timer using our LOD Rasterization strategy.
    if (e.button === 1) {
      clearTimeout(zoomTimeoutRef.current);
      const idleDelay = tScale.get() >= 0.60 ? 150 : 2000;
      zoomTimeoutRef.current = setTimeout(restoreCanvasStyles, idleDelay);
    }
    
    setSelectionBox(null);
    containerRef.current?.releasePointerCapture(e.pointerId);
  };

  useEffect(() => {
    // Escape key listener to exit picker session
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && pickerSession) {
        e.preventDefault();
        handleCancelPickerSession();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pickerSession, handleCancelPickerSession]);

  useEffect(() => {
    // INTENT SIGNAL: The user opened a massive overlay. The canvas is now a background.
    if (showSettings || isScriptDrawerOpen) {
      restoreCanvasStyles();
    }
  }, [showSettings, isScriptDrawerOpen, restoreCanvasStyles]);

  useEffect(() => {
    // INTENT SIGNAL: Selecting nodes indicates active inspection or editing intent.
    // Guard against running during active camera tween/zoom to avoid frame jitter or premature restoration
    if (selectedCardIds.length > 0 && !isZoomingRef.current) {
      restoreCanvasStyles();
    }
  }, [selectedCardIds, restoreCanvasStyles]);

  const visibleCards = useMemo(() => {
    // If visibleCardIdSet has not yet initialized, calculate directly for first frame
    if (visibleCardIdSet.size === 0 && cards.length > 0) {
      if (typeof window === 'undefined') return cards;
      const vp = {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        tx: tx.get(),
        ty: ty.get(),
        scale: tScale.get()
      };
      return cards.filter(card => 
        selectedCardIds.includes(card.id) || isCardIntersectingRectangle(card, vp)
      );
    }
    return cards.filter(card => visibleCardIdSet.has(card.id));
  }, [cards, visibleCardIdSet, selectedCardIds, tx, ty, tScale]);

  // --- Asynchronous Progressive LOD Mounting Engine ---
  // Guarantees 60fps zooming and panning fluid motion by deferring DOM node mounting.
  // 1. When actively zooming or dragging: Quota = 0, zero new DOM mounts (pure GPU transform-first).
  // 2. NanoLodCanvas renders all cards as hardware-accelerated 2D canvas thumbnails underneath.
  // 3. When motion stops / camera idles: Stagger-mounts cards frame-by-frame starting from center out.
  // 4. Different LOD levels have adaptive quotas (Macro: 1/f, Standard: 3/f, Micro: 8/f, Nano: 0).
  // 5. If the user touches the wheel or drags midway, mounting pauses immediately without stutter.
  useEffect(() => {
    if (!isDomCardsActive) {
      setRenderedCardIds(prev => prev.size === 0 ? prev : new Set());
      return;
    }

    // While user is actively zooming or dragging, strictly freeze DOM mounts for 60fps GPU smoothness
    if (isZooming || isDraggingCanvasRef.current) {
      return;
    }

    const visibleIds = new Set(visibleCards.map(c => c.id));
    const pendingCards = visibleCards.filter(c => !renderedCardIds.has(c.id));
    const hasCulled = Array.from(renderedCardIds).some(id => !visibleIds.has(id));

    // If no new cards need mounting and no culled cards need unmounting, we are fully settled!
    if (pendingCards.length === 0 && !hasCulled) {
      return;
    }

    // If only culled cards need unmounting, clean them up immediately
    if (pendingCards.length === 0 && hasCulled) {
      setRenderedCardIds(prev => {
        const next = new Set<string>();
        for (const id of prev) {
          if (visibleIds.has(id)) next.add(id);
        }
        return next;
      });
      return;
    }

    let rafId: number;

    const mountStep = () => {
      // Re-check interaction flag: if user started zooming/dragging during the rAF, abort immediately
      if (isZoomingRef.current || isDraggingCanvasRef.current || (window as any).isDraggingCard) {
        return;
      }

      const scaleVal = tScale.get() || 1;
      const quota = getLodMountQuota(scaleVal, false);
      if (quota <= 0) return;

      // Calculate distance to viewport center for center-out progressive reveal
      const centerX = (window.innerWidth / 2 - tx.get()) / scaleVal;
      const centerY = (window.innerHeight / 2 - ty.get()) / scaleVal;

      const sortedPending = [...pendingCards].sort((a, b) => {
        const aSel = selectedCardIdsRef.current.includes(a.id);
        const bSel = selectedCardIdsRef.current.includes(b.id);
        if (aSel && !bSel) return -1;
        if (!aSel && bSel) return 1;

        const dimA = getCardSize(a);
        const dimB = getCardSize(b);
        const distA = Math.pow((a.x + dimA.width / 2) - centerX, 2) + Math.pow((a.y + dimA.height / 2) - centerY, 2);
        const distB = Math.pow((b.x + dimB.width / 2) - centerX, 2) + Math.pow((b.y + dimB.height / 2) - centerY, 2);
        return distA - distB;
      });

      const batchToMount = sortedPending.slice(0, quota).map(c => c.id);

      setRenderedCardIds(prev => {
        const next = new Set<string>();
        // Keep already mounted cards that are still visible
        for (const id of prev) {
          if (visibleIds.has(id)) {
            next.add(id);
          }
        }
        // Add the new quota batch
        for (const id of batchToMount) {
          next.add(id);
        }
        return next;
      });
    };

    rafId = requestAnimationFrame(mountStep);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [isDomCardsActive, isZooming, mountEpoch, visibleCards, renderedCardIds, tx, ty, tScale]);

  return (
    <div 
      ref={containerRef}
      className="w-screen h-screen overflow-hidden bg-[#e7e7e7] dark:bg-[#1c1c1e] relative select-none touch-none"
      onPointerDownCapture={(e) => {
        // If in overview mode and user left-clicks, navigate and dive down into the clicked position!
        if (e.button === 0 && (preOverviewTransform.current || isOverviewModeRef.current)) {
          e.stopPropagation();
          e.preventDefault();
          
          const rect = containerRef.current?.getBoundingClientRect();
          if (!rect) return;
          
          const currentScale = tScale.get();
          const currentTx = tx.get();
          const currentTy = ty.get();
          
          const clickX = e.clientX - rect.left;
          const clickY = e.clientY - rect.top;
          
          const worldX = (clickX - currentTx) / currentScale;
          const worldY = (clickY - currentTy) / currentScale;
          
          const targetScale = preOverviewTransform.current ? preOverviewTransform.current.scale : 1.0;
          const targetTx = clickX - worldX * targetScale;
          const targetTy = clickY - worldY * targetScale;
          
          targetTransform.current = { x: targetTx, y: targetTy, scale: targetScale };
          
          const animConfig: any = { type: 'tween', duration: 0.4, ease: [0.16, 1, 0.3, 1] };
          animate(tScale, targetScale, animConfig);
          animate(tx, targetTx, animConfig);
          animate(ty, targetTy, animConfig);
          
          clearTimeout(zoomTimeoutRef.current);
          zoomTimeoutRef.current = setTimeout(restoreCanvasStyles, 400);
          
          // Clear overview state to commit the new position
          preOverviewTransform.current = null;
          setIsOverviewMode(false);
          isOverviewModeRef.current = false;
          return;
        }

        // If in overview mode, clicking doesn't restore styles yet (until animation ends or it commits)
        if (preOverviewTransform.current || isOverviewModeRef.current) return;

        // INTENT SIGNAL: Intercept left-clicks in the capture phase.
        // If they click on a card, the card's `isSelected` state will grant it "privilege" 
        // to restore its own shadow instantly via CSS, so we DO NOT restore globally here.
        // If they click the background or UI, we globally restore.
        if (e.button === 0) {
          const target = e.target as HTMLElement;
          if (!target.closest('[data-card-id]')) {
            restoreCanvasStyles();
          }
        }
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Local Drag and Drop Overlay */}
      <AnimatePresence>
        {isDragOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 z-40 bg-blue-500/10 dark:bg-blue-500/5 backdrop-blur-[2px] pointer-events-none flex items-center justify-center border-4 border-dashed border-blue-500/40 m-4 rounded-[28px]"
          >
            <div className="flex flex-col items-center gap-3 p-8 rounded-[24px] bg-white/90 dark:bg-neutral-900/90 shadow-2xl border border-gray-200/50 dark:border-neutral-700/50 scale-100 max-w-sm text-center">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-500 dark:text-blue-400">
                <Plus className="w-8 h-8 animate-bounce" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">放置媒体文件到画布</h3>
              <p className="text-xs text-gray-500 dark:text-neutral-400 leading-relaxed">
                支持直接拖拽一个或多个本地图片、视频文件。松开即可自动创建画布卡片。
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Unified Project & Script Bible Hub */}
      <ProjectScriptBible
        currentProject={currentProject}
        projects={projects}
        onSelectProject={handleSelectProject}
        onCreateProject={handleCreateProject}
        onRenameProject={handleRenameProject}
        onDeleteProject={handleDeleteProject}
        onUpdateProject={handleUpdateCurrentProject}
        isOpen={isScriptDrawerOpen}
        onToggleOpen={() => setDrawerOpen(!scriptViewRef.current.drawerOpen)}
        onClose={() => setDrawerOpen(false)}
        isTocOpen={isScriptTocOpen}
        onTocOpenChange={setTocOpen}
        tocScrollRequest={tocScrollRequest}
        onTocAtBottomChange={setTocAtBottom}
        requestedView={scriptViewRequest}
        onViewChange={setScriptView}
        requestedTocItemId={requestedTocItemId}
        onTocItemOpened={handleTocItemOpened}
        onSelectionChange={setScriptSelection}
        onRequestGenerateAsset={handleRequestGenerateAsset}
      />

      {/* Top Right Controls */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        <button
          onClick={() => setShowSettings(true)}
          onPointerDown={e => e.stopPropagation()}
          className="w-[36px] h-[36px] rounded-2xl corner-squircle bg-gray-100 dark:bg-neutral-800 border border-gray-200/80 dark:border-[#404040]/80 shadow-md flex items-center justify-center text-gray-600 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors"
          title="后台配置"
        >
          <Settings className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            document.documentElement.classList.add('theme-transitioning');
            setIsDarkMode(!isDarkMode);
            setTimeout(() => {
              document.documentElement.classList.remove('theme-transitioning');
            }, 600);
          }}
          onPointerDown={e => e.stopPropagation()}
          className="w-[36px] h-[36px] rounded-2xl corner-squircle bg-gray-100 dark:bg-neutral-800 border border-gray-200/80 dark:border-[#404040]/80 shadow-md flex items-center justify-center text-gray-600 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors"
          title="Toggle Dark Mode"
        >
          <Sun className="w-4 h-4 hidden dark:block" />
          <Moon className="w-4 h-4 block dark:hidden" />
        </button>
      </div>

      <AnimatePresence>
        {showSettings && (
          <SettingsPage 
            onClose={() => setShowSettings(false)} 
            currentProject={currentProject}
            onUpdateProject={handleUpdateCurrentProject}
            agentRuntimeTraces={agentRuntimeTraces}
          />
        )}
      </AnimatePresence>

      {/* Infinite Dotted Grid Background - Lifted outside of transform workspace to fix compositor memory crash */}
      <motion.div 
        id="grid-bg-overlay"
        className="fixed inset-0 pointer-events-none opacity-30 dark:opacity-15 z-0"
        style={{
          backgroundImage: 'radial-gradient(circle, #a1a1aa 2px, transparent 2px)',
          backgroundPosition: gridBackgroundPosition,
          backgroundSize: gridBackgroundSize,
        }}
      />

      {/* Nano-LOD High Performance Hybrid Canvas Layer (Active when scale < 0.60 or during staggered DOM loading) */}
      <NanoLodCanvas
        cards={cards}
        selectedCardIds={selectedCardIds}
        pickerSession={pickerSession}
        scale={tScale}
        tx={tx}
        ty={ty}
        isDarkMode={isDarkMode}
        isActive={isNanoCanvasActive || (renderedCardIds.size < visibleCards.length && visibleCards.length > 0)}
        onReady={handleNanoCanvasReady}
        onThumbnailGenerated={(id, thumbnailUrl) => {
          handleUpdateCard(id, { thumbnailUrl }, false);
        }}
      />

      {/* Canvas Workspace for Nodes/Cards */}
      <motion.div 
        id="canvas-workspace"
        className={`absolute top-0 left-0 transform-gpu group/canvas z-0 ${isZooming || isDraggingCanvasRef.current ? 'will-change-transform' : ''}`}
        data-zooming={isZooming}
        data-scale-micro={isMicroLod}
        data-scale-nano={isNanoLod}
        style={{ transformOrigin: '0 0', x: tx, y: ty, scale: tScale }}
      >

        {/* Canvas Items: In Nano-LOD mode (scale < 0.60), unmount all DOM cards for ultra-fast Hybrid Canvas rendering */}
        {isDomCardsActive && visibleCards.map(card => {
          if (!renderedCardIds.has(card.id)) return null;
          const hasImage = Boolean(card.imageUrl || card.originalImageUrl || card.thumbnailUrl);
          const isPickerSelectable = Boolean(pickerSession && card.id !== pickerSession.targetCardId && hasImage);
          const pickerIndex = pickerSession ? pickerSession.selectedCardIds.indexOf(card.id) : -1;
          const pickerSelectionIndex = pickerIndex !== -1 ? pickerIndex + 1 : undefined;

          return (
            <GenerationCard 
              key={card.id}
              data={card}
              scale={tScale}
              tx={tx}
              ty={ty}
              isPickerTarget={pickerSession?.targetCardId === card.id}
              isPickerSelectable={isPickerSelectable}
              pickerSelectionIndex={pickerSelectionIndex}
              onStartCanvasPicker={handleStartCanvasPicker}
              isSelected={selectedCardIds.includes(card.id)}
              isZooming={isZooming}
              allCards={cards}
              currentProject={currentProject}
              onSelect={handleCardSelectWrapped}
              onDrag={handleCardDrag}
              onDragEnd={handleCardDragEnd}
              onDelete={handleCardDelete}
              onUpdate={handleUpdateCard}
            />
          );
        })}

        {/* Selection Box */}
        {selectionBox && (
          <div
            className="absolute border-blue-500/50 bg-blue-500/20 pointer-events-none z-[200]"
            style={{
              left: Math.min(selectionBox.startX, selectionBox.currentX),
              top: Math.min(selectionBox.startY, selectionBox.currentY),
              width: Math.abs(selectionBox.currentX - selectionBox.startX),
              height: Math.abs(selectionBox.currentY - selectionBox.startY),
              borderWidth: `2px`, // Scale border is tricky without re-rendering, 2px is fine
              borderStyle: 'solid'
            }}
          />
        )}
        
        {/* Agent Context Menus (Canvas Space) */}
        {Object.entries(contextMenus)
          .filter(([ownerId]) => ownerId !== 'user')
          .map(([ownerId, menu]: [string, any]) => (
          <div 
            key={ownerId}
            className="absolute z-[100] bg-gray-100 dark:bg-neutral-800 border border-gray-100 dark:border-[#404040] rounded-xl corner-squircle shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-1.5 flex flex-col min-w-[160px]"
            style={{ top: menu.canvasY, left: menu.canvasX }}
            onPointerDown={e => e.stopPropagation()}
          >
            <button
              data-agent-target={`create-card-btn-${ownerId}`}
              onClick={() => handleCreateCard(ownerId)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg corner-squircle text-[13px] font-medium text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-700 hover:text-gray-900 dark:hover:text-white transition-colors w-full text-left"
            >
              <Plus className="w-4 h-4" />
              生成图片
            </button>
          </div>
        ))}

        {/* Agent Cursor Overlay in absolute window space - Moved OUTSIDE transform-gpu */}
      </motion.div>
      
      {/* Project Loading Blur Mask */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="absolute inset-0 z-30 bg-gray-100 dark:bg-black pointer-events-auto flex items-center justify-center"
            onPointerDown={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center gap-4 text-gray-600 dark:text-neutral-400">
              <RefreshCw className="w-8 h-8 animate-spin text-purple-500" />
              <span className="text-sm font-medium tracking-widest shadow-sm">正在同步工作区...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AgentCursor 
        agentState={agentState}
        transform={transformValues}
        isIdle={true}
        isZooming={isZooming}
        onDragAgent={(newCanvasX, newCanvasY) => {
          setAgentState(prev => ({
            ...prev,
            x: newCanvasX,
            y: newCanvasY,
            isMoving: false
          }));
        }}
      />

      {agentTask && (
        <aside className="fixed bottom-5 right-5 z-[90] w-[320px] rounded-[24px] corner-squircle border border-violet-100 bg-gray-100 p-4 shadow-xl dark:border-violet-400/20 dark:bg-neutral-800">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-violet-600">Mira · 当前任务</p>
              <p className="mt-0.5 text-sm font-medium text-slate-800 dark:text-slate-100">{agentTask.title}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`rounded-full px-2 py-1 text-[11px] whitespace-nowrap ${
                ['planning', 'waiting_tools'].includes(agentTask.status) ? 'bg-violet-100 text-violet-700' :
                agentTask.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                agentTask.status === 'paused' || agentTask.status === 'waiting_user' ? 'bg-amber-100 text-amber-700' :
                'bg-red-100 text-red-700'
              }`}>
                {['planning', 'waiting_tools'].includes(agentTask.status) ? '执行中' :
                 agentTask.status === 'completed' ? '已完成' :
                 agentTask.status === 'paused' ? '已暂停' :
                 agentTask.status === 'waiting_user' ? '等待用户' :
                 agentTask.status === 'cancelled' ? '已取消' : '失败'}
              </span>
              {['completed', 'cancelled', 'failed'].includes(agentTask.status) && (
                <button 
                  onClick={() => setAgentTask(null)}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-gray-200 dark:hover:bg-neutral-800 dark:hover:text-slate-200 transition-colors"
                  title="关闭任务窗"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
          <div ref={agentTaskScrollRef} className="max-h-44 space-y-2 overflow-y-auto pr-1 text-xs leading-5">
            {agentTask.events.map(event => (
              <p key={event.id} className={event.kind === 'answer' ? 'font-medium text-slate-800 dark:text-white' : event.kind === 'tool' ? 'text-slate-400 dark:text-slate-500' : 'text-slate-600 dark:text-slate-300'}>{event.text}</p>
            ))}
          </div>

          {isTaskChatOpen && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendTaskChat();
              }}
              className="mt-3 flex items-center gap-1.5 pt-2.5 border-t border-gray-200 dark:border-[#404040]"
            >
              <input
                ref={taskChatInputRef}
                type="text"
                value={taskChatMessage}
                onChange={(e) => setTaskChatMessage(e.target.value)}
                placeholder="输入对话或新指令，向 Mira 发送..."
                className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 dark:border-[#404040] dark:bg-neutral-800 dark:text-slate-100 dark:placeholder-neutral-500"
                autoFocus
              />
              <button
                type="submit"
                disabled={!taskChatMessage.trim() || isAgentRunning}
                className="rounded-lg bg-violet-600 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-violet-700 disabled:opacity-40"
                title="发送"
              >
                <Send size={12} />
              </button>
            </form>
          )}
          
          <div className="mt-3 flex items-center gap-2 pt-3 border-t border-gray-200 dark:border-[#404040]">
            <button 
              onClick={() => {
                setIsTaskChatOpen(prev => !prev);
                setTimeout(() => {
                  taskChatInputRef.current?.focus();
                }, 50);
              }}
              className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-lg transition-colors corner-squircle ${
                isTaskChatOpen
                  ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
                  : 'bg-white dark:bg-neutral-800 text-slate-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-neutral-700'
              }`}
            >
              对话
            </button>
            {agentTask.status === 'paused' ? (
              <button 
                onClick={handleResumeTask}
                className="flex-1 py-1.5 px-3 text-xs font-medium rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors corner-squircle dark:bg-emerald-950/40 dark:text-emerald-400"
              >
                继续
              </button>
            ) : (
              <button 
                onClick={handlePauseTask}
                disabled={['completed', 'cancelled', 'failed'].includes(agentTask.status)}
                className="flex-1 py-1.5 px-3 text-xs font-medium rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors corner-squircle dark:bg-amber-900/30 dark:text-amber-400 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                暂停
              </button>
            )}
            <button 
              onClick={handleCancelTask}
              disabled={['completed', 'cancelled', 'failed'].includes(agentTask.status)}
              className="flex-1 py-1.5 px-3 text-xs font-medium rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors corner-squircle dark:bg-red-900/30 dark:text-red-400 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              停止
            </button>
          </div>
        </aside>
      )}

      {/* User Context Menu Overlay (Screen Space) */}
      <AnimatePresence>
        {Object.entries(contextMenus)
          .filter(([ownerId]) => ownerId === 'user')
          .map(([ownerId, menu]: [string, any]) => (
            <AgentContextMenu
              key={ownerId}
              isOpen={true}
              x={menu.x}
              y={menu.y}
              targetId={menu.targetId}
              agentPrompt={agentPrompt}
              onPromptChange={setAgentPrompt}
              onSubmit={() => {
                const currentTarget = menu.targetId;
                setContextMenus(prev => { const next = {...prev}; delete next['user']; return next; });
                if (currentTarget && !agentPrompt.includes('选中的')) {
                   // optionally append context
                }
                handleRunAgent();
              }}
              onClose={() => {
                setContextMenus(prev => { const next = {...prev}; delete next['user']; return next; });
              }}
              onAction={(action, targetId) => {
                if (action === 'new_card') handleCreateCard(ownerId);
                else if (action === 'delete' && targetId) {
                  setCards(prev => prev.filter(c => c.id !== targetId));
                }
                else if (action === 'clear') {
                  setCards([]);
                }
                else if (action === 'variant') {
                  setAgentPrompt(`生成一张和 ${targetId} 相似的变体`);
                  handleRunAgent();
                }
                else if (action === 'reference') {
                  // Future feature
                }
              }}
            />
          ))}
      </AnimatePresence>

      {/* Agent Question Modal */}
      <AnimatePresence>
        {agentQuestion && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/20"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-gray-100 dark:bg-neutral-800 border border-gray-200 dark:border-[#404040] shadow-2xl p-6 rounded-[24px] corner-squircle w-[420px] max-w-[90vw]"
            >
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-500" />
                Mira 的提问
              </h3>
              <p className="text-sm font-medium text-gray-700 dark:text-neutral-300 mb-5 leading-relaxed">
                {agentQuestion.question}
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  agentQuestion.resolve(fd.get('answer') as string);
                }}
              >
                <input
                  autoFocus
                  name="answer"
                  className="w-full bg-white dark:bg-neutral-800 border border-gray-200 dark:border-[#404040] rounded-xl corner-squircle px-3 py-2.5 text-[14px] text-gray-900 dark:text-white outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 mb-5 transition-all placeholder-gray-400 dark:placeholder-neutral-500 font-medium"
                  placeholder="输入你的回答..."
                  autoComplete="off"
                />
                <div className="flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => agentQuestion.resolve('')}
                    className="px-4 py-2 text-[13px] font-semibold text-gray-500 hover:bg-gray-200 dark:hover:bg-neutral-800 rounded-xl corner-squircle transition-colors"
                  >
                    跳过
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-[13px] font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-md rounded-xl corner-squircle transition-colors"
                  >
                    回复
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Left Scale Indicator HUD */}
      <ZoomControlGroup
        tScale={tScale}
        isOverviewMode={isOverviewMode}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomReset={handleZoomReset}
      />

      {/* Floating Toolbar */}
      <div 
        className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-gray-100 dark:bg-neutral-800 border border-gray-200 dark:border-[#404040] shadow-lg rounded-[20px] corner-squircle p-1.5 z-50"
        onPointerDown={e => e.stopPropagation()}
      >
        <button 
          onClick={undo}
          disabled={history.past.length === 0}
          className="p-2 rounded-xl corner-squircle hover:bg-gray-200 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
          title="撤销 (Ctrl+Z)"
        >
          <Undo2 className="w-4 h-4 text-gray-700 dark:text-neutral-300" />
        </button>
        <div className="w-[1px] h-4 bg-gray-300 dark:bg-neutral-600" />
        <button 
          onClick={redo}
          disabled={history.future.length === 0}
          className="p-2 rounded-xl corner-squircle hover:bg-gray-200 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
          title="重做 (Ctrl+Y / Ctrl+Shift+Z)"
        >
          <Redo2 className="w-4 h-4 text-gray-700 dark:text-neutral-300" />
        </button>
      </div>

      {/* Toast: Prompt to enter Overview Mode */}
      <AnimatePresence>
        {showOverviewPromptToast && !isOverviewMode && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.94 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] pointer-events-none select-none"
          >
            <div className="relative overflow-hidden flex items-center justify-center px-5 py-2 rounded-full bg-white/95 dark:bg-[#252528]/95 backdrop-blur-md border border-neutral-200/90 dark:border-neutral-700/80 shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.35)] text-xs md:text-sm font-medium text-neutral-800 dark:text-neutral-100 min-w-[200px]">
              {/* Full-bleed background progress bar from left to right */}
              <div 
                className="absolute inset-y-0 left-0 bg-blue-500/20 dark:bg-blue-400/25 border-r border-blue-500/50 dark:border-blue-400/50 transition-[width] duration-150 ease-out pointer-events-none"
                style={{ width: `${Math.min(100, Math.max(0, overviewPromptProgress * 100))}%` }}
              />
              <span className="relative z-10 tracking-wide font-medium">继续缩小进入全景视图</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Reference Picker Control Bar & Tray (Positioned below the top toast area) */}
      <AnimatePresence>
        {pickerSession && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className={`fixed ${showOverviewPromptToast && !isOverviewMode ? 'top-20' : 'top-5'} left-1/2 -translate-x-1/2 z-[110] flex flex-col items-center gap-2 w-max max-w-[98vw] select-none pointer-events-auto`}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {/* 1. Control Bar (Main HUD Toast) */}
            <div className="flex items-center gap-4 px-4 py-2.5 rounded-2xl bg-neutral-900/95 dark:bg-[#1a1a1d]/95 backdrop-blur-md border border-neutral-700/80 shadow-[0_16px_40px_rgba(0,0,0,0.35)] text-xs text-neutral-100">
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
                </span>
                <span className="font-semibold tracking-wide text-xs">画布拾取模式</span>
                <span className="text-neutral-500">|</span>
                <span className="text-neutral-300">点击画布上的任意图片卡片添加/取消</span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pl-3 border-l border-neutral-700">
                <button
                  type="button"
                  onClick={handleCancelPickerSession}
                  className="px-3 py-1.5 rounded-xl text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors font-medium text-xs flex items-center gap-1"
                >
                  <span>取消</span>
                  <span className="text-[10px] opacity-60 bg-neutral-800 px-1 py-0.5 rounded">Esc</span>
                </button>

                <button
                  type="button"
                  onClick={handleConfirmPickerSession}
                  disabled={pickerSession.selectedCardIds.length === 0}
                  className={`px-3.5 py-1.5 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition-all shadow-sm ${
                    pickerSession.selectedCardIds.length > 0
                      ? 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer active:scale-95 shadow-[0_0_16px_rgba(37,99,235,0.4)]'
                      : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                  }`}
                >
                  <span>确认导入</span>
                  {pickerSession.selectedCardIds.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-white/25 text-white text-[10px]">
                      {pickerSession.selectedCardIds.length}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* 2. Independent Reference Image Preview Tray (Positioned below Toast, Aspect-Ratio Display) */}
            {pickerSession.selectedCardIds.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="p-2 px-3 rounded-2xl bg-neutral-950/90 backdrop-blur-md border border-neutral-800 shadow-[0_16px_36px_rgba(0,0,0,0.4)] w-fit max-w-[98vw] max-h-[34vh] overflow-y-auto scrollbar-thin"
              >
                <div className="flex flex-wrap items-start justify-center gap-x-4 gap-y-2">
                  {pickerSession.selectedCardIds.map((cid, idx) => {
                    const c = cards.find(item => item.id === cid);
                    const img = c?.imageUrl || c?.originalImageUrl || c?.thumbnailUrl;
                    const cardName = c?.fileName 
                      ? c.fileName.replace(/\.[^/.]+$/, "") 
                      : (c?.title?.trim() || c?.roleName?.trim() || (c?.prompt?.trim() ? (c.prompt.length > 14 ? c.prompt.slice(0, 14) + '…' : c.prompt) : `资产 #${idx + 1}`));
                    return (
                      <div 
                        key={cid} 
                        className="flex flex-col items-center gap-1 group flex-shrink-0 cursor-pointer"
                        onClick={() => handleTogglePickerCard(cid)}
                        title={`${cardName} (点击移除)`}
                      >
                        <div className="relative h-16 rounded-xl overflow-hidden border-2 border-blue-500 shadow-md bg-neutral-900 transition-all group-hover:scale-[1.03] group-hover:border-red-500">
                          {img ? (
                            <img 
                              src={img} 
                              alt={cardName} 
                              className="h-full w-auto max-w-[110px] object-contain block" 
                            />
                          ) : (
                            <div className="h-full w-16 bg-neutral-800 flex items-center justify-center text-xs font-bold text-neutral-300">
                              #{idx + 1}
                            </div>
                          )}
                          
                          {/* Index badge */}
                          <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-blue-600/90 text-[10px] text-white font-bold leading-none backdrop-blur-xs shadow-xs">
                            {idx + 1}
                          </div>

                          {/* Hover remove overlay */}
                          <div className="absolute inset-0 bg-red-600/80 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity text-white">
                            <span className="text-sm font-bold leading-none">✕</span>
                            <span className="text-[9px] font-medium mt-1">移除</span>
                          </div>
                        </div>

                        {/* Name text below asset */}
                        <span className="text-[11px] text-neutral-300 max-w-[100px] truncate text-center font-medium leading-tight group-hover:text-red-400 transition-colors">
                          {cardName}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Real-time FPS Counter */}
      <FpsCounter hasActiveTask={!!agentTask} />

    </div>
  );
}
