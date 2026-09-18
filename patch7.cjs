const fs = require('fs');
const file = 'src/components/GenerationCard.tsx';
let content = fs.readFileSync(file, 'utf8');

const target = `            <div 
              className="absolute inset-0 overflow-hidden squircle pointer-events-auto"
              style={{
                width: w * dpr,`;

const replacement = `            <div 
              className="absolute inset-0 overflow-hidden squircle pointer-events-auto"
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              style={{
                width: w * dpr,`;

content = content.replace(target, replacement);
fs.writeFileSync(file, content);
console.log('Patched');
