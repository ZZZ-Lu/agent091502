const fs = require('fs');

const code = fs.readFileSync('server.ts', 'utf-8');

const replacement = `      const formatObservations = (obsList: any[]) => {
        let pageObs: string[] = [];
        let toolObs: string[] = [];

        const formatPage = (page: any) => {
          let text = \`【观察结果】 (区域: \${page.scope || 'overview'})\\n\`;
          if (page.notices && page.notices.length) {
            text += \`页面提示：\${page.notices.map((n: any) => n.label).join(' | ')}\\n\`;
          }
          if (page.script) {
            if (page.script.directory) {
              text += \`目录滚动状态：[\${page.script.directory.atTop ? '已到顶' : '未到顶'} | \${page.script.directory.atBottom ? '已到底' : '未到底'}]\\n\`;
            }
            if (page.script.text?.status === 'visible') {
              if (page.scope === 'script.text' && page.script.text.visibleText) {
                text += \`\\n【剧本正文可见内容】\\n\${page.script.text.visibleText}\\n【正文滚动状态：\${page.script.text.scroll?.atTop ? '已到顶' : '未到顶'} | \${page.script.text.scroll?.atBottom ? '已到底' : '未到底'}】\\n\\n\`;
              } else {
                text += \`【提示】正文内容已在屏幕上可见。要阅读正文内容，请使用 page.inspect 并指定 scope="script.text"。\\n\`;
              }
            }
          }
          if (page.components && page.components.length) {
            text += \`可见组件列表：\\n\`;
            page.components.forEach((c: any) => {
              const actions = page.actionSets && page.actionSets[c.actionSet] ? page.actionSets[c.actionSet].join(', ') : '';
              text += \`- ID: \${c.id} | \${c.label || '无标签'}\${c.text ? \` | 文本: "\${c.text}"\` : ''} | 可用动作: [\${actions}]\\n\`;
            });
          } else {
            text += \`无可见组件。\\n\`;
          }
          if (page.pagination?.truncated) {
            text += \`\\n注意：当前区域内容已被截断，请向下滚动或请求 nextOffset 继续查看。\\n\`;
          }
          return text.trim();
        };

        if (obsList && obsList.length) {
          obsList.forEach(obs => {
            if (obs.role !== 'tool' || !obs.content) return;
            const { name, status, output, error } = obs.content;
            if (status === 'failed') {
              toolObs.push(\`【执行工具 \${name} 失败】\\n原因：\${error || '未知'}\`);
              return;
            }
            
            if (name === 'page.inspect') {
              pageObs.push(formatPage(output as any));
            } else if (name === 'ui.actAndObserve') {
              const pageText = output.page ? formatPage(output.page) : '无最新页面数据。';
              pageObs.push(\`【UI交互成功】动作 \${output.action} 作用于 \${output.targetId}。\\n\${pageText}\`);
            } else if (name === 'guide.lookup') {
              toolObs.push(\`【操作指南查询结果】\\n查询词：\${output.query || '未提供'}\\n指南内容：\${output.guidance}\`);
            } else {
              toolObs.push(\`【工具 \${name} 执行成功】\\n\${typeof output === 'string' ? output : JSON.stringify(output)}\`);
            }
          });
        }

        return {
          pageObservations: pageObs.length ? pageObs.join('\\n\\n') : '暂无页面事实，请先调用 page.inspect 观察。',
          toolResults: toolObs.length ? toolObs.join('\\n\\n') : '暂无。'
        };
      };`;

// Find start and end
const startStr = "const formatObservations = (obsList: any[]) => {";
const endStr = "      const formatHistory = (histList: any[], eventList: any[]) => {";

const startIndex = code.indexOf(startStr);
const endIndex = code.indexOf(endStr);

if (startIndex !== -1 && endIndex !== -1) {
    const newCode = code.substring(0, startIndex) + replacement + "\n\n" + code.substring(endIndex);
    fs.writeFileSync('server.ts', newCode, 'utf-8');
    console.log('patched');
} else {
    console.error('could not find indices');
}
