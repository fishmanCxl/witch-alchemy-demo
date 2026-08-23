# 暮影炼金室 — Cocos Creator 生产客户端

使用 Cocos Creator 3.8.8 打开本目录。首个运行场景是 `assets/scenes/Main.scene`；打开后使用 Preview 验证首页、选关、关卡和结算流程。

## 第一章关卡

- 第一章发布第 1–15 关，运行时只读取 `assets/scripts/core/level-data.generated.ts` 静态目录。
- 第 1–3 关是人工教学配置；第 12 关初始棋盘保持旧演示关完全一致；其余关卡由离线确定性生成器创建并经求解器筛选。
- 难度指标和生成种子记录在 `assets/scripts/core/level-generation-report.json`，综合难度非递减。
- 生成器与求解器只位于 `tools/`，不会进入 Cocos 运行时依赖图。

重新生成或检查已发布目录：

```powershell
node --experimental-strip-types tools/generate-levels.ts
node --experimental-strip-types tools/generate-levels.ts --check
```

也可在具备全局 Node.js 的环境使用：

```powershell
npm run generate:levels
npm run check:levels
```

## 代码边界

- `assets/scripts/core`：无框架 TypeScript 规则、关卡目录、会话、进度和版本化数据模型。
- `assets/scripts/presentation`：Cocos 节点、单启动场景内的页面渲染、动画和音频时序。
- `assets/scripts/platform`：微信存储、生命周期、网络、广告和 CloudBase 适配器。
- `assets/resources/game`：从已批准原型资源同步的运行时美术、音频和配置。
- `tools`：仅发布阶段使用的确定性关卡生成器、求解器和构建辅助脚本。

## 本地数据所有权

- 全局进度：`witch-water-sort:progress:v2`
- 单关快照：`witch-water-sort:session:<levelId>:v2`
- 声音偏好：`witch-water-sort:sound-enabled`
- 旧第 12 关：`witch-water-sort:level-012:v1`
- 迁移标记：`witch-water-sort:migration:level-012:v2`

全局解锁/最佳步数与逐关棋盘分开保存。配置版本不匹配或快照损坏时，只回退该关初始棋盘，不清除全局解锁和最佳成绩。首次迁移有效旧快照时，当前关和最高解锁关设为第 12 关，但不会伪造第 1–11 关通关记录；旧键会保留。

通关时先同步保存本地全局进度，再清除该关快照并显示结算。CloudBase 同步和完成遥测在此后异步执行，失败不回滚本地进度。

## 自动化验证

微信端全部 Node 测试：

```powershell
node --experimental-strip-types --test tests/*.test.ts
```

CloudBase（从仓库根目录进入 `cloudbase`）：

```powershell
node tools/prepare-functions.mjs
node --test tests/*.test.mjs
```

`prepare-functions.mjs` 会把主运行时复制到五个云函数；提交前应确认六份 `runtime.js` 哈希一致。

## Cocos Creator 3.8.8 验收

1. 打开工程并等待新脚本导入完成；保留 Cocos 自动生成的 `.meta` 文件。
2. 确认控制台没有 TypeScript、组件或资源导入错误。
3. Preview 验证：新玩家第 1 关、第 1–2 关教学、5×3 选关锁定状态、两关切换与恢复、旧第 12 关迁移、奖励瓶后重开、普通通关和下一关解锁、第 15 关章节结算、各页面设置、离线普通保存及在线奖励失败提示。
4. 完成实际导入和 Preview 前，不应宣称 Cocos 场景或微信构建兼容。

不要提交 CloudBase 环境 ID、微信广告位 ID、OPENID、密钥或管理员凭据；这些值必须由构建或部署环境注入。
