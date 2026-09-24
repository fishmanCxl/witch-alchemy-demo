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
  difficultyRating,
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
import { CHAPTER_SEVEN_LEVEL_DATA } from '../assets/scripts/core/level-data.chapter-07.generated.ts';
import { CHAPTER_EIGHT_LEVEL_DATA } from '../assets/scripts/core/level-data.chapter-08.generated.ts';
import { PUBLISHED_LEVEL_DATA } from '../assets/scripts/core/level-data.generated.ts';
import type { BottleState, GameState, PotionColor } from '../assets/scripts/core/types.ts';
import { canPour, isCompleteBottle } from '../assets/scripts/core/water-sort.ts';
import {
  completeStateAnalysis,
  generatedOutputMatches,
  scoreCandidate,
  solveStateCandidate,
  type FullStateAnalysis,
  type GenerationScoreComponents,
  type GenerationSpec,
} from './level-generator.ts';

export type ChapterNineDifficultyProfile = 'baseline' | 'deep' | 'deceptive' | 'tangled';

export interface ChapterNineGenerationSpec extends GenerationSpec {
  readonly targetCoefficient: number;
  readonly difficultyProfile: ChapterNineDifficultyProfile;
}

export type ChapterNineMode = 'probe' | 'search' | 'check' | 'verify-solver';

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
  readonly difficultyProfile: ChapterNineDifficultyProfile;
  readonly compatibilityExemption: null;
  readonly initialSeed: number;
  readonly generationStrategy:
    | 'deterministic-shuffle'
    | 'deterministic-profile-mutation'
    | 'deterministic-easing-mutation';
  readonly generatorSeed: number;
  readonly attempt: number;
  readonly reverseMoves: 0;
  readonly boardKey: string;
  readonly metrics: LevelMetrics;
  readonly scoreComponents: GenerationScoreComponents;
}

interface ChapterNineReport {
  readonly schemaVersion: 1;
  readonly chapterId: 9;
  readonly configVersion: string;
  readonly levels: readonly ReportLevel[];
}

interface AcceptedLevel {
  readonly config: LevelConfig;
  readonly report: ReportLevel;
  readonly counters: SearchCounters;
}

interface ChapterNineCheckpoint {
  readonly schemaVersion: 1;
  readonly chapterId: 9;
  readonly configVersion: string;
  readonly level: ReportLevel;
  readonly counters: SearchCounters;
}

export interface ChapterNineSearchResult {
  readonly accepted: AcceptedLevel | null;
  readonly counters: SearchCounters;
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_PATH = resolve(ROOT, 'assets/scripts/core/level-data.chapter-09.generated.ts');
const REPORT_PATH = resolve(ROOT, 'assets/scripts/core/level-generation-report.chapter-09.json');
const CHECKPOINT_ROOT = resolve(ROOT, 'tmp/chapter-nine');
const CONFIG_VERSION = 'chapter-9.2026-09-23.1';
const MAX_EXPLORED_STATES = 150_000;
const MAX_LEVEL_MS = 5 * 60 * 1_000;
const MAX_CHAPTER_MS = 60 * 60 * 1_000;
const MAX_PROBE_LEVEL_MS = 90 * 1_000;
const MAX_PROBE_CHAPTER_MS = 15 * 60 * 1_000;
const PROBE_ATTEMPTS = 60;
const PEAK_PROBE_ATTEMPTS = 150;
const PROBE_LEVELS = [241, 242, 245, 250, 260, 265, 266, 267, 270] as const;

const COLORS: readonly PotionColor[] = [
  'rose', 'violet', 'amber', 'cyan', 'mint', 'blue',
  'gold', 'lilac', 'scarlet', 'chartreuse', 'indigo', 'pearl',
];

const DIFFICULTY_ANCHORS = [
  [241, 1.37],
  [242, 1.45],
  [245, 1.48],
  [250, 1.50],
  [260, 1.53],
  [265, 1.54],
  [267, 1.54],
  [270, 1.47],
] as const;

function assertChapterNineLevel(levelNumber: number): void {
  if (!Number.isInteger(levelNumber) || levelNumber < 241 || levelNumber > 270) {
    throw new RangeError('chapter nine level must be an integer from 241 to 270');
  }
}

export function chapterNineDifficultyTarget(levelNumber: number): number {
  assertChapterNineLevel(levelNumber);
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

export function chapterNineDifficultyProfile(
  levelNumber: number,
): ChapterNineDifficultyProfile {
  assertChapterNineLevel(levelNumber);
  if (levelNumber === 241 || levelNumber >= 268) return 'baseline';
  if (levelNumber >= 265) {
    return (['deep', 'deceptive', 'tangled'] as const)[levelNumber - 265];
  }
  return (['deep', 'deceptive', 'tangled'] as const)[(levelNumber - 242) % 3];
}
export function chapterNineParentLevel(levelNumber: number): 235 | 236 | 237 | 240 | null {
  const profile = chapterNineDifficultyProfile(levelNumber);
  if (levelNumber >= 268) return 240;
  if (profile === 'baseline') return null;
  if (profile === 'deep') return 235;
  if (profile === 'deceptive') return 236;
  return 237;
}


export function chapterNineGenerationSpec(
  levelNumber: number,
): ChapterNineGenerationSpec {
  const targetCoefficient = chapterNineDifficultyTarget(levelNumber);
  const difficultyProfile = chapterNineDifficultyProfile(levelNumber);
  const progress = Math.max(0, Math.min(1, (targetCoefficient - 1.37) / 0.17));
  let minimumOptimalMoves = Math.round(37 + 2 * progress);
  let minimumSegments = 43;
  let minimumExploredStates = Math.round(45_000 + 20_000 * progress);
  let minimumMisleadingBranchRatio = 4 / 11;

  if (difficultyProfile === 'deep') {
    minimumSegments = 44;
    minimumMisleadingBranchRatio = 2 / 11;
  }
  if (difficultyProfile === 'deceptive') {
    minimumSegments = 44;
    minimumMisleadingBranchRatio = 2 / 11;
  }
  if (difficultyProfile === 'tangled') {
    minimumSegments = 44;
    minimumOptimalMoves -= 1;
    minimumExploredStates += 30_000;
  }
  if (levelNumber === 268) {
    minimumOptimalMoves = 38;
  }
  if (levelNumber === 265) {
    minimumOptimalMoves = 40;
    minimumSegments = 44;
    minimumExploredStates = 70_000;
    minimumMisleadingBranchRatio = 1 / 11;
  }
  if (levelNumber === 266) {
    minimumOptimalMoves = 39;
    minimumSegments = 44;
    minimumExploredStates = 70_000;
    minimumMisleadingBranchRatio = 4 / 11;
  }
  if (levelNumber === 267) {
    minimumOptimalMoves = 39;
    minimumSegments = 44;
    minimumExploredStates = 100_000;
    minimumMisleadingBranchRatio = 2 / 11;
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
    maximumOpeningMoves: 22,
    minimumMisleadingBranchRatio,
    maxAttempts: 600,
  };
}

export function chapterNineGeneratorSeed(levelNumber: number): number {
  assertChapterNineLevel(levelNumber);
  if (levelNumber === 266) return 4_151_867_415;
  if (levelNumber === 267) return 96_355_240;
  return (0x260F_0000 + Math.imul(levelNumber, 104_729)) >>> 0;
}

export function chapterNineMode(args: readonly string[]): ChapterNineMode {
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
  return stateFromLayers(layers);
}

function stateFromLayers(layers: readonly PotionColor[]): GameState {
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

function generationStrategy(
  spec: ChapterNineGenerationSpec,
): ReportLevel['generationStrategy'] {
  const parentLevel = chapterNineParentLevel(spec.number);
  if (parentLevel === 240) return 'deterministic-easing-mutation';
  return parentLevel === null ? 'deterministic-shuffle' : 'deterministic-profile-mutation';
}

function candidateState(seed: number, spec: ChapterNineGenerationSpec): GameState {
  const sourceLevel = chapterNineParentLevel(spec.number);
  if (sourceLevel === null) return randomState(seed);
  const source = CHAPTER_EIGHT_LEVEL_DATA[sourceLevel - 211].initialState;
  const sourceLayers = source.bottles.slice(0, 11).flatMap((bottle) => bottle.layers);
  const random = randomSource(seed);
  let state = stateFromLayers(sourceLayers);

  for (let mutationAttempt = 0; mutationAttempt < 64; mutationAttempt += 1) {
    const layers = [...sourceLayers];
    const first = Math.floor(random() * layers.length);
    let second = Math.floor(random() * layers.length);
    while (second === first || layers[second] === layers[first]) {
      second = Math.floor(random() * layers.length);
    }
    [layers[first], layers[second]] = [layers[second], layers[first]];
    state = stateFromLayers(layers);
    if (countColorSegments(state) >= spec.minimumSegments) return state;
  }
  return state;
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
      ...CHAPTER_SEVEN_LEVEL_DATA,
      ...CHAPTER_EIGHT_LEVEL_DATA,
    ].map((level) => boardKey(level.initialState)),
  );
}

function baseGatesPass(
  analysis: NonNullable<ReturnType<typeof solveStateCandidate>>,
  spec: GenerationSpec,
): boolean {
  return analysis.metrics.optimalMoves >= spec.minimumOptimalMoves
    && analysis.metrics.optimalMoves <= spec.maximumOptimalMoves
    && analysis.metrics.segmentCount >= spec.minimumSegments
    && analysis.metrics.exploredStates >= spec.minimumExploredStates
    && analysis.metrics.openingMoves >= spec.minimumOpeningMoves
    && analysis.metrics.openingMoves <= spec.maximumOpeningMoves;
}

function reportGatesPass(metrics: LevelMetrics, spec: GenerationSpec): boolean {
  return metrics.colorCount === spec.colorCount
    && metrics.optimalMoves >= spec.minimumOptimalMoves
    && metrics.optimalMoves <= spec.maximumOptimalMoves
    && metrics.segmentCount >= spec.minimumSegments
    && metrics.exploredStates >= spec.minimumExploredStates
    && metrics.openingMoves >= spec.minimumOpeningMoves
    && metrics.openingMoves <= spec.maximumOpeningMoves
    && metrics.misleadingBranchRatio >= spec.minimumMisleadingBranchRatio;
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

function validCounters(counters: SearchCounters, attempt: number): boolean {
  return counters !== null
    && typeof counters === 'object'
    && counters.attempts === attempt
    && [
      counters.uniqueShapes,
      counters.segmentPasses,
      counters.openingPasses,
      counters.solved,
      counters.baseGatePasses,
      counters.branchGatePasses,
      counters.elapsedMs,
    ].every((value) => Number.isFinite(value) && value >= 0);
}

function searchLevel(
  levelNumber: number,
  boardKeys: Set<string>,
  maxAttempts: number,
  startAttempt = 1,
  counters = emptyCounters(),
  startedAt = performance.now(),
  chapterDeadline = Number.POSITIVE_INFINITY,
  levelBudgetMs = MAX_LEVEL_MS,
): ChapterNineSearchResult {
  const spec = chapterNineGenerationSpec(levelNumber);
  const initialSeed = chapterNineGeneratorSeed(levelNumber);
  const completionRule = { type: 'all-colors', targetCount: 11 } as const;

  const checkTime = (): void => {
    const current = performance.now();
    counters.elapsedMs = Math.round(current - startedAt);
    if (current - startedAt >= levelBudgetMs) {
      throw new Error(`level-${levelNumber}: exceeded level budget ${JSON.stringify(counters)}`);
    }
    if (current >= chapterDeadline) {
      throw new Error(`level-${levelNumber}: exceeded 60-minute chapter budget ${JSON.stringify(counters)}`);
    }
  };

  for (let attempt = startAttempt; attempt <= maxAttempts; attempt += 1) {
    checkTime();
    counters.attempts = attempt;
    const generatorSeed = seedForAttempt(initialSeed, attempt);
    const state = candidateState(generatorSeed, spec);
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
    checkTime();
    if (!analysis) continue;
    counters.branchGatePasses += 1;

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
          generationStrategy: generationStrategy(spec),
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

  checkTime();
  return { accepted: null, counters };
}

export function searchChapterNineLevel(
  levelNumber: number,
  maxAttempts: number,
): ChapterNineSearchResult {
  if (!Number.isInteger(maxAttempts) || maxAttempts < 0 || maxAttempts > 600) {
    throw new RangeError('maxAttempts must be an integer from 0 to 600');
  }
  return searchLevel(levelNumber, priorBoardKeys(), maxAttempts);
}

function summarize(
  levelNumber: number,
  counters: SearchCounters,
  acceptedAttempt?: number,
): string {
  return [
    `level-${levelNumber}`,
    acceptedAttempt === undefined ? 'no-hit' : `accepted=${acceptedAttempt}`,
    ...Object.entries(counters).map(([key, value]) => `${key}=${value}`),
  ].join(' ');
}

function runProbe(): void {
  const boardKeys = priorBoardKeys();
  const chapterDeadline = performance.now() + MAX_PROBE_CHAPTER_MS;
  let failures = 0;
  for (const levelNumber of PROBE_LEVELS) {
    const counters = emptyCounters();
    const startedAt = performance.now();
    let result = searchLevel(
      levelNumber,
      boardKeys,
      PROBE_ATTEMPTS,
      1,
      counters,
      startedAt,
      chapterDeadline,
      MAX_PROBE_LEVEL_MS,
    );
    if (!result.accepted && levelNumber >= 265 && levelNumber <= 267) {
      result = searchLevel(
        levelNumber,
        boardKeys,
        PEAK_PROBE_ATTEMPTS,
        PROBE_ATTEMPTS + 1,
        counters,
        startedAt,
        chapterDeadline,
        MAX_PROBE_LEVEL_MS,
      );
    }
    const accepted = result.accepted;
    if (accepted) boardKeys.add(accepted.report.boardKey);
    else failures += 1;
    console.log(summarize(levelNumber, result.counters, accepted?.report.attempt));
  }
  if (failures > 0) {
    throw new Error(`chapter nine probe missed ${failures} representative level(s); calibrate gates without raising budgets`);
  }
}

function checkpointPath(checkpointRoot: string, levelNumber: number): string {
  return resolve(checkpointRoot, `chapter-09.checkpoint-${levelNumber}.json`);
}

function writeCheckpoint(accepted: AcceptedLevel): void {
  mkdirSync(CHECKPOINT_ROOT, { recursive: true });
  writeFileSync(
    checkpointPath(CHECKPOINT_ROOT, accepted.config.number),
    `${JSON.stringify({
      schemaVersion: 1,
      chapterId: 9,
      configVersion: CONFIG_VERSION,
      level: accepted.report,
      counters: accepted.counters,
    }, null, 2)}\n`,
    'utf8',
  );
}

function sameAnalysis(actual: FullStateAnalysis, entry: ReportLevel): boolean {
  return JSON.stringify(actual.metrics) === JSON.stringify(entry.metrics)
    && JSON.stringify(actual.scoreComponents) === JSON.stringify(entry.scoreComponents);
}

export function reconstructReportLevel(
  levelNumber: number,
  entry: ReportLevel,
  boardKeys: Set<string>,
  verifySolver: boolean,
): { readonly config: LevelConfig; readonly report: ReportLevel } {
  const spec = chapterNineGenerationSpec(levelNumber);
  const initialSeed = chapterNineGeneratorSeed(levelNumber);
  const generatorSeed = seedForAttempt(initialSeed, entry.attempt);
  const state = candidateState(generatorSeed, spec);
  const key = boardKey(state);
  const openingMoves = countLegalOpeningMoves(state);
  const metrics = entry.metrics;
  const expectedScore = scoreCandidate(
    metrics.colorCount,
    metrics.optimalMoves,
    metrics.segmentCount,
    metrics.exploredStates,
    metrics.openingMoves,
    metrics.misleadingBranchRatio,
  );
  const expectedReport: ReportLevel = {
    id: levelId(levelNumber),
    source: 'generated',
    targetCoefficient: spec.targetCoefficient,
    targetDifficulty: spec.targetDifficulty,
    difficultyProfile: spec.difficultyProfile,
    compatibilityExemption: null,
    initialSeed,
    generationStrategy: generationStrategy(spec),
    generatorSeed,
    attempt: entry.attempt,
    reverseMoves: 0,
    boardKey: key,
    metrics: {
      colorCount: spec.colorCount,
      optimalMoves: metrics.optimalMoves,
      segmentCount: countColorSegments(state),
      exploredStates: metrics.exploredStates,
      openingMoves,
      misleadingBranchRatio: metrics.misleadingBranchRatio,
      difficultyRating: difficultyRating(metrics),
      difficultyScore: expectedScore.difficultyScore,
    },
    scoreComponents: expectedScore.components,
  };

  if (
    !Number.isInteger(entry.attempt)
    || entry.attempt < 1
    || entry.attempt > 600
    || JSON.stringify(entry) !== JSON.stringify(expectedReport)
    || boardKeys.has(key)
    || state.bottles.some(isCompleteBottle)
    || !reportGatesPass(entry.metrics, spec)
  ) {
    throw new Error(`level-${levelNumber}: locked chapter nine artifact is invalid`);
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
  return { config, report: entry };
}

export function restoreChapterNineCheckpoints(
  checkpointRoot = CHECKPOINT_ROOT,
): readonly AcceptedLevel[] {
  const boardKeys = priorBoardKeys();
  const restored: AcceptedLevel[] = [];
  for (let levelNumber = 241; levelNumber <= 270; levelNumber += 1) {
    const path = checkpointPath(checkpointRoot, levelNumber);
    if (!existsSync(path)) break;
    try {
      const checkpoint = JSON.parse(readFileSync(path, 'utf8')) as ChapterNineCheckpoint;
      if (
        checkpoint.schemaVersion !== 1
        || checkpoint.chapterId !== 9
        || checkpoint.configVersion !== CONFIG_VERSION
        || !checkpoint.level
        || !validCounters(checkpoint.counters, checkpoint.level.attempt)
      ) {
        throw new Error('header or counters do not match');
      }
      const locked = reconstructReportLevel(
        levelNumber,
        checkpoint.level,
        boardKeys,
        true,
      );
      const accepted = { ...locked, counters: checkpoint.counters };
      restored.push(accepted);
      boardKeys.add(accepted.report.boardKey);
    } catch (error) {
      throw new Error(
        `chapter nine checkpoint level-${levelNumber} is invalid: ${String(error)}`,
      );
    }
  }
  return restored;
}

function generatedTypeScript(levels: readonly LevelConfig[]): string {
  return [
    "import type { LevelConfig } from './level-config.ts';",
    '',
    '// Generated by tools/generate-chapter-nine.ts. Do not edit by hand.',
    `export const CHAPTER_NINE_LEVEL_DATA: readonly LevelConfig[] = ${JSON.stringify(levels, null, 2)};`,
    '',
  ].join('\n');
}

function generatedReport(levels: readonly ReportLevel[]): string {
  return `${JSON.stringify({
    schemaVersion: 1,
    chapterId: 9,
    configVersion: CONFIG_VERSION,
    levels,
  }, null, 2)}\n`;
}

function runSearch(): void {
  const chapterStartedAt = performance.now();
  const restored = restoreChapterNineCheckpoints();
  const boardKeys = priorBoardKeys();
  const levels = restored.map(({ config }) => config);
  const report = restored.map(({ report: entry }) => entry);
  for (const accepted of restored) boardKeys.add(accepted.report.boardKey);

  for (let levelNumber = 241 + restored.length; levelNumber <= 270; levelNumber += 1) {
    if (performance.now() - chapterStartedAt >= MAX_CHAPTER_MS) {
      throw new Error(`level-${levelNumber}: exceeded 60-minute chapter budget`);
    }
    const result = searchLevel(
      levelNumber,
      boardKeys,
      600,
      1,
      emptyCounters(),
      performance.now(),
      chapterStartedAt + MAX_CHAPTER_MS,
    );
    const accepted = result.accepted;
    if (!accepted) {
      throw new Error(
        `level-${levelNumber}: exhausted 600 attempts without a hit ${JSON.stringify(result.counters)}`,
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
  console.log('Generated chapter 9 levels 241–270 and difficulty report');
}

function readReport(): ChapterNineReport {
  if (!existsSync(REPORT_PATH)) throw new Error('Chapter nine report is missing');
  const report = JSON.parse(readFileSync(REPORT_PATH, 'utf8')) as ChapterNineReport;
  if (
    report.schemaVersion !== 1
    || report.chapterId !== 9
    || report.configVersion !== CONFIG_VERSION
    || report.levels.length !== 30
  ) {
    throw new Error('Chapter nine report header is invalid');
  }
  return report;
}

function buildLockedArtifacts(verifySolver: boolean): {
  readonly levels: readonly LevelConfig[];
  readonly report: readonly ReportLevel[];
} {
  const locked = readReport();
  const boardKeys = priorBoardKeys();
  const levels: LevelConfig[] = [];
  for (let index = 0; index < locked.levels.length; index += 1) {
    const levelNumber = index + 241;
    const accepted = reconstructReportLevel(
      levelNumber,
      locked.levels[index],
      boardKeys,
      verifySolver,
    );
    boardKeys.add(accepted.report.boardKey);
    levels.push(accepted.config);
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
    throw new Error('Chapter nine output differs from locked deterministic generation');
  }
  console.log(verifySolver
    ? '30 chapter 9 levels passed exact solver verification'
    : '30 chapter 9 levels match locked generated output');
}

function main(): void {
  const mode = chapterNineMode(process.argv.slice(2));
  if (mode === 'probe') runProbe();
  else if (mode === 'search') runSearch();
  else runLockedMode(mode === 'verify-solver');
}

const isMain = process.argv[1] !== undefined
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
