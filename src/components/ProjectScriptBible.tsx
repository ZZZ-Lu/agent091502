import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import * as Diff from 'diff';
import { motion, AnimatePresence } from 'motion/react';
import { CODE_PIPELINE_PROMPTS } from '../constants/prompts';
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  BookText,
  Users,
  MapPin,
  Box,
  Palette,
  Copy,
  Sparkles,
  Wand2,
  FileText,
  ListOrdered,
  List,
  Bookmark,
  Hash,
  RefreshCw,
  Cpu,
  Search,
  Replace
} from 'lucide-react';

// Git-like Content-Addressed Storage Utils
const hashString = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = Math.imul(31, hash) + str.charCodeAt(i) | 0;
  }
  return hash.toString(36);
};

const getSceneStore = () => {
  try {
    return JSON.parse(localStorage.getItem('script_scene_store') || '{}');
  } catch {
    return {};
  }
};

const saveSceneStore = (store: any) => {
  try {
    localStorage.setItem('script_scene_store', JSON.stringify(store));
  } catch {}
};

const extractBlocks = (text: string, tocItems: any[]) => {
  const blocks: { title: string, hash: string }[] = [];
  const store = getSceneStore();
  let updatedStore = false;

  const addBlock = (title: string, content: string) => {
    const hash = hashString(content);
    blocks.push({ title, hash });
    if (!store[hash]) {
      store[hash] = content;
      updatedStore = true;
    }
  };

  if (tocItems.length === 0) {
    addBlock('全局', text);
  } else {
    if (tocItems[0].charIndex > 0) {
      addBlock('前言', text.substring(0, tocItems[0].charIndex));
    }
    for (let i = 0; i < tocItems.length; i++) {
      const start = tocItems[i].charIndex;
      const end = i + 1 < tocItems.length ? tocItems[i + 1].charIndex : text.length;
      addBlock(tocItems[i].title, text.substring(start, end));
    }
  }

  if (updatedStore) saveSceneStore(store);
  return blocks;
};

const reconstructText = (blocks: { title: string, hash: string }[]) => {
  const store = getSceneStore();
  return blocks.map(b => store[b.hash] || '').join('');
};

import { ScriptProject } from '../types/script';
import { assetExtractionService } from '../services/assetExtractionService';
import { ScriptView } from '../agent/scriptTools';

type TocItemType = 'episode' | 'scene' | 'chapter' | 'heading' | 'segment';

interface ProjectScriptBibleProps {
  currentProject: ScriptProject;
  projects: ScriptProject[];
  onSelectProject: (projectId: string) => void;
  onCreateProject: (name: string) => void;
  onRenameProject: (projectId: string, newName: string) => void;
  onDeleteProject: (projectId: string) => void;
  onUpdateProject: (updated: Partial<ScriptProject>) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
  onClose: () => void;
  isTocOpen: boolean;
  onTocOpenChange: (isOpen: boolean) => void;
  tocScrollRequest: { id: number; delta: number } | null;
  onTocAtBottomChange: (isAtBottom: boolean) => void;
  requestedView: ScriptView;
  onViewChange: (view: ScriptView) => void;
  requestedTocItemId?: string | null;
  onTocItemOpened: (item: { id: string; title: string; lineNumber: number; type: TocItemType }) => void;
  onSelectionChange: (selection: { text: string; start: number; end: number; lineStart: number; lineEnd: number } | null) => void;
  onRequestGenerateAsset?: (assetName: string, prompt: string) => void;
}

type TabType = 'script' | 'assets' | 'universe';
type AssetFilterType = 'all' | 'characters' | 'locations' | 'props';

export function ProjectScriptBible({
  currentProject,
  projects,
  onSelectProject,
  onCreateProject,
  onRenameProject,
  onDeleteProject,
  onUpdateProject,
  isOpen,
  onToggleOpen,
  onClose,
  isTocOpen,
  onTocOpenChange,
  tocScrollRequest,
  onTocAtBottomChange,
  requestedView,
  onViewChange,
  requestedTocItemId,
  onTocItemOpened,
  onSelectionChange,
  onRequestGenerateAsset
}: ProjectScriptBibleProps) {
  // Navigation & filtering states inside drawer
  const [activeTab, setActiveTab] = useState<TabType>('script');
  const changeActiveTab = useCallback((tab: TabType) => {
    setActiveTab(tab);
    onViewChange(tab);
  }, [onViewChange]);
  const [assetFilter, setAssetFilter] = useState<AssetFilterType>('all');
  const [scriptDraft, setScriptDraft] = useState(currentProject?.scriptText || '');
  const [currentSceneIndicator, setCurrentSceneIndicator] = useState('全局');
  const [versionStatus, setVersionStatus] = useState('已同步');
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastAssessedTextRef = useRef(currentProject?.scriptText || '');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isAnimationSettled, setIsAnimationSettled] = useState(false);
  const [isPositionReady, setIsPositionReady] = useState(false);
  const [isExtractingAssets, setIsExtractingAssets] = useState(false);
  const [extractionFeedback, setExtractionFeedback] = useState<string | null>(null);

  const handleExtractAssets = async () => {
    if (!currentProject || !scriptDraft.trim()) {
      setExtractionFeedback('剧本正文为空，无法提取资产。');
      setTimeout(() => setExtractionFeedback(null), 3000);
      return;
    }
    
    setIsExtractingAssets(true);
    setExtractionFeedback('正在深入分析剧本全文，提取实体资产...');
    
    try {
      const apiKey = localStorage.getItem('deepseek_api_key') || '';
      const { project: updatedProject } = await assetExtractionService.extractAssetsFromScript(
        currentProject.id,
        scriptDraft,
        apiKey
      );
      
      onUpdateProject(updatedProject);
      setExtractionFeedback(`提取完成！共提取 ${updatedProject.characters?.length || 0} 个角色，${updatedProject.locations?.length || 0} 个场景，${updatedProject.props?.length || 0} 个核心道具。`);
    } catch (error: any) {
      console.error('Extraction error:', error);
      setExtractionFeedback(`提取失败: ${error.message}`);
    } finally {
      setIsExtractingAssets(false);
      setTimeout(() => setExtractionFeedback(null), 5000);
    }
  };


  // Position memory for each project's script reading location
  const [scrollPositions, setScrollPositions] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('script_scroll_positions');
      if (!saved) return {};
      const parsed = JSON.parse(saved);
      const cleaned: Record<string, number> = {};
      for (const k in parsed) {
        cleaned[k] = typeof parsed[k] === 'number' ? parsed[k] : (parsed[k]?.top || 0);
      }
      return cleaned;
    } catch {
      return {};
    }
  });
  const scrollPositionsRef = useRef<Record<string, number>>({});
  scrollPositionsRef.current = scrollPositions;
  const isRestoringScrollRef = useRef(false);
  const inferenceAttemptedRef = useRef<Set<string>>(new Set());
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Project selector dropdown inside card
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState('');
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Table of Contents (TOC) Dropdown state & parsing
  const [inferredPatterns, setInferredPatterns] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`script_toc_patterns_${currentProject.id}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isInferringToc, setIsInferringToc] = useState(false);
  const tocButtonRef = useRef<HTMLButtonElement>(null);
  const tocCardRef = useRef<HTMLDivElement>(null);
  const cardContainerRef = useRef<HTMLDivElement>(null);
  const tocListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (requestedView === 'directory') {
      setActiveTab('script');
      onTocOpenChange(true);
      return;
    }
    setActiveTab(requestedView);
  }, [requestedView, onTocOpenChange]);

  // TOC scroll position memory
  const tocScrollPositionsRef = useRef<Record<string, number>>({});

  // Restore TOC list scroll position when TOC opens or project changes
  useEffect(() => {
    if (isTocOpen) {
      let saved = tocScrollPositionsRef.current[currentProject.id];
      if (saved === undefined) {
        try {
          const stored = localStorage.getItem(`script_toc_list_scroll_${currentProject.id}`);
          if (stored) {
            saved = parseFloat(stored) || 0;
            tocScrollPositionsRef.current[currentProject.id] = saved;
          }
        } catch {}
      }
      if (saved && saved > 0) {
        requestAnimationFrame(() => {
          if (tocListRef.current) {
            tocListRef.current.scrollTop = saved!;
          }
        });
      }
    }
  }, [isTocOpen, currentProject.id]);

  const handleTocListScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const top = e.currentTarget.scrollTop;
    tocScrollPositionsRef.current[currentProject.id] = top;
    try {
      localStorage.setItem(`script_toc_list_scroll_${currentProject.id}`, String(top));
    } catch {}
    onTocAtBottomChange(top + e.currentTarget.clientHeight >= e.currentTarget.scrollHeight - 2);
  };

  useEffect(() => {
    if (!isTocOpen || !tocListRef.current) return;
    const list = tocListRef.current;
    onTocAtBottomChange(list.scrollTop + list.clientHeight >= list.scrollHeight - 2);
  }, [isTocOpen, onTocAtBottomChange]);

  interface TocItem {
    id: string;
    title: string;
    subTitle?: string;
    lineNumber: number;
    charIndex: number;
    type: TocItemType;
  }

  // Automatically infer TOC patterns in background when script content exists and no patterns stored yet
  useEffect(() => {
    if (!scriptDraft || scriptDraft.trim().length < 20) return;

    // Do not infer if we already have patterns loaded in state (either from localStorage or from a previous fallback in this session)
    if (inferredPatterns.length > 0) return;
    
    // Check localStorage just to be safe
    const saved = localStorage.getItem(`script_toc_patterns_${currentProject.id}`);
    if (saved && saved !== '[]') return;

    if (inferenceAttemptedRef.current.has(currentProject.id)) return;

    let isMounted = true;
    const autoInfer = async () => {
      setIsInferringToc(true);
      inferenceAttemptedRef.current.add(currentProject.id);
      try {
        const sampleText = scriptDraft.slice(0, 4000);
        // Retrieve API credentials from settings
        const agentModel = localStorage.getItem('agentModel') || 'deepseek-v4-flash';
        const activeModel = localStorage.getItem('script_toc_infer_model') || agentModel;
        
        const deepseekKey = localStorage.getItem('deepseek_api_key') || '';
        const qwenKey = localStorage.getItem('qwen_api_key') || '';
        const glmKey = localStorage.getItem('glm_api_key') || '';
        
        let apiKey = deepseekKey;
        if (activeModel.includes('qwen') || activeModel.includes('dashscope')) {
          apiKey = qwenKey;
        } else if (activeModel.includes('glm')) {
          apiKey = glmKey;
        }

        // Retrieve prompt directly from the codebase constants (which are written back by the save endpoint)
        const systemPrompt = CODE_PIPELINE_PROMPTS.tocInferSystemPrompt;

        const res = await fetch('/api/script-toc-pattern', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            sampleText,
            systemPrompt,
            modelType: activeModel,
            apiKey: apiKey,
            deepseekKey: deepseekKey 
          })
        });
        if (!res.ok) throw new Error("Automatic inference failed");
        const data = await res.json();
        if (!isMounted) return;

        // Save raw inference to local storage for Settings debugging
        try {
          localStorage.setItem('last_toc_infer_result', JSON.stringify(data, null, 2));
        } catch (e) {}

        let patterns: string[] = [];
        if (data.tocPattern) patterns.push(data.tocPattern);
        if (data.scenePattern) patterns.push(data.scenePattern);

        if (patterns.length > 0) {
          setInferredPatterns(patterns);
          localStorage.setItem(`script_toc_patterns_${currentProject.id}`, JSON.stringify(patterns));
        }

        // Auto-slice scenes if scenePattern exists
        if (data.scenePattern) {
          import('../utils/slicer').then(({ sliceScriptIntoScenes }) => {
            if (!isMounted) return;
            const newScenes = sliceScriptIntoScenes(scriptDraft, data.scenePattern, data.flags || 'gim');
            // Update global project state so Data Viewer panel can read it
            onUpdateProject({ scenes: newScenes });
          }).catch(console.error);
        }

      } catch {
        if (!isMounted) return;
        const fallbackPatterns = [
          "^【\\s*第?\\s*[0-9一二三四五六七八九十百千]+\\s*[集话回][^】]*】.*",
          "^第\\s*[0-9一二三四五六七八九十百千]+\\s*[集话回].*",
          "^【\\s*(?:场|场景|场次)?\\s*[0-9一二三四五六七八九十百千]+[^】]*】.*",
          "^第\\s*[0-9一二三四五六七八九十百千]+\\s*[场幕].*",
          "^(?:EPISODE|EP|CHAPTER|SCENE)\\s*#?\\s*\\d+.*"
        ];
        setInferredPatterns(fallbackPatterns);
      } finally {
        if (isMounted) setIsInferringToc(false);
      }
    };

    const timer = setTimeout(() => {
      autoInfer();
    }, 1500);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [currentProject.id, scriptDraft, inferredPatterns.length]);

  const tocItems = useMemo<TocItem[]>(() => {
    if (!scriptDraft || !scriptDraft.trim()) return [];
    const lines = scriptDraft.split('\n');
    const items: TocItem[] = [];
    let charAccumulator = 0;

    // Only use patterns explicitly set in state (AI inferred or the injected explicit fallback)
    const activeRegexes: RegExp[] = [];
    inferredPatterns.forEach(patternStr => {
      try {
        activeRegexes.push(new RegExp(patternStr, 'i'));
      } catch (e) {
        console.warn("Invalid regex pattern from AI:", patternStr);
      }
    });

    // If no patterns are active yet (inferring), don't show TOC
    if (activeRegexes.length === 0) return [];

    lines.forEach((rawLine, index) => {
      const trimmed = rawLine.trim();
      if (!trimmed) {
        charAccumulator += rawLine.length + 1;
        return;
      }

      let isMatch = activeRegexes.some(rx => rx.test(trimmed));

      if (isMatch) {
        let title = trimmed;
        const bracketMatch = trimmed.match(/^【(.+?)】(?:\s*(.*))?$/);
        let subTitle: string | undefined;
        if (bracketMatch) {
          title = bracketMatch[1];
          if (bracketMatch[2]) subTitle = bracketMatch[2];
        } else if (trimmed.startsWith('#')) {
          title = trimmed.replace(/^#+\s*/, '');
        }

        let type: TocItem['type'] = 'episode';
        if (/集|EPISODE|EP\b/i.test(trimmed)) type = 'episode';
        else if (/场|SCENE|EXT\.|INT\./i.test(trimmed)) type = 'scene';
        else if (/幕|章|回|CHAPTER|ACT/i.test(trimmed)) type = 'chapter';
        else if (/^#+\s/.test(rawLine)) type = 'heading';

        items.push({
          id: `toc-${index}-${charAccumulator}`,
          title,
          subTitle,
          lineNumber: index + 1,
          charIndex: charAccumulator,
          type,
        });
      }
      charAccumulator += rawLine.length + 1; // +1 for \n
    });

    // Fallback: If no explicit headings, generate section anchors every ~30 lines
    if (items.length === 0 && lines.length > 3) {
      const step = Math.max(20, Math.floor(lines.length / 6));
      let acc = 0;
      lines.forEach((line, idx) => {
        if (idx % step === 0 || idx === 0) {
          const preview = line.trim() || `第 ${idx + 1} 行`;
          items.push({
            id: `seg-${idx}`,
            title: preview.length > 24 ? preview.slice(0, 24) + '...' : preview,
            subTitle: `第 ${idx + 1} 行`,
            lineNumber: idx + 1,
            charIndex: acc,
            type: 'segment',
          });
        }
        acc += line.length + 1;
      });
    }

    return items;
  }, [scriptDraft, inferredPatterns]);

  // Pixel-exact vertical offset calculator for textarea caret position (accounting for dynamic line wrapping)
  const getTextareaCharTop = (textarea: HTMLTextAreaElement, charIndex: number): number => {
    try {
      const style = window.getComputedStyle(textarea);
      const mirror = document.createElement('div');

      const properties = [
        'boxSizing',
        'paddingTop',
        'paddingRight',
        'paddingBottom',
        'paddingLeft',
        'borderTopWidth',
        'borderRightWidth',
        'borderBottomWidth',
        'borderLeftWidth',
        'fontFamily',
        'fontSize',
        'fontWeight',
        'fontStyle',
        'letterSpacing',
        'lineHeight',
        'textTransform',
        'wordSpacing',
        'wordBreak',
        'wordWrap',
        'whiteSpace',
        'tabSize',
      ];

      mirror.style.position = 'absolute';
      mirror.style.top = '-99999px';
      mirror.style.left = '-99999px';
      mirror.style.visibility = 'hidden';
      mirror.style.overflow = 'hidden';
      mirror.style.whiteSpace = 'pre-wrap';
      mirror.style.wordBreak = 'break-word';

      properties.forEach(prop => {
        const val = (style as any)[prop];
        if (val !== undefined && typeof val === 'string') {
          (mirror.style as any)[prop] = val;
        }
      });

      // Use textarea clientWidth (excludes scrollbar width) to replicate word wrapping exactly
      mirror.style.width = `${textarea.clientWidth}px`;

      const textBefore = textarea.value.slice(0, charIndex);
      mirror.textContent = textBefore;

      const marker = document.createElement('span');
      marker.textContent = textarea.value.slice(charIndex, charIndex + 1) || ' ';
      mirror.appendChild(marker);

      document.body.appendChild(mirror);
      const targetTop = marker.offsetTop;
      document.body.removeChild(mirror);

      return targetTop;
    } catch {
      const computedLineHeight = parseFloat(window.getComputedStyle(textarea).lineHeight) || 28;
      const linesBefore = textarea.value.slice(0, charIndex).split('\n').length;
      return Math.max(0, (linesBefore - 1) * computedLineHeight);
    }
  };

  const handleJumpToToc = (item: TocItem) => {
    onTocOpenChange(false);
    if (activeTab !== 'script') {
      changeActiveTab('script');
    }

    const performJump = () => {
      const node = textareaRef.current;
      if (!node) return;

      // 1. Calculate pixel-perfect vertical scroll offset using DOM text measurement
      const exactTop = getTextareaCharTop(node, item.charIndex);
      const targetScroll = Math.max(0, exactTop - 20);

      // Lock scroll state listener temporarily to avoid state thrashing during programmatic jump
      isRestoringScrollRef.current = true;

      // 2. Focus and select text using preventScroll: true so browser doesn't reset scroll position
      try {
        node.focus({ preventScroll: true });
        node.setSelectionRange(item.charIndex, item.charIndex + item.title.length);
      } catch {}

      // 3. Perform smooth scrolling to exact target
      node.scrollTo({ top: targetScroll, behavior: 'smooth' });

      // 4. Update stored scroll positions
      setScrollPositions(prev => {
        const next = { ...prev, [currentProject.id]: targetScroll };
        scrollPositionsRef.current = next;
        try {
          localStorage.setItem('script_scroll_positions', JSON.stringify(next));
        } catch {}
        return next;
      });

      // 5. Reinforce position after transition and unlock listener
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.scrollTop = targetScroll;
        }
        isRestoringScrollRef.current = false;
      }, 250);
    };

    if (activeTab === 'script' && textareaRef.current) {
      requestAnimationFrame(() => {
        performJump();
      });
    } else {
      setTimeout(() => {
        requestAnimationFrame(() => {
          performJump();
        });
      }, 240);
    }
    onTocItemOpened({ id: item.id, title: item.title, lineNumber: item.lineNumber, type: item.type });
  };

  useEffect(() => {
    if (!requestedTocItemId) return;
    const item = tocItems.find(candidate => candidate.id === requestedTocItemId);
    if (item) handleJumpToToc(item);
  }, [requestedTocItemId, tocItems]);

  // Click outside or Escape to close TOC list card
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (tocCardRef.current?.contains(target) || tocButtonRef.current?.contains(target)) {
        return;
      }
      onTocOpenChange(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onTocOpenChange(false);
      }
    };
    if (isTocOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isTocOpen, onTocOpenChange]);

  // Search and batch replace state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isVersionOpen, setIsVersionOpen] = useState(false);
  const [versions, setVersions] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem(`script_versions_${currentProject?.id}`) || "[]"); } catch { return []; }
  });
  const [searchText, setSearchText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [isCaseSensitive, setIsCaseSensitive] = useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [replaceFeedback, setReplaceFeedback] = useState<string | null>(null);
  const [previewVersionId, setPreviewVersionId] = useState<string | null>(null);



  const getPreviewText = () => {
    if (!previewVersionId) return scriptDraft;
    const activeVersion = versions.find(v => v.id === previewVersionId);
    if (!activeVersion) return scriptDraft;

    let targetText = activeVersion.scriptText;
    if (activeVersion.scale === 'scene_edit' && activeVersion.affectedScenes && activeVersion.affectedScenes[activeVersion.scene] && activeVersion.scene !== '全局' && tocItems.length > 0) {
        let rebuiltText = '';
        for (let i = 0; i < tocItems.length; i++) {
            if (tocItems[i].title === activeVersion.scene) {
                const start = tocItems[i].charIndex;
                const end = i < tocItems.length - 1 ? tocItems[i+1].charIndex : scriptDraft.length;
                rebuiltText = scriptDraft.slice(0, start) + activeVersion.affectedScenes[activeVersion.scene] + scriptDraft.slice(end);
                break;
            }
        }
        if (rebuiltText) targetText = rebuiltText;
    }
    return targetText;
  };
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Compute all match ranges in scriptDraft
  const searchMatches = useMemo(() => {
    if (!searchText) return [];
    const matches: { start: number; end: number }[] = [];
    const source = isCaseSensitive ? scriptDraft : scriptDraft.toLowerCase();
    const target = isCaseSensitive ? searchText : searchText.toLowerCase();
    let index = 0;
    while ((index = source.indexOf(target, index)) !== -1) {
      matches.push({ start: index, end: index + target.length });
      index += Math.max(1, target.length);
    }
    return matches;
  }, [scriptDraft, searchText, isCaseSensitive]);

  const safeMatchIndex = searchMatches.length > 0
    ? ((currentMatchIndex % searchMatches.length) + searchMatches.length) % searchMatches.length
    : 0;

  const jumpToMatch = useCallback((index: number) => {
    if (searchMatches.length === 0) return;
    const match = searchMatches[index];
    if (!match) return;
    const node = textareaRef.current;
    if (!node) return;

    const exactTop = getTextareaCharTop(node, match.start);
    const targetScroll = Math.max(0, exactTop - 50);
    isRestoringScrollRef.current = true;
    try {
      node.focus({ preventScroll: true });
      node.setSelectionRange(match.start, match.end);
      const selText = scriptDraft.slice(match.start, match.end);
      const linesBefore = scriptDraft.slice(0, match.start).split('\n');
      const linesSelected = selText.split('\n');
      const lineStart = linesBefore.length;
      const lineEnd = lineStart + linesSelected.length - 1;
      onSelectionChange({ text: selText, start: match.start, end: match.end, lineStart, lineEnd });
    } catch {}
    node.scrollTo({ top: targetScroll, behavior: 'smooth' });
    setTimeout(() => {
      isRestoringScrollRef.current = false;
    }, 150);
  }, [searchMatches, getTextareaCharTop, scriptDraft, onSelectionChange]);

  const handleNextMatch = useCallback(() => {
    if (searchMatches.length === 0) return;
    const next = (safeMatchIndex + 1) % searchMatches.length;
    setCurrentMatchIndex(next);
    jumpToMatch(next);
  }, [safeMatchIndex, searchMatches.length, jumpToMatch]);

  const handlePrevMatch = useCallback(() => {
    if (searchMatches.length === 0) return;
    const prev = (safeMatchIndex - 1 + searchMatches.length) % searchMatches.length;
    setCurrentMatchIndex(prev);
    jumpToMatch(prev);
  }, [safeMatchIndex, searchMatches.length, jumpToMatch]);

  // When search keyword changes, jump to first match
  useEffect(() => {
    if (isSearchOpen && searchText && searchMatches.length > 0) {
      jumpToMatch(0);
      setCurrentMatchIndex(0);
    }
  }, [searchText, isCaseSensitive]);

  // Auto focus search input when opened
  useEffect(() => {
    if (isSearchOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }, 80);
    }
  }, [isSearchOpen]);

  // Keyboard shortcut Ctrl+F / Cmd+F inside script panel
  useEffect(() => {
    if (!isOpen || activeTab !== 'script') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setIsSearchOpen(true);
        setTimeout(() => {
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        }, 50);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeTab]);

  // Single replace
  const handleReplaceCurrent = useCallback(() => {
    if (searchMatches.length === 0) return;
    const match = searchMatches[safeMatchIndex];
    if (!match) return;
    const newScript = scriptDraft.slice(0, match.start) + replaceText + scriptDraft.slice(match.end);
    setScriptDraft(newScript);
    onUpdateProject({ scriptText: newScript });
    onSelectionChange(null);
    setReplaceFeedback('已替换 1 处');
    setTimeout(() => setReplaceFeedback(null), 2000);
  }, [searchMatches, safeMatchIndex, scriptDraft, replaceText, onUpdateProject, onSelectionChange]);

  // Batch replace all matches
  const handleReplaceAll = useCallback(() => {
    if (!searchText || searchMatches.length === 0) return;
    const count = searchMatches.length;
    let newScript = '';
    if (isCaseSensitive) {
      newScript = scriptDraft.replaceAll(searchText, replaceText);
    } else {
      const escaped = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'gi');
      newScript = scriptDraft.replace(regex, replaceText);
    }
    setScriptDraft(newScript);
    onUpdateProject({ scriptText: newScript });
    onSelectionChange(null);
    setReplaceFeedback(`已批量替换 ${count} 处文本`);
    setTimeout(() => setReplaceFeedback(null), 2500);
  }, [searchText, searchMatches.length, isCaseSensitive, scriptDraft, replaceText, onUpdateProject, onSelectionChange]);

  // Sync script draft when currentProject changes
  useEffect(() => {
    setScriptDraft(currentProject?.scriptText || '');
    try {
      const saved = localStorage.getItem(`script_toc_patterns_${currentProject.id}`);
      setInferredPatterns(saved ? JSON.parse(saved) : []);
    } catch {
      setInferredPatterns([]);
    }
  }, [currentProject]);

  // Separate Card animation from textarea rendering
  useEffect(() => {
    if (isOpen) {
      setIsAnimationSettled(false);
      setIsPositionReady(false);
      // Wait exactly for card scale/opacity animation (200ms) to settle completely
      const timer = setTimeout(() => {
        setIsAnimationSettled(true);
      }, 210);
      return () => clearTimeout(timer);
    } else {
      setIsAnimationSettled(false);
      setIsPositionReady(false);
    }
  }, [isOpen]);

  // Synchronously restore scroll position upon textarea mount before making text visible
  const handleTextareaRef = useCallback((node: HTMLTextAreaElement | null) => {
    textareaRef.current = node;
    if (node) {
      const targetScroll = scrollPositionsRef.current[currentProject.id] || 0;
      isRestoringScrollRef.current = true;
      node.scrollTop = targetScroll;
      // Double check in next frame and reveal text only after position is locked
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.scrollTop = targetScroll;
        }
        // Give browser 1 frame to render the scroll position at opacity-0, then smoothly fade in
        requestAnimationFrame(() => {
          setIsPositionReady(true);
        });
        setTimeout(() => {
          isRestoringScrollRef.current = false;
        }, 100);
      });
    } else {
      setIsPositionReady(false);
    }
  }, [currentProject.id]);

  const handleScriptScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (isRestoringScrollRef.current || !isPositionReady) return;
    const top = e.currentTarget.scrollTop;
    setScrollPositions(prev => {
      const next = { ...prev, [currentProject.id]: top };
      scrollPositionsRef.current = next;
      try {
        localStorage.setItem('script_scroll_positions', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Click outside to close project dropdown menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsProjectDropdownOpen(false);
        setEditingProjectId(null);
        setDeletingProjectId(null);
        setIsCreatingNew(false);
      }
    };
    if (isProjectDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isProjectDropdownOpen]);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newProjectName.trim()) {
      onCreateProject(newProjectName.trim());
      setNewProjectName('');
      setIsCreatingNew(false);
    }
  };

  const totalAssets =
    (currentProject.characters?.length || 0) +
    (currentProject.locations?.length || 0) +
    (currentProject.props?.length || 0);

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  
  const triggerAssessChange = async (val: string, scene: string, offset: number) => {
    try {
      const oldText = lastAssessedTextRef.current;
      if (val === oldText) return;
      
      setVersionStatus('分析意图中...');
      const char_delta = val.length - oldText.length;
      
      let action = 'type';
      if (Math.abs(char_delta) > 50) action = 'paste_or_delete';
      
      const Diff = await import('diff');
      const diffs = Diff.diffChars(oldText, val);
      
      let diffStartOld = oldText.length;
      let diffEndOld = 0;
      let diffStartNew = val.length;
      let diffEndNew = 0;
      
      let oldIndex = 0;
      let newIndex = 0;
      
      for (const part of diffs) {
          if (part.added || part.removed) {
              diffStartOld = Math.min(diffStartOld, oldIndex);
              diffStartNew = Math.min(diffStartNew, newIndex);
              
              diffEndOld = Math.max(diffEndOld, oldIndex + (part.removed ? part.value.length : 0));
              diffEndNew = Math.max(diffEndNew, newIndex + (part.added ? part.value.length : 0));
          }
          
          if (!part.added) {
              oldIndex += part.value.length;
          }
          if (!part.removed) {
              newIndex += part.value.length;
          }
      }
      
      const padding = 150;
      const extractStart = Math.max(0, Math.min(diffStartOld, diffStartNew) - padding);
      const extractEndOld = Math.min(oldText.length, diffEndOld + padding);
      const extractEndNew = Math.min(val.length, diffEndNew + padding);

      const before_snippet = oldText.slice(extractStart, extractEndOld);
      const after_snippet = val.slice(extractStart, extractEndNew);

      const requestBody = {
        action,
        affected_scene_orders: [scene],
        char_delta,
        before_snippet,
        after_snippet
      };
      
      const startedAt = Date.now();
      const res = await fetch('/api/script/assess-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      if (res.ok) {
        const data = await res.json();
        const duration = Date.now() - startedAt;
        
        // Log to Node Debugger
        try {
          const timestamp = new Date().toLocaleTimeString();
          const logLine = `[${timestamp}] 运行完成 (${duration}ms) => ${JSON.stringify(data)}`;
          let existingLogs = [];
          try { existingLogs = JSON.parse(localStorage.getItem('change_assess_logs') || '[]'); } catch {}
          existingLogs.unshift(logLine);
          if (existingLogs.length > 50) existingLogs = existingLogs.slice(0, 50);
          localStorage.setItem('change_assess_logs', JSON.stringify(existingLogs));
          
          // Save result data
          localStorage.setItem('last_change_assess_result', JSON.stringify(data, null, 2));
          // Save raw input data so it shows up exactly in SettingsPage
          localStorage.setItem('last_change_assess_raw_input', JSON.stringify(requestBody, null, 2));
          
          // We also need to save the formatted requestInput (system + user prompt)
          const systemPromptStr = '你是一个剧本版本意图判定助手。请仔细对比 before_snippet 和 after_snippet 评估修改级别(trivial/scene_edit/structural)。关键要求：summary 必须极其具体地说明改了什么内容。根据实际动作选择最贴切的句式，例如：删除操作用“删除了[某某剧情/词语]”；新增操作用“新增了[某某剧情/词语]”；替换操作用“将[原内容]改为[新内容]”。不要写“改台词”等模糊废话，也不要生硬套用替换句式。限制在15字以内。必须输出 JSON：{"scale":"trivial"|"scene_edit"|"structural", "summary":string}';
          const requestInputStr = `[SYSTEM]\n${systemPromptStr}\n\n[USER]\n${JSON.stringify(requestBody, null, 2)}`;
          localStorage.setItem('last_change_assess_request', requestInputStr);
        } catch (e) {}

        const statusText = data.scale === 'trivial' ? '已保存 (微调)' : (data.scale === 'scene_edit' ? `${scene}已暂存: ${data.summary}` : `里程碑更新: ${data.summary}`);
        setVersionStatus(statusText);
        setVersions(prev => {
             // Generate incremental snapshot
             let sceneText = val;
             let globalOrderSnapshot = ['全局'];
             // Find current scene boundaries if it's a scene edit
             if (data.scale === 'scene_edit' && tocItems && tocItems.length > 0) {
                 for (let i = 0; i < tocItems.length; i++) {
                     if (tocItems[i].title === scene) {
                         const start = tocItems[i].charIndex;
                         const end = i < tocItems.length - 1 ? tocItems[i+1].charIndex : val.length;
                         sceneText = val.slice(start, end);
                         break;
                     }
                 }
                 globalOrderSnapshot = tocItems.map(item => item.title);
             }

             const newVersions = [{
               id: Date.now().toString(),
               timestamp: Date.now(),
               summary: data.summary,
               scale: data.scale,
               scene: scene,
               affectedScenes: { [scene]: sceneText },
               globalOrderSnapshot: globalOrderSnapshot,
               scriptText: val // Keep fallback
             }, ...prev].slice(0, 50);
             try { localStorage.setItem(`script_versions_${currentProject.id}`, JSON.stringify(newVersions)); } catch {}
             return newVersions;
           });
      } else {
         setVersionStatus('已保存');
      }
      
      lastAssessedTextRef.current = val;
    } catch (e) {
      setVersionStatus('已保存 (离线)');
    }
  };

  const updateSceneIndicator = (val: string, cursorOffset: number) => {
    let currentScene = '全局';
    for (let i = tocItems.length - 1; i >= 0; i--) {
        if (cursorOffset >= tocItems[i].charIndex) {
            currentScene = tocItems[i].title;
            break;
        }
    }
    setCurrentSceneIndicator(currentScene);
    return currentScene;
  };

  useEffect(() => {
    if (!autoSaveEnabled && typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
    }
  }, [autoSaveEnabled]);

  const handleScriptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setScriptDraft(val);
    onUpdateProject({ scriptText: val });

    const cursorOffset = e.target.selectionStart;
    const scene = updateSceneIndicator(val, cursorOffset);
    setVersionStatus('有未保存改动');

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    if (autoSaveEnabled) {
        typingTimerRef.current = setTimeout(() => {
            triggerAssessChange(val, scene, cursorOffset);
        }, 3000);
    }
  };

  const handleSaveRename = (projectId: string) => {
    if (editingProjectName.trim()) {
      onRenameProject(projectId, editingProjectName.trim());
    }
    setEditingProjectId(null);
  };

  return (
    <>
      {/* Single Unified Capsule Entry (Top-Left Floating Trigger Group) */}
      <div 
        className="fixed top-4 left-4 z-40 flex items-center gap-1.5" 
        ref={dropdownRef}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          data-agent-target="script-bible-toggle"
          data-agent-actions="mouse.move mouse.click mouse.hover"
          onClick={onToggleOpen}
          aria-expanded={isOpen}
          className={`flex items-center gap-2 px-3.5 h-[36px] border rounded-2xl corner-squircle transition-all group ${
            isOpen
              ? 'bg-gray-200 dark:bg-neutral-700/80 border-gray-300 dark:border-white/15 shadow-sm'
              : 'bg-gray-100 dark:bg-neutral-800 border-gray-200/80 dark:border-[#404040] shadow-md hover:bg-gray-50 dark:hover:bg-neutral-700'
          }`}
          title={isOpen ? "收起剧本卡片" : "打开剧本与项目控制中心"}
        >
          <span className="text-sm font-bold text-gray-900 dark:text-neutral-100 max-w-[180px] truncate tracking-tight flex items-center">
            {currentProject.name}
          </span>

          <span className="px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 text-[11px] font-semibold tracking-tight whitespace-nowrap flex items-center justify-center translate-y-[1px]">
            剧本
          </span>
        </button>

        {/* Dropdown Button for Switching Projects placed to the right */}
        <button
          onClick={() => setIsProjectDropdownOpen((prev) => !prev)}
          className={`w-[36px] h-[36px] rounded-2xl corner-squircle bg-gray-100 dark:bg-neutral-800 border shadow-md flex items-center justify-center transition-all ${
            isProjectDropdownOpen
              ? 'border-blue-500/80 ring-2 ring-blue-500/20 text-blue-600 dark:text-blue-400'
              : 'border-gray-200/80 dark:border-[#404040] text-gray-600 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-700'
          }`}
          title="切换剧本项目"
        >
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${
              isProjectDropdownOpen ? 'rotate-180 text-blue-600 dark:text-blue-400' : ''
            }`}
          />
        </button>

        {/* Project Dropdown Menu */}
        <AnimatePresence>
          {isProjectDropdownOpen && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="absolute left-0 top-11 w-64 bg-gray-100 dark:bg-neutral-800 border border-gray-100 dark:border-[#404040] rounded-2xl corner-squircle shadow-2xl p-2 z-50 flex flex-col gap-1"
            >
              <div className="px-2.5 py-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center justify-between">
                <span>剧本项目列表</span>
                <span className="text-[10px] lowercase font-normal">{projects.length} 个项目</span>
              </div>

              <div className="max-h-56 overflow-y-auto space-y-0.5 pr-1">
                {projects.map((proj) => (
                  <div
                    key={proj.id}
                    onClick={() => {
                      if (editingProjectId !== proj.id && deletingProjectId !== proj.id) {
                        onSelectProject(proj.id);
                        setIsProjectDropdownOpen(false);
                      }
                    }}
                    className={`flex items-center justify-between px-2.5 py-2 rounded-xl corner-squircle text-xs cursor-pointer group transition-colors ${
                      proj.id === currentProject.id
                        ? 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-semibold'
                        : 'hover:bg-gray-200 dark:hover:bg-neutral-800 text-gray-700 dark:text-neutral-200'
                    }`}
                  >
                    {editingProjectId === proj.id ? (
                      <div
                        className="flex items-center gap-1.5 w-full"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="text"
                          value={editingProjectName}
                          onChange={(e) => setEditingProjectName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename(proj.id);
                            if (e.key === 'Escape') setEditingProjectId(null);
                          }}
                          autoFocus
                          className="flex-1 bg-gray-100 dark:bg-neutral-800 text-xs px-2 py-1 rounded-lg corner-squircle outline-none text-gray-900 dark:text-white border border-blue-500"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveRename(proj.id)}
                          className="p-1 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950 rounded-lg corner-squircle"
                          title="保存名称"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingProjectId(null)}
                          className="p-1 text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-700 rounded-lg corner-squircle"
                          title="取消"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : deletingProjectId === proj.id ? (
                      <div
                        className="flex items-center justify-between w-full gap-2 py-0.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="text-[11px] text-red-600 dark:text-red-400 font-medium">
                          确认删除「{proj.name}」？
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteProject(proj.id);
                              setDeletingProjectId(null);
                            }}
                            className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white text-[11px] font-medium rounded-md corner-squircle transition-colors"
                          >
                            删除
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingProjectId(null)}
                            className="px-1.5 py-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-[11px] rounded-md corner-squircle"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <span className="truncate pr-2">{proj.name}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          {proj.id === currentProject.id && <Check className="w-3.5 h-3.5 shrink-0 text-blue-600 dark:text-blue-400" />}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingProjectId(null);
                              setEditingProjectId(proj.id);
                              setEditingProjectName(proj.name);
                            }}
                            className="p-1 opacity-60 hover:opacity-100 text-gray-400 hover:text-blue-500 rounded-lg corner-squircle transition-opacity"
                            title="重命名项目"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (projects.length <= 1) return;
                              setEditingProjectId(null);
                              setDeletingProjectId(proj.id);
                            }}
                            disabled={projects.length <= 1}
                            className={`p-1 rounded-lg corner-squircle transition-all ${
                              projects.length <= 1
                                ? 'text-gray-300 dark:text-neutral-600 cursor-not-allowed opacity-30'
                                : 'opacity-60 hover:opacity-100 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950'
                            }`}
                            title={projects.length <= 1 ? "至少保留一个项目" : "删除项目"}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>

              {/* Create New Project Section */}
              <div className="pt-2 mt-1 border-t border-gray-100 dark:border-[#404040]">
                {!isCreatingNew ? (
                  <button
                    type="button"
                    onClick={() => setIsCreatingNew(true)}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950 rounded-xl corner-squircle transition-colors font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    新建项目
                  </button>
                ) : (
                  <form onSubmit={handleCreateSubmit} className="flex flex-col gap-1.5 p-1">
                    <input
                      type="text"
                      placeholder="输入新项目名称..."
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setIsCreatingNew(false);
                          setNewProjectName('');
                        }
                      }}
                      autoFocus
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg corner-squircle bg-gray-100 dark:bg-neutral-800 border border-blue-500 text-gray-900 dark:text-neutral-100 outline-none"
                    />
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setIsCreatingNew(false);
                          setNewProjectName('');
                        }}
                        className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-200 dark:hover:bg-neutral-800 rounded-lg corner-squircle transition-colors"
                      >
                        取消
                      </button>
                      <button
                        type="submit"
                        disabled={!newProjectName.trim()}
                        className="px-2.5 py-1 text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg corner-squircle font-medium transition-colors"
                      >
                        创建
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Script & Project Hub Floating System: 分离卡片布局 (上菜单卡片 + 下正文卡片) */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={cardContainerRef}
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            data-prevent-canvas-wheel="true"
            className="fixed top-[58px] bottom-6 left-4 w-[520px] max-w-[calc(100vw-32px)] z-50 flex flex-col select-none pointer-events-auto transform-gpu bg-[#f3f4f6] dark:bg-[#1C1C1E] border border-gray-200/50 dark:border-white/10 rounded-[24px] corner-squircle shadow-2xl overflow-hidden"
            onPointerDown={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
          >
            {/* 上卡片: 菜单与工具栏面板 */}
            <div
              className="shrink-0 relative z-0 border-b border-gray-200/70 dark:border-white/[0.04]"
              onPointerDown={(e) => e.stopPropagation()}
              onWheel={(e) => e.stopPropagation()}
            >
              {/* Direct Top Tabs Header */}
              <div className={`px-2.5 pt-2 ${activeTab === 'script' || activeTab === 'assets' ? 'pb-0' : 'pb-2'} flex items-center justify-between`}>
                <div className="flex items-center gap-1.5">
                  {/* Primary: 剧本正文 Button */}
                  <button
                    type="button"
                    data-agent-target="script.view.script"
                    data-agent-actions="mouse.move mouse.click mouse.hover"
                    onClick={() => changeActiveTab('script')}
                    aria-selected={activeTab === 'script'}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-all ${
                      activeTab === 'script'
                        ? 'bg-white dark:bg-neutral-800 text-blue-600 dark:text-blue-400 rounded-t-xl rounded-b-none corner-squircle -mb-px relative z-10'
                        : 'rounded-xl corner-squircle text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-neutral-200 hover:bg-white/60 dark:hover:bg-neutral-800/50'
                    }`}
                  >
                    <BookText className="w-3.5 h-3.5" />
                    剧本正文
                  </button>

                  <button
                    type="button"
                    data-agent-target="script.view.assets"
                    data-agent-actions="mouse.move mouse.click mouse.hover"
                    onClick={() => changeActiveTab('assets')}
                    aria-selected={activeTab === 'assets'}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-all relative ${
                      activeTab === 'assets'
                        ? 'bg-white dark:bg-neutral-800 text-blue-600 dark:text-blue-400 rounded-t-xl rounded-b-none corner-squircle -mb-px z-10'
                        : 'rounded-xl corner-squircle text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-neutral-200 hover:bg-white/60 dark:hover:bg-neutral-800/50'
                    }`}
                  >
                    <Box className="w-3.5 h-3.5" />
                    资产清单
                    {totalAssets > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full corner-squircle text-[10px] bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold">
                        {totalAssets}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    data-agent-target="script.view.universe"
                    data-agent-actions="mouse.move mouse.click mouse.hover"
                    onClick={() => changeActiveTab('universe')}
                    aria-selected={activeTab === 'universe'}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl corner-squircle text-xs font-semibold transition-all ${
                      activeTab === 'universe'
                        ? 'bg-white dark:bg-neutral-800 text-blue-600 dark:text-blue-400'
                        : 'text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-neutral-200 hover:bg-white/60 dark:hover:bg-neutral-800/50'
                    }`}
                  >
                    <Palette className="w-3.5 h-3.5" />
                    画面风格
                  </button>
                </div>

                {/* Right action: Close button */}
                <button
                  type="button"
                  onClick={onClose}
                  data-agent-target="script.close"
                  data-agent-actions="mouse.move mouse.click mouse.hover"
                  className="p-1.5 rounded-xl corner-squircle text-gray-400 hover:text-gray-700 dark:hover:text-neutral-200 hover:bg-white/80 dark:hover:bg-neutral-800 transition-colors"
                  title="收起"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Secondary Menu (二级菜单: 与一级高亮区域连为一体，二级按钮无单独背景，纯文字展示) */}
              {activeTab === 'script' && (
                <div className="px-2.5 pb-2">
                  <div className="bg-white dark:bg-neutral-800 rounded-b-xl rounded-tr-xl rounded-tl-none corner-squircle p-1">
                    <div className="px-1.5 py-0.5 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {/* Subordinate: 目录 Button */}
                        <button
                          ref={tocButtonRef}
                          type="button"
                          data-agent-target="script.toc.open"
                          data-agent-actions="mouse.move mouse.click mouse.hover"
                          data-agent-badge={tocItems.length > 0 ? String(tocItems.length) : undefined}
                          onClick={(e) => {
                            e.stopPropagation();
                            onTocOpenChange(!isTocOpen);
                          }}
                          title="剧本目录 / 场景章节快速跳转"
                          aria-expanded={isTocOpen}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg corner-squircle text-xs font-semibold transition-colors ${
                            isTocOpen
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white'
                          }`}
                        >
                          {isInferringToc ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <span>目录</span>
                          )}
                          {!isInferringToc && tocItems.length > 0 && (
                            <span className="px-1.5 py-0.5 rounded-full corner-squircle text-[10px] bg-blue-100/80 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 font-medium">
                              {tocItems.length}
                            </span>
                          )}
                        </button>

                        {/* Search & Batch Replace Button */}
                        <button
                          type="button"
                          data-agent-target="script.search.open"
                          data-agent-actions="mouse.move mouse.click mouse.hover"
                          onClick={() => setIsSearchOpen(prev => !prev)}
                          title="搜索正文与批量替换 (Ctrl+F)"
                          aria-expanded={isSearchOpen}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg corner-squircle text-xs font-semibold transition-colors ${
                            isSearchOpen
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white'
                          }`}
                        >
                          <span>搜索替换</span>
                        </button>

                        {/* Version History Button */}
                        <button
                          type="button"
                          data-agent-target="script.version.open"
                          data-agent-actions="mouse.move mouse.click mouse.hover"
                          title="剧本版本历史与快照管理"
                          onClick={() => setIsVersionOpen(prev => !prev)}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg corner-squircle text-xs font-semibold transition-colors ${isVersionOpen ? "text-blue-600 dark:text-blue-400" : "text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white"}`}
                        >
                          <span>版本管理</span>
                        </button>

                        <div className="h-4 w-px bg-gray-200 dark:bg-neutral-700 ml-1 shrink-0" aria-hidden="true" />
                      </div>
                      
                      <div className="text-[11px] text-gray-500 dark:text-neutral-400 flex items-center gap-2 pr-1.5 select-none min-w-0 flex-1 justify-end">
                        <span data-agent-target="script.scene.indicator" title={currentSceneIndicator} className="max-w-[120px] sm:max-w-[200px] truncate px-1.5 py-0.5 rounded bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 cursor-pointer hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors">
                          {currentSceneIndicator}
                        </span>
                        <span className="shrink-0">·</span>
                        <span data-agent-target="script.version.status" className="truncate shrink-0" title={versionStatus}>
                          {versionStatus}
                        </span>
                      </div>
                    </div>

                    {/* Search & Batch Replace Panel: 直接融入菜单浅蓝背景中，无多余卡片嵌套 */}
                    <AnimatePresence>
                      {isSearchOpen && (
                        <motion.div
                          data-agent-target="script.search.panel"
                          data-agent-actions="mouse.move mouse.hover"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{
                            height: 'auto',
                            opacity: 1,
                            transition: {
                              height: { duration: 0.18, ease: [0.16, 1, 0.3, 1] },
                              opacity: { duration: 0.14, ease: 'easeOut' },
                            },
                          }}
                          exit={{
                            height: 0,
                            opacity: 0,
                            transition: {
                              height: { duration: 0.14, ease: [0.32, 0, 0.67, 0] },
                              opacity: { duration: 0.1, ease: 'easeIn' },
                            },
                          }}
                          className="overflow-hidden shrink-0"
                        >
                          <div className="px-1.5 pb-1.5 pt-1.5 grid grid-cols-[1fr_auto] gap-x-2 gap-y-1.5 items-center text-xs border-t border-gray-100 dark:border-neutral-700/80 mt-1">
                            {/* Row 1, Col 1: Search input */}
                            <div className="relative flex items-center min-w-0">
                              <Search className="w-3.5 h-3.5 absolute left-2.5 text-gray-400 dark:text-neutral-500 pointer-events-none" />
                              <input
                                ref={searchInputRef}
                                type="text"
                                data-agent-target="script.search.input"
                                data-agent-actions="mouse.move mouse.click mouse.type mouse.keyPress"
                                data-agent-badge={searchText ? (searchMatches.length > 0 ? `${safeMatchIndex + 1}/${searchMatches.length}` : '0') : undefined}
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    if (e.shiftKey) handlePrevMatch();
                                    else handleNextMatch();
                                  } else if (e.key === 'Escape') {
                                    setIsSearchOpen(false);
                                  }
                                }}
                                placeholder="搜索正文文本 (Enter 下一个，Shift+Enter 上一个)..."
                                className="w-full pl-8 pr-20 h-7.5 rounded-lg corner-squircle bg-[#f9fafb] dark:bg-neutral-850 border border-gray-200/90 dark:border-[#404040] text-gray-800 dark:text-neutral-100 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder-gray-400 dark:placeholder-neutral-500"
                              />
                              {/* Counter */}
                              <div className="absolute right-2 text-[10px] font-mono select-none flex items-center">
                                {searchText ? (
                                  searchMatches.length > 0 ? (
                                    <span
                                      data-agent-target="script.search.counter"
                                      data-agent-actions="mouse.hover"
                                      data-agent-badge={searchMatches.length}
                                      aria-label={`搜索结果: ${safeMatchIndex + 1}/${searchMatches.length}`}
                                      className="text-gray-500 dark:text-neutral-400 bg-gray-100 dark:bg-neutral-700/80 px-1.5 py-0.5 rounded corner-squircle font-medium"
                                    >
                                      {safeMatchIndex + 1}/{searchMatches.length}
                                    </span>
                                  ) : (
                                    <span
                                      data-agent-target="script.search.counter"
                                      data-agent-actions="mouse.hover"
                                      data-agent-badge="0"
                                      aria-label="搜索结果: 无匹配"
                                      className="text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded corner-squircle font-medium"
                                    >
                                      无匹配
                                    </span>
                                  )
                                ) : null}
                              </div>
                            </div>

                            {/* Row 1, Col 2: Search controls */}
                            <div className="flex items-center justify-end gap-1 shrink-0">
                              {/* Case Sensitive */}
                              <button
                                type="button"
                                data-agent-target="script.search.case"
                                data-agent-actions="mouse.move mouse.click mouse.hover"
                                aria-pressed={isCaseSensitive}
                                onClick={() => setIsCaseSensitive(!isCaseSensitive)}
                                title={isCaseSensitive ? '区分大小写: 开' : '区分大小写: 关'}
                                className={`w-7.5 h-7.5 px-2 rounded-lg corner-squircle font-mono text-xs flex items-center justify-center transition-all ${
                                  isCaseSensitive
                                    ? 'bg-blue-600 text-white font-bold'
                                    : 'bg-[#f9fafb] dark:bg-neutral-850 border border-gray-200/90 dark:border-[#404040] text-gray-500 dark:text-neutral-400 hover:text-gray-800 dark:hover:text-neutral-200'
                                }`}
                              >
                                Aa
                              </button>
                              {/* Prev Match */}
                              <button
                                type="button"
                                data-agent-target="script.search.prev"
                                data-agent-actions="mouse.move mouse.click mouse.hover"
                                disabled={searchMatches.length === 0}
                                onClick={handlePrevMatch}
                                title="上一个匹配项 (Shift+Enter)"
                                className="w-7.5 h-7.5 rounded-lg corner-squircle bg-[#f9fafb] dark:bg-neutral-850 border border-gray-200/90 dark:border-[#404040] hover:bg-gray-100 dark:hover:bg-neutral-750 disabled:opacity-30 disabled:pointer-events-none text-gray-600 dark:text-neutral-300 flex items-center justify-center transition-all"
                              >
                                <ChevronUp className="w-3.5 h-3.5" />
                              </button>
                              {/* Next Match */}
                              <button
                                type="button"
                                data-agent-target="script.search.next"
                                data-agent-actions="mouse.move mouse.click mouse.hover"
                                disabled={searchMatches.length === 0}
                                onClick={handleNextMatch}
                                title="下一个匹配项 (Enter)"
                                className="w-7.5 h-7.5 rounded-lg corner-squircle bg-[#f9fafb] dark:bg-neutral-850 border border-gray-200/90 dark:border-[#404040] hover:bg-gray-100 dark:hover:bg-neutral-750 disabled:opacity-30 disabled:pointer-events-none text-gray-600 dark:text-neutral-300 flex items-center justify-center transition-all"
                              >
                                <ChevronDown className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Row 2, Col 1: Replace input */}
                            <div className="relative flex items-center min-w-0">
                              <Replace className="w-3.5 h-3.5 absolute left-2.5 text-gray-400 dark:text-neutral-500 pointer-events-none" />
                              <input
                                type="text"
                                data-agent-target="script.replace.input"
                                data-agent-actions="mouse.move mouse.click mouse.type mouse.keyPress"
                                value={replaceText}
                                onChange={(e) => setReplaceText(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleReplaceCurrent();
                                  }
                                }}
                                placeholder="替换为..."
                                className="w-full pl-8 pr-3 h-7.5 rounded-lg corner-squircle bg-[#f9fafb] dark:bg-neutral-850 border border-gray-200/90 dark:border-[#404040] text-gray-800 dark:text-neutral-100 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder-gray-400 dark:placeholder-neutral-500"
                              />
                            </div>

                            {/* Row 2, Col 2: Replace actions */}
                            <div className="flex items-center justify-end gap-1 shrink-0">
                              {/* Replace Single */}
                              <button
                                type="button"
                                data-agent-target="script.replace.single"
                                data-agent-actions="mouse.move mouse.click mouse.hover"
                                disabled={searchMatches.length === 0}
                                onClick={handleReplaceCurrent}
                                title="替换当前选中的匹配项"
                                className="h-7.5 px-2.5 rounded-lg corner-squircle bg-[#f9fafb] dark:bg-neutral-850 border border-gray-200/90 dark:border-[#404040] hover:bg-gray-100 dark:hover:bg-neutral-750 disabled:opacity-30 disabled:pointer-events-none text-gray-700 dark:text-neutral-200 font-medium text-xs transition-all whitespace-nowrap"
                              >
                                替换
                              </button>
                              {/* Replace All (批量替换) */}
                              <button
                                type="button"
                                data-agent-target="script.replace.all"
                                data-agent-actions="mouse.move mouse.click mouse.hover"
                                disabled={searchMatches.length === 0}
                                data-agent-badge={searchMatches.length}
                                onClick={handleReplaceAll}
                                title="批量替换全文中的所有匹配项"
                                className="h-7.5 px-2.5 rounded-lg corner-squircle bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-30 disabled:pointer-events-none text-white font-medium text-xs shadow-xs transition-all whitespace-nowrap flex items-center gap-1.5"
                              >
                                <span>全部替换</span>
                                {searchMatches.length > 0 && (
                                  <span className="px-1.5 py-0.2 rounded-full corner-squircle text-[10px] bg-blue-500 text-white font-bold font-mono">
                                    {searchMatches.length}
                                  </span>
                                )}
                              </button>
                            </div>

                            {/* Feedback message if any */}
                            {replaceFeedback && (
                              <div
                                role="alert"
                                data-agent-target="script.replace.feedback"
                                data-agent-actions="mouse.hover"
                                className="col-span-2 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 px-0.5"
                              >
                                <Check className="w-3 h-3" />
                                <span>{replaceFeedback}</span>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <AnimatePresence>
                      {isVersionOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{
                            height: 'auto',
                            opacity: 1,
                            transition: {
                              height: { duration: 0.18, ease: [0.16, 1, 0.3, 1] },
                              opacity: { duration: 0.14, ease: 'easeOut' },
                            },
                          }}
                          exit={{
                            height: 0,
                            opacity: 0,
                            transition: {
                              height: { duration: 0.14, ease: [0.32, 0, 0.67, 0] },
                              opacity: { duration: 0.1, ease: 'easeIn' },
                            },
                          }}
                          className="overflow-hidden shrink-0"
                        >
                          <div className="px-1.5 pb-1.5 pt-1.5 flex flex-col gap-0.5 border-t border-gray-100 dark:border-neutral-700/80 mt-1 max-h-[300px] overflow-y-auto">
                            <div className="flex items-center justify-between mb-1 px-1">
                               <div className="flex items-center gap-3">
                                   <h4 className="text-[11px] font-semibold text-gray-500 dark:text-neutral-500">版本历史</h4>
                                   <label className="flex items-center gap-1.5 cursor-pointer" title="开启后，将在您停止输入3秒后自动检测并记录版本">
                                       <div className={`w-6 h-3.5 rounded-full relative transition-colors ${autoSaveEnabled ? 'bg-blue-500' : 'bg-gray-300 dark:bg-neutral-600'}`}>
                                           <div className={`absolute top-[2px] left-[2px] bg-white w-2.5 h-2.5 rounded-full shadow-sm transition-transform ${autoSaveEnabled ? 'translate-x-2.5' : 'translate-x-0'}`}></div>
                                       </div>
                                       <input type="checkbox" className="sr-only" checked={autoSaveEnabled} onChange={(e) => setAutoSaveEnabled(e.target.checked)} />
                                       <span className="text-[10px] text-gray-500 dark:text-neutral-400 select-none">自动保存改动</span>
                                   </label>
                               </div>
                               <button 
                                  onClick={() => {
                                      if (scriptDraft === lastAssessedTextRef.current) {
                                          setVersionStatus('内容未改变');
                                          setTimeout(() => setVersionStatus('已同步'), 2000);
                                      } else {
                                          triggerAssessChange(scriptDraft, currentSceneIndicator, textareaRef.current?.selectionStart || 0);
                                      }
                                  }}
                                  className="text-[10px] px-1.5 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded corner-squircle hover:bg-blue-500/20 transition-colors">
                                  + 保存改动
                               </button>
                            </div>
                            {versions.length === 0 ? (
                              <div className="text-center py-3 text-[11px] text-gray-400">暂无版本记录，稍后的改动将自动沉淀。</div>
                            ) : (
                              versions.map((ver, idx) => (
                                <div
                                  key={ver.id}
                                  data-agent-target={`script.version.item.${ver.id}`}
                                  className={`w-full text-left px-2 py-1.5 rounded-lg corner-squircle transition-colors flex items-center justify-between group ${
                                    idx === 0 
                                      ? 'bg-blue-50/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                                      : previewVersionId === ver.id
                                        ? 'bg-blue-50/30 dark:bg-blue-900/10 text-blue-500'
                                        : 'hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-700 dark:text-neutral-200'
                                  }`}
                                >
                                  <div className="flex-1 min-w-0 flex items-center gap-2">
                                      {idx === 0 ? (
                                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-blue-500" />
                                      ) : (
                                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-gray-300 dark:bg-neutral-600" />
                                      )}
                                      <span className="font-medium truncate text-[12px] leading-tight" title={ver.summary}>
                                        {ver.summary}
                                      </span>
                                      {idx === 0 && (
                                        <span className="px-1 py-0.5 rounded text-[9px] bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 font-bold ml-1 flex-shrink-0">
                                          当前
                                        </span>
                                      )}
                                  </div>
                                  <div className="relative flex items-center justify-end shrink-0 min-w-[90px]">
                                      <div className={`flex items-center gap-2 transition-opacity duration-150 ${idx === 0 ? 'text-blue-400/70' : 'text-gray-400 group-hover:opacity-0'}`}>
                                          <span className="text-[10px] font-mono flex-shrink-0">
                                            {new Date(ver.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                          </span>
                                          <span className="text-[10px] w-12 text-right truncate" title={ver.scene}>
                                             {ver.scene}
                                          </span>
                                      </div>
                                      
                                      {idx === 0 ? null : (
                                        <div className="absolute inset-y-0 right-0 flex items-center justify-end gap-2 pr-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none group-hover:pointer-events-auto">
                                            <button 
                                                onClick={() => {
                                                    if (previewVersionId === ver.id) {
                                                        setPreviewVersionId(null);
                                                    } else {
                                                        setPreviewVersionId(ver.id);
                                                        
                                                        // Attempt to find diff to highlight and scroll
                                                        const getVersionText = () => {
                                                            let targetText = ver.scriptText;
                                                            if (ver.scale === 'scene_edit' && ver.affectedScenes && ver.affectedScenes[ver.scene] && ver.scene !== '全局' && tocItems.length > 0) {
                                                                let rebuiltText = '';
                                                                for (let i = 0; i < tocItems.length; i++) {
                                                                    if (tocItems[i].title === ver.scene) {
                                                                        const start = tocItems[i].charIndex;
                                                                        const end = i < tocItems.length - 1 ? tocItems[i+1].charIndex : scriptDraft.length;
                                                                        rebuiltText = scriptDraft.slice(0, start) + ver.affectedScenes[ver.scene] + scriptDraft.slice(end);
                                                                        break;
                                                                    }
                                                                }
                                                                if (rebuiltText) targetText = rebuiltText;
                                                            }
                                                            return targetText;
                                                        };
                                                        
                                                        const pText = getVersionText();
                                                        let diffStart = 0;
                                                        
                                                        if (ver.scale === 'scene_edit' && ver.scene && ver.scene !== '全局') {
                                                            // Find the scene heading in the text
                                                            const sceneIdx = pText.indexOf(ver.scene);
                                                            if (sceneIdx !== -1) {
                                                                diffStart = sceneIdx;
                                                            }
                                                        } else {
                                                            // For global edits, diff against the PREVIOUS version to find what changed then
                                                            const prevVer = versions[idx + 1];
                                                            if (prevVer) {
                                                                const oText = prevVer.scriptText;
                                                                while (diffStart < oText.length && diffStart < pText.length && oText[diffStart] === pText[diffStart]) {
                                                                    diffStart++;
                                                                }
                                                            }
                                                        }
                                                        
                                                        // Select in preview textarea
                                                        setTimeout(() => {
                                                            if (textareaRef.current) {
                                                                const node = textareaRef.current;
                                                                const exactTop = getTextareaCharTop(node, diffStart);
                                                                const targetScroll = Math.max(0, exactTop - (node.clientHeight / 2));
                                                                
                                                                isRestoringScrollRef.current = true;
                                                                node.focus({ preventScroll: true });
                                                                node.setSelectionRange(diffStart, diffStart);
                                                                
                                                                node.scrollTo({
                                                                    top: targetScroll,
                                                                    behavior: 'smooth'
                                                                });
                                                            }
                                                        }, 50);
                                                    }
                                                }}
                                                className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${previewVersionId === ver.id ? 'bg-blue-500 text-white' : 'text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/50'}`}
                                            >
                                                {previewVersionId === ver.id ? '退出' : '预览'}
                                            </button>
                                            <button 
                                                onClick={() => {
                                                    let targetText = ver.scriptText;
                                                    if (ver.scale === 'scene_edit' && ver.affectedScenes && ver.affectedScenes[ver.scene] && ver.scene !== '全局' && tocItems.length > 0) {
                                                        let rebuiltText = '';
                                                        for (let i = 0; i < tocItems.length; i++) {
                                                            if (tocItems[i].title === ver.scene) {
                                                                const start = tocItems[i].charIndex;
                                                                const end = i < tocItems.length - 1 ? tocItems[i+1].charIndex : scriptDraft.length;
                                                                rebuiltText = scriptDraft.slice(0, start) + ver.affectedScenes[ver.scene] + scriptDraft.slice(end);
                                                                break;
                                                            }
                                                        }
                                                        if (rebuiltText) targetText = rebuiltText;
                                                    }
                                                    setScriptDraft(targetText);
                                                    onUpdateProject({ scriptText: targetText });
                                                    setVersionStatus('已恢复');
                                                    setPreviewVersionId(null);
                                                    
                                                    setVersions(prev => {
                                                        const newVersions = [{
                                                            id: Date.now().toString(),
                                                            timestamp: Date.now(),
                                                            summary: `恢复至: ${ver.summary}`,
                                                            scale: 'structural',
                                                            scene: '全局',
                                                            affectedScenes: { '全局': targetText },
                                                            globalOrderSnapshot: ['全局'],
                                                            scriptText: targetText
                                                        }, ...prev].slice(0, 50);
                                                        try { localStorage.setItem(`script_versions_${currentProject.id}`, JSON.stringify(newVersions)); } catch {}
                                                        return newVersions;
                                                    });
                                                }}
                                                className="text-[10px] text-gray-500 hover:text-gray-900 dark:hover:text-neutral-200"
                                            >
                                                恢复
                                            </button>
                                        </div>
                                      )}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              )}

            {/* Secondary Menu for Assets (二级菜单: 与一级资产清单高亮连为一体，二级按钮无单独背景，纯文字展示) */}
            {activeTab === 'assets' && (
              <div className="px-2.5 pb-2">
                <div className="bg-white dark:bg-neutral-800 rounded-b-xl rounded-t-xl corner-squircle p-1">
                  <div className="px-1.5 py-0.5 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {/* Filter: 全部 */}
                      <button
                        type="button"
                        data-agent-target="assets.filter.all"
                        data-agent-actions="mouse.move mouse.click mouse.hover"
                        onClick={() => setAssetFilter('all')}
                        aria-selected={assetFilter === 'all'}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg corner-squircle text-xs font-semibold transition-colors ${
                          assetFilter === 'all'
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white'
                        }`}
                      >
                        <span>全部</span>
                        {totalAssets > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full corner-squircle text-[10px] bg-blue-100/80 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 font-medium">
                            {totalAssets}
                          </span>
                        )}
                      </button>

                      <div className="h-3 w-px bg-gray-200 dark:bg-neutral-700" aria-hidden="true" />

                      {/* Filter: 角色 */}
                      <button
                        type="button"
                        data-agent-target="assets.filter.characters"
                        data-agent-actions="mouse.move mouse.click mouse.hover"
                        onClick={() => setAssetFilter('characters')}
                        aria-selected={assetFilter === 'characters'}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg corner-squircle text-xs font-semibold transition-colors ${
                          assetFilter === 'characters'
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white'
                        }`}
                      >
                        <span>角色</span>
                        {(currentProject.characters?.length || 0) > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full corner-squircle text-[10px] bg-blue-100/80 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 font-medium">
                            {currentProject.characters.length}
                          </span>
                        )}
                      </button>

                      <div className="h-3 w-px bg-gray-200 dark:bg-neutral-700" aria-hidden="true" />

                      {/* Filter: 场景 */}
                      <button
                        type="button"
                        data-agent-target="assets.filter.locations"
                        data-agent-actions="mouse.move mouse.click mouse.hover"
                        onClick={() => setAssetFilter('locations')}
                        aria-selected={assetFilter === 'locations'}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg corner-squircle text-xs font-semibold transition-colors ${
                          assetFilter === 'locations'
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white'
                        }`}
                      >
                        <span>场景</span>
                        {(currentProject.locations?.length || 0) > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full corner-squircle text-[10px] bg-blue-100/80 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 font-medium">
                            {currentProject.locations.length}
                          </span>
                        )}
                      </button>

                      <div className="h-3 w-px bg-gray-200 dark:bg-neutral-700" aria-hidden="true" />

                      {/* Filter: 道具 */}
                      <button
                        type="button"
                        data-agent-target="assets.filter.props"
                        data-agent-actions="mouse.move mouse.click mouse.hover"
                        onClick={() => setAssetFilter('props')}
                        aria-selected={assetFilter === 'props'}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg corner-squircle text-xs font-semibold transition-colors ${
                          assetFilter === 'props'
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white'
                        }`}
                      >
                        <span>道具</span>
                        {(currentProject.props?.length || 0) > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full corner-squircle text-[10px] bg-blue-100/80 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 font-medium">
                            {currentProject.props.length}
                          </span>
                        )}
                      </button>
                    </div>

                    <div className="flex items-center gap-2 pr-1.5">
                      {/* Extract Assets Action Button */}
                      <button
                        type="button"
                        onClick={handleExtractAssets}
                        disabled={isExtractingAssets}
                        data-agent-target="assets.extract.all"
                        data-agent-actions="mouse.move mouse.click mouse.hover"
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg corner-squircle text-xs font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 transition-colors disabled:opacity-50"
                        title="基于当前剧本正文全文执行实体提取与消歧"
                      >
                        {isExtractingAssets ? (
                          <>
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            <span>提取中...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3 h-3" />
                            <span>提取全部资产</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 下卡片: 正文与内容展示卡片 */}
          <div
            className="flex-1 flex flex-col min-h-0 overflow-hidden pointer-events-auto relative z-10"
            onPointerDown={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
          >
            {activeTab === 'script' ? (
              <div className="flex-1 flex flex-col min-h-0 relative">
                {isAnimationSettled ? (
                  <textarea
                    key={`script-${currentProject.id}`}
                    ref={handleTextareaRef}
                    data-agent-target="script.text"
                    data-agent-actions="mouse.move mouse.click mouse.hover mouse.drag mouse.scroll mouse.type mouse.keyPress"
                    value={previewVersionId ? getPreviewText() : scriptDraft}
                    readOnly={!!previewVersionId}
                    onChange={handleScriptChange}
                    onScroll={handleScriptScroll}
                    onSelect={(event) => {
                      const node = event.currentTarget;
                      const start = node.selectionStart;
                      const end = node.selectionEnd;
                      updateSceneIndicator(node.value, start);
                      if (start === end) return onSelectionChange(null);
                      onSelectionChange({
                        text: node.value.slice(start, end), start, end,
                        lineStart: node.value.slice(0, start).split('\n').length,
                        lineEnd: node.value.slice(0, end).split('\n').length,
                      });
                    }}
                    placeholder="在此直接输入或粘贴剧本正文...&#10;&#10;例如：&#10;【场 1】内景. 房间 - 夜&#10;主角坐在桌前，窗外微风拂过...&#10;&#10;【场 2】外景. 街道 - 日&#10;阳光穿透树梢，洒在人行道上..."
                    className={`w-full flex-1 h-full pl-[22px] pr-[17px] pt-4 pb-4 text-[14px] font-medium leading-relaxed bg-transparent border-0 outline-none text-gray-800 dark:text-neutral-300 placeholder-gray-400 dark:placeholder-neutral-500 resize-none overflow-y-auto transition-opacity duration-200 ease-out ${
                      isPositionReady ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
                    spellCheck={false}
                  />
                ) : (
                  <div className="w-full flex-1 h-full" />
                )}

                {/* Bottom Right Floating Stats */}
                <div className="absolute bottom-5 right-6 pointer-events-none select-none flex items-center gap-2.5 text-gray-400 dark:text-neutral-500 opacity-60">
                  <div className="flex flex-col items-center">
                    <span className="text-[11px] font-medium tabular-nums leading-none">{(scriptDraft || '').length}</span>
                    <span className="text-[10px] leading-none mt-1.5">字</span>
                  </div>
                  <span className="text-[12px] leading-none mt-3.5 opacity-60">·</span>
                  <div className="flex flex-col items-center">
                    <span className="text-[11px] font-medium tabular-nums leading-none">{scriptDraft ? scriptDraft.split('\n').length : 0}</span>
                    <span className="text-[10px] leading-none mt-1.5">行</span>
                  </div>
                </div>

                {/* 目录打开后的列表卡片: 范围限制在正文卡片内，上下边距一致 */}
                <AnimatePresence>
                  {isTocOpen && (
                    <motion.div
                      ref={tocCardRef}
                      initial={{ opacity: 0, x: -10, scale: 0.98 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{ opacity: 0, x: -10, scale: 0.98 }}
                      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute left-2.5 top-2.5 bottom-2.5 w-72 bg-white/95 dark:bg-neutral-800/95 backdrop-blur-md border border-gray-200/90 dark:border-[#404040] rounded-2xl corner-squircle shadow-xl z-30 flex flex-col overflow-hidden text-xs"
                    >
                      {/* TOC Items List */}
                      <div
                        ref={tocListRef}
                        data-agent-target="script.toc.list"
                        data-agent-actions="mouse.move mouse.hover mouse.scroll"
                        onScroll={handleTocListScroll}
                        className="flex-1 overflow-y-auto p-1.5 space-y-0.5"
                      >
                        {isInferringToc ? (
                          <div className="py-8 text-center text-blue-500 dark:text-blue-400 space-y-2">
                            <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-2" />
                            <p className="text-[11px] font-medium">AI 正在智能解析目录结构...</p>
                            <p className="text-[10px] opacity-70 text-gray-500 dark:text-neutral-400">
                              首次提取可能需要几秒钟
                            </p>
                          </div>
                        ) : tocItems.length === 0 ? (
                          <div className="py-8 text-center text-gray-400 dark:text-neutral-500 space-y-1">
                            <BookText className="w-5 h-5 mx-auto opacity-40 mb-1" />
                            <p className="text-[11px]">正文中暂无集数或章节标识</p>
                            <p className="text-[10px] opacity-70">
                              剧本包含分集内容后将自动解析
                            </p>
                          </div>
                        ) : (
                          tocItems.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              data-agent-target={`script.toc.item.${item.id}`}
                              data-agent-actions="mouse.move mouse.click mouse.hover"
                              onClick={() => handleJumpToToc(item)}
                              className="w-full text-left px-2.5 py-2 rounded-xl corner-squircle hover:bg-blue-50 dark:hover:bg-blue-950 text-gray-700 dark:text-neutral-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-start gap-2 group"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold truncate text-[12px] leading-tight">
                                  {item.title}
                                </div>
                                {item.subTitle && (
                                  <div className="text-[11px] text-gray-400 dark:text-neutral-500 truncate mt-0.5">
                                    {item.subTitle}
                                  </div>
                                )}
                              </div>
                              <span className="text-[10px] text-gray-400 dark:text-neutral-500 mt-0.5 shrink-0 whitespace-nowrap">
                                第 {item.lineNumber} 行
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* TAB 2: ASSETS OUTLINE */}
                {activeTab === 'assets' && (
                <div className="flex flex-col gap-4">
                  {/* Extraction Feedback Banner */}
                  {extractionFeedback && (
                    <div role="alert" className="p-2.5 bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-900/50 rounded-xl corner-squircle text-[11px] font-medium text-purple-700 dark:text-purple-300 flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 shrink-0 text-purple-600" />
                      <span>{extractionFeedback}</span>
                    </div>
                  )}

                  {/* Asset Cards List or Empty State */}
                  {(currentProject.characters?.length || 0) === 0 &&
                  (currentProject.locations?.length || 0) === 0 &&
                  (currentProject.props?.length || 0) === 0 ? (
                    <div
                      className="py-16 px-4 flex flex-col items-center justify-center text-center"
                      data-agent-target="assets.empty.state"
                      data-agent-actions="mouse.hover"
                    >
                      <div className="w-12 h-12 rounded-2xl corner-squircle bg-gray-100 dark:bg-neutral-800 text-gray-400 dark:text-neutral-500 flex items-center justify-center mb-3">
                        <Box className="w-6 h-6" />
                      </div>
                      <h3 className="text-sm font-bold text-gray-700 dark:text-neutral-200">
                        暂无资产条目
                      </h3>
                      <p className="text-xs text-gray-400 dark:text-neutral-500 max-w-xs mt-1 mb-4 leading-relaxed">
                        在「剧本正文」中输入或粘贴剧本后，点击下方按钮即可一键提取角色、场景与核心道具实体。
                      </p>
                      <button
                        onClick={handleExtractAssets}
                        disabled={isExtractingAssets}
                        data-agent-target="assets.extract.all"
                        data-agent-actions="mouse.move mouse.click mouse.hover"
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl corner-squircle bg-purple-600 text-white text-xs font-semibold hover:bg-purple-700 transition-colors shadow-sm disabled:opacity-50"
                      >
                        {isExtractingAssets ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>模型提取中...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>一键提取全部资产</span>
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {/* Characters */}
                      {(assetFilter === 'all' || assetFilter === 'characters') && (
                        <div className="flex flex-col gap-2">
                          {currentProject.characters.map((char) => {
                            const prompt = `Cinematic character portrait of ${char.name}, ${char.role}, ${char.age}. ${char.appearance}. Style: ${currentProject.universe.artStyle}, ${currentProject.universe.colorTone}, 35mm photograph, hyperdetailed master film still.`;
                            return (
                              <div
                                key={char.id}
                                data-agent-target={`assets.item.character.${char.id}`}
                                className="p-3.5 bg-white dark:bg-neutral-800 rounded-2xl corner-squircle border border-gray-200/60 dark:border-[#404040] flex flex-col gap-2 shadow-2xs"
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-lg corner-squircle bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 flex items-center justify-center">
                                      <Users className="w-3.5 h-3.5" />
                                    </div>
                                    <div>
                                      <h4 className="text-xs font-bold text-gray-900 dark:text-white">
                                        {char.name}
                                      </h4>
                                      <span className="text-[10px] text-gray-400">
                                        {char.role} · {char.age}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      data-agent-target={`assets.item.character.${char.id}.copy`}
                                      data-agent-actions="mouse.move mouse.click mouse.hover"
                                      onClick={() => handleCopyText(prompt, char.id)}
                                      className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-200 dark:hover:bg-neutral-700 rounded-lg corner-squircle transition-colors"
                                      title="复制出图提示词"
                                    >
                                      {copiedId === char.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                    </button>
                                    {onRequestGenerateAsset && (
                                      <button
                                        data-agent-target={`assets.item.character.${char.id}.generate`}
                                        data-agent-actions="mouse.move mouse.click mouse.hover"
                                        onClick={() => onRequestGenerateAsset(char.name, prompt)}
                                        className="flex items-center gap-1 px-2 py-1 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg corner-squircle text-[11px] font-medium transition-colors"
                                      >
                                        <Wand2 className="w-3 h-3" />
                                        定妆生成
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <p className="text-xs text-gray-600 dark:text-neutral-300 leading-relaxed">
                                  {char.appearance}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Locations */}
                      {(assetFilter === 'all' || assetFilter === 'locations') && (
                        <div className="flex flex-col gap-2">
                          {currentProject.locations.map((loc) => {
                            const prompt = `Cinematic wide environment establishing shot of ${loc.name}, ${loc.type}, ${loc.timeOfDay}. Atmosphere: ${loc.atmosphere}. Details: ${loc.visualDetails}. Style: ${currentProject.universe.artStyle}, ${currentProject.universe.cinematography}, film still.`;
                            return (
                              <div
                                key={loc.id}
                                data-agent-target={`assets.item.location.${loc.id}`}
                                className="p-3.5 bg-white dark:bg-neutral-800 rounded-2xl corner-squircle border border-gray-200/60 dark:border-[#404040] flex flex-col gap-2 shadow-2xs"
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-lg corner-squircle bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 flex items-center justify-center">
                                      <MapPin className="w-3.5 h-3.5" />
                                    </div>
                                    <div>
                                      <h4 className="text-xs font-bold text-gray-900 dark:text-white">
                                        {loc.name}
                                      </h4>
                                      <span className="text-[10px] text-gray-400">
                                        {loc.type} · {loc.timeOfDay}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      data-agent-target={`assets.item.location.${loc.id}.copy`}
                                      data-agent-actions="mouse.move mouse.click mouse.hover"
                                      onClick={() => handleCopyText(prompt, loc.id)}
                                      className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-200 dark:hover:bg-neutral-700 rounded-lg corner-squircle transition-colors"
                                      title="复制出图提示词"
                                    >
                                      {copiedId === loc.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                    </button>
                                    {onRequestGenerateAsset && (
                                      <button
                                        data-agent-target={`assets.item.location.${loc.id}.generate`}
                                        data-agent-actions="mouse.move mouse.click mouse.hover"
                                        onClick={() => onRequestGenerateAsset(loc.name, prompt)}
                                        className="flex items-center gap-1 px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg corner-squircle text-[11px] font-medium transition-colors"
                                      >
                                        <Wand2 className="w-3 h-3" />
                                        场景生成
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <p className="text-xs text-gray-600 dark:text-neutral-300 leading-relaxed">
                                  {loc.atmosphere}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Props */}
                      {(assetFilter === 'all' || assetFilter === 'props') && (
                        <div className="flex flex-col gap-2">
                          {currentProject.props.map((prop) => {
                            const prompt = `Close-up studio cinematography shot of ${prop.name}. Material and state: ${prop.materialAndState}. Significant story object. Style: ${currentProject.universe.artStyle}, ${currentProject.universe.colorTone}, pristine high detail.`;
                            return (
                              <div
                                key={prop.id}
                                data-agent-target={`assets.item.prop.${prop.id}`}
                                className="p-3.5 bg-white dark:bg-neutral-800 rounded-2xl corner-squircle border border-gray-200/60 dark:border-[#404040] flex flex-col gap-2 shadow-2xs"
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-lg corner-squircle bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 flex items-center justify-center">
                                      <Box className="w-3.5 h-3.5" />
                                    </div>
                                    <div>
                                      <h4 className="text-xs font-bold text-gray-900 dark:text-white">
                                        {prop.name}
                                      </h4>
                                      <span className="text-[10px] text-gray-400">
                                        持有者: {prop.owner}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      data-agent-target={`assets.item.prop.${prop.id}.copy`}
                                      data-agent-actions="mouse.move mouse.click mouse.hover"
                                      onClick={() => handleCopyText(prompt, prop.id)}
                                      className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-200 dark:hover:bg-neutral-700 rounded-lg corner-squircle transition-colors"
                                      title="复制出图提示词"
                                    >
                                      {copiedId === prop.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                    </button>
                                    {onRequestGenerateAsset && (
                                      <button
                                        data-agent-target={`assets.item.prop.${prop.id}.generate`}
                                        data-agent-actions="mouse.move mouse.click mouse.hover"
                                        onClick={() => onRequestGenerateAsset(prop.name, prompt)}
                                        className="flex items-center gap-1 px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg corner-squircle text-[11px] font-medium transition-colors"
                                      >
                                        <Wand2 className="w-3 h-3" />
                                        道具特写
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <p className="text-xs text-gray-600 dark:text-neutral-300 leading-relaxed">
                                  {prop.materialAndState}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: UNIVERSE AESTHETICS */}
              {activeTab === 'universe' && (
                <div className="flex flex-col gap-4">
                  <div className="p-4 bg-white dark:bg-neutral-800 rounded-2xl corner-squircle border border-gray-200/60 dark:border-[#404040] space-y-3 shadow-2xs">
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-900 dark:text-white">
                      <Palette className="w-4 h-4 text-blue-500" />
                      色彩与影调体系
                    </div>
                    <div className="flex items-center gap-2">
                      {currentProject.universe.colorHexes.map((hex, idx) => (
                        <div
                          key={idx}
                          className="w-10 h-8 rounded-lg corner-squircle shadow-sm border border-black/10 flex items-center justify-center text-[10px] font-mono text-white/90"
                          style={{ backgroundColor: hex }}
                        >
                          {hex.slice(1, 4)}
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-600 dark:text-neutral-300 leading-relaxed">
                      {currentProject.universe.colorTone}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <div className="p-3.5 bg-white dark:bg-neutral-800 rounded-2xl corner-squircle border border-gray-200/60 dark:border-[#404040] space-y-1 shadow-2xs">
                      <div className="text-[11px] font-semibold text-gray-400">时代背景与纪元</div>
                      <div className="text-xs font-medium text-gray-800 dark:text-neutral-200">
                        {currentProject.universe.era}
                      </div>
                    </div>

                    <div className="p-3.5 bg-white dark:bg-neutral-800 rounded-2xl corner-squircle border border-gray-200/60 dark:border-[#404040] space-y-1 shadow-2xs">
                      <div className="text-[11px] font-semibold text-gray-400">视觉艺术风格</div>
                      <div className="text-xs font-medium text-gray-800 dark:text-neutral-200">
                        {currentProject.universe.artStyle}
                      </div>
                    </div>

                    <div className="p-3.5 bg-white dark:bg-neutral-800 rounded-2xl corner-squircle border border-gray-200/60 dark:border-[#404040] space-y-1 shadow-2xs">
                      <div className="text-[11px] font-semibold text-gray-400">摄影与光学语言</div>
                      <div className="text-xs font-medium text-gray-800 dark:text-neutral-200">
                        {currentProject.universe.cinematography}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
      )}
      </AnimatePresence>
    </>
  );
}
