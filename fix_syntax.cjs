const fs = require('fs');
let content = fs.readFileSync('src/constants/prompts.ts', 'utf-8');

// Replace the problematic backticks with normal quotes or escaped backticks
content = content.replace(/- \`tocPattern\`/g, "- 'tocPattern'");
content = content.replace(/- \`scenePattern\`/g, "- 'scenePattern'");
content = content.replace(/- \`types\`/g, "- 'types'");

fs.writeFileSync('src/constants/prompts.ts', content);
