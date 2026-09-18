const fs = require('fs');
const lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');
const start = lines.findIndex(l => l.includes('const onPointerDown = (e: React.PointerEvent) => {'));
const end = lines.findIndex((l, i) => i > start && l.includes('const onPointerMove = (e: React.PointerEvent) => {'));
console.log(lines.slice(start, end).join('\n'));
