const fs = require('fs');
let code = fs.readFileSync('src/components/ProjectScriptBible.tsx', 'utf8');

const targetRegex = /\{isVersionOpen && \([\s\S]*?\)\}\n\s*<\/AnimatePresence>/;

const replacement = `{isVersionOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{
                            height: 'auto',
                            opacity: 1,
                            transition: {
                              height: { duration: 0.18, ease: [0.16, 1, 0.3, 1] },
                              opacity: { duration: 0.14, ease: 'easeOut' },
                            },
                          }}
                          exit={{
                            height: 0,
                            opacity: 0,
                            transition: {
                              height: { duration: 0.14, ease: [0.32, 0, 0.67, 0] },
                              opacity: { duration: 0.1, ease: 'easeIn' },
                            },
                          }}
                          className="overflow-hidden shrink-0"
                        >
                          <div className="px-1.5 pb-1.5 pt-1.5 flex flex-col gap-0.5 border-t border-gray-100 dark:border-neutral-700/80 mt-1 max-h-[300px] overflow-y-auto">
                            <div className="flex items-center justify-between mb-1 px-1">
                               <h4 className="text-[11px] font-semibold text-gray-500 dark:text-neutral-500">版本历史 (悬停预览)</h4>
                               <button 
                                  onClick={() => {
                                      const title = prompt("请输入手动快照名称：", "手动备份");
                                      if (title) {
                                          setVersions(prev => [{
                                              id: Date.now().toString(),
                                              timestamp: Date.now(),
                                              summary: title,
                                              scale: 'structural',
                                              scene: '全局',
                                              affectedScenes: { '全局': scriptDraft },
                                              globalOrderSnapshot: ['全局'],
                                              scriptText: scriptDraft
                                          }, ...prev].slice(0, 50));
                                      }
                                  }}
                                  className="text-[10px] px-1.5 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded corner-squircle hover:bg-blue-500/20 transition-colors">
                                  + 创建快照
                               </button>
                            </div>
                            {versions.length === 0 ? (
                              <div className="text-center py-3 text-[11px] text-gray-400">暂无版本记录，稍后的改动将自动沉淀。</div>
                            ) : (
                              versions.map((ver, idx) => (
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
                              ))
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>`;

code = code.replace(targetRegex, replacement);
fs.writeFileSync('src/components/ProjectScriptBible.tsx', code);
console.log("Success replacing version history UI");
