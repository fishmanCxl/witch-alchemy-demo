export interface ChapterConfig {
  readonly id: number;
  readonly stageTitle: string;
  readonly themeTitle: string;
  readonly firstLevel: number;
  readonly levelCount: 30;
  readonly collectionId: string;
  readonly releaseState: 'available' | 'coming-soon';
}

const TITLES = [
  '见习魔女', '初级魔女', '熟练魔女', '高级魔女', '炼金大师',
  '炼金导师', '大魔女', '星辉魔女', '月之魔女', '传奇炼金师',
] as const;

export const CHAPTERS: readonly ChapterConfig[] = Object.freeze(TITLES.map((stageTitle, index) => Object.freeze({
  id: index + 1,
  stageTitle,
  themeTitle: index === 0 ? '基础炼金' : index === 1 ? '草药与自然' : index === 2 ? '月光魔法' : index === 3 ? '元素炼金' : index === 4 ? '冰霜炼金' : index === 5 ? '风灵炼金' : `第 ${index + 1} 章`,
  firstLevel: index * 30 + 1,
  levelCount: 30 as const,
  collectionId: index === 0
    ? 'star-dew-potion'
    : index === 1 ? 'forest-potion' : index === 2 ? 'moon-glow-potion' : index === 3 ? 'flame-potion' : index === 4 ? 'ice-crystal-potion' : index === 5 ? 'wind-spirit-potion' : `chapter-${String(index + 1).padStart(2, '0')}-potion`,
  releaseState: index <= 5 ? 'available' : 'coming-soon' as const,
})));

export function getChapter(id: number): ChapterConfig | null {
  return Number.isInteger(id) && id >= 1 && id <= CHAPTERS.length
    ? CHAPTERS[id - 1]
    : null;
}

export function chapterForLevel(levelNumber: number): ChapterConfig | null {
  if (!Number.isInteger(levelNumber) || levelNumber < 1 || levelNumber > 300) return null;
  return CHAPTERS[Math.floor((levelNumber - 1) / 30)];
}

export function publishedChapters(): readonly ChapterConfig[] {
  return Object.freeze(CHAPTERS.filter((chapter) => chapter.releaseState === 'available'));
}
