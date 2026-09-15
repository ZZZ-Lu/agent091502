const fs = require('fs');
let content = fs.readFileSync('src/components/ProjectScriptBible.tsx', 'utf-8');

// Ensure import exists
if (!content.includes('CODE_PIPELINE_PROMPTS')) {
  content = content.replace(
    "import { fetchWithAuth } from '../lib/api';", 
    "import { fetchWithAuth } from '../lib/api';\nimport { CODE_PIPELINE_PROMPTS } from '../constants/prompts';"
  );
}

const hardcodedPromptRegex = /const systemPrompt = \`你是一个专门分析各类剧本文本结构的 AI。[\s\S]*?只需返回 JSON，不要包含任何 markdown 标记或其他说明文本。\`;/;

if (hardcodedPromptRegex.test(content)) {
  content = content.replace(hardcodedPromptRegex, `
        let systemPrompt = CODE_PIPELINE_PROMPTS.tocInferSystemPrompt;
        try {
          const savedPrompts = localStorage.getItem('custom_node_prompts');
          if (savedPrompts) {
            const parsed = JSON.parse(savedPrompts);
            if (parsed.tocInferSystemPrompt) {
              systemPrompt = parsed.tocInferSystemPrompt;
            }
          }
        } catch (e) {}
  `);
  fs.writeFileSync('src/components/ProjectScriptBible.tsx', content);
  console.log("Successfully replaced hardcoded prompt in ProjectScriptBible.");
} else {
  console.log("Could not find hardcoded prompt with regex.");
}
