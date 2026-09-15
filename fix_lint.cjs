const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

// Fix line 122
content = content.replace(/  }, \[updateRenderedBounds\]);\n  const tx = useMotionValue\(initialTransform\.x\);/, '  }, []);\n  const tx = useMotionValue(initialTransform.x);');

// Fix line 130
content = content.replace(/useTransform\(tScale, s =>/g, 'useTransform(tScale, (s: any) =>');

fs.writeFileSync('src/App.tsx', content);
