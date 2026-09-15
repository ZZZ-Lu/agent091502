const fs = require('fs');
let code = fs.readFileSync('src/components/ProjectScriptBible.tsx', 'utf8');

const target = `                {isAnimationSettled ? (
                  <textarea
                    key={\`script-\${currentProject.id}\`}
                    ref={handleTextareaRef}
                    data-agent-target="script.text"
                    data-agent-actions="mouse.move mouse.click mouse.hover mouse.drag mouse.scroll mouse.type mouse.keyPress"
                    value={previewVersionId ? getPreviewText() : scriptDraft}
                    readOnly={!!previewVersionId}
                    onChange={handleScriptChange}
                    onScroll={handleScriptScroll}
                    onSelect={(event) => {
                      const node = event.currentTarget;
                      const start = node.selectionStart;
                      const end = node.selectionEnd;
                      updateSceneIndicator(node.value, start);
                      if (start === end) return onSelectionChange(null);
                      onSelectionChange({
                        text: node.value.slice(start, end), start, end,
                        lineStart: node.value.slice(0, start).split('\\n').length,
                        lineEnd: node.value.slice(0, end).split('\\n').length,
                      });
                    }}
                    placeholder="在此直接输入或粘贴剧本正文...&#10;&#10;例如：&#10;【场 1】内景. 房间 - 夜&#10;主角坐在桌前，窗外微风拂过...&#10;&#10;【场 2】外景. 街道 - 日&#10;阳光穿透树梢，洒在人行道上..."
                    className={\`w-full flex-1 h-full pl-[22px] pr-[17px] pt-4 pb-4 text-[14px] font-medium leading-relaxed bg-transparent border-0 outline-none text-gray-800 dark:text-neutral-300 placeholder-gray-400 dark:placeholder-neutral-500 resize-none overflow-y-auto transition-opacity duration-200 ease-out \${
                      isPositionReady ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }\`}
                    spellCheck={false}
                  />
                ) : (`;

const replacement = `                {isAnimationSettled ? (
                  previewVersionId && previewDiff ? (
                      <div
                        className={\`w-full flex-1 h-full pl-[22px] pr-[17px] pt-4 pb-4 text-[14px] font-medium leading-relaxed bg-transparent border-0 outline-none text-gray-800 dark:text-neutral-300 overflow-y-auto whitespace-pre-wrap break-words transition-opacity duration-200 ease-out \${
                          isPositionReady ? 'opacity-100' : 'opacity-0 pointer-events-none'
                        }\`}
                      >
                          {(() => {
                              let firstChangeFound = false;
                              return previewDiff.map((part, index) => {
                                  const isChanged = part.added || part.removed;
                                  let props: any = { key: index };
                                  
                                  if (isChanged && !firstChangeFound) {
                                      firstChangeFound = true;
                                      props.id = 'diff-first-change';
                                  }
                                  
                                  if (part.added) {
                                      props.className = "bg-green-200 dark:bg-green-900/50 text-green-800 dark:text-green-200";
                                  } else if (part.removed) {
                                      props.className = "bg-red-200 dark:bg-red-900/50 text-red-800 dark:text-red-300 line-through opacity-70";
                                  }
                                  return <span {...props}>{part.value}</span>;
                              });
                          })()}
                      </div>
                  ) : (
                      <textarea
                        key={\`script-\${currentProject.id}\`}
                        ref={handleTextareaRef}
                        data-agent-target="script.text"
                        data-agent-actions="mouse.move mouse.click mouse.hover mouse.drag mouse.scroll mouse.type mouse.keyPress"
                        value={scriptDraft}
                        onChange={handleScriptChange}
                        onScroll={handleScriptScroll}
                        onSelect={(event) => {
                          const node = event.currentTarget;
                          const start = node.selectionStart;
                          const end = node.selectionEnd;
                          updateSceneIndicator(node.value, start);
                          if (start === end) return onSelectionChange(null);
                          onSelectionChange({
                            text: node.value.slice(start, end), start, end,
                            lineStart: node.value.slice(0, start).split('\\n').length,
                            lineEnd: node.value.slice(0, end).split('\\n').length,
                          });
                        }}
                        placeholder="在此直接输入或粘贴剧本正文...&#10;&#10;例如：&#10;【场 1】内景. 房间 - 夜&#10;主角坐在桌前，窗外微风拂过...&#10;&#10;【场 2】外景. 街道 - 日&#10;阳光穿透树梢，洒在人行道上..."
                        className={\`w-full flex-1 h-full pl-[22px] pr-[17px] pt-4 pb-4 text-[14px] font-medium leading-relaxed bg-transparent border-0 outline-none text-gray-800 dark:text-neutral-300 placeholder-gray-400 dark:placeholder-neutral-500 resize-none overflow-y-auto transition-opacity duration-200 ease-out \${
                          isPositionReady ? 'opacity-100' : 'opacity-0 pointer-events-none'
                        }\`}
                        spellCheck={false}
                      />
                  )
                ) : (`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('src/components/ProjectScriptBible.tsx', code);
  console.log("Success: replaced textarea logic");
} else {
  console.log("Failed to find target");
}
