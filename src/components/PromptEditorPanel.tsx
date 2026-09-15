import { useState, useEffect } from 'react';
import { Save, LoaderCircle, Check } from 'lucide-react';

export const PromptEditorPanel = () => {
  const [prompt, setPrompt] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/agent/prompt')
      .then(res => res.json())
      .then(data => {
        if (data.prompt) setPrompt(data.prompt);
        setLoading(false);
      })
      .catch(console.error);
  }, []);

  const savePrompt = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/agent/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-[#fbfbfc] p-6 dark:bg-[#121214]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">主循环 Prompt 编辑器</h2>
          <p className="mt-1 text-sm text-slate-500">
            修改主循环的系统指令，{'{toolPrompt}'} 将会被动态替换为工具定义。
          </p>
        </div>
        <button
          onClick={savePrompt}
          disabled={loading || saving}
          className="flex h-9 items-center gap-2 rounded-lg bg-violet-600 px-4 text-sm font-medium text-white transition hover:bg-violet-700 disabled:opacity-50"
        >
          {saving ? <LoaderCircle className="animate-spin" size={16} /> : saved ? <Check size={16} /> : <Save size={16} />}
          {saved ? '已保存' : '保存到代码库'}
        </button>
      </div>
      <div className="min-h-0 flex-1 rounded-xl border border-slate-200 bg-gray-100 p-1 shadow-sm dark:border-white/10 dark:bg-black">
        {loading ? (
          <div className="grid h-full place-items-center">
            <LoaderCircle className="animate-spin text-slate-400" />
          </div>
        ) : (
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            className="h-full w-full resize-none bg-transparent p-4 text-sm leading-relaxed text-slate-700 outline-none dark:text-slate-300"
            spellCheck={false}
          />
        )}
      </div>
    </div>
  );
};
