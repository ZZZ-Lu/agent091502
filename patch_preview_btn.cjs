const fs = require('fs');
let code = fs.readFileSync('src/components/ProjectScriptBible.tsx', 'utf8');

const target1 = `                                <button
                                  key={ver.id}
                                  data-agent-target={\`script.version.item.\${ver.id}\`}
                                  onMouseEnter={() => setPreviewVersionId(ver.id)}
                                  onMouseLeave={() => setPreviewVersionId(null)}
                                  onClick={() => {
                                      if (idx === 0) return;
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
                                          
                                          // Create a new version for the rollback
                                          setVersions(prev => {
                                              const newVersions = [{
                                                  id: Date.now().toString(),
                                                  timestamp: Date.now(),
                                                  summary: \`回滚: \${ver.summary}\`,
                                                  scale: 'structural',
                                                  scene: '全局',
                                                  affectedScenes: { '全局': targetText },
                                                  globalOrderSnapshot: ['全局'],
                                                  scriptText: targetText
                                              }, ...prev].slice(0, 50);
                                              try { localStorage.setItem(\`script_versions_\${currentProject.id}\`, JSON.stringify(newVersions)); } catch {}
                                              return newVersions;
                                          });
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
                                </button>`;

const replacement1 = `                                <div
                                  key={ver.id}
                                  data-agent-target={\`script.version.item.\${ver.id}\`}
                                  className={\`w-full text-left px-2 py-1.5 rounded-lg corner-squircle transition-colors flex items-center justify-between group \${
                                    idx === 0 
                                      ? 'bg-blue-50/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                                      : 'hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-700 dark:text-neutral-200'
                                  }\`}
                                >
                                  <div className="flex-1 min-w-0 flex items-center gap-2">
                                      <span className={\`w-1.5 h-1.5 rounded-full flex-shrink-0 \${ver.scale === 'trivial' ? 'bg-gray-300 dark:bg-gray-600' : (ver.scale === 'scene_edit' ? 'bg-yellow-400' : 'bg-green-500')}\`} />
                                      <span className="font-medium truncate text-[12px] leading-tight" title={ver.summary}>
                                        {ver.summary}
                                      </span>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                      <span className={\`text-[10px] font-mono flex-shrink-0 \${idx === 0 ? 'text-blue-400/70' : 'text-gray-400 group-hover:hidden'}\`}>
                                        {new Date(ver.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                      </span>
                                      <span className={\`text-[10px] w-12 text-right truncate \${idx === 0 ? 'text-blue-400/70' : 'text-gray-400 group-hover:hidden'}\`} title={ver.scene}>
                                         {ver.scene}
                                      </span>
                                      
                                      {idx === 0 ? null : (
                                        <div className="hidden group-hover:flex items-center gap-2 pr-1">
                                            <button 
                                                onClick={() => {
                                                    if (previewVersionId === ver.id) {
                                                        setPreviewVersionId(null);
                                                    } else {
                                                        setPreviewVersionId(ver.id);
                                                        
                                                        // Attempt to find diff to highlight and scroll
                                                        const getVersionText = () => {
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
                                                            return targetText;
                                                        };
                                                        
                                                        const pText = getVersionText();
                                                        // basic diff logic: find first diff
                                                        let diffStart = 0;
                                                        while (diffStart < scriptDraft.length && diffStart < pText.length && scriptDraft[diffStart] === pText[diffStart]) {
                                                            diffStart++;
                                                        }
                                                        
                                                        if (diffStart < pText.length || diffStart < scriptDraft.length) {
                                                            // We found a difference
                                                            // Find the end from the back
                                                            let endO = scriptDraft.length - 1;
                                                            let endP = pText.length - 1;
                                                            while (endO >= diffStart && endP >= diffStart && scriptDraft[endO] === pText[endP]) {
                                                                endO--;
                                                                endP--;
                                                            }
                                                            
                                                            // Select in preview textarea
                                                            setTimeout(() => {
                                                                if (textareaRef.current) {
                                                                    const exactTop = getTextareaCharTop(textareaRef.current, diffStart);
                                                                    const targetScroll = Math.max(0, exactTop - 50);
                                                                    textareaRef.current.focus({ preventScroll: true });
                                                                    textareaRef.current.setSelectionRange(diffStart, endP + 1);
                                                                    textareaRef.current.scrollTop = targetScroll;
                                                                }
                                                            }, 50);
                                                        }
                                                    }
                                                }}
                                                className={\`text-[10px] px-1.5 py-0.5 rounded transition-colors \${previewVersionId === ver.id ? 'bg-blue-500 text-white' : 'text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/50'}\`}
                                            >
                                                {previewVersionId === ver.id ? '退出' : '预览'}
                                            </button>
                                            <button 
                                                onClick={() => {
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
                                                    setVersionStatus('已恢复');
                                                    setPreviewVersionId(null);
                                                    
                                                    setVersions(prev => {
                                                        const newVersions = [{
                                                            id: Date.now().toString(),
                                                            timestamp: Date.now(),
                                                            summary: \`恢复至: \${ver.summary}\`,
                                                            scale: 'structural',
                                                            scene: '全局',
                                                            affectedScenes: { '全局': targetText },
                                                            globalOrderSnapshot: ['全局'],
                                                            scriptText: targetText
                                                        }, ...prev].slice(0, 50);
                                                        try { localStorage.setItem(\`script_versions_\${currentProject.id}\`, JSON.stringify(newVersions)); } catch {}
                                                        return newVersions;
                                                    });
                                                }}
                                                className="text-[10px] text-gray-500 hover:text-gray-900 dark:hover:text-neutral-200"
                                            >
                                                恢复
                                            </button>
                                        </div>
                                      )}
                                  </div>
                                </div>`;

if (code.includes(target1)) {
  code = code.replace(target1, replacement1);
  fs.writeFileSync('src/components/ProjectScriptBible.tsx', code);
  console.log("Success");
} else {
  console.log("Failed to find target1");
}
