const fs = require('fs');
let code = fs.readFileSync('src/components/ProjectScriptBible.tsx', 'utf8');

const target = `                                                        const pText = getVersionText();
                                                        // basic diff logic: find first diff
                                                        let diffStart = 0;
                                                        while (diffStart < scriptDraft.length && diffStart < pText.length && scriptDraft[diffStart] === pText[diffStart]) {
                                                            diffStart++;
                                                        }
                                                        
                                                        if (diffStart < pText.length || diffStart < scriptDraft.length) {
                                                            // We found a difference
                                                            // Find the end from the back
                                                            let endO = scriptDraft.length - 1;
                                                            let endP = pText.length - 1;
                                                            while (endO >= diffStart && endP >= diffStart && scriptDraft[endO] === pText[endP]) {
                                                                endO--;
                                                                endP--;
                                                            }
                                                            
                                                            // Select in preview textarea
                                                            setTimeout(() => {
                                                                if (textareaRef.current) {
                                                                    const node = textareaRef.current;
                                                                    const exactTop = getTextareaCharTop(node, diffStart);
                                                                    const targetScroll = Math.max(0, exactTop - (node.clientHeight / 2));
                                                                    
                                                                    isRestoringScrollRef.current = true;
                                                                    node.focus({ preventScroll: true });
                                                                    node.setSelectionRange(diffStart, endP + 1);
                                                                    
                                                                    node.scrollTo({
                                                                        top: targetScroll,
                                                                        behavior: 'smooth'
                                                                    });
                                                                }
                                                            }, 50);
                                                        }`;

const replacement = `                                                        // Wait for the diff view to render, then scroll to the first change
                                                        setTimeout(() => {
                                                            const firstChange = document.getElementById('diff-first-change');
                                                            if (firstChange) {
                                                                firstChange.scrollIntoView({ block: 'center', behavior: 'smooth' });
                                                            }
                                                        }, 50);`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('src/components/ProjectScriptBible.tsx', code);
  console.log("Success: replaced preview scroll logic");
} else {
  console.log("Failed to find target");
}
