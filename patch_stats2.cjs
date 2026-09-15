const fs = require('fs');
let code = fs.readFileSync('src/components/ProjectScriptBible.tsx', 'utf8');

const target = `                {/* Bottom Right Floating Stats */}
                <div className="absolute bottom-5 right-8 pointer-events-none select-none flex gap-4 text-gray-400 dark:text-neutral-500 opacity-70">
                  <div>
                    <div className="text-sm font-medium tracking-wide">{(scriptDraft || '').length}</div>
                    <div className="text-[11px] mt-0.5">字</div>
                  </div>
                  <div className="flex items-end pb-[5px]">
                    <div className="w-1 h-1 rounded-full bg-gray-400 dark:bg-neutral-600"></div>
                  </div>
                  <div>
                    <div className="text-sm font-medium tracking-wide">{scriptDraft ? scriptDraft.split('\\n').length : 0}</div>
                    <div className="text-[11px] mt-0.5">行</div>
                  </div>
                </div>`;

const replacement = `                {/* Bottom Right Floating Stats */}
                <div className="absolute bottom-5 right-6 pointer-events-none select-none flex items-center gap-2.5 text-gray-400 dark:text-neutral-500 opacity-60">
                  <div className="flex flex-col items-center">
                    <span className="text-[11px] font-medium tabular-nums leading-none">{(scriptDraft || '').length}</span>
                    <span className="text-[10px] leading-none mt-1.5">字</span>
                  </div>
                  <span className="text-[12px] leading-none mt-3.5 opacity-60">·</span>
                  <div className="flex flex-col items-center">
                    <span className="text-[11px] font-medium tabular-nums leading-none">{scriptDraft ? scriptDraft.split('\\n').length : 0}</span>
                    <span className="text-[10px] leading-none mt-1.5">行</span>
                  </div>
                </div>`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('src/components/ProjectScriptBible.tsx', code);
  console.log("Success");
} else {
  console.log("Failed to find target");
}
