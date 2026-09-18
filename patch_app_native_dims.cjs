const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  '        fileName: file.name,\n      };',
  '        fileName: file.name,\n        nativeWidth: width,\n        nativeHeight: height,\n      };'
);

fs.writeFileSync('src/App.tsx', content);
console.log('Patched App.tsx native dims');
