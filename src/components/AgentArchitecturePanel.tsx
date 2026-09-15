import { useState } from 'react';

// Versioned design content; no runtime implementation or browser persistence.
const sections = [
  [
    "系统边界",
    "用户直接进入唯一 Agent。意图理解、任务建立、规划、工具选择、追问和完成都由该 Agent 决定。\n展示层接收输入并渲染；AgentRuntime 接收当前项目、当前任务和用户消息，维护该任务的交互记录，管理轮次、流式连接与唤醒；执行层解析、校验、调度指令；工具与专家执行能力；项目数据层保存业务事实。只有 Agent 具有自主决策循环。\n一次用户目标对应一个独立任务；任务内部的读取、分析、生成、页面动作等都是该任务调用的工具、专家或流程节点，不另建子 Agent 或子任务。对 UI 型任务，Agent 的信息边界与用户相同：只能从当前可见页面和人可读操作说明取得项目事实。"
  ],
  [
    "唯一运行链路",
    "用户消息 → Runtime 提供最小启动信息与已有交互记录 → 唯一 Agent 流式输出 → 增量解析 → 校验 → 调度 → 调用结果与事件 → 满足唤醒条件 → 同一 Agent 下一轮。\nAgent 先判断当前证据是否足够；不足时，可按需查询操作知识和当前页面，再根据新观察决定行动。UI 型任务不预先注入剧本、目录或后台统计。\n派发分支包含：工作说明、回复、任务建立、计划更新、操作知识查询、页面观察、动作执行、等待、追问与完成。这些是可选能力，不是每轮必须走完的固定流程。"
  ],
  [
    "流式输出协议",
    "建议采用逐行 JSON。每条记录包含 version、id、type、payload；projectId、taskId、turnId 由运行时绑定。界面将协议渲染为可读输出。\nnarrate：追加显式工作说明。\ntask.create：建立目标与完成条件。\nplan.update：建立或调整计划。\ntool.call：调用工具，包括页面操作。\nexpert.call：咨询专家。\nawait：声明等待的调用。\nask_user：提问并等待。\nrespond：向用户回复。\ntask.complete：明确完成任务。\n解析器建议每 50–100ms 消费新增内容，保留半条记录，仅执行完整且通过 Schema 校验的指令。记录偏移量、按指令 ID 去重；非法指令返回错误供 Agent 修正。工具返回内容不能作为指令执行。\n流式连接结束只表示本轮生成结束。narrate 是 Agent 主动输出的简短工作说明。"
  ],
  [
    "任务、轮次、调用与事件",
    "Project：业务范围与长期事实，例如剧本、资产、画布和项目级约束。\nTask：一个独立的用户目标，归属一个 Project，跨多轮请求；记录目标、完成条件、计划、关联调用和最终结果。读取剧本、分析内容、生成图片或页面动作都是其内部调用，不是独立任务。\nTurn：一次模型请求及流式输出。\nCall：一次工具或专家调用。\nArtifact：任务显式发布、可版本化的结果，例如分镜表、角色设定、图片或分析结论。\nTaskReference：当前任务对其他任务摘要或某个 Artifact 版本的只读引用。\nEvent：追加保存的事实记录。\nJob：独立的长时间媒体生成任务。提交工具成功不等于图片生成完成。\nTask 状态：running ↔ waiting_tools / waiting_user；running → completed / failed / cancelled。\nCall 状态：queued → running → succeeded / failed / cancelled。\n任务之间平级且执行隔离：可读取已发布的稳定快照，不得修改、暂停、取消或覆盖对方的运行状态。\nConversation / Connection 仅是可选的界面和传输通道，管理消息顺序、订阅和断线重连；不拥有任务、不决定任务关系。\n计划步骤是工作记录，不是另一套自动执行脚本。"
  ],
  [
    "等待、唤醒与停止",
    "每个 Task 第一版最多一个正在生成的 Turn。不同任务的 Agent 轮次彼此独立；同一任务内，Agent 可并行查询知识和页面，并声明等待两个调用；本轮结束且等待条件满足后，Runtime 合并结果启动下一轮。\n工具可在流式输出期间开始执行。返回结果先进入队列，不能直接启动同一任务的并发模型轮次。结果通常加入下一轮上下文，不假设可插入已经发出的模型请求。\n没有新结果或用户输入时不空转。无有效指令或反复失败设置次数上限。\n用户停止时 Runtime 立即终止后续调度，取消可取消请求；迟到结果留存但不唤醒任务。"
  ],
  [
    "工具注册与专家",
    "工具注册表包含 name、description、inputSchema、outputSchema、execution（client/server）、effect（read/ui/write/job）、timeoutMs、retryPolicy（none/safe），并关联执行函数、动画适配器和权限。模型只调用已注册能力。\n当前 UI 型任务只公开三项能力：guide.lookup 查询人可阅读的操作知识；page.inspect 观察当前真正可见的页面；ui.actAndObserve 在已观察目标上执行鼠标动作并返回新观察。\n剧本元数据、完整目录、屏幕外正文和后台项目状态不属于 Agent 工具。未来专家或跨任务读取也只能返回用户已发布或明确授权可见的产物，不能成为绕过界面的数据后门。"
  ],
  [
    "鼠标与实际操作",
    "页面交互统一通过 ui.actAndObserve：Agent 明确提交 targetId、鼠标动作与参数；Runtime 校验目标在最近一次 page.inspect 中可见且支持动作，鼠标适配层完成移动和动作，页面适配器执行对应 UI 命令，最后返回新的 page.inspect。Runtime 不会依据任务或工具名称补写任何点击、滚动或目录流程。\n鼠标动作是 Agent 获得新页面事实的公开路径：页面可从数据层渲染，但不能把隐藏数据直接交给 Agent。动作失败必须返回真实原因，不能虚报页面已打开。\n稳定目标标识：script-bible-toggle、script.toc.open、script.toc.list、script.episode:{id}。组件注册可用性、支持动作和临时定位信息；模型不生成像素坐标。\n每次 actAndObserve 的动作结果和页面观察作为工具事件进入队列，唤醒同一任务的下一轮 Agent。"
  ],
  [
    "操作知识、页面观察与上下文",
    "knowledge/ 按剧本、资产、图片、画布保存版本化操作知识。每份包含入口、前提、成功信号和注意事项，由 guide.lookup 按需返回片段；它不能携带当前项目答案。\npage.inspect 仅返回当前屏幕真实可见的面板、文本、可操作目标、目录当前可见条目和滚动状态。它不返回完整目录、屏幕外正文、总集数或其他后台元数据。\n知识描述通常怎么做，观察描述此刻有什么。两者冲突以实际观察为依据，由 Agent 重判。最后编号为第56集，不代表实际条目有56个。\n上下文按需获取：Runtime 不替 Agent 检索或选择业务资料；由 Agent 决定当前证据是否足够，并通过工具申请查阅。启动时只固定提供基本规则、指令协议和可用工具说明。\n同一任务已发生的对话、计划和调用结果保留在交互记录中，供下一轮继续使用，避免重复查询。示例：收到“看下剧本有几集”时，不预先注入剧本与目录；Agent 先查操作知识、看当前页面，再依据新观察自主选择点击或滚动。"
  ],
  [
    "前后端与持久化",
    "服务端：AgentRuntime、模型连接、流式解析、调度、任务事件保存、专家与服务端工具。\n浏览器：页面观察、目标注册、鼠标动画、界面工具执行和 React 渲染。\n项目数据层：剧本、目录、卡片、资产、媒体状态。\n服务端向浏览器发送界面执行请求，按 callId 对应回执。浏览器断开后，依赖界面的任务等待重连，不报告虚假成功；组件重新挂载不重复启动模型循环。\n建议第一版 SQLite 保存任务、调用与事件；Prompt、操作知识和工具定义保存在代码中，API 凭证留在服务端。持久化记录可序列化。"
  ],
  [
    "模块目录与开发约束",
    "shared/agent/ — 协议、任务、调用、事件类型。\nserver/agent/ — 唯一 Runtime、最小输入封装、交互记录与模型适配。\nserver/tools/、server/experts/ — 服务端工具、专家。\nserver/persistence/ — 任务、调用与事件存储。\nsrc/agent/ — 客户端桥、页面观察、目标注册。\nsrc/agent/mouse/ — 鼠标队列与动画。\nsrc/components/ — 展示组件。\nknowledge/ — 操作知识。\n新增功能必须明确：所属模块、输入输出、状态归属、错误回流、鼠标与观察需求。禁止组件启动自主循环、自然语言匹配触发操作、硬编码业务节点顺序。\n数据为可序列化纯对象。世界坐标与相机独立；临时屏幕定位隔离在适配层。迁移 Canvas/WebGL 时只替换渲染与定位适配。"
  ],
  [
    "调试与首个验收任务",
    "按任务追踪：用户输入 → 每轮完整模型输入 → 原始输出流 → 已解析指令 → 工具状态 → 页面观察 → 下一轮输入 → 最终回复。使用关联 ID 定位重复点击、提前回答和鼠标无动作等问题。\n首个验收任务：看下剧本有几集。Agent 自主查询知识、观察页面，按现场打开剧本和目录，必要时滚动。每个界面动作有鼠标与新观察，依据证据回复，显式完成任务。\n从面板关闭与目录已打开两种起点验收，确认能够选择不同步骤。\n讨论确认后，将模块边界和开发约束同步为版本化开发文档。"
  ]
];

export const AgentArchitecturePanel = () => {
  const [active, setActive] = useState(0);
  return <section className="flex h-full min-h-0 flex-col bg-[#fbfbfc] dark:bg-[#121214]">
    <header className="shrink-0 border-b border-slate-200 px-6 py-5 dark:border-white/10">
      <h2 className="text-xl font-semibold">Mira 技术架构 V1 <span className="ml-3 rounded-full bg-amber-100 px-3 py-1 text-xs font-normal text-amber-800">讨论稿 · Runtime 实施中</span></h2>
      <p className="mt-2 text-sm text-slate-500">单 Agent · 流式指令 · 工具执行 · 观察回流。按章节编号逐条讨论、修订。</p>
    </header>
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <nav aria-label="架构方案章节" className="flex shrink-0 gap-1 overflow-auto border-b border-slate-200 p-3 md:w-64 md:flex-col md:border-b-0 md:border-r dark:border-white/10">
        {sections.map(([title], i) => <button key={title} onClick={() => setActive(i)} aria-current={active === i ? 'page' : undefined}
          className={`shrink-0 rounded-lg px-3 py-3 text-left text-sm ${active === i ? 'bg-violet-100 text-violet-800 dark:bg-violet-500 dark:text-violet-200' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10'}`}>
          <span className="mr-2 font-mono text-xs opacity-60">{String(i+1).padStart(2, '0')}</span>{title}
        </button>)}
      </nav>
      <article key={active} className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain p-6 md:p-10">
        <div className="mx-auto max-w-4xl">
          <p className="mb-2 text-xs tracking-widest text-violet-500">讨论条目 {String(active+1).padStart(2,'0')} / 11</p>
          <h3 className="mb-6 text-2xl font-semibold">{sections[active][0]}</h3>
          {sections[active][1].split('\n').map((text,i) => <p key={i} className="mb-5 text-sm leading-8 text-slate-600 dark:text-slate-300">{text}</p>)}
          <div className="mt-10 flex justify-between border-t border-slate-200 pt-4 dark:border-white/10">
            <button disabled={active === 0} onClick={() => setActive(active-1)} className="text-sm text-violet-500 disabled:opacity-30">← 上一节</button>
            <button disabled={active === sections.length-1} onClick={() => setActive(active+1)} className="text-sm text-violet-500 disabled:opacity-30">下一节 →</button>
          </div>
        </div>
      </article>
    </div>
  </section>;
};
