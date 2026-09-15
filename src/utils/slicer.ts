import { SceneChunk } from '../types/script';

export function sliceScriptIntoScenes(scriptText: string, scenePattern: string, flags: string = 'gim'): SceneChunk[] {
  if (!scriptText || !scenePattern) return [];
  
  try {
    // Sanitize flags to only valid characters (g, i, m, s, u, y)
    // If the LLM generates invalid text (like "N为正整数"), this prevents a RegExp constructor crash.
    let validFlags = String(flags || '').replace(/[^gimsuy]/g, '');
    if (!validFlags) validFlags = 'gim'; // Fallback to default if no valid flags remain

    const regex = new RegExp(String(scenePattern), validFlags);
    const lines = scriptText.split('\n');
    const scenes: SceneChunk[] = [];
    
    let currentSceneText: string[] = [];
    let currentSceneTitle = '未命名场景';
    let sceneIndex = 0;
    
    // Very basic extraction logic
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (regex.test(line)) {
        // Save previous scene
        if (currentSceneText.length > 0 || sceneIndex > 0) {
           scenes.push({
             index: sceneIndex,
             title: currentSceneTitle,
             rawText: currentSceneText.join('\n')
           });
        }
        sceneIndex++;
        currentSceneTitle = line.trim();
        currentSceneText = [line];
      } else {
        currentSceneText.push(line);
      }
    }
    
    // push the last one
    if (currentSceneText.length > 0 && sceneIndex > 0) {
      scenes.push({
         index: sceneIndex,
         title: currentSceneTitle,
         rawText: currentSceneText.join('\n')
      });
    }

    return scenes;
  } catch (error) {
    console.error("Failed to slice script with pattern", scenePattern, error);
    return [];
  }
}
