export interface ScriptCharacter {
  id: string;
  name: string;
  role: string; // 身份 / 角色设定
  age?: string;
  gender?: string;
  appearance: string; // 外貌与衣着特征
  personality?: string; // 性格与心理特征
  props?: string[]; // 随身道具 / 关联道具
  performanceNotes: string; // 镜头表演/情绪重点
  aliases?: string[]; // 别名或代称
  sourceScenes?: string[]; // 出现场次，如 ["第1场", "第3场"]
  referenceImage?: string; // 已生成的参考图
}

export interface ScriptLocation {
  id: string;
  name: string;
  type: 'INT' | 'EXT'; // 内景 / 外景
  timeOfDay: string; // 时间氛围（如 雨夜、黄昏）
  atmosphere: string; // 氛围与光影影调
  visualDetails: string; // 空间建筑与材质细节
  sourceScenes?: string[];
  referenceImage?: string;
}

export interface ScriptProp {
  id: string;
  name: string;
  owner?: string; // 所属角色
  materialAndState: string; // 材质与物理状态
  storySignificance: string; // 剧情关键与特写表现
  sourceScenes?: string[];
  referenceImage?: string;
}

export interface SceneChunk {
  index: number;
  title: string;
  type?: 'INT' | 'EXT' | 'MIXED';
  locationName?: string;
  timeOfDay?: string;
  characterNames?: string[];
  rawText: string;
}

export type ExtractionModelType = 
  | 'auto' 
  | 'deepseek-v4-flash' 
  | 'deepseek-v4-pro' 
  | 'deepseek-v4.1-flash-expires-on-0910'
  | 'qwen3.8-flash'
  | 'glm-5.3-flash'
  | 'glm-5.3-flash-low'
  | 'glm-5.3-flash-high'
  | 'glm-5.3-flash-max'
  | 'ZHIPU/GLM-5.3-Flash'
  | 'ZHIPU/GLM-5.3-Flash-low'
  | 'ZHIPU/GLM-5.3-Flash-high'
  | 'ZHIPU/GLM-5.3-Flash-max'
  | 'deepseek'
  | 'heuristic';

export interface NodeModelConfig {
  agentModel: ExtractionModelType;
  tocInferModel: ExtractionModelType;
  changeAssessModel: ExtractionModelType;
}

export const DEFAULT_NODE_MODELS: NodeModelConfig = {
  agentModel: 'deepseek-v4-flash',
  tocInferModel: 'deepseek-v4-flash',
  changeAssessModel: 'deepseek-v4-flash'
};

export interface NodePromptConfig {
  tocInferSystemPrompt: string;
  changeAssessSystemPrompt: string;
}

export { CODE_PIPELINE_PROMPTS as DEFAULT_NODE_PROMPTS } from '../constants/prompts';

export interface AssetPipelineOptions {
  modelType?: ExtractionModelType;
  nodeModels?: Partial<NodeModelConfig>;
  deepseekKey?: string;
  customPrompts?: Partial<NodePromptConfig>;
}

export interface ScriptUniverse {
  era: string; // 时代背景
  artStyle: string; // 画面艺术风格
  colorTone: string; // 影调与色彩系统
  cinematography: string; // 摄影机与镜头规范
  colorHexes?: string[]; // 主色卡
}

export interface ScriptProject {
  id: string;
  name: string;
  logline: string; // 一句话剧情梗概
  createdAt: number;
  updatedAt: number;
  scriptText: string;
  universe: ScriptUniverse;
  scenes?: SceneChunk[]; // 另存的智能分场切片信息
  characters: ScriptCharacter[];
  locations: ScriptLocation[];
  props: ScriptProp[];
  // NEW: Scene-based backend storage
  sceneItems?: SceneItem[]; // Strict scene separation
  activeMilestoneId?: string;
}

export type SceneChangeType = 
  | 'unmodified'  // 未修改
  | 'modified'    // 内部改动
  | 'added'       // 新增场次
  | 'deleted'     // 删除场次
  | 'renumbered'; // 仅编号顺延

export interface SceneDiffItem {
  sceneId: string;              
  changeType: SceneChangeType;
  oldIndex?: number;            
  newIndex?: number;            
  oldTitle?: string;
  newTitle?: string;
  lineRange: { start: number; end: number }; 
  charRange: { start: number; end: number }; 
  diffSummary: {
    addedLinesCount: number;
    deletedLinesCount: number;
    textDeltaPreview?: string;  
  };
}

export interface ScriptDiffResult {
  baselineVersionId: string;
  isDirty: boolean;
  totalScenesOld: number;
  totalScenesNew: number;
  changedScenesCount: number;
  details: SceneDiffItem[];
  timestamp: number;
}

export interface SceneItem {
  id: string;                 
  orderIndex: number;         
  heading: string;            
  content: string;            
  contentHash: string;        
  updatedAt: number;          
  versionCount: number;       
}

export interface ScriptMilestone {
  id: string;
  projectId: string;
  timestamp: number;
  name: string;
  description: string;
  sceneItems: SceneItem[];
}

export const DEFAULT_SCRIPT_TEXT = '';

export const EMPTY_PROJECT: ScriptProject = {
  id: 'proj_default',
  name: '未命名剧本',
  logline: '暂无剧本梗概',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  scriptText: '',
  universe: {
    era: '未设定时代背景',
    artStyle: '未设定艺术风格',
    colorTone: '未设定影调色彩',
    cinematography: '电影感宽银幕（2.39:1），写实影调',
    colorHexes: ['#1e293b', '#334155', '#64748b', '#94a3b8']
  },
  scenes: [],
  characters: [],
  locations: [],
  props: []
};

export const DEFAULT_PROJECT: ScriptProject = EMPTY_PROJECT;
