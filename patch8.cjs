const fs = require('fs');
const file = 'src/components/GenerationCard.tsx';
let content = fs.readFileSync(file, 'utf8');

const target = `              <div className="absolute inset-0 w-full h-full overflow-hidden squircle group/video pointer-events-auto">
                <motion.video`;

const replacement = `              <div className="absolute inset-0 w-full h-full overflow-hidden squircle group/video pointer-events-auto">
                {(isHovered || isPlaying) && (
                  <motion.video`;

content = content.replace(target, replacement);

const target2 = `                    <div 
                      className="absolute inset-0 flex items-center justify-center bg-black/25 hover:bg-black/35 transition-colors pointer-events-none"
                    >`;

const replacement2 = `                )}
                {!isPlaying ? (() => {
                  const narrowerSide = Math.min(w, h);
                  const playButtonDiameter = narrowerSide / 2;
                  const playButtonIconSize = playButtonDiameter * 0.76;
                  return (
                    <div 
                      className="absolute inset-0 flex items-center justify-center bg-black/25 hover:bg-black/35 transition-colors pointer-events-none"
                    >`;

// We have to be careful not to double add the play button logic if it's already there. Let's just rewrite the whole inner block of that div.
