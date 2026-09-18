const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');
const searchStr = `          containerRef.current?.setPointerCapture(e.pointerId);
        }
      }
    }

    // Only start dragging on middle click`;
const replaceStr = `          containerRef.current?.setPointerCapture(e.pointerId);
        }
    }

    // Only start dragging on middle click`;
code = code.replace(searchStr, replaceStr);
fs.writeFileSync('src/App.tsx', code);
