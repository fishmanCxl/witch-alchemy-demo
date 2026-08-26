import { PUBLISHED_LEVEL_DATA } from './level-data.generated.ts';
import type { BottleState, GameState } from './types.ts';
import type { LevelConfig } from './level-config.ts';

export const FIRST_CHAPTER_CONFIG_VERSION = 'chapter-1.2026-08-25.1' as const;

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

const LEVELS_BY_ID = new Map(FIRST_CHAPTER_LEVELS.map((level) => [level.id, level]));

export function getLevelConfig(id: string): LevelConfig | null {
  return LEVELS_BY_ID.get(id) ?? null;
}

export function nextLevelConfig(id: string): LevelConfig | null {
  const current = getLevelConfig(id);
  return current ? getLevelConfig(`level-${String(current.number + 1).padStart(3, '0')}`) : null;
}
