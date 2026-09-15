const fs = require('fs');
let code = fs.readFileSync('src/components/ProjectScriptBible.tsx', 'utf8');

const target = `                                <div
                                  key={ver.id}
                                  data-agent-target={\`script.version.item.\${ver.id}\`}
                                  className={\`w-full text-left px-2 py-1.5 rounded-lg corner-squircle transition-colors flex items-center justify-between group \${
                                    idx === 0 
                                      ? 'bg-blue-50/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                                      : 'hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-700 dark:text-neutral-200'
                                  }\`}
                                >`;

const replacement = `                                <div
                                  key={ver.id}
                                  data-agent-target={\`script.version.item.\${ver.id}\`}
                                  className={\`w-full text-left px-2 py-1.5 rounded-lg corner-squircle transition-colors flex items-center justify-between group \${
                                    idx === 0 
                                      ? 'bg-blue-50/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                                      : previewVersionId === ver.id
                                        ? 'bg-blue-50/30 dark:bg-blue-900/10 text-blue-500'
                                        : 'hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-700 dark:text-neutral-200'
                                  }\`}
                                >`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('src/components/ProjectScriptBible.tsx', code);
  console.log("Success");
} else {
  console.log("Failed to find target");
}
