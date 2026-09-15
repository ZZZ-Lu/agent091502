const fs = require('fs');
let content = fs.readFileSync('src/components/GenerationCard.tsx', 'utf-8');

const target1 = "className={`absolute top-0 left-0 ${";
const replace1 = "className={`absolute top-0 left-0 pointer-events-none ${";

const target2 = "className={`relative shrink-0 overflow-hidden cursor-grab";
const replace2 = "className={`pointer-events-auto relative shrink-0 overflow-hidden cursor-grab";

const target3 = "className={`flex flex-col bg-gray-100 dark:bg-neutral-800 squircle p-4 gap-2 w-[480px] border border-gray-200/80";
const replace3 = "className={`pointer-events-auto flex flex-col bg-gray-100 dark:bg-neutral-800 squircle p-4 gap-2 w-[480px] border border-gray-200/80";

if (content.includes(target1) && content.includes(target2) && content.includes(target3)) {
  content = content.replace(target1, replace1);
  content = content.replace(target2, replace2);
  content = content.replace(target3, replace3);
  fs.writeFileSync('src/components/GenerationCard.tsx', content);
  console.log("Updated correctly.");
} else {
  console.log("Targets not found.");
  console.log("target1:", content.includes(target1));
  console.log("target2:", content.includes(target2));
  console.log("target3:", content.includes(target3));
}
