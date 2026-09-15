const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const targetStr = `    if (action === 'mouse.scroll' && targetId === 'script.toc.list') {
      setTocOpen(true);
      const requestedDelta = Number(arguments_.delta);
      const delta = Number.isFinite(requestedDelta) && requestedDelta !== 0 ? requestedDelta : 480;
      setTocScrollRequest(previous => ({ id: (previous?.id ?? 0) + 1, delta }));
    }
    if (action === 'mouse.scroll' && targetId === 'script.text') {
      const target = document.querySelector(\`[data-agent-target="\${targetId}"]\`);
      const requestedDelta = Number(arguments_.delta);
      const delta = Number.isFinite(requestedDelta) && requestedDelta !== 0 ? requestedDelta : 480;
      if (target instanceof HTMLElement) target.scrollBy({ top: delta, behavior: 'smooth' });
    }`;

const newStr = `    if (action === 'mouse.scroll' && (targetId === 'script.toc.list' || targetId === 'script.text')) {
      let delta = 480;
      if (arguments_.direction === 'top') delta = -999999;
      else if (arguments_.direction === 'bottom') delta = 999999;
      else if (arguments_.direction === 'up') delta = -480;
      else if (arguments_.direction === 'down') delta = 480;
      else {
        const requestedDelta = Number(arguments_.delta);
        if (Number.isFinite(requestedDelta) && requestedDelta !== 0) delta = requestedDelta;
      }
      
      if (targetId === 'script.toc.list') {
        setTocOpen(true);
        setTocScrollRequest(previous => ({ id: (previous?.id ?? 0) + 1, delta }));
      } else if (targetId === 'script.text') {
        const target = document.querySelector(\`[data-agent-target="\${targetId}"]\`);
        if (target instanceof HTMLElement) target.scrollBy({ top: delta, behavior: 'smooth' });
      }
    }`;

if (code.includes(targetStr)) {
  code = code.replace(targetStr, newStr);
  fs.writeFileSync('src/App.tsx', code, 'utf-8');
  console.log('patched');
} else {
  console.log('not found');
}
