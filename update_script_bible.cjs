const fs = require('fs');
let code = fs.readFileSync('src/components/ProjectScriptBible.tsx', 'utf8');

// Add states
code = code.replace(
  "const [scriptDraft, setScriptDraft] = useState(currentProject?.scriptText || '');",
  "const [scriptDraft, setScriptDraft] = useState(currentProject?.scriptText || '');\n  const [currentSceneIndicator, setCurrentSceneIndicator] = useState('全局');\n  const [versionStatus, setVersionStatus] = useState('已同步');\n  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);\n  const lastAssessedTextRef = useRef(currentProject?.scriptText || '');"
);

// Add triggerAssessChange function before handleScriptChange
const triggerFunction = `
  const triggerAssessChange = async (val: string, scene: string, offset: number) => {
    try {
      const oldText = lastAssessedTextRef.current;
      if (val === oldText) return;
      
      setVersionStatus('分析意图中...');
      const char_delta = val.length - oldText.length;
      
      let action = 'type';
      if (Math.abs(char_delta) > 50) action = 'paste_or_delete';
      
      const before_snippet = oldText.slice(Math.max(0, offset - 30), offset + 30);
      const after_snippet = val.slice(Math.max(0, offset - 30), offset + 30);

      const res = await fetch('/api/script/assess-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          affected_scene_orders: [scene],
          char_delta,
          before_snippet,
          after_snippet
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.scale === 'trivial') {
           setVersionStatus('已保存 (微调)');
        } else if (data.scale === 'scene_edit') {
           setVersionStatus(\`\${scene}已暂存: \${data.summary}\`);
        } else {
           setVersionStatus(\`里程碑更新: \${data.summary}\`);
        }
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
`;

code = code.replace(
  "const handleScriptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {\n    const val = e.target.value;\n    setScriptDraft(val);\n    onUpdateProject({ scriptText: val });\n  };",
  triggerFunction + "\n  const handleScriptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {\n    const val = e.target.value;\n    setScriptDraft(val);\n    onUpdateProject({ scriptText: val });\n\n    const cursorOffset = e.target.selectionStart;\n    const scene = updateSceneIndicator(val, cursorOffset);\n    setVersionStatus('有未保存改动');\n\n    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);\n    typingTimerRef.current = setTimeout(() => {\n        triggerAssessChange(val, scene, cursorOffset);\n    }, 3000);\n  };"
);

code = code.replace(
  "onSelect={(event) => {",
  "onSelect={(event) => {\n                      const node = event.currentTarget;\n                      const start = node.selectionStart;\n                      updateSceneIndicator(node.value, start);"
);

// Add indicators to the UI
const uiAdditions = `
                      <div className="text-[11px] text-gray-500 dark:text-neutral-400 flex items-center gap-2 pr-1.5 select-none">
                        <span data-agent-target="script.scene.indicator" className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 cursor-pointer hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors">
                          {currentSceneIndicator}
                        </span>
                        <span>·</span>
                        <span data-agent-target="script.version.status" className="max-w-[150px] truncate" title={versionStatus}>
                          {versionStatus}
                        </span>
                        <span>·</span>
                        <span>{(scriptDraft || '').length} 字</span>
`;

code = code.replace(
  '<div className="text-[11px] text-gray-500 dark:text-neutral-400 flex items-center gap-2 pr-1.5 select-none">\n                        <span>{(scriptDraft || \'\').length} 字</span>',
  uiAdditions
);

fs.writeFileSync('src/components/ProjectScriptBible.tsx', code);
