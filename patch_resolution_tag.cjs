const fs = require('fs');
let content = fs.readFileSync('src/components/GenerationCard.tsx', 'utf8');

const target = `  const ratios: AspectRatio[] = ['1:1', '3:4', '9:16', '16:9'];
  const resolutions: Resolution[] = ['1K', '2K', '4K'];

  return (
    <motion.div`;

const replacement = `  let resolutionTag = '';
  if (data.nativeWidth && data.nativeHeight) {
    const maxDim = Math.max(data.nativeWidth, data.nativeHeight);
    const minDim = Math.min(data.nativeWidth, data.nativeHeight);
    if (data.isVideo) {
      if (minDim >= 2160 || maxDim >= 3840) resolutionTag = '4K';
      else if (minDim >= 1080) resolutionTag = '1080p';
      else if (minDim >= 720) resolutionTag = '720p';
      else resolutionTag = '480p';
    } else {
      if (maxDim >= 4000) resolutionTag = '4K+';
      else if (maxDim >= 3840) resolutionTag = '4K';
      else if (maxDim >= 2048) resolutionTag = '2K';
      else resolutionTag = '1K';
    }
  } else {
    // Fallback based on data.res
    if (data.isVideo) {
      if (data.res === '4K') resolutionTag = '4K';
      else if (data.res === '2K') resolutionTag = '1080p';
      else resolutionTag = '720p';
    } else {
      if (data.res === '4K') resolutionTag = '4K';
      else if (data.res === '2K') resolutionTag = '2K';
      else resolutionTag = '1K';
    }
  }

  const ratios: AspectRatio[] = ['1:1', '3:4', '9:16', '16:9'];
  const resolutions: Resolution[] = ['1K', '2K', '4K'];

  return (
    <motion.div`;

content = content.replace(target, replacement);
fs.writeFileSync('src/components/GenerationCard.tsx', content);
console.log('Patched resolution logic');
