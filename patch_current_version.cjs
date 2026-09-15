const fs = require('fs');
let code = fs.readFileSync('src/components/ProjectScriptBible.tsx', 'utf8');

const target = `                              versions.map((ver, idx) => (
                                <button
                                  key={ver.id}
                                  data-agent-target={\`script.version.item.\${ver.id}\`}
                                  onMouseEnter={() => setPreviewVersionId(ver.id)}
                                  onMouseLeave={() => setPreviewVersionId(null)}
                                  onClick={() => {
                                      if (confirm(\`确定要回滚到此版本（\${ver.summary}）吗？\`)) {
                                          let targetText = ver.scriptText;
                                          if (ver.scale === 'scene_edit' && ver.affectedScenes && ver.affectedScenes[ver.scene] && ver.scene !== '全局' && tocItems.length > 0) {
                                              let rebuiltText = '';
                                              for (let i = 0; i < tocItems.length; i++) {
                                                  if (tocItems[i].title === ver.scene) {
                                                      const start = tocItems[i].charIndex;
                                                      const end = i < tocItems.length - 1 ? tocItems[i+1].charIndex : scriptDraft.length;
                                                      rebuiltText = scriptDraft.slice(0, start) + ver.affectedScenes[ver.scene] + scriptDraft.slice(end);
                                                      break;
                                                  }
                                              }
                                              if (rebuiltText) targetText = rebuiltText;
                                          }
                                          setScriptDraft(targetText);
                                          onUpdateProject({ scriptText: targetText });
                                          setVersionStatus('已回滚');
                                          setPreviewVersionId(null);
                                      }
                                  }}
                                  className="w-full text-left px-2 py-1.5 rounded-lg corner-squircle hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-700 dark:text-neutral-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center justify-between group"
                                >
                                  <div className="flex-1 min-w-0 flex items-center gap-2">
                                      <span className={\`w-1.5 h-1.5 rounded-full flex-shrink-0 \${ver.scale === 'trivial' ? 'bg-gray-300 dark:bg-gray-600' : (ver.scale === 'scene_edit' ? 'bg-yellow-400' : 'bg-green-500')}\`} />
                                      <span className="font-medium truncate text-[12px] leading-tight" title={ver.summary}>
                                        {ver.summary}
                                      </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                      <span className="text-[10px] text-gray-400 font-mono flex-shrink-0 group-hover:hidden">
                                        {new Date(ver.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                      </span>
                                      <span className="text-[10px] text-gray-400 w-12 text-right truncate group-hover:hidden" title={ver.scene}>
                                         {ver.scene}
                                      </span>
                                      <span className="text-[10px] text-blue-500 font-medium hidden group-hover:block px-1">
                                        回滚
                                      </span>
                                  </div>
                                </button>
                              ))`;

const replacement = `                              versions.map((ver, idx) => (
                                <button
                                  key={ver.id}
                                  data-agent-target={\`script.version.item.\${ver.id}\`}
                                  onMouseEnter={() => setPreviewVersionId(ver.id)}
                                  onMouseLeave={() => setPreviewVersionId(null)}
                                  onClick={() => {
                                      if (idx === 0) return;
                                      if (confirm(\`确定要回滚到此版本（\${ver.summary}）吗？\`)) {
                                          let targetText = ver.scriptText;
                                          if (ver.scale === 'scene_edit' && ver.affectedScenes && ver.affectedScenes[ver.scene] && ver.scene !== '全局' && tocItems.length > 0) {
                                              let rebuiltText = '';
                                              for (let i = 0; i < tocItems.length; i++) {
                                                  if (tocItems[i].title === ver.scene) {
                                                      const start = tocItems[i].charIndex;
                                                      const end = i < tocItems.length - 1 ? tocItems[i+1].charIndex : scriptDraft.length;
                                                      rebuiltText = scriptDraft.slice(0, start) + ver.affectedScenes[ver.scene] + scriptDraft.slice(end);
                                                      break;
                                                  }
                                              }
                                              if (rebuiltText) targetText = rebuiltText;
                                          }
                                          setScriptDraft(targetText);
                                          onUpdateProject({ scriptText: targetText });
                                          setVersionStatus('已回滚');
                                          setPreviewVersionId(null);
                                      }
                                  }}
                                  className={\`w-full text-left px-2 py-1.5 rounded-lg corner-squircle transition-colors flex items-center justify-between group \${
                                    idx === 0 
                                      ? 'bg-blue-50/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 cursor-default' 
                                      : 'hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-700 dark:text-neutral-200 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer'
                                  }\`}
                                >
                                  <div className="flex-1 min-w-0 flex items-center gap-2">
                                      <span className={\`w-1.5 h-1.5 rounded-full flex-shrink-0 \${ver.scale === 'trivial' ? 'bg-gray-300 dark:bg-gray-600' : (ver.scale === 'scene_edit' ? 'bg-yellow-400' : 'bg-green-500')}\`} />
                                      <span className="font-medium truncate text-[12px] leading-tight" title={ver.summary}>
                                        {ver.summary}
                                      </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                      <span className={\`text-[10px] font-mono flex-shrink-0 \${idx === 0 ? 'text-blue-400/70' : 'text-gray-400 group-hover:hidden'}\`}>
                                        {new Date(ver.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                      </span>
                                      <span className={\`text-[10px] w-12 text-right truncate \${idx === 0 ? 'text-blue-400/70' : 'text-gray-400 group-hover:hidden'}\`} title={ver.scene}>
                                         {ver.scene}
                                      </span>
                                      {idx === 0 ? null : (
                                        <span className="text-[10px] text-blue-500 font-medium hidden group-hover:block px-1">
                                          回滚
                                        </span>
                                      )}
                                  </div>
                                </button>
                              ))`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('src/components/ProjectScriptBible.tsx', code);
  console.log("Success");
} else {
  console.log("Failed to find target");
}
