const fs = require('fs');
let content = fs.readFileSync('src/components/ProjectScriptBible.tsx', 'utf-8');

const target1 = "<span>目录</span>";
const replace1 = `{isInferringToc ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <span>目录</span>
                          )}`;

const target2 = "{tocItems.length > 0 && (";
const replace2 = "{!isInferringToc && tocItems.length > 0 && (";

if (content.includes(target1) && content.includes(target2)) {
  content = content.replace(target1, replace1);
  content = content.replace(target2, replace2);
  fs.writeFileSync('src/components/ProjectScriptBible.tsx', content);
  console.log("Updated correctly.");
} else {
  console.log("Targets not found.");
  console.log("target1:", content.includes(target1));
  console.log("target2:", content.includes(target2));
}
