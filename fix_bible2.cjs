const fs = require('fs');
let content = fs.readFileSync('src/components/ProjectScriptBible.tsx', 'utf-8');

// Ensure import exists
if (!content.includes('CODE_PIPELINE_PROMPTS')) {
  content = content.replace(
    "import { fetchWithAuth } from '../lib/api';", 
    "import { fetchWithAuth } from '../lib/api';\nimport { CODE_PIPELINE_PROMPTS } from '../constants/prompts';"
  );
}

const targetStr = `        // Enhanced prompt to support PV, short dramas, and special markers
        const systemPrompt = \`你是一个专门分析各类剧本文本结构的 AI。
请分析用户提供的剧本前4000字，推断出其【场次或章节】的排版格式特征，并返回一个 JSON。
注意，目标剧本可能是传统影视剧，也可能是短剧、广告PV、概念脚本。
请务必兼容以下前缀：可能存在 ■、●、◆ 等符号；
请务必兼容以下量词：除了第X场/集，还可能是"第一浪"、"第一乐章"、"PART 1"等；
请务必兼容行尾可能存在的时间码：如 (0:00-0:15)。

要求返回 JSON 格式如下：
{
  "tocPattern": "^(■|●|◆)?\\\\s*(?:第[0-9一二三四五六七八九十百千]+[集场幕章节回话浪段篇卷]|(?:EPISODE|EP|ACT|SCENE|CHAPTER|PART)\\\\s*#?[0-9]+|第一乐章).*",
  "scenePattern": "^(?:【[^】]*】)?[(（].*[)）]$",
  "flags": "gim",
  "patternDescription": "用于匹配...",
  "types": [
    { "regex": "^(■|●|◆)?\\\\s*第一浪.*", "type": "episode" },
    { "regex": "^(?:【[^】]*】)?[(（].*[)）]$", "type": "scene" }
  ]
}
注意：
- \\\`tocPattern\\\` 用于提取侧边栏的目录条目。
- \\\`scenePattern\\\` 用于提取正文中的独立场景/镜头切分点（可能没有，为空字符串）。
- \\\`types\\\` 数组非常重要！除了常规的 "episode"（集）、"chapter"（章）、"scene"（场/镜头）和 "heading"（大标题），你还可以根据脚本的实际内容返回自定义的类型名称（例如 "浪"、"乐章"、"部分" 等）。
只需返回 JSON，不要包含任何 markdown 标记或其他说明文本。\``;

const replaceStr = `        // Retrieve prompt from settings if customized, else fallback to default
        let systemPrompt = CODE_PIPELINE_PROMPTS.tocInferSystemPrompt;
        try {
          const savedPrompts = localStorage.getItem('custom_node_prompts');
          if (savedPrompts) {
            const parsed = JSON.parse(savedPrompts);
            if (parsed.tocInferSystemPrompt) {
              systemPrompt = parsed.tocInferSystemPrompt;
            }
          }
        } catch (e) {}`;

content = content.replace(targetStr, replaceStr);
fs.writeFileSync('src/components/ProjectScriptBible.tsx', content);
