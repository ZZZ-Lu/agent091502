import fs from 'fs';
import { AGENT_TOOL_REGISTRY } from './src/agent/toolRegistry.js';

const functionNameForTool = (toolId) => toolId.replaceAll('.', '_');
const toolNameByFunction = new Map(AGENT_TOOL_REGISTRY.map((tool) => [functionNameForTool(tool.id), tool.id]));

console.log(Array.from(toolNameByFunction.keys()));
