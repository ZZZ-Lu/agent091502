import re

with open('src/App.tsx', 'r') as f:
    code = f.read()

target_str = """    if (action === 'mouse.click') {
      if (targetId === 'script-bible-toggle') setDrawerOpen(!scriptViewRef.current.drawerOpen);
      else if (targetId === 'script.close') setDrawerOpen(false);
      else if (targetId === 'script.view.script') setScriptView('script');
      else if (targetId === 'script.toc.open') setTocOpen(!scriptViewRef.current.tocOpen);
      else if (targetId.startsWith('script.toc.item.')) {
        setRequestedTocItemId(targetId.replace('script.toc.item.', ''));
      }
    }"""

new_str = """    if (action === 'mouse.click') {
      const target = document.querySelector(`[data-agent-target="${targetId}"]`);
      if (target instanceof HTMLElement) {
        target.click();
      }
      
      // Fallback manual mappings for global state changes
      if (targetId === 'script-bible-toggle') setDrawerOpen(!scriptViewRef.current.drawerOpen);
      else if (targetId === 'script.close') setDrawerOpen(false);
      else if (targetId === 'script.view.script') setScriptView('script');
      else if (targetId === 'script.view.assets') setScriptView('assets');
      else if (targetId === 'script.view.universe') setScriptView('universe');
      else if (targetId === 'script.toc.open') setTocOpen(!scriptViewRef.current.tocOpen);
      else if (targetId.startsWith('script.toc.item.')) {
        setRequestedTocItemId(targetId.replace('script.toc.item.', ''));
      }
    }"""

code = code.replace(target_str, new_str)

with open('src/App.tsx', 'w') as f:
    f.write(code)
