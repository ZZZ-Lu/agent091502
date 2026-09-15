const fs = require('fs');
let content = fs.readFileSync('src/components/ProjectScriptBible.tsx', 'utf-8');

if (!content.includes('import { CODE_PIPELINE_PROMPTS }')) {
  content = content.replace(
    "import { motion, AnimatePresence } from 'motion/react';", 
    "import { motion, AnimatePresence } from 'motion/react';\nimport { CODE_PIPELINE_PROMPTS } from '../constants/prompts';"
  );
  fs.writeFileSync('src/components/ProjectScriptBible.tsx', content);
}
