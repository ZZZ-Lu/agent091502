const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

const targetStr = `className="w-screen h-screen overflow-hidden bg-[#e7e7e7] dark:bg-[#1c1c1e] relative select-none touch-none transition-colors duration-300"`;
const replaceStr = `className="w-screen h-screen overflow-hidden bg-[#e7e7e7] dark:bg-[#1c1c1e] relative select-none touch-none transition-colors duration-[600ms]"`;

if (content.includes(targetStr)) {
  content = content.replace(targetStr, replaceStr);
  fs.writeFileSync('src/App.tsx', content);
  console.log("Updated transition duration in src/App.tsx");
} else {
  console.log("Could not find the target string.");
}
