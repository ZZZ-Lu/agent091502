import React, { useEffect, useMemo, useState } from 'react';
import { Braces, CheckCircle2, CircleAlert, Clock3, Eye, MousePointer2, Send, TerminalSquare, Wrench } from 'lucide-react';
import type { AgentRuntimeTrace, AgentTurnTrace } from '../agent/debugTrace';
import type { RuntimeEvent } from '../agent/runtime';

interface AgentRuntimeTracePanelProps {
  traces: AgentRuntimeTrace[];
}

type DetailTab = 'prompt' | 'output' | 'tools' | 'task';

const json = (value: unknown) => JSON.stringify(value, null, 2);
const clock = (value?: number) => value ? new Date(value).toLocaleTimeString('zh-CN', { hour12: false }) : '进行中';
const duration = (turn: AgentTurnTrace) => turn.completedAt ? `${turn.completedAt - turn.startedAt} ms` : '进行中';

const statusLabel = (status: string) => ({
  planning: '规划中', waiting_tools: '等待工具', waiting_user: '等待用户', completed: '已完成', failed: '失败', cancelled: '已取消',
}[status] || status);

const eventIcon = (event: RuntimeEvent) => {
  if (event.type === 'tool') return <Wrench size={13} className="text-violet-500" />;
  if (event.type === 'answer') return <Send size={13} className="text-emerald-500" />;
  return <TerminalSquare size={13} className="text-slate-400" />;
};

export function AgentRuntimeTracePanel({ traces }: AgentRuntimeTracePanelProps) {
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [selectedTurnId, setSelectedTurnId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('prompt');
  const latestTrace = traces.at(-1);

  useEffect(() => {
    if (!selectedTraceId || !traces.some(trace => trace.id === selectedTraceId)) setSelectedTraceId(latestTrace?.id || null);
  }, [latestTrace?.id, selectedTraceId, traces]);

  const trace = traces.find(item => item.id === selectedTraceId) || latestTrace;
  const turns = trace?.turns || [];
  const latestTurn = turns.at(-1);

  useEffect(() => {
    if (!selectedTurnId || !turns.some(turn => turn.id === selectedTurnId)) setSelectedTurnId(latestTurn?.id || null);
  }, [latestTurn?.id, selectedTurnId, turns]);

  const turn = turns.find(item => item.id === selectedTurnId) || latestTurn;
  const turnEvents = useMemo(() => turn && trace
    ? trace.task.events.filter(event => event.turnId === turn.id)
    : [], [trace, turn]);

  if (!trace) {
    return (
      <section className="grid flex-1 place-items-center bg-[#fbfbfc] text-center dark:bg-[#121214]">
        <div className="max-w-sm text-slate-400">
          <TerminalSquare className="mx-auto mb-3 opacity-30" size={36} />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">尚无 Agent 运行记录</p>
          <p className="mt-1 text-xs leading-5">从画布发起一次真实任务后，这里会保留当前会话中每轮实际发送的 Prompt、模型输出、工具输入输出和页面观察。</p>
        </div>
      </section>
    );
  }

  return (
    <section className="flex min-h-0 flex-1 bg-[#fbfbfc] dark:bg-[#121214]">
      <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-gray-100 dark:border-white/10 dark:bg-[#151517]">
        <div className="border-b border-slate-200 px-4 py-4 dark:border-white/10">
          <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-violet-500">Runtime Trace</p>
          <h2 className="mt-1 text-base font-semibold">运行追踪</h2>
          <p className="mt-1 text-[11px] leading-4 text-slate-400">展示已实际运行的 Prompt、工具与页面证据；不修改注入机制。</p>
        </div>
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
          {[...traces].reverse().map(item => {
            const active = item.id === trace.id;
            return <button key={item.id} onClick={() => { setSelectedTraceId(item.id); setSelectedTurnId(null); }} className={`w-full rounded-xl px-3 py-3 text-left transition ${active ? 'bg-violet-50 text-violet-800 dark:bg-violet-500 dark:text-violet-200' : 'hover:bg-slate-50 dark:hover:bg-white/10'}`}>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400"><Clock3 size={11} />{clock(item.createdAt)}</div>
              <p className="mt-1 line-clamp-2 text-xs font-medium leading-5">{item.goal}</p>
              <p className="mt-1 text-[10px] text-slate-400">{item.turns?.length || 0} 轮 · {statusLabel(item.task.status)}</p>
            </button>;
          })}
        </div>
      </aside>

      <aside className="flex w-72 shrink-0 flex-col border-r border-slate-200 bg-gray-100 dark:border-white/10 dark:bg-[#151517]">
        <div className="border-b border-slate-200 px-4 py-3 dark:border-white/10">
          <p className="truncate text-xs font-semibold">{trace.task.title || trace.goal}</p>
          <p className="mt-1 text-[11px] text-slate-400">最终目标：{trace.goal}</p>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          {turns.map(item => {
            const active = item.id === turn?.id;
            const toolCount = item.parsedResult?.toolCalls?.length || 0;
            return <button key={item.id} onClick={() => setSelectedTurnId(item.id)} className={`w-full rounded-xl border p-3 text-left ${active ? 'border-violet-300 bg-violet-50 dark:border-violet-500/50 dark:bg-violet-500' : 'border-slate-200 bg-gray-100 hover:border-slate-300 dark:border-white/10 dark:bg-white/[.03]'}`}>
              <div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold">第 {item.turn} 轮</span><span className="text-[10px] text-slate-400">{duration(item)}</span></div>
              <p className="mt-1 text-[11px] text-slate-500">{item.requireTool ? 'Runtime 要求继续调用工具' : '正常唤醒'}</p>
              <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-400"><Wrench size={11} />{toolCount} 个工具 {item.error && <span className="text-red-500">· 请求失败</span>}</div>
            </button>;
          })}
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center gap-1 border-b border-slate-200 bg-gray-100 px-3 py-2 dark:border-white/10 dark:bg-[#151517]">
          {([
            ['prompt', Braces, '实际 Prompt'],
            ['output', Send, '模型输出'],
            ['tools', Wrench, '工具与组件'],
            ['task', CheckCircle2, '任务快照'],
          ] as const).map(([key, Icon, label]) => <button key={key} onClick={() => setDetailTab(key)} className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs ${detailTab === key ? 'bg-slate-100 font-medium text-slate-900 dark:bg-white/10 dark:text-white' : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}><Icon size={13} />{label}</button>)}
          <div className="ml-auto text-[10px] text-slate-400">{turn ? `${clock(turn.startedAt)} · ${duration(turn)}` : ''}</div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {!turn && <div className="grid h-full place-items-center text-sm text-slate-400">等待第一轮模型请求。</div>}
          {turn && detailTab === 'prompt' && <div className="space-y-4">
            <TraceNotice icon={<Eye size={15} />} title="这是服务端实际组装后发送给模型的内容" text="可据此检查 userMessage、task、history、System Prompt、工具定义分别如何进入本轮请求。API Key 已排除。" />
            {turn.transport ? (
              <JsonBlock 
                title={`模型：${turn.transport.request.model}`} 
                value={turn.transport.request.messages?.[0]?.content || turn.transport.request} 
              />
            ) : <PendingBlock />}
          </div>}
          {turn && detailTab === 'output' && <div className="space-y-4">
            <JsonBlock title="模型原始返回" value={turn.transport?.response?.content || null} />
            <JsonBlock title="服务端解析后的轮次结果" value={turn.parsedResult ? (() => { const { debug: _debug, ...parsed } = turn.parsedResult!; return parsed; })() : null} />
            {turn.error && <TraceNotice icon={<CircleAlert size={15} />} title="轮次请求失败" text={turn.error} danger />}
          </div>}
          {turn && detailTab === 'tools' && <div className="space-y-3">
            <TraceNotice icon={<MousePointer2 size={15} />} title="组件与鼠标动作的来源" text="工具输入的 targetId 来自本轮之前的 page.inspect；ui.actAndObserve 的输出会包含动作后的 page.inspect。展开记录可查看完整 JSON、可见组件坐标与页面状态。" />
            {turnEvents.length ? turnEvents.map(event => <ToolEventCard key={event.id} event={event} />) : <PendingBlock text="本轮尚未产生 Runtime 工具事件。" />}
          </div>}
          {turn && detailTab === 'task' && <div className="space-y-4">
            <JsonBlock title="本轮调用前的任务快照（实际注入 task / history 的来源）" value={turn.taskBefore} />
            <JsonBlock title="任务最新状态" value={trace.task} />
          </div>}
        </div>
      </main>
    </section>
  );
}

function TraceNotice({ icon, title, text, danger = false }: { icon: React.ReactNode; title: string; text: string; danger?: boolean }) {
  return <div className={`flex gap-2 rounded-xl border p-3 text-xs leading-5 ${danger ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500 dark:text-red-300' : 'border-violet-100 bg-violet-50 text-slate-600 dark:border-violet-500/20 dark:bg-violet-500 dark:text-slate-300'}`}><span className="mt-0.5 shrink-0 text-violet-500">{icon}</span><div><p className="font-semibold">{title}</p><p className="mt-0.5 opacity-80">{text}</p></div></div>;
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  const [copied, setCopied] = useState(false);
  const isString = typeof value === 'string';
  // If it's an object, JSON.stringify escapes \n to \\n. We unescape it here for UI readability.
  let displayValue = isString ? value : json(value);
  displayValue = displayValue.replace(/\\n/g, '\n').replace(/\\"/g, '"');
  
  const handleCopy = () => {
    navigator.clipboard.writeText(displayValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
          <h3 className="text-xs font-semibold">{title}</h3>
        </div>
        <button 
          onClick={handleCopy}
          className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
        >
          {copied ? '已复制' : '复制'}
        </button>
      </div>
      <pre className="max-h-[560px] overflow-y-auto whitespace-pre-wrap select-text break-words [overflow-wrap:anywhere] rounded-xl border border-slate-200 bg-gray-100 p-4 font-mono text-[11px] leading-5 text-slate-700 dark:border-white/10 dark:bg-black dark:text-slate-300">
        {displayValue}
      </pre>
    </section>
  );
}

function PendingBlock({ text = '本轮仍在请求模型或尚未返回可展示的调试数据。' }: { text?: string }) {
  return <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-xs text-slate-400 dark:border-white/15">{text}</div>;
}

function ToolEventCard({ event }: { event: RuntimeEvent; key?: React.Key }) {
  return <details className="rounded-xl border border-slate-200 bg-gray-100 p-3 dark:border-white/10 dark:bg-white/[.03]">
    <summary className="flex cursor-pointer list-none items-center gap-2"><span className="shrink-0">{eventIcon(event)}</span><span className="min-w-0 flex-1 truncate text-xs font-medium">{event.text}</span><span className="text-[10px] text-slate-400">{event.status || event.type}</span></summary>
    <div className="mt-3 grid gap-3 border-t border-slate-100 pt-3 dark:border-white/10">
      <p className="text-[11px] text-slate-500">{new Date(event.createdAt).toLocaleTimeString('zh-CN', { hour12: false })} · {event.toolName || event.type}</p>
      <div className="whitespace-pre-wrap select-text text-[11px] leading-5 text-slate-700 dark:text-slate-300">
        {event.text}
      </div>
      {event.input !== undefined && <JsonBlock title="工具输入" value={event.input} />}
      {event.output !== undefined && <JsonBlock title="工具输出" value={event.output} />}
      {event.error && <p className="rounded-lg bg-red-50 p-2 text-xs text-red-600 dark:bg-red-500 dark:text-red-300">{event.error}</p>}
    </div>
  </details>;
}
