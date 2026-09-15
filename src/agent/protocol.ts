export type AgentToolName =
  | 'guide.lookup'
  | 'page.inspect'
  | 'ui.actAndObserve'
  | 'sys.updateState'
  | 'sys.endTask'
  | 'user.ask';

export interface AgentToolCall {
  id: string;
  name: AgentToolName;
  arguments: Record<string, unknown>;
}

export interface AgentTurnResult {
  narration: string[];
  speak?: string;
  taskTitle?: string;
  goal?: string;
  progress?: string;
  failureSummaries?: string[];
  plan?: Array<{ id: string; title: string; status?: 'pending' | 'completed' }>;
  toolCalls: AgentToolCall[];
  response?: string;
  waitForUser?: string;
  complete: boolean;
  /**
   * Development-only transport record. It is intentionally kept out of the
   * next model turn's history; the runtime trace panel uses it to show the
   * exact request assembled by the server and the raw provider message.
   */
  debug?: AgentTurnDebugSnapshot;
}

export interface AgentTurnDebugSnapshot {
  request: {
    model: string;
    messages: Array<{ role: string; content: unknown }>;
    tools: unknown[];
  };
  response: {
    content: unknown;
    toolCalls: unknown[];
  };
}

export interface AgentHistoryItem {
  role: 'user' | 'agent' | 'tool';
  content: unknown;
}
