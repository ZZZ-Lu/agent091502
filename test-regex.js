const str = '{{调用 sys.updateState, {"taskTitle": "...", "plan": []}}}\n\n{{调用 ui.actAndObserve, {"targetId": "script-bible-toggle", "action": "mouse.click"}}}';
const match = str.match(/\{\{([\s\S]*?)\}\}/g);
console.log(match);
