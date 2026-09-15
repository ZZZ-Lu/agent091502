const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const targetStr = `      const finalPrompt = systemPromptTemplate
        .replace('{{taskTitle}}', task.title || '尚未命名')
        .replace('{{taskGoal}}', task.goal || '尚未设定')
        .replace('{{taskSubGoal}}', task.subGoal || '暂未设定')
        .replace('{{taskProgress}}', task.progress || '刚刚开始')
        .replace('{{taskPlan}}', formatPlan(task.plan))
        .replace('{{taskNotes}}', task.notes || '暂无笔记')
        .replace('{{userMessage}}', userMessage)
        .replace('{{history}}', formatHistory(history, events))
        .replace('{{toolPrompt}}', toolPrompt)
        .replace('{{observations}}', formatObservations(observations));`;

const newStr = `      const formattedObs = formatObservations(observations);
      
      const finalPrompt = systemPromptTemplate
        .replace('{{taskTitle}}', task.title || '尚未命名')
        .replace('{{taskGoal}}', task.goal || '尚未设定')
        .replace('{{taskSubGoal}}', task.subGoal || '暂未设定')
        .replace('{{taskProgress}}', task.progress || '刚刚开始')
        .replace('{{taskPlan}}', formatPlan(task.plan))
        .replace('{{taskNotes}}', task.notes || '暂无笔记')
        .replace('{{userMessage}}', userMessage)
        .replace('{{history}}', formatHistory(history, events))
        .replace('{{toolPrompt}}', toolPrompt)
        .replace('{{pageObservations}}', formattedObs.pageObservations)
        .replace('{{toolResults}}', formattedObs.toolResults);`;

if (code.includes(targetStr)) {
  code = code.replace(targetStr, newStr);
  fs.writeFileSync('server.ts', code, 'utf-8');
  console.log('patched');
} else {
  console.log('not found');
}
