const fs = require('fs');
let code = fs.readFileSync('src/components/ProjectScriptBible.tsx', 'utf8');

const target = `                                                        const getVersionText = () => {
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
                                                            return targetText;
                                                        };
                                                        
                                                        // Wait for the diff view to render, then scroll to the first change
                                                        setTimeout(() => {
                                                            const firstChange = document.getElementById('diff-first-change');
                                                            if (firstChange) {
                                                                firstChange.scrollIntoView({ block: 'center', behavior: 'smooth' });
                                                            }
                                                        }, 50);`;

const replacement = `                                                        const getVersionText = () => {
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
                                                            return targetText;
                                                        };
                                                        
                                                        const pText = getVersionText();
                                                        let diffStart = 0;
                                                        
                                                        if (ver.scale === 'scene_edit' && ver.scene && ver.scene !== '全局') {
                                                            // Find the scene heading in the text
                                                            const sceneIdx = pText.indexOf(ver.scene);
                                                            if (sceneIdx !== -1) {
                                                                diffStart = sceneIdx;
                                                            }
                                                        } else {
                                                            // For global edits, diff against the PREVIOUS version to find what changed then
                                                            const prevVer = versions[idx + 1];
                                                            if (prevVer) {
                                                                const oText = prevVer.scriptText;
                                                                while (diffStart < oText.length && diffStart < pText.length && oText[diffStart] === pText[diffStart]) {
                                                                    diffStart++;
                                                                }
                                                            }
                                                        }
                                                        
                                                        // Select in preview textarea
                                                        setTimeout(() => {
                                                            if (textareaRef.current) {
                                                                const node = textareaRef.current;
                                                                const exactTop = getTextareaCharTop(node, diffStart);
                                                                const targetScroll = Math.max(0, exactTop - (node.clientHeight / 2));
                                                                
                                                                isRestoringScrollRef.current = true;
                                                                node.focus({ preventScroll: true });
                                                                node.setSelectionRange(diffStart, diffStart);
                                                                
                                                                node.scrollTo({
                                                                    top: targetScroll,
                                                                    behavior: 'smooth'
                                                                });
                                                            }
                                                        }, 50);`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('src/components/ProjectScriptBible.tsx', code);
  console.log("Success: restored click handler");
} else {
  console.log("Failed to find click target");
}
