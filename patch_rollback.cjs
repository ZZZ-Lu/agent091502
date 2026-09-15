const fs = require('fs');
let code = fs.readFileSync('src/components/ProjectScriptBible.tsx', 'utf8');

const target = `                                          setScriptDraft(targetText);
                                          onUpdateProject({ scriptText: targetText });
                                          setVersionStatus('已回滚');
                                          setPreviewVersionId(null);
                                      }`;

const replacement = `                                          setScriptDraft(targetText);
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

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('src/components/ProjectScriptBible.tsx', code);
  console.log("Success");
} else {
  console.log("Failed to find target");
}
