const fs = require('fs');
let code = fs.readFileSync('src/components/ProjectScriptBible.tsx', 'utf8');

const triggerTarget = `setVersions(prev => {
             const newVersions = [{
               id: Date.now().toString(),
               timestamp: Date.now(),
               summary: data.summary,
               scale: data.scale,
               scene: scene,
               scriptText: val
             }, ...prev].slice(0, 20);`;

const triggerReplacement = `setVersions(prev => {
             // Generate incremental snapshot
             let sceneText = val;
             let globalOrderSnapshot = ['全局'];
             // Find current scene boundaries if it's a scene edit
             if (data.scale === 'scene_edit' && tocItems && tocItems.length > 0) {
                 for (let i = 0; i < tocItems.length; i++) {
                     if (tocItems[i].title === scene) {
                         const start = tocItems[i].charIndex;
                         const end = i < tocItems.length - 1 ? tocItems[i+1].charIndex : val.length;
                         sceneText = val.slice(start, end);
                         break;
                     }
                 }
                 globalOrderSnapshot = tocItems.map(item => item.title);
             }

             const newVersions = [{
               id: Date.now().toString(),
               timestamp: Date.now(),
               summary: data.summary,
               scale: data.scale,
               scene: scene,
               affectedScenes: { [scene]: sceneText },
               globalOrderSnapshot: globalOrderSnapshot,
               scriptText: val // Keep fallback
             }, ...prev].slice(0, 50);`;

if (code.includes(triggerTarget)) {
  code = code.replace(triggerTarget, triggerReplacement);
} else {
  console.log("Could not find triggerTarget");
}

const manualSnapshotTarget = `setVersions(prev => [{
                                              id: Date.now().toString(),
                                              timestamp: Date.now(),
                                              summary: title,
                                              scale: 'structural',
                                              scene: '全局',
                                              scriptText: scriptDraft
                                          }, ...prev].slice(0, 20));`;

const manualSnapshotReplacement = `setVersions(prev => [{
                                              id: Date.now().toString(),
                                              timestamp: Date.now(),
                                              summary: title,
                                              scale: 'structural',
                                              scene: '全局',
                                              affectedScenes: { '全局': scriptDraft },
                                              globalOrderSnapshot: ['全局'],
                                              scriptText: scriptDraft
                                          }, ...prev].slice(0, 50));`;

if (code.includes(manualSnapshotTarget)) {
  code = code.replace(manualSnapshotTarget, manualSnapshotReplacement);
} else {
  console.log("Could not find manualSnapshotTarget");
}

fs.writeFileSync('src/components/ProjectScriptBible.tsx', code);
