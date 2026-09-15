const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

// 1. Remove useMotionValueEvent calls for updateRenderedBounds
content = content.replace(/useMotionValueEvent\(tx, "change", updateRenderedBounds\);\n?/g, '');
content = content.replace(/useMotionValueEvent\(ty, "change", updateRenderedBounds\);\n?/g, '');
content = content.replace(/useMotionValueEvent\(tScale, "change", updateRenderedBounds\);\n?/g, '');

// 2. Add updateRenderedBounds to restoreCanvasStyles
const restoreTarget = `  const restoreCanvasStyles = useCallback(() => {
    // If the user is actively dragging the canvas OR a card, strictly forbid restoration
    if (isDraggingCanvasRef.current || (window as any).isDraggingCard) return;
    
    const workspace = document.getElementById('canvas-workspace');`;

const restoreReplace = `  const restoreCanvasStyles = useCallback(() => {
    // If the user is actively dragging the canvas OR a card, strictly forbid restoration
    if (isDraggingCanvasRef.current || (window as any).isDraggingCard) return;
    
    // Garbage Collection / Mount Trigger: Only update bounds when idle!
    updateRenderedBounds();
    
    const workspace = document.getElementById('canvas-workspace');`;

content = content.replace(restoreTarget, restoreReplace);

// 3. Update the dependency array of restoreCanvasStyles
const restoreDepsTarget = `  }, []);`;
const restoreDepsReplace = `  }, [updateRenderedBounds]);`;
content = content.replace(restoreDepsTarget, restoreDepsReplace);

fs.writeFileSync('src/App.tsx', content);
console.log("Updated App.tsx");
