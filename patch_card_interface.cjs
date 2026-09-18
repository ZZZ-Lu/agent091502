const fs = require('fs');
let content = fs.readFileSync('src/components/GenerationCard.tsx', 'utf8');

content = content.replace(
  '  fileName?: string;\n}',
  '  fileName?: string;\n  nativeWidth?: number;\n  nativeHeight?: number;\n}'
);

fs.writeFileSync('src/components/GenerationCard.tsx', content);
console.log('Patched GenerationCard.tsx interface');
