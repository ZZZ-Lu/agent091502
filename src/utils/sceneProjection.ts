import { SceneItem } from '../types/script';

export interface SceneScrollProjection {
  sceneId: string;
  orderIndex: number;
  charRange: { start: number; end: number };
  lineRange: { start: number; end: number };
}

export function generateFnv1aHash(str: string): string {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16);
}

export function buildProjectionFromScenes(scenes: SceneItem[]): {
  fullText: string;
  projections: SceneScrollProjection[];
} {
  let fullText = '';
  const projections: SceneScrollProjection[] = [];
  let currentLine = 0;
  
  scenes.forEach((scene, index) => {
    const sceneText = scene.heading + '\n' + scene.content;
    const startChar = fullText.length;
    
    if (index > 0) {
      fullText += '\n\n';
      currentLine += 2;
    }
    
    const linesCount = sceneText.split('\n').length;
    
    const actualStartChar = fullText.length;
    fullText += sceneText;
    const endChar = fullText.length;
    
    projections.push({
      sceneId: scene.id,
      orderIndex: index,
      charRange: { start: actualStartChar, end: endChar },
      lineRange: { start: currentLine, end: currentLine + linesCount - 1 }
    });
    
    currentLine += linesCount - 1;
  });
  
  return { fullText, projections };
}

export function findSceneByCharOffset(projections: SceneScrollProjection[], offset: number): SceneScrollProjection | null {
  for (const proj of projections) {
    if (offset >= proj.charRange.start && offset <= proj.charRange.end) {
      return proj;
    }
  }
  return null;
}
