const fs = require('fs');
let content = fs.readFileSync('src/components/SettingsPage.tsx', 'utf-8');

const initTarget = `  const [nodePrompts, setNodePrompts] = useState<NodePromptConfig>(() => {
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

const initReplacement = `  const [nodePrompts, setNodePrompts] = useState<NodePromptConfig>(() => ({ ...DEFAULT_NODE_PROMPTS }));

  const [hasUnsavedPrompts, setHasUnsavedPrompts] = useState(false);
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);

  const saveCustomPrompts = async () => {
    setIsSavingPrompt(true);
    try {
      const res = await fetch('/api/save-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompts: nodePrompts })
      });
      if (res.ok) {
        setHasUnsavedPrompts(false);
      } else {
        alert('保存失败，请查看控制台');
      }
    } catch (e) {
      console.error(e);
      alert('保存失败');
    } finally {
      setIsSavingPrompt(false);
    }
  };`;

content = content.replace(initTarget, initReplacement);

const resetTarget = `  const resetPrompt = () => {
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

const resetReplacement = `  const resetPrompt = () => {
    if (!activePromptKey) return;
    setNodePrompts(current => ({ ...current, [activePromptKey]: DEFAULT_NODE_PROMPTS[activePromptKey] }));
    setHasUnsavedPrompts(true); // Must manually save after resetting in UI
  };`;

content = content.replace(resetTarget, resetReplacement);

const btnTarget = `                    disabled={!hasUnsavedPrompts}
                  >
                    {hasUnsavedPrompts ? '保存修改' : '已保存'}
                  </button>`;

const btnReplacement = `                    disabled={!hasUnsavedPrompts || isSavingPrompt}
                  >
                    {isSavingPrompt ? '保存中...' : hasUnsavedPrompts ? '写入项目代码' : '已写入项目代码'}
                  </button>`;
content = content.replace(btnTarget, btnReplacement);

const labelTarget = `                    <span className="rounded bg-violet-50 px-1.5 py-0.5 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300">将写入本地缓存</span>`;
const labelReplacement = `                    <span className="rounded bg-violet-50 px-1.5 py-0.5 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300">将直接覆盖源代码</span>`;
content = content.replace(labelTarget, labelReplacement);

fs.writeFileSync('src/components/SettingsPage.tsx', content);
