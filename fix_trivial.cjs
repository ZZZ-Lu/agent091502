const fs = require('fs');
let code = fs.readFileSync('src/components/ProjectScriptBible.tsx', 'utf8');

const target = `if (data.scale === 'trivial') {
           setVersionStatus('已保存 (微调)');
        } else {
           const statusText = data.scale === 'scene_edit' ? \`\${scene}已暂存: \${data.summary}\` : \`里程碑更新: \${data.summary}\`;
           setVersionStatus(statusText);
           setVersions(prev => {`;

const replacement = `const statusText = data.scale === 'trivial' ? '已保存 (微调)' : (data.scale === 'scene_edit' ? \`\${scene}已暂存: \${data.summary}\` : \`里程碑更新: \${data.summary}\`);
        setVersionStatus(statusText);
        setVersions(prev => {`;

code = code.replace(target, replacement);

fs.writeFileSync('src/components/ProjectScriptBible.tsx', code);
