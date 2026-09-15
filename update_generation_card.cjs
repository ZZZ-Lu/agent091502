const fs = require('fs');
let content = fs.readFileSync('src/components/GenerationCard.tsx', 'utf-8');

const interfaceTarget = "  scale: MotionValue<number>;";
const interfaceReplace = "  scale: MotionValue<number>;\n  tx: MotionValue<number>;\n  ty: MotionValue<number>;";
content = content.replace(interfaceTarget, interfaceReplace);

const componentTarget = "export const GenerationCard = React.memo(function GenerationCard({ data, scale, isSelected, onSelect, onDrag, onDragEnd, onDelete, onUpdate }: GenerationCardProps) {";
const componentReplace = "import { useTransform } from 'motion/react';\n\nexport const GenerationCard = React.memo(function GenerationCard({ data, scale, tx, ty, isSelected, onSelect, onDrag, onDragEnd, onDelete, onUpdate }: GenerationCardProps) {";
content = content.replace(componentTarget, componentReplace);

const renderTarget = `  return (
    <div 
      ref={cardRef}
      data-card-id={id}`;
const renderReplace = `  const cardOpacity = useTransform(() => {
    if (typeof window === 'undefined') return 1;
    const sw = window.innerWidth;
    const sh = window.innerHeight;
    const scx = sw / 2;
    const scy = sh / 2;
    const screenRadius = Math.sqrt(scx * scx + scy * scy);
    
    const dim = CARD_DIMENSIONS[ratio];
    const cx = (x + dim.width / 2) * scale.get() + tx.get();
    const cy = (y + dim.height / 2) * scale.get() + ty.get();
    
    const dist = Math.sqrt(Math.pow(cx - scx, 2) + Math.pow(cy - scy, 2));
    
    const fadeStart = screenRadius * 1.0;
    const fadeEnd = screenRadius + Math.max(dim.width, dim.height) * scale.get() * 0.8;
    
    if (dist <= fadeStart) return 1;
    if (dist >= fadeEnd) return 0;
    return 1 - ((dist - fadeStart) / (fadeEnd - fadeStart));
  });

  return (
    <motion.div 
      ref={cardRef}
      data-card-id={id}`;
content = content.replace(renderTarget, renderReplace);

const styleTarget = `      className={\`absolute top-0 left-0 pointer-events-none \${isDragging.current ? 'will-change-transform z-10' : (isSelected ? 'z-10' : 'z-0')}\`}
      style={{ transformOrigin: 'top left', transform: \`translate(\${x}px, \${y}px)\` }}`;
const styleReplace = `      className={\`absolute top-0 left-0 pointer-events-none \${isDragging.current ? 'will-change-transform z-10' : (isSelected ? 'z-10' : 'z-0')}\`}
      style={{ transformOrigin: 'top left', transform: \`translate(\${x}px, \${y}px)\`, opacity: cardOpacity }}`;
content = content.replace(styleTarget, styleReplace);

const closingDivTarget = `        <div className="absolute top-1/2 left-1/2 w-4 h-4 -mt-2 -ml-2 rounded-full border-2 border-transparent border-t-white/80 animate-spin" />
      </motion.div>
    </div>
  );`;
const closingDivReplace = `        <div className="absolute top-1/2 left-1/2 w-4 h-4 -mt-2 -ml-2 rounded-full border-2 border-transparent border-t-white/80 animate-spin" />
      </motion.div>
    </motion.div>
  );`;
content = content.replace(closingDivTarget, closingDivReplace);


fs.writeFileSync('src/components/GenerationCard.tsx', content);
console.log("Updated GenerationCard");
