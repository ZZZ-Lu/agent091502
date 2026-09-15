const fetch = require('node-fetch');
async function test() {
  const req = await fetch('http://localhost:3000/api/script-toc-pattern', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      sampleText: '■ 第一浪 | 她来了 (0:00-0:15)\n\n（过曝暖光。夏天。）', 
      modelType: 'deepseek-v4-flash',
      apiKey: 'test-key-just-to-see-if-it-hits-api' 
    })
  });
  console.log(req.status);
}
test();
