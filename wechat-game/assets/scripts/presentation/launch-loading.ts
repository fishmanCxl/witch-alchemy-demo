export const LAUNCH_MIN_VISIBLE_MS = 900;

export type LaunchLoadingPhase = 'loading' | 'failed' | 'ready' | 'exiting';

export interface LaunchLoadingState {
  readonly attempt: number;
  readonly phase: LaunchLoadingPhase;
  readonly progress: number;
  readonly percent: number;
  readonly startedAt: number;
  readonly resourcesReady: boolean;
  readonly minimumVisibleReady: boolean;
  readonly errorMessage: string | null;
}

function freeze(state: LaunchLoadingState): LaunchLoadingState {
  return Object.freeze(state);
}

function withReadyPhase(state: LaunchLoadingState): LaunchLoadingState {
  if (state.phase === 'loading' && state.resourcesReady && state.minimumVisibleReady) {
    return freeze({ ...state, phase: 'ready' });
  }
  return state;
}

export function createLaunchLoadingState(startedAt: number): LaunchLoadingState {
  return freeze({
    attempt: 1,
    phase: 'loading',
    progress: 0,
    percent: 0,
    startedAt: Number.isFinite(startedAt) ? startedAt : 0,
    resourcesReady: false,
    minimumVisibleReady: false,
    errorMessage: null,
  });
}

export function updateLaunchProgress(
  state: LaunchLoadingState,
  attempt: number,
  finished: number,
  total: number,
): LaunchLoadingState {
  if (state.phase !== 'loading' || state.attempt !== attempt) return state;
  const candidate = Number.isFinite(finished) && Number.isFinite(total) && total > 0
    ? Math.min(1, Math.max(0, finished / total))
    : 0;
  const progress = Math.max(state.progress, candidate);
  const percent = Math.min(99, Math.floor(progress * 100));
  if (progress === state.progress && percent === state.percent) return state;
  return freeze({ ...state, progress, percent });
}

export function completeLaunchResources(state: LaunchLoadingState, attempt: number): LaunchLoadingState {
  if (state.phase !== 'loading' || state.attempt !== attempt) return state;
  return withReadyPhase(freeze({ ...state, progress: 1, percent: 100, resourcesReady: true }));
}

export function failLaunchResources(
  state: LaunchLoadingState,
  attempt: number,
  errorMessage: string,
): LaunchLoadingState {
  if (state.phase !== 'loading' || state.attempt !== attempt) return state;
  return freeze({ ...state, phase: 'failed', errorMessage });
}

export function markLaunchMinimumVisible(state: LaunchLoadingState, now: number): LaunchLoadingState {
  if (state.phase === 'exiting' || state.minimumVisibleReady) return state;
  if (!Number.isFinite(now) || now - state.startedAt < LAUNCH_MIN_VISIBLE_MS) return state;
  return withReadyPhase(freeze({ ...state, minimumVisibleReady: true }));
}

export function retryLaunch(state: LaunchLoadingState): LaunchLoadingState {
  if (state.phase !== 'failed') return state;
  return freeze({
    ...state,
    attempt: state.attempt + 1,
    phase: 'loading',
    progress: 0,
    percent: 0,
    resourcesReady: false,
    errorMessage: null,
  });
}

export function canExitLaunch(state: LaunchLoadingState): boolean {
  return state.phase === 'ready' && state.resourcesReady && state.minimumVisibleReady;
}

export function beginLaunchExit(state: LaunchLoadingState): LaunchLoadingState {
  return canExitLaunch(state) ? freeze({ ...state, phase: 'exiting' }) : state;
}
