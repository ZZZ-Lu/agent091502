const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const target = `  // Inject real-time scale as CSS variable for GPU-accelerated constant-width borders
  useMotionValueEvent(tScale, "change", (latestScale) => {
    const workspace = document.getElementById('canvas-workspace');
    if (workspace) {
      workspace.style.setProperty('--current-scale', latestScale.toString());
    }
  });`;

const replacement = `  // Inject real-time scale as CSS variable for GPU-accelerated constant-width borders
  const updateCurrentScale = (latestScale: number) => {
    const workspace = document.getElementById('canvas-workspace');
    if (workspace) {
      workspace.style.setProperty('--current-scale', latestScale.toString());
    }
  };
  
  useMotionValueEvent(tScale, "change", updateCurrentScale);
  
  // Set initial scale on mount
  useEffect(() => {
    updateCurrentScale(tScale.get());
  }, []);`;

content = content.replace(target, replacement);
fs.writeFileSync('src/App.tsx', content);
console.log('Patched App.tsx initial scale');
