import { getChapter } from './chapter-catalog.ts';
import { getLevelConfig } from './level-catalog.ts';

export type GameScene = 'home' | 'levelSelect' | 'collection' | 'level' | 'levelComplete';

export interface SceneFlowState {
  readonly scene: GameScene;
  readonly selectedLevelId: string | null;
  readonly nextLevelId: string | null;
  readonly soundEnabled: boolean;
  readonly settingsOpen: boolean;
  readonly collectionReturnScene: 'home' | 'levelSelect';
  readonly selectedCollectionChapterId: number | null;
}

export function createSceneFlow(): SceneFlowState {
  return {
    scene: 'home',
    selectedLevelId: null,
    nextLevelId: null,
    soundEnabled: true,
    settingsOpen: false,
    collectionReturnScene: 'home',
    selectedCollectionChapterId: null,
  };
}

export function openLevelSelect(state: SceneFlowState): SceneFlowState {
  return { ...state, scene: 'levelSelect', nextLevelId: null, settingsOpen: false, selectedCollectionChapterId: null };
}

export function openCollection(state: SceneFlowState): SceneFlowState {
  if (state.scene !== 'home' && state.scene !== 'levelSelect') return state;
  return {
    ...state,
    scene: 'collection',
    nextLevelId: null,
    settingsOpen: false,
    collectionReturnScene: state.scene,
    selectedCollectionChapterId: null,
  };
}

export function closeCollection(state: SceneFlowState): SceneFlowState {
  if (state.scene !== 'collection' || state.selectedCollectionChapterId !== null) return state;
  return {
    ...state,
    scene: state.collectionReturnScene,
    nextLevelId: null,
    settingsOpen: false,
  };
}

export function openCollectionDetail(
  state: SceneFlowState,
  chapterId: number,
): SceneFlowState {
  if (state.scene !== 'collection' || state.selectedCollectionChapterId !== null) return state;
  if (getChapter(chapterId)?.releaseState !== 'available') return state;
  return { ...state, selectedCollectionChapterId: chapterId, settingsOpen: false };
}

export function closeCollectionDetail(state: SceneFlowState): SceneFlowState {
  if (state.scene !== 'collection' || state.selectedCollectionChapterId === null) return state;
  return { ...state, selectedCollectionChapterId: null, settingsOpen: false };
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
