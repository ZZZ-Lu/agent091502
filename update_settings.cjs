const fs = require('fs');
let content = fs.readFileSync('src/components/SettingsPage.tsx', 'utf-8');

// 1. Initialize nodePrompts from localStorage
const initTarget = `  const [nodePrompts, setNodePrompts] = useState<NodePromptConfig>(() => ({ ...DEFAULT_NODE_PROMPTS }));`;
const initReplacement = `  const [nodePrompts, setNodePrompts] = useState<NodePromptConfig>(() => {
    try {
      const saved = localStorage.getItem('custom_node_prompts');
      if (saved) {
        return { ...DEFAULT_NODE_PROMPTS, ...JSON.parse(saved) };
      }
    } catch {}
    return { ...DEFAULT_NODE_PROMPTS };
  });

  const [hasUnsavedPrompts, setHasUnsavedPrompts] = useState(false);

  const saveCustomPrompts = () => {
    localStorage.setItem('custom_node_prompts', JSON.stringify(nodePrompts));
    setHasUnsavedPrompts(false);
  };`;
content = content.replace(initTarget, initReplacement);

// 2. Update updatePrompt to set hasUnsavedPrompts
const updatePromptTarget = `  const updatePrompt = (value: string) => {
    if (!activePromptKey) return;
    setNodePrompts((current) => ({ ...current, [activePromptKey]: value }));
  };`;
const updatePromptReplacement = `  const updatePrompt = (value: string) => {
    if (!activePromptKey) return;
    setNodePrompts((current) => ({ ...current, [activePromptKey]: value }));
    setHasUnsavedPrompts(true);
  };`;
content = content.replace(updatePromptTarget, updatePromptReplacement);

// 3. Update resetPrompt to clear localStorage and state
const resetPromptTarget = `  const resetPrompt = () => {
    if (!activePromptKey) {
      setNodePrompts({ ...DEFAULT_NODE_PROMPTS });
      return;
    }
    setNodePrompts((current) => ({ ...current, [activePromptKey]: DEFAULT_NODE_PROMPTS[activePromptKey] }));
  };`;
const resetPromptReplacement = `  const resetPrompt = () => {
    let nextPrompts = { ...nodePrompts };
    if (!activePromptKey) {
      nextPrompts = { ...DEFAULT_NODE_PROMPTS };
    } else {
      nextPrompts[activePromptKey] = DEFAULT_NODE_PROMPTS[activePromptKey];
    }
    setNodePrompts(nextPrompts);
    localStorage.setItem('custom_node_prompts', JSON.stringify(nextPrompts));
    setHasUnsavedPrompts(false);
  };`;
content = content.replace(resetPromptTarget, resetPromptReplacement);

// 4. Update the UI to add save button and remove "不写入本地缓存"
const uiTarget1 = `            {centerTab === 'prompt' && (
              <button onClick={resetPrompt} className="ml-auto flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-700 dark:hover:text-white"><RotateCcw size={12} />恢复代码默认</button>
            )}`;
const uiReplacement1 = `            {centerTab === 'prompt' && (
              <div className="ml-auto flex items-center gap-3">
                <button onClick={resetPrompt} className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-700 dark:hover:text-white"><RotateCcw size={12} />恢复代码默认</button>
                {activePromptKey && (
                  <button 
                    onClick={saveCustomPrompts} 
                    className={\`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded transition-colors \${hasUnsavedPrompts ? 'bg-violet-500 text-white hover:bg-violet-600' : 'bg-slate-100 text-slate-400 dark:bg-white/5 dark:text-slate-500'}\`}
                    disabled={!hasUnsavedPrompts}
                  >
                    {hasUnsavedPrompts ? '保存修改' : '已保存'}
                  </button>
                )}
              </div>
            )}`;
content = content.replace(uiTarget1, uiReplacement1);

const uiTarget2 = `                <div className="mb-2 flex items-center justify-between text-[11px] text-slate-400">
                  <span>{activePromptKey ? '代码默认 · 可临时覆盖' : '全管线 Prompt 预览'}</span>
                  <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-600 dark:bg-emerald-500 dark:text-emerald-300">不写入本地缓存</span>
                </div>`;
const uiReplacement2 = `                <div className="mb-2 flex items-center justify-between text-[11px] text-slate-400">
                  <span>{activePromptKey ? '可编辑自定义 Prompt' : '全管线 Prompt 预览'}</span>
                  {activePromptKey && (
                    <span className="rounded bg-violet-50 px-1.5 py-0.5 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300">将写入本地缓存</span>
                  )}
                </div>`;
content = content.replace(uiTarget2, uiReplacement2);

fs.writeFileSync('src/components/SettingsPage.tsx', content);
