import type { AgentToolName } from './protocol';

export type ToolCategory = '页面观察' | '页面交互' | '操作知识' | '系统控制';

export type ToolRisk = '只读' | '交互动作' | '内部状态';

export interface AgentToolDefinition {
  id: AgentToolName;
  category: ToolCategory;
  description: string;
  input: string;
  output: string;
  mouse: boolean;
  risk: ToolRisk;
}

export const AGENT_TOOL_REGISTRY: AgentToolDefinition[] = [
  { id: 'guide.lookup', category: '操作知识', description: '查询应用的操作说明；只说明如何通过界面查找信息，不提供当前项目隐藏数据。', input: '{ query }', output: '操作路径与注意事项', mouse: false, risk: '只读' },
  { id: 'page.inspect', category: '页面观察', description: '默认返回页面入口概览，正文不直接展开注入；指定 scope 为可见组件 ID（如 script.text）时申请查看该区域的可见内容。动作集合去重，不返回坐标或隐藏数据；分页截断明确提示。', input: '{ scope?: "overview" | 组件ID, offset?: number, limit?: number }', output: '区域可见事实、组件、动作集合、分页及页面提示', mouse: false, risk: '只读' },
  { id: 'ui.actAndObserve', category: '页面交互', description: '在最近一次页面观察中出现的目标上执行一项鼠标动作，并返回动作后新的可见页面事实。', input: '{ targetId: string, action: string, arguments?: { delta?: number, text?: string } }', output: '动作状态与最新可见页面事实', mouse: true, risk: '交互动作' },
  { id: 'sys.updateState', category: '系统控制', description: '统一认知管理中枢：更新总目标、当前小目标等，并管理重点笔记。【重点笔记使用方法】：着重记录两点：1. 任务信息（如跨步骤需要的核心业务数据、角色设定、线索等）；2. 操作方法（如查询到的复杂页面操作路径、特定交互注意事项等）。使用 notesMode="append" 追加新笔记，"overwrite" 完全重写。注意：绝对不要记录“我点击了按钮”、“面板已打开”这种无价值的短期操作流水日志！', input: '{ taskTitle?: string, goal?: string, subGoal?: string, progress?: string, notes?: string, notesMode?: "append" | "overwrite", plan?: Array<{id, title, status}> }', output: '状态已更新', mouse: false, risk: '内部状态' },
  { id: 'sys.endTask', category: '系统控制', description: '当任务成功完成、无法推进或需要等待用户进一步输入时结束当前任务循环。', input: '{ success: boolean, finalResponse: string, waitForUser?: string }', output: '任务已结束', mouse: false, risk: '内部状态' },
  { id: 'user.ask', category: '系统控制', description: '向用户主动提问，请求用户输入必要信息或进行确认。调用后任务会暂停，等待用户回复。', input: '{ question: string }', output: '用户的回复', mouse: false, risk: '内部状态' },
];

export type AgentToolConfig = Record<AgentToolName, boolean>;

export const DEFAULT_AGENT_TOOL_CONFIG: AgentToolConfig = Object.fromEntries(
  AGENT_TOOL_REGISTRY.map((tool) => [tool.id, true]),
) as AgentToolConfig;

export const getAgentToolConfig = (): AgentToolConfig => {
  try {
    const saved = localStorage.getItem('agent_tool_config');
    return { ...DEFAULT_AGENT_TOOL_CONFIG, ...(saved ? JSON.parse(saved) : {}) };
  } catch {
    return { ...DEFAULT_AGENT_TOOL_CONFIG };
  }
};

export const saveAgentToolConfig = (config: AgentToolConfig) => {
  localStorage.setItem('agent_tool_config', JSON.stringify(config));
};
