const fs = require('fs');
let code = fs.readFileSync('src/components/ProjectScriptBible.tsx', 'utf8');

const target = `  const previewDiff = useMemo(() => {
    if (!previewVersionId) return null;
    const activeVersion = versions.find(v => v.id === previewVersionId);
    if (!activeVersion) return null;
    
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
    
    // Compute diff: scriptDraft (Current) vs targetText (Preview)
    // - added: stuff in targetText but not in scriptDraft (green, highlighted) -> "新加的"
    // - removed: stuff in scriptDraft but not in targetText (red, strikethrough) -> "删掉的"
    return Diff.diffChars(scriptDraft, targetText);
  }, [previewVersionId, scriptDraft, versions, tocItems]);`;

if (code.includes(target)) {
  code = code.replace(target, "");
  fs.writeFileSync('src/components/ProjectScriptBible.tsx', code);
  console.log("Success: removed previewDiff");
} else {
  console.log("Failed to find previewDiff target");
}
