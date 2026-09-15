const fs = require('fs');

// 1. Update src/constants/prompts.ts
let promptsContent = fs.readFileSync('src/constants/prompts.ts', 'utf-8');
const oldPromptStr = `你是一个专业的剧本结构分析助手。请分析给定的剧本内容片段，自动识别出作者用于标识【目录/集数/章】和【场次（Scene）】的标题行排版特征。

【研判标准】
1. 观察文本段中是否有清晰、重复出现的剧本场次头（如 "第1场"、"【场景1】"、"INT. OFFICE"、"1. 卧室 - 夜"等）。
2. 观察是否有更高一级的目录结构（如 "第1集"、"第一章"、"第一幕"）。
3. 如果文本段绝大部分是前言、大纲，或者几乎没有包含任何可以识别出规律的场次标记行，你必须判定为“信息不足”，在 JSON 中返回 status 为 "INSUFFICIENT_INFO"。

【输出要求】
必须按照如下 JSON 结构严格返回：
{
  "status": "SUCCESS" | "INSUFFICIENT_INFO",
  "tocPattern": "用于匹配最高级目录/集数标题的JS正则表达式 (可选，如没有则为空字符串，例如 ^第[0-9一二三四五六七八九十]+[集章幕].*)",
  "scenePattern": "用于匹配具体场次标题的JS正则表达式 (必须，例如 ^(【第)?[0-9一二三四五六七八九十]+(场】?).*)",
  "flags": "gim",
  "patternDescription": "格式描述，如 '第一集/第1场'"
}`;

const newPromptStr = `你是一个专门分析各类剧本文本结构的 AI。
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
- \`tocPattern\` 用于提取侧边栏的目录条目。
- \`scenePattern\` 用于提取正文中的独立场景/镜头切分点（可能没有，为空字符串）。
- \`types\` 数组非常重要！除了常规的 "episode"（集）、"chapter"（章）、"scene"（场/镜头）和 "heading"（大标题），你还可以根据脚本的实际内容返回自定义的类型名称（例如 "浪"、"乐章"、"部分" 等）。
只需返回 JSON，不要包含任何 markdown 标记或其他说明文本。`;

if (promptsContent.includes('【研判标准】')) {
  promptsContent = promptsContent.replace(oldPromptStr, newPromptStr);
  fs.writeFileSync('src/constants/prompts.ts', promptsContent);
} else {
  console.log("Could not find old prompt in constants");
}

// 2. Update src/components/ProjectScriptBible.tsx
let bibleContent = fs.readFileSync('src/components/ProjectScriptBible.tsx', 'utf-8');

// Ensure import exists
if (!bibleContent.includes('CODE_PIPELINE_PROMPTS')) {
  bibleContent = bibleContent.replace(
    "import { fetchWithAuth } from '../lib/api';", 
    "import { fetchWithAuth } from '../lib/api';\nimport { CODE_PIPELINE_PROMPTS } from '../constants/prompts';"
  );
}

const hardcodedPromptTarget = `        // Enhanced prompt to support PV, short dramas, and special markers
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
只需返回 JSON，不要包含任何 markdown 标记或其他说明文本。\`;`;

bibleContent = bibleContent.replace(hardcodedPromptTarget, `        const systemPrompt = CODE_PIPELINE_PROMPTS.tocInferSystemPrompt;`);

fs.writeFileSync('src/components/ProjectScriptBible.tsx', bibleContent);
