const fs = require('fs');
let content = fs.readFileSync('src/components/GenerationCard.tsx', 'utf8');

const target = `        {/* Empty State Placeholder (SVG matching user request) */}`;
const replacement = `        {/* Resolution Tag */}
        {resolutionTag && (
          <div 
            className="absolute z-[60] pointer-events-none group-data-[scale-micro=true]/canvas:opacity-0 transition-opacity duration-300"
            style={{
              top: 'calc(12px / var(--current-scale, 1))',
              right: 'calc(12px / var(--current-scale, 1))',
              transform: 'scale(calc(1 / var(--current-scale, 1)))',
              transformOrigin: 'top right',
            }}
          >
            <div className="bg-black/60 px-2 py-1 rounded-md border border-white/10 shadow-sm flex items-center">
              <span className="text-white/90 text-[10px] uppercase font-bold tracking-wider">{resolutionTag}</span>
            </div>
          </div>
        )}

        {/* Empty State Placeholder (SVG matching user request) */}`;

content = content.replace(target, replacement);
fs.writeFileSync('src/components/GenerationCard.tsx', content);
console.log('Patched resolution UI');
