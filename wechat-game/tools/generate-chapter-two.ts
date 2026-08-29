import type { GenerationSpec } from './level-generator.ts';

const DIFFICULTY_ANCHORS = [
  [31, 0.88],
  [32, 0.96],
  [35, 0.99],
  [40, 1.01],
  [50, 1.04],
  [55, 1.05],
  [57, 1.05],
  [60, 0.98],
] as const;

function assertChapterTwoLevel(levelNumber: number): void {
  if (!Number.isInteger(levelNumber) || levelNumber < 31 || levelNumber > 60) {
    throw new RangeError('chapter two level must be an integer from 31 to 60');
  }
}

export function chapterTwoDifficultyTarget(levelNumber: number): number {
  assertChapterTwoLevel(levelNumber);
  const exact = DIFFICULTY_ANCHORS.find(([anchor]) => anchor === levelNumber);
  if (exact) return exact[1];

  for (let index = 1; index < DIFFICULTY_ANCHORS.length; index += 1) {
    const [rightLevel, rightTarget] = DIFFICULTY_ANCHORS[index];
    if (levelNumber >= rightLevel) continue;
    const [leftLevel, leftTarget] = DIFFICULTY_ANCHORS[index - 1];
    const progress = (levelNumber - leftLevel) / (rightLevel - leftLevel);
    return Math.round((leftTarget + (rightTarget - leftTarget) * progress) * 1_000) / 1_000;
  }
  throw new Error(`Missing difficulty anchors for level ${levelNumber}`);
}

export function chapterTwoGenerationSpec(levelNumber: number): GenerationSpec {
  const target = chapterTwoDifficultyTarget(levelNumber);
  const progress = Math.max(0, Math.min(1, (target - 0.88) / (1.61 - 0.88)));
  const minimumOptimalMoves = Math.round(22 + 10 * progress);
  return {
    number: levelNumber,
    colorCount: Math.round(8 + 4 * progress),
    emptyBottleCount: 2,
    reverseMoves: Math.round(24 + 10 * progress),
    targetDifficulty: Math.min(1, target),
    minimumOptimalMoves,
    maximumOptimalMoves: minimumOptimalMoves + 14,
    minimumSegments: Math.round(26 + 10 * progress),
    minimumExploredStates: Math.round(2_000 * 10 ** (1.2 * progress)),
    minimumOpeningMoves: 2,
    maximumOpeningMoves: Math.round(18 - 6 * progress),
    minimumMisleadingBranchRatio: 0.25 + 0.20 * progress,
    maxAttempts: 25_000,
  };
}

export function chapterTwoGeneratorSeed(levelNumber: number): number {
  assertChapterTwoLevel(levelNumber);
  return (0x2608_0000 + Math.imul(levelNumber, 104_729)) >>> 0;
}
