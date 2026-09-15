const fs = require('fs');
let content = fs.readFileSync('src/components/ProjectScriptBible.tsx', 'utf-8');

const targetStr = `  // Automatically infer TOC patterns in background when script content exists and no patterns stored yet
  useEffect(() => {
    if (!scriptDraft || !scriptDraft.trim()) return;

    let isMounted = true;
    const autoInfer = async () => {`;

const replaceStr = `  // Automatically infer TOC patterns in background when script content exists and no patterns stored yet
  useEffect(() => {
    if (!scriptDraft || !scriptDraft.trim()) return;

    // Only run if we don't already have inferred patterns saved
    const saved = localStorage.getItem(\`script_toc_patterns_\${currentProject.id}\`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return; // Already inferred
        }
      } catch (e) {}
    }

    let isMounted = true;
    const autoInfer = async () => {`;

content = content.replace(targetStr, replaceStr);

const targetSaveStr = `        if (patterns.length > 0) {
          setInferredPatterns(patterns);
        }`;
const replaceSaveStr = `        if (patterns.length > 0) {
          setInferredPatterns(patterns);
          localStorage.setItem(\`script_toc_patterns_\${currentProject.id}\`, JSON.stringify(patterns));
        }`;

content = content.replace(targetSaveStr, replaceSaveStr);

const targetDepStr = `    };
  }, [scriptDraft, currentProject.id]);`;
const replaceDepStr = `    };
  }, [currentProject.id]);`;

content = content.replace(targetDepStr, replaceDepStr);

const targetRegex = `const defaultRegex = /^(?:第[0-9一二三四五六七八九十百千]+[集场幕章节回话话].*|【(?:第?[0-9一二三四五六七八九十百千]+[集场幕章节回话]?[^】]*)】.*|#{1,4}\\s+.+|(?:EPISODE|EP|ACT|SCENE|CHAPTER)\\s*#?[0-9一二三四五六七八九十百千]+.*|(?:集数|场次|场景|幕|序幕|尾声|前言|正文)\\s*[:：0-9一二三四五六七八九十].*|[0-9]+(?:[-.][0-9]+)+.*)/i;`;
const replaceRegex = `const defaultRegex = /^(?:第[0-9一二三四五六七八九十百千]+[集场幕章节回话话].*|【(?:第?[0-9一二三四五六七八九十百千]+[集场幕章节回话]?[^】]*)】.*|#{1,4}\\s+.+|(?:EPISODE|EP|ACT|SCENE|CHAPTER)\\s*#?[0-9一二三四五六七八九十百千]+.*|(?:集数|场次|场景|幕|序幕|尾声|前言|正文)\\s*[:：0-9一二三四五六七八九十].*)/i;`;

content = content.replace(targetRegex, replaceRegex);

fs.writeFileSync('src/components/ProjectScriptBible.tsx', content);
