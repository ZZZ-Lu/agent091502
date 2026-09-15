export interface ScriptDirectoryEntry {
  id: string;
  title: string;
  lineNumber: number;
  type: 'episode' | 'scene' | 'chapter' | 'heading' | 'segment';
}

const episodeHeader = /^(?:【\s*)?第\s*([0-9]+|[一二三四五六七八九十百千]+)\s*[集话回](?:\s*[^】]*)?(?:】)?/i;

export const parseScriptDirectory = (scriptText: string): ScriptDirectoryEntry[] => {
  if (!scriptText.trim()) return [];

  return scriptText.split('\n').flatMap((line, index) => {
    const title = line.trim();
    if (!title) return [];
    const episode = episodeHeader.test(title);
    const scene = /^(?:【\s*)?(?:第\s*)?[0-9一二三四五六七八九十百千]+\s*[场幕]/.test(title);
    if (!episode && !scene) return [];
    return [{
      id: `directory-${index}`,
      title,
      lineNumber: index + 1,
      type: episode ? 'episode' : 'scene',
    }];
  });
};

export const countEpisodes = (entries: ScriptDirectoryEntry[]) =>
  entries.filter((entry) => entry.type === 'episode').length;
