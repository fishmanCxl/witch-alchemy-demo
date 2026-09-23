import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  countColorSegments,
  levelId,
  validateLevelConfig,
  type LevelConfig,
  type LevelMetrics,
} from '../assets/scripts/core/level-config.ts';
import { CHAPTER_TWO_LEVEL_DATA } from '../assets/scripts/core/level-data.chapter-02.generated.ts';
import { CHAPTER_THREE_LEVEL_DATA } from '../assets/scripts/core/level-data.chapter-03.generated.ts';
import { CHAPTER_FOUR_LEVEL_DATA } from '../assets/scripts/core/level-data.chapter-04.generated.ts';
import { CHAPTER_FIVE_LEVEL_DATA } from '../assets/scripts/core/level-data.chapter-05.generated.ts';
import { PUBLISHED_LEVEL_DATA } from '../assets/scripts/core/level-data.generated.ts';
import type { BottleState, GameState, PotionColor } from '../assets/scripts/core/types.ts';
import { canPour } from '../assets/scripts/core/water-sort.ts';
import {
  analyzeState,
  generatedOutputMatches,
  type GenerationScoreComponents,
  type GenerationSpec,
} from './level-generator.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_PATH = resolve(ROOT, 'assets/scripts/core/level-data.chapter-06.generated.ts');
const REPORT_PATH = resolve(ROOT, 'assets/scripts/core/level-generation-report.chapter-06.json');
const CONFIG_VERSION = 'chapter-6.2026-09-19.1';
const MAX_EXPLORED_STATES = 150_000;

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
  [151, 1.16],
  [152, 1.24],
  [155, 1.27],
  [160, 1.29],
  [170, 1.32],
  [175, 1.33],
  [177, 1.33],
  [180, 1.26],
] as const;

function assertChapterSixLevel(levelNumber: number): void {
  if (!Number.isInteger(levelNumber) || levelNumber < 151 || levelNumber > 180) {
    throw new RangeError('chapter six level must be an integer from 151 to 180');
  }
}

export function chapterSixDifficultyTarget(levelNumber: number): number {
  assertChapterSixLevel(levelNumber);
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

function hardGates(levelNumber: number): {
  readonly minimumOptimalMoves: number;
  readonly minimumSegments: number;
  readonly minimumExploredStates: number;
} {
  if (levelNumber === 151) return { minimumOptimalMoves: 31, minimumSegments: 38, minimumExploredStates: 15_000 };
  if (levelNumber === 152) return { minimumOptimalMoves: 32, minimumSegments: 39, minimumExploredStates: 18_000 };
  if (levelNumber <= 154) return { minimumOptimalMoves: 33, minimumSegments: 39, minimumExploredStates: 20_000 };
  if (levelNumber <= 159) return { minimumOptimalMoves: 34, minimumSegments: 40, minimumExploredStates: 24_000 };
  if (levelNumber <= 164) return { minimumOptimalMoves: 35, minimumSegments: 40, minimumExploredStates: 30_000 };
  if (levelNumber <= 169) return { minimumOptimalMoves: 36, minimumSegments: 41, minimumExploredStates: 40_000 };
  if (levelNumber <= 174) return { minimumOptimalMoves: 37, minimumSegments: 41, minimumExploredStates: 50_000 };
  if (levelNumber <= 177) return { minimumOptimalMoves: 38, minimumSegments: 42, minimumExploredStates: 65_000 };
  if (levelNumber === 178) return { minimumOptimalMoves: 37, minimumSegments: 41, minimumExploredStates: 34_000 };
  if (levelNumber === 179) return { minimumOptimalMoves: 35, minimumSegments: 41, minimumExploredStates: 29_000 };
  return { minimumOptimalMoves: 34, minimumSegments: 40, minimumExploredStates: 24_000 };
}

export function chapterSixGenerationSpec(levelNumber: number): GenerationSpec {
  assertChapterSixLevel(levelNumber);
  const target = chapterSixDifficultyTarget(levelNumber);
  const gates = hardGates(levelNumber);
  return {
    number: levelNumber,
    colorCount: 11,
    emptyBottleCount: 2,
    reverseMoves: 44,
    targetDifficulty: Math.min(1, target),
    minimumOptimalMoves: gates.minimumOptimalMoves,
    maximumOptimalMoves: gates.minimumOptimalMoves + 5,
    minimumSegments: gates.minimumSegments,
    minimumExploredStates: gates.minimumExploredStates,
    minimumOpeningMoves: 22,
    maximumOpeningMoves: 22,
    minimumMisleadingBranchRatio: levelNumber <= 154 || levelNumber >= 178 ? 4 / 11 : 5 / 11,
    maxAttempts: 10_000,
  };
}

export function chapterSixGeneratorSeed(levelNumber: number): number {
  assertChapterSixLevel(levelNumber);
  return (0x260C_0000 + Math.imul(levelNumber, 104_729)) >>> 0;
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
  const layers = COLORS.slice(0, 11).flatMap((color) => [color, color, color, color]);
  shuffle(layers, random);
  const bottles: BottleState[] = Array.from({ length: 11 }, (_, index) => ({
    layers: layers.slice(index * 4, index * 4 + 4),
    status: 'active',
  }));
  bottles.push(
    { layers: [], status: 'active' },
    { layers: [], status: 'active' },
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

function seedForAttempt(initialSeed: number, attempt: number): number {
  return (initialSeed + Math.imul(attempt - 1, 2_654_435_761)) >>> 0;
}

function countLegalOpeningMoves(state: GameState): number {
  let moves = 0;
  for (let from = 0; from < state.bottles.length; from += 1) {
    for (let to = 0; to < state.bottles.length; to += 1) {
      if (canPour(state, from, to)) moves += 1;
    }
  }
  return moves;
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
  151: 1, 152: 1, 153: 2, 154: 2, 155: 1,
  156: 15, 157: 9, 158: 5, 159: 14, 160: 3,
  161: 17, 162: 1, 163: 58, 164: 49, 165: 38,
  166: 118, 167: 182, 168: 185, 169: 156, 170: 163,
  171: 468, 172: 207, 173: 710, 174: 124, 175: 1_799,
  176: 7_060, 177: 2_221, 178: 9_003, 179: 4_002, 180: 2,
};

function priorBoardKeys(): Set<string> {
  return new Set(
    [
      ...PUBLISHED_LEVEL_DATA,
      ...CHAPTER_TWO_LEVEL_DATA,
      ...CHAPTER_THREE_LEVEL_DATA,
      ...CHAPTER_FOUR_LEVEL_DATA,
      ...CHAPTER_FIVE_LEVEL_DATA,
    ].map((level) => boardKey(level.initialState)),
  );
}

function buildChapterSixLevels(searchFromBeginning = false): {
  readonly levels: readonly LevelConfig[];
  readonly report: readonly ReportLevel[];
} {
  const levels: LevelConfig[] = [];
  const report: ReportLevel[] = [];
  const boardKeys = priorBoardKeys();

  for (let number = 151; number <= 180; number += 1) {
    const spec = chapterSixGenerationSpec(number);
    const initialSeed = chapterSixGeneratorSeed(number);
    let accepted: {
      state: GameState;
      analysis: NonNullable<ReturnType<typeof analyzeState>>;
      seed: number;
      attempt: number;
    } | null = null;

    const firstAttempt = searchFromBeginning ? 1 : (APPROVED_START_ATTEMPTS[number] ?? 1);
    for (let attempt = firstAttempt; attempt <= spec.maxAttempts && accepted === null; attempt += 1) {
      const seed = seedForAttempt(initialSeed, attempt);
      const state = randomState(seed);
      const key = boardKey(state);
      if (boardKeys.has(key) || hasCompleteBottle(state)) continue;
      if (countColorSegments(state) < spec.minimumSegments) continue;
      const openingMoves = countLegalOpeningMoves(state);
      if (openingMoves < spec.minimumOpeningMoves || openingMoves > spec.maximumOpeningMoves) continue;
      const analysis = analyzeState(
        state,
        spec.colorCount,
        { type: 'all-colors', targetCount: spec.colorCount },
        MAX_EXPLORED_STATES,
      );
      if (analysis && clearsGenerationGates(analysis.metrics, spec)) {
        accepted = { state, analysis, seed, attempt };
      }
    }
    if (!accepted) throw new Error('level-' + number + ': no unique shuffled board cleared chapter six gates');

    const config: LevelConfig = {
      id: levelId(number),
      number,
      configVersion: CONFIG_VERSION,
      presentationSeed: number,
      capacity: 4,
      slotCount: 15,
      rewardSlotIndex: 14,
      completionRule: { type: 'all-colors', targetCount: 11 },
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
      targetCoefficient: chapterSixDifficultyTarget(number),
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

function buildLockedChapterSixArtifacts(): {
  readonly levels: readonly LevelConfig[];
  readonly report: readonly ReportLevel[];
} {
  if (!existsSync(REPORT_PATH)) throw new Error('Chapter six generation report is missing');
  const stored = JSON.parse(readFileSync(REPORT_PATH, 'utf8')) as {
    readonly schemaVersion?: number;
    readonly chapterId?: number;
    readonly configVersion?: string;
    readonly levels?: readonly ReportLevel[];
  };
  if (
    stored.schemaVersion !== 1
    || stored.chapterId !== 6
    || stored.configVersion !== CONFIG_VERSION
    || !Array.isArray(stored.levels)
    || stored.levels.length !== 30
  ) {
    throw new Error('Chapter six generation report header is invalid');
  }

  const levels: LevelConfig[] = [];
  const report: ReportLevel[] = [];
  const boardKeys = priorBoardKeys();

  for (let number = 151; number <= 180; number += 1) {
    const entry = stored.levels[number - 151];
    const spec = chapterSixGenerationSpec(number);
    const initialSeed = chapterSixGeneratorSeed(number);
    const attempt = APPROVED_START_ATTEMPTS[number];
    if (!entry || attempt === undefined) throw new Error('Missing chapter six lock for level-' + number);
    const seed = seedForAttempt(initialSeed, attempt);
    const state = randomState(seed);
    const key = boardKey(state);
    const openingMoves = countLegalOpeningMoves(state);
    const segmentCount = countColorSegments(state);

    if (
      entry.id !== levelId(number)
      || entry.source !== 'generated'
      || entry.targetCoefficient !== chapterSixDifficultyTarget(number)
      || entry.targetDifficulty !== spec.targetDifficulty
      || entry.compatibilityExemption !== null
      || entry.initialSeed !== initialSeed
      || entry.generationStrategy !== 'deterministic-shuffle'
      || entry.generatorSeed !== seed
      || entry.attempt !== attempt
      || entry.reverseMoves !== 0
      || entry.boardKey !== key
      || entry.metrics.colorCount !== 11
      || entry.metrics.segmentCount !== segmentCount
      || entry.metrics.openingMoves !== openingMoves
      || !clearsGenerationGates(entry.metrics, spec)
      || !entry.scoreComponents
      || boardKeys.has(key)
      || hasCompleteBottle(state)
    ) {
      throw new Error('level-' + number + ': locked chapter six artifact is invalid');
    }

    const config: LevelConfig = {
      id: levelId(number),
      number,
      configVersion: CONFIG_VERSION,
      presentationSeed: number,
      capacity: 4,
      slotCount: 15,
      rewardSlotIndex: 14,
      completionRule: { type: 'all-colors', targetCount: 11 },
      metrics: entry.metrics,
      initialState: state,
    };
    const errors = validateLevelConfig(config);
    if (errors.length > 0) throw new Error(config.id + ': ' + errors.join('; '));

    boardKeys.add(key);
    levels.push(config);
    report.push({
      id: config.id,
      source: 'generated',
      targetCoefficient: chapterSixDifficultyTarget(number),
      targetDifficulty: spec.targetDifficulty,
      compatibilityExemption: null,
      initialSeed,
      generationStrategy: 'deterministic-shuffle',
      generatorSeed: seed,
      attempt,
      reverseMoves: 0,
      boardKey: key,
      metrics: entry.metrics,
      scoreComponents: entry.scoreComponents,
    });
  }

  return { levels, report };
}

function generatedTypeScript(levels: readonly LevelConfig[]): string {
  return [
    "import type { LevelConfig } from './level-config.ts';",
    '',
    '// Generated by tools/generate-chapter-six.ts. Do not edit by hand.',
    `export const CHAPTER_SIX_LEVEL_DATA: readonly LevelConfig[] = ${JSON.stringify(levels, null, 2)};`,
    '',
  ].join('\n');
}

function generatedReport(report: readonly ReportLevel[]): string {
  return `${JSON.stringify({
    schemaVersion: 1,
    chapterId: 6,
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
  const verifySolver = process.argv.includes('--verify-solver');
  const search = process.argv.includes('--search');
  if ([check, verifySolver, search].filter(Boolean).length > 1) {
    throw new Error('Use only one of --check, --verify-solver, or --search');
  }

  const generated = check
    ? buildLockedChapterSixArtifacts()
    : buildChapterSixLevels(search);
  const compareOnly = check || verifySolver;
  const matches = [
    checkOrWrite(DATA_PATH, generatedTypeScript(generated.levels), compareOnly),
    checkOrWrite(REPORT_PATH, generatedReport(generated.report), compareOnly),
  ].every(Boolean);

  if (!matches) {
    console.error('Chapter six output differs from deterministic generation');
    process.exitCode = 1;
  } else if (check) {
    console.log('30 chapter 6 levels match generated output');
  } else if (verifySolver) {
    console.log('30 chapter 6 levels passed exact solver verification');
  } else if (search) {
    console.log('Searched and generated chapter 6 levels 151–180 and difficulty report');
  } else {
    console.log('Generated chapter 6 levels 151–180 and difficulty report');
  }
}

const isMain = process.argv[1] !== undefined
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
