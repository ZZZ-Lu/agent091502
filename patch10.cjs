const fs = require('fs');
let content = fs.readFileSync('temp.txt', 'utf8');

const endPattern = `                    </span>
                  </div>
                </div>`;

const endReplacement = `                    </span>
                  </div>
                </div>
                )}`;

content = content.replace(endPattern, endReplacement);
fs.writeFileSync('src/components/GenerationCard.tsx', content);
console.log('Patched');
