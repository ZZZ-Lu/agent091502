const tocPattern = new RegExp('^■\\s*第[一二三四五六七八九十]+浪.*', 'gim');
const scenePattern = new RegExp('^(?:【[^】]*】)?[(（].*[)）]$', 'gim');

const testCases = [
  '■ 第一浪 | 她来了 (0:00-0:15)',
  '（过曝暖光。夏天。蝉鸣。）',
  '林晚OS',
  '■ 第二浪 | 风起',
  '【回忆】（林晚拆开通知书）'
];

console.log("TOC Pattern Tests:");
testCases.forEach(t => console.log(`"${t}" ->`, tocPattern.test(t)));
console.log("\nScene Pattern Tests:");
testCases.forEach(t => console.log(`"${t}" ->`, scenePattern.test(t)));
