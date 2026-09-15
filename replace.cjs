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
  
  content = content.replace(/(?<!dark:)\bhover:bg-white\b(\/[0-9]+)?/g, (match, p1) => {
    return 'hover:bg-gray-100' + (p1 || '');
  });

  content = content.replace(/(?<!dark:)\bfocus:bg-white\b(\/[0-9]+)?/g, (match, p1) => {
    return 'focus:bg-gray-100' + (p1 || '');
  });

  content = content.replace(/(?<!dark:)(?<!hover:)(?<!focus:)(?<!text-)(?<!border-)(?<!ring-)(?<!peer-checked:)\bbg-white\b(\/[0-9]+)?/g, (match, p1) => {
    return 'bg-gray-50' + (p1 || '');
  });

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Replaced in ${file}`);
  }
});
