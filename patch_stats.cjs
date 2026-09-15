const fs = require('fs');
let code = fs.readFileSync('src/components/ProjectScriptBible.tsx', 'utf8');

const targetLines = `                        <span>·</span>
                        <span data-agent-target="script.version.status" className="max-w-[150px] truncate" title={versionStatus}>
                          {versionStatus}
                        </span>
                        <span>·</span>
                        <span>{(scriptDraft || '').length} 字</span>

                        <span>·</span>
                        <span>{scriptDraft ? scriptDraft.split('\\n').length : 0} 行</span>`;

// Alternative replacement by using exact block
const toReplace = `                        <span>·</span>
                        <span data-agent-target="script.version.status" className="max-w-[150px] truncate" title={versionStatus}>
                          {versionStatus}
                        </span>
                        <span>·</span>
                        <span>{(scriptDraft || '').length} 字</span>

                        <span>·</span>
                        <span>{scriptDraft ? scriptDraft.split('\\n').length : 0} 行</span>`;

const regex = /<span>·<\/span>\s*<span data-agent-target="script.version.status" className="max-w-\[150px\] truncate" title=\{versionStatus\}>\s*\{versionStatus\}\s*<\/span>\s*<span>·<\/span>\s*<span>\{\(scriptDraft \|\| ''\)\.length\} 字<\/span>\s*<span>·<\/span>\s*<span>\{scriptDraft \? scriptDraft\.split\('\\n'\)\.length : 0\} 行<\/span>/;

const newString = `<span>·</span>
                        <span data-agent-target="script.version.status" className="max-w-[150px] truncate" title={versionStatus}>
                          {versionStatus}
                        </span>`;
code = code.replace(regex, newString);
fs.writeFileSync('src/components/ProjectScriptBible.tsx', code);
