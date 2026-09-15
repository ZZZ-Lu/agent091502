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

  // Find all background opacity modifiers like bg-white/95 or dark:bg-neutral-900/95 and remove the /XX part
  content = content.replace(/\b(bg-[a-z]+-[0-9]+)\/[0-9]+\b/g, '$1');
  // Handle bg-white/XX and bg-black/XX specially
  content = content.replace(/\b(bg-(?:white|black|transparent))\/[0-9]+\b/g, '$1');
  
  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Removed background opacity from ${file}`);
  }
});
