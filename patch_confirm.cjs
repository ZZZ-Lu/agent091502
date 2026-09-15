const fs = require('fs');
let code = fs.readFileSync('src/components/ProjectScriptBible.tsx', 'utf8');

const target = `                                      if (confirm(\`确定要回滚到此版本（\${ver.summary}）吗？\`)) {
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
                                      }`;

const replacement = `                                          let targetText = ver.scriptText;
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
                                          });`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('src/components/ProjectScriptBible.tsx', code);
  console.log("Success");
} else {
  console.log("Failed to find target");
}
