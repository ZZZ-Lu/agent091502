const obsList = [
  { role: 'tool', content: { name: 'sys.updateState', status: 'succeeded', output: '状态已持久化' } },
  { role: 'tool', content: { name: 'page.inspect', status: 'succeeded', output: { scope: 'overview', components: [{id: '1', label: 'test'}] } } }
];

const formatObservations = (obsList) => {
        let pageObs = [];
        let toolObs = [];

        const formatPage = (page) => {
          let text = `【观察结果】 (区域: ${page.scope || 'overview'})\n`;
          if (page.components && page.components.length) {
            text += `可见组件列表：\n`;
            page.components.forEach((c) => {
              text += `- ID: ${c.id} | ${c.label || '无标签'}\n`;
            });
          }
          return text.trim();
        };

        if (obsList && obsList.length) {
          obsList.forEach(obs => {
            if (obs.role !== 'tool' || !obs.content) return;
            const { name, status, output, error } = obs.content;
            if (status === 'failed') {
              toolObs.push(`【执行工具 ${name} 失败】\n原因：${error || '未知'}`);
              return;
            }
            
            if (name === 'page.inspect') {
              pageObs.push(formatPage(output));
            } else if (name === 'ui.actAndObserve') {
              const pageText = output.page ? formatPage(output.page) : '无最新页面数据。';
              pageObs.push(`【UI交互成功】动作 ${output.action} 作用于 ${output.targetId}。\n${pageText}`);
            } else if (name === 'guide.lookup') {
              toolObs.push(`【操作指南查询结果】\n查询词：${output.query || '未提供'}\n指南内容：${output.guidance}`);
            } else {
              toolObs.push(`【工具 ${name} 执行成功】\n${typeof output === 'string' ? output : JSON.stringify(output)}`);
            }
          });
        }

        return {
          pageObservations: pageObs.length ? pageObs.join('\n\n') : '暂无页面事实，请先调用 page.inspect 观察。',
          toolResults: toolObs.length ? toolObs.join('\n\n') : '暂无。'
        };
      };

console.log(formatObservations(obsList));
