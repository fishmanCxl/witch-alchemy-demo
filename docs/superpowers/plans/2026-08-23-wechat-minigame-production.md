# 微信小游戏生产工程实施计划

> 目标：从已验收原型建立 Cocos Creator 3.x 生产客户端和 CloudBase 后端，按可测试边界逐步迁移。

## Task 1：生产工程骨架与规则核心

- 创建 `wechat-game/package.json`、`project.json`、`tsconfig.json` 和标准 `assets/scripts` 目录。
- 先写失败测试，锁定容量、连续顶层倒液、完成、消失、第 15 槽奖励和不可变状态。
- 实现 `assets/scripts/core/water-sort.ts`、`types.ts` 和 `demo-level.ts`。
- 用 Node 24 TypeScript strip-types 运行测试，保持规则层零 Cocos/微信依赖。

## Task 2：关卡、存档和资源契约

- 定义版本化 `LevelConfig`、`LocalSnapshot`、`CloudProgress` 和迁移函数。
- 创建资源同步脚本，把原型批准的 chibi、audio 和 manifest 复制到 Cocos `resources`。
- 校验所有资源路径、数量和字节预算；禁止引用 `prototype/artifacts/chibi-raw`。

## Task 3：Cocos 表现层

- 创建启动场景、首页和关卡场景。
- 创建 5×3 固定棋盘、BottleView、PotionMask、WitchAnimator、AudioDirector。
- 按原型契约接入七状态魔女动画和 34 帧独立魔法层。
- 完成瓶子选择、倒液、完成飞走、撤销、重开和设置菜单。

## Task 4：微信平台适配

- 封装 Storage、生命周期、音频解锁、网络状态和 rewarded video。
- 开发环境使用 FakeRewardedAd；生产实现只在广告完整关闭后请求云端领取。
- 奖励失败、取消、离线和重复回调都不得激活第二个空瓶。

## Task 5：CloudBase 后端

- 实现 `bootstrap`、`getGameConfig`、`syncProgress`、`claimRewardedBottle`、`submitLevelResult`。
- 添加输入校验、revision 合并、幂等键、事务、速率与异常日志。
- 添加本地 fixture 测试；配置环境 ID 通过部署参数注入，不提交到仓库。

## Task 6：集成与发布验收

- Cocos 编辑器预览、微信开发者工具、iOS/Android 真机。
- 验证触控、安全区、后台恢复、音频、断网存档、广告恢复和云端冲突。
- 检查首包/分包体积、图片纹理、音频内存和低端机帧率。

