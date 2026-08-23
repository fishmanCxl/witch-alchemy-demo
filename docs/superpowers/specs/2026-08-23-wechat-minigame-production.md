# 微信小游戏生产工程设计

**状态：** 已确认，2026-08-23

## 目标

把已经通过浏览器验证的魔女炼金水排序原型迁移为 Cocos Creator 3.x + TypeScript 微信小游戏工程，同时保留 React/Vite 原型作为视觉和交互基准，不把 React 运行时带入小游戏包。

## 工程边界

- `prototype/`：继续作为视觉、动画节奏、音频和交互验收基准。
- `wechat-game/`：Cocos Creator 生产客户端，包含纯规则层、Cocos 表现层、微信平台适配层和本地资源。
- `cloudbase/`：CloudBase 云函数和数据库规则，不存放环境 ID、密钥或 OPENID。
- `shared-contracts/`：客户端和云函数共用的 JSON 数据契约；第一阶段可以由生成脚本同步到两端。

## 技术决策

- Cocos Creator 3.x，竖屏设计基准 393×852，TypeScript。
- 水排序规则保持纯函数，不导入 `cc`、`wx` 或云开发 API，可由 Node 直接测试。
- Cocos 节点负责输入、动画、粒子、声音和生命周期；规则层只返回不可变状态和事件结果。
- 本地存档先写微信 Storage，云端同步使用 revision 合并；普通关卡可离线，广告奖励必须在线领取。
- 广告通过接口适配，开发环境使用可控假实现，生产环境才创建 `wx.createRewardedVideoAd`。
- CloudBase 从调用上下文取得 OPENID，客户端永远不提交身份字段。

## 第一里程碑

1. 可被 Cocos Creator 识别的项目骨架。
2. 纯 TypeScript 水排序核心、关卡模型和存档版本模型。
3. 与原型完全一致的演示关卡和第 15 槽奖励瓶规则。
4. Node 自动测试覆盖合法倒液、完成、消失、奖励幂等和快照升级。
5. 资源同步清单明确，但不修改原型受保护运行时。

## 后续里程碑

- 棋盘与瓶子 Prefab、受控随机位置、药液裁切和粒子。
- 七状态魔女帧动画、独立魔法层、完整音频导演。
- 首页、关卡、统一设置、进度保留和广告奖励流程。
- CloudBase bootstrap/config/sync/reward/result 五个函数。
- 微信开发者工具、安卓/iOS 真机和分包体积验收。

