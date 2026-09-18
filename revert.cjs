const fs = require('fs');
let content = fs.readFileSync('src/components/GenerationCard.tsx', 'utf8');

// Undo the first replacement (isHovered || isPlaying) && <motion.video
content = content.replace('{(isHovered || isPlaying) && <motion.video', '<motion.video');

// Now we need to remove the `}` that I added after the motion.video ended.
// The easiest way is to use regex or find where `onPause` ends.
const onPauseEnd = content.indexOf('onUpdate(id, updates, false);\n                  }}\n                />');
if (onPauseEnd !== -1) {
    const replaceStart = onPauseEnd + 'onUpdate(id, updates, false);\n                  }}\n                />'.length;
    // I inserted a `}` right here
    if (content[replaceStart] === '}') {
        content = content.slice(0, replaceStart) + content.slice(replaceStart + 1);
    }
}

// Remove the `{(isHovered || isPlaying) && (` before progress bar
content = content.replace('{(isHovered || isPlaying) && ({/* Progress Bar Controller Overlay */}', '{/* Progress Bar Controller Overlay */}');

// Remove the closing `)}` or `</> )}` after the progress bar
content = content.replace('                    </span>\n                  </div>\n                </div>\n                </> )}\n              </div>', '                    </span>\n                  </div>\n                </div>\n              </div>');
content = content.replace('                    </span>\n                  </div>\n                </div>\n                )}\n              </div>', '                    </span>\n                  </div>\n                </div>\n              </div>');

fs.writeFileSync('src/components/GenerationCard.tsx', content);
