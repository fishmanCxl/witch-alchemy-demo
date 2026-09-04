import {
  _decorator, BlockInputEvents, Button, Color, Component, Font, Graphics, Label, LabelOutline, Mask,
  Node, ResolutionPolicy, resources, ScrollView, Sprite, SpriteFrame, sys, Tween, UIOpacity, UITransform, Vec3, view, tween,
} from 'cc';

import {
  completePendingBottles, createGameSession, finishWitchReturn, grantRewardBottle, pressBottle, restartSession,
  settleWitch, undoSession, type GameSession, type SessionResult, type WitchMood,
} from '../core/game-session.ts';
import { FIRST_CHAPTER_LEVELS, getLevelConfig, levelsForChapter, nextLevelConfig } from '../core/level-catalog.ts';
import type { LevelConfig } from '../core/level-config.ts';
import {
  completeLevel, createDefaultProgress, isLevelUnlocked, selectCurrentLevel, type PlayerProgress,
} from '../core/level-progress.ts';
import {
  STAMINA_MAX, createFullStamina, grantAdStamina, nextRecoveryMs, reconcileStamina, spendStamina,
  type StaminaState,
} from '../core/stamina.ts';
import {
  deriveCollectionProgress, deriveCompletionReward, deriveHighestTitle, type CollectionProgress,
  type CompletionReward, type HighestTitle,
} from '../core/collection-progress.ts';
import { chapterForLevel, getChapter } from '../core/chapter-catalog.ts';
import { POTION_COLLECTIONS, getPotionCollection, type PotionCollectionConfig } from '../core/potion-collection-catalog.ts';
import {
  closeCollection, closeCollectionDetail, closeExitConfirm, closeStaminaDialog, createSceneFlow, enterSelectedLevel,
  openCollection, openCollectionDetail, openExitConfirm, openLevelSelect, openStaminaDialog, returnHome, selectLevelChapter,
  showLevelComplete, toggleSettings, toggleSound, type SceneFlowState,
} from '../core/scene-flow.ts';
import type { PotionColor } from '../core/types.ts';
import { LocalProgressStore } from '../platform/LocalProgressStore.ts';
import { PlatformRuntime } from '../platform/WeChatPlatform.ts';
import { RewardedBottleCoordinator, type RewardFlowStatus } from '../platform/rewarded-bottle.ts';
import { RewardedStaminaCoordinator } from '../platform/rewarded-stamina.ts';
import { applyProgressSyncResult, ProgressSyncCoordinator } from '../platform/progress-sync.ts';
import { createPlatformStorage } from '../platform/storage-port.ts';
import { AudioDirector } from './AudioDirector.ts';
import {
  LAUNCH_MIN_VISIBLE_MS, beginLaunchExit, canExitLaunch, completeLaunchResources, failLaunchResources,
  createLaunchLoadingState, launchMinimumRemainingMs, markLaunchMinimumVisible, retryLaunch,
  updateLaunchProgress, type LaunchLoadingState,
} from './launch-loading.ts';
import {
  ART_FONT_RESOURCE, COLLECTION_LAYOUT, COLLECTION_OVERVIEW_LAYOUT, HEALTHY_GAME_ADVICE_LINES, HOME_LAYOUT, LAUNCH_LAYOUT,
  LEVEL_COMPLETE_LAYOUT, LEVEL_LAYOUT, LEVEL_SELECT_LAYOUT, RESTART_LABEL,
  SETTINGS_LAYOUT, STAMINA_LAYOUT, bottleFeedbackVisual, bottlePlacement, buttonBaseLayout, buttonSpritePath,
  collectionCardLayout, collectionCompleteLabel, collectionPuzzlePiece, collectionRewardLabel,
  completionPrimaryLabel, formatRecoveryCountdown, launchProgressFill, levelButtonVisual, levelInteractionRefreshMode,
  levelSelectButton, potionParticleState, potionParticleVisuals, potionProgressLabel,
  mysteryPotionVisual, selectedBottleAuraVisual, shouldRenderBottle, staminaBarContentLayout,
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
const REWARDED_AD_UNIT_ID = '';

function color(hex: string, alpha = 255): Color {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  return new Color((value >> 16) & 255, (value >> 8) & 255, value & 255, alpha);
}

@ccclass('ProductionBootstrap')
export class ProductionBootstrap extends Component {
  private flow: SceneFlowState = createSceneFlow();
  private progress: PlayerProgress = createDefaultProgress();
  private stamina: StaminaState = createFullStamina(Date.now());
  private currentLevel: LevelConfig = FIRST_CHAPTER_LEVELS[0];
  private session: GameSession = createGameSession(this.currentLevel);
  private surface: Node | null = null;
  private renderToken = 0;
  private artFont: Font | null = null;
  private audio: AudioDirector | null = null;
  private store = new LocalProgressStore(createPlatformStorage(sys.localStorage));
  private invalid = new Set<number>();
  private pouring = new Set<number>();
  private bottleNodes = new Map<number, Node>();
  private particleAnimators = new Map<number, PotionParticleAnimator[]>();
  private levelContent: Node | null = null;
  private levelMessageLabel: Label | null = null;
  private levelWitchAnimator: WitchAnimator | null = null;
  private completionScheduled = false;
  private staminaSpentForActiveLevel = false;
  private readonly platform = new PlatformRuntime({
    unlockAll: () => {
      this.store.saveSession(this.session);
      this.applyQaProgress(this.store.enableQaAllLevels());
    },
    reset: () => this.applyQaProgress(this.store.resetQaMode()),
  });
  private rewarded: RewardedBottleCoordinator | null = null;
  private staminaRewarded: RewardedStaminaCoordinator | null = null;
  private progressSync: ProgressSyncCoordinator | null = null;
  private rewardBusy = false;
  private staminaTickAccumulator = 0;
  private homeStaminaValueLabel: Label | null = null;
  private homeStaminaCountdownLabel: Label | null = null;
  private staminaDialogValueLabel: Label | null = null;
  private staminaDialogCountdownLabel: Label | null = null;
  private staminaMessage = '';
  private completionSaveFailed = false;
  private completionReward: CompletionReward | null = null;
  private collectionHasNewPiece = false;
  private levelStartedAt = Date.now();
  private undoCount = 0;
  private launchState: LaunchLoadingState = createLaunchLoadingState(Date.now());
  private launchProgressFill: Node | null = null;
  private launchPercentLabel: Label | null = null;
  private launchStatusLabel: Label | null = null;
  private launchRetryButton: Node | null = null;

  start(): void {
    view.setDesignResolutionSize(393, 852, ResolutionPolicy.FIXED_WIDTH);
    this.progress = this.store.migrateLegacyLevel12();
    this.stamina = this.store.loadStamina(Date.now());
    this.currentLevel = getLevelConfig(this.progress.currentLevel) ?? FIRST_CHAPTER_LEVELS[0];
    this.session = this.store.loadSession(this.currentLevel);
    this.flow = {
      ...this.flow,
      selectedLevelId: this.currentLevel.id,
      soundEnabled: this.store.loadSoundEnabled(),
    };
    this.audio = this.node.getComponent(AudioDirector) ?? this.node.addComponent(AudioDirector);
    this.audio.initialize(this.flow.soundEnabled);
    const rewardPorts = this.platform.createRewardedPorts(REWARDED_AD_UNIT_ID);
    this.rewarded = new RewardedBottleCoordinator(rewardPorts.ad, rewardPorts.claims);
    this.staminaRewarded = new RewardedStaminaCoordinator(rewardPorts.ad);
    this.progressSync = new ProgressSyncCoordinator(this.platform.createProgressSyncPort());
    this.platform.bindLifecycle(
      () => this.handlePlatformForeground(),
      () => { this.store.saveSession(this.session); this.audio?.setForeground(false); },
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
    const reconciled = reconcileStamina(this.stamina, Date.now());
    if (reconciled !== this.stamina) {
      this.stamina = reconciled;
      this.store.saveStamina(this.stamina);
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
    const reconciled = reconcileStamina(this.stamina, Date.now());
    if (reconciled !== this.stamina) {
      this.stamina = reconciled;
      this.store.saveStamina(this.stamina);
    }
    this.refreshStaminaLabels();
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
    this.surface.addComponent(UITransform).setContentSize(393, 852);
    this.surface.addComponent(BlockInputEvents);
    this.surface.addComponent(UIOpacity);
    this.node.addChild(this.surface);
    const root = this.surface;
    const token = this.renderToken;

    this.addPanel(root, 393, 852, 0, 0, color('#13091F'));
    this.addSprite(root, 'game/chibi/background/alchemy-room/spriteFrame', 393, 852, 0, 0, token);
    this.addPanel(root, 393, 852, 0, 0, color('#12081F', 94));
    this.addPanel(root, 42, 42, LAUNCH_LAYOUT.ageBadge.x, LAUNCH_LAYOUT.ageBadge.y,
      color('#271034', 224), color('#E9C477'), 12);
    this.addLabel(root, '8+', 14, LAUNCH_LAYOUT.ageBadge.x, LAUNCH_LAYOUT.ageBadge.y,
      color('#FFF0C2'), LAUNCH_LAYOUT.ageBadge.width);
    this.addLabel(root, '暮影炼金室', 36, LAUNCH_LAYOUT.title.x, LAUNCH_LAYOUT.title.y,
      color('#FFE2A0'), LAUNCH_LAYOUT.title.width);
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
      this.launchState = completeLaunchResources(this.launchState, attempt);
      this.updateLaunchView();
      this.tryExitLaunch();
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
    this.renderToken += 1;
    this.clearLevelReferences();
    this.homeStaminaValueLabel = null;
    this.homeStaminaCountdownLabel = null;
    this.staminaDialogValueLabel = null;
    this.staminaDialogCountdownLabel = null;
    this.surface?.destroy();
    this.bottleNodes.clear();
    this.particleAnimators.clear();
    this.surface = new Node('ProductionSurface');
    this.node.addChild(this.surface);
    if (this.flow.scene === 'home') this.renderHome(this.surface, this.renderToken);
    else if (this.flow.scene === 'levelSelect') this.renderLevelSelect(this.surface, this.renderToken);
    else if (this.flow.scene === 'collection') this.renderCollection(this.surface, this.renderToken);
    else if (this.flow.scene === 'levelComplete') this.renderLevelComplete(this.surface, this.renderToken);
    else this.renderLevel(this.surface, this.renderToken);
    this.renderSettingsButton(this.surface, this.renderToken);
    if (this.flow.settingsOpen) this.renderSettings(this.surface, this.renderToken);
    if (this.flow.staminaDialogOpen) this.renderStaminaDialog(this.surface, this.renderToken);
    if (this.flow.exitConfirmOpen) this.renderExitConfirm(this.surface, this.renderToken);
  }

  private clearLevelReferences(): void {
    this.levelContent = null;
    this.levelMessageLabel = null;
    this.levelWitchAnimator = null;
  }

  private renderHome(root: Node, token: number): void {
    this.addSprite(root, 'game/chibi/background/alchemy-room/spriteFrame', 393, 852, 0, 0, token);
    this.addPanel(root, 393, 852, 0, 0, color('#170D29', 34));
    const title = deriveHighestTitle(this.progress);
    this.addLabel(root, '暮影炼金室', 12, HOME_LAYOUT.header.x, 350, color('#DDBED2'), HOME_LAYOUT.header.width, Label.HorizontalAlign.LEFT);
    this.addLabel(root, `第 ${this.currentLevel.number} 关`, 34, HOME_LAYOUT.header.x, 316,
      color('#FFF4DF'), HOME_LAYOUT.header.width, Label.HorizontalAlign.LEFT);
    this.renderStaminaBar(root, token);
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
    this.addSprite(root, 'game/chibi/background/alchemy-room/spriteFrame', 393, 852, 0, 0, token);
    this.addPanel(root, 393, 852, 0, 0, color('#130A20', 96));
    const chapter = getChapter(this.flow.selectedLevelChapterId)!;
    this.addLabel(root, chapter.stageTitle, 26, LEVEL_SELECT_LAYOUT.header.x,
      LEVEL_SELECT_LAYOUT.header.y, color('#FFF4DF'), LEVEL_SELECT_LAYOUT.header.width);
    const chapterLabel = chapter.id === 1 ? '第一章' : '第二章';
    const lastLevel = chapter.firstLevel + chapter.levelCount - 1;
    this.addLabel(root, `${chapterLabel} · ${chapter.themeTitle} · ${chapter.firstLevel}–${lastLevel}关`, 12,
      0, LEVEL_SELECT_LAYOUT.subtitleY, color('#DCC7E8'), 270);
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
    this.renderCollectionEntry(root, LEVEL_SELECT_LAYOUT.collectionButton, token);

    levelsForChapter(this.flow.selectedLevelChapterId).forEach((level, index) => {
      const state = this.levelButtonState(level);
      const visual = levelButtonVisual(state);
      const layout = levelSelectButton(index);
      this.addLevelSelectButton(root, level, layout, state, visual, token);
    });

    this.addRasterButton(root, '返回主页', 'purple', LEVEL_SELECT_LAYOUT.backButton.width,
      LEVEL_SELECT_LAYOUT.backButton.height, LEVEL_SELECT_LAYOUT.backButton.x,
      LEVEL_SELECT_LAYOUT.backButton.y, () => this.returnToHome(), false, 'icon-settings-home', 16);
  }

  private renderCollection(root: Node, token: number): void {
    this.addSprite(root, 'game/chibi/background/alchemy-room/spriteFrame', 393, 852, 0, 0, token);
    this.addPanel(root, 393, 852, 0, 0, color('#10071C', 144));
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
    const card = this.addPanel(root, layout.width, layout.height, layout.x, layout.y,
      color('#21102F', 246), color('#A37A52'), 18);
    this.addLabel(card, `第 ${collection.chapterId} 章`, 11, 0, 72, color('#C9A978'), 126);
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
      card.on(Button.EventType.CLICK, () => {
        this.resumeAudio();
        const nextFlow = openCollectionDetail(
          this.flow,
          collection.chapterId,
          unlocked,
        );
        if (nextFlow === this.flow) return;
        this.flow = nextFlow;
        this.render();
      });
      return;
    }

    this.renderMysteryPotion(card, collection.silhouetteIndex ?? 0, 0, 24);
    this.renderCollectionLock(card, 31, 35);
    this.addLabel(card, '???', 18, 0, -41, color('#B8A3C8'), 120);
    this.addLabel(card, `第 ${collection.chapterId} 章`, 11, 0, -67, color('#8E789C'), 120);
    card.on(Button.EventType.CLICK, () => {
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

  private renderCollectionLock(root: Node, x: number, y: number): void {
    const node = new Node('CollectionLock');
    node.setPosition(x, y);
    node.addComponent(UITransform).setContentSize(36, 42);
    root.addChild(node);
    const graphics = node.addComponent(Graphics);
    graphics.strokeColor = color('#F4CF78');
    graphics.lineWidth = 5;
    graphics.arc(0, 7, 10, 0, Math.PI, false);
    graphics.stroke();
    graphics.fillColor = color('#D49A42');
    graphics.strokeColor = color('#6C3A54');
    graphics.lineWidth = 2;
    graphics.roundRect(-14, -15, 28, 24, 6);
    graphics.fill();
    graphics.stroke();
    graphics.fillColor = color('#4D244C');
    graphics.circle(0, -4, 3);
    graphics.fill();
    graphics.rect(-1.5, -10, 3, 7);
    graphics.fill();
  }

  private renderMysteryPotion(root: Node, index: number, x: number, y: number): void {
    const visual = mysteryPotionVisual(index);
    const node = new Node(`MysteryPotion-${index + 1}`);
    node.setPosition(x, y);
    node.addComponent(UITransform).setContentSize(visual.width, visual.height);
    root.addChild(node);
    const graphics = node.addComponent(Graphics);
    graphics.fillColor = color('#25132F');
    graphics.strokeColor = color('#8F65B1');
    graphics.lineWidth = 3;

    if (visual.body === 'round') graphics.circle(0, -7, visual.width * 0.36);
    else if (visual.body === 'heart') {
      graphics.moveTo(0, -34);
      graphics.bezierCurveTo(-38, -12, -34, 24, -15, 27);
      graphics.bezierCurveTo(-7, 28, -2, 22, 0, 17);
      graphics.bezierCurveTo(2, 22, 7, 28, 15, 27);
      graphics.bezierCurveTo(34, 24, 38, -12, 0, -34);
      graphics.close();
    } else if (visual.body === 'crystal') {
      graphics.moveTo(0, -38);
      graphics.lineTo(-30, -14);
      graphics.lineTo(-22, 28);
      graphics.lineTo(0, 38);
      graphics.lineTo(22, 28);
      graphics.lineTo(30, -14);
      graphics.close();
    } else if (visual.body === 'winged') {
      graphics.moveTo(-21, 12);
      graphics.lineTo(-45, 27);
      graphics.lineTo(-36, 1);
      graphics.lineTo(-45, -18);
      graphics.lineTo(-18, -9);
      graphics.close();
      graphics.moveTo(21, 12);
      graphics.lineTo(45, 27);
      graphics.lineTo(36, 1);
      graphics.lineTo(45, -18);
      graphics.lineTo(18, -9);
      graphics.close();
      graphics.circle(0, -8, 25);
    } else if (visual.body === 'star') {
      for (let point = 0; point < 10; point += 1) {
        const angle = Math.PI / 2 + point * Math.PI / 5;
        const radius = point % 2 === 0 ? 36 : 19;
        const px = Math.cos(angle) * radius;
        const py = Math.sin(angle) * radius - 5;
        if (point === 0) graphics.moveTo(px, py);
        else graphics.lineTo(px, py);
      }
      graphics.close();
    } else if (visual.body === 'cauldron') {
      graphics.roundRect(-42, -30, 84, 52, 18);
      graphics.roundRect(-36, 18, 72, 9, 4);
      graphics.roundRect(-32, -38, 10, 12, 3);
      graphics.roundRect(22, -38, 10, 12, 3);
    } else if (visual.body === 'square') graphics.roundRect(-31, -34, 62, 64, 12);
    else if (visual.body === 'gourd') {
      graphics.circle(0, -17, 25);
      graphics.circle(0, 20, 17);
    } else {
      graphics.moveTo(12, 34);
      graphics.bezierCurveTo(-20, 34, -34, 0, -20, -28);
      graphics.bezierCurveTo(-5, -44, 20, -36, 28, -18);
      graphics.bezierCurveTo(6, -24, -4, -8, -2, 6);
      graphics.bezierCurveTo(0, 18, 8, 28, 12, 34);
      graphics.close();
    }
    graphics.fill();
    graphics.stroke();

    if (visual.body !== 'cauldron') {
      graphics.roundRect(-10, visual.height / 2 - 25, 20, 21, 5);
      graphics.fill();
      graphics.stroke();
      graphics.fillColor = color('#B28A5E');
      graphics.roundRect(-13, visual.height / 2 - 9, 26, 8, 3);
      graphics.fill();
    }
    graphics.fillColor = color('#CDA25B');
    graphics.circle(-visual.width * 0.34, 20, 3);
    graphics.fill();
    graphics.circle(visual.width * 0.34, -5, 2);
    graphics.fill();
  }

  private renderCollectionDetail(root: Node, chapterId: number, token: number): void {
    const collection = deriveCollectionProgress(this.progress, chapterId);
    const collectionConfig = getPotionCollection(collection.chapterId)!;
    const artworkPath = `game/chibi/collection/${collectionConfig.artworkKey}/spriteFrame`;
    const title = deriveHighestTitle(this.progress);
    this.addLabel(root, '炼金图鉴', 30, COLLECTION_LAYOUT.title.x, COLLECTION_LAYOUT.title.y,
      color('#FFF2CF'), COLLECTION_LAYOUT.title.width);
    this.renderTitleBadge(root, title, COLLECTION_LAYOUT.titleBadge, token);
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
      COLLECTION_LAYOUT.backButton.y, () => this.closeCollectionDetailView(), false, undefined, 17);
  }

  private renderTitleBadge(
    root: Node,
    title: HighestTitle,
    layout: Readonly<{ x: number; y: number; width: number; height: number }>,
    token: number,
  ): Node {
    const variant = title.chapterId === 1 ? 'novice' : 'junior';
    const badge = new Node('TitleBadge');
    badge.setPosition(layout.x, layout.y);
    badge.addComponent(UITransform).setContentSize(layout.width, layout.height);
    root.addChild(badge);
    this.addSprite(badge, 'game/chibi/titles/title-badge-' + variant + '/spriteFrame',
      layout.width, layout.height, 0, 0, token);
    this.addLabel(badge, title.title, Math.max(14, Math.round(layout.height * 0.2)),
      0, -layout.height * 0.08, color('#FFF0C2'), layout.width * 0.72);
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
    const square = layout.width === layout.height;
    const stage = Object.freeze({ x: 0, y: 0, width: layout.width, height: layout.height });
    this.decorateRasterButton(button, 'purple', false, () => this.openCollectionView(),
      buttonBaseLayout(stage, square ? 'contain' : 'sliced'));
    const iconX = square ? 0 : -55;
    const iconY = square ? 7 : 0;
    if (this.collectionHasNewPiece) {
      this.addSprite(button, 'game/chibi/effects/completion-burst/spriteFrame',
        square ? 60 : 44, square ? 60 : 44, iconX, iconY, token);
    }
    this.addSprite(button, 'game/chibi/ui/icon-alchemy-book/spriteFrame',
      square ? 42 : 36, square ? 42 : 36, iconX, iconY, token);
    this.addLabel(button, '收藏品', square ? 9 : 15,
      square ? 0 : 24, square ? -23 : 0, color('#FFF4DF'), square ? 56 : 88);
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
      COLLECTION_LAYOUT.puzzle.x, COLLECTION_LAYOUT.puzzle.y, color('#14091F', 0), color('#D9B56D'), 5);
  }

  private openCollectionView(): void {
    this.resumeAudio();
    const nextFlow = openCollection(this.flow);
    if (nextFlow === this.flow) return;
    this.store.saveSession(this.session);
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
    const next = nextLevelConfig(this.session.levelId);
    const chapter = chapterForLevel(this.currentLevel.number)!;
    const chapterComplete = this.currentLevel.number === chapter.firstLevel + chapter.levelCount - 1;
    const chapterLabel = chapter.id === 1 ? '第一章' : '第二章';
    const best = this.progress.bestMoves[this.session.levelId] ?? this.session.game.moves;
    this.addSprite(root, 'game/chibi/background/alchemy-room/spriteFrame', 393, 852, 0, 0, token);
    this.addPanel(root, 393, 852, 0, 0, color('#0C0614', 166));
    this.addSprite(root, 'game/chibi/ui/settings-dialog-panel/spriteFrame',
      LEVEL_COMPLETE_LAYOUT.panel.width, LEVEL_COMPLETE_LAYOUT.panel.height,
      LEVEL_COMPLETE_LAYOUT.panel.x, LEVEL_COMPLETE_LAYOUT.panel.y, token);
    this.addLabel(root, chapterComplete ? `${chapterLabel}完成！` : '炼金完成！', 30,
      LEVEL_COMPLETE_LAYOUT.title.x, LEVEL_COMPLETE_LAYOUT.title.y,
      color('#FFF2CF'), LEVEL_COMPLETE_LAYOUT.title.width);
    this.addLabel(root, `本局 ${this.session.game.moves} 步 · 最佳 ${best} 步`, 15,
      LEVEL_COMPLETE_LAYOUT.stats.x, LEVEL_COMPLETE_LAYOUT.stats.y,
      color('#EFD9C9'), LEVEL_COMPLETE_LAYOUT.stats.width);
    this.completionRewardLines().forEach((line, index) => {
      this.addLabel(root, line, 14, 0, 26 - index * 28, color('#FFE5A3'), 280);
    });

    this.addRasterButton(root, completionPrimaryLabel(this.currentLevel.number, next?.number ?? null), 'gold',
      LEVEL_COMPLETE_LAYOUT.primaryButton.width, LEVEL_COMPLETE_LAYOUT.primaryButton.height,
      LEVEL_COMPLETE_LAYOUT.primaryButton.x, LEVEL_COMPLETE_LAYOUT.primaryButton.y, () => {
        if (next) this.switchLevel(next.id);
        else this.openSelector();
      }, false, undefined, 17);
    this.addRasterButton(root, next ? '选择关卡' : '返回主页', 'purple',
      LEVEL_COMPLETE_LAYOUT.secondaryButton.width, LEVEL_COMPLETE_LAYOUT.secondaryButton.height,
      LEVEL_COMPLETE_LAYOUT.secondaryButton.x, LEVEL_COMPLETE_LAYOUT.secondaryButton.y, () => {
        if (next) this.openSelector();
        else this.returnToHome();
      }, false, undefined, 16);
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
    if (this.progress.completedLevels.includes(level.id)) return 'completed';
    return isLevelUnlocked(this.progress, level.id) ? 'unlocked' : 'locked';
  }

  private addLevelSelectButton(
    root: Node,
    level: LevelConfig,
    layout: Readonly<{ x: number; y: number; width: number; height: number }>,
    state: LevelButtonState,
    visual: ReturnType<typeof levelButtonVisual>,
    token: number,
  ): void {
    const node = new Node(`Level-${level.number}`);
    node.setPosition(layout.x, layout.y);
    node.addComponent(UITransform).setContentSize(layout.width, layout.height);
    root.addChild(node);
    this.decorateRasterButton(node, visual.variant, visual.disabled,
      () => this.switchLevel(level.id), buttonBaseLayout(layout, 'contain'));
    if (visual.highlighted) {
      this.addPanel(node, layout.width + 8, layout.height + 8, 0, 0,
        color('#8A4BC4', 8), color('#FFF0A8'), 18);
    }
    this.addLabel(node, String(level.number), 18, 0, state === 'completed' ? 4 : 0,
      color(visual.disabled ? '#937D9E' : '#FFF8DF'), layout.width);
    if (state === 'completed') this.addLabel(node, '✓', 11, 15, -16, color('#FFF0A8'), 20);
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
    this.render();
  }

  private openSelector(): void {
    this.completionReward = null;
    this.store.saveSession(this.session);
    this.flow = openLevelSelect(this.flow, chapterForLevel(this.currentLevel.number)?.id ?? 1);
    this.render();
  }

  private returnToHome(): void {
    this.completionReward = null;
    this.store.saveSession(this.session);
    const current = getLevelConfig(this.progress.currentLevel) ?? FIRST_CHAPTER_LEVELS[0];
    if (current.id !== this.currentLevel.id) {
      this.currentLevel = current;
      this.session = this.store.loadSession(current);
    }
    this.flow = returnHome(this.flow);
    this.render();
  }

  private switchLevel(levelId: string): void {
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
    this.store.saveSession(this.session);
    const selected = selectCurrentLevel(this.progress, levelId);
    if (!selected) return;
    if (selected !== this.progress) this.store.saveProgress(selected);
    this.progress = selected;
    this.currentLevel = level;
    this.session = this.store.loadSession(level);
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
    this.addSprite(root, 'game/chibi/background/alchemy-room/spriteFrame', 393, 852, 0, 0, token);
    this.addPanel(root, 393, 852, 0, 0, color('#130A20', 16));
    this.renderLevelContent(root, token);
  }

  private renderLevelContent(root: Node, token: number): void {
    this.bottleNodes.clear();
    this.particleAnimators.clear();
    this.levelMessageLabel = null;
    this.levelWitchAnimator = null;
    const content = new Node('LevelContent');
    root.addChild(content);
    const settingsButton = root.getChildByName('SettingsButton');
    if (settingsButton) content.setSiblingIndex(settingsButton.getSiblingIndex());
    this.levelContent = content;

    const completed = this.session.game.bottles.filter((bottle) => bottle.status === 'vanished').length;
    this.addLabel(content, '暮影炼金室', 11, -86, 350, color('#DCBACB'), 176, Label.HorizontalAlign.LEFT);
    this.addLabel(content, `第 ${this.currentLevel.number} 关`, 30, -86, 318,
      color('#FFF4DF'), 176, Label.HorizontalAlign.LEFT);
    this.addPanel(content, 54, 24, -147, 280, color('#221023', 184), color('#DEB5A1', 70), 12);
    this.addLabel(content, `步数 ${this.session.game.moves}`, 11, -147, 280, color('#EFD9C9'), 52);
    this.addPanel(content, 66, 24, -80, 280, color('#221023', 184), color('#DEB5A1', 70), 12);
    this.addLabel(content, potionProgressLabel(completed, this.targetPotionCount(this.currentLevel)), 11,
      -80, 280, color('#EFD9C9'), 64);
    this.levelWitchAnimator = this.addWitch(content, this.session.witchMood, LEVEL_LAYOUT.witch.x, LEVEL_LAYOUT.witch.y,
      LEVEL_LAYOUT.witch.width, LEVEL_LAYOUT.witch.height);

    this.session.game.bottles.forEach((bottle, index) => {
      if (!shouldRenderBottle(bottle.status)) return;
      const placement = bottlePlacement(this.currentLevel.presentationSeed, index);
      this.addBottle(content, index, placement.x, placement.y, placement.angle, token);
    });
    this.levelMessageLabel = this.addMessage(content, this.session.message, token);
    if (this.completionSaveFailed) {
      this.addRasterButton(content, '重试保存', 'gold', 224, 72, 0, LEVEL_LAYOUT.controlY,
        () => this.persistCompletion(), false, undefined, 16);
    } else {
      this.addControlButton(content, '撤销', 'icon-undo', LEVEL_LAYOUT.controlCenters[0], () => this.handleUndo(),
        this.session.levelComplete || this.session.history.length === 0);
      this.addControlButton(content, RESTART_LABEL, 'icon-restart', LEVEL_LAYOUT.controlCenters[1], () => this.handleRestart(),
        this.session.levelComplete);
      this.addControlButton(content, this.session.game.rewardBottleUsed ? '已加瓶' : '加空瓶', 'icon-add-bottle',
        LEVEL_LAYOUT.controlCenters[2], () => { void this.handleRewardedBottle(); },
        this.session.levelComplete || this.session.game.rewardBottleUsed || this.rewardBusy);
    }
  }

  private refreshLevelContent(): void {
    if (!this.surface || this.flow.scene !== 'level') return;
    this.levelContent?.destroy();
    this.clearLevelReferences();
    this.renderLevelContent(this.surface, this.renderToken);
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
    this.refreshLevelFeedback();
  }

  private addBottle(root: Node, index: number, x: number, y: number, angle: number, token: number): void {
    const bottle = this.session.game.bottles[index];
    if (!bottle) return;
    const hitTarget = new Node(`BottleHitTarget-${index + 1}`);
    hitTarget.setPosition(x, y);
    hitTarget.addComponent(UITransform).setContentSize(64, 112);
    root.addChild(hitTarget);

    const feedback = bottleFeedbackVisual(this.session.selected === index, this.pouring.has(index));
    const node = new Node(`BottleVisual-${index + 1}`);
    node.setPosition(0, feedback.yOffset);
    node.angle = angle;
    node.setScale(new Vec3(feedback.scale, feedback.scale, 1));
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
      this.session.selected === index,
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
    this.applySessionResult(pressBottle(this.session, index));
  }

  private handleUndo(): void {
    this.resumeAudio();
    const result = undoSession(this.session);
    if (result.cue === 'undo') this.undoCount += 1;
    this.applySessionResult(result);
  }

  private handleRestart(): void {
    this.resumeAudio();
    this.unscheduleAllCallbacks();
    this.completionScheduled = false;
    this.invalid.clear();
    this.pouring.clear();
    this.applySessionResult(restartSession(this.session));
  }

  private async handleRewardedBottle(): Promise<void> {
    this.resumeAudio();
    if (!this.rewarded || this.rewardBusy || this.session.levelComplete || this.session.game.rewardBottleUsed) return;
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
    if (this.platform.isWeChat()) return REWARDED_AD_UNIT_ID ? '奖励校验失败，请稍后重试' : '请先配置微信激励广告位';
    return '广告暂不可用，请稍后重试';
  }

  private applySessionResult(result: SessionResult): void {
    if (result.session === this.session && !result.cue) return;
    const previousSession = this.session;
    this.session = result.session;
    this.invalid = new Set(result.invalid);
    this.pouring = new Set(result.pouring);
    this.audio?.play(result.cue);
    if (this.session.pendingCompletion.length === 0 && !this.session.levelComplete) {
      this.store.saveSession(this.session);
    }
    const refreshMode = levelInteractionRefreshMode(previousSession.game !== this.session.game);
    if (refreshMode === 'content') this.refreshLevelContent();
    else this.refreshLevelFeedback();
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
        this.session = completePendingBottles(this.session);
        this.completionScheduled = false;
        if (this.session.levelComplete) this.persistCompletion();
        else {
          this.store.saveSession(this.session);
          this.refreshLevelContent();
        }
      }, 1.08);
    }
  }

  private persistCompletion(): void {
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
      const feedback = bottleFeedbackVisual(this.session.selected === index, this.pouring.has(index));
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
      tween(node).to(0.18, {
        position: new Vec3(0, feedback.yOffset, 0),
        scale: new Vec3(feedback.scale, feedback.scale, 1),
      }).start();
      const particleState = potionParticleState(
        this.session.pendingCompletion.includes(index),
        this.pouring.has(index),
        this.session.selected === index,
      );
      for (const animator of this.particleAnimators.get(index) ?? []) {
        animator.setState(particleState);
      }
    }
  }

  private renderStaminaBar(root: Node, token: number): void {
    const layout = STAMINA_LAYOUT.homeBar;
    const bar = this.addPanel(root, layout.width, layout.height, layout.x, layout.y,
      color('#251134', 236), color('#E6BD70'), 18);
    bar.name = 'StaminaBar';
    bar.addComponent(Button);
    bar.on(Button.EventType.CLICK, () => {
      this.resumeAudio();
      this.staminaMessage = '';
      this.flow = openStaminaDialog(this.flow);
      this.render();
    });
    const content = staminaBarContentLayout();
    this.renderStaminaIcon(bar, 0, content.icon.x + content.icon.width / 2, content.icon.y, content.icon.width, token);
    this.homeStaminaValueLabel = this.addLabel(bar, '', 13,
      content.value.x + content.value.width / 2, content.value.y, color('#FFF0C2'), content.value.width)
      .getComponent(Label);
    this.homeStaminaValueLabel.overflow = Label.Overflow.SHRINK;
    this.homeStaminaValueLabel.enableWrapText = false;
    this.homeStaminaCountdownLabel = this.addLabel(bar, '', 9,
      content.status.x + content.status.width / 2, content.status.y, color('#D9C3E2'), content.status.width)
      .getComponent(Label);
    this.homeStaminaCountdownLabel.overflow = Label.Overflow.SHRINK;
    this.homeStaminaCountdownLabel.enableWrapText = false;
    this.refreshStaminaLabels();
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

  private renderStaminaDialog(root: Node, token: number): void {
    const shield = new Node('StaminaDialogShield');
    shield.addComponent(UITransform).setContentSize(393, 852);
    shield.addComponent(BlockInputEvents);
    root.addChild(shield);
    this.addPanel(shield, 393, 852, 0, 0, color('#090411', 184));
    const panel = new Node('StaminaDialog');
    panel.setPosition(STAMINA_LAYOUT.dialog.x, STAMINA_LAYOUT.dialog.y);
    panel.addComponent(UITransform).setContentSize(STAMINA_LAYOUT.dialog.width, STAMINA_LAYOUT.dialog.height);
    shield.addChild(panel);
    this.addSprite(panel, 'game/chibi/ui/settings-dialog-panel/spriteFrame',
      STAMINA_LAYOUT.dialog.width, STAMINA_LAYOUT.dialog.height, 0, 0, token);
    this.addLabel(panel, '体力补给', 27, 0, 148, color('#FFF2CF'), 220);
    this.addIconButton(panel, '关闭体力补给', 'icon-settings-close', STAMINA_LAYOUT.close, () => {
      this.flow = closeStaminaDialog(this.flow);
      this.render();
    });
    this.renderStaminaIcon(panel, 0, 0, 82, 64, token);
    this.staminaDialogValueLabel = this.addLabel(panel, '', 24, 0, 28, color('#FFF0C2'), 150)
      .getComponent(Label);
    this.staminaDialogCountdownLabel = this.addLabel(panel, '', 13, 0, -3, color('#DCC7E8'), 220)
      .getComponent(Label);
    this.addLabel(panel, '每 30 分钟恢复 1 点 · 上限 10 点', 11, 0, -31, color('#BDAFC4'), 250);
    const adButton = this.addRasterButton(panel, '看广告 · 恢复 5 点', 'gold',
      STAMINA_LAYOUT.adButton.width, STAMINA_LAYOUT.adButton.height,
      STAMINA_LAYOUT.adButton.x, STAMINA_LAYOUT.adButton.y,
      () => { void this.handleRewardedStamina(); }, this.rewardBusy, undefined, 16);
    this.renderStaminaIcon(adButton, 1, -92, 0, 34, token);
    if (this.staminaMessage) this.addLabel(panel, this.staminaMessage, 11, 0, -132, color('#FFE3A0'), 270);
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

  private renderExitConfirm(root: Node, token: number): void {
    const shield = new Node('ExitConfirmShield');
    shield.addComponent(UITransform).setContentSize(393, 852);
    shield.addComponent(BlockInputEvents);
    root.addChild(shield);
    this.addPanel(shield, 393, 852, 0, 0, color('#090411', 184));
    const panel = new Node('ExitConfirmDialog');
    panel.setPosition(STAMINA_LAYOUT.exitDialog.x, STAMINA_LAYOUT.exitDialog.y);
    panel.addComponent(UITransform).setContentSize(STAMINA_LAYOUT.exitDialog.width, STAMINA_LAYOUT.exitDialog.height);
    shield.addChild(panel);
    this.addSprite(panel, 'game/chibi/ui/settings-dialog-panel/spriteFrame',
      STAMINA_LAYOUT.exitDialog.width, STAMINA_LAYOUT.exitDialog.height, 0, 0, token);
    this.addLabel(panel, '返回主页？', 25, 0, 88, color('#FFF2CF'), 240);
    this.addLabel(panel, '返回主页将消耗 1 点体力', 15, 0, 34, color('#FFE3A0'), 260);
    this.addLabel(panel, '当前关卡进度会保留', 11, 0, 5, color('#DCC7E8'), 240);
    this.addRasterButton(panel, '确认返回', 'gold', STAMINA_LAYOUT.exitConfirm.width,
      STAMINA_LAYOUT.exitConfirm.height, STAMINA_LAYOUT.exitConfirm.x, STAMINA_LAYOUT.exitConfirm.y,
      () => this.confirmLevelExit(), false, 'icon-settings-home', 16);
    this.addRasterButton(panel, '继续炼金', 'purple', STAMINA_LAYOUT.exitCancel.width,
      STAMINA_LAYOUT.exitCancel.height, STAMINA_LAYOUT.exitCancel.x, STAMINA_LAYOUT.exitCancel.y, () => {
      this.flow = closeExitConfirm(this.flow);
      this.render();
    }, false, undefined, 15);
  }

  private confirmLevelExit(): void {
    if (this.completionScheduled || this.session.pendingCompletion.length > 0 || this.session.levelComplete) return;
    this.unscheduleAllCallbacks();
    this.store.saveSession(this.session);
    if (!this.staminaSpentForActiveLevel) {
      this.staminaSpentForActiveLevel = this.consumeOneStamina();
    }
    this.completionReward = null;
    this.flow = returnHome(this.flow);
    this.render();
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
    const layout = this.flow.scene === 'home' ? HOME_LAYOUT.settingsButton : SETTINGS_LAYOUT.trigger;
    const button = new Node('SettingsButton');
    button.setPosition(layout.x, layout.y);
    button.addComponent(UITransform).setContentSize(layout.width, layout.height);
    root.addChild(button);
    this.addSprite(button, 'game/chibi/ui/icon-settings-gear/spriteFrame', 48, 48, 0, 0, token);
    button.addComponent(Button);
    button.on(Button.EventType.CLICK, () => { this.resumeAudio(); this.flow = toggleSettings(this.flow); this.render(); });
  }

  private renderSettings(root: Node, token: number): void {
    const shield = new Node('SettingsShield');
    shield.addComponent(UITransform).setContentSize(393, 852);
    shield.addComponent(BlockInputEvents);
    root.addChild(shield);
    this.addPanel(shield, 393, 852, 0, 0, color('#090411', 184));
    const panel = new Node('SettingsPanel');
    panel.setPosition(SETTINGS_LAYOUT.dialog.x, SETTINGS_LAYOUT.dialog.y);
    panel.addComponent(UITransform).setContentSize(SETTINGS_LAYOUT.dialog.width, SETTINGS_LAYOUT.dialog.height);
    shield.addChild(panel);
    this.addSprite(panel, 'game/chibi/ui/settings-dialog-panel/spriteFrame', SETTINGS_LAYOUT.dialog.width,
      SETTINGS_LAYOUT.dialog.height, 0, 0, token);
    this.addLabel(panel, '设置', 27, 0, 85, color('#FFF2CF'), 200);
    this.addIconButton(panel, '关闭设置', 'icon-settings-close', SETTINGS_LAYOUT.close, () => {
      this.flow = toggleSettings(this.flow);
      this.render();
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
        this.flow = openExitConfirm(this.flow);
        this.render();
      } else this.returnToHome();
    }, false, 'icon-settings-home', 16);
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

  private addControlButton(root: Node, label: string, icon: string, x: number, action: () => void, disabled = false): void {
    const stage = Object.freeze({ x: 0, y: 0, width: 110, height: 72 });
    const node = new Node(`Control-${label}`);
    node.setPosition(x, LEVEL_LAYOUT.controlY);
    node.addComponent(UITransform).setContentSize(stage.width, stage.height);
    root.addChild(node);
    const variant = icon === 'icon-add-bottle' ? 'gold' : 'purple';
    this.decorateRasterButton(node, variant, disabled, action, buttonBaseLayout(stage, 'contain'));
    this.addSprite(node, `game/chibi/ui/${icon}/spriteFrame`, 31, 31, 0, 8, this.renderToken);
    this.addLabel(node, label, 10, 0, -25, color('#FFF9ED'), 96);
    if (icon === 'icon-add-bottle' && !this.session.game.rewardBottleUsed) {
      this.addSprite(node, 'game/chibi/ui/badge-plus/spriteFrame', 22, 22, 44, -24, this.renderToken);
    }
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
    node.on(Button.EventType.CLICK, onClick);
  }

  private addIconButton(root: Node, name: string, icon: string, layout: Readonly<{ x: number; y: number; width: number; height: number }>, onClick: () => void): Node {
    const button = new Node(name);
    button.setPosition(layout.x, layout.y);
    button.addComponent(UITransform).setContentSize(layout.width, layout.height);
    root.addChild(button);
    this.addSprite(button, `game/chibi/ui/${icon}/spriteFrame`, layout.width, layout.height, 0, 0, this.renderToken);
    button.addComponent(Button);
    button.on(Button.EventType.CLICK, onClick);
    return button;
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
    label.horizontalAlign = align;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    if (fontSize >= 18) {
      const outline = node.addComponent(LabelOutline);
      outline.color = color('#321138', 210);
      outline.width = 1.5;
    }
    return node;
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
    resources.load(path, SpriteFrame, (error, frame) => {
      if (error || token !== this.renderToken || !node.isValid) return;
      if (layout.renderMode === 'sliced') {
        frame.insetLeft = layout.sourceInset;
        frame.insetRight = layout.sourceInset;
        frame.insetTop = layout.sourceInset;
        frame.insetBottom = layout.sourceInset;
      }
      sprite.spriteFrame = frame;
    });
  }

  private resumeAudio(): void {
    this.audio?.unlockFromGesture();
    this.audio?.setEnabled(this.flow.soundEnabled);
  }
}
