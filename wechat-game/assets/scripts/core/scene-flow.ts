export type GameScene = 'home' | 'level';

export interface SceneFlowState {
  readonly scene: GameScene;
  readonly soundEnabled: boolean;
  readonly settingsOpen: boolean;
}

export function createSceneFlow(): SceneFlowState {
  return {
    scene: 'home',
    soundEnabled: true,
    settingsOpen: false,
  };
}

export function enterLevel(state: SceneFlowState): SceneFlowState {
  return { ...state, scene: 'level', settingsOpen: false };
}

export function returnHome(state: SceneFlowState): SceneFlowState {
  return { ...state, scene: 'home', settingsOpen: false };
}

export function toggleSound(state: SceneFlowState): SceneFlowState {
  return { ...state, soundEnabled: !state.soundEnabled };
}

export function toggleSettings(state: SceneFlowState): SceneFlowState {
  return { ...state, settingsOpen: !state.settingsOpen };
}
