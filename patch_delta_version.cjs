const fs = require('fs');
let code = fs.readFileSync('src/components/ProjectScriptBible.tsx', 'utf8');

// 1. Add utilities at the top
const utils = `
// Git-like Content-Addressed Storage Utils
const hashString = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = Math.imul(31, hash) + str.charCodeAt(i) | 0;
  }
  return hash.toString(36);
};

const getSceneStore = () => {
  try {
    return JSON.parse(localStorage.getItem('script_scene_store') || '{}');
  } catch {
    return {};
  }
};

const saveSceneStore = (store: any) => {
  try {
    localStorage.setItem('script_scene_store', JSON.stringify(store));
  } catch {}
};

const extractBlocks = (text: string, tocItems: any[]) => {
  const blocks: { title: string, hash: string }[] = [];
  const store = getSceneStore();
  let updatedStore = false;

  const addBlock = (title: string, content: string) => {
    const hash = hashString(content);
    blocks.push({ title, hash });
    if (!store[hash]) {
      store[hash] = content;
      updatedStore = true;
    }
  };

  if (tocItems.length === 0) {
    addBlock('全局', text);
  } else {
    if (tocItems[0].charIndex > 0) {
      addBlock('前言', text.substring(0, tocItems[0].charIndex));
    }
    for (let i = 0; i < tocItems.length; i++) {
      const start = tocItems[i].charIndex;
      const end = i + 1 < tocItems.length ? tocItems[i + 1].charIndex : text.length;
      addBlock(tocItems[i].title, text.substring(start, end));
    }
  }

  if (updatedStore) saveSceneStore(store);
  return blocks;
};

const reconstructText = (blocks: { title: string, hash: string }[]) => {
  const store = getSceneStore();
  return blocks.map(b => store[b.hash] || '').join('');
};
`;

if (!code.includes('hashString =')) {
  code = code.replace(
    "import { ScriptProject } from '../types/script';",
    utils + "\nimport { ScriptProject } from '../types/script';"
  );
}

// 2. Change triggerAssessChange
const oldTrigger = `const statusText = data.scale === 'scene_edit' ? \`\${scene}已暂存: \${data.summary}\` : \`里程碑更新: \${data.summary}\`;
           setVersionStatus(statusText);
           setVersions(prev => {
             const newVersions = [{
               id: Date.now().toString(),
               timestamp: Date.now(),
               summary: data.summary,
               scale: data.scale,
               scene: scene,
               scriptText: val
             }, ...prev].slice(0, 20);
             try { localStorage.setItem(\`script_versions_\${currentProject.id}\`, JSON.stringify(newVersions)); } catch {}
             return newVersions;
           });`;

const newTrigger = `const statusText = data.scale === 'trivial' ? '已保存 (微调)' : (data.scale === 'scene_edit' ? \`\${scene}已暂存: \${data.summary}\` : \`里程碑更新: \${data.summary}\`);
           setVersionStatus(statusText);
           
           // Perform block extraction
           const blocks = extractBlocks(val, tocItems);

           setVersions(prev => {
             const newVersions = [{
               id: Date.now().toString(),
               timestamp: Date.now(),
               summary: data.summary,
               scale: data.scale,
               scene: scene,
               blocks: blocks
             }, ...prev].slice(0, 50); // Keep up to 50 versions since they are lightweight
             try { localStorage.setItem(\`script_versions_\${currentProject.id}\`, JSON.stringify(newVersions)); } catch {}
             return newVersions;
           });`;

// Because the old code had an if/else for trivial, let's replace the whole block
const fullTriggerOld = `if (data.scale === 'trivial') {
           setVersionStatus('已保存 (微调)');
        } else {
           const statusText = data.scale === 'scene_edit' ? \`\${scene}已暂存: \${data.summary}\` : \`里程碑更新: \${data.summary}\`;
           setVersionStatus(statusText);
           setVersions(prev => {
             const newVersions = [{
               id: Date.now().toString(),
               timestamp: Date.now(),
               summary: data.summary,
               scale: data.scale,
               scene: scene,
               scriptText: val
             }, ...prev].slice(0, 20);
             try { localStorage.setItem(\`script_versions_\${currentProject.id}\`, JSON.stringify(newVersions)); } catch {}
             return newVersions;
           });
        }`;

if (code.includes('if (data.scale === \'trivial\') {')) {
  code = code.replace(fullTriggerOld, newTrigger);
}

// 3. Update the UI for "+ 创建快照"
const oldManualSnapshot = `setVersions(prev => [{
                                              id: Date.now().toString(),
                                              timestamp: Date.now(),
                                              summary: title,
                                              scale: 'structural',
                                              scene: '全局',
                                              scriptText: scriptDraft
                                          }, ...prev].slice(0, 20));`;

const newManualSnapshot = `const blocks = extractBlocks(scriptDraft, tocItems);
                                          setVersions(prev => [{
                                              id: Date.now().toString(),
                                              timestamp: Date.now(),
                                              summary: title,
                                              scale: 'structural',
                                              scene: '全局',
                                              blocks: blocks
                                          }, ...prev].slice(0, 50));`;

if (code.includes(oldManualSnapshot)) {
  code = code.replace(oldManualSnapshot, newManualSnapshot);
}


// 4. Update the "回滚至此" logic
const oldRollback = `setScriptDraft(ver.scriptText);
                                              onUpdateProject({ scriptText: ver.scriptText });`;

const newRollback = `const reconstructed = reconstructText(ver.blocks);
                                              setScriptDraft(reconstructed);
                                              onUpdateProject({ scriptText: reconstructed });`;

if (code.includes(oldRollback)) {
  code = code.replace(oldRollback, newRollback);
}

// Add CSS to hide trivial versions slightly, or distinct them
code = code.replace(
  'className={`w-2 h-2 rounded-full ${ver.scale === \'scene_edit\' ? \'bg-yellow-400\' : \'bg-green-500\'}`}',
  'className={`w-2 h-2 rounded-full ${ver.scale === \'trivial\' ? \'bg-gray-300 dark:bg-gray-600\' : (ver.scale === \'scene_edit\' ? \'bg-yellow-400\' : \'bg-green-500\')}`}'
);

fs.writeFileSync('src/components/ProjectScriptBible.tsx', code);
