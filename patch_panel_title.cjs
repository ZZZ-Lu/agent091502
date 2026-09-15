const fs = require('fs');
let code = fs.readFileSync('src/components/ProjectScriptBible.tsx', 'utf8');

code = code.replace(
  '<h4 className="text-[11px] font-semibold text-gray-500 dark:text-neutral-500">版本历史 (悬停预览)</h4>',
  '<h4 className="text-[11px] font-semibold text-gray-500 dark:text-neutral-500">版本历史</h4>'
);

fs.writeFileSync('src/components/ProjectScriptBible.tsx', code);
