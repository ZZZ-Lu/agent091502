const fs = require('fs');
let code = fs.readFileSync('src/components/ProjectScriptBible.tsx', 'utf8');

if (!code.includes('const [isVersionOpen')) {
  code = code.replace(
    'const [isSearchOpen, setIsSearchOpen] = useState(false);',
    'const [isSearchOpen, setIsSearchOpen] = useState(false);\n  const [isVersionOpen, setIsVersionOpen] = useState(false);\n  const [versions, setVersions] = useState<any[]>(() => {\n    try { return JSON.parse(localStorage.getItem(`script_versions_${currentProject?.id}`) || "[]"); } catch { return []; }\n  });'
  );
}

// update `triggerAssessChange` to save versions
const triggerTarget = `if (data.scale === 'trivial') {
           setVersionStatus('已保存 (微调)');
        } else if (data.scale === 'scene_edit') {
           setVersionStatus(\`\${scene}已暂存: \${data.summary}\`);
        } else {
           setVersionStatus(\`里程碑更新: \${data.summary}\`);
        }`;

const triggerReplacement = `if (data.scale === 'trivial') {
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

code = code.replace(triggerTarget, triggerReplacement);

fs.writeFileSync('src/components/ProjectScriptBible.tsx', code);
