const fs = require('fs');
let content = fs.readFileSync('src/components/GenerationCard.tsx', 'utf8');

content = content.replace(
  'className="text-white/95 text-[11px] font-medium truncate leading-none tracking-wide"',
  'className="text-white/95 text-[13px] font-medium truncate leading-none tracking-wide"'
);

fs.writeFileSync('src/components/GenerationCard.tsx', content);
console.log('Patched font size to 13px');
