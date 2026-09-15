const fs = require('fs');
let code = fs.readFileSync('src/components/ProjectScriptBible.tsx', 'utf8');

const target1 = `  const [replaceFeedback, setReplaceFeedback] = useState<string | null>(null);`;
const replacement1 = `  const [replaceFeedback, setReplaceFeedback] = useState<string | null>(null);
  const [previewVersionId, setPreviewVersionId] = useState<string | null>(null);

  const getPreviewText = () => {
    if (!previewVersionId) return scriptDraft;
    const activeVersion = versions.find(v => v.id === previewVersionId);
    if (!activeVersion) return scriptDraft;

    let targetText = activeVersion.scriptText;
    if (activeVersion.scale === 'scene_edit' && activeVersion.affectedScenes && activeVersion.affectedScenes[activeVersion.scene] && activeVersion.scene !== '全局' && tocItems.length > 0) {
        let rebuiltText = '';
        for (let i = 0; i < tocItems.length; i++) {
            if (tocItems[i].title === activeVersion.scene) {
                const start = tocItems[i].charIndex;
                const end = i < tocItems.length - 1 ? tocItems[i+1].charIndex : scriptDraft.length;
                rebuiltText = scriptDraft.slice(0, start) + activeVersion.affectedScenes[activeVersion.scene] + scriptDraft.slice(end);
                break;
            }
        }
        if (rebuiltText) targetText = rebuiltText;
    }
    return targetText;
  };`;

if (code.includes(target1)) {
  code = code.replace(target1, replacement1);
} else {
  console.log("Failed to find target1");
}

const target2 = `                    value={scriptDraft}`;
const replacement2 = `                    value={previewVersionId ? getPreviewText() : scriptDraft}
                    readOnly={!!previewVersionId}`;

if (code.includes(target2)) {
  code = code.replace(target2, replacement2);
} else {
  console.log("Failed to find target2");
}

fs.writeFileSync('src/components/ProjectScriptBible.tsx', code);
