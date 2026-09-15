# Mira AgentRuntime 技术改造方案

> 状态：V1 已实施（客户端 Runtime）。本文定义通用 Agent 的运行底座；具体剧本、资产或生成能力都应在此框架中以工具实现，不应增加任务专属的固定流程。服务端持久化与真实流式传输仍是后续迭代项。

## 1. 目标与边界

Mira 是唯一拥有自主循环的 Agent。用户提出目标后，Mira 自主判断需要哪些信息、调用哪些工具、是否进行页面操作，以及何时向用户交付结果。

Runtime 的职责是保证执行可靠、顺序正确、状态可追踪；它不得根据任务名称或工具名称推断、补写下一步业务流程。

```text
用户消息
  → TaskManager 创建任务
  → AgentRuntime 启动该任务的一轮 Agent
  → Agent 流式输出叙述、计划与结构化工具调用
  → ToolRunner 执行真实工具
  → ToolEventQueue 记录结果
  → AgentRuntime 用新事件唤醒同一任务的下一轮
  → Agent 明确完成 / 请求用户输入 / 受阻
```

React 负责界面渲染、任务展示、鼠标动画和页面组件；Agent 循环不应由组件的渲染或 `useEffect` 隐式推进。

## 2. 任务、轮次与调用

三者必须分开建模：

- **任务（Task）**：一次用户目标，从创建到完成、取消或失败，可跨越多轮。
- **轮次（Turn）**：同一任务的一次模型请求和流式输出。
- **工具调用（ToolCall）**：某一轮内的一次可追踪能力调用。

```ts
type TaskStatus =
  | 'planning'
  | 'waiting_tools'
  | 'waiting_user'
  | 'completed'
  | 'failed'
  | 'cancelled';

interface AgentTask {
  id: string;
  sessionId: string;
  goal: string;
  status: TaskStatus;
  turn: number;
  summary: string;
  plan: TaskPlanItem[];
  events: TaskEvent[];
  pendingCallIds: string[];
}
```

任务相互平级。一个任务可通过只读 `task.search`、`task.read` 查询其他任务的已发布摘要或产物，但不得中断、写入或改变另一个任务的状态。

## 3. 唯一循环与唤醒规则

`AgentRuntime` 是唯一能启动模型轮次的模块。每个任务有一个运行锁：同一时刻最多一个 Agent 轮次。

```text
收到用户消息、工具结果或用户确认
  → 结果写入 TaskEvent 队列
  → 若该任务没有进行中的 Turn，启动下一轮
  → 若该任务正在流式输出，只入队，不并发启动
  → 当前 Turn 结束后，根据队列启动下一轮
```

工具结果不会插入已经发出的模型请求；它们只成为下一轮的新增事实。任务结束条件只能由 Agent 明确输出完成命令，且 Runtime 应检查是否存在覆盖任务目标的工具证据。用户暂时不说话不是任务完成条件。

同一轮内，Runtime 可以并行调度 Agent 明确声明、且彼此独立的只读调用（例如 `guide.lookup` 与 `page.inspect`）；它会等待这一批结果全部写入事件队列后，才唤醒下一轮。任何 `ui.actAndObserve` 或写入调用都是顺序屏障：它之前的读取必须结束，它之后的读取只能看见动作完成后的新状态。并行策略只优化等待时间，绝不补写业务步骤或改变 Agent 选择的调用顺序。

## 4. 流式结构化命令

内心独白和用户可见回复可以流式展示，但只有完整、通过校验的结构化命令才能触发状态变更或工具执行。

```ts
type AgentCommand =
  | { type: 'thought'; text: string }
  | { type: 'task.plan'; items: TaskPlanItem[] }
  | { type: 'tool.call'; callId: string; tool: string; input: unknown }
  | { type: 'user.reply'; text: string }
  | { type: 'task.complete'; result: string }
  | { type: 'task.wait_user'; question: string };
```

流式解析器须满足：

1. 半截 JSON、自然语言草稿或无效命令不得执行。
2. `callId` 在同一任务内唯一，结果按 `callId` 去重。
3. 任务取消后到达的迟到结果只记录，不得再次唤醒任务。

## 5. 工具分层与信息边界

| 层级 | 例子 | 返回内容 | 鼠标参与 |
| --- | --- | --- | --- |
| 操作知识 | `guide.lookup` | 人可阅读的操作说明，不含当前项目答案 | 否 |
| 页面观察 | `page.inspect` | 当前屏幕实际可见的 UI 与文本 | 否 |
| 页面交互 | `ui.actAndObserve` | 动作结果与新的可见页面观察 | 是 |

对 UI 型任务，Mira 的信息边界必须与用户一致：不提供 `script.document.metadata.read`、完整目录读取、剧本文本直读或其他后台数据工具。页面内部可使用数据层渲染 UI，但不得将屏幕外内容或聚合统计注入 Agent 上下文。

工具描述能力，不能编码任务流程。例如“查询总集数”不是工具；Mira 必须依据自己通过界面实际观察到的证据决定是否还能回答。

## 6. 页面观察与组件注册

页面组件在渲染层注册语义化目标，不向 Agent 暴露固定屏幕坐标：

```ts
interface UIComponentDescriptor {
  id: string;                 // 例：script.drawer.open
  label: string;              // 例：剧本
  actions: MouseAction[];     // 例：['click']
  visible: boolean;
  enabled: boolean;
  anchor: () => DOMRect | null;
}
```

`page.inspect` 返回最新的可见区域、当前可操作目标、可见文本和滚动状态。它只列出真正进入视口的组件和目录条目，绝不返回完整目录、屏幕外剧本文本、总集数或其他后台元数据。`anchor` 只供当前帧的鼠标动画定位，不能被持久化为业务坐标。

```json
{
  "pageVersion": 19,
  "openPanel": "script",
  "visibleSection": "episode-directory",
  "targets": [{ "id": "script.toc.list", "label": "目录", "actions": ["scroll"] }],
  "scroll": { "targetId": "script.toc.list", "atBottom": false }
}
```

## 7. `ui.actAndObserve`

这是唯一的可视页面交互入口。Agent 必须显式决定目标与鼠标动作；Runtime 固定执行可靠步骤，但不得决定下一步业务操作。

```ts
interface ActAndObserveInput {
  targetId: string;
  action: 'click' | 'doubleClick' | 'longPress' | 'hover' | 'scroll' | 'drag' | 'type';
  arguments?: Record<string, unknown>;
}
```

```text
校验当前目标存在、可见、启用且支持该动作
  → 鼠标移动至组件锚点
  → 播放对应鼠标动作
  → 页面适配器实际执行 UI 命令
  → 等待状态稳定
  → 调用 page.inspect
  → 返回动作结果与最新页面观察
```

鼠标动作是 Agent 获得页面新事实的唯一公开路径：鼠标到达并完成 UI 动作后，页面才发生相同于人类操作的状态转换，再由新的 `page.inspect` 返回可见结果。页面适配器可连接数据层以渲染界面，但不得把隐藏数据作为工具输出。若目标不存在或状态改变失败，调用应失败并将真实原因返回 Agent。

当前 Full Theater V1 策略要求应用内任务在完成前至少有一次成功的 `ui.actAndObserve`。这只是参与约束，不是操作路径：Runtime 不指定目标、动作、次数或顺序；若 Agent 尚未调用成功，Runtime 会将该事实作为事件反馈给同一 Agent，要求其先 `page.inspect` 并自行选择下一步。

## 8. 操作知识库

操作路径存放于代码中的可版本化知识文件，而不是硬编码在 Runtime 或长期塞入模型上下文：

```text
src/agent/guides/
  script/
    open-panel.ts
    browse-directory.ts
    open-episode.ts
  canvas/
    navigate.ts
  assets/
    inspect.ts
```

每条知识包含意图、前提、已知目标、成功信号、注意事项和正文。`guide.lookup` 仅返回与当前问题相关的条目。

操作知识描述“通常可如何操作”；`page.inspect` 描述“当前确实能做什么”。两者冲突时，Agent 应以页面观察为当前事实。

## 9. 工具状态、事件与调试

```ts
type ToolCallStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled';
```

每个事件至少记录：

```ts
taskId, turnId, callId, toolName,
status, input, output, startedAt, finishedAt
```

`ui.actAndObserve` 可额外展示阶段：`定位目标 → 鼠标动作 → 等待页面 → 读取观察`。节点调试台应能按任务查看轮次、完整模型输入、命令、工具参数、输出和失败原因。

## 10. 上下文策略

Runtime 只提供最小任务信封：用户请求、任务目标与摘要、最新事件、可调用工具、未完成调用和最近用户补充。当前页面事实只由 `page.inspect` 在 Agent 主动请求后提供。

若 Mira 认为信息不足，应自主调用：

- `guide.lookup`：查询操作知识；
- `page.inspect`：获取当前 UI 事实；

未来的专家或跨任务查询也必须遵守同一边界：只能返回用户已发布或明确授权可见的产物，不能成为绕过界面的项目数据后门。

不要把整篇剧本、所有操作手册、全部历史任务或鼠标坐标历史无差别注入每轮上下文。

## 11. 验收场景：查询剧本总集数

这是一个验收场景，不是固定工作流。

```text
用户：看下剧本有几集
Mira：创建任务；并列申请操作知识与页面观察
Mira：根据“用户此刻看见什么”自行决定下一项 UI 动作
Mira：每次显式调用 ui.actAndObserve，逐步操作并获得新的可见观察
Mira：只以可见证据回答，并输出 task.complete
```

“目录最后编号是第 56 集”只证明最后编号；若存在第 0 集、跳号或重复项，Mira 必须如实说明当前可见证据不足，或继续走用户同样可执行的 UI 路径；不得调用隐藏的全量目录或元数据捷径。

## 12. 实施顺序

1. 定义 `Task`、`Turn`、`ToolCall` 与 `TaskEvent` 的纯数据模型。
2. 建立带任务锁和事件队列的唯一 `AgentRuntime`。
3. 实现流式结构化命令协议与校验解析器。
4. 统一工具注册、调用状态和结果回传。
5. 建立组件注册表与增强版 `page.inspect`。
6. 实现通用 `ui.actAndObserve` 与鼠标动作适配层。
7. 将剧本操作说明迁入可检索知识库。
8. 以“查询剧本总集数”“查看第 5 集内容”进行端到端验收。
9. 在节点调试台展示任务、轮次、调用、事件和知识条目。

所有状态、事件和知识条目均必须可序列化。业务层不得依赖 DOM；未来替换 DOM 渲染器时，只需要替换组件注册与鼠标/页面适配层。
