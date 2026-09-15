const fs = require('fs');
let code = fs.readFileSync('src/components/ProjectScriptBible.tsx', 'utf8');

const target = `                                  <div className="flex items-center gap-2 shrink-0">
                                      <span className={\`text-[10px] font-mono flex-shrink-0 \${idx === 0 ? 'text-blue-400/70' : 'text-gray-400 group-hover:hidden'}\`}>
                                        {new Date(ver.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                      </span>
                                      <span className={\`text-[10px] w-12 text-right truncate \${idx === 0 ? 'text-blue-400/70' : 'text-gray-400 group-hover:hidden'}\`} title={ver.scene}>
                                         {ver.scene}
                                      </span>
                                      
                                      {idx === 0 ? null : (
                                        <div className="hidden group-hover:flex items-center gap-2 pr-1">`;

const replacement = `                                  <div className="relative flex items-center justify-end shrink-0 min-w-[90px]">
                                      <div className={\`flex items-center gap-2 transition-opacity duration-150 \${idx === 0 ? 'text-blue-400/70' : 'text-gray-400 group-hover:opacity-0'}\`}>
                                          <span className="text-[10px] font-mono flex-shrink-0">
                                            {new Date(ver.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                          </span>
                                          <span className="text-[10px] w-12 text-right truncate" title={ver.scene}>
                                             {ver.scene}
                                          </span>
                                      </div>
                                      
                                      {idx === 0 ? null : (
                                        <div className="absolute inset-y-0 right-0 flex items-center justify-end gap-2 pr-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none group-hover:pointer-events-auto">`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('src/components/ProjectScriptBible.tsx', code);
  console.log("Success");
} else {
  console.log("Failed to find target");
}
