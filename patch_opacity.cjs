const fs = require('fs');
let code = fs.readFileSync('src/components/ProjectScriptBible.tsx', 'utf8');

const target = `                      <div
                        className={\`w-full flex-1 h-full pl-[22px] pr-[17px] pt-4 pb-4 text-[14px] font-medium leading-relaxed bg-transparent border-0 outline-none text-gray-800 dark:text-neutral-300 overflow-y-auto whitespace-pre-wrap break-words transition-opacity duration-200 ease-out \${
                          isPositionReady ? 'opacity-100' : 'opacity-0 pointer-events-none'
                        }\`}
                      >`;

const replacement = `                      <div
                        className="w-full flex-1 h-full pl-[22px] pr-[17px] pt-4 pb-4 text-[14px] font-medium leading-relaxed bg-transparent border-0 outline-none text-gray-800 dark:text-neutral-300 overflow-y-auto whitespace-pre-wrap break-words opacity-100"
                      >`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('src/components/ProjectScriptBible.tsx', code);
  console.log("Success: fixed div opacity");
} else {
  console.log("Failed to find target");
}
