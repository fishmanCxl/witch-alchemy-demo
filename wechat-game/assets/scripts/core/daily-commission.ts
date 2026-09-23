import { getLevelConfig } from './level-catalog.ts';
import { levelId } from './level-config.ts';

export interface DailyCommissionState {
  readonly schemaVersion: 1;
  readonly date: string;
  readonly levelId: string | null;
  readonly bestMoves: number | null;
  readonly completed: boolean;
  readonly rewardClaimed: boolean;
  readonly streak: number;
  readonly lastCompletedDate: string | null;
}

export function dailyDateKey(now: number): string {
  const date = new Date(now);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function previousDateKey(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() - 1);
  return dailyDateKey(date.getTime());
}

function selectedLevel(date: string, completedThrough: number): string | null {
  if (completedThrough < 5) return null;
  const poolSize = completedThrough - 1;
  const seed = Number(date.replaceAll('-', ''));
  return levelId(2 + seed % poolSize);
}

export function createDailyCommission(
  now: number,
  completedThrough: number,
  previous: DailyCommissionState | null = null,
): DailyCommissionState {
  const date = dailyDateKey(now);
  return Object.freeze({
    schemaVersion: 1 as const,
    date,
    levelId: selectedLevel(date, completedThrough),
    bestMoves: null,
    completed: false,
    rewardClaimed: false,
    streak: previous?.streak ?? 0,
    lastCompletedDate: previous?.lastCompletedDate ?? null,
  });
}

export function reconcileDailyCommission(
  state: DailyCommissionState,
  now: number,
  completedThrough: number,
): DailyCommissionState {
  const today = dailyDateKey(now);
  if (state.date === today && (state.levelId !== null || completedThrough < 5)) return state;
  return createDailyCommission(now, completedThrough, state);
}

export function completeDailyCommission(
  state: DailyCommissionState,
  moves: number,
): DailyCommissionState | null {
  if (state.levelId === null || !Number.isInteger(moves) || moves < 1) return null;
  const bestMoves = state.bestMoves === null ? moves : Math.min(state.bestMoves, moves);
  if (state.completed) return bestMoves === state.bestMoves ? state : Object.freeze({ ...state, bestMoves });
  const streak = state.lastCompletedDate === previousDateKey(state.date) ? state.streak + 1 : 1;
  return Object.freeze({
    ...state,
    bestMoves,
    completed: true,
    streak,
    lastCompletedDate: state.date,
  });
}

export function claimDailyReward(state: DailyCommissionState, now: number): DailyCommissionState | null {
  if (state.date !== dailyDateKey(now) || !state.completed) return null;
  return state.rewardClaimed ? state : Object.freeze({ ...state, rewardClaimed: true });
}

export function encodeDailyCommission(state: DailyCommissionState): string {
  return JSON.stringify(state);
}

export function decodeDailyCommission(serialized: string | null | undefined): DailyCommissionState | null {
  if (!serialized) return null;
  try {
    const value = JSON.parse(serialized) as Record<string, unknown>;
    const level = value.levelId === null ? null : typeof value.levelId === 'string' ? getLevelConfig(value.levelId) : null;
    const bestMoves = value.bestMoves;
    const lastCompletedDate = value.lastCompletedDate;
    if (value.schemaVersion !== 1 || typeof value.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.date)) return null;
    if (value.levelId !== null && !level) return null;
    if (bestMoves !== null && (!Number.isInteger(bestMoves) || Number(bestMoves) < 1)) return null;
    if (typeof value.completed !== 'boolean' || typeof value.rewardClaimed !== 'boolean') return null;
    if (value.rewardClaimed && !value.completed) return null;
    if (!Number.isInteger(value.streak) || Number(value.streak) < 0) return null;
    if (lastCompletedDate !== null && (typeof lastCompletedDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(lastCompletedDate))) return null;
    if (value.completed && (bestMoves === null || lastCompletedDate !== value.date)) return null;
    return Object.freeze(value as unknown as DailyCommissionState);
  } catch {
    return null;
  }
}
