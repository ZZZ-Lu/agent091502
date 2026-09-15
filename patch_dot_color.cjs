const fs = require('fs');
let code = fs.readFileSync('src/components/ProjectScriptBible.tsx', 'utf8');

const target = `                                      {idx === 0 ? (
                                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-blue-500" />
                                      ) : (
                                          <span className={\`w-1.5 h-1.5 rounded-full flex-shrink-0 \${ver.scale === 'trivial' ? 'bg-gray-300 dark:bg-gray-600' : (ver.scale === 'scene_edit' ? 'bg-yellow-400' : 'bg-purple-500')}\`} />
                                      )}`;

const replacement = `                                      {idx === 0 ? (
                                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-blue-500" />
                                      ) : (
                                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-gray-300 dark:bg-neutral-600" />
                                      )}`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('src/components/ProjectScriptBible.tsx', code);
  console.log("Success");
} else {
  console.log("Failed to find target");
}
