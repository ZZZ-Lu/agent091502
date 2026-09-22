import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import dotenv from "dotenv";
import { AGENT_TOOL_REGISTRY } from './src/agent/toolRegistry';
import { mcpRouter } from './src/server/mcpRouter';
dotenv.config();
const defaultPromptFilePath = path.join(process.cwd(), "src/agent/systemPrompt.txt");
const customPromptDir = path.join(process.cwd(), ".data");
const customPromptFilePath = path.join(customPromptDir, "systemPrompt.txt");

function getSystemPrompt() {
  try {
    if (fs.existsSync(customPromptFilePath)) {
      return fs.readFileSync(customPromptFilePath, "utf-8");
    }
    return fs.readFileSync(defaultPromptFilePath, "utf-8");
  } catch (e) {
    return "";
  }
}

const functionNameForTool = (toolId: string) => toolId.replaceAll('.', '_');

const parametersForTool = (toolId: string) => {
  const target = { type: 'string', description: '来自最近一次 page.inspect 的 visible components 的 targetId。' };
  const observationProperties = { scope: { type: 'string', description: 'overview 返回主要入口概览（默认，剧本正文不直接展开注入）；填可见组件 ID（如 "script.text"）申请查看该区域的可见内容。' }, offset: { type: 'integer', minimum: 0, description: '同一可见区域的返回分页偏移，不会滚动页面。' }, limit: { type: 'integer', minimum: 1, maximum: 100 } };
  const schemas: Record<string, { properties: Record<string, unknown>; required?: string[] }> = {
    'ui.actAndObserve': { properties: { targetId: target, action: { type: 'string', enum: ['mouse.move', 'mouse.click', 'mouse.doubleClick', 'mouse.longPress', 'mouse.hover', 'mouse.drag', 'mouse.scroll', 'mouse.type', 'mouse.keyPress'] }, arguments: { type: 'object', description: '鼠标动作的附加参数。例如：mouse.scroll 可传 { delta: number }（正数向下，负数向上）；mouse.type 可传 { text: string, clear?: boolean }（输入文本，clear 为 true 时先清空原有内容）；mouse.keyPress 可传 { key: string, shiftKey?: boolean }（如 key="Enter"）' }, observe: { type: 'object', properties: observationProperties } }, required: ['targetId', 'action'] },
    'page.inspect': { properties: observationProperties },
    'guide.lookup': { properties: { query: { type: 'string' } }, required: ['query'] },
    'sys.updateState': { properties: { taskTitle: { type: 'string' }, goal: { type: 'string' }, subGoal: { type: 'string' }, progress: { type: 'string' }, notes: { type: 'string' }, notesMode: { type: 'string', enum: ['append', 'overwrite'], description: '重点笔记模式：append（追加，默认）或 overwrite（重写替换现有笔记）' }, plan: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, title: { type: 'string' }, status: { type: 'string' } } } } } },
    'sys.endTask': { properties: { success: { type: 'boolean' }, finalResponse: { type: 'string' }, waitForUser: { type: 'string' } }, required: ['success', 'finalResponse'] },
    'user.ask': { properties: { question: { type: 'string' } }, required: ['question'] },
  };
  const schema = schemas[toolId] || { properties: {} };
  return { type: 'object', properties: schema.properties, ...(schema.required ? { required: schema.required } : {}) };
};

interface ModelConfig {
  endpoint: string;
  actualModel: string;
  apiKey: string;
  stream?: boolean;
  enableThinking?: boolean;
  reasoningEffort?: 'low' | 'high' | 'max';
}

function getModelConfig(modelType: string, userKey?: string): ModelConfig {
  let endpoint = 'https://api.deepseek.com/chat/completions';
  let actualModel = 'deepseek-chat';
  let apiKey = userKey || process.env.DEEPSEEK_API_KEY;
  let stream = false;
  let enableThinking = false;
  let reasoningEffort: 'low' | 'high' | 'max' = 'max';

  if (modelType === 'deepseek-v4-pro') {
    actualModel = 'deepseek-reasoner';
  } else if (modelType === 'qwen3.8-flash') {
    endpoint = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
    actualModel = 'qwen3.8-flash';
    apiKey = userKey || process.env.DASHSCOPE_API_KEY || process.env.DEEPSEEK_API_KEY;
  } else if (
    modelType.toLowerCase().includes('5.3-flash') ||
    modelType.toLowerCase().includes('glm-5.3')
  ) {
    endpoint = process.env.GLM_API_ENDPOINT || 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
    actualModel = process.env.GLM_MODEL_NAME || process.env.ZHIPU_MODEL_NAME || 'ZHIPU/GLM-5.3-Flash';
    apiKey = userKey || process.env.DASHSCOPE_API_KEY || process.env.ZHIPU_API_KEY || process.env.DEEPSEEK_API_KEY;
    stream = true;
    enableThinking = true;

    if (modelType.toLowerCase().endsWith('-low') || modelType.toLowerCase().includes('low')) {
      reasoningEffort = 'low';
    } else if (modelType.toLowerCase().endsWith('-high') || modelType.toLowerCase().includes('high')) {
      reasoningEffort = 'high';
    } else {
      reasoningEffort = 'max';
    }
  }

  if (!apiKey) throw new Error('未配置 API Key');
  return { endpoint, actualModel, apiKey, stream, enableThinking, reasoningEffort };
}

async function parseChatCompletionResponse(response: Response, isStream: boolean): Promise<{ content: string; reasoning_content?: string }> {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/event-stream') && !isStream) {
    const data = await response.json();
    const message = data.choices?.[0]?.message || {};
    return {
      content: message.content || '',
      reasoning_content: message.reasoning_content || message.reasoning || '',
    };
  }

  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text();
    try {
      const data = JSON.parse(text);
      const message = data.choices?.[0]?.message || {};
      return { content: message.content || '', reasoning_content: message.reasoning_content || '' };
    } catch {
      throw new Error('无法读取响应流内容');
    }
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let fullContent = '';
  let fullReasoning = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(':')) continue;
      if (trimmed === 'data: [DONE]') continue;
      if (trimmed.startsWith('data: ')) {
        const jsonStr = trimmed.slice(6);
        try {
          const chunk = JSON.parse(jsonStr);
          const delta = chunk.choices?.[0]?.delta;
          if (delta) {
            if (delta.content) {
              fullContent += delta.content;
            }
            if (delta.reasoning_content) {
              fullReasoning += delta.reasoning_content;
            } else if (delta.reasoning) {
              fullReasoning += delta.reasoning;
            }
          }
        } catch {
          // ignore incomplete JSON chunks
        }
      }
    }
  }

  if (buffer.trim().startsWith('data: ') && buffer.trim() !== 'data: [DONE]') {
    try {
      const chunk = JSON.parse(buffer.trim().slice(6));
      const delta = chunk.choices?.[0]?.delta;
      if (delta?.content) fullContent += delta.content;
      if (delta?.reasoning_content) fullReasoning += delta.reasoning_content;
      else if (delta?.reasoning) fullReasoning += delta.reasoning;
    } catch {}
  }

  return { content: fullContent, reasoning_content: fullReasoning };
}

// Heuristic fallback for script TOC pattern recognition
function inferPatternHeuristically(sampleText: string): { tocPattern: string; scenePattern: string; flags: string; patternDescription: string } {
  const lines = sampleText.split('\n').map(l => l.trim()).filter(Boolean);
  
  const bracketEpisodeMatch = lines.some(l => /^【\s*第?\s*[0-9一二三四五六七八九十百]+\s*[集话回].*?】/i.test(l));
  const bracketSceneMatch = lines.some(l => /^【\s*(?:场|场景|场次)?\s*[0-9一二三四五六七八九十百]+.*?】/i.test(l));
  const plainEpisodeMatch = lines.some(l => /^第\s*[0-9一二三四五六七八九十百]+\s*[集话回]/i.test(l));
  const plainSceneMatch = lines.some(l => /^第\s*[0-9一二三四五六七八九十百]+\s*[场幕]/i.test(l));
  const englishEpisodeMatch = lines.some(l => /^(?:EPISODE|EP|CHAPTER)\s*#?\s*\d+/i.test(l));
  const englishSceneMatch = lines.some(l => /^SCENE\s*#?\s*\d+/i.test(l));

  let tocPattern = "";
  let scenePattern = "";
  let patternDescription = "";

  if (bracketEpisodeMatch) {
    tocPattern = "^【\\s*第?\\s*[0-9一二三四五六七八九十百千]+\\s*[集话回][^】]*】.*";
    patternDescription += "方括号集数格式";
  } else if (plainEpisodeMatch) {
    tocPattern = "^第\\s*[0-9一二三四五六七八九十百千]+\\s*[集话回].*";
    patternDescription += "标准集数格式";
  } else if (englishEpisodeMatch) {
    tocPattern = "^(?:EPISODE|EP|CHAPTER)\\s*#?\\s*\\d+.*";
    patternDescription += "英文Episode格式";
  }

  if (bracketSceneMatch) {
    scenePattern = "^【\\s*(?:场|场景|场次)?\\s*[0-9一二三四五六七八九十百千]+[^】]*】.*";
    patternDescription += (patternDescription ? " + " : "") + "方括号场次格式";
  } else if (plainSceneMatch) {
    scenePattern = "^第\\s*[0-9一二三四五六七八九十百千]+\\s*[场幕].*";
    patternDescription += (patternDescription ? " + " : "") + "标准场次格式";
  } else if (englishSceneMatch) {
    scenePattern = "^SCENE\\s*#?\\s*\\d+.*";
    patternDescription += (patternDescription ? " + " : "") + "英文Scene格式";
  }

  // Fallbacks
  if (!scenePattern) {
    scenePattern = "^第\\s*[0-9一二三四五六七八九十百千]+\\s*场.*";
  }

  return { tocPattern, scenePattern, flags: "gim", patternDescription };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // WorkRally MCP Proxy Routes
  app.use('/api/mcp/workrally', mcpRouter);
  app.use('/api/mcp', mcpRouter);

  // API Route for AI Episode / TOC Pattern Recognition
  app.post('/api/save-prompts', express.json(), (req, res) => {
    try {
      const { prompts } = req.body;
      if (!prompts) return res.status(400).json({ error: 'Missing prompts data' });
      const promptFileContent = `import { NodePromptConfig } from '../types/script';

/**
 * 全局统一的代码级管线与节点系统 Prompt 库
 */
export const CODE_PIPELINE_PROMPTS: NodePromptConfig = ${JSON.stringify(prompts, null, 2)};
`;
      fs.writeFileSync(path.join(process.cwd(), 'src/constants/prompts.ts'), promptFileContent, 'utf-8');
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/script-toc-pattern", async (req, res) => {
    const { sampleText, systemPrompt, modelType = 'auto', apiKey, deepseekKey } = req.body;
    if (!sampleText || typeof sampleText !== "string") {
      return res.status(400).json({ error: "Missing sampleText in request body" });
    }

    try {
      if (modelType !== 'heuristic') {
        const { endpoint, actualModel, apiKey: keyToUse } = getModelConfig(modelType, apiKey || deepseekKey);
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${keyToUse}` },
          body: JSON.stringify({
            model: actualModel,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: systemPrompt || '分析剧本标题格式并返回 pattern、flags、patternDescription 的 JSON。' },
              { role: 'user', content: sampleText.slice(0, 4000) }
            ]
          })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const body = await response.json();
        const parsed = JSON.parse(body.choices?.[0]?.message?.content || '{}');
        if (parsed.scenePattern || parsed.pattern || parsed.tocPattern) {
          return res.json({ 
            ...parsed,
            confidence: 'ai' 
          });
        }
      }

    } catch (error: any) {
      console.warn("DeepSeek pattern recognition unavailable, falling back to heuristic engine:", error.message || error);
    }

    // Heuristic inference fallback when DeepSeek is unavailable or explicitly disabled.
    const fallbackResult = inferPatternHeuristically(sampleText);
    return res.json({
      tocPattern: fallbackResult.tocPattern,
      scenePattern: fallbackResult.scenePattern,
      flags: fallbackResult.flags,
      patternDescription: fallbackResult.patternDescription,
      confidence: "heuristic"
    });
  });

  // API Route for DeepSeek Generation
  app.post("/api/script/assess-change", async (req, res) => {
    try {
      const { action, affected_scene_orders, char_delta, before_snippet, after_snippet, apiKey, modelType = 'auto' } = req.body;
      const { endpoint, actualModel, apiKey: keyToUse } = getModelConfig(modelType, apiKey);

      const requestPayload = {
        model: actualModel,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: "system",
            content: '你是一个剧本版本意图判定助手。请仔细对比 before_snippet 和 after_snippet 评估修改级别(trivial/scene_edit/structural)。关键要求：summary 必须极其具体地说明改了什么内容。根据实际动作选择最贴切的句式，例如：删除操作用“删除了[某某剧情/词语]”；新增操作用“新增了[某某剧情/词语]”；替换操作用“将[原内容]改为[新内容]”。不要写“改台词”等模糊废话，也不要生硬套用替换句式。限制在15字以内。必须输出 JSON：{"scale":"trivial"|"scene_edit"|"structural", "summary":string}'
          },
          {
            role: "user",
            content: JSON.stringify({
              action,
              affected_scene_orders,
              char_delta,
              before_snippet,
              after_snippet
            })
          }
        ]
      };

      const fetchOptions: RequestInit = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${keyToUse}`,
        },
        body: JSON.stringify(requestPayload),
      };

      const response = await fetch(endpoint, fetchOptions);
      if (!response.ok) {
        throw new Error(`Model API error: HTTP ${response.status}`);
      }

      const body = await response.json();
      const resultText = body.choices?.[0]?.message?.content || '{}';
      const parsed = JSON.parse(resultText);
      
      return res.json({
        scale: parsed.scale || 'trivial',
        should_version: parsed.should_version || false,
        summary: parsed.summary || ''
      });

    } catch (error: any) {
      console.error('Assess change error:', error);
      // Fallback
      return res.json({ scale: 'trivial', should_version: false, summary: '' });
    }
  });

  app.post("/api/generate", async (req, res) => {
    try {
      const { prompt, apiKey, systemPrompt, modelType = 'auto' } = req.body;
      if (modelType === 'heuristic') return res.status(400).json({ error: '该节点不支持启发式模型。' });
      const { endpoint, actualModel, apiKey: keyToUse, stream, enableThinking, reasoningEffort } = getModelConfig(modelType, apiKey);

      const requestPayload: Record<string, unknown> = {
        model: actualModel,
        messages: [
          {
            role: "system",
            content: systemPrompt || "You are an AI assistant that generates highly descriptive image prompts based on user input. Only reply with the prompt text."
          },
          {
            role: "user",
            content: prompt
          }
        ]
      };

      if (stream) {
        requestPayload.stream = true;
      }
      if (enableThinking) {
        requestPayload.enable_thinking = true;
        requestPayload.reasoning_effort = reasoningEffort;
        requestPayload.extra_body = {
          enable_thinking: true,
          reasoning_effort: reasoningEffort,
        };
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${keyToUse}`
        },
        body: JSON.stringify(requestPayload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `API Error: ${response.status}`);
      }
      const data = await parseChatCompletionResponse(response, !!stream);
      res.json({ result: data.content });
    } catch (error: any) {
      console.error("DeepSeek API Error:", error);
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });

  app.get('/api/agent/prompt', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.json({ prompt: getSystemPrompt() });
  });

  app.post('/api/agent/prompt', express.json(), (req, res) => {
    try {
      const { prompt } = req.body;
      if (typeof prompt !== 'string') {
        return res.status(400).json({ error: 'Invalid prompt content' });
      }
      if (!fs.existsSync(customPromptDir)) {
        fs.mkdirSync(customPromptDir, { recursive: true });
      }
      fs.writeFileSync(customPromptFilePath, prompt, 'utf-8');
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/agent/turn', async (req, res) => {
    try {
      const { userMessage, history = [], events = [], observations = [], project, task, apiKey, modelType = 'deepseek-v4-flash', enabledTools, requireTool = false } = req.body;
      const { endpoint, actualModel, apiKey: keyToUse, stream, enableThinking, reasoningEffort } = getModelConfig(modelType, apiKey);
      if (!userMessage || typeof userMessage !== 'string') return res.status(400).json({ error: '缺少用户消息。' });

      const allToolIds = new Set<string>(AGENT_TOOL_REGISTRY.map((tool) => tool.id));
      const enabledToolIds = new Set(Array.isArray(enabledTools)
        ? enabledTools.filter((tool): tool is string => typeof tool === 'string' && allToolIds.has(tool))
        : AGENT_TOOL_REGISTRY.map((tool) => tool.id));
      const toolPrompt = AGENT_TOOL_REGISTRY
        .filter((tool) => enabledToolIds.has(tool.id))
        .map((tool) => `【${tool.id}】\n  描述：${tool.description}\n  支持的参数：${tool.input}\n  调用示例：{{调用 ${tool.id}，[用自然语言描述参数]}}`)
        .join('\n\n');
      const systemPrompt = getSystemPrompt().replace('{toolPrompt}', toolPrompt);

            const formatObservations = (obsList: any[]) => {
        let pageObs: string[] = [];
        let toolObs: string[] = [];

        const formatPage = (page: any) => {
          let text = `【观察结果】 (区域: ${page.scope || 'overview'})\n`;
          if (page.notices && page.notices.length) {
            text += `页面提示：${page.notices.map((n: any) => n.label).join(' | ')}\n`;
          }
          if (page.script) {
            if (page.script.directory) {
              text += `目录滚动状态：[${page.script.directory.atTop ? '已到顶' : '未到顶'} | ${page.script.directory.atBottom ? '已到底' : '未到底'}]\n`;
            }
            if (page.script.search) {
              text += `搜索替换面板：[${page.script.search.isOpen ? '已展开' : '已收起'}]`;
              if (page.script.search.isOpen) {
                text += ` | 搜索词: "${page.script.search.searchText}" | 匹配状态: ${page.script.search.matchStatus} | 替换为: "${page.script.search.replaceText}" | 区分大小写: [${page.script.search.isCaseSensitive ? '开启' : '关闭'}]`;
                if (page.script.search.feedback) {
                  text += ` | 反馈提示: "${page.script.search.feedback}"`;
                }
              }
              text += '\n';
            }
            if (page.script.text?.status === 'visible') {
              if (page.script.text.visibleText) {
                text += `\n【剧本正文可见内容（已申请查看）】\n${page.script.text.visibleText}\n【正文滚动状态：${page.script.text.scroll?.atTop ? '已到顶' : '未到顶'} | ${page.script.text.scroll?.atBottom ? '已到底' : '未到底'}】\n`;
                if (page.script.text.hint) {
                  text += `提示：${page.script.text.hint}\n`;
                }
                text += '\n';
              } else if (page.script.text.hint) {
                text += `剧本正文提示：${page.script.text.hint}\n`;
              }
            }
          }
          if (page.components && page.components.length) {
            text += `可见组件列表：\n`;
            page.components.forEach((c: any) => {
              const actions = page.actionSets && page.actionSets[c.actionSet] ? page.actionSets[c.actionSet].join(', ') : '';
              const textSnippet = (c.id !== 'script.text' && c.text) ? ` | 文本: "${String(c.text).slice(0, 100)}"` : '';
              text += `- ID: ${c.id} | ${c.label || '无标签'}${textSnippet} | 可用动作: [${actions}]\n`;
            });
          } else {
            text += `无可见组件。\n`;
          }
          if (page.pagination?.truncated) {
            text += `\n注意：当前区域内容已被截断，请向下滚动或请求 nextOffset 继续查看。\n`;
          }
          return text.trim();
        };

        if (obsList && obsList.length) {
          obsList.forEach(obs => {
            if (obs.role !== 'tool' || !obs.content) return;
            const { name, status, output, error } = obs.content;
            if (status === 'failed') {
              toolObs.push(`【执行工具 ${name} 失败】\n原因：${error || '未知'}`);
              return;
            }
            
            if (name === 'page.inspect') {
              pageObs.push(formatPage(output as any));
            } else if (name === 'ui.actAndObserve') {
              const pageText = output.page ? formatPage(output.page) : '无最新页面数据。';
              pageObs.push(`【UI交互成功】动作 ${output.action} 作用于 ${output.targetId}。\n${pageText}`);
            } else if (name === 'guide.lookup') {
              toolObs.push(`【操作指南查询结果】\n查询词：${output.query || '未提供'}\n指南内容：${output.guidance}`);
            } else {
              toolObs.push(`【工具 ${name} 执行成功】\n${typeof output === 'string' ? output : JSON.stringify(output)}`);
            }
          });
        }

        return {
          pageObservations: pageObs.length ? pageObs.join('\n\n') : '暂无页面事实，请先调用 page.inspect 观察。',
          toolResults: toolObs.length ? toolObs.join('\n\n') : '暂无。'
        };
      };

      const formatHistory = (histList: any[], eventList: any[]) => {
        let text = '';
        if (histList && histList.length) {
          const failures = histList.map(item => {
            if (item.role === 'agent' && item.content?.name === 'agent.failure_summary') return `【经验总结】${item.content.summary}`;
            if (item.role === 'tool' && item.content?.status === 'failed') return `【失败尝试】调用 ${item.content.name} 失败：${item.content.error || item.content.message}`;
            return '';
          }).filter(Boolean);
          if (failures.length) text += failures.join('\n') + '\n\n';
        }
        if (!eventList || !eventList.length) return text || '暂无。';
        const recentEvents = eventList.slice(-15);
        let currentTurn = '';
        recentEvents.forEach(ev => {
          if (ev.turnId && ev.turnId !== currentTurn) {
            currentTurn = ev.turnId;
            text += `\n[第 ${currentTurn.split(':').pop()} 轮]\n`;
          }
          if (ev.type === 'user') text += `用户指令：${ev.text}\n`;
          // 注意：思考过程（thought）不沉淀入 Agent 认知记录与历史上下文中，仅保留明确的事实和工具动作
          else if (ev.type === 'tool') {
            text += `执行动作：调用 ${ev.toolName}, 参数：${JSON.stringify(ev.input || {})}\n`;
            if (ev.status === 'succeeded') {
              if (ev.toolName === 'page.inspect') text += `执行结果：[已观察页面，详见当前最新观察]\n`;
              else if (ev.toolName === 'guide.lookup') text += `执行结果：[已查阅操作指南]\n`;
              else {
                let out = typeof ev.output === 'string' ? ev.output : JSON.stringify(ev.output || '');
                if (out.length > 200) out = out.substring(0, 200) + '...';
                text += `执行结果：${out}\n`;
              }
            } else if (ev.status === 'failed') {
              text += `执行结果：[失败] ${ev.error}\n`;
            }
          }
        });
        return text.trim() || '暂无。';
      };

      const formatPlan = (plan: any[]) => {
        if (!Array.isArray(plan) || plan.length === 0) return '暂无计划';
        return plan.map(item => `[${item.status === 'completed' ? 'x' : ' '}] ${item.title}`).join('\n');
      };

      const formattedObs = formatObservations(observations);
      
      let negotiationInjection = '';
      let displayUserMessage = userMessage;

      if (task.lastUserInputAt > task.lastGoalUpdatedAt) {
        const logs = task.negotiationLog?.map((log: any) => `[${log.role === 'user' ? '用户' : '你'}] ${log.content}`).join('\n') || '';
        negotiationInjection = `
【系统强制告警】用户刚刚补充了新的指令或回复！
以下是你们完整的对话记录：
${logs}

请注意：你目前的首要任务是提炼终极目标！
请立即调用 \`sys.updateState\` 工具，根据上述对话原文，重写全局终极目标 (goal)。在目标尚未明确更新前，绝对禁止调用任何 UI 交互操作 (ui.actAndObserve)。
`;
      } else {
        // Goal is up to date. Do not show userMessage to prevent context drift!
        displayUserMessage = '（已锁定终极目标，专注执行中，历史指令已隐藏）';
      }

      const finalPrompt = (negotiationInjection + getSystemPrompt())
        .replace('{{taskTitle}}', task.title || '尚未命名')
        .replace('{{taskGoal}}', task.goal || '尚未设定')
        .replace('{{taskSubGoal}}', task.subGoal || '暂未设定')
        .replace('{{taskProgress}}', task.progress || '刚刚开始')
        .replace('{{taskPlan}}', formatPlan(task.plan))
        .replace('{{taskNotes}}', task.notes || '暂无笔记')
        .replace('{{userMessage}}', displayUserMessage)
        .replace('{{history}}', formatHistory(history, events))
        .replace('{{toolPrompt}}', toolPrompt)
        .replace('{{pageObservations}}', formattedObs.pageObservations)
        .replace('{{toolResults}}', formattedObs.toolResults);

      const messages = [
        { role: 'user', content: finalPrompt },
      ];
      const requestPayload: Record<string, unknown> = {
        model: actualModel,
        messages,
      };

      if (stream) {
        requestPayload.stream = true;
      }
      if (enableThinking) {
        requestPayload.enable_thinking = true;
        requestPayload.reasoning_effort = reasoningEffort;
        requestPayload.extra_body = {
          enable_thinking: true,
          reasoning_effort: reasoningEffort,
        };
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${keyToUse}` },
        body: JSON.stringify(requestPayload),
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(detail?.error?.message || `HTTP ${response.status}`);
      }
      const message = await parseChatCompletionResponse(response, !!stream);
      
      const narration: string[] = [];
      let speakText = '';
      if (typeof message.content === 'string' && message.content.trim()) {
        const fullContent = message.content;
        const speakMatch = fullContent.match(/对用户说的话：([\s\S]*?)(?=\{\{|$)/);
        if (speakMatch && speakMatch[1]) {
          speakText = speakMatch[1].trim();
        }
        
        let cleanContent = fullContent.replace(/对用户说的话：[\s\S]*?(?=\{\{|$)/, '').replace(/\{\{[\s\S]*?\}\}/g, '').trim();
        cleanContent = cleanContent.replace(/<thought>[\s\S]*?<\/thought>/gi, '').trim();
        cleanContent = cleanContent.replace(/<thought>/g, '').replace(/<\/thought>/g, '').trim();
        if (cleanContent) {
          narration.push(cleanContent);
        }
      }
      
      let parsed: any = { narration, speak: speakText };
      const allowedTools = enabledToolIds;
      const toolNameByFunction = new Map(AGENT_TOOL_REGISTRY.map((tool) => [functionNameForTool(tool.id), tool.id]));
      
      const adapterToolPrompt = AGENT_TOOL_REGISTRY
        .filter((tool) => enabledToolIds.has(tool.id))
        .map((tool) => JSON.stringify({ name: tool.id, description: tool.description, parameters: parametersForTool(tool.id) }))
        .join('\n');

      let parsedToolCalls: any[] = [];
      if (typeof message.content === 'string') {
        const matches = [...message.content.matchAll(/\{\{([\s\S]*?)\}\}/g)];
        let actionDesc = matches.length > 0 ? matches.map(m => m[0]).join('\n') : null;
        
        // Fallback: if no {{ }} but text contains "调用" and a tool name, pass the whole text to the adapter
        if (!actionDesc && message.content.includes('调用')) {
          const hasKnownTool = AGENT_TOOL_REGISTRY.some(tool => 
            message.content.includes(tool.id) || message.content.includes(functionNameForTool(tool.id))
          );
          if (hasKnownTool) {
            actionDesc = message.content;
          }
        }

        if (actionDesc) {
          try {
            const parseResponse = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${keyToUse}` },
              body: JSON.stringify({
                model: actualModel === 'deepseek-reasoner' ? 'deepseek-chat' : actualModel,
                response_format: { type: 'json_object' },
                messages: [
                  { 
                    role: 'system', 
                    content: `你是一个极其精准的工具参数适配器。你的任务是将 Agent 的自然语言动作意图，严格翻译为对应工具的 JSON 调用参数。\n\n【核心转换规则】\n1. 目标识别：根据自然语言描述，推断出最合理的 targetId。\n2. 数值转化 (特别是 mouse.scroll)：严禁输出方向字符串。必须将滚动意图转换为 delta 数值（像素）。"向下滚一点/一屏" -> 正数 (如 480)；"向上滚一点/一屏" -> 负数 (如 -480)；"滚到最底部" -> 极大的正数 (如 99999)；"滚到最顶部" -> 极小的负数 (如 -99999)。\n3. 状态提取：对于 sys.updateState，准确提取对应字段（如 taskTitle, notes, notesMode 等）的文本内容。如果包含重写/替换笔记意图，提取 notesMode 为 "overwrite"；若为追加新增笔记，提取 notesMode 为 "append"。注意：绝对不要在没有明确指令的情况下脑补并写入 goal 和 subGoal。除非指令中明确说了"更新总目标"，否则不要输出 goal 字段。同理，除非明确说明，否则不要随意填写其他非必要的更新字段。\n\n可用工具的 JSON Schema：\n${adapterToolPrompt}\n\n请输出严格的 JSON 格式，格式如下：\n{ "tool_calls": [{ "name": "工具名称", "arguments": { "参数名": "参数值" } }] }` 
                  },
                  { role: 'user', content: actionDesc }
                ]
              })
            });
            if (parseResponse.ok) {
              const parseBody = await parseResponse.json();
              const parsed = JSON.parse(parseBody.choices?.[0]?.message?.content || '{}');
              if (Array.isArray(parsed.tool_calls)) {
                parsedToolCalls = parsed.tool_calls;
              }
            } else {
              console.warn('Failed to parse natural language tool call. Status:', parseResponse.status);
            }
          } catch (e) {
            console.warn('Failed to parse natural language tool call:', e);
          }
        }
      }

      const toolCalls = parsedToolCalls.flatMap((call: any, index: number) => {
        let name = call?.name;
        // fallback matching underscore names to dot names
        if (toolNameByFunction.has(name)) name = toolNameByFunction.get(name);
        
        if (!name || !allowedTools.has(name)) return [];
        try {
          const arguments_ = typeof call.arguments === 'object' ? call.arguments : JSON.parse(call.arguments || '{}');
          if (!arguments_ || typeof arguments_ !== 'object') return [];
          const id = call.id || `call_${Date.now()}_${index}`;
          return [{ id, name, arguments: arguments_ }];
        } catch { return []; }
      });

      if (requireTool && toolCalls.length === 0) {
        console.warn('Agent required a tool call but returned none:', JSON.stringify({ content: message.content }));
      }
      res.json({
        narration: Array.isArray(parsed.narration) ? parsed.narration.filter((item: unknown) => typeof item === 'string') : [],
        speak: typeof parsed.speak === 'string' ? parsed.speak : undefined,
        taskTitle: typeof parsed.taskTitle === 'string' ? parsed.taskTitle : undefined,
        goal: typeof parsed.goal === 'string' ? parsed.goal : undefined,
        progress: typeof parsed.progress === 'string' ? parsed.progress : undefined,
        failureSummaries: Array.isArray(parsed.failureSummaries) ? parsed.failureSummaries.filter((item: unknown) => typeof item === 'string' && item.trim()) : undefined,
        plan: Array.isArray(parsed.plan) ? parsed.plan.flatMap((item: any) => item && typeof item.id === 'string' && typeof item.title === 'string'
          ? [{ id: item.id, title: item.title, status: item.status === 'completed' ? 'completed' : 'pending' }]
          : []) : undefined,
        toolCalls,
        response: typeof parsed.response === 'string' ? parsed.response : undefined,
        waitForUser: typeof parsed.waitForUser === 'string' ? parsed.waitForUser : undefined,
        complete: toolCalls.length === 0 && parsed.complete === true,
        // This is a local development endpoint. The browser debugging panel
        // receives the assembled model request and raw provider response, but
        // never API credentials.
        debug: {
          request: {
            model: actualModel,
            messages,
          },
          response: {
            content: message.content ?? null,
            toolCalls: parsedToolCalls,
          },
        },
      });
    } catch (error: any) {
      console.error('Agent turn error:', error);
      res.status(500).json({ error: error.message || 'Agent turn failed' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
