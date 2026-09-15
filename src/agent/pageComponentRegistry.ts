export type MouseActionName =
  | 'mouse.move' | 'mouse.click' | 'mouse.doubleClick' | 'mouse.longPress'
  | 'mouse.hover' | 'mouse.drag' | 'mouse.scroll' | 'mouse.type' | 'mouse.keyPress';

export interface PageComponentDefinition {
  id: string;
  label: string;
  location: string;
  description: string;
  actions: MouseActionName[];
}

/**
 * UI-only registration. It describes where an agent may act, but never holds
 * project data or business logic. Components expose the same IDs in their DOM.
 */
export const PAGE_COMPONENT_REGISTRY: PageComponentDefinition[] = [
  { id: 'script-bible-toggle', label: '剧本入口', location: '画布左上角', description: '打开或关闭剧本面板。', actions: ['mouse.move', 'mouse.click', 'mouse.hover'] },
  { id: 'script.view.script', label: '剧本正文切换按钮', location: '剧本面板顶部', description: '切换到剧本正文视图。', actions: ['mouse.move', 'mouse.click', 'mouse.hover'] },
  { id: 'script.close', label: '关闭剧本面板', location: '剧本面板右上角', description: '收起当前剧本面板。', actions: ['mouse.move', 'mouse.click', 'mouse.hover'] },
  { id: 'script.toc.open', label: '目录按钮', location: '剧本正文二级菜单', description: '展开或收起剧本目录，按钮旁显示当前剧集数量徽标。', actions: ['mouse.move', 'mouse.click', 'mouse.hover'] },
  { id: 'script.search.open', label: '搜索替换按钮', location: '剧本正文二级菜单', description: '打开或收起正文搜索与批量替换面板。', actions: ['mouse.move', 'mouse.click', 'mouse.hover'] },
  { id: 'script.search.panel', label: '搜索与替换面板', location: '剧本正文二级菜单下方', description: '包含正文搜索词、替换词、大小写切换及替换动作的操作面板。', actions: ['mouse.move', 'mouse.hover'] },
  { id: 'script.search.input', label: '搜索输入框', location: '搜索与替换面板', description: '输入需要搜索的文本。', actions: ['mouse.move', 'mouse.click', 'mouse.type', 'mouse.keyPress'] },
  { id: 'script.search.case', label: '区分大小写切换', location: '搜索与替换面板', description: '切换搜索是否区分大小写。', actions: ['mouse.move', 'mouse.click', 'mouse.hover'] },
  { id: 'script.search.counter', label: '搜索匹配计数', location: '搜索与替换面板', description: '显示当前搜索关键词在全文中的匹配位置与总数量。', actions: ['mouse.hover'] },
  { id: 'script.search.prev', label: '上一个匹配项', location: '搜索与替换面板', description: '跳转到上一个匹配的文本位置。', actions: ['mouse.move', 'mouse.click', 'mouse.hover'] },
  { id: 'script.search.next', label: '下一个匹配项', location: '搜索与替换面板', description: '跳转到下一个匹配的文本位置。', actions: ['mouse.move', 'mouse.click', 'mouse.hover'] },
  { id: 'script.replace.input', label: '替换输入框', location: '搜索与替换面板', description: '输入替换后的目标文本。', actions: ['mouse.move', 'mouse.click', 'mouse.type', 'mouse.keyPress'] },
  { id: 'script.replace.single', label: '单处替换按钮', location: '搜索与替换面板', description: '替换当前选中的匹配项。', actions: ['mouse.move', 'mouse.click', 'mouse.hover'] },
  { id: 'script.replace.all', label: '全部替换按钮', location: '搜索与替换面板', description: '批量替换剧本全文中所有匹配项。', actions: ['mouse.move', 'mouse.click', 'mouse.hover'] },
  { id: 'script.replace.feedback', label: '替换反馈提示', location: '搜索与替换面板', description: '展示替换完成的状态提示。', actions: ['mouse.hover'] },
  { id: 'script.toc.list', label: '剧本目录列表', location: '目录浮层', description: '浏览所有剧集条目。', actions: ['mouse.move', 'mouse.hover', 'mouse.scroll'] },
  { id: 'script.toc.item.*', label: '目录条目', location: '目录浮层', description: '定位到当前可见的章节、场次或剧集正文。', actions: ['mouse.move', 'mouse.click', 'mouse.hover'] },
  { id: 'script.view.assets', label: '资产清单标签', location: '剧本面板顶部', description: '切换到资产清单。', actions: ['mouse.move', 'mouse.click', 'mouse.hover'] },
  { id: 'assets.filter.all', label: '资产-全部过滤', location: '资产清单面板', description: '显示所有资产。', actions: ['mouse.move', 'mouse.click', 'mouse.hover'] },
  { id: 'assets.filter.characters', label: '资产-角色过滤', location: '资产清单面板', description: '仅显示角色。', actions: ['mouse.move', 'mouse.click', 'mouse.hover'] },
  { id: 'assets.filter.locations', label: '资产-场景过滤', location: '资产清单面板', description: '仅显示场景。', actions: ['mouse.move', 'mouse.click', 'mouse.hover'] },
  { id: 'assets.filter.props', label: '资产-道具过滤', location: '资产清单面板', description: '仅显示道具。', actions: ['mouse.move', 'mouse.click', 'mouse.hover'] },
  { id: 'assets.extract.all', label: '资产-一键提取所有资产', location: '资产清单面板', description: '从剧本正文一键提取所有资产。', actions: ['mouse.move', 'mouse.click', 'mouse.hover'] },
  { id: 'assets.item.*', label: '资产条目', location: '资产清单面板', description: '某个具体的资产条目。', actions: ['mouse.move', 'mouse.click', 'mouse.hover'] },
  { id: 'assets.item.*.copy', label: '资产条目-复制提示词', location: '资产清单面板', description: '复制出图提示词。', actions: ['mouse.move', 'mouse.click', 'mouse.hover'] },
  { id: 'assets.item.*.generate', label: '资产条目-生成图片', location: '资产清单面板', description: '定妆生成或环境生成。', actions: ['mouse.move', 'mouse.click', 'mouse.hover'] },
  { id: 'assets.empty.state', label: '资产空状态提示', location: '资产清单面板', description: '提示当前暂无资产条目，需点击一键提取按钮。', actions: ['mouse.hover'] },
  { id: 'script.view.universe', label: '画面风格标签', location: '剧本面板顶部', description: '切换到画面风格。', actions: ['mouse.move', 'mouse.click', 'mouse.hover'] },
  { id: 'script.text', label: '剧本文本编辑区', location: '剧本面板主体', description: '连续长卷编辑区；光标所在位置即当前场次。', actions: ['mouse.move', 'mouse.click', 'mouse.hover', 'mouse.drag', 'mouse.scroll', 'mouse.type', 'mouse.keyPress'] },
  { id: 'script.scene.indicator', label: '当前场次指示器', location: '编辑区角落/边槽', description: '标识当前光标所在场次编号（如“第3场”），点击可呼出该场信息。', actions: ['mouse.move', 'mouse.hover', 'mouse.click'] },
  { id: 'script.version.status', label: '版本暂存状态', location: '二级工具栏', description: '显示改动检测最新状态（如“第3场已自动暂存”）。', actions: ['mouse.move', 'mouse.hover', 'mouse.click'] },
  { id: 'script.version.open', label: '版本管理按钮', location: '二级工具栏', description: '展开版本快照列表抽屉。', actions: ['mouse.move', 'mouse.hover', 'mouse.click'] },
  { id: 'script.version.item.*', label: '版本历史卡片', location: '版本抽屉', description: '查看特定快照的摘要，支持单场回滚或全剧查看。', actions: ['mouse.move', 'mouse.hover', 'mouse.click'] },
];

export const getPageComponentDefinition = (id: string) => {
  const exact = PAGE_COMPONENT_REGISTRY.find((component) => component.id === id);
  if (exact) return exact;
  if (id.startsWith('script.toc.item.')) return PAGE_COMPONENT_REGISTRY.find((c) => c.id === 'script.toc.item.*');
  if (id.startsWith('script.version.item.')) return PAGE_COMPONENT_REGISTRY.find((c) => c.id === 'script.version.item.*');
  if (id.startsWith('assets.item.')) {
    if (id.endsWith('.copy')) return PAGE_COMPONENT_REGISTRY.find((c) => c.id === 'assets.item.*.copy');
    if (id.endsWith('.generate')) return PAGE_COMPONENT_REGISTRY.find((c) => c.id === 'assets.item.*.generate');
    return PAGE_COMPONENT_REGISTRY.find((c) => c.id === 'assets.item.*');
  }
  return undefined;
};
