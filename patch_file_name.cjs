const fs = require('fs');
let content = fs.readFileSync('src/components/GenerationCard.tsx', 'utf8');

content = content.replace(
  '  customHeight?: number;\n}',
  '  customHeight?: number;\n  fileName?: string;\n}'
);

fs.writeFileSync('src/components/GenerationCard.tsx', content);
console.log('Patched');
