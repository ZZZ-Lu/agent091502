const fs = require('fs');
let content = fs.readFileSync('src/components/ProjectScriptBible.tsx', 'utf-8');

const targetStr = `      // Check if matches any inferred regex OR fallback regex
      let isMatch = false;
      if (activeRegexes.length > 0) {
        isMatch = activeRegexes.some(rx => rx.test(trimmed));
      } else {
        isMatch = defaultRegex.test(trimmed);
      }`;

const replaceStr = `      // Check if matches any inferred regex OR fallback regex
      let isMatch = false;
      if (activeRegexes.length > 0) {
        isMatch = activeRegexes.some(rx => rx.test(trimmed));
      }
      if (!isMatch) {
        isMatch = defaultRegex.test(trimmed);
      }`;

content = content.replace(targetStr, replaceStr);

const targetRegex = `const defaultRegex = /^(?:第[0-9一二三四五六七八九十百千]+[集场幕章节回话话].*|【(?:第?[0-9一二三四五六七八九十百千]+[集场幕章节回话]?[^】]*)】.*|#{1,4}\\s+.+|(?:EPISODE|EP|ACT|SCENE|CHAPTER)\\s*#?[0-9一二三四五六七八九十百千]+.*|(?:集数|场次|场景|幕|序幕|尾声|前言|正文)\\s*[:：0-9一二三四五六七八九十].*)/i;`;
const replaceRegex = `const defaultRegex = /^(?:第[0-9一二三四五六七八九十百千]+[集场幕章节回话话].*|【(?:第?[0-9一二三四五六七八九十百千]+[集场幕章节回话]?[^】]*)】.*|#{1,4}\\s+.+|(?:EPISODE|EP|ACT|SCENE|CHAPTER)\\s*#?[0-9一二三四五六七八九十百千]+.*|(?:集数|场次|场景|幕|序幕|尾声|前言|正文)\\s*[:：0-9一二三四五六七八九十].*|[0-9]+(?:[-.][0-9]+)+.*)/i;`;

content = content.replace(targetRegex, replaceRegex);

fs.writeFileSync('src/components/ProjectScriptBible.tsx', content);
