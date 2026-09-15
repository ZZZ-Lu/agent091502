const fs = require('fs');
let content = fs.readFileSync('src/components/GenerationCard.tsx', 'utf-8');

const target1 = "group-data-[scale-micro=true]/canvas:!border-none ${isSelected ? 'outline outline-[#3b82f6]' : 'outline-none group-data-[zooming=true]/canvas:!shadow-none group-data-[zooming=true]/canvas:!transition-none group-data-[zooming=true]/canvas:!duration-0'} ${";
const replace1 = "group-data-[scale-micro=true]/canvas:!border-none group-data-[zooming=true]/canvas:!shadow-none group-data-[zooming=true]/canvas:!transition-none group-data-[zooming=true]/canvas:!duration-0 group-data-[zooming=true]/canvas:will-change-transform ${isSelected ? 'outline outline-[#3b82f6]' : 'outline-none'} ${";

const target2 = "pointer-events-none ${isSelected ? '' : 'group-data-[zooming=true]/canvas:!filter-none group-data-[zooming=true]/canvas:!transition-none group-data-[zooming=true]/canvas:!duration-0'}";
const replace2 = "pointer-events-none group-data-[zooming=true]/canvas:!filter-none group-data-[zooming=true]/canvas:!transition-none group-data-[zooming=true]/canvas:!duration-0 group-data-[zooming=true]/canvas:will-change-transform";

const target3 = "pointer-events-none z-10 ${isSelected ? '' : 'group-data-[zooming=true]/canvas:opacity-0'}";
const replace3 = "pointer-events-none z-10 group-data-[zooming=true]/canvas:opacity-0 group-data-[zooming=true]/canvas:will-change-transform";

const target4 = "group-data-[scale-micro=true]/canvas:!pointer-events-none ${isSelected ? '' : 'group-data-[zooming=true]/canvas:!shadow-none group-data-[zooming=true]/canvas:!transition-none group-data-[zooming=true]/canvas:!duration-0'} ${";
const replace4 = "group-data-[scale-micro=true]/canvas:!pointer-events-none group-data-[zooming=true]/canvas:!shadow-none group-data-[zooming=true]/canvas:!transition-none group-data-[zooming=true]/canvas:!duration-0 group-data-[zooming=true]/canvas:will-change-transform ${";

const target5 = "shadow-sm ${isSelected ? '' : 'group-data-[zooming=true]/canvas:!shadow-none'}";
const replace5 = "shadow-sm group-data-[zooming=true]/canvas:!shadow-none";

if (content.includes(target1) && content.includes(target2) && content.includes(target3) && content.includes(target4) && content.includes(target5)) {
  content = content.replace(target1, replace1);
  content = content.replace(target2, replace2);
  content = content.replace(target3, replace3);
  content = content.replace(target4, replace4);
  content = content.replace(target5, replace5);
  fs.writeFileSync('src/components/GenerationCard.tsx', content);
  console.log("Updated correctly.");
} else {
  console.log("Targets not found.");
  console.log("target1:", content.includes(target1));
  console.log("target2:", content.includes(target2));
  console.log("target3:", content.includes(target3));
  console.log("target4:", content.includes(target4));
  console.log("target5:", content.includes(target5));
}
