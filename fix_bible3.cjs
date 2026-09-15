const fs = require('fs');
let content = fs.readFileSync('src/components/ProjectScriptBible.tsx', 'utf-8');

const target = `        // Retrieve prompt from settings if customized, else fallback to default
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

const replace = `        // Retrieve prompt directly from the codebase constants (which are written back by the save endpoint)
        const systemPrompt = CODE_PIPELINE_PROMPTS.tocInferSystemPrompt;`;

content = content.replace(target, replace);
fs.writeFileSync('src/components/ProjectScriptBible.tsx', content);
