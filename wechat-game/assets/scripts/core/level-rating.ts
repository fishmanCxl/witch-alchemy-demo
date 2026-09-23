import { levelsForChapter } from './level-catalog.ts';
import type { PlayerProgress } from './level-progress.ts';

export type LevelStarRating = 0 | 1 | 2 | 3;

export function levelStarRating(
  completed: boolean,
  bestMoves: number | undefined,
  optimalMoves: number,
): LevelStarRating {
  if (!completed) return 0;
  if (bestMoves === undefined) return 1;
  if (bestMoves <= optimalMoves) return 3;
  const twoStarLimit = optimalMoves + Math.max(2, Math.ceil(optimalMoves * 0.15));
  return bestMoves <= twoStarLimit ? 2 : 1;
}

export function chapterStarTotal(progress: PlayerProgress, chapterId: number): number {
  return levelsForChapter(chapterId).reduce((total, level) => total + levelStarRating(
    level.number <= progress.completedThrough,
    progress.bestMoves[level.id],
    level.metrics.optimalMoves,
  ), 0);
}
