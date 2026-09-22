import { Router, Request, Response } from 'express';

export const mcpRouter = Router();

const DEFAULT_MCP_URL = 'https://workrally.qq.com/zenstudio/api/mcp';

interface McpRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, any>;
}

/**
 * Execute raw JSON-RPC call to WorkRally MCP endpoint
 */
async function callMcpEndpoint(
  url: string,
  token: string,
  method: string,
  params: Record<string, any> = {}
) {
  const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
  const rpcBody: McpRpcRequest = {
    jsonrpc: '2.0',
    id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    method,
    params,
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
  };

  if (cleanToken) {
    headers['Authorization'] = `Bearer ${cleanToken}`;
  }

  const response = await fetch(url || DEFAULT_MCP_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(rpcBody),
  });

  const contentType = response.headers.get('content-type') || '';
  let responseData: any;

  if (contentType.includes('application/json')) {
    responseData = await response.json();
  } else {
    const text = await response.text();
    try {
      responseData = JSON.parse(text);
    } catch {
      responseData = { raw: text };
    }
  }

  if (!response.ok) {
    const errorMsg = responseData?.error?.message || responseData?.message || `MCP Server returned HTTP ${response.status}`;
    const err = new Error(errorMsg);
    (err as any).statusCode = response.status;
    (err as any).responseBody = responseData;
    throw err;
  }

  if (responseData.error) {
    const errorMsg = responseData.error.message || 'MCP JSON-RPC error';
    const err = new Error(errorMsg);
    (err as any).rpcError = responseData.error;
    throw err;
  }

  return responseData.result;
}

/**
 * 1. Test connection & Token validity
 */
mcpRouter.post('/test', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const token = req.body?.token || (req.headers.authorization ? req.headers.authorization.replace(/^Bearer\s+/i, '') : '');
  const serverUrl = req.body?.serverUrl || DEFAULT_MCP_URL;

  if (!token) {
    return res.status(400).json({
      success: false,
      error: '请提供 WorkRally Token',
    });
  }

  try {
    // 1. Send initialize
    let initResult: any = null;
    try {
      initResult = await callMcpEndpoint(serverUrl, token, 'initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {
          roots: { listChanged: true },
          sampling: {},
        },
        clientInfo: {
          name: 'mira-canvas-agent',
          version: '1.0.0',
        },
      });
    } catch (e: any) {
      console.warn('MCP initialize returned error (attempting tools/list directly):', e.message);
    }

    // 2. Fetch tools list
    const toolsResult = await callMcpEndpoint(serverUrl, token, 'tools/list', {});
    const tools = toolsResult?.tools || [];
    const latency = Date.now() - startTime;

    return res.json({
      success: true,
      latency,
      serverInfo: initResult?.serverInfo || { name: 'WorkRally MCP' },
      toolsCount: tools.length,
      tools: tools.map((t: any) => ({
        name: t.name,
        description: t.description || '',
        inputSchema: t.inputSchema || {},
      })),
    });
  } catch (error: any) {
    const latency = Date.now() - startTime;
    console.error('WorkRally MCP test failed:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      latency,
      error: error.message || '连接 MCP 服务失败',
      details: error.rpcError || error.responseBody,
    });
  }
});

/**
 * 2. Fetch available tools list
 */
mcpRouter.post('/tools', async (req: Request, res: Response) => {
  const token = req.body?.token || (req.headers.authorization ? req.headers.authorization.replace(/^Bearer\s+/i, '') : '');
  const serverUrl = req.body?.serverUrl || DEFAULT_MCP_URL;

  if (!token) {
    return res.status(400).json({ error: 'Missing token' });
  }

  try {
    const result = await callMcpEndpoint(serverUrl, token, 'tools/list', {});
    res.json(result);
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      error: error.message || 'Failed to list tools',
      details: error.rpcError || error.responseBody,
    });
  }
});

/**
 * 3. Direct tools/call pass-through
 */
mcpRouter.post('/call', async (req: Request, res: Response) => {
  const token = req.body?.token || (req.headers.authorization ? req.headers.authorization.replace(/^Bearer\s+/i, '') : '');
  const serverUrl = req.body?.serverUrl || DEFAULT_MCP_URL;
  const { name, arguments: args } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Missing token' });
  }
  if (!name) {
    return res.status(400).json({ error: 'Missing tool name' });
  }

  try {
    const result = await callMcpEndpoint(serverUrl, token, 'tools/call', {
      name,
      arguments: args || {},
    });
    res.json(result);
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      error: error.message || 'Tool call failed',
      details: error.rpcError || error.responseBody,
    });
  }
});

/**
 * 4. High-level generate endpoint (Image / Video) with intelligent tool matching
 */
mcpRouter.post('/generate', async (req: Request, res: Response) => {
  const token = req.body?.token || (req.headers.authorization ? req.headers.authorization.replace(/^Bearer\s+/i, '') : '');
  const serverUrl = req.body?.serverUrl || DEFAULT_MCP_URL;
  const {
    prompt,
    ratio = '16:9',
    res: resolution = '2K',
    isVideo = false,
    referenceImages = [],
  } = req.body;

  if (!token) {
    return res.status(400).json({
      success: false,
      error: '请先在页面右上角填入 WorkRally MCP 密钥',
    });
  }

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({
      success: false,
      error: '提示词不能为空',
    });
  }

  try {
    // 1. Discover available tools
    const toolsResult = await callMcpEndpoint(serverUrl, token, 'tools/list', {});
    const tools: Array<{ name: string; description: string; inputSchema: any }> = toolsResult?.tools || [];

    // 2. Determine best matching tool
    let targetTool = tools.find(t => {
      const name = t.name.toLowerCase();
      if (isVideo) {
        return name.includes('video') || name.includes('t2v') || name.includes('i2v');
      } else {
        return name.includes('image') || name.includes('t2i') || name.includes('txt2img') || name.includes('draw') || name.includes('paint');
      }
    });

    // Fallback if no specific video/image keyword matched
    if (!targetTool && tools.length > 0) {
      targetTool = tools[0];
    }

    if (!targetTool) {
      throw new Error(`MCP 服务中未找到可用的${isVideo ? '生视频' : '生图'}工具。请检查 MCP 服务器注册的工具列表。`);
    }

    // 3. Assemble arguments according to the tool's schema
    const schemaProps = targetTool.inputSchema?.properties || {};
    const args: Record<string, any> = {};

    // Map prompt
    if ('prompt' in schemaProps) args.prompt = prompt;
    else if ('text' in schemaProps) args.text = prompt;
    else if ('query' in schemaProps) args.query = prompt;
    else args.prompt = prompt;

    // Map ratio
    if ('ratio' in schemaProps || 'aspect_ratio' in schemaProps || 'aspectRatio' in schemaProps) {
      const key = ('ratio' in schemaProps) ? 'ratio' : ('aspect_ratio' in schemaProps ? 'aspect_ratio' : 'aspectRatio');
      args[key] = ratio;
    }

    // Map resolution
    if ('resolution' in schemaProps || 'res' in schemaProps || 'size' in schemaProps) {
      const key = ('resolution' in schemaProps) ? 'resolution' : ('res' in schemaProps ? 'res' : 'size');
      args[key] = resolution;
    }

    // Map reference images if any
    if (Array.isArray(referenceImages) && referenceImages.length > 0) {
      const refUrls = referenceImages.map((r: any) => (typeof r === 'string' ? r : r.url || r.dataUrl)).filter(Boolean);
      if ('reference_images' in schemaProps) args.reference_images = refUrls;
      else if ('referenceImages' in schemaProps) args.referenceImages = refUrls;
      else if ('images' in schemaProps) args.images = refUrls;
      else if ('image_url' in schemaProps && refUrls.length > 0) args.image_url = refUrls[0];
      else if ('imageUrl' in schemaProps && refUrls.length > 0) args.imageUrl = refUrls[0];
      else if ('image' in schemaProps && refUrls.length > 0) args.image = refUrls[0];
    }

    console.log(`[MCP] Calling ${targetTool.name} with arguments:`, JSON.stringify(args));

    // 4. Call MCP tool
    const callResult = await callMcpEndpoint(serverUrl, token, 'tools/call', {
      name: targetTool.name,
      arguments: args,
    });

    // 5. Parse output from MCP standard content format
    // MCP tool call returns: { content: [{ type: "text"|"image"|"resource", text?: string, data?: string, mimeType?: string }], isError?: boolean }
    let generatedMediaUrl = '';
    let generatedText = '';

    if (callResult?.content && Array.isArray(callResult.content)) {
      for (const item of callResult.content) {
        if (item.type === 'image' && item.data) {
          const mime = item.mimeType || 'image/png';
          generatedMediaUrl = `data:${mime};base64,${item.data}`;
          break;
        } else if (item.type === 'resource' && item.resource?.uri) {
          generatedMediaUrl = item.resource.uri;
          break;
        } else if (item.type === 'text' && item.text) {
          generatedText += item.text;
          // Look for URL inside text if any
          const urlMatch = item.text.match(/https?:\/\/[^\s"'<>]+\.(?:png|jpg|jpeg|webp|gif|mp4|mov|webm)(?:\?[^\s"'<>]*)?/i);
          if (urlMatch && !generatedMediaUrl) {
            generatedMediaUrl = urlMatch[0];
          }
        }
      }
    }

    // Fallback extraction if result is a raw object
    if (!generatedMediaUrl) {
      if (typeof callResult?.url === 'string') generatedMediaUrl = callResult.url;
      else if (typeof callResult?.imageUrl === 'string') generatedMediaUrl = callResult.imageUrl;
      else if (typeof callResult?.videoUrl === 'string') generatedMediaUrl = callResult.videoUrl;
      else if (typeof callResult?.data === 'string' && callResult.data.startsWith('http')) generatedMediaUrl = callResult.data;
    }

    // If still no URL found, check if generatedText contains standard URL
    if (!generatedMediaUrl && generatedText) {
      const anyUrl = generatedText.match(/https?:\/\/[^\s"'<>]+/);
      if (anyUrl) {
        generatedMediaUrl = anyUrl[0];
      }
    }

    if (!generatedMediaUrl) {
      throw new Error(`模型已响应但未返回有效媒体链接。输出详情：${generatedText || JSON.stringify(callResult)}`);
    }

    return res.json({
      success: true,
      toolUsed: targetTool.name,
      mediaUrl: generatedMediaUrl,
      isVideo: isVideo || generatedMediaUrl.endsWith('.mp4') || generatedMediaUrl.endsWith('.webm'),
      text: generatedText,
    });
  } catch (error: any) {
    console.error('[MCP Generate Error]:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || '生图/生视频调用失败',
      details: error.rpcError || error.responseBody,
    });
  }
});
