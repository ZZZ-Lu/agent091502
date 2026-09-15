const fs = require('fs');
let code = fs.readFileSync('src/components/ProjectScriptBible.tsx', 'utf8');

const target = `                                  <div className="flex-1 min-w-0 flex items-center gap-2">
                                      <span className={\`w-1.5 h-1.5 rounded-full flex-shrink-0 \${ver.scale === 'trivial' ? 'bg-gray-300 dark:bg-gray-600' : (ver.scale === 'scene_edit' ? 'bg-yellow-400' : 'bg-green-500')}\`} />
                                      <span className="font-medium truncate text-[12px] leading-tight" title={ver.summary}>
                                        {ver.summary}
                                      </span>
                                  </div>`;

const replacement = `                                  <div className="flex-1 min-w-0 flex items-center gap-2">
                                      {idx === 0 ? (
                                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-blue-500" />
                                      ) : (
                                          <span className={\`w-1.5 h-1.5 rounded-full flex-shrink-0 \${ver.scale === 'trivial' ? 'bg-gray-300 dark:bg-gray-600' : (ver.scale === 'scene_edit' ? 'bg-yellow-400' : 'bg-purple-500')}\`} />
                                      )}
                                      <span className="font-medium truncate text-[12px] leading-tight" title={ver.summary}>
                                        {ver.summary}
                                      </span>
                                      {idx === 0 && (
                                        <span className="px-1 py-0.5 rounded text-[9px] bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 font-bold ml-1 flex-shrink-0">
                                          当前
                                        </span>
                                      )}
                                  </div>`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('src/components/ProjectScriptBible.tsx', code);
  console.log("Success");
} else {
  console.log("Failed to find target");
}
