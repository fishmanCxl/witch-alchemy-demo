import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  levelId,
  validateLevelConfig,
  type LevelConfig,
  type LevelMetrics,
} from '../assets/scripts/core/level-config.ts';
import { PUBLISHED_LEVEL_DATA } from '../assets/scripts/core/level-data.generated.ts';
import type { BottleState, GameState, PotionColor } from '../assets/scripts/core/types.ts';
import {
  analyzeState,
  generatedOutputMatches,
  type GenerationScoreComponents,
  type GenerationSpec,
} from './level-generator.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_PATH = resolve(ROOT, 'assets/scripts/core/level-data.chapter-02.generated.ts');
const REPORT_PATH = resolve(ROOT, 'assets/scripts/core/level-generation-report.chapter-02.json');
const CONFIG_VERSION = 'chapter-2.2026-08-29.1';

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

const HARD_EIGHT_STATE: GameState = {
  bottles: [
    { layers: [], status: 'inactive' },
    { layers: ['blue', 'rose', 'blue', 'violet'], status: 'active' },
    { layers: ['mint', 'cyan', 'cyan', 'gold'], status: 'active' },
    { layers: [], status: 'active' },
    { layers: ['cyan', 'gold', 'gold', 'violet'], status: 'active' },
    { layers: ['blue', 'rose', 'rose', 'cyan'], status: 'active' },
    { layers: ['mint', 'blue', 'amber', 'lilac'], status: 'active' },
    { layers: [], status: 'inactive' },
    { layers: [], status: 'active' },
    { layers: ['rose', 'gold', 'violet', 'lilac'], status: 'active' },
    { layers: ['mint', 'mint', 'lilac', 'amber'], status: 'active' },
    { layers: [], status: 'inactive' },
    { layers: ['lilac', 'amber', 'violet', 'amber'], status: 'active' },
    { layers: [], status: 'inactive' },
    { layers: [], status: 'reserved' },
  ],
  rewardBottleUsed: false,
  moves: 0,
};

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
  const colorCount = Math.round(8 + 4 * progress);
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

export function chapterTwoGeneratorSeed(levelNumber: number): number {
  assertChapterTwoLevel(levelNumber);
  return (0x2608_0000 + Math.imul(levelNumber, 104_729)) >>> 0;
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

function clearsGenerationGates(metrics: LevelMetrics, spec: GenerationSpec): boolean {
  return metrics.optimalMoves >= spec.minimumOptimalMoves
    && metrics.optimalMoves <= spec.maximumOptimalMoves
    && metrics.segmentCount >= spec.minimumSegments
    && metrics.exploredStates >= spec.minimumExploredStates
    && metrics.openingMoves >= spec.minimumOpeningMoves
    && metrics.openingMoves <= spec.maximumOpeningMoves
    && metrics.misleadingBranchRatio >= spec.minimumMisleadingBranchRatio;
}

function buildChapterTwoLevels(): {
  readonly levels: readonly LevelConfig[];
  readonly report: readonly ReportLevel[];
} {
  const levels: LevelConfig[] = [];
  const report: ReportLevel[] = [];
  const boardKeys = new Set<string>();
  const nineColorBases = [23, 24, 25, 29].map((number) => PUBLISHED_LEVEL_DATA[number - 1]);

  for (let number = 31; number <= 60; number += 1) {
    const spec = chapterTwoGenerationSpec(number);
    const initialSeed = chapterTwoGeneratorSeed(number);
    const base = number === 31
      ? PUBLISHED_LEVEL_DATA[20]
      : number <= 33
        ? { id: 'chapter-two-hard-eight', initialState: HARD_EIGHT_STATE }
        : nineColorBases[(number - 34) % nineColorBases.length];
    const initialState = provenVariant(base.initialState, initialSeed);
    const analysis = analyzeState(
      initialState,
      spec.colorCount,
      { type: 'all-colors', targetCount: spec.colorCount },
    );
    if (!analysis) throw new Error(`level-${number}: proven variant exceeded solver budget`);
    if (!clearsGenerationGates(analysis.metrics, spec)) {
      throw new Error(`level-${number}: proven variant missed chapter two generation gates`);
    }
    const config: LevelConfig = {
      id: levelId(number),
      number,
      configVersion: CONFIG_VERSION,
      presentationSeed: number,
      capacity: 4,
      slotCount: 15,
      rewardSlotIndex: 14,
      completionRule: { type: 'all-colors', targetCount: spec.colorCount },
      metrics: analysis.metrics,
      initialState,
    };
    const errors = validateLevelConfig(config);
    if (errors.length > 0) throw new Error(`${config.id}: ${errors.join('; ')}`);
    const boardKey = JSON.stringify(config.initialState.bottles.map((bottle) => ({
      layers: bottle.layers,
      status: bottle.status,
    })));
    if (boardKeys.has(boardKey)) throw new Error(`${config.id}: duplicate chapter two board`);
    boardKeys.add(boardKey);
    levels.push(config);
    report.push({
      id: config.id,
      source: 'generated',
      targetCoefficient: chapterTwoDifficultyTarget(number),
      targetDifficulty: spec.targetDifficulty,
      compatibilityExemption: null,
      initialSeed,
      generationStrategy: 'proven-variant',
      baseLevelId: base.id,
      generatorSeed: initialSeed,
      attempt: 1,
      reverseMoves: 0,
      metrics: analysis.metrics,
      scoreComponents: analysis.scoreComponents,
    });
    console.log(`${config.id}: accepted ${base.id} proven variant`);
  }
  return { levels, report };
}

function generatedTypeScript(levels: readonly LevelConfig[]): string {
  return [
    "import type { LevelConfig } from './level-config.ts';",
    '',
    '// Generated by tools/generate-chapter-two.ts. Do not edit by hand.',
    `export const CHAPTER_TWO_LEVEL_DATA: readonly LevelConfig[] = ${JSON.stringify(levels, null, 2)};`,
    '',
  ].join('\n');
}

function generatedReport(report: readonly ReportLevel[]): string {
  return `${JSON.stringify({
    schemaVersion: 1,
    chapterId: 2,
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
  const generated = buildChapterTwoLevels();
  const matches = [
    checkOrWrite(DATA_PATH, generatedTypeScript(generated.levels), check),
    checkOrWrite(REPORT_PATH, generatedReport(generated.report), check),
  ].every(Boolean);

  if (!matches) {
    console.error('Chapter two output differs from deterministic generation');
    process.exitCode = 1;
  } else if (check) {
    console.log('30 chapter 2 levels match generated output');
  } else {
    console.log('Generated chapter 2 levels 31–60 and difficulty report');
  }
}

const isMain = process.argv[1] !== undefined
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
