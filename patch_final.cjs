const fs = require('fs');
let content = fs.readFileSync('src/components/GenerationCard.tsx', 'utf8');

// 1. Wrap motion.video
const videoStart = content.indexOf('<motion.video');
const videoEndStr = 'onUpdate(id, updates, false);\n                  }}\n                />';
const videoEnd = content.indexOf(videoEndStr) + videoEndStr.length;

const videoBlock = content.slice(videoStart, videoEnd);
content = content.slice(0, videoStart) + '{(isHovered || isPlaying) && (\n                  ' + videoBlock + '\n                )}' + content.slice(videoEnd);


// 2. Wrap Progress Bar Controller Overlay
const progressComment = '{/* Progress Bar Controller Overlay */}';
const progressStart = content.indexOf(progressComment);
const progressEndStr = '                    </span>\n                  </div>\n                </div>';
const progressEnd = content.indexOf(progressEndStr, progressStart) + progressEndStr.length;

const progressBlockStart = progressStart + progressComment.length;
const progressBlock = content.slice(progressBlockStart, progressEnd);

const newProgressBlock = progressComment + '\n                {(isHovered || isPlaying) && (' + progressBlock + '\n                )}';
content = content.slice(0, progressStart) + newProgressBlock + content.slice(progressEnd);

fs.writeFileSync('src/components/GenerationCard.tsx', content);
console.log('Patched');
