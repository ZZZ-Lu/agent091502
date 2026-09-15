const plan = [
  { id: '1', title: '进入剧本入口', status: 'completed' },
  { id: '2', title: '定位集数信息', status: 'pending' },
  { id: '3', title: '确认并回复集数', status: 'pending' }
];
const formatPlan = (plan) => {
  if (!Array.isArray(plan) || plan.length === 0) return '暂无计划';
  return plan.map(item => `[${item.status === 'completed' ? 'x' : ' '}] ${item.title}`).join('\n');
};
console.log(formatPlan(plan));
