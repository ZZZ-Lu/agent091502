const fs = require('fs');
let content = fs.readFileSync('src/components/GenerationCard.tsx', 'utf8');

const target = `                        onClick={(e) => {
                          e.stopPropagation();
                          if (videoRef.current) {
                            videoRef.current.play();
                            setIsPlaying(true);
                          }
                        }}`;

const replacement = `                        onClick={(e) => {
                          e.stopPropagation();
                          setIsPlaying(true);
                          if (videoRef.current) {
                            videoRef.current.play().catch(console.error);
                          }
                        }}`;

content = content.replace(target, replacement);
fs.writeFileSync('src/components/GenerationCard.tsx', content);
console.log('Patched');
