# Mira 工具目录

> 当前 Agent 工具集遵循一个不可绕过的原则：Mira 只能获得用户也能通过界面获得的信息。后台项目数据、完整目录、总集数和剧本文本均不是 Agent 的直读工具。

## 设计原则

- 工具描述可验证的能力，不是固定工作流；Mira 决定调用顺序，Runtime 只校验、记录和回传结果。
- `guide.lookup` 只提供人可阅读的操作说明，不能泄漏当前项目内容或答案。
- `page.inspect` 只返回当前屏幕实际可见的组件、文本、可见目录条目和滚动状态；不能返回屏幕外条目、完整目录或后台元数据。
- 页面动作只能经 `ui.actAndObserve`。它要求目标已出现在本任务最近一次 `page.inspect` 中，鼠标完成动作后才返回新的页面观察。

## 当前公开工具

| 工具 | 用途 | 关键输入 | 返回 | 信息边界 |
| --- | --- | --- | --- | --- |
| `guide.lookup` | 查询操作路径与限制。 | `query` | 相关操作说明。 | 不含当前项目内容、集数或目录。 |
| `page.inspect` | 观察用户此刻看到的页面。 | 无 | 可见组件、可见文本、目录当前可见条目、是否到底。 | 不含隐藏组件、屏幕外条目、后台数据。 |
| `ui.actAndObserve` | 对已观察到的组件执行鼠标动作。 | `targetId`、`action`、`arguments?` | 鼠标动作状态和动作后的 `page.inspect`。 | 不直接返回项目数据。 |

`action` 是鼠标层能力：`mouse.move`、`mouse.click`、`mouse.doubleClick`、`mouse.longPress`、`mouse.hover`、`mouse.drag`、`mouse.scroll`、`mouse.type`、`mouse.keyPress`。它们是 `ui.actAndObserve` 的参数，而不是供 Agent 绕过观察单独调用的工具。

## 页面目标注册

组件以稳定语义 ID 注册，并在当前可见时才由 `page.inspect` 提供。当前剧本界面的代表目标：

| 目标 | 用户可做的动作 |
| --- | --- |
| `script-bible-toggle` | 打开或关闭剧本面板。 |
| `script.close` | 收起当前剧本面板。 |
| `script.toc.open` | 展开或收起目录。 |
| `script.toc.list` | 滚动当前可见目录列表。 |
| `script.toc.item.<id>` | 点击当前可见的章节、场次或剧集条目，并定位正文。 |
| `script.text` | 读取、滚动、选择或编辑当前正文视区。 |

注册表和页面适配器是实现细节，不是知识通道：注册了但当前不可见的目标不会进入 Agent 的工具结果。

## 验收路径：询问“剧本有几集”

这是一条由 Mira 决策的示例路径，不是 Runtime 内置流程：

```text
guide.lookup("怎么看剧本有几集") + page.inspect
→ 观察到剧本未打开，Mira 决定 ui.actAndObserve(click, script-bible-toggle)
→ 新页面观察到目录按钮，Mira 决定 ui.actAndObserve(click, script.toc.open)
→ 新页面观察到可见目录、尚未到底，Mira 决定 ui.actAndObserve(scroll, script.toc.list)
→ 新页面观察确认已到底并显示最后可见条目
→ Mira 根据可见证据回复，并显式完成任务
```

若目录可能含第 0 集、跳号或重复条目，最后编号不能自动等于总集数。Mira 应说明证据的含义，或继续采用用户同样可见的界面操作获得足够依据；不得改用后台统计捷径。
