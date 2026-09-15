const fs = require('fs');
let content = fs.readFileSync('src/components/GenerationCard.tsx', 'utf-8');

const target = `  const cardOpacity = useTransform(() => {
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
  });`;

const replace = `  const cardOpacity = useTransform(() => {
    if (typeof window === 'undefined') return 1;
    const sw = window.innerWidth;
    const sh = window.innerHeight;
    
    // Approximate full card dimensions (including the bottom panel)
    const dim = CARD_DIMENSIONS[ratio];
    const visualWidth = Math.max(dim.width, 480);
    const visualHeight = dim.height + 200; 
    
    const s = scale.get();
    const cardLeft = x * s + tx.get();
    const cardTop = y * s + ty.get();
    const cardRight = cardLeft + visualWidth * s;
    const cardBottom = cardTop + visualHeight * s;
    
    // Check if the card's bounding box intersects with the screen's bounding box [0, 0, sw, sh]
    const isIntersecting = cardLeft <= sw && cardRight >= 0 && cardTop <= sh && cardBottom >= 0;
    
    if (isIntersecting) return 1;
    
    // If not intersecting, calculate how far outside it is to create a spatial fade
    let dx = 0;
    if (cardRight < 0) dx = -cardRight;
    else if (cardLeft > sw) dx = cardLeft - sw;
    
    let dy = 0;
    if (cardBottom < 0) dy = -cardBottom;
    else if (cardTop > sh) dy = cardTop - sh;
    
    // Use the maximum distance in either axis
    const dist = Math.max(dx, dy);
    
    // Spatial fade distance (pixels) outside the screen
    const fadeDistance = 150; 
    
    if (dist >= fadeDistance) return 0;
    return 1 - (dist / fadeDistance);
  });`;

content = content.replace(target, replace);
fs.writeFileSync('src/components/GenerationCard.tsx', content);
