const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf-8');

const targetStr = `        const parsed = JSON.parse(body.choices?.[0]?.message?.content || '{}');
        if (parsed.scenePattern || parsed.pattern) {
          return res.json({ 
            tocPattern: parsed.tocPattern || '',
            scenePattern: parsed.scenePattern || parsed.pattern || '',
            flags: parsed.flags || 'gim', 
            patternDescription: parsed.patternDescription || '',
            confidence: 'ai' 
          });
        }`;

const replaceStr = `        const parsed = JSON.parse(body.choices?.[0]?.message?.content || '{}');
        if (parsed.scenePattern || parsed.pattern || parsed.tocPattern) {
          return res.json({ 
            ...parsed,
            confidence: 'ai' 
          });
        }`;

if (content.includes("tocPattern: parsed.tocPattern || '',")) {
  content = content.replace(targetStr, replaceStr);
  fs.writeFileSync('server.ts', content);
  console.log("Successfully updated server.ts response format.");
} else {
  console.log("Target string not found in server.ts");
}
