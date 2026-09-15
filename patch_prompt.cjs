const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target = `            content: '你是一个剧本版本意图判定助手。请仔细对比 before_snippet 和 after_snippet。评估修改级别(trivial/scene_edit/structural)。关键要求：summary 必须极其具体地说明改了什么内容，如果是改词，必须写“将[原词]改为[新词]”（例如：“将‘后事’改为‘看大夫’”），不要写“改台词”、“修正错别字”等模糊废话。限制在15字以内。必须输出 JSON：{"scale":"trivial"|"scene_edit"|"structural", "summary":string}'`;

const replacement = `            content: '你是一个剧本版本意图判定助手。请仔细对比 before_snippet 和 after_snippet 评估修改级别(trivial/scene_edit/structural)。关键要求：summary 必须极其具体地说明改了什么内容。根据实际动作选择最贴切的句式，例如：删除操作用“删除了[某某剧情/词语]”；新增操作用“新增了[某某剧情/词语]”；替换操作用“将[原内容]改为[新内容]”。不要写“改台词”等模糊废话，也不要生硬套用替换句式。限制在15字以内。必须输出 JSON：{"scale":"trivial"|"scene_edit"|"structural", "summary":string}'`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('server.ts', code);
  console.log("Success");
} else {
  console.log("Failed to find target prompt");
}
