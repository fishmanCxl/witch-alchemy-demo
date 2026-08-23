import { getLevelConfig } from './level-catalog.ts';

export type GameScene = 'home' | 'levelSelect' | 'level' | 'levelComplete';

export interface SceneFlowState {
  readonly scene: GameScene;
  readonly selectedLevelId: string | null;
  readonly nextLevelId: string | null;
  readonly soundEnabled: boolean;
  readonly settingsOpen: boolean;
}

export function createSceneFlow(): SceneFlowState {
  return {
    scene: 'home',
    selectedLevelId: null,
    nextLevelId: null,
    soundEnabled: true,
    settingsOpen: false,
  };
}

export function openLevelSelect(state: SceneFlowState): SceneFlowState {
  return { ...state, scene: 'levelSelect', nextLevelId: null, settingsOpen: false };
}

export function enterSelectedLevel(
  state: SceneFlowState,
  levelId: string,
  unlocked: boolean,
): SceneFlowState {
  if (!unlocked || !getLevelConfig(levelId)) return state;
  return {
    ...state,
    scene: 'level',
    selectedLevelId: levelId,
    nextLevelId: null,
    settingsOpen: false,
  };
}

export function showLevelComplete(
  state: SceneFlowState,
  nextLevelId: string | null,
): SceneFlowState {
  if (state.scene !== 'level') return state;
  if (nextLevelId !== null && !getLevelConfig(nextLevelId)) return state;
  return { ...state, scene: 'levelComplete', nextLevelId, settingsOpen: false };
}

export function continueFromLevelComplete(state: SceneFlowState): SceneFlowState {
  if (state.scene !== 'levelComplete') return state;
  if (state.nextLevelId) {
    return {
      ...state,
      scene: 'level',
      selectedLevelId: state.nextLevelId,
      nextLevelId: null,
      settingsOpen: false,
    };
  }
  return { ...state, scene: 'levelSelect', nextLevelId: null, settingsOpen: false };
}

export function returnHome(state: SceneFlowState): SceneFlowState {
  return { ...state, scene: 'home', nextLevelId: null, settingsOpen: false };
}

export function toggleSound(state: SceneFlowState): SceneFlowState {
  return { ...state, soundEnabled: !state.soundEnabled };
}

export function toggleSettings(state: SceneFlowState): SceneFlowState {
  return { ...state, settingsOpen: !state.settingsOpen };
}

