import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createDemoState } from '../assets/scripts/core/demo-level.ts';
import {
  DEMO_LEVEL_CONFIG,
  levelId,
  validateLevelConfig,
  type CompletionRule,
  type LevelConfig,
  type LevelMetrics,
} from '../assets/scripts/core/level-config.ts';
import type { BottleState, GameState, PotionColor } from '../assets/scripts/core/types.ts';
import {
  analyzeState,
  generateCandidate,
  generatedOutputMatches,
  type GeneratedCandidate,
  type GenerationScoreComponents,
  type GenerationSpec,
} from './level-generator.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_PATH = resolve(ROOT, 'assets/scripts/core/level-data.generated.ts');
const REPORT_PATH = resolve(ROOT, 'assets/scripts/core/level-generation-report.json');
const CONFIG_VERSION = 'chapter-1.2026-08-25.1';

interface ReportLevel {
  readonly id: string;
  readonly source: 'tutorial' | 'generated' | 'legacy';
  readonly targetDifficulty: number;
  readonly compatibilityExemption: 'legacy-level-12' | null;
  readonly generatorSeed: number | null;
  readonly attempt: number | null;
  readonly reverseMoves: number | null;
  readonly metrics: LevelMetrics;
  readonly scoreComponents: GenerationScoreComponents | null;
}

const DIFFICULTY_ANCHORS = [
  [1, 0.05],
  [2, 0.60],
  [3, 0.68],
  [5, 0.78],
  [10, 0.88],
  [20, 0.97],
  [25, 1],
  [27, 1],
  [30, 0.90],
] as const;

const COLOR_COUNTS = [
  1, 3, 3, 4, 4, 4, 5, 5, 5, 5,
  6, 8, 6, 6, 6, 7, 7, 7, 7, 7,
  8, 8, 9, 9, 9, 10, 12, 10, 9, 8,
] as const;

interface ReverseMovesOverride {
  readonly selected: number;
  readonly reason: string;
}

const REVERSE_MOVES_OVERRIDES: Readonly<Partial<Record<number, ReverseMovesOverride>>> = {
  2: { selected: 16, reason: 'low-color reverse walk exhausted at the formula value' },
  3: { selected: 16, reason: 'low-color reverse walk exhausted at the formula value' },
  4: { selected: 16, reason: 'low-color reverse walk exhausted at the formula value' },
  5: { selected: 16, reason: 'low-color reverse walk exhausted at the formula value' },
  6: { selected: 16, reason: 'low-color reverse walk exhausted at the formula value' },
  7: { selected: 19, reason: 'formula 24: Unable to generate level 7 from seed 41 after 5000 attempts' },
  8: { selected: 19, reason: 'formula 24: Unable to generate level 8 from seed 2026 after 5000 attempts' },
  9: { selected: 19, reason: 'formula 25: Unable to generate level 9 from seed 1004 after 5000 attempts' },
  10: { selected: 19, reason: 'formula 25: Unable to generate level 10 from seed 7 after 8000 attempts' },
  13: { selected: 22, reason: 'formula 26 exhausted across the audited seed search' },
  14: { selected: 22, reason: 'formula 26 exhausted across the audited seed search' },
  15: { selected: 22, reason: 'formula 26 exhausted across the audited seed search' },
  16: { selected: 25, reason: 'formula 27: Unable to generate level 16 from seed 15024 after 8000 attempts' },
  17: { selected: 25, reason: 'formula 27: Unable to generate level 17 from seed 825 after 8000 attempts' },
  18: { selected: 25, reason: 'formula 27: Unable to generate level 18 from seed 1004 after 8000 attempts' },
  19: { selected: 25, reason: 'formula 27: Unable to generate level 19 from seed 99 after 8000 attempts' },
  20: { selected: 25, reason: 'approved level-20 search uses reverse 25 with its segment override' },
  22: { selected: 27, reason: 'formula 28: Unable to generate level 22 from seed 22 after 12000 attempts' },
};

export function reverseMovesPlanForLevel(number: number): {
  readonly formula: number;
  readonly selected: number;
  readonly overrideReason: string | null;
} {
  const formula = Math.round(6 + chapterOneDifficultyTarget(number) * 22);
  const override = REVERSE_MOVES_OVERRIDES[number];
  return {
    formula,
    selected: override?.selected ?? formula,
    overrideReason: override?.reason ?? null,
  };
}

export function chapterOneDifficultyTarget(level: number): number {
  if (!Number.isInteger(level) || level < 1 || level > 30) {
    throw new RangeError('chapter one level must be an integer from 1 to 30');
  }
  const exact = DIFFICULTY_ANCHORS.find(([anchor]) => anchor === level);
  if (exact) return exact[1];

  for (let index = 1; index < DIFFICULTY_ANCHORS.length; index += 1) {
    const [rightLevel, rightTarget] = DIFFICULTY_ANCHORS[index];
    if (level >= rightLevel) continue;
    const [leftLevel, leftTarget] = DIFFICULTY_ANCHORS[index - 1];
    const progress = (level - leftLevel) / (rightLevel - leftLevel);
    return Math.round((leftTarget + (rightTarget - leftTarget) * progress) * 1_000) / 1_000;
  }
  throw new Error(`Missing difficulty anchors for level ${level}`);
}

export function generationSpecForLevel(number: number): GenerationSpec {
  if (!Number.isInteger(number) || number < 2 || number > 30) {
    throw new RangeError('generated chapter one level must be an integer from 2 to 30');
  }
  const targetDifficulty = chapterOneDifficultyTarget(number);
  const common = {
    number,
    colorCount: COLOR_COUNTS[number - 1],
    emptyBottleCount: 2,
    reverseMoves: reverseMovesPlanForLevel(number).selected,
    targetDifficulty,
  } as const;
  if (number <= 4) {
    return {
      ...common,
      minimumOptimalMoves: 7,
      maximumOptimalMoves: 10,
      minimumSegments: 8,
      minimumExploredStates: 20,
      minimumOpeningMoves: 2,
      maximumOpeningMoves: 12,
      minimumMisleadingBranchRatio: 0.10,
      maxAttempts: 5_000,
    };
  }
  if (number <= 9) {
    return {
      ...common,
      minimumOptimalMoves: 10,
      maximumOptimalMoves: 16,
      minimumSegments: 12,
      minimumExploredStates: 100,
      minimumOpeningMoves: 2,
      maximumOpeningMoves: 14,
      minimumMisleadingBranchRatio: 0.15,
      maxAttempts: 5_000,
    };
  }
  if (number <= 19) {
    return {
      ...common,
      minimumOptimalMoves: 14,
      maximumOptimalMoves: 24,
      minimumSegments: 18,
      minimumExploredStates: 500,
      minimumOpeningMoves: 2,
      maximumOpeningMoves: 16,
      minimumMisleadingBranchRatio: 0.20,
      maxAttempts: 8_000,
    };
  }
  if (number <= 24) {
    return {
      ...common,
      minimumOptimalMoves: 18,
      maximumOptimalMoves: 30,
      minimumSegments: number === 20 ? 25 : 26,
      minimumExploredStates: 2_000,
      minimumOpeningMoves: 2,
      maximumOpeningMoves: 18,
      minimumMisleadingBranchRatio: 0.25,
      maxAttempts: 12_000,
    };
  }
  if (number <= 27) {
    return {
      ...common,
      minimumOptimalMoves: 22,
      maximumOptimalMoves: 40,
      minimumSegments: number === 25 ? 32 : 34,
      minimumExploredStates: 5_000,
      minimumOpeningMoves: 2,
      maximumOpeningMoves: number === 26 ? 20 : number === 27 ? 24 : 18,
      minimumMisleadingBranchRatio: 0.30,
      maxAttempts: 20_000,
    };
  }
  return {
    ...common,
    minimumOptimalMoves: 16,
    maximumOptimalMoves: 30,
    minimumSegments: 24,
    minimumExploredStates: 1_000,
    minimumOpeningMoves: 2,
    maximumOpeningMoves: number === 28 ? 20 : 18,
    minimumMisleadingBranchRatio: 0.20,
    maxAttempts: 10_000,
  };
}

function active(layers: readonly PotionColor[]): BottleState {
  return { layers: [...layers], status: 'active' };
}

function tutorialState(groups: readonly (readonly PotionColor[])[]): GameState {
  const bottles: BottleState[] = groups.map(active);
  bottles.push(active([]), active([]));
  while (bottles.length < 14) bottles.push({ layers: [], status: 'inactive' });
  bottles.push({ layers: [], status: 'reserved' });
  return { bottles, rewardBottleUsed: false, moves: 0 };
}

function authoredTutorial(
  number: number,
  state: GameState,
  colorCount: number,
  completionRule: CompletionRule,
  difficultyScore: number,
): { readonly config: LevelConfig; readonly report: ReportLevel } {
  const analysis = analyzeState(state, colorCount, completionRule);
  if (!analysis) throw new Error(`Tutorial level ${number} is not solvable`);
  const metrics = { ...analysis.metrics, difficultyScore };
  const config: LevelConfig = {
    id: levelId(number),
    number,
    configVersion: CONFIG_VERSION,
    presentationSeed: number,
    capacity: 4,
    slotCount: 15,
    rewardSlotIndex: 14,
    completionRule,
    metrics,
    initialState: state,
  };
  return {
    config,
    report: {
      id: config.id,
      source: 'tutorial',
      targetDifficulty: chapterOneDifficultyTarget(number),
      compatibilityExemption: null,
      generatorSeed: null,
      attempt: null,
      reverseMoves: null,
      metrics,
      scoreComponents: analysis.scoreComponents,
    },
  };
}

function missedMetricWindows(spec: GenerationSpec, metrics: LevelMetrics): readonly string[] {
  const missed: string[] = [];
  if (metrics.optimalMoves < spec.minimumOptimalMoves) {
    missed.push(`optimalMoves>=${spec.minimumOptimalMoves}`);
  }
  if (metrics.optimalMoves > spec.maximumOptimalMoves) {
    missed.push(`optimalMoves<=${spec.maximumOptimalMoves}`);
  }
  if (metrics.segmentCount < spec.minimumSegments) {
    missed.push(`segmentCount>=${spec.minimumSegments}`);
  }
  if (metrics.exploredStates < spec.minimumExploredStates) {
    missed.push(`exploredStates>=${spec.minimumExploredStates}`);
  }
  if (metrics.openingMoves < spec.minimumOpeningMoves) {
    missed.push(`openingMoves>=${spec.minimumOpeningMoves}`);
  }
  if (metrics.openingMoves > spec.maximumOpeningMoves) {
    missed.push(`openingMoves<=${spec.maximumOpeningMoves}`);
  }
  if (metrics.misleadingBranchRatio < spec.minimumMisleadingBranchRatio) {
    missed.push(`misleadingBranchRatio>=${spec.minimumMisleadingBranchRatio}`);
  }
  return missed;
}

export function generateCandidateWithDiagnostics(
  spec: GenerationSpec,
  seed: number,
): GeneratedCandidate {
  try {
    return generateCandidate(spec, seed);
  } catch (error) {
    const expectedExhaustion = error instanceof Error
      && error.message === (
        `Unable to generate level ${spec.number} from seed ${seed} after ${spec.maxAttempts} attempts`
      );
    if (!expectedExhaustion) throw error;

    let nearest: GeneratedCandidate;
    try {
      nearest = generateCandidate({
        ...spec,
        minimumOptimalMoves: 0,
        maximumOptimalMoves: Number.MAX_SAFE_INTEGER,
        minimumSegments: 0,
        minimumExploredStates: 0,
        minimumOpeningMoves: 0,
        maximumOpeningMoves: Number.MAX_SAFE_INTEGER,
        minimumMisleadingBranchRatio: 0,
      }, seed);
    } catch {
      throw new Error(
        `Level ${spec.number}, seed ${seed}, attempts ${spec.maxAttempts}: `
        + 'reverse-walk/candidate construction exhausted before an analyzable candidate; '
        + 'nearest metrics unavailable',
        { cause: error },
      );
    }

    const missed = missedMetricWindows(spec, nearest.metrics);
    const metrics = nearest.metrics;
    throw new Error(
      `Level ${spec.number}, seed ${seed}, attempts ${spec.maxAttempts}: analyzed candidate missed `
      + `${missed.join(', ')}; nearest metrics optimalMoves=${metrics.optimalMoves}, `
      + `segmentCount=${metrics.segmentCount}, exploredStates=${metrics.exploredStates}, `
      + `openingMoves=${metrics.openingMoves}, `
      + `misleadingBranchRatio=${metrics.misleadingBranchRatio}`,
      { cause: error },
    );
  }
}

function generatedLevel(
  spec: GenerationSpec,
  seed: number,
): { readonly config: LevelConfig; readonly report: ReportLevel } {
  const candidate = generateCandidateWithDiagnostics(spec, seed);
  const config: LevelConfig = {
    id: levelId(spec.number),
    number: spec.number,
    configVersion: CONFIG_VERSION,
    presentationSeed: spec.number,
    capacity: 4,
    slotCount: 15,
    rewardSlotIndex: 14,
    completionRule: { type: 'all-colors', targetCount: spec.colorCount },
    metrics: candidate.metrics,
    initialState: candidate.initialState,
  };
  return {
    config,
    report: {
      id: config.id,
      source: 'generated',
      targetDifficulty: spec.targetDifficulty,
      compatibilityExemption: null,
      generatorSeed: candidate.seed,
      attempt: candidate.attempt,
      reverseMoves: candidate.inverseMoves.length,
      metrics: candidate.metrics,
      scoreComponents: candidate.scoreComponents,
    },
  };
}

function generatorSeedForLevel(number: number): number {
  if (number === 2) return 2;
  if (number === 3) return 4;
  if (number === 4) return 2;
  if (number === 5) return 4;
  if (number === 6) return 825;
  if (number === 7) return 41;
  if (number === 8) return 2_026;
  if (number === 9) return 1_004;
  if (number === 10) return 7;
  if (number === 13) return 1_004;
  if (number === 14) return 2_026;
  if (number === 15) return 825;
  if (number === 16) return 15_024;
  if (number === 17) return 825;
  if (number === 18) return 1_004;
  if (number === 19) return 99;
  if (number === 20) return 9;
  if (number === 22) return 22;
  if (number === 25) return 25;
  if (number === 26) return 1_004;
  if (number === 27) return 27;
  return (0x2508_0000 + Math.imul(number, 104_729)) >>> 0;
}

function buildPublishedLevels(): {
  readonly levels: readonly LevelConfig[];
  readonly report: readonly ReportLevel[];
} {
  const tutorial = authoredTutorial(
    1,
    tutorialState([['rose'], ['rose', 'rose', 'rose']]),
    1,
    { type: 'first-valid-pour' },
    300,
  );

  const anchorState = createDemoState();
  const anchorAnalysis = analyzeState(
    anchorState,
    8,
    { type: 'all-colors', targetCount: 8 },
  );
  if (!anchorAnalysis) throw new Error('Frozen level 12 exceeds the solver budget');
  const anchor: LevelConfig = {
    ...DEMO_LEVEL_CONFIG,
    initialState: anchorState,
    metrics: anchorAnalysis.metrics,
  };
  const anchorEntry = {
    config: anchor,
    report: {
      id: anchor.id,
      source: 'legacy',
      targetDifficulty: chapterOneDifficultyTarget(12),
      compatibilityExemption: 'legacy-level-12',
      generatorSeed: null,
      attempt: null,
      reverseMoves: null,
      metrics: anchor.metrics,
      scoreComponents: anchorAnalysis.scoreComponents,
    } satisfies ReportLevel,
  };

  const entries: Array<{
    readonly config: LevelConfig;
    readonly report: ReportLevel;
  }> = [];
  for (let number = 1; number <= 30; number += 1) {
    if (number === 1) {
      entries.push(tutorial);
    } else if (number === 12) {
      entries.push(anchorEntry);
    } else {
      entries.push(generatedLevel(
        generationSpecForLevel(number),
        generatorSeedForLevel(number),
      ));
    }
  }

  const boardKeys = new Set<string>();
  for (const { config } of entries) {
    const errors = validateLevelConfig(config);
    if (errors.length > 0) throw new Error(`${config.id}: ${errors.join('; ')}`);
    const boardKey = JSON.stringify(config.initialState.bottles.map((bottle) => ({
      layers: bottle.layers,
      status: bottle.status,
    })));
    if (boardKeys.has(boardKey)) throw new Error(`${config.id}: duplicate published board`);
    boardKeys.add(boardKey);
  }

  return {
    levels: entries.map(({ config }) => config),
    report: entries.map(({ report }) => report),
  };
}

function generatedTypeScript(levels: readonly LevelConfig[]): string {
  return [
    "import type { LevelConfig } from './level-config.ts';",
    '',
    '// Generated by tools/generate-levels.ts. Do not edit by hand.',
    `export const PUBLISHED_LEVEL_DATA: readonly LevelConfig[] = ${JSON.stringify(levels, null, 2)};`,
    '',
  ].join('\n');
}

function generatedReport(report: readonly ReportLevel[]): string {
  return `${JSON.stringify({
    schemaVersion: 2,
    configVersion: CONFIG_VERSION,
    levels: report,
  }, null, 2)}\n`;
}

function checkOrWrite(path: string, content: string, check: boolean): boolean {
  if (check) return existsSync(path) && generatedOutputMatches(readFileSync(path, 'utf8'), content);
  writeFileSync(path, content, 'utf8');
  return true;
}

function main(): void {
  const check = process.argv.includes('--check');
  const published = buildPublishedLevels();
  const matches = [
    checkOrWrite(DATA_PATH, generatedTypeScript(published.levels), check),
    checkOrWrite(REPORT_PATH, generatedReport(published.report), check),
  ].every(Boolean);

  if (!matches) {
    console.error('Published level output differs from deterministic generation');
    process.exitCode = 1;
  } else if (check) {
    console.log('30 published levels match generated output');
  } else {
    console.log('Generated 30 published levels and difficulty report');
  }
}

const isMain = process.argv[1] !== undefined
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();

