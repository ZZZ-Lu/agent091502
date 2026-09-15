const fs = require('fs');
let content = fs.readFileSync('src/components/ProjectScriptBible.tsx', 'utf-8');

const targetStr = `                    <div className="px-4 py-2 bg-gray-50/50 dark:bg-[#1C1C1C]/50 border-b border-gray-200/80 dark:border-[#333333] flex justify-between items-center rounded-t-2xl z-20 relative">`;
const replaceStr = `                    <div className="px-4 py-2 bg-gray-50/50 dark:bg-[#1C1C1C]/50 border-b border-gray-200/80 dark:border-[#333333] flex justify-between items-center rounded-t-2xl z-20 relative gap-4">`;

content = content.replace(targetStr, replaceStr);

fs.writeFileSync('src/components/ProjectScriptBible.tsx', content);
