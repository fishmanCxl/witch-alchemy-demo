import { PUBLISHED_LEVEL_DATA } from './level-data.generated.ts';
import { CHAPTER_TWO_LEVEL_DATA } from './level-data.chapter-02.generated.ts';
import { CHAPTER_THREE_LEVEL_DATA } from './level-data.chapter-03.generated.ts';
import { CHAPTER_FOUR_LEVEL_DATA } from './level-data.chapter-04.generated.ts';
import type { BottleState, GameState } from './types.ts';
import type { LevelConfig } from './level-config.ts';

export const FIRST_CHAPTER_CONFIG_VERSION = 'chapter-1.2026-08-25.1' as const;
export const GAME_CONFIG_VERSION = 'chapters-1-4.2026-09-05.1' as const;

function freezeState(state: GameState): GameState {
  const bottles = state.bottles.map((bottle): BottleState => Object.freeze({
    ...bottle,
    layers: Object.freeze([...bottle.layers]),
  }));
  return Object.freeze({
    ...state,
    bottles: Object.freeze(bottles),
  });
}

function freezeLevel(level: LevelConfig): LevelConfig {
  return Object.freeze({
    ...level,
    completionRule: Object.freeze({ ...level.completionRule }),
    metrics: Object.freeze({ ...level.metrics }),
    initialState: freezeState(level.initialState),
  });
}

export const FIRST_CHAPTER_LEVELS: readonly LevelConfig[] = Object.freeze(
  PUBLISHED_LEVEL_DATA.map(freezeLevel),
);

export const CHAPTER_TWO_LEVELS: readonly LevelConfig[] = Object.freeze(
  CHAPTER_TWO_LEVEL_DATA.map(freezeLevel),
);

export const CHAPTER_THREE_LEVELS: readonly LevelConfig[] = Object.freeze(
  CHAPTER_THREE_LEVEL_DATA.map(freezeLevel),
);

export const CHAPTER_FOUR_LEVELS: readonly LevelConfig[] = Object.freeze(
  CHAPTER_FOUR_LEVEL_DATA.map(freezeLevel),
);

export const PUBLISHED_LEVELS: readonly LevelConfig[] = Object.freeze([
  ...FIRST_CHAPTER_LEVELS,
  ...CHAPTER_TWO_LEVELS,
  ...CHAPTER_THREE_LEVELS,
  ...CHAPTER_FOUR_LEVELS,
]);

const BOARD_KEYS = PUBLISHED_LEVELS.map((level) => JSON.stringify(
  level.initialState.bottles.map(({ layers, status }) => ({ layers, status })),
));
if (new Set(BOARD_KEYS).size !== PUBLISHED_LEVELS.length) {
  throw new Error('published levels must not contain duplicate boards');
}

const LEVELS_BY_ID = new Map(PUBLISHED_LEVELS.map((level) => [level.id, level]));
if (LEVELS_BY_ID.size !== PUBLISHED_LEVELS.length) {
  throw new Error('published levels must not contain duplicate ids');
}

export function levelsForChapter(chapterId: number): readonly LevelConfig[] {
  if (chapterId === 1) return FIRST_CHAPTER_LEVELS;
  if (chapterId === 2) return CHAPTER_TWO_LEVELS;
  if (chapterId === 3) return CHAPTER_THREE_LEVELS;
  if (chapterId === 4) return CHAPTER_FOUR_LEVELS;
  return Object.freeze([]);
}

export function getLevelConfig(id: string): LevelConfig | null {
  return LEVELS_BY_ID.get(id) ?? null;
}

export function nextLevelConfig(id: string): LevelConfig | null {
  const current = getLevelConfig(id);
  return current ? getLevelConfig(`level-${String(current.number + 1).padStart(3, '0')}`) : null;
}
