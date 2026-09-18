const fs = require('fs');
let content = fs.readFileSync('src/components/GenerationCard.tsx', 'utf8');

const target = `{/* File Name Tag */}
        {data.fileName && (
          <div className="absolute top-3 left-3 z-[60] max-w-[85%] pointer-events-none group-data-[scale-micro=true]/canvas:opacity-0 transition-opacity duration-300">
            <div className="bg-black/60 px-2.5 py-1.5 rounded-lg border border-white/10 shadow-sm flex items-center">
              <span className="text-white/95 text-[11px] font-medium truncate leading-none tracking-wide">{data.fileName}</span>
            </div>
          </div>
        )}`;

const replacement = `{/* File Name Tag */}
        {data.fileName && (
          <div 
            className="absolute z-[60] pointer-events-none group-data-[scale-micro=true]/canvas:opacity-0 transition-opacity duration-300"
            style={{
              top: 'calc(12px / var(--current-scale, 1))',
              left: 'calc(12px / var(--current-scale, 1))',
              transform: 'scale(calc(1 / var(--current-scale, 1)))',
              transformOrigin: 'top left',
              maxWidth: 'calc(var(--current-scale, 1) * 100% - 24px)'
            }}
          >
            <div className="bg-black/60 px-2.5 py-1.5 rounded-lg border border-white/10 shadow-sm flex items-center">
              <span className="text-white/95 text-[11px] font-medium truncate leading-none tracking-wide">
                {data.fileName.replace(/\\.[^/.]+$/, "")}
              </span>
            </div>
          </div>
        )}`;

content = content.replace(target, replacement);

fs.writeFileSync('src/components/GenerationCard.tsx', content);
console.log('Patched GenerationCard.tsx');
