import assert from 'node:assert/strict';
import { AgentRuntime } from './runtime';

const runtime = new AgentRuntime({
  requestTurn: async task => {
    if (task.turn === 1) {
      assert.equal(task.history.length, 0);
      return { narration: [], progress: '正在核实起始集数', plan: [{ id: 'verify', title: '核实首集' }], toolCalls: [{ id: 'one', name: 'page.inspect', arguments: {} }], complete: false };
    }
    if (task.turn === 2) {
      assert.equal(task.progress, '正在核实起始集数');
      assert.equal(task.plan[0].id, 'verify');
      assert.equal(task.history.length, 0);
      assert.equal(task.observations.length, 1);
      return { narration: [], progress: '仍需核实首集', failureSummaries: ['此前观察未显示首集'], toolCalls: [{ id: 'two', name: 'page.inspect', arguments: {} }], complete: false };
    }
    assert.equal(task.observations.length, 1);
    assert.equal((task.observations[0].content as { callId: string }).callId, 'two');
    assert.equal(task.history.length, 1);
    assert.equal(task.progress, '仍需核实首集');
    return { narration: [], toolCalls: [], complete: true, response: '已核实' };
  },
  executeTool: async call => ({ observation: call.id }),
});
const task = runtime.createTask({ id: 'test', sessionId: 'test', goal: '核实集数' });
const result = await runtime.wake(task.id);
assert.equal(result.status, 'completed');
assert.equal(result.turn, 3);
assert.equal(result.history.length, 1);
assert.equal(result.observations.length, 0);
console.log('PASS: variables persist; observations delivered once; only failure lessons retained.');
