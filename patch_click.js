const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const targetStr = `    if (action === 'mouse.click') {
      if (targetId === 'script-bible-toggle') setDrawerOpen(!scriptViewRef.current.drawerOpen);
      else if (targetId === 'script.close') setDrawerOpen(false);
      else if (targetId === 'script.view.script') setScriptView('script');
      else if (targetId === 'script.toc.open') setTocOpen(!scriptViewRef.current.tocOpen);
      else if (targetId.startsWith('script.toc.item.')) {
        setRequestedTocItemId(targetId.replace('script.toc.item.', ''));
      }
    }`;

const newStr = `    if (action === 'mouse.click') {
      const target = document.querySelector(\`[data-agent-target="\${targetId}"]\`);
      if (target instanceof HTMLElement) {
        target.click();
      }
      
      // Fallback manual mappings just in case they don't trigger properly via .click()
      if (targetId === 'script-bible-toggle') setDrawerOpen(!scriptViewRef.current.drawerOpen);
      else if (targetId === 'script.close') setDrawerOpen(false);
      else if (targetId === 'script.view.script') setScriptView('script');
      else if (targetId === 'script.view.assets') setScriptView('assets');
      else if (targetId === 'script.view.universe') setScriptView('universe');
      else if (targetId === 'script.toc.open') setTocOpen(!scriptViewRef.current.tocOpen);
      else if (targetId.startsWith('script.toc.item.')) {
        setRequestedTocItemId(targetId.replace('script.toc.item.', ''));
      }
    }`;

code = code.replace(targetStr, newStr);
fs.writeFileSync('src/App.tsx', code);
