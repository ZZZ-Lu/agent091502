const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

const targetStr = `        {/* Selection Box */}
        {selectionBox && (
          <div
            className="absolute border-blue-500/50 bg-blue-500 pointer-events-none z-[200]"`;

const replaceStr = `        {/* Selection Box */}
        {selectionBox && (
          <div
            className="absolute border-blue-500/50 bg-blue-500/20 pointer-events-none z-[200]"`;

if (content.includes(targetStr)) {
  content = content.replace(targetStr, replaceStr);
  fs.writeFileSync('src/App.tsx', content);
  console.log("Successfully updated selection box opacity");
} else {
  console.log("Target string not found in src/App.tsx");
}
