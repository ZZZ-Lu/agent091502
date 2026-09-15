const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

const boundsTarget = `    // Buffer size (e.g. 1.5x screen size) to prevent pop-in during fast drags
    const bufferX = (visibleMaxX - visibleMinX) * 1.5;
    const bufferY = (visibleMaxY - visibleMinY) * 1.5;`;
const boundsReplace = `    // Extended buffer size (2.5x screen size) so cards don't unmount before they finish fading out
    const bufferX = (visibleMaxX - visibleMinX) * 2.5;
    const bufferY = (visibleMaxY - visibleMinY) * 2.5;`;
content = content.replace(boundsTarget, boundsReplace);

const renderTarget = `          <GenerationCard 
            key={card.id}
            data={card}
            scale={tScale}`;
const renderReplace = `          <GenerationCard 
            key={card.id}
            data={card}
            scale={tScale}
            tx={tx}
            ty={ty}`;
content = content.replace(renderTarget, renderReplace);

fs.writeFileSync('src/App.tsx', content);
console.log("Updated App.tsx");
