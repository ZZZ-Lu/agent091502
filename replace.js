const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      if (!file.includes('node_modules') && !file.includes('dist')) {
        results = results.concat(walk(file));
      }
    } else { 
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk('./src');
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;
  
  // Find matches to print them out before replacing
  const regex = /(?<!dark:)(?<!dark:hover:)(?<!dark:focus:)(?<!text-)(?<!border-)(?<!ring-)\b(hover:)?bg-white\b(\/[0-9]+)?/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    console.log(`${file}: found ${match[0]}`);
  }
});
