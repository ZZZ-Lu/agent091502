const fs = require('fs');
let content = fs.readFileSync('src/components/GenerationCard.tsx', 'utf8');

content = content.replace(
  '{(isHovered || isPlaying) && ({/* Progress Bar Controller Overlay */}                <div',
  '{(isHovered || isPlaying) && ( <>\n{/* Progress Bar Controller Overlay */}                <div'
);

content = content.replace(
  `                    </span>
                  </div>
                </div>
                )}
              </div>`,
  `                    </span>
                  </div>
                </div>
                </> )}
              </div>`
);

fs.writeFileSync('src/components/GenerationCard.tsx', content);
console.log('Patched');
