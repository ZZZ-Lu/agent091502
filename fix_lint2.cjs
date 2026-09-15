const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

const t1 = `    }
    return { x: 0, y: 0, scale: 1 };
  }, [updateRenderedBounds]);
  const tx = useMotionValue(initialTransform.x);`;

const r1 = `    }
    return { x: 0, y: 0, scale: 1 };
  }, []);
  const tx = useMotionValue(initialTransform.x);`;

content = content.replace(t1, r1);

const t2 = `const gridBackgroundSize = useTransform(tScale, s => \`\${s * 48}px \${s * 48}px\`);`;
const r2 = `const gridBackgroundSize = useTransform(tScale, (s: any) => \`\${s * 48}px \${s * 48}px\`);`;
content = content.replace(t2, r2);

fs.writeFileSync('src/App.tsx', content);
