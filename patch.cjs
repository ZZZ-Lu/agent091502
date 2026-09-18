const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Remove calculateOverviewCamera, animateCameraTo, and the keyboard event block.
const startMarker = '// --- Overview Mode (Hold Space) ---';
const endMarker = '  useEffect(() => {\n    const container = containerRef.current;';
const startIndex = code.indexOf(startMarker);
const endIndex = code.indexOf(endMarker);

if (startIndex !== -1 && endIndex !== -1) {
    code = code.substring(0, startIndex) + code.substring(endIndex);
} else {
    console.log("Could not find start/end markers for overview logic");
}

// 2. Remove the pointer capture block
const pointerStartMarker = '// Navigation during overview mode';
const pointerEndMarker = '// INTENT SIGNAL: Intercept left-clicks in the capture phase.';

const pStart = code.indexOf(pointerStartMarker);
const pEnd = code.indexOf(pointerEndMarker);

if (pStart !== -1 && pEnd !== -1) {
    code = code.substring(0, pStart) + code.substring(pEnd);
} else {
    console.log("Could not find pointer block markers");
}

fs.writeFileSync('src/App.tsx', code);
