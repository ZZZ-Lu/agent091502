const fs = require('fs');
let code = fs.readFileSync('src/components/ProjectScriptBible.tsx', 'utf8');

// Update button onClick
code = code.replace(
  '                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg corner-squircle text-xs font-semibold text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white transition-colors"',
  '                          onClick={() => setIsVersionOpen(prev => !prev)}\n                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg corner-squircle text-xs font-semibold transition-colors ${isVersionOpen ? "text-blue-600 dark:text-blue-400" : "text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white"}`}'
);

const versionPanelStr = `
                    <AnimatePresence>
                      {isVersionOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1, transition: { duration: 0.2 } }}
                          exit={{ height: 0, opacity: 0, transition: { duration: 0.15 } }}
                          className="overflow-hidden"
                        >
                          <div className="mx-1 mt-1 mb-2 p-3 bg-white/60 dark:bg-[#1C1C1E]/60 backdrop-blur-md rounded-xl shadow-sm border border-black/5 dark:border-white/5 flex flex-col gap-2 max-h-[300px] overflow-y-auto">
                            <div className="flex items-center justify-between">
                               <h4 className="text-[13px] font-semibold text-gray-800 dark:text-neutral-200">版本历史</h4>
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
                                              scriptText: scriptDraft
                                          }, ...prev].slice(0, 20));
                                      }
                                  }}
                                  className="text-xs px-2 py-1 bg-blue-500 text-white rounded corner-squircle hover:bg-blue-600 transition-colors">
                                  + 创建快照
                               </button>
                            </div>
                            {versions.length === 0 ? (
                              <div className="text-center py-4 text-xs text-gray-500">暂无版本记录，稍后的改动将自动沉淀。</div>
                            ) : (
                              versions.map((ver, idx) => (
                                <div key={ver.id} data-agent-target={\`script.version.item.\${ver.id}\`} className="flex flex-col gap-1.5 p-2.5 rounded-lg bg-gray-50 dark:bg-neutral-800 border border-gray-100 dark:border-neutral-700 hover:border-blue-200 transition-colors">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className={\`w-2 h-2 rounded-full \${ver.scale === 'scene_edit' ? 'bg-yellow-400' : 'bg-green-500'}\`}></span>
                                      <span className="text-xs font-medium text-gray-800 dark:text-neutral-200">{ver.summary}</span>
                                    </div>
                                    <span className="text-[10px] text-gray-500">{new Date(ver.timestamp).toLocaleTimeString()}</span>
                                  </div>
                                  <div className="flex items-center justify-between pl-4">
                                      <span className="text-[11px] text-gray-500">{ver.scene}</span>
                                      <button onClick={() => {
                                          if (confirm(\`确定要回滚到此版本（\${ver.summary}）吗？\`)) {
                                              setScriptDraft(ver.scriptText);
                                              onUpdateProject({ scriptText: ver.scriptText });
                                              setVersionStatus('已回滚');
                                          }
                                      }} className="text-[10px] px-2 py-0.5 rounded bg-gray-200 dark:bg-neutral-700 text-gray-700 dark:text-neutral-300 hover:bg-gray-300 dark:hover:bg-neutral-600 transition-colors">回滚至此</button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
`;

// Insert after the Search Panel AnimatePresence
const splitToken = '                    </AnimatePresence>';
const parts = code.split(splitToken);
if (parts.length >= 2) {
  // Find the AnimatePresence corresponding to Search panel
  // Since there are multiple AnimatePresence, we look for the one containing isSearchOpen
  for (let i = 0; i < parts.length - 1; i++) {
    if (parts[i].includes('isSearchOpen &&')) {
      parts[i] = parts[i] + splitToken + '\n' + versionPanelStr;
      break;
    }
  }
  code = parts.join(splitToken);
}

fs.writeFileSync('src/components/ProjectScriptBible.tsx', code);
