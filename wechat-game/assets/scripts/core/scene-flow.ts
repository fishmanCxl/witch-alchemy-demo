import { getChapter } from './chapter-catalog.ts';
import { getLevelConfig } from './level-catalog.ts';

export type GameScene = 'home' | 'levelSelect' | 'collection' | 'level' | 'levelComplete';

export interface SceneFlowState {
  readonly scene: GameScene;
  readonly selectedLevelId: string | null;
  readonly nextLevelId: string | null;
  readonly soundEnabled: boolean;
  readonly settingsOpen: boolean;
  readonly staminaDialogOpen: boolean;
  readonly dailyDialogOpen: boolean;
  readonly exitConfirmOpen: boolean;
  readonly collectionReturnScene: 'home' | 'levelSelect';
  readonly selectedLevelChapterId: number;
  readonly selectedCollectionChapterId: number | null;
  readonly endlessDialog: null | 'locked' | 'failed' | 'end-confirm';
}

export function createSceneFlow(): SceneFlowState {
  return {
    scene: 'home',
    selectedLevelId: null,
    nextLevelId: null,
    soundEnabled: true,
    staminaDialogOpen: false,
    dailyDialogOpen: false,
    exitConfirmOpen: false,
    settingsOpen: false,
    collectionReturnScene: 'home',
    selectedLevelChapterId: 1,
    selectedCollectionChapterId: null,
    endlessDialog: null,
  };
}


export function openStaminaDialog(state: SceneFlowState): SceneFlowState {
  return { ...state, settingsOpen: false, staminaDialogOpen: true, dailyDialogOpen: false, exitConfirmOpen: false, endlessDialog: null };
}

export function closeStaminaDialog(state: SceneFlowState): SceneFlowState {
  return { ...state, staminaDialogOpen: false };
}

export function openDailyDialog(state: SceneFlowState): SceneFlowState {
  if (state.scene !== 'home') return state;
  return { ...state, settingsOpen: false, staminaDialogOpen: false, dailyDialogOpen: true, exitConfirmOpen: false, endlessDialog: null };
}

export function closeDailyDialog(state: SceneFlowState): SceneFlowState {
  return { ...state, dailyDialogOpen: false };
}

export function openEndlessLockedDialog(state: SceneFlowState): SceneFlowState {
  if (state.scene !== 'home') return state;
  return { ...state, settingsOpen: false, staminaDialogOpen: false, dailyDialogOpen: false, exitConfirmOpen: false, endlessDialog: 'locked' };
}

export function openEndlessFailureDialog(state: SceneFlowState): SceneFlowState {
  if (state.scene !== 'level') return state;
  return { ...state, settingsOpen: false, staminaDialogOpen: false, dailyDialogOpen: false, exitConfirmOpen: false, endlessDialog: 'failed' };
}

export function openEndlessEndConfirm(state: SceneFlowState): SceneFlowState {
  return state.endlessDialog === 'failed' ? { ...state, endlessDialog: 'end-confirm' } : state;
}

export function restoreEndlessFailureDialog(state: SceneFlowState): SceneFlowState {
  return state.endlessDialog === 'end-confirm' ? { ...state, endlessDialog: 'failed' } : state;
}

export function closeEndlessDialog(state: SceneFlowState): SceneFlowState {
  return { ...state, endlessDialog: null };
}

export function openExitConfirm(state: SceneFlowState): SceneFlowState {
  if (state.scene !== 'level') return state;
  return { ...state, settingsOpen: false, staminaDialogOpen: false, dailyDialogOpen: false, exitConfirmOpen: true, endlessDialog: null };
}

export function closeExitConfirm(state: SceneFlowState): SceneFlowState {
  return { ...state, exitConfirmOpen: false };
}

export function openLevelSelect(
  state: SceneFlowState,
  chapterId = state.selectedLevelChapterId,
): SceneFlowState {
  const chapter = getChapter(chapterId);
  return {
    ...state,
    scene: 'levelSelect',
    nextLevelId: null,
    settingsOpen: false,
    staminaDialogOpen: false,
    dailyDialogOpen: false,
    exitConfirmOpen: false,
    endlessDialog: null,
    selectedLevelChapterId: chapter?.releaseState === 'available' ? chapterId : state.selectedLevelChapterId,
    selectedCollectionChapterId: null,
  };
}

export function selectLevelChapter(
  state: SceneFlowState,
  chapterId: number,
  unlocked: boolean,
): SceneFlowState {
  const chapter = getChapter(chapterId);
  if (state.scene !== 'levelSelect' || !unlocked || chapter?.releaseState !== 'available') return state;
  return chapterId === state.selectedLevelChapterId ? state : { ...state, selectedLevelChapterId: chapterId, staminaDialogOpen: false, dailyDialogOpen: false, exitConfirmOpen: false, endlessDialog: null };
}

export function openCollection(state: SceneFlowState): SceneFlowState {
  if (state.scene !== 'home' && state.scene !== 'levelSelect') return state;
  return {
    ...state,
    scene: 'collection',
    nextLevelId: null,
    settingsOpen: false,
    staminaDialogOpen: false,
    dailyDialogOpen: false,
    exitConfirmOpen: false,
    endlessDialog: null,
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
    staminaDialogOpen: false,
    dailyDialogOpen: false,
    exitConfirmOpen: false,
    endlessDialog: null,
  };
}

export function openCollectionDetail(
  state: SceneFlowState,
  chapterId: number,
  unlocked: boolean,
): SceneFlowState {
  if (state.scene !== 'collection' || state.selectedCollectionChapterId !== null) return state;
  if (!unlocked || getChapter(chapterId)?.releaseState !== 'available') return state;
  return { ...state, selectedCollectionChapterId: chapterId, settingsOpen: false, staminaDialogOpen: false, dailyDialogOpen: false, exitConfirmOpen: false, endlessDialog: null };
}

export function closeCollectionDetail(state: SceneFlowState): SceneFlowState {
  if (state.scene !== 'collection' || state.selectedCollectionChapterId === null) return state;
  return { ...state, selectedCollectionChapterId: null, settingsOpen: false, staminaDialogOpen: false, dailyDialogOpen: false, exitConfirmOpen: false, endlessDialog: null };
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
    staminaDialogOpen: false,
    dailyDialogOpen: false,
    exitConfirmOpen: false,
    endlessDialog: null,
  };
}

export function showLevelComplete(
  state: SceneFlowState,
  nextLevelId: string | null,
): SceneFlowState {
  if (state.scene !== 'level') return state;
  if (nextLevelId !== null && !getLevelConfig(nextLevelId)) return state;
  return { ...state, scene: 'levelComplete', nextLevelId, settingsOpen: false, staminaDialogOpen: false, dailyDialogOpen: false, exitConfirmOpen: false, endlessDialog: null };
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
      staminaDialogOpen: false,
      dailyDialogOpen: false,
      exitConfirmOpen: false,
      endlessDialog: null,
    };
  }
  return { ...state, scene: 'levelSelect', nextLevelId: null, settingsOpen: false, staminaDialogOpen: false, dailyDialogOpen: false, exitConfirmOpen: false, endlessDialog: null };
}

export function returnHome(state: SceneFlowState): SceneFlowState {
  return { ...state, scene: 'home', nextLevelId: null, settingsOpen: false, staminaDialogOpen: false, dailyDialogOpen: false, exitConfirmOpen: false, endlessDialog: null };
}

export function toggleSound(state: SceneFlowState): SceneFlowState {
  return { ...state, soundEnabled: !state.soundEnabled };
}

export function toggleSettings(state: SceneFlowState): SceneFlowState {
  return { ...state, settingsOpen: !state.settingsOpen, dailyDialogOpen: false, endlessDialog: null };
}
