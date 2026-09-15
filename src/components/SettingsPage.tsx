import React, { useEffect, useMemo, useState } from 'react';
import {
  Braces,
  Database,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  Code2,
  Copy,
  FileInput,
  KeyRound,
  ListTree,
  LoaderCircle,
  Play,
  RotateCcw,
  ScrollText,
  TerminalSquare,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { AgentArchitecturePanel } from './AgentArchitecturePanel';
import { ToolManagementPanel } from './ToolManagementPanel';
import { AgentRuntimeTracePanel } from './AgentRuntimeTracePanel';
import { PromptEditorPanel } from './PromptEditorPanel';
import type { AgentRuntimeTrace } from '../agent/debugTrace';
import {
  DEFAULT_NODE_MODELS,
  DEFAULT_NODE_PROMPTS,
  ExtractionModelType,
  NodeModelConfig,
  NodePromptConfig,
  ScriptCharacter,
  ScriptLocation,
  ScriptProject,
  ScriptProp,
} from '../types/script';
import { assetExtractionService } from '../services/assetExtractionService';

interface SettingsPageProps {
  onClose: () => void;
  currentProject?: ScriptProject;
  onUpdateProject?: (updated: ScriptProject) => void;
  agentRuntimeTraces?: AgentRuntimeTrace[];
}

type NodeKey = 'toc_infer' | 'data_viewer' | 'change_assess';
type ResultTab = 'json' | 'logs';
type CenterTab = 'source' | 'input' | 'prompt' | 'payload';
type SettingsSection = 'debug' | 'runtime' | 'architecture' | 'tools' | 'prompt';

interface NodeDefinition {
  key: NodeKey;
  name: string;
  shortName: string;
  description: string;
  promptKey?: keyof NodePromptConfig;
  modelKey?: keyof NodeModelConfig;
}

const SAMPLE_SCRIPT = `【第 1 场】夜雨·龙门古客栈·内景·雨夜
窗外暴雨倾盆，雷电骤亮，照亮客栈内斑驳的木梁。
林墨（24岁，锦衣卫总旗，身着玄色飞鱼服，腰佩绣春刀）静坐于角落独饮。
掌柜赵老栓提着青铜酒壶上前添酒。

【第 2 场】龙门客栈外官道·外景·深夜
三名黑衣刺客策马疾驰而至，领头者背负雕花机括暗弩。

【第 3 场】龙门客栈大堂·内景·深夜
刺客破门而入。林墨腰间绣春刀骤然出鞘，客栈桌椅碎裂飞散。`;

const NODE_DEFINITIONS: NodeDefinition[] = [
  {
    key: 'toc_infer',
    name: '目录场次识别节点',
    shortName: 'Parser',
    description: '推断集数与场次标题规则',
    promptKey: 'tocInferSystemPrompt',
    modelKey: 'tocInferModel',
  },
  {
    key: 'change_assess',
    name: '改动意图提取节点',
    shortName: 'Assessor',
    description: '分析用户的删改操作并提取意图',
    promptKey: 'changeAssessSystemPrompt',
    modelKey: 'changeAssessModel',
  },
  {
    key: 'data_viewer',
    name: '项目数据看板',
    shortName: 'Data Viewer',
    description: '查看当前项目的结构化提取数据 (切片产物)',
  }
];

const MODEL_ROUTE_DEFINITIONS: NodeDefinition[] = [
  {
    key: 'toc_infer',
    name: 'Mira 核心 Agent',
    shortName: 'Agent',
    description: '唯一自主循环节点，负责理解任务、申请上下文并调用工具',
    modelKey: 'agentModel',
  },
  ...NODE_DEFINITIONS.filter((node) => node.modelKey),
];

const MODEL_OPTIONS: Array<{ value: ExtractionModelType; label: string }> = [
  { value: 'auto', label: '自动' },
  { value: 'deepseek-v4-flash', label: 'V4 Flash' },
  { value: 'deepseek-v4-pro', label: 'V4 Pro' },
  { value: 'deepseek-v4.1-flash-expires-on-0910', label: 'V4.1 Flash (0910)' },
  { value: 'qwen3.8-flash', label: 'Qwen 3.8 Flash' },
  { value: 'ZHIPU/GLM-5.3-Flash-low', label: 'GLM-5.3-Flash (Low 思考)' },
  { value: 'ZHIPU/GLM-5.3-Flash-high', label: 'GLM-5.3-Flash (High 思考)' },
  { value: 'ZHIPU/GLM-5.3-Flash-max', label: 'GLM-5.3-Flash (Max 思考)' },
  { value: 'heuristic', label: '启发式' },
];

const inputForNode = (node: NodeKey, project?: ScriptProject) => {
  const projectScript = project?.scriptText?.trim();
  return projectScript || SAMPLE_SCRIPT;
};

const safeJson = (value: unknown) => JSON.stringify(value, null, 2);
const formatModelInput = (systemPrompt: string, userPrompt: string) =>
  `[SYSTEM]\n${systemPrompt}\n\n[USER]\n${userPrompt}`;
const parseModelInput = (value: string) => {
  const marker = '\n\n[USER]\n';
  if (value.startsWith('[SYSTEM]\n') && value.includes(marker)) {
    const [systemPrompt, userPrompt] = value.slice('[SYSTEM]\n'.length).split(marker, 2);
    return { systemPrompt, userPrompt };
  }
  return { systemPrompt: null, userPrompt: value };
};

export const SettingsPage: React.FC<SettingsPageProps> = ({ onClose, currentProject, onUpdateProject, agentRuntimeTraces = [] }) => {
  const [selectedNode, setSelectedNode] = useState<NodeKey>('toc_infer');
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('debug');
  const [centerTab, setCenterTab] = useState<CenterTab>('input');
  const [resultTab, setResultTab] = useState<ResultTab>('json');
  const [nodePrompts, setNodePrompts] = useState<NodePromptConfig>(() => ({ ...DEFAULT_NODE_PROMPTS }));

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
        // FORCE sync the local memory constant so that subsequent component remounts
        // (like closing and reopening the settings page, or creating a new project)
        // don't revert to the stale memory state from before the save.
        Object.assign(DEFAULT_NODE_PROMPTS, nodePrompts);
      } else {
        alert('保存失败，请查看控制台');
      }
    } catch (e) {
      console.error(e);
      alert('保存失败');
    } finally {
      setIsSavingPrompt(false);
    }
  };
  const [nodeInputs, setNodeInputs] = useState<Record<NodeKey, string>>(() => ({
    toc_infer: inputForNode('toc_infer', currentProject),
    change_assess: JSON.stringify({
      action: 'type',
      affected_scene_orders: ['第一场'],
      char_delta: 5,
      before_snippet: '这是修改前的内容',
      after_snippet: '这是修改后的内容，增加了几句话'
    }, null, 2),
    data_viewer: '',
  }));
  const [completeInputEdits, setCompleteInputEdits] = useState<Partial<Record<NodeKey, string>>>({});
  const [nodeModels, setNodeModels] = useState<NodeModelConfig>(() => assetExtractionService.getNodeModels());
  const [deepseekKey, setDeepseekKey] = useState(() => localStorage.getItem('deepseek_api_key') || '');
  const [qwenKey, setQwenKey] = useState(() => localStorage.getItem('qwen_api_key') || localStorage.getItem('glm_api_key') || '');
  const [showKeys, setShowKeys] = useState(false);
  const [showModels, setShowModels] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{ state: 'testing' | 'success' | 'error'; message: string } | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [nodeResults, setNodeResults] = useState<Partial<Record<NodeKey, any>>>({});
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [applied, setApplied] = useState(false);

  const activeDefinition = useMemo(
    () => NODE_DEFINITIONS.find((node) => node.key === selectedNode) || NODE_DEFINITIONS[0],
    [selectedNode]
  );
  const activePromptKey = activeDefinition.promptKey;
  const input = nodeInputs[selectedNode];
  const activeModel = activeDefinition.modelKey ? nodeModels[activeDefinition.modelKey] : 'auto';
  const result = nodeResults[selectedNode] || null;
  const setResult = (nextResult: any) => {
    setNodeResults((current) => ({ ...current, [selectedNode]: nextResult }));
  };

  const fullPipelinePrompt = useMemo(() => [
    ['NODE 1 · 场次切片', nodePrompts.node1Instruction],
    ['NODE 2 · 实体提取', nodePrompts.node2SystemPrompt],
    ['NODE 3 · 实体归一', nodePrompts.node3ResolutionRules],
  ].map(([title, prompt]) => `# ${title}\n\n${prompt}`).join('\n\n────────────────────────\n\n'), [nodePrompts]);

  const activePrompt = activePromptKey ? nodePrompts[activePromptKey] : fullPipelinePrompt;
  const completeInputPreview = useMemo(() => {
    if (selectedNode === 'full') {
      return `[PIPELINE INPUT]\n${input}\n\n[ROUTING]\nNode 1 → ${nodeModels.node1Model}\nNode 2 → ${nodeModels.node2Model}\nNode 3 → ${nodeModels.node3Model}`;
    }
    if (selectedNode === 'node2') {
      return formatModelInput(activePrompt, '<Node 1 运行后生成的完整 scenes 文本>');
    }
    if (selectedNode === 'node3') {
      return `[RULES]\n${activePrompt}\n\n[RAW ENTITIES]\n<Node 2 运行后的完整实体 JSON>\n\n[SCENES]\n<Node 1 运行后的完整场次 JSON>`;
    }
    return formatModelInput(activePrompt, input);
  }, [activePrompt, input, nodeModels, selectedNode]);
  const completeInput = completeInputEdits[selectedNode] ?? result?.requestInput ?? completeInputPreview;
  const payloadPreview = useMemo(() => ({
    node: selectedNode,
    model: selectedNode === 'full' ? nodeModels : activeModel,
    input: selectedNode === 'node2'
      ? { scenes: '<Node 1 输出>', sourceText: input }
      : selectedNode === 'node3'
        ? { rawEntities: '<Node 2 输出>', scenes: '<Node 1 输出>', sourceText: input }
        : { text: input },
    systemPrompt: activePrompt,
    credentials: {
      deepseek: deepseekKey ? '<configured>' : '<missing>',
      qwen_glm: qwenKey ? '<configured>' : '<missing>',
    },
  }), [activeModel, activePrompt, deepseekKey, qwenKey, input, nodeModels, selectedNode]);

  useEffect(() => {
    try {
      const lastResultStr = localStorage.getItem(`last_${selectedNode}_result`);
      const logsStr = localStorage.getItem(`${selectedNode}_logs`);
      const rawInputStr = localStorage.getItem(`last_${selectedNode}_raw_input`);
      const requestStr = localStorage.getItem(`last_${selectedNode}_request`);
      
      let data = null;
      if (lastResultStr) {
        try { data = JSON.parse(lastResultStr); } catch {}
      }
      
      let logs: string[] = [];
      if (logsStr) {
        try { logs = JSON.parse(logsStr); } catch {}
      }
      
      if (data || logs.length > 0) {
        setNodeResults(current => {
          if (current[selectedNode]) return current; // Don't override if already ran in this session
          return {
            ...current,
            [selectedNode]: {
              data: data || {},
              logs: logs,
              requestInput: requestStr || undefined,
              metrics: {}
            }
          };
        });
        
        if (rawInputStr) {
           setNodeInputs(current => {
              if (current[selectedNode] === rawInputStr) return current;
              return {
                 ...current,
                 [selectedNode]: rawInputStr
              };
           });
        }
      }
    } catch (e) {}
  }, [selectedNode]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        void runNode();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const updateInput = (value: string) => {
    setNodeInputs((current) => ({ ...current, [selectedNode]: value }));
  };

  const updatePrompt = (value: string) => {
    if (!activePromptKey) return;
    setNodePrompts((current) => ({ ...current, [activePromptKey]: value }));
    setHasUnsavedPrompts(true);
  };

  const updateCompleteInput = (value: string) => {
    setCompleteInputEdits((current) => ({ ...current, [selectedNode]: value }));
    const parsed = parseModelInput(value);
    setNodeInputs((current) => ({ ...current, [selectedNode]: parsed.userPrompt }));
    if (activePromptKey && parsed.systemPrompt !== null) {
      setNodePrompts((current) => ({ ...current, [activePromptKey]: parsed.systemPrompt! }));
    }
  };

  const resetPrompt = () => {
    if (!activePromptKey) return;
    setNodePrompts(current => ({ ...current, [activePromptKey]: DEFAULT_NODE_PROMPTS[activePromptKey] }));
    setHasUnsavedPrompts(true); // Must manually save after resetting in UI
  };

  const saveCredentials = () => {
    localStorage.setItem('deepseek_api_key', deepseekKey);
    localStorage.setItem('qwen_api_key', qwenKey);
    localStorage.setItem('glm_api_key', qwenKey);
    setShowKeys(false);
  };

  const isDashscopeOrGlm = (model?: string) =>
    Boolean(model && (model.startsWith('qwen') || model.includes('glm') || model.includes('ZHIPU') || model.includes('zhipu')));

  const testConnection = async () => {
    setConnectionStatus({ state: 'testing', message: '正在测试连接…' });
    try {
      const activeModel = nodeModels.agentModel || 'deepseek-v4-flash';
      const keyToTest = isDashscopeOrGlm(activeModel) ? qwenKey : deepseekKey;
      const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: '只回复 OK', modelType: activeModel, apiKey: keyToTest }),
          });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${response.status}`);
      }
      setConnectionStatus({ state: 'success', message: '连接正常' });
    } catch (caught: any) {
      setConnectionStatus({ state: 'error', message: caught?.message || '连接失败' });
    }
  };

  const changeNodeModel = (modelKey: keyof NodeModelConfig, model: ExtractionModelType) => {
    const updated = { ...nodeModels, [modelKey]: model };
    setNodeModels(updated);
    assetExtractionService.saveNodeModels(updated);
  };

  const setAllNodeModels = (model: ExtractionModelType) => {
    const updated: NodeModelConfig = {
      agentModel: model,
      tocInferModel: model,
      changeAssessModel: model,
    };
    setNodeModels(updated);
    assetExtractionService.saveNodeModels(updated);
  };

  const resetNodeModels = () => {
    const updated = { ...DEFAULT_NODE_MODELS };
    setNodeModels(updated);
    assetExtractionService.saveNodeModels(updated);
  };

  const runNode = async () => {
    if (!input.trim() || isRunning) return;
    setIsRunning(true);
    setError(null);
    setResult(null);
    setCompleteInputEdits((current) => ({ ...current, [selectedNode]: undefined }));
    setApplied(false);

    const options = {
      modelType: activeModel,
      nodeModels,
      deepseekKey,
      qwenKey,
      customPrompts: nodePrompts,
    };
    const startedAt = Date.now();

    try {
      let endpoint = '/api/script-toc-pattern';
      let body: any = {};
      const keyToUse = isDashscopeOrGlm(activeModel) ? qwenKey : deepseekKey;
      
      if (selectedNode === 'change_assess') {
        endpoint = '/api/script/assess-change';
        let parsedInput: any = {};
        try {
          parsedInput = JSON.parse(input);
        } catch {
          parsedInput = {
            action: 'type',
            affected_scene_orders: ['全局'],
            char_delta: 0,
            before_snippet: '',
            after_snippet: input
          };
        }
        body = {
          ...parsedInput,
          modelType: activeModel,
          apiKey: keyToUse
        };
      } else {
        body = { sampleText: input, systemPrompt: activePrompt, modelType: activeModel, apiKey: keyToUse };
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${response.status}`);
      }
      const data = await response.json();

      // Slice scenes if scenePattern exists
      if (data.scenePattern && onUpdateProject && currentProject) {
        import('../utils/slicer').then(({ sliceScriptIntoScenes }) => {
          const newScenes = sliceScriptIntoScenes(currentProject.scriptText, data.scenePattern, data.flags || 'gim');
          onUpdateProject({ scenes: newScenes });
        }).catch(console.error);
      }

      const newLogs = [`[${activeDefinition.shortName}] 请求完成`, `[${activeDefinition.shortName}] 输出已解析`];

      try {
        localStorage.setItem(`last_${selectedNode}_result`, JSON.stringify(data, null, 2));
        const timestamp = new Date().toLocaleTimeString();
        const logLine = `[${timestamp}] 手动执行 (${Date.now() - startedAt}ms) => ${JSON.stringify(data)}`;
        let existingLogs = [];
        try { existingLogs = JSON.parse(localStorage.getItem(`${selectedNode}_logs`) || '[]'); } catch {}
        existingLogs.unshift(logLine);
        if (existingLogs.length > 50) existingLogs = existingLogs.slice(0, 50);
        localStorage.setItem(`${selectedNode}_logs`, JSON.stringify(existingLogs));
        newLogs.push(...existingLogs); // Show history in UI
      } catch (e) {}

      setResult({
        data,
        requestInput: formatModelInput(activePrompt, input),
        logs: newLogs,
        metrics: { totalDurationMs: Date.now() - startedAt, modelUsed: activeModel },
      });
      setResultTab('json');
    } catch (caught: any) {
      setError(caught?.message || '节点执行失败');
    } finally {
      setIsRunning(false);
    }
  };

  const applyToProject = () => {
    if (!currentProject || !onUpdateProject || !result) return;
    const characters: ScriptCharacter[] = result.characters || [];
    const locations: ScriptLocation[] = result.locations || [];
    const props: ScriptProp[] = result.props || [];
    onUpdateProject({
      ...currentProject,
      characters: characters.length ? characters : currentProject.characters,
      locations: locations.length ? locations : currentProject.locations,
      props: props.length ? props : currentProject.props,
      scenes: result.scenes?.length ? result.scenes : currentProject.scenes,
      updatedAt: Date.now(),
    });
    setApplied(true);
  };

  const copyResult = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(safeJson(result.data));
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const outputText = resultTab === 'logs'
    ? (result?.logs || []).join('\n')
    : result
      ? safeJson(result.data)
      : '';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      data-prevent-canvas-wheel="true"
      onWheel={(event) => event.stopPropagation()}
      className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-[#f7f7f8] text-slate-900 dark:bg-[#0d0d0f] dark:text-slate-100"
    >
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-gray-100 px-4 dark:border-white/10 dark:bg-[#151517]">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-violet-600 text-white"><ListTree size={16} /></div>
        <div className="min-w-0">
          <h1 className="text-sm font-semibold">节点调试台</h1>
          <p className="truncate text-[11px] text-slate-400">{currentProject?.name || '未命名项目'} · Prompt 来自代码，页面修改仅当前会话有效</p>
        </div>
        <nav className="ml-3 flex h-8 items-center rounded-lg bg-slate-100 p-0.5 dark:bg-white/[.06]" aria-label="设置页面">
          <button onClick={() => setSettingsSection('debug')} className={`h-7 rounded-md px-3 text-xs transition ${settingsSection === 'debug' ? 'bg-gray-100 font-medium text-slate-900 shadow-sm dark:bg-white/10 dark:text-white' : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>节点调试</button>
          <button onClick={() => setSettingsSection('runtime')} className={`h-7 rounded-md px-3 text-xs transition ${settingsSection === 'runtime' ? 'bg-gray-100 font-medium text-slate-900 shadow-sm dark:bg-white/10 dark:text-white' : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>运行追踪</button>
          <button onClick={() => setSettingsSection('tools')} className={`h-7 rounded-md px-3 text-xs transition ${settingsSection === 'tools' ? 'bg-gray-100 font-medium text-slate-900 shadow-sm dark:bg-white/10 dark:text-white' : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>工具管理</button>
          <button onClick={() => setSettingsSection('architecture')} className={`h-7 rounded-md px-3 text-xs transition ${settingsSection === 'architecture' ? 'bg-gray-100 font-medium text-slate-900 shadow-sm dark:bg-white/10 dark:text-white' : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>Agent 架构</button>
          <button onClick={() => setSettingsSection('prompt')} className={`h-7 rounded-md px-3 text-xs transition ${settingsSection === 'prompt' ? 'bg-gray-100 font-medium text-slate-900 shadow-sm dark:bg-white/10 dark:text-white' : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>主循环 Prompt</button>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {settingsSection === 'debug' && <select
            value={activeModel}
            onChange={(event) => activeDefinition.modelKey && changeNodeModel(activeDefinition.modelKey, event.target.value as ExtractionModelType)}
            disabled={!activeDefinition.modelKey}
            className="h-8 rounded-lg border border-slate-200 bg-gray-100 px-2 text-xs outline-none dark:border-white/10 dark:bg-white/10 dark:text-white dark:[&_option]:bg-neutral-900"
            aria-label="当前节点模型"
          >
            {!activeDefinition.modelKey && <option value="auto">按节点路由</option>}
            {MODEL_OPTIONS.map((model) => <option key={model.value} value={model.value}>{model.label}</option>)}
          </select>}
          {settingsSection === 'debug' && <button onClick={() => setShowModels(true)} className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/10"><Braces size={13} />模型路由</button>}
          {settingsSection === 'debug' && <button onClick={() => setShowKeys(true)} className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/10"><KeyRound size={13} />连接</button>}
          {settingsSection === 'debug' && <button
            onClick={() => void runNode()}
            disabled={isRunning || !input.trim()}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-violet-600 px-4 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {isRunning ? <LoaderCircle size={13} className="animate-spin" /> : <Play size={13} fill="currentColor" />}
            {isRunning ? '运行中' : '运行节点'}
            <span className="ml-1 text-[10px] text-white/60">⌘↵</span>
          </button>}
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white" aria-label="关闭调试台"><X size={17} /></button>
        </div>
      </header>

      <main className={settingsSection === 'debug' ? 'grid min-h-0 flex-1 grid-cols-[220px_minmax(360px,0.95fr)_minmax(420px,1.25fr)]' : 'flex min-h-0 flex-1'}>
        {settingsSection === 'architecture' ? <AgentArchitecturePanel /> : settingsSection === 'prompt' ? <PromptEditorPanel /> : settingsSection === 'tools' ? <ToolManagementPanel /> : settingsSection === 'runtime' ? <AgentRuntimeTracePanel traces={agentRuntimeTraces} /> : <>
        <aside className="overflow-y-auto border-r border-slate-200 bg-gray-100 p-3 dark:border-white/10 dark:bg-[#121214]">
          <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[.16em] text-slate-400">Nodes</p>
          <div className="space-y-1">
            {NODE_DEFINITIONS.map((node) => {
              const active = selectedNode === node.key;
              const modelLabel = node.modelKey
                ? MODEL_OPTIONS.find((model) => model.value === nodeModels[node.modelKey!])?.label
                : '3 routes';
              return (
                <button
                  key={node.key}
                  onClick={() => { setSelectedNode(node.key); setError(null); }}
                  className={`group w-full rounded-xl px-3 py-3 text-left transition ${active ? 'bg-violet-50 text-violet-700 dark:bg-violet-500 dark:text-violet-300' : 'hover:bg-slate-50 dark:hover:bg-white/10'}`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${active ? 'text-violet-500' : 'text-slate-400'}`}>{node.shortName}</span>
                    <span className="ml-auto text-[9px] text-slate-400">{modelLabel}</span>
                    <ChevronRight size={13} className={`transition ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'}`} />
                  </div>
                  <p className="mt-1 text-sm font-medium">{node.name}</p>
                  <p className="mt-1 text-[11px] leading-4 text-slate-400">{node.description}</p>
                </button>
              );
            })}
          </div>
        </aside>

        {selectedNode === 'data_viewer' ? (
          <section className="col-span-2 flex flex-col bg-[#fbfbfc] dark:bg-[#121214] p-6 overflow-hidden">
            <div className="flex items-center gap-2 mb-6">
              <Database size={18} className="text-violet-500" />
              <h2 className="text-base font-semibold">项目数据看板 (切片产物)</h2>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-4 space-y-6">
              {currentProject?.scenes && currentProject.scenes.length > 0 ? (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      总场次: <span className="text-violet-600 dark:text-violet-400 font-bold">{currentProject.scenes.length}</span>
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {currentProject.scenes.map(scene => (
                      <div key={scene.index} className="bg-gray-100 dark:bg-[#1b1b1e] border border-slate-200 dark:border-white/10 p-4 rounded-xl shadow-sm flex flex-col gap-2 transition-transform hover:-translate-y-1 hover:shadow-md">
                        <div className="flex justify-between items-start">
                          <span className="bg-violet-100 text-violet-700 dark:bg-violet-500 dark:text-violet-300 px-2 py-0.5 rounded text-[10px] font-bold">
                            场次 {scene.index}
                          </span>
                          <span className="text-slate-400 text-[10px]">{scene.type || '未设定'}</span>
                        </div>
                        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-tight">
                          {scene.title}
                        </h3>
                        {scene.locationName && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                            {scene.locationName} {scene.timeOfDay ? `· ${scene.timeOfDay}` : ''}
                          </p>
                        )}
                        {scene.characterNames && scene.characterNames.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {scene.characterNames.map(name => (
                              <span key={name} className="px-1.5 py-0.5 bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 rounded text-[10px]">
                                {name}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/5">
                          <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-3">
                            {scene.rawText}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="grid h-full place-items-center text-center text-slate-400">
                  <div>
                    <Database className="mx-auto mb-3 opacity-20" size={32} />
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-300">暂无场次数据</p>
                    <p className="mt-1 text-xs">请先运行完整管线提取数据</p>
                  </div>
                </div>
              )}
            </div>
          </section>
        ) : (
          <>
            <section className="flex min-h-0 min-w-0 flex-col border-r border-slate-200 bg-gray-100 dark:border-white/10 dark:bg-[#151517]">
          <div className="flex h-11 shrink-0 items-center border-b border-slate-200 px-3 dark:border-white/10">
            {([
              ['source', FileInput, '原始数据'],
              ['input', ScrollText, '完整输入'],
              ['prompt', Code2, 'System Prompt'],
              ['payload', Braces, 'Payload'],
            ] as const).map(([key, Icon, label]) => (
              <button
                key={key}
                onClick={() => setCenterTab(key)}
                className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs ${centerTab === key ? 'bg-slate-100 font-medium text-slate-900 dark:bg-white/10 dark:text-white' : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
              >
                <Icon size={13} />{label}
              </button>
            ))}
            {centerTab === 'prompt' && (
              <div className="ml-auto flex items-center gap-3">
                <button onClick={resetPrompt} className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-700 dark:hover:text-white"><RotateCcw size={12} />恢复代码默认</button>
                {activePromptKey && (
                  <button 
                    onClick={saveCustomPrompts} 
                    className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded transition-colors ${hasUnsavedPrompts ? 'bg-violet-500 text-white hover:bg-violet-600' : 'bg-slate-100 text-slate-400 dark:bg-white/5 dark:text-slate-500'}`}
                    disabled={!hasUnsavedPrompts || isSavingPrompt}
                  >
                    {isSavingPrompt ? '保存中...' : hasUnsavedPrompts ? '写入项目代码' : '已写入项目代码'}
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="min-h-0 flex-1 p-3">
            {centerTab === 'source' && (
              <div className="flex h-full flex-col">
                <div className="mb-2 flex items-center justify-between text-[11px] text-slate-400">
                  <span>调试源数据（运行前可编辑）</span><span>{input.length} 字符</span>
                </div>
                <textarea
                  value={input}
                  onChange={(event) => updateInput(event.target.value)}
                  spellCheck={false}
                  wrap="soft"
                  className="min-h-0 flex-1 resize-none overflow-y-auto overscroll-contain break-words whitespace-pre-wrap rounded-xl border border-slate-200 bg-[#fbfbfc] p-4 font-mono text-xs leading-6 outline-none focus:border-violet-300 dark:border-white/10 dark:bg-black dark:focus:border-violet-500/50"
                />
              </div>
            )}
            {centerTab === 'input' && (
              <div className="flex h-full flex-col">
                <div className="mb-2 flex items-center justify-between text-[11px] text-slate-400">
                  <span>{result?.requestInput ? '本次运行实际节点输入（可继续编辑）' : '运行前完整输入（可编辑）'}</span><span>{completeInput.length} 字符</span>
                </div>
                <textarea
                  value={completeInput}
                  onChange={(event) => updateCompleteInput(event.target.value)}
                  spellCheck={false}
                  wrap="soft"
                  className="min-h-0 flex-1 resize-none overflow-y-auto overscroll-contain break-words whitespace-pre-wrap rounded-xl border border-slate-200 bg-[#fbfbfc] p-4 font-mono text-xs leading-6 text-slate-700 outline-none focus:border-violet-300 dark:border-white/10 dark:bg-black dark:text-slate-300 dark:focus:border-violet-500/50"
                />
              </div>
            )}
            {centerTab === 'prompt' && (
              <div className="flex h-full flex-col">
                <div className="mb-2 flex items-center justify-between text-[11px] text-slate-400">
                  <span>{activePromptKey ? '可编辑自定义 Prompt' : '全管线 Prompt 预览'}</span>
                  {activePromptKey && (
                    <span className="rounded bg-violet-50 px-1.5 py-0.5 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300">将直接覆盖源代码</span>
                  )}
                </div>
                <textarea
                  value={activePrompt}
                  onChange={(event) => updatePrompt(event.target.value)}
                  readOnly={!activePromptKey}
                  spellCheck={false}
                  wrap="soft"
                  className="min-h-0 flex-1 resize-none overflow-y-auto overscroll-contain break-words whitespace-pre-wrap rounded-xl border border-slate-200 bg-[#fbfbfc] p-4 font-mono text-xs leading-6 outline-none focus:border-violet-300 read-only:text-slate-500 dark:border-white/10 dark:bg-black dark:focus:border-violet-500/50"
                />
              </div>
            )}
            {centerTab === 'payload' && (
              <div className="flex h-full flex-col">
                <p className="mb-2 text-[11px] text-slate-400">发送前的请求结构预览，凭证已隐藏</p>
                <pre className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap break-words [overflow-wrap:anywhere] rounded-xl border border-slate-200 bg-[#111318] p-4 font-mono text-xs leading-6 text-slate-300 dark:border-white/10">{safeJson(payloadPreview)}</pre>
              </div>
            )}
          </div>
        </section>

        <section className="flex min-h-0 min-w-0 flex-col bg-[#fbfbfc] dark:bg-[#101012]">
          <div className="flex h-11 shrink-0 items-center border-b border-slate-200 px-3 dark:border-white/10">
            <button onClick={() => setResultTab('json')} className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs ${resultTab === 'json' ? 'bg-gray-100 font-medium shadow-sm dark:bg-white/10' : 'text-slate-400'}`}><Code2 size={13} />输出 JSON</button>
            <button onClick={() => setResultTab('logs')} className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs ${resultTab === 'logs' ? 'bg-gray-100 font-medium shadow-sm dark:bg-white/10' : 'text-slate-400'}`}><TerminalSquare size={13} />日志</button>
            {result?.metrics && (
              <div className="ml-3 flex items-center gap-3 text-[10px] text-slate-400">
                <span className="flex items-center gap-1"><Clock3 size={11} />{result.metrics.totalDurationMs ?? 0} ms</span>
                <span>{result.metrics.modelUsed || activeModel}</span>
              </div>
            )}
            <div className="ml-auto flex items-center gap-2">
              {result && ['full', 'node2', 'node3'].includes(selectedNode) && onUpdateProject && (
                <button onClick={applyToProject} className="flex h-7 items-center gap-1 rounded-md border border-slate-200 px-2 text-[11px] hover:bg-gray-200 dark:border-white/10 dark:hover:bg-white/10">{applied ? <Check size={12} /> : null}{applied ? '已写入项目' : '写入项目'}</button>
              )}
              <button onClick={() => void copyResult()} disabled={!result} className="flex h-7 items-center gap-1 rounded-md border border-slate-200 px-2 text-[11px] disabled:opacity-30 dark:border-white/10">{copied ? <Check size={12} /> : <Copy size={12} />}{copied ? '已复制' : '复制'}</button>
            </div>
          </div>

          <div className="min-h-0 flex-1 p-3">
            {isRunning && (
              <div className="grid h-full place-items-center text-center text-slate-400"><div><LoaderCircle className="mx-auto mb-3 animate-spin text-violet-500" /><p className="text-sm">正在运行 {activeDefinition.name}</p><p className="mt-1 text-xs">等待节点返回输出</p></div></div>
            )}
            {!isRunning && error && (
              <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500 dark:text-red-300"><CircleAlert size={17} className="mt-0.5 shrink-0" /><div><p className="font-medium">运行失败</p><p className="mt-1 text-xs leading-5 opacity-80">{error}</p></div></div>
            )}
            {!isRunning && !error && !result && (
              <div className="grid h-full place-items-center text-center text-slate-400"><div><div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-2xl border border-slate-200 bg-gray-100 dark:border-white/10 dark:bg-white/10 dark:text-white dark:[&_option]:bg-neutral-900"><Play size={17} /></div><p className="text-sm font-medium text-slate-500 dark:text-slate-300">等待运行</p><p className="mt-1 text-xs">选择节点，检查 Prompt 和输入，然后运行</p></div></div>
            )}
            {!isRunning && result && (
              <pre className="h-full overflow-y-auto whitespace-pre-wrap break-words [overflow-wrap:anywhere] rounded-xl border border-slate-200 bg-gray-100 p-4 font-mono text-xs leading-6 text-slate-700 dark:border-white/10 dark:bg-black dark:text-slate-300">{outputText || '该节点没有返回日志。'}</pre>
            )}
          </div>
        </section>
        </>
        )}
        </>}
      </main>

      <footer className="flex h-7 shrink-0 items-center border-t border-slate-200 bg-gray-100 px-4 text-[10px] text-slate-400 dark:border-white/10 dark:bg-[#151517]">
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />调试服务就绪</span>
        <span className="ml-4">{settingsSection === 'architecture' ? '架构基线：Full Theater Mode V1' : settingsSection === 'tools' ? '工具源：src/agent/toolRegistry.ts' : settingsSection === 'runtime' ? '追踪源：AgentRuntime 与 /api/agent/turn 的真实请求' : 'Prompt 源：src/constants/prompts.ts'}</span>
        <span className="ml-auto">{settingsSection === 'debug' ? 'Ctrl/⌘ + Enter 运行 · Esc 关闭' : 'Esc 关闭'}</span>
      </footer>

      {showModels && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-slate-900/40 backdrop-blur-sm dark:bg-black/60 dark:backdrop-blur-md p-6 transition-all" onMouseDown={() => setShowModels(false)}>
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-gray-100 p-5 shadow-2xl dark:border-white/10 dark:bg-[#1b1b1e]" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-center gap-2"><Braces size={16} className="text-violet-500" /><h2 className="text-sm font-semibold">节点模型路由</h2><button onClick={() => setShowModels(false)} className="ml-auto text-slate-400"><X size={16} /></button></div>
            <p className="mt-1 text-xs text-slate-400">每个节点独立选择模型；完整管线会按以下路由依次执行。</p>
            <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-white/5 dark:border-white/10">
              {MODEL_ROUTE_DEFINITIONS.map((node) => (
                <div key={`${node.key}-${node.modelKey}`} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1"><p className="text-xs font-medium">{node.shortName} · {node.name}</p><p className="mt-0.5 truncate text-[10px] text-slate-400">{node.description}</p></div>
                  <select
                    value={nodeModels[node.modelKey!]}
                    onChange={(event) => changeNodeModel(node.modelKey!, event.target.value as ExtractionModelType)}
                    className="h-8 w-32 rounded-lg border border-slate-200 bg-transparent px-2 text-xs outline-none dark:border-white/10 dark:bg-transparent dark:text-white dark:[&_option]:bg-neutral-900"
                    aria-label={`${node.name}模型`}
                  >
                    {MODEL_OPTIONS.map((model) => <option key={model.value} value={model.value}>{model.label}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span className="text-[11px] text-slate-400">全部设为</span>
              <select onChange={(event) => setAllNodeModels(event.target.value as ExtractionModelType)} defaultValue="" className="h-8 rounded-lg border border-slate-200 bg-transparent px-2 text-xs dark:border-white/10 dark:bg-transparent dark:text-white dark:[&_option]:bg-neutral-900">
                <option value="" disabled>选择模型</option>
                {MODEL_OPTIONS.map((model) => <option key={model.value} value={model.value}>{model.label}</option>)}
              </select>
              <button onClick={resetNodeModels} className="ml-auto flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/10"><RotateCcw size={12} />恢复推荐</button>
            </div>
          </div>
        </div>
      )}

      {showKeys && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-slate-900/40 backdrop-blur-sm dark:bg-black/60 dark:backdrop-blur-md p-6 transition-all" onMouseDown={() => setShowKeys(false)}>
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-gray-100 p-5 shadow-2xl dark:border-white/10 dark:bg-[#1b1b1e]" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-center gap-2"><KeyRound size={16} className="text-violet-500" /><h2 className="text-sm font-semibold">模型连接</h2><button onClick={() => setShowKeys(false)} className="ml-auto text-slate-400"><X size={16} /></button></div>
            <p className="mt-1 text-xs text-slate-400">凭证用于本机调试请求；Prompt 不会保存到浏览器。</p>
            
            <div className="mt-5 flex items-center"><label className="text-xs font-medium">DeepSeek API Key</label></div>
            <input type="password" value={deepseekKey} onChange={(event) => setDeepseekKey(event.target.value)} placeholder="sk-..." className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-transparent px-3 text-sm outline-none focus:border-violet-400 dark:border-white/10" />

            <div className="mt-4 flex items-center"><label className="text-xs font-medium">Qwen / GLM API Key (DashScope)</label></div>
            <input type="password" value={qwenKey} onChange={(event) => setQwenKey(event.target.value)} placeholder="sk-..." className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-transparent px-3 text-sm outline-none focus:border-violet-400 dark:border-white/10" />

            <div className="mt-4 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">将测试当前选择的 Agent 模型的可用性</span>
              <button onClick={() => void testConnection()} className="text-[11px] text-violet-500 hover:text-violet-400">测试连接</button>
            </div>
            
            {connectionStatus && <p className={`mt-3 text-xs ${connectionStatus.state === 'error' ? 'text-red-500' : connectionStatus.state === 'success' ? 'text-emerald-500' : 'text-slate-400'}`}>{connectionStatus.message}</p>}
            <button onClick={saveCredentials} className="mt-5 h-9 w-full rounded-lg bg-violet-600 text-xs font-medium text-white hover:bg-violet-500">保存连接配置</button>
          </div>
        </div>
      )}
    </motion.div>
  );
};
