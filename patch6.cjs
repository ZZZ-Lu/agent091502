const fs = require('fs');
const file = 'src/components/GenerationCard.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  '  const [isPlaying, setIsPlaying] = useState(false);',
  '  const [isPlaying, setIsPlaying] = useState(false);\n  const [isHovered, setIsHovered] = useState(false);'
);

fs.writeFileSync(file, content);
console.log('Patched');
