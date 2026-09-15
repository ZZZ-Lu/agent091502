const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const targetStr = `                    role: 'system', 
                    content: \`你是一个工具参数适配器。请将用户的自然语言动作描述，严格转换为工具调用数组。\\n可用工具的 JSON Schema：\\n\${adapterToolPrompt}\\n\\n请输出严格的 JSON 格式，格式如下：\\n{ "tool_calls": [{ "name": "工具名称", "arguments": { "参数名": "参数值" } }] }\` 
                  },`;

const newStr = `                    role: 'system', 
                    content: \`你是一个极其精准的工具参数适配器。你的任务是将 Agent 的自然语言动作意图，严格翻译为对应工具的 JSON 调用参数。\\n\\n【核心转换规则】\\n1. 目标识别：根据自然语言描述，推断出最合理的 targetId。\\n2. 数值转化 (特别是 mouse.scroll)：严禁输出方向字符串。必须将滚动意图转换为 delta 数值（像素）。"向下滚一点/一屏" -> 正数 (如 480)；"向上滚一点/一屏" -> 负数 (如 -480)；"滚到最底部" -> 极大的正数 (如 99999)；"滚到最顶部" -> 极小的负数 (如 -99999)。\\n3. 状态提取：对于 sys.updateState，准确提取对应字段（如 taskTitle, notes 等）的文本内容。\\n\\n可用工具的 JSON Schema：\\n\${adapterToolPrompt}\\n\\n请输出严格的 JSON 格式，格式如下：\\n{ "tool_calls": [{ "name": "工具名称", "arguments": { "参数名": "参数值" } }] }\` 
                  },`;

if (code.includes(targetStr)) {
  code = code.replace(targetStr, newStr);
  fs.writeFileSync('server.ts', code, 'utf-8');
  console.log('patched');
} else {
  console.log('not found');
}
