const fs = require('fs');
let content = fs.readFileSync('src/components/ProjectScriptBible.tsx', 'utf-8');
content = content.replace(/part\.count!/g, 'part.value.length');
fs.writeFileSync('src/components/ProjectScriptBible.tsx', content);
