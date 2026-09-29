import {
  _decorator, BlockInputEvents, Button, Color, Component, Font, Graphics, Label, LabelOutline, Mask,
  Node, Rect, ResolutionPolicy, resources, ScrollView, Size, Sprite, SpriteFrame, sys, Tween, UIOpacity, UITransform, Vec2, Vec3, view, tween,
} from 'cc';

import {
  completePendingBottles, createGameSession, finishWitchReturn, grantRewardBottle, pressBottle,
  refillRestartAllowance, refillUndoAllowance, restartSession, settleWitch, undoSession,
  type GameSession, type SessionResult, type WitchMood,
} from '../core/game-session.ts';
import { FIRST_CHAPTER_LEVELS, getLevelConfig, levelsForChapter, nextLevelConfig } from '../core/level-catalog.ts';
import type { LevelConfig } from '../core/level-config.ts';
import {
  completeLevel, createDefaultProgress, isLevelUnlocked, recordBestMoves, selectCurrentLevel, type PlayerProgress,
} from '../core/level-progress.ts';
import {
  STAMINA_MAX, createFullStamina, grantAdStamina, grantDailyStamina, nextRecoveryMs, reconcileStamina, spendStamina,
  type StaminaState,
} from '../core/stamina.ts';
import {
  claimDailyReward, completeDailyCommission, createDailyCommission, reconcileDailyCommission,
  type DailyCommissionState,
} from '../core/daily-commission.ts';
import {
  completeEndlessStage, createEndlessState, endEndlessRun, evaluateEndlessSession, failEndlessRun,
  isEndlessUnlocked, restoreEndlessSession, retryEndlessStage, saveEndlessSession, startEndlessRun,
  type EndlessState,
} from '../core/endless-mode.ts';
import { chapterStarTotal, levelStarRating, type LevelStarRating } from '../core/level-rating.ts';
import {
  deriveCollectionProgress, deriveCompletionReward, deriveHighestTitle, type CollectionProgress,
  type CompletionReward, type HighestTitle,
} from '../core/collection-progress.ts';
import { chapterForLevel, getChapter } from '../core/chapter-catalog.ts';
import { POTION_COLLECTIONS, getPotionCollection, type PotionCollectionConfig } from '../core/potion-collection-catalog.ts';
import {
  closeCollection, closeCollectionDetail, closeDailyDialog, closeEndlessDialog, closeExitConfirm, closeStaminaDialog,
  createSceneFlow, enterSelectedLevel, openCollection, openCollectionDetail, openDailyDialog, openEndlessEndConfirm,
  openEndlessFailureDialog, openEndlessLockedDialog, openExitConfirm, openLevelSelect, openStaminaDialog,
  restoreEndlessFailureDialog, returnHome, selectLevelChapter, showLevelComplete, toggleSettings, toggleSound,
  type SceneFlowState,
} from '../core/scene-flow.ts';
import type { PotionColor } from '../core/types.ts';
import { LocalProgressStore } from '../platform/LocalProgressStore.ts';
import { PlatformRuntime, REWARDED_AD_CONFIG } from '../platform/WeChatPlatform.ts';
import { RewardedBottleCoordinator, type RewardedAdResult, type RewardFlowStatus } from '../platform/rewarded-bottle.ts';
import { RewardedStaminaCoordinator, type RewardedStaminaStatus } from '../platform/rewarded-stamina.ts';
import { applyProgressSyncResult, ProgressSyncCoordinator } from '../platform/progress-sync.ts';
import { createPlatformStorage } from '../platform/storage-port.ts';
import { AudioDirector } from './AudioDirector.ts';
import {
  LAUNCH_MIN_VISIBLE_MS, beginLaunchExit, canExitLaunch, completeLaunchResources, failLaunchResources,
  createLaunchLoadingState, launchMinimumRemainingMs, markLaunchMinimumVisible, retryLaunch,
  updateLaunchProgress, type LaunchLoadingState,
} from './launch-loading.ts';
import {
  ART_FONT_RESOURCE, COLLECTION_LAYOUT, COLLECTION_LOCK_VISUAL, COLLECTION_OVERVIEW_LAYOUT, DAILY_COMMISSION_LAYOUT, DIALOG_TRANSITION,
  HEALTHY_GAME_ADVICE_LINES, HOME_LAYOUT, LAUNCH_LAYOUT,
  LEVEL_COMPLETE_LAYOUT, LEVEL_LAYOUT, LEVEL_SELECT_LAYOUT, RESTART_LABEL,
  SETTINGS_LAYOUT, STAMINA_LAYOUT, bottleFeedbackVisual, bottlePlacement, bottlePourAngle, buttonBaseLayout, buttonSpritePath,
  chapterLabel, collectionCardLayout, collectionCompleteLabel, collectionPuzzlePiece, collectionRewardLabel,
  completionInfoRowY, completionOptimalLabel, completionPrimaryLabel, controlAllowanceVisual, endlessHudText, formatRecoveryCountdown, launchProgressFill, levelButtonVisual, levelInteractionRefreshMode,
  levelSelectButton, levelSelectContentOffset, potionParticleState, potionParticleVisuals, potionProgressLabel,
  mysteryPotionVisual, mysteryPotionSheetCell, proportionalHeightForWidth, selectedBottleAuraVisual, shouldRenderBottle, staminaBarContentLayout,
  staminaBarYForMenu,
  titleBadgeSheetCell,
  type ButtonBaseLayout, type ButtonVariant, type LevelButtonState, type PotionParticleState,
  type PotionParticleVisual,
} from './presentation-layout.ts';
import { PotionParticleAnimator } from './PotionParticleAnimator.ts';
import { WitchAnimator } from './WitchAnimator.ts';

const { ccclass } = _decorator;
const POTION_COLORS: Record<PotionColor, string> = {
  rose: '#F05B9A', violet: '#9353E6', amber: '#F29A38', cyan: '#2CC4D2',
  mint: '#63D6A5', blue: '#4C70E8', gold: '#F2CC4D', lilac: '#B77ADF',
  scarlet: '#E34A54', chartreuse: '#A8D84A', indigo: '#4A3EB5', pearl: '#F4E9D2',
};
const BACKGROUND_VERTICAL_OVERSCAN = 8;
const SELECTED_BOTTLE_SWAY_DEGREES = 5;
const SELECTED_BOTTLE_SWAY_SECONDS = 0.55;

function color(hex: string, alpha = 255): Color {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  return new Color((value >> 16) & 255, (value >> 8) & 255, value & 255, alpha);
}

@ccclass('ProductionBootstrap')
export class ProductionBootstrap extends Component {
  private flow: SceneFlowState = createSceneFlow();
  private progress: PlayerProgress = createDefaultProgress();
  private stamina: StaminaState = createFullStamina(Date.now());
  private dailyCommission: DailyCommissionState = createDailyCommission(Date.now(), 0);
  private endlessState: EndlessState = createEndlessState();
  private currentLevel: LevelConfig = FIRST_CHAPTER_LEVELS[0];
  private session: GameSession = createGameSession(this.currentLevel);
  private surface: Node | null = null;
  private levelSelectChapterContent: Node | null = null;
  private renderToken = 0;
  private artFont: Font | null = null;
  private audio: AudioDirector | null = null;
  private store = new LocalProgressStore(createPlatformStorage(sys.localStorage));
  private invalid = new Set<number>();
  private pouring = new Set<number>();
  private bottleNodes = new Map<number, Node>();
  private bottleHitTargets = new Map<number, Node>();
  private particleAnimators = new Map<number, PotionParticleAnimator[]>();
  private levelContent: Node | null = null;
  private levelMessageLabel: Label | null = null;
  private levelMovesLabel: Label | null = null;
  private levelPotionProgressLabel: Label | null = null;
  private levelWitchAnimator: WitchAnimator | null = null;
  private completionScheduled = false;
  private staminaSpentForActiveLevel = false;
  private activeDailyCommission = false;
  private activeEndless = false;
  private qaAdResult: RewardedAdResult = REWARDED_AD_CONFIG.mockResult;
  private readonly qaActions = {
    unlockAll: () => {
      this.saveActiveSession();
      this.applyQaProgress(this.store.enableQaAllLevels());
    },
    reset: () => this.applyQaProgress(this.store.resetQaMode()),
  };
  private readonly platform = new PlatformRuntime(this.qaActions);
  private rewarded: RewardedBottleCoordinator | null = null;
  private staminaRewarded: RewardedStaminaCoordinator | null = null;
  private progressSync: ProgressSyncCoordinator | null = null;
  private rewardBusy = false;
  private staminaTickAccumulator = 0;
  private homeStaminaValueLabel: Label | null = null;
  private homeStaminaCountdownLabel: Label | null = null;
  private homeStaminaBar: Node | null = null;
  private staminaDialogValueLabel: Label | null = null;
  private staminaDialogCountdownLabel: Label | null = null;
  private staminaMessage = '';
  private dailyMessage = '';
  private endlessMessage = '';
  private completionSaveFailed = false;
  private completionReward: CompletionReward | null = null;
  private celebratedCompletion = '';
  private collectionHasNewPiece = false;
  private collectionScrollOffsetY = 0;
  private levelStartedAt = Date.now();
  private undoCount = 0;
  private launchState: LaunchLoadingState = createLaunchLoadingState(Date.now());
  private launchProgressFill: Node | null = null;
  private launchPercentLabel: Label | null = null;
  private launchStatusLabel: Label | null = null;
  private launchRetryButton: Node | null = null;
  private renderedDialog: 'settings' | 'stamina' | 'daily' | 'exit' | 'endless' | null = null;
  private dialogClosing = false;

  start(): void {
    view.setDesignResolutionSize(393, 852, ResolutionPolicy.FIXED_WIDTH);
    this.progress = this.store.migrateLegacyLevel12();
    this.stamina = this.store.loadStamina(Date.now());
    this.dailyCommission = this.store.loadDailyCommission(Date.now(), this.progress.completedThrough);
    this.endlessState = this.store.loadEndlessState();
    this.currentLevel = getLevelConfig(this.progress.currentLevel) ?? FIRST_CHAPTER_LEVELS[0];
    this.session = this.store.loadSession(this.currentLevel);
    this.flow = {
      ...this.flow,
      selectedLevelId: this.currentLevel.id,
      soundEnabled: this.store.loadSoundEnabled(),
    };
    this.audio = this.node.getComponent(AudioDirector) ?? this.node.addComponent(AudioDirector);
    this.audio.initialize(this.flow.soundEnabled);
    const rewardPorts = this.platform.createRewardedPorts(REWARDED_AD_CONFIG, () => this.qaAdResult);
    this.rewarded = new RewardedBottleCoordinator(rewardPorts.ad, rewardPorts.claims);
    this.staminaRewarded = new RewardedStaminaCoordinator(rewardPorts.ad);
    this.progressSync = new ProgressSyncCoordinator(this.platform.createProgressSyncPort());
    this.platform.bindLifecycle(
      () => this.handlePlatformForeground(),
      () => { this.saveActiveSession(); this.audio?.setForeground(false); },
    );
    this.launchState = createLaunchLoadingState(Date.now());
    this.renderLaunch();
    this.scheduleLaunchMinimumCheck();
    resources.load(ART_FONT_RESOURCE, Font, (error, font) => {
      if (error || !this.node.isValid) return;
      this.artFont = font;
      for (const label of this.surface?.getComponentsInChildren(Label) ?? []) label.font = font;
    });
    this.startLaunchPreload();
  }

  update(deltaTime: number): void {
    this.staminaTickAccumulator += deltaTime;
    if (this.staminaTickAccumulator < 1) return;
    this.staminaTickAccumulator %= 1;
    const wasFull = this.stamina.value >= STAMINA_MAX;
    const reconciled = reconcileStamina(this.stamina, Date.now());
    if (reconciled !== this.stamina) {
      this.stamina = reconciled;
      this.store.saveStamina(this.stamina);
      if (this.flow.scene === 'home' && wasFull !== (this.stamina.value >= STAMINA_MAX)) {
        this.refreshHomeStaminaBar();
        return;
      }
    }
    this.refreshStaminaLabels();
  }

  private scheduleLaunchMinimumCheck(): void {
    const remainingMs = Math.min(
      LAUNCH_MIN_VISIBLE_MS,
      launchMinimumRemainingMs(this.launchState.startedAt, Date.now()),
    );
    if (remainingMs > 0) {
      this.scheduleOnce(() => this.scheduleLaunchMinimumCheck(), remainingMs / 1000);
      return;
    }
    this.launchState = markLaunchMinimumVisible(this.launchState, Date.now());
    this.tryExitLaunch();
  }

  onDestroy(): void {
    this.platform.dispose();
  }

  private handlePlatformForeground(): void {
    this.audio?.setForeground(true);
    const wasFull = this.stamina.value >= STAMINA_MAX;
    const reconciled = reconcileStamina(this.stamina, Date.now());
    if (reconciled !== this.stamina) {
      this.stamina = reconciled;
      this.store.saveStamina(this.stamina);
      if (this.flow.scene === 'home' && wasFull !== (this.stamina.value >= STAMINA_MAX)) {
        this.render();
        if (!this.isLaunchActive()) void this.syncCloudProgress();
        return;
      }
    }
    this.refreshStaminaLabels();
    const dailyChanged = this.reconcileDailyCommission();
    if (dailyChanged && this.flow.scene === 'home' && !this.isLaunchActive()) this.render();
    if (!this.isLaunchActive()) void this.syncCloudProgress();
  }

  private isLaunchActive(): boolean {
    return this.launchState.phase !== 'exiting' || this.surface?.name === 'LaunchSurface';
  }

  private isCurrentLaunchAttempt(attempt: number): boolean {
    return this.launchState.phase === 'loading' && this.launchState.attempt === attempt;
  }

  private renderLaunch(): void {
    this.renderToken += 1;
    this.surface?.destroy();
    this.surface = new Node('LaunchSurface');
    const viewport = this.visibleViewportSize();
    this.surface.addComponent(UITransform).setContentSize(viewport.width, viewport.height);
    this.surface.addComponent(BlockInputEvents);
    this.surface.addComponent(UIOpacity);
    this.node.addChild(this.surface);
    const root = this.surface;
    const token = this.renderToken;

    this.addAlchemyRoomBackground(root, token, color('#12081F', 94));
    this.addSprite(root, 'game/chibi/ui/launch-logo/spriteFrame',
      LAUNCH_LAYOUT.title.width,
      proportionalHeightForWidth(LAUNCH_LAYOUT.title.width, 612, 459),
      LAUNCH_LAYOUT.title.x, LAUNCH_LAYOUT.title.y, token);
    this.addLaunchWitch(root);

    const track = LAUNCH_LAYOUT.progressTrack;
    this.addPanel(root, track.width, track.height, track.x, track.y,
      color('#1E0D2D', 232), color('#C99CE9', 180), 9);
    this.launchProgressFill = this.addPanel(root, 0, track.height - 4, track.x - 148, track.y,
      color('#DCA6FF'), undefined, 7);
    this.launchPercentLabel = this.addLabel(root, '0%', 13, LAUNCH_LAYOUT.percent.x,
      LAUNCH_LAYOUT.percent.y, color('#F7E6FF'), LAUNCH_LAYOUT.percent.width).getComponent(Label);
    this.launchStatusLabel = this.addLabel(root, '正在准备炼金室…', 11,
      LAUNCH_LAYOUT.status.x, LAUNCH_LAYOUT.status.y,
      color('#DCC7E8'), LAUNCH_LAYOUT.status.width).getComponent(Label);
    HEALTHY_GAME_ADVICE_LINES.forEach((line, index) => {
      this.addLabel(root, line, 8, 0, LAUNCH_LAYOUT.adviceCenters[index], color('#BDAFC4'), 360);
    });
    this.renderLaunchAmbientParticles(root, token);
    this.updateLaunchView();
  }

  private startLaunchPreload(): void {
    const attempt = this.launchState.attempt;
    resources.preloadDir('game', (finished, total) => {
      if (!this.node.isValid) return;
      if (!this.isCurrentLaunchAttempt(attempt)) return;
      this.launchState = updateLaunchProgress(this.launchState, attempt, finished, total);
      this.updateLaunchView();
    }, (error) => {
      if (!this.node.isValid) return;
      if (!this.isCurrentLaunchAttempt(attempt)) return;
      if (error) {
        this.launchState = failLaunchResources(
          this.launchState,
          attempt,
          '资源加载失败，请检查网络或存储空间',
        );
        this.showLaunchFailure();
        return;
      }
      void WitchAnimator.preloadPourFrames().then(() => {
        if (!this.node.isValid || !this.isCurrentLaunchAttempt(attempt)) return;
        this.launchState = completeLaunchResources(this.launchState, attempt);
        this.updateLaunchView();
        this.tryExitLaunch();
      }, () => {
        if (!this.node.isValid || !this.isCurrentLaunchAttempt(attempt)) return;
        this.launchState = failLaunchResources(
          this.launchState, attempt, '动画资源加载失败，请重试',
        );
        this.showLaunchFailure();
      });
    });
  }

  private showLaunchFailure(): void {
    if (this.launchState.phase !== 'failed' || !this.surface?.isValid) return;
    if (this.launchProgressFill) this.launchProgressFill.active = false;
    if (this.launchPercentLabel) this.launchPercentLabel.node.active = false;
    if (this.launchStatusLabel) this.launchStatusLabel.string = this.launchState.errorMessage ?? '资源加载失败';
    if (!this.launchRetryButton?.isValid) {
      this.launchRetryButton = this.addRasterButton(this.surface, '重新加载', 'purple',
        LAUNCH_LAYOUT.retryButton.width, LAUNCH_LAYOUT.retryButton.height,
        LAUNCH_LAYOUT.retryButton.x, LAUNCH_LAYOUT.retryButton.y,
        () => this.handleLaunchRetry(), false, undefined, 16);
    }
    const button = this.launchRetryButton.getComponent(Button);
    if (button) button.interactable = true;
    this.launchRetryButton.active = true;
  }

  private handleLaunchRetry(): void {
    const next = retryLaunch(this.launchState);
    if (next === this.launchState) return;
    this.launchState = next;
    const button = this.launchRetryButton?.getComponent(Button);
    if (button) button.interactable = false;
    if (this.launchRetryButton) this.launchRetryButton.active = false;
    if (this.launchProgressFill) this.launchProgressFill.active = true;
    if (this.launchPercentLabel) this.launchPercentLabel.node.active = true;
    if (this.launchStatusLabel) this.launchStatusLabel.string = '正在重新准备炼金室…';
    this.updateLaunchView();
    this.startLaunchPreload();
  }

  private updateLaunchView(): void {
    const fill = launchProgressFill(this.launchState.progress);
    if (this.launchProgressFill?.isValid) {
      this.launchProgressFill.setPosition(fill.x, LAUNCH_LAYOUT.progressTrack.y);
      this.launchProgressFill.getComponent(UITransform)?.setContentSize(
        fill.width, LAUNCH_LAYOUT.progressTrack.height - 4,
      );
      const graphics = this.launchProgressFill.getComponent(Graphics);
      if (graphics) {
        graphics.clear();
        graphics.fillColor = color('#DCA6FF');
        graphics.roundRect(-fill.width / 2, -(LAUNCH_LAYOUT.progressTrack.height - 4) / 2,
          fill.width, LAUNCH_LAYOUT.progressTrack.height - 4, 7);
        graphics.fill();
      }
    }
    if (this.launchPercentLabel) this.launchPercentLabel.string = `${this.launchState.percent}%`;
  }

  private tryExitLaunch(): void {
    if (!canExitLaunch(this.launchState) || !this.surface?.isValid) return;
    this.launchState = beginLaunchExit(this.launchState);
    const opacity = this.surface.getComponent(UIOpacity) ?? this.surface.addComponent(UIOpacity);
    tween(opacity).to(0.22, { opacity: 0 }).call(() => this.enterHomeAfterLaunch()).start();
  }

  private enterHomeAfterLaunch(): void {
    if (this.launchState.phase !== 'exiting' || !this.node.isValid) return;
    this.clearLaunchNodeReferences();
    this.render();
    void this.syncCloudProgress();
  }

  private clearLaunchNodeReferences(): void {
    this.launchProgressFill = null;
    this.launchPercentLabel = null;
    this.launchStatusLabel = null;
    this.launchRetryButton = null;
  }

  private render(): void {
    const previousDialog = this.renderedDialog;
    this.renderedDialog = this.flow.settingsOpen ? 'settings'
      : this.flow.staminaDialogOpen ? 'stamina'
        : this.flow.dailyDialogOpen ? 'daily'
          : this.flow.exitConfirmOpen ? 'exit'
            : this.flow.endlessDialog ? 'endless' : null;
    const animateDialog = this.renderedDialog !== null && this.renderedDialog !== previousDialog;
    this.renderToken += 1;
    this.clearLevelReferences();
    this.levelSelectChapterContent = null;
    this.homeStaminaValueLabel = null;
    this.homeStaminaCountdownLabel = null;
    this.homeStaminaBar = null;
    this.staminaDialogValueLabel = null;
    this.staminaDialogCountdownLabel = null;
    this.surface?.destroy();
    this.bottleNodes.clear();
    this.bottleHitTargets.clear();
    this.particleAnimators.clear();
    this.surface = new Node('ProductionSurface');
    const viewport = this.visibleViewportSize();
    this.surface.addComponent(UITransform).setContentSize(viewport.width, viewport.height);
    this.node.addChild(this.surface);
    if (this.flow.scene === 'home') this.renderHome(this.surface, this.renderToken);
    else if (this.flow.scene === 'levelSelect') this.renderLevelSelect(this.surface, this.renderToken);
    else if (this.flow.scene === 'collection') this.renderCollection(this.surface, this.renderToken);
    else if (this.flow.scene === 'levelComplete') this.renderLevelComplete(this.surface, this.renderToken);
    else this.renderLevel(this.surface, this.renderToken);
    this.renderSettingsButton(this.surface, this.renderToken);
    if (this.flow.settingsOpen) this.renderSettings(this.surface, this.renderToken, animateDialog);
    if (this.flow.staminaDialogOpen) this.renderStaminaDialog(this.surface, this.renderToken, animateDialog);
    if (this.flow.dailyDialogOpen) this.renderDailyCommissionDialog(this.surface, this.renderToken, animateDialog);
    if (this.flow.exitConfirmOpen) this.renderExitConfirm(this.surface, this.renderToken, animateDialog);
    if (this.flow.endlessDialog) this.renderEndlessDialog(this.surface, this.renderToken, animateDialog);
  }

  private clearLevelReferences(): void {
    this.levelContent = null;
    this.levelMessageLabel = null;
    this.levelMovesLabel = null;
    this.levelPotionProgressLabel = null;
    this.levelWitchAnimator = null;
  }

  private renderHome(root: Node, token: number): void {
    this.addAlchemyRoomBackground(root, token, color('#170D29', 34));
    const title = deriveHighestTitle(this.progress);
    this.renderStaminaBar(root, token);
    this.renderDailyCommissionEntry(root, token);
    this.renderEndlessEntry(root, token);
    const titleBadge = this.renderTitleBadge(root, title, HOME_LAYOUT.titleBadge, token);
    tween(titleBadge).repeatForever(
      tween<Node>()
        .to(HOME_LAYOUT.titleFloat.duration, {
          position: new Vec3(HOME_LAYOUT.titleBadge.x,
            HOME_LAYOUT.titleBadge.y + HOME_LAYOUT.titleFloat.distance, 0),
        }, { easing: 'sineInOut' })
        .to(HOME_LAYOUT.titleFloat.duration, {
          position: new Vec3(HOME_LAYOUT.titleBadge.x, HOME_LAYOUT.titleBadge.y, 0),
        }, { easing: 'sineInOut' }),
    ).start();
    this.renderCollectionEntry(root, HOME_LAYOUT.collectionButton, token);
    this.renderShareEntry(root, HOME_LAYOUT.shareButton, token);
    this.addWitch(root, 'idle', HOME_LAYOUT.witch.x, HOME_LAYOUT.witch.y, HOME_LAYOUT.witch.width, HOME_LAYOUT.witch.height);
    this.addRasterButton(root, '选择关卡', 'gold', HOME_LAYOUT.selectButton.width,
      HOME_LAYOUT.selectButton.height, HOME_LAYOUT.selectButton.x, HOME_LAYOUT.selectButton.y, () => {
        this.resumeAudio();
        this.store.saveSession(this.session);
        this.flow = openLevelSelect(this.flow, chapterForLevel(this.currentLevel.number)?.id ?? 1);
        this.render();
      }, false, undefined, 16);
    this.addRasterButton(root, `继续炼金 · 第 ${this.currentLevel.number} 关`, 'purple', HOME_LAYOUT.continueButton.width,
      HOME_LAYOUT.continueButton.height, HOME_LAYOUT.continueButton.x, HOME_LAYOUT.continueButton.y, () => {
      this.resumeAudio();
      this.switchLevel(this.progress.currentLevel);
    }, false, undefined, 18);
  }

  private renderLevelSelect(root: Node, token: number): void {
    this.addAlchemyRoomBackground(root, token, color('#130A20', 96));
    this.levelSelectChapterContent = new Node('LevelSelectChapterContent');
    this.positionLevelSelectChapterContent(this.levelSelectChapterContent);
    root.addChild(this.levelSelectChapterContent);
    this.renderLevelSelectChapter(this.levelSelectChapterContent, token);
    this.addRasterButton(root, '返回主页', 'purple', LEVEL_SELECT_LAYOUT.backButton.width,
      LEVEL_SELECT_LAYOUT.backButton.height, LEVEL_SELECT_LAYOUT.backButton.x,
      LEVEL_SELECT_LAYOUT.backButton.y, () => this.returnToHome(), false, 'icon-settings-home', 16);
  }

  private renderLevelSelectChapter(root: Node, token: number): void {
    const chapter = getChapter(this.flow.selectedLevelChapterId)!;
    this.addLabel(root, `${chapterLabel(chapter.id)} · ${chapter.themeTitle}`, 24, LEVEL_SELECT_LAYOUT.header.x,
      LEVEL_SELECT_LAYOUT.header.y, color('#FFF4DF'), LEVEL_SELECT_LAYOUT.header.width);
    this.addSprite(root, 'game/chibi/ui/star-earned/spriteFrame', 44, 44,
      -100, LEVEL_SELECT_LAYOUT.starTotalY, token);
    this.addLabel(root, chapterStarTotal(this.progress, chapter.id) + ' / ' + chapter.levelCount * 3,
      LEVEL_SELECT_LAYOUT.starTotalFontSize, 20, LEVEL_SELECT_LAYOUT.starTotalY,
      color('#FFE3A0'), 200);
    const previousChapter = getChapter(chapter.id - 1);
    const nextChapter = getChapter(chapter.id + 1);
    this.addRasterButton(root, '‹', 'purple', LEVEL_SELECT_LAYOUT.previousChapterButton.width,
      LEVEL_SELECT_LAYOUT.previousChapterButton.height, LEVEL_SELECT_LAYOUT.previousChapterButton.x,
      LEVEL_SELECT_LAYOUT.previousChapterButton.y, () => this.changeLevelChapter(chapter.id - 1, true),
      previousChapter?.releaseState !== 'available', undefined, 24);
    const nextUnlocked = nextChapter?.releaseState === 'available'
      && isLevelUnlocked(this.progress, `level-${String(nextChapter.firstLevel).padStart(3, '0')}`);
    this.addRasterButton(root, '›', 'purple', LEVEL_SELECT_LAYOUT.nextChapterButton.width,
      LEVEL_SELECT_LAYOUT.nextChapterButton.height, LEVEL_SELECT_LAYOUT.nextChapterButton.x,
      LEVEL_SELECT_LAYOUT.nextChapterButton.y, () => this.changeLevelChapter(chapter.id + 1, nextUnlocked),
      !nextUnlocked, undefined, 24);

    levelsForChapter(this.flow.selectedLevelChapterId).forEach((level, index) => {
      const state = this.levelButtonState(level);
      const visual = levelButtonVisual(state);
      const layout = levelSelectButton(index);
      const stars = levelStarRating(
        level.number <= this.progress.completedThrough,
        this.progress.bestMoves[level.id],
        level.metrics.optimalMoves,
      );
      this.addLevelSelectButton(root, level, layout, state, visual, stars, token);
    });
  }

  private positionLevelSelectChapterContent(content: Node): void {
    const settingsY = staminaBarYForMenu(
      this.visibleViewportSize().height,
      this.platform.menuButtonCenterRatio(),
    );
    content.setPosition(0, levelSelectContentOffset(settingsY));
  }

  private renderCollection(root: Node, token: number): void {
    this.addAlchemyRoomBackground(root, token, color('#10071C', 144));
    if (this.flow.selectedCollectionChapterId === null) this.renderCollectionOverview(root, token);
    else this.renderCollectionDetail(root, this.flow.selectedCollectionChapterId, token);
  }

  private renderCollectionOverview(root: Node, token: number): void {
    const layout = COLLECTION_OVERVIEW_LAYOUT;
    this.addLabel(root, '收藏品', 30, layout.title.x, layout.title.y, color('#FFF2CF'), layout.title.width);
    const tip = this.addLabel(root, '', 12, 0, layout.lockedTipY, color('#FFE3A0'), 300);
    tip.addComponent(UIOpacity).opacity = 0;

    const viewport = new Node('CollectionScrollView');
    viewport.setPosition(layout.viewport.x, layout.viewport.y);
    viewport.addComponent(UITransform).setContentSize(layout.viewport.width, layout.viewport.height);
    root.addChild(viewport);
    viewport.addComponent(Mask).type = Mask.Type.RECT;
    const content = new Node('CollectionContent');
    content.setPosition(0, -(layout.contentHeight - layout.viewport.height) / 2);
    content.addComponent(UITransform).setContentSize(layout.viewport.width, layout.contentHeight);
    viewport.addChild(content);
    const scroll = viewport.addComponent(ScrollView);
    scroll.content = content;
    scroll.horizontal = false;
    scroll.vertical = true;
    scroll.inertia = true;
    scroll.elastic = true;

    POTION_COLLECTIONS.forEach((collection, index) =>
      this.renderCollectionCard(content, collection, index, tip, token));
    scroll.scrollToOffset(new Vec2(0, this.collectionScrollOffsetY), 0);
    this.addRasterButton(root, '返回', 'purple', layout.backButton.width, layout.backButton.height,
      layout.backButton.x, layout.backButton.y, () => this.closeCollectionView(), false, undefined, 15);
  }

  private renderCollectionCard(
    root: Node,
    collection: PotionCollectionConfig,
    index: number,
    lockedTip: Node,
    token: number,
  ): void {
    const layout = collectionCardLayout(index);
    const card = new Node(`CollectionCard-${collection.chapterId}`);
    card.setPosition(layout.x, layout.y);
    card.addComponent(UITransform).setContentSize(layout.width, layout.height);
    root.addChild(card);
    this.addSprite(card, 'game/chibi/ui/collection-card-background/spriteFrame',
      layout.width, layout.height, 0, 0, token);
    card.addComponent(Button);
    const chapter = getChapter(collection.chapterId)!;
    const firstLevelId = `level-${String(chapter.firstLevel).padStart(3, '0')}`;
    const unlocked = isLevelUnlocked(this.progress, firstLevelId);

    if (collection.artworkKey && unlocked) {
      const progress = deriveCollectionProgress(this.progress, collection.chapterId);
      this.addSprite(card, `game/chibi/collection/${collection.artworkKey}/spriteFrame`,
        88, 88, 0, 25, token);
      this.addLabel(card, collection.name, 18, 0, -39, color('#E8D6FF'), 136);
      this.addLabel(card, `${progress.revealedPieces}/${progress.totalPieces}`, 12, 0, -66,
        color('#FFE8AA'), 120);
      this.bindUiClick(card, () => {
        this.resumeAudio();
        const nextFlow = openCollectionDetail(
          this.flow,
          collection.chapterId,
          unlocked,
        );
        if (nextFlow === this.flow) return;
        this.flow = nextFlow;
        this.collectionScrollOffsetY = root.parent?.getComponent(ScrollView)?.getScrollOffset().y ?? 0;
        this.render();
      });
      return;
    }

    this.renderMysteryPotion(card, collection.silhouetteIndex ?? 0, 0, 24);
    this.renderCollectionLock(card, 31, 35, token);
    this.addLabel(card, '???', 18, 0, -41, color('#B8A3C8'), 120);
    this.addLabel(card, `第 ${collection.chapterId} 章`, 11, 0, -67, color('#8E789C'), 120);
    this.bindUiClick(card, () => {
      this.resumeAudio();
      Tween.stopAllByTarget(card);
      tween(card)
        .to(0.04, { position: new Vec3(layout.x - 6, layout.y, 0) })
        .to(0.04, { position: new Vec3(layout.x + 6, layout.y, 0) })
        .to(0.04, { position: new Vec3(layout.x - 4, layout.y, 0) })
        .to(0.04, { position: new Vec3(layout.x + 4, layout.y, 0) })
        .to(0.04, { position: new Vec3(layout.x, layout.y, 0) })
        .start();
      const label = lockedTip.getComponent(Label);
      const opacity = lockedTip.getComponent(UIOpacity);
      if (!label || !opacity) return;
      label.string = collection.artworkKey
        ? `完成第 ${chapter.firstLevel - 1} 关后解锁`
        : `第 ${collection.chapterId} 章开放后解锁`;
      Tween.stopAllByTarget(opacity);
      opacity.opacity = 255;
      tween(opacity).delay(1).to(0.4, { opacity: 0 }).start();
    });
  }

  private renderCollectionLock(root: Node, x: number, y: number, token: number): void {
    const visual = COLLECTION_LOCK_VISUAL;
    const node = this.addSprite(root, 'game/chibi/ui/collection-lock/spriteFrame',
      visual.width, visual.height, x, y, token);
    node.name = 'CollectionLock';
  }

  private renderMysteryPotion(root: Node, index: number, x: number, y: number): void {
    const cell = mysteryPotionSheetCell(index);
    const node = new Node(`MysteryPotion-${index + 1}`);
    node.setPosition(x, y);
    node.addComponent(UITransform).setContentSize(96, 96);
    node.addComponent(Mask).type = Mask.Type.RECT;
    root.addChild(node);
    this.addSprite(node, cell.path, cell.size, cell.size, cell.x, cell.y, this.renderToken);
  }

  private renderCollectionDetail(root: Node, chapterId: number, token: number): void {
    const collection = deriveCollectionProgress(this.progress, chapterId);
    const collectionConfig = getPotionCollection(collection.chapterId)!;
    const artworkPath = `game/chibi/collection/${collectionConfig.artworkKey}/spriteFrame`;
    this.renderCollectionPuzzle(root, collection, artworkPath, token);
    this.addLabel(root, '已收集 ' + collection.revealedPieces + '/' + collection.totalPieces, 17,
      0, COLLECTION_LAYOUT.progressY, color('#FFF0C2'), 240);
    this.addLabel(root, collectionConfig.name, 21, 0, -142, color('#D7C4FF'), COLLECTION_LAYOUT.description.width);
    this.addLabel(root, collectionConfig.description, 12, 0, -174,
      color('#E6D5E9'), COLLECTION_LAYOUT.description.width);
    const milestone = collection.nextMilestone === null
      ? '完整药水已收入炼金图鉴'
      : '再完成 ' + (collection.nextMilestone - collection.completedLevels) + ' 关揭示下一块';
    this.addLabel(root, milestone, 11, 0, -204, color('#C6AECF'), COLLECTION_LAYOUT.description.width);
    this.addRasterButton(root, '返回收藏品', 'purple', COLLECTION_LAYOUT.backButton.width,
      COLLECTION_LAYOUT.backButton.height, COLLECTION_LAYOUT.backButton.x,
      COLLECTION_LAYOUT.backButton.y, () => this.closeCollectionDetailView(), false, undefined, 15);
    this.addRasterButton(root, '分享图鉴', 'gold', COLLECTION_LAYOUT.shareButton.width,
      COLLECTION_LAYOUT.shareButton.height, COLLECTION_LAYOUT.shareButton.x,
      COLLECTION_LAYOUT.shareButton.y, () => this.platform.share({
        title: `我正在收集「${collectionConfig.name}」，已完成 ${collection.revealedPieces}/${collection.totalPieces}`,
        query: `collection=${collection.chapterId}`,
      }), false, undefined, 15);
  }

  private renderTitleBadge(
    root: Node,
    title: HighestTitle,
    layout: Readonly<{ x: number; y: number; width: number }>,
    token: number,
  ): Node {
    const cell = titleBadgeSheetCell(title.chapterId);
    const badge = new Node('TitleBadge');
    badge.setPosition(layout.x, layout.y);
    badge.addComponent(UITransform).setContentSize(
      layout.width,
      layout.width * cell.sourceHeight / cell.sourceWidth,
    );
    root.addChild(badge);
    const sprite = badge.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    sprite.trim = false;
    const applyFrame = (source: SpriteFrame): void => {
      const frame = source.clone();
      frame.rect = new Rect(cell.sourceX, cell.sourceY, cell.sourceWidth, cell.sourceHeight);
      frame.originalSize = new Size(cell.sourceWidth, cell.sourceHeight);
      frame.offset = Vec2.ZERO;
      frame.packable = false;
      sprite.spriteFrame = frame;
    };
    const cached = resources.get(cell.path, SpriteFrame);
    if (cached) applyFrame(cached);
    else resources.load(cell.path, SpriteFrame, (error, frame) => {
      if (error || token !== this.renderToken || !badge.isValid) return;
      applyFrame(frame);
    });
    return badge;
  }

  private renderCollectionEntry(
    root: Node,
    layout: Readonly<{ x: number; y: number; width: number; height: number }>,
    token: number,
  ): void {
    const button = new Node('CollectionEntry');
    button.setPosition(layout.x, layout.y);
    button.addComponent(UITransform).setContentSize(layout.width, layout.height);
    root.addChild(button);
    if (this.collectionHasNewPiece) {
      this.addSprite(button, 'game/chibi/effects/completion-burst/spriteFrame',
        60, 60, 0, 0, token);
    }
    this.addSprite(button, 'game/chibi/ui/home-collection-button/spriteFrame',
      layout.width, layout.height, 0, 0, token);
    button.addComponent(Button);
    this.bindUiClick(button, () => this.openCollectionView());
  }

  private renderShareEntry(
    root: Node,
    layout: Readonly<{ x: number; y: number; width: number; height: number }>,
    token: number,
  ): void {
    const button = new Node('ShareEntry');
    button.setPosition(layout.x, layout.y);
    button.addComponent(UITransform).setContentSize(layout.width, layout.height);
    root.addChild(button);
    this.addSprite(button, 'game/chibi/ui/home-share-button/spriteFrame',
      layout.width, layout.height, 0, 0, token);
    button.addComponent(Button);
    this.bindUiClick(button, () => this.platform.share({
      title: '魔女炼金屋｜来挑战魔法药水排序',
      query: `level=${this.currentLevel.number}`,
    }));
  }

  private renderEndlessEntry(root: Node, token: number): void {
    const layout = HOME_LAYOUT.endlessButton;
    const button = new Node('EndlessEntry');
    button.setPosition(layout.x, layout.y);
    button.addComponent(UITransform).setContentSize(layout.hitWidth, layout.hitHeight);
    root.addChild(button);
    this.addSprite(button, 'game/chibi/ui/home-endless-mode-button/spriteFrame',
      layout.width, layout.height, 0, 0, token);
    button.addComponent(Button);
    this.bindUiClick(button, () => this.openEndlessMode());
  }

  private openEndlessMode(): void {
    if (!isEndlessUnlocked(this.progress.completedThrough)) {
      this.flow = openEndlessLockedDialog(this.flow);
      this.render();
      return;
    }
    this.saveActiveSession();
    if (!this.endlessState.run) {
      this.endlessState = startEndlessRun(this.endlessState, Date.now());
      this.store.saveEndlessState(this.endlessState);
    }
    const run = this.endlessState.run;
    const level = run ? getLevelConfig(run.levelId) : null;
    const session = restoreEndlessSession(this.endlessState);
    if (!run || !level || !session) return;

    this.activeDailyCommission = false;
    this.activeEndless = true;
    this.currentLevel = level;
    this.session = session;
    this.flow = enterSelectedLevel(closeEndlessDialog(this.flow), level.id, true);
    if (run.failed) this.flow = openEndlessFailureDialog(this.flow);
    this.unscheduleAllCallbacks();
    this.completionScheduled = false;
    this.staminaSpentForActiveLevel = false;
    this.completionSaveFailed = false;
    this.completionReward = null;
    this.levelStartedAt = Date.now();
    this.undoCount = 0;
    this.invalid.clear();
    this.pouring.clear();
    this.render();
  }

  private renderDailyCommissionEntry(root: Node, token: number): void {
    const layout = HOME_LAYOUT.dailyCommissionButton;
    const locked = this.dailyCommission.levelId === null;
    const button = new Node('DailyCommissionButton');
    button.setPosition(layout.x, layout.y);
    button.addComponent(UITransform).setContentSize(layout.width, layout.height);
    root.addChild(button);
    this.addSprite(button, 'game/chibi/ui/home-daily-commission-button/spriteFrame',
      layout.width, layout.height, 0, 0, token);
    button.addComponent(Button);
    this.bindUiClick(button, () => {
      this.reconcileDailyCommission();
      this.dailyMessage = '';
      this.flow = openDailyDialog(this.flow);
      this.render();
    });
    if (locked || this.dailyCommission.rewardClaimed) return;
    const bubbleLayout = HOME_LAYOUT.dailyCommissionBubble;
    const bubble = new Node('DailyCommissionBubble');
    bubble.setPosition(bubbleLayout.x, bubbleLayout.y);
    bubble.addComponent(UITransform).setContentSize(bubbleLayout.width, bubbleLayout.height);
    button.addChild(bubble);
    this.addSprite(bubble, 'game/chibi/ui/daily-commission-speech-bubble/spriteFrame',
      bubbleLayout.width, bubbleLayout.height, 0, 0, token);
    this.renderStaminaIcon(bubble, 0, -8, bubbleLayout.contentY, 14, token);
    this.addLabel(bubble, '+1', 11, 9, bubbleLayout.contentY, color('#6A351E'), 20);
    tween(bubble).repeatForever(
      tween()
        .to(bubbleLayout.floatDuration, {
          position: new Vec3(bubbleLayout.x, bubbleLayout.y + bubbleLayout.floatDistance, 0),
        }, { easing: 'sineInOut' })
        .to(bubbleLayout.floatDuration, {
          position: new Vec3(bubbleLayout.x, bubbleLayout.y, 0),
        }, { easing: 'sineInOut' }),
    ).start();
  }

  private renderDailyCommissionDialog(root: Node, token: number, animate: boolean): void {
    const layout = DAILY_COMMISSION_LAYOUT;
    const shield = new Node('DailyCommissionShield');
    const viewport = this.visibleViewportSize();
    shield.addComponent(UITransform).setContentSize(viewport.width, viewport.height);
    shield.addComponent(BlockInputEvents);
    root.addChild(shield);
    this.addPanel(shield, viewport.width, viewport.height, 0, 0, color('#090411', 184));
    const panel = new Node('DailyCommissionDialog');
    panel.setPosition(layout.dialog.x, layout.dialog.y);
    panel.addComponent(UITransform).setContentSize(layout.dialog.width, layout.dialog.height);
    shield.addChild(panel);
    this.addSprite(panel, 'game/chibi/ui/settings-dialog-panel/spriteFrame',
      layout.dialog.width, layout.dialog.height, 0, 0, token);
    if (animate) this.animateDialogIn(shield, panel);
    this.addIconButton(panel, '关闭每日委托', 'icon-settings-close', layout.close, () => {
      this.animateDialogOut(shield, panel, () => {
        this.flow = closeDailyDialog(this.flow);
        this.render();
      });
    });

    const level = this.dailyCommission.levelId ? getLevelConfig(this.dailyCommission.levelId) : null;
    if (!level) {
      this.addLabel(panel, '每日委托尚未解锁', 25, 0, 76, color('#FFF2CF'), 260);
      this.addLabel(panel, '完成第 5 关后，即可接受每日炼金委托', 14,
        0, 18, color('#DCC7E8'), 276);
      this.addRasterButton(panel, '知道了', 'purple', layout.action.width, layout.action.height,
        layout.action.x, layout.action.y, () => {
          this.animateDialogOut(shield, panel, () => {
            this.flow = closeDailyDialog(this.flow);
            this.render();
          });
        }, false, undefined, 17);
      return;
    }

    this.addLabel(panel, '今日炼金委托', 27, 0, layout.titleY, color('#FFF2CF'), 240);
    const rewardText = this.dailyCommission.completed
      ? this.dailyCommission.rewardClaimed ? '今日奖励已领取' : '体力 +1 待领取'
      : '完成奖励 · 体力 +1';
    this.addLabel(panel, rewardText, 14, 0, layout.rewardY, color('#FFE3A0'), 240);

    const waitingAtFull = this.dailyCommission.completed
      && !this.dailyCommission.rewardClaimed && this.stamina.value >= STAMINA_MAX;
    const actionText = this.dailyCommission.completed
      ? this.dailyCommission.rewardClaimed ? '再次挑战'
        : waitingAtFull ? '体力已满 · 稍后领取' : '领取体力 +1'
      : '开始委托';
    this.addRasterButton(panel, actionText, this.dailyCommission.rewardClaimed ? 'purple' : 'gold',
      layout.action.width, layout.action.height, layout.action.x, layout.action.y, () => {
        if (this.dailyCommission.completed && !this.dailyCommission.rewardClaimed) {
          this.claimDailyCommissionReward();
        } else this.animateDialogOut(shield, panel, () => this.startDailyCommission());
      }, waitingAtFull, undefined, 16);
    this.addLabel(panel, '连续完成 ' + this.dailyCommission.streak + ' 天'
      + (this.dailyMessage ? ' · ' + this.dailyMessage : ''), 11,
      0, layout.noteY, color('#BDAFC4'), 270);
  }

  private reconcileDailyCommission(now = Date.now()): boolean {
    const next = reconcileDailyCommission(this.dailyCommission, now, this.progress.completedThrough);
    if (next === this.dailyCommission) return false;
    this.dailyCommission = next;
    this.store.saveDailyCommission(next);
    return true;
  }

  private startDailyCommission(): void {
    const level = this.dailyCommission.levelId ? getLevelConfig(this.dailyCommission.levelId) : null;
    if (!level) return;
    this.saveActiveSession();
    this.activeDailyCommission = true;
    this.activeEndless = false;
    this.currentLevel = level;
    this.session = createGameSession(level);
    this.flow = enterSelectedLevel(closeDailyDialog(this.flow), level.id, true);
    this.unscheduleAllCallbacks();
    this.completionScheduled = false;
    this.staminaSpentForActiveLevel = false;
    this.completionSaveFailed = false;
    this.completionReward = null;
    this.levelStartedAt = Date.now();
    this.undoCount = 0;
    this.invalid.clear();
    this.pouring.clear();
    this.render();
  }

  private claimDailyCommissionReward(): void {
    const now = Date.now();
    if (this.reconcileDailyCommission(now)) {
      this.dailyMessage = '每日委托已刷新';
      this.render();
      return;
    }
    const currentStamina = reconcileStamina(this.stamina, now);
    if (currentStamina.value >= STAMINA_MAX) {
      this.stamina = currentStamina;
      this.dailyMessage = '体力低于 10 点后可领取';
      this.render();
      return;
    }
    const claimed = claimDailyReward(this.dailyCommission, now);
    if (!claimed || claimed === this.dailyCommission) return;
    const stamina = grantDailyStamina(currentStamina, now);
    this.store.saveStamina(stamina);
    this.store.saveDailyCommission(claimed);
    this.stamina = stamina;
    this.dailyCommission = claimed;
    this.dailyMessage = '体力已领取';
    this.render();
  }

  private renderCollectionPuzzle(
    root: Node,
    collection: CollectionProgress,
    artworkPath: string,
    token: number,
  ): void {
    for (let index = 0; index < collection.totalPieces; index += 1) {
      const piece = collectionPuzzlePiece(index);
      const pieceNode = new Node('CollectionPuzzlePiece-' + (index + 1));
      pieceNode.setPosition(piece.x, piece.y);
      pieceNode.addComponent(UITransform).setContentSize(piece.width, piece.height);
      root.addChild(pieceNode);
      const mask = pieceNode.addComponent(Mask);
      mask.type = Mask.Type.GRAPHICS_STENCIL;
      const graphics = mask.subComp as Graphics;
      graphics.clear();
      graphics.rect(-piece.width / 2, -piece.height / 2, piece.width, piece.height);
      graphics.fill();
      const art = this.addSprite(pieceNode, artworkPath,
        COLLECTION_LAYOUT.puzzle.width, COLLECTION_LAYOUT.puzzle.height,
        piece.artOffsetX, piece.artOffsetY, token);
      if (index >= collection.revealedPieces) {
        art.addComponent(UIOpacity).opacity = 46;
        this.addPanel(pieceNode, piece.width, piece.height, 0, 0, color('#2A1830', 154));
      }
    }
    this.addPanel(root, COLLECTION_LAYOUT.puzzle.width + 4, COLLECTION_LAYOUT.puzzle.height + 4,
      COLLECTION_LAYOUT.puzzle.x, COLLECTION_LAYOUT.puzzle.y, color('#14091F', 0), color('#D9B56D', 0), 5);
  }

  private openCollectionView(): void {
    this.resumeAudio();
    const nextFlow = openCollection(this.flow);
    if (nextFlow === this.flow) return;
    this.store.saveSession(this.session);
    this.collectionScrollOffsetY = 0;
    this.flow = nextFlow;
    this.collectionHasNewPiece = false;
    this.render();
  }

  private closeCollectionView(): void {
    this.resumeAudio();
    const nextFlow = closeCollection(this.flow);
    if (nextFlow === this.flow) return;
    this.flow = nextFlow;
    this.render();
  }

  private closeCollectionDetailView(): void {
    this.resumeAudio();
    const nextFlow = closeCollectionDetail(this.flow);
    if (nextFlow === this.flow) return;
    this.flow = nextFlow;
    this.render();
  }

  private renderLevelComplete(root: Node, token: number): void {
    if (this.activeEndless) {
      this.renderEndlessLevelComplete(root, token);
      return;
    }
    const next = this.activeDailyCommission ? null : nextLevelConfig(this.session.levelId);
    const chapter = chapterForLevel(this.currentLevel.number)!;
    const chapterComplete = !this.activeDailyCommission
      && this.currentLevel.number === chapter.firstLevel + chapter.levelCount - 1;
    const best = this.progress.bestMoves[this.session.levelId] ?? this.session.game.moves;
    const infoLines = this.activeDailyCommission ? [
      '本局 ' + this.session.game.moves + ' 步 · 今日最佳 ' + (this.dailyCommission.bestMoves ?? this.session.game.moves) + ' 步',
      completionOptimalLabel(this.session.game.moves, this.currentLevel.metrics.optimalMoves),
      this.dailyCommission.rewardClaimed ? '奖励已领取 · 体力 +1' : '体力已满 · +1 待领取',
    ] : [
      `本局 ${this.session.game.moves} 步 · 最佳 ${best} 步`,
      completionOptimalLabel(this.session.game.moves, this.currentLevel.metrics.optimalMoves),
      ...this.completionRewardLines(),
    ];
    this.addAlchemyRoomBackground(root, token, color('#0C0614', 166));
    this.addSprite(root, 'game/chibi/ui/settings-dialog-panel/spriteFrame',
      LEVEL_COMPLETE_LAYOUT.panel.width, LEVEL_COMPLETE_LAYOUT.panel.height,
      LEVEL_COMPLETE_LAYOUT.panel.x, LEVEL_COMPLETE_LAYOUT.panel.y, token);
    this.playCompletionRibbons(root);
    this.addLabel(root, this.activeDailyCommission ? '今日委托完成！'
      : chapterComplete ? `${chapterLabel(chapter.id)}完成！` : '炼金完成！', 30,
      LEVEL_COMPLETE_LAYOUT.title.x, LEVEL_COMPLETE_LAYOUT.title.y,
      color('#FFF2CF'), LEVEL_COMPLETE_LAYOUT.title.width);
    this.renderStarRow(root, levelStarRating(
      true,
      this.session.game.moves,
      this.currentLevel.metrics.optimalMoves,
    ), LEVEL_COMPLETE_LAYOUT.starsY, 44, 68);
    infoLines.forEach((line, index) => {
      const info = LEVEL_COMPLETE_LAYOUT.info;
      this.addLabel(root, line, index < 2 ? 15 : 14,
        info.x, completionInfoRowY(index, infoLines.length),
        color(index === 0 ? '#EFD9C9' : '#FFE5A3'), info.width);
    });

    this.addRasterButton(root, '再次挑战', 'purple', LEVEL_COMPLETE_LAYOUT.replayButton.width,
      LEVEL_COMPLETE_LAYOUT.replayButton.height, LEVEL_COMPLETE_LAYOUT.replayButton.x,
      LEVEL_COMPLETE_LAYOUT.replayButton.y, () => {
        if (this.activeDailyCommission) this.startDailyCommission();
        else this.switchLevel(this.currentLevel.id, true);
      }, false, undefined, 14);
    this.addRasterButton(root, '分享战绩', 'purple', LEVEL_COMPLETE_LAYOUT.shareButton.width,
      LEVEL_COMPLETE_LAYOUT.shareButton.height, LEVEL_COMPLETE_LAYOUT.shareButton.x,
      LEVEL_COMPLETE_LAYOUT.shareButton.y, () => this.platform.share({
        title: this.activeDailyCommission
          ? `我完成了今日炼金委托，只用了 ${this.session.game.moves} 步！`
          : `我通过了第 ${this.currentLevel.number} 关，只用了 ${this.session.game.moves} 步！`,
        query: `level=${this.currentLevel.number}`,
      }), false, undefined, 14);
    this.addRasterButton(root,
      this.activeDailyCommission ? '返回主页' : completionPrimaryLabel(this.currentLevel.number, next?.number ?? null),
      'gold', LEVEL_COMPLETE_LAYOUT.primaryButton.width, LEVEL_COMPLETE_LAYOUT.primaryButton.height,
      LEVEL_COMPLETE_LAYOUT.primaryButton.x, LEVEL_COMPLETE_LAYOUT.primaryButton.y, () => {
        if (this.activeDailyCommission) this.returnToHome();
        else if (next) this.switchLevel(next.id);
        else this.openSelector();
      }, false, undefined, 16);
  }

  private renderEndlessLevelComplete(root: Node, token: number): void {
    const run = this.endlessState.run;
    const streak = run?.streak ?? 0;
    const infoLines = [
      `本关 ${this.session.game.moves} 步`,
      `当前连胜 ${streak}`,
      `历史最高 ${this.endlessState.bestStreak}`,
    ];
    this.addAlchemyRoomBackground(root, token, color('#0C0614', 166));
    this.addSprite(root, 'game/chibi/ui/settings-dialog-panel/spriteFrame',
      LEVEL_COMPLETE_LAYOUT.panel.width, LEVEL_COMPLETE_LAYOUT.panel.height,
      LEVEL_COMPLETE_LAYOUT.panel.x, LEVEL_COMPLETE_LAYOUT.panel.y, token);
    this.playCompletionRibbons(root);
    this.addLabel(root, '无尽炼成！', 30,
      LEVEL_COMPLETE_LAYOUT.title.x, LEVEL_COMPLETE_LAYOUT.title.y,
      color('#FFF2CF'), LEVEL_COMPLETE_LAYOUT.title.width);
    infoLines.forEach((line, index) => {
      const info = LEVEL_COMPLETE_LAYOUT.info;
      this.addLabel(root, line, index === 0 ? 16 : 15,
        info.x, completionInfoRowY(index, infoLines.length),
        color(index === 0 ? '#EFD9C9' : '#FFE5A3'), info.width);
    });
    this.addRasterButton(root, '下一关', 'gold',
      LEVEL_COMPLETE_LAYOUT.primaryButton.width, LEVEL_COMPLETE_LAYOUT.primaryButton.height,
      LEVEL_COMPLETE_LAYOUT.primaryButton.x, LEVEL_COMPLETE_LAYOUT.primaryButton.y,
      () => this.continueEndlessStage(), false, undefined, 16);
  }

  private playCompletionRibbons(root: Node): void {
    const completion = `${this.levelStartedAt}:${this.session.levelId}`;
    if (this.celebratedCompletion === completion) return;
    this.celebratedCompletion = completion;
    const burstY = LEVEL_COMPLETE_LAYOUT.title.y + 20;
    const flash = this.addSprite(root, 'game/chibi/effects/completion-burst/spriteFrame',
      78, 78, 0, burstY, this.renderToken);
    flash.setScale(new Vec3(0.12, 0.12, 1));
    const flashOpacity = flash.addComponent(UIOpacity);
    flashOpacity.opacity = 0;
    tween(flash).to(0.28, { scale: new Vec3(1.35, 1.35, 1) }, { easing: 'quadOut' }).start();
    tween(flashOpacity).to(0.08, { opacity: 240 }).to(0.38, { opacity: 0 })
      .call(() => { if (flash.isValid) flash.destroy(); }).start();

    const ribbons = [
      { name: 'gold', sourceWidth: 209, width: 82, x: -12, y: 270, angle: -20, driftX: -14, delay: 0 },
      { name: 'purple', sourceWidth: 171, width: 69, x: -146, y: 212, angle: -65, driftX: -25, delay: 0.04 },
      { name: 'pink', sourceWidth: 171, width: 69, x: 146, y: 210, angle: 65, driftX: 25, delay: 0.08 },
      { name: 'blue', sourceWidth: 209, width: 82, x: 120, y: 90, angle: 105, driftX: 20, delay: 0.12 },
      { name: 'orange', sourceWidth: 180, width: 72, x: -120, y: 92, angle: -105, driftX: -20, delay: 0.16 },
    ] as const;
    ribbons.forEach((ribbon) => {
      const node = this.addSprite(root, `game/chibi/effects/completion-ribbons/${ribbon.name}/spriteFrame`,
        ribbon.width, proportionalHeightForWidth(ribbon.width, ribbon.sourceWidth, 256),
        0, burstY, this.renderToken);
      node.setScale(new Vec3(0.12, 0.12, 1));
      node.angle = ribbon.angle * 0.25;
      const opacity = node.addComponent(UIOpacity);
      opacity.opacity = 0;
      tween(node).delay(ribbon.delay)
        .to(0.18, {
          position: new Vec3(ribbon.x * 0.45, burstY + (ribbon.y - burstY) * 0.45 + 12, 0),
          scale: new Vec3(1.1, 1.1, 1), angle: ribbon.angle * 0.6,
        }, { easing: 'quadOut' })
        .to(0.46, {
          position: new Vec3(ribbon.x, ribbon.y, 0),
          scale: new Vec3(1, 1, 1), angle: ribbon.angle,
        }, { easing: 'sineOut' })
        .to(0.62, {
          position: new Vec3(ribbon.x + ribbon.driftX, ribbon.y - 75, 0),
          scale: new Vec3(0.8, 0.8, 1), angle: ribbon.angle + ribbon.driftX * 0.8,
        }, { easing: 'quadIn' })
        .start();
      tween(opacity).delay(ribbon.delay).to(0.1, { opacity: 255 })
        .delay(0.68).to(0.58, { opacity: 0 })
        .call(() => { if (node.isValid) node.destroy(); }).start();
    });
  }

  private continueEndlessStage(): void {
    const run = this.endlessState.run;
    const level = run ? getLevelConfig(run.levelId) : null;
    const session = restoreEndlessSession(this.endlessState);
    if (!run || !level || !session) return;
    this.currentLevel = level;
    this.session = session;
    this.flow = enterSelectedLevel(this.flow, level.id, true);
    this.unscheduleAllCallbacks();
    this.completionScheduled = false;
    this.completionSaveFailed = false;
    this.levelStartedAt = Date.now();
    this.undoCount = 0;
    this.invalid.clear();
    this.pouring.clear();
    this.render();
  }

  private completionRewardLines(): readonly string[] {
    const reward = this.completionReward;
    if (!reward) return [];
    const chapterId = chapterForLevel(this.currentLevel.number)?.id ?? 1;
    if (reward.collectionCompleted) {
      const lines = [collectionCompleteLabel(chapterId)];
      if (reward.titleChanged) lines.push('晋升 · ' + deriveHighestTitle(this.progress).title);
      return lines;
    }
    return reward.puzzlePiece === null
      ? []
      : [collectionRewardLabel(chapterId, reward.puzzlePiece)];
  }

  private levelButtonState(level: LevelConfig): LevelButtonState {
    if (level.id === this.progress.currentLevel) return 'current';
    if (level.number <= this.progress.completedThrough) return 'completed';
    return isLevelUnlocked(this.progress, level.id) ? 'unlocked' : 'locked';
  }

  private addLevelSelectButton(
    root: Node,
    level: LevelConfig,
    layout: Readonly<{ x: number; y: number; width: number; height: number }>,
    state: LevelButtonState,
    visual: ReturnType<typeof levelButtonVisual>,
    stars: LevelStarRating,
    token: number,
  ): void {
    const node = new Node(`Level-${level.number}`);
    node.setPosition(layout.x, layout.y);
    node.addComponent(UITransform).setContentSize(layout.width, layout.height);
    root.addChild(node);
    this.decorateRasterButton(node, visual.variant, visual.disabled,
      () => this.switchLevel(level.id), buttonBaseLayout(layout, 'contain'));
    if (visual.highlighted) {
      this.addPanel(node, layout.width, layout.height, 0, 0,
        color('#8A4BC4', 8), color('#FFF0A8'), 18);
    }
    this.addLabel(node, String(level.number), 18, 0, 0,
      color(visual.disabled ? '#937D9E' : '#FFF8DF'), layout.width);
    if (stars > 0) this.renderStarRow(node, stars, LEVEL_SELECT_LAYOUT.starY,
      LEVEL_SELECT_LAYOUT.starSize, LEVEL_SELECT_LAYOUT.starGap);
    if (state === 'locked') this.addLabel(node, '·', 14, 0, -17, color('#8D7998'), 20);
    void token;
  }

  private targetPotionCount(level: LevelConfig): number {
    return level.completionRule.type === 'all-colors' ? level.completionRule.targetCount : 1;
  }

  private changeLevelChapter(chapterId: number, unlocked: boolean): void {
    const nextFlow = selectLevelChapter(this.flow, chapterId, unlocked);
    if (nextFlow === this.flow) return;
    this.flow = nextFlow;
    this.refreshLevelSelectChapter();
  }

  private refreshLevelSelectChapter(): void {
    if (!this.surface?.isValid || !this.levelSelectChapterContent?.isValid) return;
    const siblingIndex = this.levelSelectChapterContent.getSiblingIndex();
    this.levelSelectChapterContent.removeFromParent();
    this.levelSelectChapterContent.destroy();
    this.levelSelectChapterContent = new Node('LevelSelectChapterContent');
    this.positionLevelSelectChapterContent(this.levelSelectChapterContent);
    this.surface.addChild(this.levelSelectChapterContent);
    this.levelSelectChapterContent.setSiblingIndex(siblingIndex);
    this.renderLevelSelectChapter(this.levelSelectChapterContent, this.renderToken);
  }

  private openSelector(): void {
    this.completionReward = null;
    this.store.saveSession(this.session);
    this.flow = openLevelSelect(this.flow, chapterForLevel(this.currentLevel.number)?.id ?? 1);
    this.render();
  }

  private returnToHome(): void {
    this.completionReward = null;
    const returningFromAlternative = this.activeDailyCommission || this.activeEndless;
    this.saveActiveSession();
    this.activeDailyCommission = false;
    this.activeEndless = false;
    this.reconcileDailyCommission();
    const current = getLevelConfig(this.progress.currentLevel) ?? FIRST_CHAPTER_LEVELS[0];
    if (returningFromAlternative || current.id !== this.currentLevel.id) {
      this.currentLevel = current;
      this.session = this.store.loadSession(current);
    }
    this.flow = returnHome(this.flow);
    this.render();
  }

  private switchLevel(levelId: string, fresh = false): void {
    const level = getLevelConfig(levelId);
    if (!level || !isLevelUnlocked(this.progress, levelId)) return;
    const reconciled = reconcileStamina(this.stamina, Date.now());
    if (reconciled !== this.stamina) {
      this.stamina = reconciled;
      this.store.saveStamina(this.stamina);
    }
    if (this.stamina.value === 0) {
      this.staminaMessage = '';
      this.flow = openStaminaDialog(this.flow);
      this.render();
      return;
    }
    this.completionReward = null;
    if (fresh) {
      try {
        this.store.clearSession(level.id);
      } catch {
        // The fresh in-memory session still replaces a stale completion snapshot on the next move.
      }
    } else this.saveActiveSession();
    const selected = selectCurrentLevel(this.progress, levelId);
    if (!selected) return;
    if (selected !== this.progress) this.store.saveProgress(selected);
    this.progress = selected;
    this.activeEndless = false;
    this.currentLevel = level;
    this.session = fresh ? createGameSession(level) : this.store.loadSession(level);
    this.flow = enterSelectedLevel(this.flow, levelId, true);
    this.unscheduleAllCallbacks();
    this.completionScheduled = false;
    this.staminaSpentForActiveLevel = false;
    this.completionSaveFailed = false;
    this.levelStartedAt = Date.now();
    this.undoCount = 0;
    this.invalid.clear();
    this.pouring.clear();
    this.render();
  }

  private renderLevel(root: Node, token: number): void {
    this.addAlchemyRoomBackground(root, token, color('#130A20', 16));
    this.renderLevelContent(root, token);
  }

  private renderLevelContent(root: Node, token: number): void {
    this.bottleNodes.clear();
    this.bottleHitTargets.clear();
    this.particleAnimators.clear();
    this.levelMessageLabel = null;
    this.levelMovesLabel = null;
    this.levelPotionProgressLabel = null;
    this.levelWitchAnimator = null;
    const content = new Node('LevelContent');
    root.addChild(content);
    const settingsButton = root.getChildByName('SettingsButton');
    if (settingsButton) content.setSiblingIndex(settingsButton.getSiblingIndex());
    this.levelContent = content;

    const completed = this.session.game.bottles.filter((bottle) => bottle.status === 'vanished').length;
    const endlessRun = this.activeEndless ? this.endlessState.run : null;
    const endlessHud = endlessRun
      ? endlessHudText(endlessRun.stage, endlessRun.streak, endlessRun.allowedMoves - this.session.game.moves)
      : null;
    const levelTitle = this.addLabel(content, endlessHud?.title ?? `第 ${this.currentLevel.number} 关`, 30, -86, 318,
      color('#FFF4DF'), 176, Label.HorizontalAlign.LEFT);
    const levelTitleLabel = levelTitle.getComponent(Label);
    if (levelTitleLabel) {
      levelTitleLabel.overflow = Label.Overflow.SHRINK;
      levelTitleLabel.enableWrapText = false;
      levelTitle.getComponent(UITransform)?.setContentSize(176, 48);
    }
    const movesWidth = endlessHud ? 86 : 54;
    const movesX = endlessHud ? -131 : -147;
    const progressWidth = endlessHud ? 70 : 66;
    const progressX = endlessHud ? -51 : -80;
    this.addPanel(content, movesWidth, 24, movesX, 280, color('#221023', 184), color('#DEB5A1', 70), 12);
    this.levelMovesLabel = this.addLabel(content, endlessHud?.moves ?? `步数 ${this.session.game.moves}`, 11,
      movesX, 280, color('#EFD9C9'), movesWidth - 2).getComponent(Label);
    this.addPanel(content, progressWidth, 24, progressX, 280, color('#221023', 184), color('#DEB5A1', 70), 12);
    this.levelPotionProgressLabel = this.addLabel(content,
      endlessHud?.streak ?? potionProgressLabel(completed, this.targetPotionCount(this.currentLevel)), 11,
      progressX, 280, color('#EFD9C9'), progressWidth - 2).getComponent(Label);
    this.levelWitchAnimator = this.addWitch(content, this.session.witchMood, LEVEL_LAYOUT.witch.x, LEVEL_LAYOUT.witch.y,
      LEVEL_LAYOUT.witch.width, LEVEL_LAYOUT.witch.height);

    this.session.game.bottles.forEach((bottle, index) => {
      if (!shouldRenderBottle(bottle.status)) return;
      const placement = bottlePlacement(this.currentLevel.presentationSeed, index);
      this.addBottle(content, index, placement.x, placement.y, placement.angle, token);
    });
    this.levelMessageLabel = this.addMessage(content, this.session.message, token);
    this.addLevelControls(content);
  }

  private addLevelControls(content: Node): Node {
    const controls = new Node('LevelControls');
    content.addChild(controls);
    if (this.completionSaveFailed) {
      this.addRasterButton(controls, '重试保存', 'gold', 224, 72, 0, LEVEL_LAYOUT.controlY,
        () => this.persistCompletion(), false, undefined, 16);
    } else {
      this.addControlButton(controls, '撤销', 'icon-undo', LEVEL_LAYOUT.controlCenters[0],
        () => { void this.handleUndo(); },
        this.rewardBusy || this.session.levelComplete || this.session.history.length === 0,
        this.session.undoRemaining);
      this.addControlButton(controls, RESTART_LABEL, 'icon-restart', LEVEL_LAYOUT.controlCenters[1],
        () => { void this.handleRestart(); },
        this.rewardBusy || this.session.levelComplete || this.session.game.moves === 0,
        this.session.restartRemaining);
      this.addControlButton(controls, this.session.game.rewardBottleUsed ? '已加瓶' : '加空瓶', 'icon-add-bottle',
        LEVEL_LAYOUT.controlCenters[2], () => { void this.handleRewardedBottle(); },
        this.session.levelComplete || this.session.game.rewardBottleUsed || this.rewardBusy,
        undefined, true);
    }
    return controls;
  }

  private refreshLevelContent(): void {
    if (!this.surface || this.flow.scene !== 'level') return;
    this.levelContent?.destroy();
    this.clearLevelReferences();
    this.renderLevelContent(this.surface, this.renderToken);
  }

  private refreshChangedBottles(indices: readonly number[]): void {
    if (!this.levelContent?.isValid) {
      this.refreshLevelContent();
      return;
    }

    for (const index of indices) {
      const oldTarget = this.bottleHitTargets.get(index);
      const siblingIndex = oldTarget?.getSiblingIndex()
        ?? this.levelMessageLabel?.node.getSiblingIndex()
        ?? this.levelContent.children.length;
      if (oldTarget) {
        Tween.stopAllByTarget(oldTarget);
        oldTarget.removeFromParent();
        oldTarget.destroy();
      }
      this.bottleHitTargets.delete(index);
      this.bottleNodes.delete(index);
      this.particleAnimators.delete(index);

      const bottle = this.session.game.bottles[index];
      if (!bottle || !shouldRenderBottle(bottle.status)) continue;
      const placement = bottlePlacement(this.currentLevel.presentationSeed, index);
      this.addBottle(this.levelContent, index, placement.x, placement.y, placement.angle, this.renderToken);
      const newTarget = this.bottleHitTargets.get(index);
      if (newTarget) newTarget.setSiblingIndex(Math.min(siblingIndex, this.levelContent.children.length - 1));
    }

    const endlessRun = this.activeEndless ? this.endlessState.run : null;
    const endlessHud = endlessRun
      ? endlessHudText(endlessRun.stage, endlessRun.streak, endlessRun.allowedMoves - this.session.game.moves)
      : null;
    if (this.levelMovesLabel?.node.isValid) {
      this.levelMovesLabel.string = endlessHud?.moves ?? `步数 ${this.session.game.moves}`;
    }
    if (this.levelPotionProgressLabel?.node.isValid) {
      const completed = this.session.game.bottles.filter((bottle) => bottle.status === 'vanished').length;
      this.levelPotionProgressLabel.string = endlessHud?.streak
        ?? potionProgressLabel(completed, this.targetPotionCount(this.currentLevel));
    }
    const oldControls = this.levelContent.getChildByName('LevelControls');
    const controlsIndex = oldControls?.getSiblingIndex() ?? this.levelContent.children.length;
    oldControls?.removeFromParent();
    oldControls?.destroy();
    this.addLevelControls(this.levelContent).setSiblingIndex(
      Math.min(controlsIndex, this.levelContent.children.length - 1),
    );
    this.refreshLevelFeedback();
  }

  private refreshLevelFeedback(): void {
    if (!this.levelContent?.isValid || !this.levelMessageLabel?.node.isValid || !this.levelWitchAnimator?.node.isValid) {
      this.refreshLevelContent();
      return;
    }
    this.levelMessageLabel.string = this.session.message;
    const mood = this.session.witchMood;
    this.levelWitchAnimator.play(mood, () => this.handleWitchSettled(mood));
    this.refreshBottleHighlights();
  }

  private addWitch(root: Node, mood: WitchMood, x: number, y: number, width: number, height: number): WitchAnimator {
    const node = new Node('WitchAnimator');
    node.setPosition(x, y);
    node.addComponent(UITransform).setContentSize(width, height);
    root.addChild(node);
    const animator = node.addComponent(WitchAnimator);
    animator.play(mood, () => this.handleWitchSettled(mood));
    return animator;
  }

  private addLaunchWitch(root: Node): void {
    const stage = LAUNCH_LAYOUT.witch;
    const node = new Node('LaunchWitchAnimator');
    node.setPosition(stage.x, stage.y);
    node.addComponent(UITransform).setContentSize(stage.width, stage.height);
    root.addChild(node);
    node.addComponent(WitchAnimator).play('idle', () => undefined);
  }

  private renderLaunchAmbientParticles(root: Node, token: number): void {
    const particles: readonly Readonly<{ x: number; y: number; layer: PotionColor }>[] = [
      { x: -108, y: 72, layer: 'violet' },
      { x: 105, y: 56, layer: 'cyan' },
      { x: -82, y: -55, layer: 'gold' },
      { x: 88, y: -78, layer: 'violet' },
      { x: -126, y: 155, layer: 'cyan' },
      { x: 126, y: 142, layer: 'gold' },
    ];
    particles.forEach((entry, index) => {
      const anchor = new Node(`LaunchParticleAnchor-${index + 1}`);
      anchor.setPosition(entry.x, entry.y);
      root.addChild(anchor);
      const visual = potionParticleVisuals(20260824, index, 0, 'idle')[index % 2];
      this.addPotionParticle(anchor, entry.layer, visual, 'idle', token);
    });
  }

  private handleWitchSettled(mood: WitchMood): void {
    if (this.session.witchMood !== mood) return;
    this.session = mood === 'return' ? finishWitchReturn(this.session) : settleWitch(this.session);
    if (!this.levelMessageLabel?.node.isValid || !this.levelWitchAnimator?.node.isValid) {
      this.refreshLevelContent();
      return;
    }
    const nextMood = this.session.witchMood;
    this.levelMessageLabel.string = this.session.message;
    this.levelWitchAnimator.play(nextMood, () => this.handleWitchSettled(nextMood));
  }

  private addBottle(root: Node, index: number, x: number, y: number, angle: number, token: number): void {
    const bottle = this.session.game.bottles[index];
    if (!bottle) return;
    const hitTarget = new Node(`BottleHitTarget-${index + 1}`);
    hitTarget.setPosition(x, y);
    hitTarget.addComponent(UITransform).setContentSize(64, 112);
    root.addChild(hitTarget);
    this.bottleHitTargets.set(index, hitTarget);

    const selected = this.session.selected === index;
    const feedback = bottleFeedbackVisual(selected, this.pouring.has(index));
    const [pourSource] = Array.from(this.pouring);
    const initialFeedback = index === pourSource
      ? bottleFeedbackVisual(true, false)
      : this.pouring.has(index) ? bottleFeedbackVisual(false, false) : feedback;
    const node = new Node(`BottleVisual-${index + 1}`);
    node.setPosition(0, initialFeedback.yOffset);
    node.angle = angle;
    node.setScale(new Vec3(initialFeedback.scale, initialFeedback.scale, 1));
    node.addComponent(UITransform).setContentSize(LEVEL_LAYOUT.bottle.width, LEVEL_LAYOUT.bottle.height);
    hitTarget.addChild(node);
    this.bottleNodes.set(index, node);

    selectedBottleAuraVisual().forEach((aura, auraIndex) => {
      const selectedAura = this.addSprite(node, 'game/chibi/items/bottle-frame/spriteFrame',
        aura.width, aura.height, 0, 0, token);
      selectedAura.name = `SelectedAura-${auraIndex + 1}`;
      selectedAura.active = feedback.auraVisible;
      const auraSprite = selectedAura.getComponent(Sprite);
      if (auraSprite) auraSprite.color = color('#87D8FF', Math.round(aura.opacity * 255));
      const auraOpacity = selectedAura.addComponent(UIOpacity);
      auraOpacity.opacity = feedback.auraVisible ? 255 : 0;
    });
    const invalidGlow = this.addPanel(node, 56, 112, 0, 0, color('#EA4F62', 20), color('#FF667A'), 22);
    invalidGlow.name = 'InvalidGlow';
    invalidGlow.active = this.invalid.has(index);

    const clip = new Node('PotionMask');
    clip.setPosition(LEVEL_LAYOUT.liquid.x, LEVEL_LAYOUT.liquid.y);
    clip.addComponent(UITransform).setContentSize(LEVEL_LAYOUT.liquid.width, LEVEL_LAYOUT.liquid.height);
    node.addChild(clip);
    const mask = clip.addComponent(Mask);
    mask.type = Mask.Type.GRAPHICS_STENCIL;
    const maskGraphics = mask.subComp as Graphics;
    maskGraphics.clear();
    maskGraphics.roundRect(-LEVEL_LAYOUT.liquid.width / 2, -LEVEL_LAYOUT.liquid.height / 2,
      LEVEL_LAYOUT.liquid.width, LEVEL_LAYOUT.liquid.height, LEVEL_LAYOUT.liquid.radius);
    maskGraphics.fill();

    const layerHeight = LEVEL_LAYOUT.liquid.height / 4;
    const particleState = potionParticleState(
      this.session.pendingCompletion.includes(index),
      this.pouring.has(index),
      selected,
    );
    const animators: PotionParticleAnimator[] = [];
    bottle.layers.forEach((layer, layerIndex) => {
      const layerY = -LEVEL_LAYOUT.liquid.height / 2 + layerHeight / 2 + layerIndex * layerHeight;
      const layerNode = this.addPanel(clip, LEVEL_LAYOUT.liquid.width, layerHeight + 0.5, 0, layerY,
        color(POTION_COLORS[layer]), undefined, 1);
      potionParticleVisuals(this.currentLevel.presentationSeed, index, layerIndex, particleState)
        .forEach((visual) => {
          animators.push(this.addPotionParticle(layerNode, layer, visual, particleState, token));
        });
    });
    this.particleAnimators.set(index, animators);
    this.addSprite(node, 'game/chibi/items/bottle-frame/spriteFrame', LEVEL_LAYOUT.bottle.width, LEVEL_LAYOUT.bottle.height, 0, 0, token);

    if (this.session.pendingCompletion.includes(index)) {
      this.addSprite(node, 'game/chibi/effects/completion-burst/spriteFrame', 78, 78, 0, 4, token);
      tween(hitTarget).to(0.3, { scale: new Vec3(1.12, 1.12, 1) })
        .to(0.78, { position: new Vec3(x > 0 ? 96 : -96, 330, 0), scale: new Vec3(0.08, 0.08, 1) }).start();
    }

    hitTarget.addComponent(Button);
    hitTarget.on(Button.EventType.CLICK, () => this.handleBottle(index));
  }

  private addPotionParticle(
    root: Node,
    layer: PotionColor,
    visual: PotionParticleVisual,
    state: PotionParticleState,
    token: number,
  ): PotionParticleAnimator {
    const particle = this.addSprite(root,
      `game/chibi/effects/particle-${layer}-${this.particleSuffix(layer)}/spriteFrame`,
      visual.size, visual.size, visual.x, visual.y, token);
    const sprite = particle.getComponent(Sprite) as Sprite;
    const animator = particle.addComponent(PotionParticleAnimator);
    animator.configure(visual, state, sprite);
    return animator;
  }

  private particleSuffix(layer: PotionColor): string {
    return { rose: 'heart', violet: 'star', amber: 'spark', cyan: 'bubble',
      mint: 'leaf', blue: 'snow', gold: 'dust', lilac: 'moon',
      scarlet: 'flame', chartreuse: 'rune', indigo: 'comet', pearl: 'diamond' }[layer];
  }

  private handleBottle(index: number): void {
    this.resumeAudio();
    if (this.activeEndless && this.endlessState.run?.failed) return;
    this.applySessionResult(pressBottle(this.session, index));
  }

  private async handleUndo(): Promise<void> {
    this.resumeAudio();
    if (this.session.undoRemaining <= 0) {
      await this.handleAllowanceReward('undo');
      return;
    }
    this.performUndo();
  }

  private performUndo(): boolean {
    const result = undoSession(this.session);
    if (result.cue === 'undo') this.undoCount += 1;
    this.applySessionResult(result);
    return result.cue === 'undo';
  }

  private async handleRestart(): Promise<void> {
    this.resumeAudio();
    if (this.session.restartRemaining <= 0) {
      await this.handleAllowanceReward('restart');
      return;
    }
    this.performRestart();
  }

  private performRestart(): boolean {
    this.unscheduleAllCallbacks();
    this.completionScheduled = false;
    this.invalid.clear();
    this.pouring.clear();
    const result = restartSession(this.session);
    this.applySessionResult(result);
    return result.cue === 'restart';
  }

  private async handleAllowanceReward(action: 'undo' | 'restart'): Promise<void> {
    if (!this.staminaRewarded || this.rewardBusy || this.session.levelComplete) return;
    this.rewardBusy = true;
    this.session = { ...this.session, message: '正在准备激励广告…', witchMood: 'idle' };
    this.refreshLevelContent();
    const status = await this.staminaRewarded.run(this.platform.isOnline());
    this.rewardBusy = false;
    if (status === 'completed') {
      this.session = action === 'undo'
        ? refillUndoAllowance(this.session)
        : refillRestartAllowance(this.session);
      const applied = action === 'undo' ? this.performUndo() : this.performRestart();
      if (!applied) {
        this.saveActiveSession();
        this.refreshLevelContent();
      }
      return;
    }
    this.session = {
      ...this.session,
      message: this.allowanceRewardFailureMessage(status, action),
      witchMood: 'oops',
    };
    this.refreshLevelContent();
  }

  private allowanceRewardFailureMessage(status: RewardedStaminaStatus, action: 'undo' | 'restart'): string {
    const label = action === 'undo' ? '撤销' : '重来';
    if (status === 'offline') return `当前离线，无法恢复${label}次数`;
    if (status === 'cancelled') return `完整观看广告后才能恢复${label}次数`;
    if (status === 'busy') return '奖励正在处理中';
    if (this.platform.isWeChat() && REWARDED_AD_CONFIG.mode === 'wechat' && !REWARDED_AD_CONFIG.adUnitId) {
      return '请先配置微信激励广告位';
    }
    return '广告暂不可用，请稍后重试';
  }

  private async handleRewardedBottle(): Promise<void> {
    this.resumeAudio();
    if (this.rewardBusy || this.session.levelComplete || this.session.game.rewardBottleUsed) return;
    if (!this.rewarded) return;
    this.rewardBusy = true;
    this.session = { ...this.session, message: '正在准备激励广告…', witchMood: 'idle' };
    this.render();
    const claimId = `${this.session.levelId}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
    const result = await this.rewarded.run(this.session.levelId, claimId, this.platform.isOnline());
    this.rewardBusy = false;
    if (result.activateBottle) {
      this.applySessionResult(grantRewardBottle(this.session));
      return;
    }
    this.session = { ...this.session, message: this.rewardFailureMessage(result.status), witchMood: 'oops' };
    this.render();
  }

  private rewardFailureMessage(status: RewardFlowStatus): string {
    if (status === 'offline') return '当前离线，无法领取广告奖励';
    if (status === 'cancelled') return '完整观看广告后才能领取空瓶';
    if (status === 'busy') return '奖励正在处理中';
    if (this.platform.isWeChat()) {
      return REWARDED_AD_CONFIG.mode === 'wechat' && !REWARDED_AD_CONFIG.adUnitId
        ? '请先配置微信激励广告位'
        : '奖励校验失败，请稍后重试';
    }
    return '广告暂不可用，请稍后重试';
  }

  private applySessionResult(result: SessionResult): void {
    if (result.session === this.session && !result.cue) return;
    const previousSession = this.session;
    this.session = result.session;
    if (result.cue) {
      this.invalid = new Set(result.invalid);
      this.pouring = new Set(result.pouring);
    }
    this.audio?.play(result.cue);
    if (this.session.pendingCompletion.length === 0 && !this.session.levelComplete) {
      this.saveActiveSession();
    }
    const refreshMode = levelInteractionRefreshMode(previousSession.game, this.session.game);
    if (refreshMode.mode === 'bottles') this.refreshChangedBottles(refreshMode.indices);
    else this.refreshLevelFeedback();
    const endlessRun = this.activeEndless ? this.endlessState.run : null;
    if (endlessRun && evaluateEndlessSession(this.session, endlessRun.allowedMoves) === 'failed') {
      this.failActiveEndless();
      return;
    }
    if (this.invalid.size > 0) this.scheduleOnce(() => { this.invalid.clear(); this.refreshBottleHighlights(); }, 0.52);
    if (this.pouring.size > 0) this.scheduleOnce(() => { this.pouring.clear(); this.refreshBottleHighlights(); }, 0.52);
    if (this.session.levelComplete && this.session.pendingCompletion.length === 0 && !this.completionScheduled) {
      this.completionScheduled = true;
      this.scheduleOnce(() => {
        this.completionScheduled = false;
        this.persistCompletion();
      }, 0.65);
    }
    if (this.session.pendingCompletion.length > 0 && !this.completionScheduled) {
      this.completionScheduled = true;
      this.scheduleOnce(() => this.audio?.play('potion-vanish'), 0.3);
      this.scheduleOnce(() => {
        const previousGame = this.session.game;
        this.session = completePendingBottles(this.session);
        this.completionScheduled = false;
        if (this.session.levelComplete) this.persistCompletion();
        else {
          const refreshMode = levelInteractionRefreshMode(previousGame, this.session.game);
          if (refreshMode.mode === 'bottles') this.refreshChangedBottles(refreshMode.indices);
          else this.refreshLevelFeedback();
          this.saveActiveSession();
          const endlessRun = this.activeEndless ? this.endlessState.run : null;
          if (endlessRun && evaluateEndlessSession(this.session, endlessRun.allowedMoves) === 'failed') {
            this.failActiveEndless();
          }
        }
      }, 1.08);
    }
  }

  private persistCompletion(): void {
    if (this.activeEndless) {
      this.persistEndlessCompletion();
      return;
    }
    if (this.activeDailyCommission) {
      this.persistDailyCommissionCompletion();
      return;
    }
    const previousProgress = this.progress;
    const nextProgress = completeLevel(
      this.progress,
      this.session.levelId,
      this.session.game.moves,
    );
    if (!nextProgress) {
      this.completionSaveFailed = true;
      this.session = { ...this.session, message: '进度保存失败，请重试', witchMood: 'oops' };
      this.render();
      return;
    }

    try {
      this.store.saveProgress(nextProgress);
      if (!this.staminaSpentForActiveLevel) {
        this.staminaSpentForActiveLevel = this.consumeOneStamina();
      }
    } catch {
      this.completionSaveFailed = true;
      this.session = { ...this.session, message: '进度保存失败，请重试', witchMood: 'oops' };
      this.render();
      return;
    }
    this.completionReward = deriveCompletionReward(
      previousProgress,
      nextProgress,
      this.session.levelId,
    );
    if (this.completionReward.puzzlePiece !== null) this.collectionHasNewPiece = true;
    try {
      this.store.clearSession(this.session.levelId);
    } catch {
      // Progress and stamina are already durable; a stale snapshot must not make the charge retryable.
    }
    this.progress = nextProgress;
    this.completionSaveFailed = false;
    this.flow = showLevelComplete(this.flow, nextLevelConfig(this.session.levelId)?.id ?? null);
    this.render();
    void this.syncAfterCompletion();
  }

  private persistEndlessCompletion(): void {
    const next = completeEndlessStage(this.endlessState);
    if (next === this.endlessState) return;
    try {
      this.store.saveEndlessState(next);
    } catch {
      this.completionSaveFailed = true;
      this.session = { ...this.session, message: '无尽进度保存失败，请重试', witchMood: 'oops' };
      this.render();
      return;
    }
    this.endlessState = next;
    this.completionSaveFailed = false;
    this.flow = showLevelComplete(this.flow, next.run?.levelId ?? null);
    this.render();
  }

  private failActiveEndless(): void {
    if (!this.activeEndless || !this.endlessState.run) return;
    const failed = failEndlessRun(saveEndlessSession(this.endlessState, this.session));
    try {
      this.store.saveEndlessState(failed);
    } catch {
      this.session = { ...this.session, message: '失败状态保存失败，请重试', witchMood: 'oops' };
      this.render();
      return;
    }
    this.endlessState = failed;
    this.flow = openEndlessFailureDialog(this.flow);
    this.unscheduleAllCallbacks();
    this.completionScheduled = false;
    this.render();
  }

  private persistDailyCommissionCompletion(): void {
    const now = Date.now();
    if (this.reconcileDailyCommission(now)) {
      this.dailyMessage = '昨日委托已过期，已刷新今日委托';
      this.returnToHome();
      return;
    }
    const nextProgress = recordBestMoves(this.progress, this.session.levelId, this.session.game.moves);
    const completed = completeDailyCommission(this.dailyCommission, this.session.game.moves);
    if (!nextProgress || !completed) {
      this.completionSaveFailed = true;
      this.session = { ...this.session, message: '委托保存失败，请重试', witchMood: 'oops' };
      this.render();
      return;
    }

    let nextDaily = completed;
    let nextStamina = reconcileStamina(this.stamina, now);
    try {
      if (nextProgress !== this.progress) this.store.saveProgress(nextProgress);
      this.store.saveDailyCommission(nextDaily);
      if (!nextDaily.rewardClaimed && nextStamina.value < STAMINA_MAX) {
        nextStamina = grantDailyStamina(nextStamina, now);
        nextDaily = claimDailyReward(nextDaily, now)!;
        this.store.saveStamina(nextStamina);
        this.store.saveDailyCommission(nextDaily);
      }
    } catch {
      this.completionSaveFailed = true;
      this.session = { ...this.session, message: '委托保存失败，请重试', witchMood: 'oops' };
      this.render();
      return;
    }

    this.progress = nextProgress;
    this.dailyCommission = nextDaily;
    this.stamina = nextStamina;
    this.completionSaveFailed = false;
    this.flow = showLevelComplete(this.flow, null);
    this.render();
    void this.syncCloudProgress();
  }

  private async syncCloudProgress(): Promise<void> {
    if (this.store.isQaMode() || !this.progressSync) return;
    const result = await this.progressSync.sync(this.progress, this.platform.isOnline());
    if (result.status !== 'synced') return;
    this.progress = applyProgressSyncResult(this.progress, result);
    try {
      this.store.saveProgress(this.progress);
    } catch {
      // Local progress remains authoritative when a background cloud merge cannot be cached.
    }
  }

  private async syncAfterCompletion(): Promise<void> {
    if (this.store.isQaMode() || !this.progressSync) return;
    const durationMs = Math.max(1, Math.min(86_400_000, Date.now() - this.levelStartedAt));
    await Promise.all([
      this.syncCloudProgress(),
      this.progressSync.submitLevelResult({
        levelId: this.session.levelId,
        moves: this.session.game.moves,
        durationMs,
        undoCount: this.undoCount,
        rewardedBottleUsed: this.session.game.rewardBottleUsed,
      }, this.platform.isOnline()),
    ]);
  }

  private applyQaProgress(progress: PlayerProgress): void {
    this.progress = progress;
    this.currentLevel = getLevelConfig(progress.currentLevel) ?? FIRST_CHAPTER_LEVELS[0];
    this.session = this.store.loadSession(this.currentLevel);
    this.flow = returnHome({
      ...this.flow,
      selectedLevelId: this.currentLevel.id,
      selectedLevelChapterId: chapterForLevel(this.currentLevel.number)?.id ?? 1,
    });
    this.unscheduleAllCallbacks();
    this.completionScheduled = false;
    this.completionSaveFailed = false;
    this.completionReward = null;
    this.collectionHasNewPiece = false;
    this.levelStartedAt = Date.now();
    this.undoCount = 0;
    this.invalid.clear();
    this.pouring.clear();
    this.render();
  }

  private refreshBottleHighlights(): void {
    for (const [index, node] of this.bottleNodes) {
      const selected = this.session.selected === index;
      const feedback = bottleFeedbackVisual(selected, this.pouring.has(index));
      const placement = bottlePlacement(this.currentLevel.presentationSeed, index);
      const [pourSource, pourTarget] = Array.from(this.pouring);
      for (const selectedAura of node.children.filter((child) => child.name.startsWith('SelectedAura-'))) {
        selectedAura.active = true;
        const auraOpacity = selectedAura.getComponent(UIOpacity);
        if (!auraOpacity) continue;
        Tween.stopAllByTarget(auraOpacity);
        tween(auraOpacity).to(0.18, { opacity: feedback.auraVisible ? 255 : 0 }).call(() => {
          if (!feedback.auraVisible && auraOpacity.opacity === 0) selectedAura.active = false;
        }).start();
      }
      const invalidGlow = node.getChildByName('InvalidGlow');
      if (invalidGlow) invalidGlow.active = this.invalid.has(index);
      Tween.stopAllByTarget(node);
      if (index === pourSource && pourTarget !== undefined) {
        const lifted = bottleFeedbackVisual(true, false);
        tween(node)
          .to(0.18, {
            position: new Vec3(0, lifted.yOffset, 0),
            scale: new Vec3(feedback.scale, feedback.scale, 1),
            angle: bottlePourAngle(placement.angle, pourSource, pourTarget),
          }, { easing: 'quadOut' })
          .start();
      } else {
        tween(node).to(0.18, {
          position: new Vec3(0, feedback.yOffset, 0),
          scale: new Vec3(feedback.scale, feedback.scale, 1),
          angle: placement.angle,
        }, { easing: 'sineInOut' }).call(() => this.startSelectedBottleSway(index, node, placement.angle)).start();
      }
      const particleState = potionParticleState(
        this.session.pendingCompletion.includes(index),
        this.pouring.has(index),
        selected,
      );
      for (const animator of this.particleAnimators.get(index) ?? []) {
        animator.setState(particleState);
      }
    }
  }

  private renderStaminaBar(root: Node, token: number): void {
    const layout = STAMINA_LAYOUT.homeBar;
    const barY = staminaBarYForMenu(this.visibleViewportSize().height, this.platform.menuButtonCenterRatio());
    const showAdd = this.stamina.value < STAMINA_MAX;
    const addWidth = showAdd ? layout.gap + layout.addSize + layout.addTrailingPadding : 0;
    const barWidth = layout.width + addWidth;
    const barX = layout.x + addWidth / 2;
    const bar = this.addSprite(root, 'game/chibi/ui/stamina-bar-background/spriteFrame',
      barWidth, layout.height, barX, barY, token);
    bar.name = 'StaminaBar';
    this.homeStaminaBar = bar;
    bar.addComponent(Button);
    this.bindUiClick(bar, () => {
      this.resumeAudio();
      this.staminaMessage = '';
      this.flow = openStaminaDialog(this.flow);
      this.render();
    });
    const content = staminaBarContentLayout();
    const contentRoot = new Node('StaminaContent');
    contentRoot.setPosition(-addWidth / 2, 0);
    contentRoot.addComponent(UITransform).setContentSize(content.width + addWidth, content.height);
    bar.addChild(contentRoot);
    this.renderStaminaIcon(bar, 0,
      -barWidth / 2 + layout.iconCenterFromLeft * barWidth
        / (layout.width + layout.gap + layout.addSize + layout.addTrailingPadding),
      0, content.icon.width, token);
    this.homeStaminaValueLabel = this.addLabel(contentRoot, '', 13,
      content.value.x + content.value.width / 2, content.value.y, color('#FFF0C2'), content.value.width)
      .getComponent(Label);
    this.homeStaminaValueLabel.overflow = Label.Overflow.SHRINK;
    this.homeStaminaValueLabel.enableWrapText = false;
    this.homeStaminaValueLabel.node.getComponent(UITransform)?.setContentSize(content.value.width, content.height);
    this.homeStaminaCountdownLabel = this.addLabel(contentRoot, '', 9,
      content.status.x + content.status.width / 2, content.status.y, color('#D9C3E2'), content.status.width)
      .getComponent(Label);
    this.homeStaminaCountdownLabel.overflow = Label.Overflow.SHRINK;
    this.homeStaminaCountdownLabel.enableWrapText = false;
    this.homeStaminaCountdownLabel.node.getComponent(UITransform)?.setContentSize(content.status.width, content.height);
    if (showAdd) {
      this.addSprite(contentRoot, 'game/chibi/ui/badge-plus/spriteFrame', layout.addSize, layout.addSize,
        content.status.x + content.status.width + layout.gap + layout.addSize / 2, 0, token);
    }
    this.refreshStaminaLabels();
  }

  private refreshHomeStaminaBar(): void {
    const bar = this.homeStaminaBar;
    if (!bar?.isValid || !this.surface?.isValid) return;
    const siblingIndex = bar.getSiblingIndex();
    bar.removeFromParent();
    bar.destroy();
    this.homeStaminaBar = null;
    this.homeStaminaValueLabel = null;
    this.homeStaminaCountdownLabel = null;
    this.renderStaminaBar(this.surface, this.renderToken);
    this.homeStaminaBar?.setSiblingIndex(siblingIndex);
  }

  private staminaRecoveryText(now: number): string {
    return this.stamina.value >= STAMINA_MAX
      ? '体力已满'
      : `恢复 ${formatRecoveryCountdown(nextRecoveryMs(this.stamina, now))}`;
  }

  private refreshStaminaLabels(): void {
    const value = `${this.stamina.value}/${STAMINA_MAX}`;
    const countdown = this.staminaRecoveryText(Date.now());
    if (this.homeStaminaValueLabel?.node.isValid) this.homeStaminaValueLabel.string = value;
    if (this.homeStaminaCountdownLabel?.node.isValid) this.homeStaminaCountdownLabel.string = countdown;
    if (this.staminaDialogValueLabel?.node.isValid) this.staminaDialogValueLabel.string = value;
    if (this.staminaDialogCountdownLabel?.node.isValid) this.staminaDialogCountdownLabel.string = countdown;
  }

  private renderStaminaDialog(root: Node, token: number, animate: boolean): void {
    const shield = new Node('StaminaDialogShield');
    const viewport = this.visibleViewportSize();
    shield.addComponent(UITransform).setContentSize(viewport.width, viewport.height);
    shield.addComponent(BlockInputEvents);
    root.addChild(shield);
    this.addPanel(shield, viewport.width, viewport.height, 0, 0, color('#090411', 184));
    const panel = new Node('StaminaDialog');
    panel.setPosition(STAMINA_LAYOUT.dialog.x, STAMINA_LAYOUT.dialog.y);
    panel.addComponent(UITransform).setContentSize(STAMINA_LAYOUT.dialog.width, STAMINA_LAYOUT.dialog.height);
    shield.addChild(panel);
    this.addSprite(panel, 'game/chibi/ui/settings-dialog-panel/spriteFrame',
      STAMINA_LAYOUT.dialog.width, STAMINA_LAYOUT.dialog.height, 0, 0, token);
    if (animate) this.animateDialogIn(shield, panel);
    const rows = STAMINA_LAYOUT.dialogRows;
    this.addLabel(panel, '体力补给', 27, 0, rows.title, color('#FFF2CF'), 220);
    this.addIconButton(panel, '关闭体力补给', 'icon-settings-close', STAMINA_LAYOUT.close, () => {
      this.animateDialogOut(shield, panel, () => {
        this.flow = closeStaminaDialog(this.flow);
        this.render();
      });
    });
    this.renderStaminaIcon(panel, 0, 0, rows.icon, 64, token);
    this.staminaDialogValueLabel = this.addLabel(panel, '', 24, 0, rows.value, color('#FFF0C2'), 150)
      .getComponent(Label);
    this.staminaDialogCountdownLabel = this.addLabel(panel, '', 13, 0, rows.status, color('#DCC7E8'), 220)
      .getComponent(Label);
    this.addLabel(panel, '每 30 分钟恢复 1 点 · 上限 10 点', 11, 0, rows.note, color('#BDAFC4'), 250);
    const adButton = this.addRasterButton(panel, '看广告 · 恢复 5 点', 'gold',
      STAMINA_LAYOUT.adButton.width, STAMINA_LAYOUT.adButton.height,
      STAMINA_LAYOUT.adButton.x, STAMINA_LAYOUT.adButton.y,
      () => { void this.handleRewardedStamina(); }, this.rewardBusy, undefined, 16);
    this.renderStaminaIcon(adButton, 1, -92, 0, 34, token);
    if (this.staminaMessage) this.addLabel(panel, this.staminaMessage, 11, 0, rows.message, color('#FFE3A0'), 270);
    this.refreshStaminaLabels();
  }

  private async handleRewardedStamina(): Promise<void> {
    this.resumeAudio();
    if (this.rewardBusy || !this.staminaRewarded) return;
    this.rewardBusy = true;
    this.staminaMessage = '正在准备激励广告…';
    this.render();
    const result = await this.staminaRewarded.run(this.platform.isOnline());
    this.rewardBusy = false;
    if (result === 'completed') {
      this.stamina = grantAdStamina(this.stamina, Date.now());
      this.store.saveStamina(this.stamina);
      this.staminaMessage = '体力已恢复';
    } else this.staminaMessage = this.rewardFailureMessage(result);
    this.render();
  }

  private renderEndlessDialog(root: Node, token: number, animate: boolean): void {
    const mode = this.flow.endlessDialog;
    if (!mode) return;
    const layout = STAMINA_LAYOUT.exitDialog;
    const shield = new Node('EndlessDialogShield');
    const viewport = this.visibleViewportSize();
    shield.addComponent(UITransform).setContentSize(viewport.width, viewport.height);
    shield.addComponent(BlockInputEvents);
    root.addChild(shield);
    this.addPanel(shield, viewport.width, viewport.height, 0, 0, color('#090411', 184));
    const panel = new Node('EndlessDialog');
    panel.setPosition(layout.x, layout.y);
    panel.addComponent(UITransform).setContentSize(layout.width, layout.height);
    shield.addChild(panel);
    this.addSprite(panel, 'game/chibi/ui/settings-dialog-panel/spriteFrame',
      layout.width, layout.height, 0, 0, token);
    if (animate) this.animateDialogIn(shield, panel);

    if (mode === 'locked') {
      this.addLabel(panel, '无尽模式尚未解锁', 24, 0, 72, color('#FFF2CF'), 260);
      this.addLabel(panel, '完成第 5 关后即可开始挑战', 14, 0, 20, color('#DCC7E8'), 250);
      this.addRasterButton(panel, '知道了', 'purple', 224, 64, 0, -76, () => {
        this.animateDialogOut(shield, panel, () => {
          this.flow = closeEndlessDialog(this.flow);
          this.render();
        });
      }, false, undefined, 16);
      return;
    }

    if (mode === 'end-confirm') {
      this.addLabel(panel, '结束本轮挑战？', 25, 0, 88, color('#FFF2CF'), 250);
      this.addLabel(panel, '返回主页后，本轮将从无尽第 1 关重新开始', 14,
        0, 34, color('#FFE3A0'), 270);
      this.addLabel(panel, '历史最高连胜会保留', 12, 0, 4, color('#DCC7E8'), 240);
      this.addRasterButton(panel, '结束并返回', 'gold', 224, 64, 0, -58,
        () => this.animateDialogOut(shield, panel, () => this.abandonEndlessRun()),
        false, 'icon-settings-home', 16);
      this.addRasterButton(panel, '继续挑战', 'purple', 224, 56, 0, -126, () => {
        this.animateDialogOut(shield, panel, () => {
          this.flow = restoreEndlessFailureDialog(this.flow);
          this.render();
        });
      }, false, undefined, 15);
      return;
    }

    const run = this.endlessState.run;
    const canRetry = Boolean(run && !run.reviveUsed);
    this.addLabel(panel, '无尽挑战失败', 27, 0, 112, color('#FFF2CF'), 250);
    this.addLabel(panel, '当前连胜 ' + (run?.streak ?? 0) + ' · 历史最高 ' + this.endlessState.bestStreak,
      14, 0, 70, color('#FFE3A0'), 270);
    this.addLabel(panel, canRetry ? '观看广告可从本关初始棋盘重新挑战' : '本关广告重试机会已使用',
      12, 0, 34, color('#DCC7E8'), 270);
    if (this.endlessMessage) this.addLabel(panel, this.endlessMessage, 11, 0, 4, color('#FFE3A0'), 270);
    if (canRetry) {
      const retryButton = this.addRasterButton(panel, '看广告 · 再次挑战', 'gold', 240, 64, 0, -56,
        () => { void this.handleEndlessRetry(); }, this.rewardBusy, undefined, 15);
      this.renderStaminaIcon(retryButton, 1, -92, 0, 34, token);
    }
    this.addRasterButton(panel, '返回主页', 'purple', 224, 56, 0, canRetry ? -126 : -92, () => {
      this.flow = openEndlessEndConfirm(this.flow);
      this.render();
    }, false, 'icon-settings-home', 15);
  }

  private async handleEndlessRetry(): Promise<void> {
    const run = this.endlessState.run;
    if (this.rewardBusy || !this.staminaRewarded || !run?.failed || run.reviveUsed) return;
    this.rewardBusy = true;
    this.endlessMessage = '正在准备激励广告…';
    this.render();
    const result = await this.staminaRewarded.run(this.platform.isOnline());
    this.rewardBusy = false;
    if (result !== 'completed') {
      this.endlessMessage = this.rewardFailureMessage(result);
      this.render();
      return;
    }
    const retried = retryEndlessStage(this.endlessState);
    if (retried === this.endlessState) return;
    try {
      this.store.saveEndlessState(retried);
    } catch {
      this.endlessMessage = '重试状态保存失败，请稍后再试';
      this.render();
      return;
    }
    this.endlessState = retried;
    this.endlessMessage = '';
    this.continueEndlessStage();
  }

  private abandonEndlessRun(): void {
    const ended = endEndlessRun(this.endlessState);
    try {
      this.store.saveEndlessState(ended);
    } catch {
      this.endlessMessage = '状态保存失败，请稍后再试';
      this.flow = restoreEndlessFailureDialog(this.flow);
      this.render();
      return;
    }
    this.endlessState = ended;
    this.activeEndless = false;
    this.currentLevel = getLevelConfig(this.progress.currentLevel) ?? FIRST_CHAPTER_LEVELS[0];
    this.session = this.store.loadSession(this.currentLevel);
    this.flow = returnHome(this.flow);
    this.render();
  }

  private renderExitConfirm(root: Node, token: number, animate: boolean): void {
    const shield = new Node('ExitConfirmShield');
    const viewport = this.visibleViewportSize();
    shield.addComponent(UITransform).setContentSize(viewport.width, viewport.height);
    shield.addComponent(BlockInputEvents);
    root.addChild(shield);
    this.addPanel(shield, viewport.width, viewport.height, 0, 0, color('#090411', 184));
    const panel = new Node('ExitConfirmDialog');
    panel.setPosition(STAMINA_LAYOUT.exitDialog.x, STAMINA_LAYOUT.exitDialog.y);
    panel.addComponent(UITransform).setContentSize(STAMINA_LAYOUT.exitDialog.width, STAMINA_LAYOUT.exitDialog.height);
    shield.addChild(panel);
    this.addSprite(panel, 'game/chibi/ui/settings-dialog-panel/spriteFrame',
      STAMINA_LAYOUT.exitDialog.width, STAMINA_LAYOUT.exitDialog.height, 0, 0, token);
    if (animate) this.animateDialogIn(shield, panel);
    this.addLabel(panel, '返回主页？', 25, 0, 88, color('#FFF2CF'), 240);
    this.addLabel(panel, this.activeDailyCommission ? '每日委托不会消耗体力'
      : this.activeEndless ? '无尽挑战不会消耗体力' : '返回主页将消耗 1 点体力',
      15, 0, 34, color('#FFE3A0'), 260);
    this.addLabel(panel, this.activeDailyCommission ? '本次委托进度不会保留'
      : this.activeEndless ? '当前挑战进度会保留' : '当前关卡进度会保留',
      11, 0, 5, color('#DCC7E8'), 240);
    this.addRasterButton(panel, '确认返回', 'gold', STAMINA_LAYOUT.exitConfirm.width,
      STAMINA_LAYOUT.exitConfirm.height, STAMINA_LAYOUT.exitConfirm.x, STAMINA_LAYOUT.exitConfirm.y,
      () => this.animateDialogOut(shield, panel, () => this.confirmLevelExit()), false, 'icon-settings-home', 16);
    this.addRasterButton(panel, '继续炼金', 'purple', STAMINA_LAYOUT.exitCancel.width,
      STAMINA_LAYOUT.exitCancel.height, STAMINA_LAYOUT.exitCancel.x, STAMINA_LAYOUT.exitCancel.y, () => {
      this.animateDialogOut(shield, panel, () => {
        this.flow = closeExitConfirm(this.flow);
        this.render();
      });
    }, false, undefined, 15);
  }

  private confirmLevelExit(): void {
    if (this.completionScheduled || this.session.pendingCompletion.length > 0 || this.session.levelComplete) return;
    this.unscheduleAllCallbacks();
    if (this.activeDailyCommission || this.activeEndless) {
      this.returnToHome();
      return;
    }
    this.saveActiveSession();
    if (!this.staminaSpentForActiveLevel) {
      this.staminaSpentForActiveLevel = this.consumeOneStamina();
    }
    this.completionReward = null;
    this.flow = returnHome(this.flow);
    this.render();
  }

  private saveActiveSession(): void {
    if (this.activeEndless) {
      this.endlessState = saveEndlessSession(this.endlessState, this.session);
      this.store.saveEndlessState(this.endlessState);
    } else if (!this.activeDailyCommission) this.store.saveSession(this.session);
  }

  private consumeOneStamina(): boolean {
    const next = spendStamina(this.stamina, Date.now());
    if (!next) return false;
    this.store.saveStamina(next);
    this.stamina = next;
    return true;
  }

  private renderStaminaIcon(root: Node, index: 0 | 1, x: number, y: number, size: number, token: number): void {
    const clip = new Node(index === 0 ? 'StaminaHeartIcon' : 'StaminaRewardIcon');
    clip.setPosition(x, y);
    clip.addComponent(UITransform).setContentSize(size, size);
    clip.addComponent(Mask).type = Mask.Type.RECT;
    root.addChild(clip);
    this.addSprite(clip, 'game/chibi/ui/stamina-icons/spriteFrame',
      size * 2, size, (0.5 - index) * size, 0, token);
  }

  private renderSettingsButton(root: Node, token: number): void {
    const isHome = this.flow.scene === 'home';
    const layout = isHome ? HOME_LAYOUT.settingsButton : SETTINGS_LAYOUT.trigger;
    const y = isHome ? layout.y
      : staminaBarYForMenu(this.visibleViewportSize().height, this.platform.menuButtonCenterRatio());
    const button = new Node('SettingsButton');
    button.setPosition(layout.x, y);
    button.addComponent(UITransform).setContentSize(layout.width, layout.height);
    root.addChild(button);
    this.addSprite(button, 'game/chibi/ui/icon-settings-gear/spriteFrame', 48, 48, 0, 0, token);
    button.addComponent(Button);
    this.bindUiClick(button, () => { this.flow = toggleSettings(this.flow); this.render(); });
  }

  private renderSettings(root: Node, token: number, animate: boolean): void {
    const shield = new Node('SettingsShield');
    const viewport = this.visibleViewportSize();
    shield.addComponent(UITransform).setContentSize(viewport.width, viewport.height);
    shield.addComponent(BlockInputEvents);
    root.addChild(shield);
    this.addPanel(shield, viewport.width, viewport.height, 0, 0, color('#090411', 184));
    const panel = new Node('SettingsPanel');
    panel.setPosition(SETTINGS_LAYOUT.dialog.x, SETTINGS_LAYOUT.dialog.y);
    panel.addComponent(UITransform).setContentSize(SETTINGS_LAYOUT.dialog.width, SETTINGS_LAYOUT.dialog.height);
    shield.addChild(panel);
    this.addSprite(panel, 'game/chibi/ui/settings-dialog-panel/spriteFrame', SETTINGS_LAYOUT.dialog.width,
      SETTINGS_LAYOUT.dialog.height, 0, 0, token);
    if (animate) this.animateDialogIn(shield, panel);
    this.addLabel(panel, '设置', 27, 0, 85, color('#FFF2CF'), 200);
    this.addIconButton(panel, '关闭设置', 'icon-settings-close', SETTINGS_LAYOUT.close, () => {
      this.animateDialogOut(shield, panel, () => {
        this.flow = toggleSettings(this.flow);
        this.render();
      });
    });
    this.addRasterButton(panel, this.flow.soundEnabled ? '声音   已开启' : '声音   已关闭', 'purple',
      SETTINGS_LAYOUT.soundButton.width, SETTINGS_LAYOUT.soundButton.height,
      SETTINGS_LAYOUT.soundButton.x, SETTINGS_LAYOUT.soundButton.y, () => {
      this.flow = toggleSound(this.flow);
      this.store.saveSoundEnabled(this.flow.soundEnabled);
      this.audio?.setEnabled(this.flow.soundEnabled);
      this.render();
    }, false, this.flow.soundEnabled ? 'icon-audio-settings' : 'icon-sfx-off', 16);
    if (this.flow.scene !== 'home') this.addRasterButton(panel, '返回主页', 'gold',
      SETTINGS_LAYOUT.homeButton.width, SETTINGS_LAYOUT.homeButton.height,
      SETTINGS_LAYOUT.homeButton.x, SETTINGS_LAYOUT.homeButton.y, () => {
      if (this.flow.scene === 'level') {
        if (this.completionScheduled || this.session.pendingCompletion.length > 0 || this.session.levelComplete) return;
      }
      this.animateDialogOut(shield, panel, () => {
        if (this.flow.scene === 'level') {
          this.flow = openExitConfirm(this.flow);
          this.render();
        } else this.returnToHome();
      });
    }, false, 'icon-settings-home', 16);
    if (this.platform.isQaAvailable()) {
      const qaMode = this.store.isQaMode();
      this.addRasterButton(panel, qaMode ? 'QA · 恢复' : 'QA · 解锁', qaMode ? 'gold' : 'purple',
        SETTINGS_LAYOUT.qaButton.width, SETTINGS_LAYOUT.qaButton.height,
        SETTINGS_LAYOUT.qaButton.x, SETTINGS_LAYOUT.qaButton.y,
        () => qaMode ? this.qaActions.reset() : this.qaActions.unlockAll(), false, undefined, 11);
      const qaAdPassed = this.qaAdResult === 'completed';
      this.addRasterButton(panel, qaAdPassed ? '广告状态 · 通过' : '广告状态 · 失败',
        qaAdPassed ? 'gold' : 'purple',
        SETTINGS_LAYOUT.qaAdButton.width, SETTINGS_LAYOUT.qaAdButton.height,
        SETTINGS_LAYOUT.qaAdButton.x, SETTINGS_LAYOUT.qaAdButton.y,
        () => { this.qaAdResult = qaAdPassed ? 'failed' : 'completed'; this.render(); }, false, undefined, 11);
    }
  }

  private startSelectedBottleSway(index: number, node: Node, baseAngle: number): void {
    if (!node.isValid || this.bottleNodes.get(index) !== node
      || this.session.selected !== index || this.pouring.has(index)) return;
    tween(node).repeatForever(
      tween<Node>()
        .to(SELECTED_BOTTLE_SWAY_SECONDS, { angle: baseAngle + SELECTED_BOTTLE_SWAY_DEGREES }, { easing: 'sineInOut' })
        .to(SELECTED_BOTTLE_SWAY_SECONDS * 2, { angle: baseAngle - SELECTED_BOTTLE_SWAY_DEGREES }, { easing: 'sineInOut' })
        .to(SELECTED_BOTTLE_SWAY_SECONDS, { angle: baseAngle }, { easing: 'sineInOut' }),
    ).start();
  }

  private animateDialogIn(shield: Node, panel: Node): void {
    const opacity = shield.getComponent(UIOpacity) ?? shield.addComponent(UIOpacity);
    opacity.opacity = 0;
    this.setDialogBackdropOpacity(shield, 0);
    panel.setScale(new Vec3(DIALOG_TRANSITION.enter.fromScale, DIALOG_TRANSITION.enter.fromScale, 1));
    tween(opacity).to(DIALOG_TRANSITION.enter.duration, { opacity: 255 }, {
      easing: 'quadOut', onUpdate: () => this.setDialogBackdropOpacity(shield, opacity.opacity),
    }).start();
    tween(panel).to(DIALOG_TRANSITION.enter.duration, { scale: new Vec3(1, 1, 1) }, { easing: 'quadOut' }).start();
  }

  private animateDialogOut(shield: Node, panel: Node, onClosed: () => void): void {
    if (this.dialogClosing) return;
    this.dialogClosing = true;
    const opacity = shield.getComponent(UIOpacity) ?? shield.addComponent(UIOpacity);
    tween(opacity).to(DIALOG_TRANSITION.exit.duration, { opacity: 0 }, {
      easing: 'quadIn', onUpdate: () => this.setDialogBackdropOpacity(shield, opacity.opacity),
    }).start();
    tween(panel).to(DIALOG_TRANSITION.exit.duration, {
      scale: new Vec3(DIALOG_TRANSITION.exit.toScale, DIALOG_TRANSITION.exit.toScale, 1),
    }, { easing: 'quadIn' }).start();
    this.scheduleOnce(() => {
      this.setDialogBackdropOpacity(shield, 0);
      this.dialogClosing = false;
      onClosed();
    }, DIALOG_TRANSITION.exit.duration);
  }

  private setDialogBackdropOpacity(shield: Node, opacity: number): void {
    const backdrop = shield.children[0].getComponent(Graphics)!;
    const size = backdrop.getComponent(UITransform)!;
    backdrop.clear();
    backdrop.fillColor = color('#090411', Math.round(184 * opacity / 255));
    backdrop.roundRect(-size.width / 2, -size.height / 2, size.width, size.height, 0);
    backdrop.fill();
  }

  private addMessage(root: Node, text: string, token: number): Label {
    const node = new Node('GameMessage');
    node.setPosition(LEVEL_LAYOUT.message.x, LEVEL_LAYOUT.message.y);
    node.addComponent(UITransform).setContentSize(LEVEL_LAYOUT.message.width, LEVEL_LAYOUT.message.height);
    root.addChild(node);
    this.addSprite(node, 'game/chibi/ui/message-panel/spriteFrame', LEVEL_LAYOUT.message.width,
      LEVEL_LAYOUT.message.height, 0, 0, token);
    return this.addLabel(node, text, 12, 0, 0, color('#FFF4DB'), LEVEL_LAYOUT.message.width - 40)
      .getComponent(Label) as Label;
  }

  private addControlButton(root: Node, label: string, icon: string, x: number, action: () => void,
    disabled = false, allowance?: number, alwaysShowAd = false): void {
    const stage = Object.freeze({ x: 0, y: 0, width: 110, height: 72 });
    const node = new Node(`Control-${label}`);
    node.setPosition(x, LEVEL_LAYOUT.controlY);
    node.addComponent(UITransform).setContentSize(stage.width, stage.height);
    root.addChild(node);
    const variant = icon === 'icon-add-bottle' ? 'gold' : 'purple';
    this.decorateRasterButton(node, variant, disabled, action, buttonBaseLayout(stage, 'contain'));
    this.addSprite(node, `game/chibi/ui/${icon}/spriteFrame`, 31, 31, 0, 8, this.renderToken);
    this.addLabel(node, label, 10, 0, LEVEL_LAYOUT.controlLabelY, color('#FFF9ED'), 96);
    const allowanceVisual = allowance === undefined ? null : controlAllowanceVisual(allowance);
    if (allowanceVisual?.text) {
      const bubbleLayout = LEVEL_LAYOUT.controlAllowanceBubble;
      const bubble = new Node(`Allowance-${label}`);
      bubble.setPosition(bubbleLayout.x, bubbleLayout.y);
      bubble.addComponent(UITransform).setContentSize(bubbleLayout.width, bubbleLayout.height);
      node.addChild(bubble);
      this.addSprite(bubble, 'game/chibi/ui/daily-commission-speech-bubble/spriteFrame',
        bubbleLayout.width, bubbleLayout.height, 0, 0, this.renderToken);
      this.addLabel(bubble, allowanceVisual.text, 11, 0, bubbleLayout.contentY, color('#6A351E'), 24);
      tween(bubble).repeatForever(
        tween()
          .to(bubbleLayout.floatDuration, {
            position: new Vec3(bubbleLayout.x, bubbleLayout.y + bubbleLayout.floatDistance, 0),
          }, { easing: 'sineInOut' })
          .to(bubbleLayout.floatDuration, {
            position: new Vec3(bubbleLayout.x, bubbleLayout.y, 0),
          }, { easing: 'sineInOut' }),
      ).start();
    }
    if (alwaysShowAd || allowanceVisual?.showAdBadge) this.addRewardedAdBadge(node);
  }

  private addRewardedAdBadge(root: Node): void {
    const layout = LEVEL_LAYOUT.controlAdBadge;
    const badge = new Node('RewardedAdBadge');
    badge.setPosition(layout.x, layout.y);
    badge.addComponent(UITransform).setContentSize(layout.width, layout.height);
    root.addChild(badge);
    this.addPanel(badge, layout.width, layout.height, 0, 0, color('#FFF3C9'), color('#6B351A'), 5);
    const icon = new Node('RewardedAdCamera');
    icon.addComponent(UITransform).setContentSize(18, 14);
    badge.addChild(icon);
    const graphics = icon.addComponent(Graphics);
    graphics.lineWidth = 1;
    graphics.fillColor = color('#FFFDF3');
    graphics.strokeColor = color('#6B351A');
    graphics.roundRect(-7, -4, 11, 8, 2);
    graphics.fill();
    graphics.roundRect(-7, -4, 11, 8, 2);
    graphics.stroke();
    graphics.circle(-4, 5, 2);
    graphics.circle(1, 5, 2);
    graphics.fill();
    graphics.stroke();
    graphics.moveTo(5, -3);
    graphics.lineTo(9, 0);
    graphics.lineTo(5, 3);
    graphics.close();
    graphics.fill();
    graphics.stroke();
    graphics.fillColor = color('#E9A72E');
    graphics.moveTo(-3, -2.5);
    graphics.lineTo(1, 0);
    graphics.lineTo(-3, 2.5);
    graphics.close();
    graphics.fill();
  }

  private addRasterButton(root: Node, text: string, variant: ButtonVariant, width: number, height: number,
    x: number, y: number, onClick: () => void, disabled = false, icon?: string, fontSize = 18): Node {
    const layout = Object.freeze({ x, y, width, height });
    const button = new Node(`Button-${text}`);
    button.setPosition(layout.x, layout.y);
    button.addComponent(UITransform).setContentSize(layout.width, layout.height);
    root.addChild(button);
    this.decorateRasterButton(button, variant, disabled, onClick, buttonBaseLayout(layout, 'sliced'));
    if (icon) this.addSprite(button, `game/chibi/ui/${icon}/spriteFrame`, 44, 44, -76, 0, this.renderToken);
    this.addLabel(button, text, fontSize, icon ? 18 : 0, 0, color('#FFF8DF'), icon ? width - 80 : width - 30);
    return button;
  }

  private decorateRasterButton(node: Node, variant: ButtonVariant, disabled: boolean, onClick: () => void,
    baseLayout: ButtonBaseLayout): void {
    const base = this.addButtonSprite(node, buttonSpritePath(variant, disabled, false), baseLayout, this.renderToken);
    const setPressed = (pressed: boolean): void => {
      if (disabled) return;
      this.setButtonSpritePath(base, buttonSpritePath(variant, false, pressed), baseLayout, this.renderToken);
    };
    node.on(Node.EventType.TOUCH_START, () => setPressed(true));
    node.on(Node.EventType.TOUCH_END, () => setPressed(false));
    node.on(Node.EventType.TOUCH_CANCEL, () => setPressed(false));
    const button = node.addComponent(Button);
    button.interactable = !disabled;
    this.bindUiClick(node, onClick);
  }

  private addIconButton(root: Node, name: string, icon: string, layout: Readonly<{ x: number; y: number; width: number; height: number }>, onClick: () => void): Node {
    const button = new Node(name);
    button.setPosition(layout.x, layout.y);
    button.addComponent(UITransform).setContentSize(layout.width, layout.height);
    root.addChild(button);
    this.addSprite(button, `game/chibi/ui/${icon}/spriteFrame`, layout.width, layout.height, 0, 0, this.renderToken);
    button.addComponent(Button);
    this.bindUiClick(button, onClick);
    return button;
  }

  private bindUiClick(node: Node, onClick: () => void): void {
    node.on(Button.EventType.CLICK, () => {
      this.resumeAudio();
      this.audio?.play('ui-tap');
      this.platform.vibrateShort();
      onClick();
    });
  }

  private renderStarRow(root: Node, stars: LevelStarRating, y: number, size: number, gap: number): void {
    for (let index = 0; index < 3; index += 1) {
      this.addSprite(root, index < stars
        ? 'game/chibi/ui/star-earned/spriteFrame'
        : 'game/chibi/ui/star-empty/spriteFrame',
      size, size, (index - 1) * gap, y, this.renderToken);
    }
  }

  private addLabel(root: Node, text: string, fontSize: number, x: number, y: number, tint: Color,
    width = 360, align = Label.HorizontalAlign.CENTER): Node {
    const node = new Node(`Label-${text}`);
    node.setPosition(x, y);
    node.addComponent(UITransform).setContentSize(width, Math.max(28, fontSize * 1.6));
    root.addChild(node);
    const label = node.addComponent(Label);
    label.string = text;
    label.fontSize = fontSize;
    label.lineHeight = Math.round(fontSize * 1.25);
    label.color = tint;
    label.font = this.artFont;
    label.spacingX = fontSize >= 20 ? 1 : 0;
    if (text !== '★') {
      label.enableShadow = true;
      label.shadowColor = color('#160C1F', 140);
      label.shadowOffset = new Vec2(1, -1);
      label.shadowBlur = 0;
    }
    label.horizontalAlign = align;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    if (fontSize >= 18) {
      const outline = node.addComponent(LabelOutline);
      outline.color = color('#321138', 210);
      outline.width = 1.5;
    }
    return node;
  }

  private visibleViewportSize(): Readonly<{ width: number; height: number }> {
    const visible = view.getVisibleSize();
    return { width: visible.width, height: visible.height };
  }

  private addAlchemyRoomBackground(root: Node, token: number, overlay: Color): void {
    const viewport = this.visibleViewportSize();
    const scale = Math.max(viewport.width / 393, (viewport.height + BACKGROUND_VERTICAL_OVERSCAN) / 852);
    this.addPanel(root, viewport.width, viewport.height, 0, 0, color('#13091F'));
    this.addSprite(root, 'game/chibi/background/alchemy-room/spriteFrame',
      393 * scale, 852 * scale, 0, 0, token);
    this.addPanel(root, viewport.width, viewport.height, 0, 0, overlay);
  }

  private addPanel(root: Node, width: number, height: number, x: number, y: number, fill: Color, stroke?: Color, radius = 0): Node {
    const node = new Node('Panel');
    node.setPosition(x, y);
    node.addComponent(UITransform).setContentSize(width, height);
    root.addChild(node);
    const graphics = node.addComponent(Graphics);
    graphics.fillColor = fill;
    graphics.roundRect(-width / 2, -height / 2, width, height, radius);
    graphics.fill();
    if (stroke) {
      graphics.strokeColor = stroke;
      graphics.lineWidth = 2;
      graphics.roundRect(-width / 2, -height / 2, width, height, radius);
      graphics.stroke();
    }
    return node;
  }

  private addSprite(root: Node, path: string, width: number, height: number, x: number, y: number, token: number): Node {
    const node = new Node(`Sprite-${path}`);
    node.setPosition(x, y);
    node.addComponent(UITransform).setContentSize(width, height);
    root.addChild(node);
    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    sprite.trim = false;
    const cached = resources.get(path, SpriteFrame);
    if (cached) {
      sprite.spriteFrame = cached;
      return node;
    }
    resources.load(path, SpriteFrame, (error, frame) => {
      if (error || token !== this.renderToken || !node.isValid) return;
      sprite.spriteFrame = frame;
    });
    return node;
  }

  private addButtonSprite(root: Node, path: string, layout: ButtonBaseLayout, token: number): Node {
    const node = new Node(`ButtonSprite-${path}`);
    node.setPosition(layout.x, layout.y);
    node.setScale(new Vec3(layout.scale, layout.scale, 1));
    node.addComponent(UITransform).setContentSize(layout.width, layout.height);
    root.addChild(node);
    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    sprite.trim = false;
    if (layout.renderMode === 'sliced') sprite.type = Sprite.Type.SLICED;
    this.setButtonSpritePath(node, path, layout, token);
    return node;
  }

  private setButtonSpritePath(node: Node, path: string, layout: ButtonBaseLayout, token: number): void {
    const sprite = node.getComponent(Sprite);
    if (!sprite) return;
    const applyFrame = (frame: SpriteFrame): void => {
      if (layout.renderMode === 'sliced') {
        frame.insetLeft = layout.sourceInset;
        frame.insetRight = layout.sourceInset;
        frame.insetTop = layout.sourceInset;
        frame.insetBottom = layout.sourceInset;
      }
      sprite.spriteFrame = frame;
    };
    const cached = resources.get(path, SpriteFrame);
    if (cached) {
      applyFrame(cached);
      return;
    }
    resources.load(path, SpriteFrame, (error, frame) => {
      if (error || token !== this.renderToken || !node.isValid) return;
      applyFrame(frame);
    });
  }

  private resumeAudio(): void {
    this.audio?.unlockFromGesture();
    this.audio?.setEnabled(this.flow.soundEnabled);
  }
}
