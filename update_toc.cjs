const fs = require('fs');
let content = fs.readFileSync('src/components/ProjectScriptBible.tsx', 'utf-8');

// 1. Add isInferringToc state
const stateTarget = `  const [inferredPatterns, setInferredPatterns] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(\`script_toc_patterns_\${currentProject.id}\`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });`;
const stateReplacement = `  const [inferredPatterns, setInferredPatterns] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(\`script_toc_patterns_\${currentProject.id}\`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isInferringToc, setIsInferringToc] = useState(false);`;
content = content.replace(stateTarget, stateReplacement);

// 2. Refactor the useEffect for autoInfer
const effectTarget = `  // Automatically infer TOC patterns in background when script content exists and no patterns stored yet
  useEffect(() => {
    if (!scriptDraft || scriptDraft.trim().length < 20) return;

    // Only run if we don't already have inferred patterns saved
    const saved = localStorage.getItem(\`script_toc_patterns_\${currentProject.id}\`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return; // Already inferred
        }
      } catch (e) {}
    }

    if (inferenceAttemptedRef.current.has(currentProject.id)) return;
    inferenceAttemptedRef.current.add(currentProject.id);

    let isMounted = true;
    const autoInfer = async () => {`;

const effectReplacement = `  // Automatically infer TOC patterns in background when script content exists and no patterns stored yet
  useEffect(() => {
    if (!scriptDraft || scriptDraft.trim().length < 20) return;

    // Do not infer if we already have patterns loaded in state (either from localStorage or from a previous fallback in this session)
    if (inferredPatterns.length > 0) return;
    
    // Check localStorage just to be safe
    const saved = localStorage.getItem(\`script_toc_patterns_\${currentProject.id}\`);
    if (saved && saved !== '[]') return;

    if (inferenceAttemptedRef.current.has(currentProject.id)) return;

    let isMounted = true;
    const autoInfer = async () => {
      setIsInferringToc(true);
      inferenceAttemptedRef.current.add(currentProject.id);`;
content = content.replace(effectTarget, effectReplacement);

// 3. Update the end of autoInfer to set isInferringToc(false)
const autoInferEndTarget = `        setInferredPatterns(fallbackPatterns);
      }
    };

    autoInfer();
    return () => {
      isMounted = false;
    };
  }, [currentProject.id, scriptDraft]);`;

const autoInferEndReplacement = `        setInferredPatterns(fallbackPatterns);
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
  }, [currentProject.id, scriptDraft, inferredPatterns.length]);`;
content = content.replace(autoInferEndTarget, autoInferEndReplacement);

// 4. Refactor tocItems to remove the defaultRegex synchronous fallback
const tocItemsTarget = `    // Compile active patterns: combine AI-inferred patterns + built-in fallback patterns
    const activeRegexes: RegExp[] = [];
    inferredPatterns.forEach(patternStr => {
      try {
        activeRegexes.push(new RegExp(patternStr, 'i'));
      } catch (e) {
        console.warn("Invalid regex pattern from AI:", patternStr);
      }
    });

    // Default fallback pattern if none inferred or to ensure complete matching
    const defaultRegex = /^(?:第[0-9一二三四五六七八九十百千]+[集场幕章节回话话].*|【(?:第?[0-9一二三四五六七八九十百千]+[集场幕章节回话]?[^】]*)】.*|#{1,4}\\s+.+|(?:EPISODE|EP|ACT|SCENE|CHAPTER)\\s*#?[0-9一二三四五六七八九十百千]+.*|(?:集数|场次|场景|幕|序幕|尾声|前言|正文)\\s*[:：0-9一二三四五六七八九十].*|[0-9]+(?:[-.][0-9]+)+.*)/i;

    lines.forEach((rawLine, index) => {
      const trimmed = rawLine.trim();
      if (!trimmed) {
        charAccumulator += rawLine.length + 1;
        return;
      }

      // Check if matches any inferred regex OR fallback regex
      let isMatch = false;
      if (activeRegexes.length > 0) {
        isMatch = activeRegexes.some(rx => rx.test(trimmed));
      }
      if (!isMatch) {
        isMatch = defaultRegex.test(trimmed);
      }`;

const tocItemsReplacement = `    // Only use patterns explicitly set in state (AI inferred or the injected explicit fallback)
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

      let isMatch = activeRegexes.some(rx => rx.test(trimmed));`;
content = content.replace(tocItemsTarget, tocItemsReplacement);

// 5. Update TOC UI to show loading state if isInferringToc
const tocListTarget = `                      {/* TOC Items List */}
                      <div
                        ref={tocListRef}
                        data-agent-target="script.toc.list"
                        data-agent-actions="mouse.move mouse.hover mouse.scroll"
                        onScroll={handleTocListScroll}
                        className="flex-1 overflow-y-auto p-1.5 space-y-0.5"
                      >
                        {tocItems.length === 0 ? (
                          <div className="py-8 text-center text-gray-400 dark:text-neutral-500 space-y-1">
                            <BookText className="w-5 h-5 mx-auto opacity-40 mb-1" />
                            <p className="text-[11px]">正文中暂无集数或章节标识</p>
                            <p className="text-[10px] opacity-70">
                              剧本包含分集内容后将自动解析
                            </p>
                          </div>
                        ) : (
                          tocItems.map((item) => (`;

const tocListReplacement = `                      {/* TOC Items List */}
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
                          tocItems.map((item) => (`;
content = content.replace(tocListTarget, tocListReplacement);

fs.writeFileSync('src/components/ProjectScriptBible.tsx', content);
