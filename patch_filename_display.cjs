const fs = require('fs');
let content = fs.readFileSync('src/components/GenerationCard.tsx', 'utf8');

const target = `{/* Top Layer: Image Placeholder & Drag Handle */}
        <div 
          className=\`pointer-events-auto relative shrink-0 overflow-hidden`;

const replacement = `{/* Top Layer: Image Placeholder & Drag Handle */}
        <div 
          className=\`pointer-events-auto relative shrink-0 overflow-hidden`;

// Wait, I'll insert it right after `style={{ ... }}>`. Let's find `outlineWidth: isSelected ? 'calc(2px / var(--current-scale, 1))' : '0px',\n          }}` or `onPointerCancel={onPointerUp}\n        >`

const injectTarget = `        >
        {/* Empty State Placeholder (SVG matching user request) */}`;

const injectReplacement = `        >
        {/* File Name Tag */}
        {data.fileName && (
          <div className="absolute top-3 left-3 z-[60] max-w-[85%] pointer-events-none group-data-[scale-micro=true]/canvas:opacity-0 transition-opacity duration-300">
            <div className="bg-black/60 px-2.5 py-1.5 rounded-lg border border-white/10 shadow-sm flex items-center">
              <span className="text-white/95 text-[11px] font-medium truncate leading-none tracking-wide">{data.fileName}</span>
            </div>
          </div>
        )}

        {/* Empty State Placeholder (SVG matching user request) */}`;

content = content.replace(injectTarget, injectReplacement);

fs.writeFileSync('src/components/GenerationCard.tsx', content);
console.log('Patched');
