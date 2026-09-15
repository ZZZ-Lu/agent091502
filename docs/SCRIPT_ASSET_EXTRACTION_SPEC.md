# 剧本资产提取与管理系统设计方案 (Script Asset Extraction & Management Spec)

## 一、 系统定位与设计原则
本方案专注于从剧本文本中**高效、无误、结构化地提取文学与影视制作层面的核心资产**（角色、场景、关键道具、氛围特效等），支持**全文全量提取**、**基于全局上下文的局部精准提取**以及完善的**资产增删改查（CRUD）与合并防冲突机制**。
> **注**：资产提取阶段聚焦于剧本本体特征与实体属性的纯粹抽取与归纳，**不包含生图提示词（Prompt）生成内容**。

---

## 二、 模型节点拓扑设计（全量提取流水线）

为了避免长文本注意力衰减、实体遗漏、同人异名重复等问题，提取管线采用多阶段模型节点流水线：

```
[剧本全文输入] 
   │
   ├──▶ 节点 1：结构化切片与场次索引节点 (Chunking & Scene Indexing Node)
   │        └─ 解析场景头（如 INT./EXT.）、对白与动作描写，建立场次与位置索引
   │
   ├──▶ 节点 2：多分类并行实体抽取节点 (Parallel Entity Extraction Node)
   │        ├─ 子通道 A: 角色实体抽取 (Characters - 姓名、别名、身份、外貌体态、服饰)
   │        ├─ 子通道 B: 场景空间抽取 (Scenes/Environments - 地点、空间特征、建筑/内饰、时间与光影环境)
   │        └─ 子通道 C: 关键道具与物品抽取 (Props - 道具名称、专属归属、物理特征、剧本作用)
   │
   └──▶ 节点 3：实体消歧与全局归一化节点 (Entity Resolution & Global Normalization Node)
            ├─ 别名合并 (Alias Merging): 将 "林捕头"、"小林"、"黑衣青年" 统一消歧归一为主实体 "林墨"
            ├─ 资产从属关系绑定: "绣春刀" 自动关联为 "林墨" 的专属道具
            └─ 多场次特征聚合: 汇总分散在不同场次的外貌、服饰变化，生成完整资产档案
```

---

## 三、 局部提取设计（全局上下文锚定机制）

局部提取（如用户选中单场或划选特定文本段落）必须具备全局感知能力，避免断章取义：

```
[划选/选中的局部文本] 
         + 
[当前项目全局资产清单 (Global Asset Catalog)]  ──▶  [局部解析模型节点 (Local Context Node)]
         +                                                │
[剧本全局摘要 / 角色关系图谱 (Project Summary)]                ▼
                                            [差异研判与意图识别]
                                                  ├── ① 识别已有资产的引用（保持原有 ID 绑定）
                                                  ├── ② 识别已有资产的新增属性（如：角色换装/负伤等状态变化）
                                                  └── ③ 识别全新出现的独立资产（新建项）
```

- **上下文注入 (System Context)**：将已有资产库（ID、主名称、别名、类型）作为先验知识输入模型。
- **引用优先**：模型遇到代词（如“他”、“黑衣人”）时，根据上下文优先与已有资产对齐，不随意新建冗余实体。

---

## 四、 资产增删改查与版本合并机制 (CRUD & Merge Engine)

### 1. 增量合并与防冲突 (Create & Merge Diff)
提取完成后向用户展示清晰的比对审查面板（Review Diff）：
- 🟢 **New（新发现）**：全新的角色/场景/道具，默认勾选加入项目资产库；
- 🟡 **Update（属性增强）**：已有资产在当前文本中提取到补充特征（如补充了服饰描写），展示新旧对比，支持勾选合并；
- ⚪ **Unchanged（无变化）**：已有且一致，自动跳过。

### 2. 用户编辑锁定保护 (Locked Fields Protection)
- 若用户手动精修了某个资产的描述或属性，该字段标记为 `isUserModified: true`；
- 后续执行全文或局部重新提取时，**严格保护已锁定的字段不被 AI 覆盖**。

### 3. 查询与剧本双向溯源 (Query & Traceability)
- **多维筛选**：支持按类型（角色/场景/道具）、按场次、按归属角色快速检索；
- **原文溯源定位**：点击资产即可高亮查看其在剧本中出现的具体场次与原文段落。

### 4. 修改与删除 (Update & Delete)
- **级联提示**：删除或修改主资产名称时，支持联动检查和更新其关联的道具/场景绑定关系。

---

## 五、 核心数据模型 (Data Schema)

```typescript
export type ScriptAssetType = 'character' | 'scene' | 'prop' | 'atmosphere';

export interface AssetOccurrence {
  sceneIndex: number;            // 场次序号 (如 1, 2, 3)
  sceneTitle?: string;           // 场次标题 (如 "第1场 密室夜谈")
  snippet: string;               // 剧本原文引用片段
}

export interface ScriptAsset {
  id: string;                    // 唯一标识 UUID
  projectId: string;             // 所属项目 ID
  type: ScriptAssetType;         // 资产分类
  name: string;                  // 标准主名称 (如 "林墨")
  aliases: string[];             // 别名/称谓列表 (如 ["林统领", "黑衣人", "小林"])
  
  // 角色专属属性
  roleCategory?: 'protagonist' | 'supporting' | 'extra'; // 主角 / 配角 / 群众
  gender?: string;               // 性别
  ageGroup?: string;             // 年龄段 (如 "青年 / 20岁出头")
  
  // 描述性细节（纯文本/文学特征，不含生图提示词）
  description: {
    summary: string;             // 一句话总述
    appearance?: string;         // 容貌、体态、发型、面部特殊特征
    clothing?: string;           // 服装款式、材质、配色
    personality?: string;        // 性格气质与举止特征
    spatialDetails?: string;     // 场景专属：建筑结构、室内陈设、空间规模
    lightingAndTone?: string;    // 场景专属：时间天气、自然/人造光线、环境氛围
    physicalDetails?: string;    // 道具专属：材质、尺寸、功能、特殊标记
  };

  // 关系与溯源
  associatedAssetIds?: string[]; // 关联资产 ID（如专属武器、所属场景、所属人物）
  occurrences: AssetOccurrence[]; // 出现场次与剧本原文片段
  
  // 状态与保护标记
  isUserModified?: boolean;      // 用户是否手工修改过
  lockedFields?: string[];       // 用户锁定的字段列表（防自动重提覆盖）
  createdAt: number;
  updatedAt: number;
}
```
