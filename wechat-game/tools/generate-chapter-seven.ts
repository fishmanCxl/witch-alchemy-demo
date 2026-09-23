import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
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
import { CHAPTER_SIX_LEVEL_DATA } from '../assets/scripts/core/level-data.chapter-06.generated.ts';
import { PUBLISHED_LEVEL_DATA } from '../assets/scripts/core/level-data.generated.ts';
import type { BottleState, GameState, PotionColor } from '../assets/scripts/core/types.ts';
import { canPour, isCompleteBottle } from '../assets/scripts/core/water-sort.ts';
import {
  completeStateAnalysis,
  generatedOutputMatches,
  solveStateCandidate,
  type FullStateAnalysis,
  type GenerationScoreComponents,
  type GenerationSpec,
} from './level-generator.ts';

export type ChapterSevenDifficultyProfile = 'baseline' | 'deep' | 'deceptive' | 'tangled';

export interface ChapterSevenGenerationSpec extends GenerationSpec {
  readonly targetCoefficient: number;
  readonly difficultyProfile: ChapterSevenDifficultyProfile;
}

export type ChapterSevenMode = 'probe' | 'search' | 'check' | 'verify-solver';

export interface SearchCounters {
  attempts: number;
  uniqueShapes: number;
  segmentPasses: number;
  openingPasses: number;
  solved: number;
  baseGatePasses: number;
  branchGatePasses: number;
  elapsedMs: number;
}

interface ReportLevel {
  readonly id: string;
  readonly source: 'generated';
  readonly targetCoefficient: number;
  readonly targetDifficulty: number;
  readonly difficultyProfile: ChapterSevenDifficultyProfile;
  readonly compatibilityExemption: null;
  readonly initialSeed: number;
  readonly generationStrategy: 'deterministic-shuffle';
  readonly generatorSeed: number;
  readonly attempt: number;
  readonly reverseMoves: 0;
  readonly boardKey: string;
  readonly metrics: LevelMetrics;
  readonly scoreComponents: GenerationScoreComponents;
}

interface ChapterSevenReport {
  readonly schemaVersion: 1;
  readonly chapterId: 7;
  readonly configVersion: string;
  readonly levels: readonly ReportLevel[];
}

interface AcceptedLevel {
  readonly config: LevelConfig;
  readonly report: ReportLevel;
  readonly counters: SearchCounters;
}

export interface ChapterSevenSearchResult {
  readonly accepted: AcceptedLevel | null;
  readonly counters: SearchCounters;
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_PATH = resolve(ROOT, 'assets/scripts/core/level-data.chapter-07.generated.ts');
const REPORT_PATH = resolve(ROOT, 'assets/scripts/core/level-generation-report.chapter-07.json');
const CHECKPOINT_ROOT = resolve(ROOT, 'tmp');
const CONFIG_VERSION = 'chapter-7.2026-09-21.1';
const MAX_EXPLORED_STATES = 150_000;
const MAX_LEVEL_MS = 10 * 60 * 1_000;
const PROBE_ATTEMPTS = 200;
const PROBE_LEVELS = [181, 182, 190, 200, 205, 206, 207, 210] as const;

const COLORS: readonly PotionColor[] = [
  'rose', 'violet', 'amber', 'cyan', 'mint', 'blue',
  'gold', 'lilac', 'scarlet', 'chartreuse', 'indigo', 'pearl',
];

const DIFFICULTY_ANCHORS = [
  [181, 1.23],
  [182, 1.31],
  [185, 1.34],
  [190, 1.36],
  [200, 1.39],
  [205, 1.4],
  [207, 1.4],
  [210, 1.33],
] as const;

function assertChapterSevenLevel(levelNumber: number): void {
  if (!Number.isInteger(levelNumber) || levelNumber < 181 || levelNumber > 210) {
    throw new RangeError('chapter seven level must be an integer from 181 to 210');
  }
}

export function chapterSevenDifficultyTarget(levelNumber: number): number {
  assertChapterSevenLevel(levelNumber);
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

export function chapterSevenDifficultyProfile(
  levelNumber: number,
): ChapterSevenDifficultyProfile {
  assertChapterSevenLevel(levelNumber);
  if (levelNumber === 181 || levelNumber >= 208) return 'baseline';
  if (levelNumber >= 205) {
    return (['deep', 'deceptive', 'tangled'] as const)[levelNumber - 205];
  }
  return (['deep', 'deceptive', 'tangled'] as const)[(levelNumber - 182) % 3];
}

export function chapterSevenGenerationSpec(
  levelNumber: number,
): ChapterSevenGenerationSpec {
  const targetCoefficient = chapterSevenDifficultyTarget(levelNumber);
  const difficultyProfile = chapterSevenDifficultyProfile(levelNumber);
  const progress = Math.max(0, Math.min(1, (targetCoefficient - 1.23) / 0.17));
  let minimumOptimalMoves = Math.round(34 + 3 * progress);
  let minimumSegments = Math.round(40 + progress);
  let minimumExploredStates = Math.round(25_000 + 15_000 * progress);
  let minimumMisleadingBranchRatio = 4 / 11;

  if (difficultyProfile === 'deep') minimumOptimalMoves += 2;
  if (
    difficultyProfile === 'deep'
    && levelNumber < 205
    && minimumOptimalMoves === 39
  ) {
    minimumOptimalMoves = 38;
  }
  if (difficultyProfile === 'deceptive') minimumMisleadingBranchRatio = 6 / 11;
  if (difficultyProfile === 'tangled') {
    minimumSegments += 2;
    minimumExploredStates += 30_000;
    if (levelNumber < 205) minimumMisleadingBranchRatio = 3 / 11;
  }

  return {
    number: levelNumber,
    colorCount: 11,
    emptyBottleCount: 2,
    reverseMoves: 44,
    targetCoefficient,
    targetDifficulty: Math.min(1, targetCoefficient),
    difficultyProfile,
    minimumOptimalMoves,
    maximumOptimalMoves: minimumOptimalMoves + 5,
    minimumSegments,
    minimumExploredStates,
    minimumOpeningMoves: 22,
    maximumOpeningMoves: 28,
    minimumMisleadingBranchRatio,
    maxAttempts: 1_000,
  };
}

export function chapterSevenGeneratorSeed(levelNumber: number): number {
  assertChapterSevenLevel(levelNumber);
  return (0x260D_0000 + Math.imul(levelNumber, 104_729)) >>> 0;
}

export function chapterSevenMode(args: readonly string[]): ChapterSevenMode {
  const modes = [
    ['--probe', 'probe'],
    ['--search', 'search'],
    ['--check', 'check'],
    ['--verify-solver', 'verify-solver'],
  ] as const;
  const selected = modes.filter(([flag]) => args.includes(flag));
  if (selected.length > 1) {
    throw new Error('Use only one of --probe, --search, --check, or --verify-solver');
  }
  if (selected.length === 0) {
    throw new Error('Usage: --probe | --search | --check | --verify-solver');
  }
  return selected[0][1];
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
  const layers = COLORS.slice(0, 11).flatMap((color) => [color, color, color, color]);
  shuffle(layers, randomSource(seed));
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

function priorBoardKeys(): Set<string> {
  return new Set(
    [
      ...PUBLISHED_LEVEL_DATA,
      ...CHAPTER_TWO_LEVEL_DATA,
      ...CHAPTER_THREE_LEVEL_DATA,
      ...CHAPTER_FOUR_LEVEL_DATA,
      ...CHAPTER_FIVE_LEVEL_DATA,
      ...CHAPTER_SIX_LEVEL_DATA,
    ].map((level) => boardKey(level.initialState)),
  );
}

function baseGatesPass(analysis: NonNullable<ReturnType<typeof solveStateCandidate>>, spec: GenerationSpec): boolean {
  return analysis.metrics.optimalMoves >= spec.minimumOptimalMoves
    && analysis.metrics.optimalMoves <= spec.maximumOptimalMoves
    && analysis.metrics.segmentCount >= spec.minimumSegments
    && analysis.metrics.exploredStates >= spec.minimumExploredStates
    && analysis.metrics.openingMoves >= spec.minimumOpeningMoves
    && analysis.metrics.openingMoves <= spec.maximumOpeningMoves;
}

function emptyCounters(): SearchCounters {
  return {
    attempts: 0,
    uniqueShapes: 0,
    segmentPasses: 0,
    openingPasses: 0,
    solved: 0,
    baseGatePasses: 0,
    branchGatePasses: 0,
    elapsedMs: 0,
  };
}

function searchLevel(
  levelNumber: number,
  boardKeys: Set<string>,
  maxAttempts: number,
): ChapterSevenSearchResult {
  const spec = chapterSevenGenerationSpec(levelNumber);
  const initialSeed = chapterSevenGeneratorSeed(levelNumber);
  const completionRule = { type: 'all-colors', targetCount: 11 } as const;
  const counters = emptyCounters();
  const startedAt = performance.now();

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    counters.elapsedMs = Math.round(performance.now() - startedAt);
    if (counters.elapsedMs >= MAX_LEVEL_MS) {
      throw new Error(`level-${levelNumber}: exceeded 10-minute budget ${JSON.stringify(counters)}`);
    }
    counters.attempts = attempt;
    const generatorSeed = seedForAttempt(initialSeed, attempt);
    const state = randomState(generatorSeed);
    const key = boardKey(state);
    if (boardKeys.has(key) || state.bottles.some(isCompleteBottle)) continue;
    counters.uniqueShapes += 1;

    if (countColorSegments(state) < spec.minimumSegments) continue;
    counters.segmentPasses += 1;
    const openingMoves = countLegalOpeningMoves(state);
    if (openingMoves < spec.minimumOpeningMoves || openingMoves > spec.maximumOpeningMoves) continue;
    counters.openingPasses += 1;

    const base = solveStateCandidate(state, completionRule, MAX_EXPLORED_STATES);
    if (!base) continue;
    counters.solved += 1;
    if (!baseGatesPass(base, spec)) continue;
    counters.baseGatePasses += 1;

    const analysis = completeStateAnalysis(
      state,
      11,
      completionRule,
      base,
      MAX_EXPLORED_STATES,
      spec.minimumMisleadingBranchRatio,
    );
    if (!analysis) continue;
    counters.branchGatePasses += 1;
    counters.elapsedMs = Math.round(performance.now() - startedAt);

    const config: LevelConfig = {
      id: levelId(levelNumber),
      number: levelNumber,
      configVersion: CONFIG_VERSION,
      presentationSeed: levelNumber,
      capacity: 4,
      slotCount: 15,
      rewardSlotIndex: 14,
      completionRule,
      metrics: analysis.metrics,
      initialState: state,
    };
    const errors = validateLevelConfig(config);
    if (errors.length > 0) throw new Error(`${config.id}: ${errors.join('; ')}`);

    return {
      accepted: {
        config,
        report: {
          id: config.id,
          source: 'generated',
          targetCoefficient: spec.targetCoefficient,
          targetDifficulty: spec.targetDifficulty,
          difficultyProfile: spec.difficultyProfile,
          compatibilityExemption: null,
          initialSeed,
          generationStrategy: 'deterministic-shuffle',
          generatorSeed,
          attempt,
          reverseMoves: 0,
          boardKey: key,
          metrics: analysis.metrics,
          scoreComponents: analysis.scoreComponents,
        },
        counters,
      },
      counters,
    };
  }

  counters.elapsedMs = Math.round(performance.now() - startedAt);
  return { accepted: null, counters };
}

export function searchChapterSevenLevel(
  levelNumber: number,
  maxAttempts: number,
): ChapterSevenSearchResult {
  if (!Number.isInteger(maxAttempts) || maxAttempts < 0 || maxAttempts > 1_000) {
    throw new RangeError('maxAttempts must be an integer from 0 to 1000');
  }
  return searchLevel(levelNumber, priorBoardKeys(), maxAttempts);
}

function summarize(levelNumber: number, counters: SearchCounters, acceptedAttempt?: number): string {
  return [
    `level-${levelNumber}`,
    acceptedAttempt === undefined ? 'no-hit' : `accepted=${acceptedAttempt}`,
    ...Object.entries(counters).map(([key, value]) => `${key}=${value}`),
  ].join(' ');
}

function runProbe(): void {
  const boardKeys = priorBoardKeys();
  for (const levelNumber of PROBE_LEVELS) {
    const result = searchLevel(levelNumber, boardKeys, PROBE_ATTEMPTS);
    const accepted = result.accepted;
    if (accepted) boardKeys.add(accepted.report.boardKey);
    console.log(summarize(levelNumber, result.counters, accepted?.report.attempt));
  }
}

function checkpointPath(levelNumber: number): string {
  return resolve(CHECKPOINT_ROOT, `level-generation-report.chapter-07.checkpoint-${levelNumber}.json`);
}

function writeCheckpoint(accepted: AcceptedLevel): void {
  mkdirSync(CHECKPOINT_ROOT, { recursive: true });
  writeFileSync(
    checkpointPath(accepted.config.number),
    `${JSON.stringify({
      schemaVersion: 1,
      chapterId: 7,
      configVersion: CONFIG_VERSION,
      level: accepted.report,
      counters: accepted.counters,
    }, null, 2)}\n`,
    'utf8',
  );
}

function generatedTypeScript(levels: readonly LevelConfig[]): string {
  return [
    "import type { LevelConfig } from './level-config.ts';",
    '',
    '// Generated by tools/generate-chapter-seven.ts. Do not edit by hand.',
    `export const CHAPTER_SEVEN_LEVEL_DATA: readonly LevelConfig[] = ${JSON.stringify(levels, null, 2)};`,
    '',
  ].join('\n');
}

function generatedReport(levels: readonly ReportLevel[]): string {
  return `${JSON.stringify({
    schemaVersion: 1,
    chapterId: 7,
    configVersion: CONFIG_VERSION,
    levels,
  }, null, 2)}\n`;
}

function runSearch(): void {
  const boardKeys = priorBoardKeys();
  const levels: LevelConfig[] = [];
  const report: ReportLevel[] = [];
  for (let levelNumber = 181; levelNumber <= 210; levelNumber += 1) {
    const result = searchLevel(levelNumber, boardKeys, 1_000);
    const accepted = result.accepted;
    if (!accepted) {
      throw new Error(
        `level-${levelNumber}: exhausted 1000 attempts without a hit ${JSON.stringify(result.counters)}`,
      );
    }
    levels.push(accepted.config);
    report.push(accepted.report);
    boardKeys.add(accepted.report.boardKey);
    writeCheckpoint(accepted);
    console.log(summarize(levelNumber, accepted.counters, accepted.report.attempt));
  }

  writeFileSync(DATA_PATH, generatedTypeScript(levels), 'utf8');
  writeFileSync(REPORT_PATH, generatedReport(report), 'utf8');
  console.log('Generated chapter 7 levels 181–210 and difficulty report');
}

function readReport(): ChapterSevenReport {
  if (!existsSync(REPORT_PATH)) throw new Error('Chapter seven report is missing');
  const report = JSON.parse(readFileSync(REPORT_PATH, 'utf8')) as ChapterSevenReport;
  if (
    report.schemaVersion !== 1
    || report.chapterId !== 7
    || report.configVersion !== CONFIG_VERSION
    || report.levels.length !== 30
  ) {
    throw new Error('Chapter seven report header is invalid');
  }
  return report;
}

function sameAnalysis(actual: FullStateAnalysis, entry: ReportLevel): boolean {
  return JSON.stringify(actual.metrics) === JSON.stringify(entry.metrics)
    && JSON.stringify(actual.scoreComponents) === JSON.stringify(entry.scoreComponents);
}

function buildLockedArtifacts(verifySolver: boolean): {
  readonly levels: readonly LevelConfig[];
  readonly report: readonly ReportLevel[];
} {
  const locked = readReport();
  const boardKeys = priorBoardKeys();
  const levels: LevelConfig[] = [];

  for (let index = 0; index < locked.levels.length; index += 1) {
    const levelNumber = index + 181;
    const entry = locked.levels[index];
    const spec = chapterSevenGenerationSpec(levelNumber);
    const initialSeed = chapterSevenGeneratorSeed(levelNumber);
    const generatorSeed = seedForAttempt(initialSeed, entry.attempt);
    const state = randomState(generatorSeed);
    const key = boardKey(state);
    const openingMoves = countLegalOpeningMoves(state);
    if (
      entry.id !== levelId(levelNumber)
      || entry.targetCoefficient !== spec.targetCoefficient
      || entry.targetDifficulty !== spec.targetDifficulty
      || entry.difficultyProfile !== spec.difficultyProfile
      || entry.initialSeed !== initialSeed
      || entry.generatorSeed !== generatorSeed
      || entry.attempt < 1
      || entry.attempt > 1_000
      || entry.boardKey !== key
      || boardKeys.has(key)
      || state.bottles.some(isCompleteBottle)
      || countColorSegments(state) !== entry.metrics.segmentCount
      || openingMoves !== entry.metrics.openingMoves
      || openingMoves < spec.minimumOpeningMoves
      || openingMoves > spec.maximumOpeningMoves
    ) {
      throw new Error(`level-${levelNumber}: locked chapter seven artifact is invalid`);
    }

    if (verifySolver) {
      const completionRule = { type: 'all-colors', targetCount: 11 } as const;
      const base = solveStateCandidate(state, completionRule, MAX_EXPLORED_STATES);
      if (!base || !baseGatesPass(base, spec)) {
        throw new Error(`level-${levelNumber}: locked base analysis no longer passes`);
      }
      const analysis = completeStateAnalysis(
        state,
        11,
        completionRule,
        base,
        MAX_EXPLORED_STATES,
        spec.minimumMisleadingBranchRatio,
      );
      if (!analysis || !sameAnalysis(analysis, entry)) {
        throw new Error(`level-${levelNumber}: locked exact analysis differs`);
      }
    }

    const config: LevelConfig = {
      id: entry.id,
      number: levelNumber,
      configVersion: CONFIG_VERSION,
      presentationSeed: levelNumber,
      capacity: 4,
      slotCount: 15,
      rewardSlotIndex: 14,
      completionRule: { type: 'all-colors', targetCount: 11 },
      metrics: entry.metrics,
      initialState: state,
    };
    const errors = validateLevelConfig(config);
    if (errors.length > 0) throw new Error(`${config.id}: ${errors.join('; ')}`);
    boardKeys.add(key);
    levels.push(config);
  }

  return { levels, report: locked.levels };
}

function runLockedMode(verifySolver: boolean): void {
  const generated = buildLockedArtifacts(verifySolver);
  if (
    !existsSync(DATA_PATH)
    || !generatedOutputMatches(readFileSync(DATA_PATH, 'utf8'), generatedTypeScript(generated.levels))
    || !generatedOutputMatches(readFileSync(REPORT_PATH, 'utf8'), generatedReport(generated.report))
  ) {
    throw new Error('Chapter seven output differs from locked deterministic generation');
  }
  console.log(verifySolver
    ? '30 chapter 7 levels passed exact solver verification'
    : '30 chapter 7 levels match locked generated output');
}

function main(): void {
  const mode = chapterSevenMode(process.argv.slice(2));
  if (mode === 'probe') runProbe();
  else if (mode === 'search') runSearch();
  else runLockedMode(mode === 'verify-solver');
}

const isMain = process.argv[1] !== undefined
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
