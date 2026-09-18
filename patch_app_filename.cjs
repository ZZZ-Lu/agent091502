const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  "        customHeight: customHeight,\n      };",
  "        customHeight: customHeight,\n        fileName: file.name,\n      };"
);

fs.writeFileSync('src/App.tsx', content);
console.log('Patched App.tsx');
