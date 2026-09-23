import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  levelId,
  validateLevelConfig,
  type LevelConfig,
  type LevelMetrics,
} from '../assets/scripts/core/level-config.ts';
import { CHAPTER_TWO_LEVEL_DATA } from '../assets/scripts/core/level-data.chapter-02.generated.ts';
import { CHAPTER_THREE_LEVEL_DATA } from '../assets/scripts/core/level-data.chapter-03.generated.ts';
import { CHAPTER_FOUR_LEVEL_DATA } from '../assets/scripts/core/level-data.chapter-04.generated.ts';
import { PUBLISHED_LEVEL_DATA } from '../assets/scripts/core/level-data.generated.ts';
import type { BottleState, GameState, PotionColor } from '../assets/scripts/core/types.ts';
import {
  analyzeState,
  generatedOutputMatches,
  type GenerationScoreComponents,
  type GenerationSpec,
} from './level-generator.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_PATH = resolve(ROOT, 'assets/scripts/core/level-data.chapter-05.generated.ts');
const REPORT_PATH = resolve(ROOT, 'assets/scripts/core/level-generation-report.chapter-05.json');
const CONFIG_VERSION = 'chapter-5.2026-09-06.1';

interface ReportLevel {
  readonly id: string;
  readonly source: 'generated';
  readonly targetCoefficient: number;
  readonly targetDifficulty: number;
  readonly compatibilityExemption: null;
  readonly initialSeed: number;
  readonly generationStrategy: 'deterministic-shuffle';
  readonly generatorSeed: number;
  readonly attempt: number;
  readonly reverseMoves: number;
  readonly boardKey: string;
  readonly metrics: LevelMetrics;
  readonly scoreComponents: GenerationScoreComponents;
}

const COLORS: readonly PotionColor[] = [
  'rose', 'violet', 'amber', 'cyan', 'mint', 'blue',
  'gold', 'lilac', 'scarlet', 'chartreuse', 'indigo', 'pearl',
];

const DIFFICULTY_ANCHORS = [
  [121, 1.09],
  [122, 1.17],
  [125, 1.20],
  [130, 1.22],
  [140, 1.25],
  [145, 1.26],
  [147, 1.26],
  [150, 1.19],
] as const;

function assertChapterFiveLevel(levelNumber: number): void {
  if (!Number.isInteger(levelNumber) || levelNumber < 121 || levelNumber > 150) {
    throw new RangeError('chapter five level must be an integer from 121 to 150');
  }
}

export function chapterFiveDifficultyTarget(levelNumber: number): number {
  assertChapterFiveLevel(levelNumber);
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

export function chapterFiveGenerationSpec(levelNumber: number): GenerationSpec {
  const target = chapterFiveDifficultyTarget(levelNumber);
  const minimumOptimalMoves = levelNumber <= 124
    ? 26 + Math.round((levelNumber - 121) / 3)
    : levelNumber <= 139
      ? 28 + Math.floor((levelNumber - 125) / 5)
      : levelNumber <= 144
        ? 30 + Math.floor((levelNumber - 140) / 2)
        : levelNumber <= 147
          ? [32, 34, 34][levelNumber - 145]
          : 31 - (levelNumber - 148);
  const minimumExploredStates = levelNumber >= 145 && levelNumber <= 147
    ? 15_000
    : levelNumber >= 140 ? 12_000 : levelNumber >= 125 ? 8_000 : 6_000;
  return {
    number: levelNumber,
    colorCount: 10,
    emptyBottleCount: 2,
    reverseMoves: 40,
    targetDifficulty: Math.min(1, target),
    minimumOptimalMoves,
    maximumOptimalMoves: minimumOptimalMoves + 5,
    minimumSegments: minimumOptimalMoves >= 32 ? 37 : minimumOptimalMoves >= 28 ? 36 : 35,
    minimumExploredStates,
    minimumOpeningMoves: 20,
    maximumOpeningMoves: 20,
    minimumMisleadingBranchRatio: 0.3,
    maxAttempts: 5_000,
  };
}

export function chapterFiveGeneratorSeed(levelNumber: number): number {
  assertChapterFiveLevel(levelNumber);
  return (0x260B_0000 + Math.imul(levelNumber, 104_729)) >>> 0;
}

function randomSource(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6D2B79F5) >>> 0;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function shuffle<T>(values: T[], random: () => number): void {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const selected = Math.floor(random() * (index + 1));
    [values[index], values[selected]] = [values[selected], values[index]];
  }
}

function randomState(seed: number): GameState {
  const random = randomSource(seed);
  const layers = COLORS.slice(0, 10).flatMap((color) => [color, color, color, color]);
  shuffle(layers, random);
  const bottles: BottleState[] = Array.from({ length: 10 }, (_, index) => ({
    layers: layers.slice(index * 4, index * 4 + 4),
    status: 'active',
  }));
  bottles.push(
    { layers: [], status: 'active' },
    { layers: [], status: 'active' },
    { layers: [], status: 'inactive' },
    { layers: [], status: 'inactive' },
    { layers: [], status: 'reserved' },
  );
  return { bottles, rewardBottleUsed: false, moves: 0 };
}

function hasCompleteBottle(state: GameState): boolean {
  return state.bottles.some((bottle) => (
    bottle.layers.length === 4
    && bottle.layers.every((color) => color === bottle.layers[0])
  ));
}
function boardKey(state: GameState): string {
  return JSON.stringify(state.bottles.map(({ layers, status }) => ({ layers, status })));
}

function clearsGenerationGates(metrics: LevelMetrics, spec: GenerationSpec): boolean {
  return metrics.optimalMoves >= spec.minimumOptimalMoves
    && metrics.optimalMoves <= spec.maximumOptimalMoves
    && metrics.segmentCount >= spec.minimumSegments
    && metrics.exploredStates >= spec.minimumExploredStates
    && metrics.openingMoves >= spec.minimumOpeningMoves
    && metrics.openingMoves <= spec.maximumOpeningMoves
    && metrics.misleadingBranchRatio >= spec.minimumMisleadingBranchRatio;
}

const APPROVED_START_ATTEMPTS: Readonly<Record<number, number>> = {
  121: 3, 122: 1, 123: 4, 124: 4, 125: 1, 126: 2, 127: 4, 128: 3, 129: 1,
  130: 3, 131: 2, 132: 1, 133: 1, 134: 4, 135: 1, 136: 3, 137: 1, 138: 2,
  139: 2, 140: 5, 141: 1, 142: 3, 143: 10, 144: 6, 145: 3, 146: 4,
};

function buildChapterFiveLevels(): {
  readonly levels: readonly LevelConfig[];
  readonly report: readonly ReportLevel[];
} {
  const levels: LevelConfig[] = [];
  const report: ReportLevel[] = [];
  const boardKeys = new Set(
    [
      ...PUBLISHED_LEVEL_DATA,
      ...CHAPTER_TWO_LEVEL_DATA,
      ...CHAPTER_THREE_LEVEL_DATA,
      ...CHAPTER_FOUR_LEVEL_DATA,
    ].map((level) => boardKey(level.initialState)),
  );

  for (let number = 121; number <= 150; number += 1) {
    const spec = chapterFiveGenerationSpec(number);
    const initialSeed = chapterFiveGeneratorSeed(number);
    let accepted: {
      state: GameState;
      analysis: NonNullable<ReturnType<typeof analyzeState>>;
      seed: number;
      attempt: number;
    } | null = null;

    const firstAttempt = APPROVED_START_ATTEMPTS[number] ?? 1;
    for (let attempt = firstAttempt; attempt <= spec.maxAttempts && accepted === null; attempt += 1) {
      const seed = (initialSeed + Math.imul(attempt - 1, 2_654_435_761)) >>> 0;
      const state = randomState(seed);
      const key = boardKey(state);
      if (boardKeys.has(key) || hasCompleteBottle(state)) continue;
      const analysis = analyzeState(
        state,
        spec.colorCount,
        { type: 'all-colors', targetCount: spec.colorCount },
      );
      if (analysis && clearsGenerationGates(analysis.metrics, spec)) {
        accepted = { state, analysis, seed, attempt };
      }
    }
    if (!accepted) throw new Error('level-' + number + ': no unique shuffled board cleared chapter five gates');

    const config: LevelConfig = {
      id: levelId(number),
      number,
      configVersion: CONFIG_VERSION,
      presentationSeed: number,
      capacity: 4,
      slotCount: 15,
      rewardSlotIndex: 14,
      completionRule: { type: 'all-colors', targetCount: 10 },
      metrics: accepted.analysis.metrics,
      initialState: accepted.state,
    };
    const errors = validateLevelConfig(config);
    if (errors.length > 0) throw new Error(config.id + ': ' + errors.join('; '));
    const key = boardKey(config.initialState);
    boardKeys.add(key);
    levels.push(config);
    report.push({
      id: config.id,
      source: 'generated',
      targetCoefficient: chapterFiveDifficultyTarget(number),
      targetDifficulty: spec.targetDifficulty,
      compatibilityExemption: null,
      initialSeed,
      generationStrategy: 'deterministic-shuffle',
      generatorSeed: accepted.seed,
      attempt: accepted.attempt,
      reverseMoves: 0,
      boardKey: key,
      metrics: accepted.analysis.metrics,
      scoreComponents: accepted.analysis.scoreComponents,
    });
    console.log(config.id + ': accepted deterministic shuffle at attempt ' + accepted.attempt);
  }
  return { levels, report };
}
function generatedTypeScript(levels: readonly LevelConfig[]): string {
  return [
    "import type { LevelConfig } from './level-config.ts';",
    '',
    '// Generated by tools/generate-chapter-five.ts. Do not edit by hand.',
    `export const CHAPTER_FIVE_LEVEL_DATA: readonly LevelConfig[] = ${JSON.stringify(levels, null, 2)};`,
    '',
  ].join('\n');
}

function generatedReport(report: readonly ReportLevel[]): string {
  return `${JSON.stringify({
    schemaVersion: 1,
    chapterId: 5,
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
  const generated = buildChapterFiveLevels();
  const matches = [
    checkOrWrite(DATA_PATH, generatedTypeScript(generated.levels), check),
    checkOrWrite(REPORT_PATH, generatedReport(generated.report), check),
  ].every(Boolean);

  if (!matches) {
    console.error('Chapter five output differs from deterministic generation');
    process.exitCode = 1;
  } else if (check) {
    console.log('30 chapter 5 levels match generated output');
  } else {
    console.log('Generated chapter 5 levels 121–150 and difficulty report');
  }
}

const isMain = process.argv[1] !== undefined
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
