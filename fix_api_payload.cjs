const fs = require('fs');
let content = fs.readFileSync('src/components/ProjectScriptBible.tsx', 'utf-8');

const targetStr = `        const res = await fetch('/api/script-toc-pattern', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sampleText })
        });`;

const replaceStr = `        // Retrieve API credentials from settings
        const activeModel = localStorage.getItem('active_model') || 'deepseek';
        const deepseekKey = localStorage.getItem('deepseek_api_key') || '';
        const qwenKey = localStorage.getItem('qwen_api_key') || '';
        const glmKey = localStorage.getItem('glm_api_key') || '';
        const customUrl = localStorage.getItem('custom_model_url') || '';
        
        let apiKey = '';
        if (activeModel === 'deepseek') apiKey = deepseekKey;
        else if (activeModel === 'qwen') apiKey = qwenKey;
        else if (activeModel === 'glm') apiKey = glmKey;

        // Enhanced prompt to support PV, short dramas, and special markers
        const systemPrompt = \`你是一个专门分析各类剧本文本结构的 AI。
请分析用户提供的剧本前4000字，推断出其【场次或章节】的排版格式特征，并返回一个 JSON。
注意，目标剧本可能是传统影视剧，也可能是短剧、广告PV、概念脚本。
请务必兼容以下前缀：可能存在 ■、●、◆ 等符号；
请务必兼容以下量词：除了第X场/集，还可能是"第一浪"、"第一乐章"、"PART 1"等；
请务必兼容行尾可能存在的时间码：如 (0:00-0:15)。

要求返回 JSON 格式如下：
{
  "scenePattern": "^(■|●|◆)?\\\\s*(?:第[0-9一二三四五六七八九十百千]+[集场幕章节回话浪段篇卷]|(?:EPISODE|EP|ACT|SCENE|CHAPTER|PART)\\\\s*#?[0-9]+|第一乐章).*",
  "flags": "gim",
  "patternDescription": "用于匹配..."
}
只需返回 JSON，不要包含任何 markdown 标记或其他说明文本。\`

        const res = await fetch('/api/script-toc-pattern', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            sampleText,
            systemPrompt,
            modelType: activeModel,
            apiKey: apiKey,
            deepseekKey: deepseekKey 
          })
        });`;

content = content.replace(targetStr, replaceStr);
fs.writeFileSync('src/components/ProjectScriptBible.tsx', content);
