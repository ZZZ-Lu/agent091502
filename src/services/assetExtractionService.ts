import { 
  ExtractionModelType,
  NodePromptConfig,
  NodeModelConfig,
  DEFAULT_NODE_MODELS,
  ScriptProject
} from '../types/script';
import { CODE_PIPELINE_PROMPTS } from '../constants/prompts';

export interface ExtractionOptions {
  modelType?: ExtractionModelType;
  nodeModels?: Partial<NodeModelConfig>;
  deepseekKey?: string;
  customPrompts?: Partial<NodePromptConfig>;
}

export const assetExtractionService = {
  getNodeModels(): NodeModelConfig {
    try {
      const saved = localStorage.getItem('node_models_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_NODE_MODELS,
          ...parsed
        };
      }
    } catch (e) {
      console.warn('Failed to parse node_models_config from localStorage', e);
    }
    return { ...DEFAULT_NODE_MODELS };
  },

  saveNodeModels(models: NodeModelConfig): void {
    try {
      localStorage.setItem('node_models_config', JSON.stringify(models));
    } catch (e) {
      console.error('Failed to save node_models_config', e);
    }
  },

  async extractAssetsFromScript(
    projectId: string,
    scriptText: string,
    apiKey?: string
  ): Promise<{ project: Partial<ScriptProject> & { id: string } }> {
    const lines = scriptText.split('\n');
    const charNames = new Set<string>();
    const locNames = new Set<string>();
    const propNames = new Set<string>();

    for (const line of lines) {
      const trimmed = line.trim();
      const sceneMatch = trimmed.match(/^(?:第[0-9一二三四五六七八九十]+场|[0-9]+[.\-、]|场[0-9]+)\s*[:：\s]?\s*(内景|外景|内|外)?\s*([^\s(（]+)/);
      if (sceneMatch && sceneMatch[2]) {
        locNames.add(sceneMatch[2]);
      }
      const charMatch = trimmed.match(/^([\u4e00-\u9fa5A-Za-z0-9_]{2,8})\s*[:：]/);
      if (charMatch && charMatch[1]) {
        charNames.add(charMatch[1]);
      }
    }

    const characters = Array.from(charNames).slice(0, 12).map((name, i) => ({
      id: `char_${Date.now()}_${i}`,
      name,
      role: '剧中角色',
      appearance: '身着典型服饰，神态鲜明',
      performanceNotes: '情绪投入，契合剧情走向',
    }));

    const locations = Array.from(locNames).slice(0, 10).map((name, i) => ({
      id: `loc_${Date.now()}_${i}`,
      name,
      type: 'INT' as const,
      timeOfDay: '日景',
      atmosphere: '符合剧本空间定位与氛围基调',
      visualDetails: '空间结构开阔，具备生活质感与电影感光影',
    }));

    const props = Array.from(propNames).map((name, i) => ({
      id: `prop_${Date.now()}_${i}`,
      name,
      materialAndState: '实物道具，具有物理磨损质感',
      storySignificance: '剧情关键道具',
    }));

    return {
      project: {
        id: projectId,
        characters,
        locations,
        props,
      }
    };
  },
};
