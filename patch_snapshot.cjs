const fs = require('fs');
let code = fs.readFileSync('src/components/ProjectScriptBible.tsx', 'utf8');

const target = `                                  onClick={() => {
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
                                  }}`;

const replacement = `                                  onClick={() => {
                                      setVersions(prev => [{
                                          id: Date.now().toString(),
                                          timestamp: Date.now(),
                                          summary: '手动快照',
                                          scale: 'structural',
                                          scene: '全局',
                                          affectedScenes: { '全局': scriptDraft },
                                          globalOrderSnapshot: ['全局'],
                                          scriptText: scriptDraft
                                      }, ...prev].slice(0, 50));
                                      try { localStorage.setItem(\`script_versions_\${currentProject.id}\`, JSON.stringify([{ id: Date.now().toString(), timestamp: Date.now(), summary: '手动快照', scale: 'structural', scene: '全局', affectedScenes: { '全局': scriptDraft }, globalOrderSnapshot: ['全局'], scriptText: scriptDraft }, ...versions].slice(0, 50))); } catch {}
                                  }}`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('src/components/ProjectScriptBible.tsx', code);
  console.log("Success");
} else {
  console.log("Failed to find target");
}
