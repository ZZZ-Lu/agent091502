const fs = require('fs');
const file = 'src/components/GenerationCard.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  '              originalImageUrl={data.originalImageUrl}\\n              showOriginal={showOriginal}',
  '              originalImageUrl={data.originalImageUrl}\n              showOriginal={showOriginal}'
);

fs.writeFileSync(file, content);
console.log('Patched');
