const fs = require('fs');

// Patch GenerationCard.tsx
let genCard = fs.readFileSync('src/components/GenerationCard.tsx', 'utf8');
genCard = genCard.replace(
  'const dpr = showOriginal ? Math.min(currentScale, 3.5) : 1;',
  'const dpr = showOriginal ? Math.min(currentScale, 8.0) : 1;'
);
fs.writeFileSync('src/components/GenerationCard.tsx', genCard);

// Patch CardImageCanvas.tsx
let canvasCard = fs.readFileSync('src/components/CardImageCanvas.tsx', 'utf8');
canvasCard = canvasCard.replace(
  '? Math.min(Math.max(window.devicePixelRatio || 1, currentDpr), 3.5)',
  '? Math.min(Math.max(window.devicePixelRatio || 1, currentDpr), 8.0)'
);
fs.writeFileSync('src/components/CardImageCanvas.tsx', canvasCard);

console.log('Patched DPR Limits to 8.0');
