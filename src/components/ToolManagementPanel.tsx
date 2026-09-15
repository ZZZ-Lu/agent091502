import { useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronRight, MousePointer2, Power, RotateCcw, ShieldCheck } from 'lucide-react';
import { AGENT_TOOL_REGISTRY, DEFAULT_AGENT_TOOL_CONFIG, getAgentToolConfig, saveAgentToolConfig, type AgentToolConfig, type ToolCategory } from '../agent/toolRegistry';
import { PAGE_COMPONENT_REGISTRY } from '../agent/pageComponentRegistry';

const categories: ToolCategory[] = ['操作知识', '页面观察', '页面交互', '系统控制'];

export function ToolManagementPanel() {
  const [config, setConfig] = useState<AgentToolConfig>(getAgentToolConfig);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [autoInspect, setAutoInspect] = useState(() => localStorage.getItem("auto_inspect_on_launch") !== "false");
  const handleAutoInspectChange = (checked: boolean) => {
    setAutoInspect(checked);
    localStorage.setItem("auto_inspect_on_launch", checked ? "true" : "false");
  };
  const grouped = useMemo(() => categories.map((category) => ({ category, tools: AGENT_TOOL_REGISTRY.filter((tool) => tool.category === category) })), []);
  const setEnabled = (id: keyof AgentToolConfig, enabled: boolean) => {
    const next = { ...config, [id]: enabled };
    setConfig(next);
    saveAgentToolConfig(next);
  };
  const enabledCount = Object.values(config).filter(Boolean).length;

  return <section className="min-h-0 w-full flex-1 overflow-y-auto overscroll-contain bg-[#fbfbfc] p-6 dark:bg-[#121214]">
    <div className="mx-auto max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-violet-500">Runtime registry</p>
          <h2 className="mt-1 text-xl font-semibold">工具管理</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">这里展示 Agent 当前真实注册的工具。关闭工具后，它不会进入下一轮 Agent 的可用工具集合，也无法被 Runtime 执行。</p>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-right text-xs text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500 dark:text-emerald-300"><div className="font-semibold">{enabledCount} / {AGENT_TOOL_REGISTRY.length} 已启用</div><div className="mt-0.5 opacity-70">配置仅保存在本机</div></div>
      </div>
      <div className="mt-6 mb-6 rounded-2xl border border-slate-200 bg-gray-100 p-4 dark:border-white/10 dark:bg-[#18181b] flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">首轮自动页面观察</h3>
          <p className="mt-1 text-xs text-slate-500">每次用户发起对话后，优先静默调用一次 page.inspect 并将最新视野注入任务上下文。</p>
        </div>
        <button onClick={() => handleAutoInspectChange(!autoInspect)} className={`grid h-6 w-10 shrink-0 place-items-center rounded-full transition ${autoInspect ? "bg-violet-600" : "bg-slate-200 dark:bg-white/10"}`} aria-label={`${autoInspect ? "禁用" : "启用"}首轮自动观察`}>
          <span className={`h-4 w-4 rounded-full bg-gray-100 transition ${autoInspect ? "translate-x-2" : "-translate-x-2"}`} />
        </button>
      </div>

      <div className="mt-6 space-y-5">
        {grouped.map(({ category, tools }) => <div key={category}>
          <h3 className="mb-2 text-xs font-semibold text-slate-400">{category}</h3>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-gray-100 dark:border-white/10 dark:bg-[#18181b]">
            {tools.map((tool, index) => <div key={tool.id} className={index ? 'border-t border-slate-100 dark:border-white/5' : ''}>
              <div className="flex items-center gap-3 px-4 py-3">
                <button onClick={() => setEnabled(tool.id, !config[tool.id])} className={`grid h-6 w-10 shrink-0 place-items-center rounded-full transition ${config[tool.id] ? 'bg-violet-600' : 'bg-slate-200 dark:bg-white/10'}`} aria-label={`${config[tool.id] ? '禁用' : '启用'} ${tool.id}`}><span className={`h-4 w-4 rounded-full bg-gray-100 transition ${config[tool.id] ? 'translate-x-2' : '-translate-x-2'}`} /></button>
                <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><code className="text-sm font-semibold text-slate-800 dark:text-slate-100">{tool.id}</code>{tool.mouse && <span title="该工具会驱动 Agent 鼠标"><MousePointer2 size={13} className="text-violet-500" /></span>}</div><p className="mt-1 text-xs text-slate-500">{tool.description}</p></div>
                <span className={`hidden rounded-md px-2 py-1 text-[10px] sm:inline ${tool.risk === '只读' ? 'bg-slate-100 text-slate-500 dark:bg-white/10' : 'bg-amber-50 text-amber-600 dark:bg-amber-500 dark:text-amber-300'}`}>{tool.risk}</span>
                <button onClick={() => setExpanded(expanded === tool.id ? null : tool.id)} className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10" aria-label="查看工具契约">{expanded === tool.id ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</button>
              </div>
              {expanded === tool.id && <div className="grid gap-3 border-t border-slate-100 bg-slate-50 px-4 py-3 text-xs dark:border-white/5 dark:bg-black sm:grid-cols-3"><div><p className="text-slate-400">输入</p><code className="mt-1 block text-slate-700 dark:text-slate-200">{tool.input}</code></div><div><p className="text-slate-400">返回</p><p className="mt-1 text-slate-700 dark:text-slate-200">{tool.output}</p></div><div><p className="text-slate-400">执行方式</p><p className="mt-1 flex items-center gap-1 text-slate-700 dark:text-slate-200">{tool.mouse ? <><MousePointer2 size={12} /> Agent 鼠标动作</> : <><ShieldCheck size={12} /> 受限页面观察</>}</p></div></div>}
            </div>)}
          </div>
        </div>)}
      </div>
      <div className="mt-8">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">页面组件注册</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">组件声明位置和允许的鼠标动作；页面观察会只返回当前已挂载、可见的组件及其屏幕位置。</p>
          </div>
          <span className="shrink-0 text-xs text-slate-400">{PAGE_COMPONENT_REGISTRY.length} 个组件类型</span>
        </div>
        <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-gray-100 dark:border-white/10 dark:bg-[#18181b]">
          {PAGE_COMPONENT_REGISTRY.map((component, index) => <div key={component.id} className={`grid gap-2 px-4 py-3 text-xs sm:grid-cols-[minmax(160px,0.8fr)_minmax(110px,0.5fr)_1.5fr] ${index ? 'border-t border-slate-100 dark:border-white/5' : ''}`}>
            <div><code className="font-semibold text-slate-800 dark:text-slate-100">{component.id}</code><p className="mt-1 text-slate-500">{component.label}</p></div>
            <div><p className="text-slate-400">位置</p><p className="mt-1 text-slate-600 dark:text-slate-300">{component.location}</p></div>
            <div><p className="text-slate-400">允许动作</p><p className="mt-1 break-words text-slate-600 dark:text-slate-300">{component.actions.join(' · ')}</p></div>
          </div>)}
        </div>
      </div>
      <button onClick={() => { setConfig({ ...DEFAULT_AGENT_TOOL_CONFIG }); saveAgentToolConfig({ ...DEFAULT_AGENT_TOOL_CONFIG }); }} className="mt-6 flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white"><RotateCcw size={13} />恢复全部工具</button>
    </div>
  </section>;
}
