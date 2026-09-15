export type ScriptView = 'script' | 'directory' | 'assets' | 'universe';

export interface ScriptEpisode {
  id: string;
  number: string;
  title: string;
  startLine: number;
  endLine: number;
  startChar: number;
  endChar: number;
}

const episodeHeader = /^(?:【\s*)?第\s*([0-9]+|[一二三四五六七八九十百千]+)\s*[集话回](.*?)(?:】)?$/i;

export const parseScriptEpisodes = (scriptText: string): ScriptEpisode[] => {
  const lines = scriptText.split('\n');
  const starts = lines.flatMap((raw, index) => {
    const match = raw.trim().match(episodeHeader);
    if (!match) return [];
    const startChar = lines.slice(0, index).reduce((total, line) => total + line.length + 1, 0);
    return [{ index, startChar, number: match[1], title: raw.trim() }];
  });

  return starts.map((start, index) => {
    const next = starts[index + 1];
    const endLine = next ? next.index : lines.length;
    const endChar = next ? next.startChar - 1 : scriptText.length;
    return {
      id: `episode-${start.index + 1}`,
      number: start.number,
      title: start.title,
      startLine: start.index + 1,
      endLine,
      startChar: start.startChar,
      endChar,
    };
  });
};

export const readScriptDirectory = (scriptText: string, options: { range?: [number, number]; query?: string; tailOnly?: boolean } = {}) => {
  let entries = parseScriptEpisodes(scriptText);
  if (options.query?.trim()) {
    const query = options.query.trim().toLowerCase();
    entries = entries.filter(entry => entry.title.toLowerCase().includes(query));
  }
  if (options.tailOnly) entries = entries.slice(-1);
  if (options.range) entries = entries.slice(Math.max(0, options.range[0] - 1), Math.max(0, options.range[1]));
  return entries.map(({ id, number, title, startLine, endLine }) => ({ id, number, title, startLine, endLine }));
};

export const readScriptEpisode = (scriptText: string, episodeId: string, options: { mode?: 'full' | 'excerpt'; lineRange?: [number, number] } = {}) => {
  const episode = parseScriptEpisodes(scriptText).find(item => item.id === episodeId || item.number === episodeId.replace(/^第?|[集话回]$/g, ''));
  if (!episode) throw new Error(`未找到剧集：${episodeId}`);
  const lines = scriptText.split('\n');
  const start = options.lineRange ? Math.max(episode.startLine, options.lineRange[0]) : episode.startLine;
  const end = options.lineRange ? Math.min(episode.endLine, options.lineRange[1]) : episode.endLine;
  const content = lines.slice(start - 1, end).join('\n');
  const maxChars = options.mode === 'excerpt' ? 5000 : 20000;
  return {
    ...episode,
    lineRange: [start, end] as [number, number],
    content: content.slice(0, maxChars),
    truncated: content.length > maxChars,
  };
};

export const searchScript = (scriptText: string, query: string, episodeId?: string) => {
  const needle = query.trim();
  if (!needle) throw new Error('搜索关键词不能为空。');
  const source = episodeId ? readScriptEpisode(scriptText, episodeId, { mode: 'full' }) : { content: scriptText, startLine: 1 };
  return source.content.split('\n').flatMap((line, index) => {
    const position = line.toLowerCase().indexOf(needle.toLowerCase());
    return position < 0 ? [] : [{ lineNumber: source.startLine + index, column: position + 1, snippet: line.trim().slice(0, 300) }];
  }).slice(0, 50);
};

export const readScriptMetadata = (scriptText: string, title: string, updatedAt: number) => {
  const episodes = parseScriptEpisodes(scriptText);
  return {
    title,
    episodeCount: episodes.length,
    lineCount: scriptText ? scriptText.split('\n').length : 0,
    updatedAt,
    directoryComplete: episodes.length > 0,
    firstEpisode: episodes[0] ? { id: episodes[0].id, title: episodes[0].title } : null,
    lastEpisode: episodes.at(-1) ? { id: episodes.at(-1)!.id, title: episodes.at(-1)!.title } : null,
  };
};
