const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

const target = `    }
  }, []);

  useEffect(() => {
    (window as any).resetGlobalZoomTimer = () => {`;

const replace = `    }
  }, [updateRenderedBounds]);

  useEffect(() => {
    (window as any).resetGlobalZoomTimer = () => {`;

content = content.replace(target, replace);
fs.writeFileSync('src/App.tsx', content);
console.log("Updated deps");
