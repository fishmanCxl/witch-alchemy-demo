import { chapterForLevel } from './chapter-catalog.ts';
import { createGameSession, type GameSession } from './game-session.ts';
import { getLevelConfig, PUBLISHED_LEVELS } from './level-catalog.ts';
import { createLocalSnapshot, decodeLocalSnapshot, type LocalSnapshot } from './save-schema.ts';
import { canPour } from './water-sort.ts';

export const ENDLESS_SCHEMA_VERSION = 1 as const;
export const ENDLESS_UNLOCK_LEVEL = 5 as const;

export interface EndlessRun {
  readonly seed: number;
  readonly cycle: number;
  readonly stage: number;
  readonly streak: number;
  readonly levelId: string;
  readonly allowedMoves: number;
  readonly reviveUsed: boolean;
  readonly failed: boolean;
  readonly snapshot: LocalSnapshot;
}

export interface EndlessState {
  readonly schemaVersion: typeof ENDLESS_SCHEMA_VERSION;
  readonly bestStreak: number;
  readonly run: EndlessRun | null;
}

export type EndlessSessionOutcome = 'playing' | 'complete' | 'failed';

const ENDLESS_LEVEL_COUNT = PUBLISHED_LEVELS.filter((level) => level.number > 1).length;

function randomSource(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6D2B79F5) >>> 0;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 0x100000000;
  };
}

function shuffled<T>(values: readonly T[], seed: number): T[] {
  const result = [...values];
  const random = randomSource(seed);
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

export function endlessLevelIds(seed: number, cycle = 0): readonly string[] {
  const chapters = new Map<number, string[]>();
  for (const level of PUBLISHED_LEVELS) {
    if (level.number === 1) continue;
    const chapterId = chapterForLevel(level.number)?.id;
    if (chapterId === undefined) continue;
    const ids = chapters.get(chapterId) ?? [];
    ids.push(level.id);
    chapters.set(chapterId, ids);
  }
  return Array.from(chapters.entries())
    .sort(([left], [right]) => left - right)
    .flatMap(([chapterId, ids]) => shuffled(
      ids,
      (seed >>> 0) ^ Math.imul(cycle + 1, 0x9E3779B1) ^ Math.imul(chapterId, 0x85EBCA6B),
    ));
}

function levelForStage(seed: number, stage: number) {
  const cycle = Math.floor((stage - 1) / ENDLESS_LEVEL_COUNT);
  const index = (stage - 1) % ENDLESS_LEVEL_COUNT;
  return getLevelConfig(endlessLevelIds(seed, cycle)[index] ?? '');
}

export function endlessAllowedMoves(optimalMoves: number, streak: number): number {
  const tolerance = streak <= 5 ? 0.25 : streak <= 15 ? 0.20 : 0.15;
  return optimalMoves + Math.max(4, Math.ceil(optimalMoves * tolerance));
}

export function createEndlessState(bestStreak = 0): EndlessState {
  return {
    schemaVersion: ENDLESS_SCHEMA_VERSION,
    bestStreak: Number.isInteger(bestStreak) && bestStreak > 0 ? bestStreak : 0,
    run: null,
  };
}

function initialSnapshot(levelId: string, updatedAt: number): LocalSnapshot {
  const level = getLevelConfig(levelId);
  if (!level) throw new Error(`unknown endless level: ${levelId}`);
  return createLocalSnapshot({
    levelId: level.id,
    configVersion: level.configVersion,
    revision: 0,
    state: level.initialState,
    history: [],
    selected: null,
    updatedAt,
  });
}

export function startEndlessRun(state: EndlessState, seed: number, updatedAt = Date.now()): EndlessState {
  const level = levelForStage(seed, 1);
  if (!level) return state;
  return {
    ...state,
    run: {
      seed: seed >>> 0,
      cycle: 0,
      stage: 1,
      streak: 0,
      levelId: level.id,
      allowedMoves: endlessAllowedMoves(level.metrics.optimalMoves, 0),
      reviveUsed: false,
      failed: false,
      snapshot: initialSnapshot(level.id, updatedAt),
    },
  };
}

export function saveEndlessSession(
  state: EndlessState,
  session: GameSession,
  updatedAt = Date.now(),
): EndlessState {
  const run = state.run;
  if (!run || run.failed || session.levelId !== run.levelId || session.levelComplete
    || session.pendingCompletion.length > 0) return state;
  return {
    ...state,
    run: {
      ...run,
      snapshot: createLocalSnapshot({
        levelId: session.levelId,
        configVersion: session.configVersion,
        revision: session.game.moves,
        state: session.game,
        history: session.history,
        selected: session.selected,
        updatedAt,
        undoRemaining: session.undoRemaining,
        restartRemaining: session.restartRemaining,
      }),
    },
  };
}

export function evaluateEndlessSession(session: GameSession, allowedMoves: number): EndlessSessionOutcome {
  if (session.levelComplete) return 'complete';
  if (session.pendingCompletion.length > 0) return 'playing';
  if (session.game.moves >= allowedMoves) return 'failed';
  for (let from = 0; from < session.game.bottles.length; from += 1) {
    for (let to = 0; to < session.game.bottles.length; to += 1) {
      if (canPour(session.game, from, to)) return 'playing';
    }
  }
  return 'failed';
}

export function failEndlessRun(state: EndlessState): EndlessState {
  return !state.run || state.run.failed ? state : {
    ...state,
    run: { ...state.run, failed: true },
  };
}

export function retryEndlessStage(state: EndlessState, updatedAt = Date.now()): EndlessState {
  const run = state.run;
  if (!run?.failed || run.reviveUsed) return state;
  return {
    ...state,
    run: {
      ...run,
      failed: false,
      reviveUsed: true,
      snapshot: initialSnapshot(run.levelId, updatedAt),
    },
  };
}

export function completeEndlessStage(state: EndlessState, updatedAt = Date.now()): EndlessState {
  const run = state.run;
  if (!run || run.failed) return state;
  const stage = run.stage + 1;
  const streak = run.streak + 1;
  const level = levelForStage(run.seed, stage);
  if (!level) return state;
  return {
    schemaVersion: ENDLESS_SCHEMA_VERSION,
    bestStreak: Math.max(state.bestStreak, streak),
    run: {
      seed: run.seed,
      cycle: Math.floor((stage - 1) / ENDLESS_LEVEL_COUNT),
      stage,
      streak,
      levelId: level.id,
      allowedMoves: endlessAllowedMoves(level.metrics.optimalMoves, streak),
      reviveUsed: false,
      failed: false,
      snapshot: initialSnapshot(level.id, updatedAt),
    },
  };
}

export function endEndlessRun(state: EndlessState): EndlessState {
  return state.run === null ? state : { ...state, run: null };
}

export function encodeEndlessState(state: EndlessState): string {
  return JSON.stringify(state);
}

export function decodeEndlessState(serialized: string | null | undefined): EndlessState {
  if (!serialized) return createEndlessState();
  try {
    const value: unknown = JSON.parse(serialized);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return createEndlessState();
    const record = value as Record<string, unknown>;
    if (record.schemaVersion !== ENDLESS_SCHEMA_VERSION
      || !Number.isInteger(record.bestStreak) || Number(record.bestStreak) < 0) return createEndlessState();
    if (record.run === null) return createEndlessState(Number(record.bestStreak));
    if (typeof record.run !== 'object' || Array.isArray(record.run)) return createEndlessState();
    const run = record.run as unknown as EndlessRun;
    if (!Number.isInteger(run.seed) || run.seed < 0
      || !Number.isInteger(run.stage) || run.stage < 1
      || !Number.isInteger(run.streak) || run.streak !== run.stage - 1
      || !Number.isInteger(run.cycle) || run.cycle !== Math.floor((run.stage - 1) / ENDLESS_LEVEL_COUNT)
      || typeof run.reviveUsed !== 'boolean' || typeof run.failed !== 'boolean') return createEndlessState();
    const level = levelForStage(run.seed, run.stage);
    if (!level || run.levelId !== level.id
      || run.allowedMoves !== endlessAllowedMoves(level.metrics.optimalMoves, run.streak)) return createEndlessState();
    const snapshot = decodeLocalSnapshot(JSON.stringify(run.snapshot), level);
    if (!snapshot) return createEndlessState();
    return {
      schemaVersion: ENDLESS_SCHEMA_VERSION,
      bestStreak: Math.max(Number(record.bestStreak), run.streak),
      run: { ...run, snapshot },
    };
  } catch {
    return createEndlessState();
  }
}

export function restoreEndlessSession(state: EndlessState): GameSession | null {
  const run = state.run;
  if (!run) return null;
  const level = getLevelConfig(run.levelId);
  if (!level) return null;
  return {
    ...createGameSession(level, run.snapshot.state),
    history: run.snapshot.history,
    selected: run.snapshot.selected,
    undoRemaining: run.snapshot.undoRemaining,
    restartRemaining: run.snapshot.restartRemaining,
    message: run.snapshot.selected === null ? '无尽挑战已恢复' : '法杖已锁定，再点目标瓶',
  };
}

export function isEndlessUnlocked(completedThrough: number): boolean {
  return completedThrough >= ENDLESS_UNLOCK_LEVEL;
}
