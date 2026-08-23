import {
  _decorator, BlockInputEvents, Button, Color, Component, Graphics, Label, Mask,
  Node, ResolutionPolicy, resources, Sprite, SpriteFrame, sys, UITransform, Vec3, view, tween,
} from 'cc';

import {
  completePendingBottles, createGameSession, finishWitchReturn, grantRewardBottle, pressBottle, restartSession,
  settleWitch, undoSession, type GameSession, type SessionResult, type WitchMood,
} from '../core/game-session.ts';
import { DEMO_LEVEL_CONFIG } from '../core/level-config.ts';
import {
  createSceneFlow, enterSelectedLevel, returnHome, toggleSettings, toggleSound, type SceneFlowState,
} from '../core/scene-flow.ts';
import type { PotionColor } from '../core/types.ts';
import { LocalProgressStore } from '../platform/LocalProgressStore.ts';
import { PlatformRuntime } from '../platform/WeChatPlatform.ts';
import { RewardedBottleCoordinator, type RewardFlowStatus } from '../platform/rewarded-bottle.ts';
import { createPlatformStorage } from '../platform/storage-port.ts';
import { AudioDirector } from './AudioDirector.ts';
import {
  HOME_LAYOUT, LEVEL_LAYOUT, SETTINGS_LAYOUT, bottlePlacement, buttonBaseLayout, buttonSpritePath,
  shouldRenderBottle, type ButtonBaseLayout, type ButtonVariant,
} from './presentation-layout.ts';
import { WitchAnimator } from './WitchAnimator.ts';

const { ccclass } = _decorator;
const POTION_COLORS: Record<PotionColor, string> = {
  rose: '#F05B9A', violet: '#9353E6', amber: '#F29A38', cyan: '#2CC4D2',
  mint: '#63D6A5', blue: '#4C70E8', gold: '#F2CC4D', lilac: '#B77ADF',
};
const REWARDED_AD_UNIT_ID = '';

function color(hex: string, alpha = 255): Color {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  return new Color((value >> 16) & 255, (value >> 8) & 255, value & 255, alpha);
}

@ccclass('ProductionBootstrap')
export class ProductionBootstrap extends Component {
  private flow: SceneFlowState = createSceneFlow();
  private session: GameSession = createGameSession(DEMO_LEVEL_CONFIG);
  private surface: Node | null = null;
  private renderToken = 0;
  private audio: AudioDirector | null = null;
  private store = new LocalProgressStore(createPlatformStorage(sys.localStorage));
  private invalid = new Set<number>();
  private pouring = new Set<number>();
  private bottleNodes = new Map<number, Node>();
  private completionScheduled = false;
  private readonly platform = new PlatformRuntime();
  private rewarded: RewardedBottleCoordinator | null = null;
  private rewardBusy = false;

  start(): void {
    view.setDesignResolutionSize(393, 852, ResolutionPolicy.FIXED_WIDTH);
    this.session = this.store.loadSession(DEMO_LEVEL_CONFIG);
    this.flow = { ...this.flow, soundEnabled: this.store.loadSoundEnabled() };
    this.audio = this.node.getComponent(AudioDirector) ?? this.node.addComponent(AudioDirector);
    this.audio.initialize(this.flow.soundEnabled);
    const rewardPorts = this.platform.createRewardedPorts(REWARDED_AD_UNIT_ID);
    this.rewarded = new RewardedBottleCoordinator(rewardPorts.ad, rewardPorts.claims);
    this.platform.bindLifecycle(
      () => this.audio?.setForeground(true),
      () => { this.store.saveSession(this.session); this.audio?.setForeground(false); },
    );
    this.render();
  }

  onDestroy(): void {
    this.platform.dispose();
  }

  private render(): void {
    this.renderToken += 1;
    this.surface?.destroy();
    this.bottleNodes.clear();
    this.surface = new Node('ProductionSurface');
    this.node.addChild(this.surface);
    if (this.flow.scene === 'home') this.renderHome(this.surface, this.renderToken);
    else this.renderLevel(this.surface, this.renderToken);
    this.renderSettingsButton(this.surface, this.renderToken);
    if (this.flow.settingsOpen) this.renderSettings(this.surface, this.renderToken);
  }

  private renderHome(root: Node, token: number): void {
    this.addSprite(root, 'game/chibi/background/alchemy-room/spriteFrame', 393, 852, 0, 0, token);
    this.addPanel(root, 393, 852, 0, 0, color('#170D29', 34));
    const completed = this.session.game.bottles.filter((bottle) => bottle.status === 'vanished').length;
    this.addLabel(root, '暮影炼金室', 12, HOME_LAYOUT.header.x, 350, color('#DDBED2'), HOME_LAYOUT.header.width, Label.HorizontalAlign.LEFT);
    this.addLabel(root, '第 12 关', 34, HOME_LAYOUT.header.x, 316, color('#FFF4DF'), HOME_LAYOUT.header.width, Label.HorizontalAlign.LEFT);
    this.addPanel(root, 82, 28, -133, 278, color('#23102B', 194), color('#D6AFC3', 76), 14);
    this.addLabel(root, `魔药 ${completed}/8`, 12, -133, 278, color('#F3DFCF'), 78);
    this.addWitch(root, 'idle', HOME_LAYOUT.witch.x, HOME_LAYOUT.witch.y, HOME_LAYOUT.witch.width, HOME_LAYOUT.witch.height);
    this.addRasterButton(root, '继续炼金 · 第 12 关', 'purple', HOME_LAYOUT.continueButton.width,
      HOME_LAYOUT.continueButton.height, HOME_LAYOUT.continueButton.x, HOME_LAYOUT.continueButton.y, () => {
      this.resumeAudio();
      this.flow = enterSelectedLevel(this.flow, this.session.levelId, true);
      this.render();
    }, false, undefined, 18);
  }

  private renderLevel(root: Node, token: number): void {
    this.addSprite(root, 'game/chibi/background/alchemy-room/spriteFrame', 393, 852, 0, 0, token);
    this.addPanel(root, 393, 852, 0, 0, color('#130A20', 16));
    const completed = this.session.game.bottles.filter((bottle) => bottle.status === 'vanished').length;
    this.addLabel(root, '暮影炼金室', 11, -86, 350, color('#DCBACB'), 176, Label.HorizontalAlign.LEFT);
    this.addLabel(root, '第 12 关', 30, -86, 318, color('#FFF4DF'), 176, Label.HorizontalAlign.LEFT);
    this.addPanel(root, 54, 24, -147, 280, color('#221023', 184), color('#DEB5A1', 70), 12);
    this.addLabel(root, `步数 ${this.session.game.moves}`, 11, -147, 280, color('#EFD9C9'), 52);
    this.addPanel(root, 66, 24, -80, 280, color('#221023', 184), color('#DEB5A1', 70), 12);
    this.addLabel(root, `魔药 ${completed}/8`, 11, -80, 280, color('#EFD9C9'), 64);
    this.addWitch(root, this.session.witchMood, LEVEL_LAYOUT.witch.x, LEVEL_LAYOUT.witch.y,
      LEVEL_LAYOUT.witch.width, LEVEL_LAYOUT.witch.height);

    this.session.game.bottles.forEach((bottle, index) => {
      if (!shouldRenderBottle(bottle.status)) return;
      const placement = bottlePlacement(12, index);
      this.addBottle(root, index, placement.x, placement.y, placement.angle, token);
    });
    this.addMessage(root, this.session.message, token);
    this.addControlButton(root, '撤销', 'icon-undo', LEVEL_LAYOUT.controlCenters[0], () => this.handleUndo(), this.session.history.length === 0);
    this.addControlButton(root, '重开', 'icon-restart', LEVEL_LAYOUT.controlCenters[1], () => this.handleRestart());
    this.addControlButton(root, this.session.game.rewardBottleUsed ? '已加瓶' : '加空瓶', 'icon-add-bottle', LEVEL_LAYOUT.controlCenters[2], () => { void this.handleRewardedBottle(); },
      this.session.game.rewardBottleUsed || this.rewardBusy);
  }

  private addWitch(root: Node, mood: WitchMood, x: number, y: number, width: number, height: number): void {
    const node = new Node('WitchAnimator');
    node.setPosition(x, y);
    node.addComponent(UITransform).setContentSize(width, height);
    root.addChild(node);
    node.addComponent(WitchAnimator).play(mood, () => this.handleWitchSettled(mood));
  }

  private handleWitchSettled(mood: WitchMood): void {
    if (this.session.witchMood !== mood) return;
    this.session = mood === 'return' ? finishWitchReturn(this.session) : settleWitch(this.session);
    this.render();
  }

  private addBottle(root: Node, index: number, x: number, y: number, angle: number, token: number): void {
    const bottle = this.session.game.bottles[index];
    if (!bottle) return;
    const node = new Node(`Bottle-${index + 1}`);
    node.setPosition(x, y);
    node.angle = angle;
    node.addComponent(UITransform).setContentSize(LEVEL_LAYOUT.bottle.width, LEVEL_LAYOUT.bottle.height);
    root.addChild(node);
    this.bottleNodes.set(index, node);

    const selectedGlow = this.addPanel(node, 54, 110, 0, 0, color('#8A4BC4', 24), color('#E1B2FF'), 22);
    selectedGlow.name = 'SelectedGlow';
    selectedGlow.active = this.session.selected === index;
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
    bottle.layers.forEach((layer, layerIndex) => {
      const layerY = -LEVEL_LAYOUT.liquid.height / 2 + layerHeight / 2 + layerIndex * layerHeight;
      const layerNode = this.addPanel(clip, LEVEL_LAYOUT.liquid.width, layerHeight + 0.5, 0, layerY,
        color(POTION_COLORS[layer]), undefined, 1);
      this.addSprite(layerNode,
        `game/chibi/effects/particle-${layer}-${this.particleSuffix(layer)}/spriteFrame`,
        12, 12, layerIndex % 2 ? 7 : -7, 0, token);
    });
    this.addSprite(node, 'game/chibi/items/bottle-frame/spriteFrame', LEVEL_LAYOUT.bottle.width, LEVEL_LAYOUT.bottle.height, 0, 0, token);

    if (this.session.pendingCompletion.includes(index)) {
      this.addSprite(node, 'game/chibi/effects/completion-burst/spriteFrame', 78, 78, 0, 4, token);
      tween(node).to(0.3, { scale: new Vec3(1.12, 1.12, 1) })
        .to(0.78, { position: new Vec3(x > 0 ? 96 : -96, 330, 0), scale: new Vec3(0.08, 0.08, 1) }).start();
    } else if (this.pouring.has(index)) node.setScale(new Vec3(1.06, 1.06, 1));

    node.addComponent(Button);
    node.on(Button.EventType.CLICK, () => this.handleBottle(index));
  }

  private particleSuffix(layer: PotionColor): string {
    return { rose: 'heart', violet: 'star', amber: 'spark', cyan: 'bubble',
      mint: 'leaf', blue: 'snow', gold: 'dust', lilac: 'moon' }[layer];
  }

  private handleBottle(index: number): void {
    this.resumeAudio();
    this.applySessionResult(pressBottle(this.session, index));
  }

  private handleUndo(): void {
    this.resumeAudio();
    this.applySessionResult(undoSession(this.session));
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
    if (!this.rewarded || this.rewardBusy || this.session.game.rewardBottleUsed) return;
    this.rewardBusy = true;
    this.session = { ...this.session, message: '正在准备激励广告…', witchMood: 'idle' };
    this.render();
    const claimId = `level-012-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
    const result = await this.rewarded.run('level-012', claimId, this.platform.isOnline());
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
    this.session = result.session;
    this.invalid = new Set(result.invalid);
    this.pouring = new Set(result.pouring);
    this.audio?.play(result.cue);
    if (this.session.pendingCompletion.length === 0) this.store.saveSession(this.session);
    this.render();
    if (this.invalid.size > 0) this.scheduleOnce(() => { this.invalid.clear(); this.refreshBottleHighlights(); }, 0.52);
    if (this.pouring.size > 0) this.scheduleOnce(() => { this.pouring.clear(); this.refreshBottleHighlights(); }, 0.52);
    if (this.session.pendingCompletion.length > 0 && !this.completionScheduled) {
      this.completionScheduled = true;
      this.scheduleOnce(() => this.audio?.play('potion-vanish'), 0.3);
      this.scheduleOnce(() => {
        this.session = completePendingBottles(this.session);
        this.completionScheduled = false;
        this.store.saveSession(this.session);
        this.render();
      }, 1.08);
    }
  }

  private refreshBottleHighlights(): void {
    for (const [index, node] of this.bottleNodes) {
      const invalidGlow = node.getChildByName('InvalidGlow');
      if (invalidGlow) invalidGlow.active = this.invalid.has(index);
      node.setScale(this.pouring.has(index) ? new Vec3(1.06, 1.06, 1) : Vec3.ONE);
    }
  }

  private renderSettingsButton(root: Node, token: number): void {
    const button = new Node('SettingsButton');
    button.setPosition(SETTINGS_LAYOUT.trigger.x, SETTINGS_LAYOUT.trigger.y);
    button.addComponent(UITransform).setContentSize(SETTINGS_LAYOUT.trigger.width, SETTINGS_LAYOUT.trigger.height);
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
    if (this.flow.scene === 'level') this.addRasterButton(panel, '返回主页', 'gold',
      SETTINGS_LAYOUT.homeButton.width, SETTINGS_LAYOUT.homeButton.height,
      SETTINGS_LAYOUT.homeButton.x, SETTINGS_LAYOUT.homeButton.y, () => {
      this.flow = returnHome(this.flow);
      this.store.saveSession(this.session);
      this.render();
    }, false, 'icon-settings-home', 16);
  }

  private addMessage(root: Node, text: string, token: number): void {
    const node = new Node('GameMessage');
    node.setPosition(LEVEL_LAYOUT.message.x, LEVEL_LAYOUT.message.y);
    node.addComponent(UITransform).setContentSize(LEVEL_LAYOUT.message.width, LEVEL_LAYOUT.message.height);
    root.addChild(node);
    this.addSprite(node, 'game/chibi/ui/message-panel/spriteFrame', LEVEL_LAYOUT.message.width,
      LEVEL_LAYOUT.message.height, 0, 0, token);
    this.addLabel(node, text, 12, 0, 0, color('#FFF4DB'), LEVEL_LAYOUT.message.width - 40);
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
    label.horizontalAlign = align;
    label.verticalAlign = Label.VerticalAlign.CENTER;
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
