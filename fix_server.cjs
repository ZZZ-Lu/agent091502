const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf-8');

const targetStr = `  app.post("/api/script-toc-pattern", async (req, res) => {`;
const replaceStr = `  app.post('/api/save-prompts', express.json(), (req, res) => {
    try {
      const { prompts } = req.body;
      if (!prompts) return res.status(400).json({ error: 'Missing prompts data' });
      const promptFileContent = \`import { NodePromptConfig } from '../types/script';

/**
 * 全局统一的代码级管线与节点系统 Prompt 库
 */
export const CODE_PIPELINE_PROMPTS: NodePromptConfig = \${JSON.stringify(prompts, null, 2)};
\`;
      fs.writeFileSync(path.join(process.cwd(), 'src/constants/prompts.ts'), promptFileContent, 'utf-8');
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/script-toc-pattern", async (req, res) => {`;

if (!content.includes('/api/save-prompts')) {
  content = content.replace(targetStr, replaceStr);
  fs.writeFileSync('server.ts', content);
}
