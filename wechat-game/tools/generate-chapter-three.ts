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
import { PUBLISHED_LEVEL_DATA } from '../assets/scripts/core/level-data.generated.ts';
import type { BottleState, GameState, PotionColor } from '../assets/scripts/core/types.ts';
import {
  analyzeState,
  generatedOutputMatches,
  type GenerationScoreComponents,
  type GenerationSpec,
} from './level-generator.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_PATH = resolve(ROOT, 'assets/scripts/core/level-data.chapter-03.generated.ts');
const REPORT_PATH = resolve(ROOT, 'assets/scripts/core/level-generation-report.chapter-03.json');
const CONFIG_VERSION = 'chapter-3.2026-09-05.1';

interface ReportLevel {
  readonly id: string;
  readonly source: 'generated';
  readonly targetCoefficient: number;
  readonly targetDifficulty: number;
  readonly compatibilityExemption: null;
  readonly initialSeed: number;
  readonly generationStrategy: 'proven-variant';
  readonly baseLevelId: string;
  readonly generatorSeed: number;
  readonly attempt: number;
  readonly reverseMoves: number;
  readonly metrics: LevelMetrics;
  readonly scoreComponents: GenerationScoreComponents;
}

const COLORS: readonly PotionColor[] = [
  'rose', 'violet', 'amber', 'cyan', 'mint', 'blue',
  'gold', 'lilac', 'scarlet', 'chartreuse', 'indigo', 'pearl',
];

const DIFFICULTY_ANCHORS = [
  [61, 0.95],
  [62, 1.03],
  [65, 1.06],
  [70, 1.08],
  [80, 1.11],
  [85, 1.12],
  [87, 1.12],
  [90, 1.05],
] as const;

function assertChapterThreeLevel(levelNumber: number): void {
  if (!Number.isInteger(levelNumber) || levelNumber < 61 || levelNumber > 90) {
    throw new RangeError('chapter three level must be an integer from 61 to 90');
  }
}

export function chapterThreeDifficultyTarget(levelNumber: number): number {
  assertChapterThreeLevel(levelNumber);
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

export function chapterThreeGenerationSpec(levelNumber: number): GenerationSpec {
  const target = chapterThreeDifficultyTarget(levelNumber);
  const progress = Math.max(0, Math.min(1, (target - 0.88) / (1.61 - 0.88)));
  const colorCount = Math.round(8 + 4 * progress);
  const minimumOptimalMoves = Math.round(22 + 10 * progress);
  return {
    number: levelNumber,
    colorCount,
    emptyBottleCount: 2,
    reverseMoves: Math.round(24 + 10 * progress),
    targetDifficulty: Math.min(1, target),
    minimumOptimalMoves,
    maximumOptimalMoves: minimumOptimalMoves + 14,
    minimumSegments: Math.round(26 + 10 * progress),
    minimumExploredStates: Math.round(2_000 * 10 ** (1.2 * progress)),
    minimumOpeningMoves: 2,
    maximumOpeningMoves: Math.max(colorCount * 2, Math.round(18 - 6 * progress)),
    minimumMisleadingBranchRatio: 0.25 + 0.20 * progress,
    maxAttempts: 25_000,
  };
}

export function chapterThreeGeneratorSeed(levelNumber: number): number {
  assertChapterThreeLevel(levelNumber);
  return (0x2609_0000 + Math.imul(levelNumber, 104_729)) >>> 0;
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

function provenVariant(state: GameState, seed: number): GameState {
  const random = randomSource(seed);
  const usedColors = COLORS.filter((color) => state.bottles.some((bottle) => (
    bottle.layers.includes(color)
  )));
  const replacements = [...usedColors];
  shuffle(replacements, random);
  const colorMap = new Map(usedColors.map((color, index) => [color, replacements[index]]));
  const ordinary = state.bottles.slice(0, 14).map((bottle): BottleState => ({
    ...bottle,
    layers: bottle.layers.map((color) => colorMap.get(color) ?? color),
  }));
  shuffle(ordinary, random);
  return {
    bottles: [...ordinary, { layers: [], status: 'reserved' }],
    rewardBottleUsed: false,
    moves: 0,
  };
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

function buildChapterThreeLevels(): {
  readonly levels: readonly LevelConfig[];
  readonly report: readonly ReportLevel[];
} {
  const levels: LevelConfig[] = [];
  const report: ReportLevel[] = [];
  const boardKeys = new Set(
    [...PUBLISHED_LEVEL_DATA, ...CHAPTER_TWO_LEVEL_DATA].map((level) => boardKey(level.initialState)),
  );

  for (let number = 61; number <= 90; number += 1) {
    const spec = chapterThreeGenerationSpec(number);
    const initialSeed = chapterThreeGeneratorSeed(number);
    const bases = CHAPTER_TWO_LEVEL_DATA.filter((level) => level.metrics.colorCount === spec.colorCount);
    let accepted: { base: LevelConfig; state: GameState; analysis: NonNullable<ReturnType<typeof analyzeState>>; seed: number; attempt: number } | null = null;

    for (let attempt = 1; attempt <= 256 && accepted === null; attempt += 1) {
      const base = bases[(number + attempt) % bases.length];
      const seed = (initialSeed + Math.imul(attempt - 1, 2_654_435_761)) >>> 0;
      const state = provenVariant(base.initialState, seed);
      if (boardKeys.has(boardKey(state))) continue;
      const analysis = analyzeState(
        state,
        spec.colorCount,
        { type: 'all-colors', targetCount: spec.colorCount },
      );
      if (analysis && clearsGenerationGates(analysis.metrics, spec)) {
        accepted = { base, state, analysis, seed, attempt };
      }
    }
    if (!accepted) throw new Error(`level-${number}: no unique proven variant cleared chapter three gates`);

    const config: LevelConfig = {
      id: levelId(number),
      number,
      configVersion: CONFIG_VERSION,
      presentationSeed: number,
      capacity: 4,
      slotCount: 15,
      rewardSlotIndex: 14,
      completionRule: { type: 'all-colors', targetCount: spec.colorCount },
      metrics: accepted.analysis.metrics,
      initialState: accepted.state,
    };
    const errors = validateLevelConfig(config);
    if (errors.length > 0) throw new Error(`${config.id}: ${errors.join('; ')}`);
    boardKeys.add(boardKey(config.initialState));
    levels.push(config);
    report.push({
      id: config.id,
      source: 'generated',
      targetCoefficient: chapterThreeDifficultyTarget(number),
      targetDifficulty: spec.targetDifficulty,
      compatibilityExemption: null,
      initialSeed,
      generationStrategy: 'proven-variant',
      baseLevelId: accepted.base.id,
      generatorSeed: accepted.seed,
      attempt: accepted.attempt,
      reverseMoves: 0,
      metrics: accepted.analysis.metrics,
      scoreComponents: accepted.analysis.scoreComponents,
    });
    console.log(`${config.id}: accepted ${accepted.base.id} proven variant`);
  }
  return { levels, report };
}

function generatedTypeScript(levels: readonly LevelConfig[]): string {
  return [
    "import type { LevelConfig } from './level-config.ts';",
    '',
    '// Generated by tools/generate-chapter-three.ts. Do not edit by hand.',
    `export const CHAPTER_THREE_LEVEL_DATA: readonly LevelConfig[] = ${JSON.stringify(levels, null, 2)};`,
    '',
  ].join('\n');
}

function generatedReport(report: readonly ReportLevel[]): string {
  return `${JSON.stringify({
    schemaVersion: 1,
    chapterId: 3,
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
  const generated = buildChapterThreeLevels();
  const matches = [
    checkOrWrite(DATA_PATH, generatedTypeScript(generated.levels), check),
    checkOrWrite(REPORT_PATH, generatedReport(generated.report), check),
  ].every(Boolean);

  if (!matches) {
    console.error('Chapter three output differs from deterministic generation');
    process.exitCode = 1;
  } else if (check) {
    console.log('30 chapter 3 levels match generated output');
  } else {
    console.log('Generated chapter 3 levels 61–90 and difficulty report');
  }
}

const isMain = process.argv[1] !== undefined
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
