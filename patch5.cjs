const fs = require('fs');
const file = 'src/components/GenerationCard.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldCode = `  const handleGenerate = () => {
    if (!prompt.trim()) return;
    onUpdate(id, { state: 'generating' }, true);
    
    // Simulate generation
    setTimeout(() => {
      onUpdate(id, { 
        imageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=800&auto=format&fit=crop",
        state: 'completed'
      });
    }, 2500);
  };`;

const newCode = `  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    
    // Core Architecture Principle: "Only inject 4K original binary data into generation AI contexts"
    // At this step, we pretend to send the trueOriginalFileData to an AI pipeline.
    const generationPayload: any = { prompt: prompt.trim() };
    
    if (data.trueOriginalFileData) {
        // High fidelity AI reference branch
        console.log("SENDING TRUE ORIGINAL DATA TO AI", data.trueOriginalFileData.size, "bytes");
        generationPayload.referenceImage = data.trueOriginalFileData;
    } else if (data.originalFileData) {
        // Fallback for smaller images
        console.log("SENDING STANDARD DATA TO AI", data.originalFileData.size, "bytes");
        generationPayload.referenceImage = data.originalFileData;
    } else if (data.fileData) {
        // Fallback
        generationPayload.referenceImage = data.fileData;
    }

    onUpdate(id, { state: 'generating' }, true);
    
    // Simulate API delay
    setTimeout(() => {
      onUpdate(id, { 
        imageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=800&auto=format&fit=crop",
        state: 'completed'
      });
    }, 2500);
  };`;

content = content.replace(oldCode, newCode);
fs.writeFileSync(file, content);
console.log('Patched');
