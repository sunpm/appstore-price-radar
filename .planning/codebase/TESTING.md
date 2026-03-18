# 测试实践

## 当前测试框架与入口
- 目前只有 Worker 包配置了自动化测试，脚本定义在 `apps/worker/package.json`，命令是 `vitest run`。
- 仓库中未看到单独的 `vitest.config.*`，说明 `apps/worker/test` 目前依赖 Vitest 默认约定执行。
- 前端 `apps/web` 只有 `build`、`typecheck`、`lint`、`preview`，当前没有组件测试、单元测试或端到端测试脚本。
- 从文件分布看，测试覆盖重点放在 Worker 的安全性与核心业务逻辑，而不是 UI 层。

## 测试目录布局
- 测试目录固定在 `apps/worker/test`，采用 `*.test.ts` 命名。
- `apps/worker/test/auth.test.ts` 关注密码哈希与兼容性，是纯函数/算法级单元测试。
- `apps/worker/test/checker.price-change.test.ts` 覆盖价格变更持久化和价格历史读取，属于带较重 mock 的业务逻辑测试。
- `apps/worker/test/scheduler.rate-limit.test.ts` 覆盖定时检查的频控与重试策略，同时直接读取 `apps/worker/wrangler.toml` 验证 cron 安全边界。
- 目前没有位于 `apps/web/src`、`apps/web/test`、仓库根目录 `test` 的测试文件。

## Mock 边界
- 数据库边界统一 mock `apps/worker/src/db/client.ts` 导出的 `getDb()`，而不是连带 mock 每一个 service；示例见 `apps/worker/test/checker.price-change.test.ts` 与 `apps/worker/test/scheduler.rate-limit.test.ts`。
- 测试里常用 `vi.hoisted()` 预先创建共享引用，再在 `vi.mock()` 中返回这些可变引用，避免模块导入顺序导致 mock 失效。
- `apps/worker/test/checker.price-change.test.ts` 通过内存态 `DbState` + `createDbMock()` 模拟 Drizzle 链式 API，只实现当前用例需要的 `select`、`insert`、`onConflictDoUpdate`、`onConflictDoNothing`。
- 外部网络边界不会直接打真实请求，App Store 查询在 `apps/worker/test/checker.price-change.test.ts` 里 mock `apps/worker/src/lib/appstore.ts` 的 `fetchAppStorePrice`。
- 通知与副作用边界同样被替换，`apps/worker/test/checker.price-change.test.ts` 直接 mock `apps/worker/src/lib/alerts.ts`，避免发真实邮件。
- 非核心统计依赖也会被 mock 掉，例如两个测试文件都替换了 `apps/worker/src/services/auth.ts` 中的 `countLegacyPasswordHashUsers()`。
- 环境对象通常不依赖真实 `.env`，而是通过 `createEnv()` 在测试里构造最小 `EnvConfig`，示例见 `apps/worker/test/checker.price-change.test.ts` 与 `apps/worker/test/scheduler.rate-limit.test.ts`。
- 时间相关逻辑会显式冻结，`apps/worker/test/checker.price-change.test.ts` 使用 `vi.useFakeTimers()` 和 `vi.setSystemTime()` 保证事件时间戳可预测。
- 回退、退避、节流等随机行为会通过依赖注入去掉不确定性，例如 `apps/worker/src/lib/checker.ts` 的 `runPriceCheck()` 可注入 `sleep`、`random`、`refreshSingleApp`，对应测试把 `random` 固定为 `() => 0`。

## 已有测试模式
- 用例标题偏行为描述，不写实现细节，例如 “does not insert history event when observed price does not change” 和 “retries 429 and transient failures with bounded backoff instead of tight loops”。
- 算法级测试倾向调用真实实现而非深度 mock，例如 `apps/worker/test/auth.test.ts` 直接验证 `apps/worker/src/lib/auth.ts` 的 `hashPassword()` 与 `verifyPassword()`。
- 兼容性测试会用真实库手工构造旧格式数据，再断言新实现仍可识别；`apps/worker/test/auth.test.ts` 使用 `@noble/hashes/pbkdf2.js` 生成 legacy hash。
- 业务逻辑测试倾向断言最终状态，而不是只断言函数被调用，例如 `apps/worker/test/checker.price-change.test.ts` 会检查 `dbState.events` 的长度、字段值和时间戳。
- 历史结果相关测试会显式验证顺序语义，`apps/worker/test/checker.price-change.test.ts` 断言 `getPriceHistory()` 返回的是按时间正序排列后的事件列表。
- 频控相关测试直接断言毫秒级 sleep 参数，`apps/worker/test/scheduler.rate-limit.test.ts` 校验 15s/30s 指数退避和 5s 请求间隔。
- 配置安全测试可以直接读取仓库文件本身，而不一定通过业务函数间接验证；当前示例是读取 `apps/worker/wrangler.toml` 确认 cron 不会过于激进。
- 当 service 返回联合类型时，测试会先用 `if ('error' in result.body)` 做类型收窄，再写成功分支断言，见 `apps/worker/test/checker.price-change.test.ts`。

## 当前缺口
- 没有 Hono 路由级测试，`apps/worker/src/routes/auth.ts`、`apps/worker/src/routes/subscriptions.ts`、`apps/worker/src/routes/public.ts`、`apps/worker/src/routes/prices.ts` 目前都缺少请求/响应级覆盖。
- `apps/worker/src/middleware/auth.ts` 没有独立测试，像 Bearer token 解析、过期 session、`lastUsedAt` 更新时间这些行为还未被显式验证。
- `apps/worker/src/env.ts` 和 `apps/worker/src/lib/zod.ts` 没有测试，意味着环境变量默认值、边界值、空字符串预处理逻辑尚未锁定。
- `apps/worker/src/lib/cors.ts` 没有测试，精确域名、通配域名、无 Origin、未命中返回 `'null'` 的分支都属于当前空白。
- `apps/worker/src/lib/appstore.ts` 没有直接测试，当前没有验证 App Store schema 解析、URL 提取、无结果返回 `null`、异常状态抛错等分支。
- `apps/worker/src/lib/email-client.ts`、`apps/worker/src/lib/auth-emails.ts`、`apps/worker/src/lib/alerts.ts` 没有测试，邮件发送失败、缺少 message id、模板文案构造都没有回归保护。
- `apps/worker/src/services/public.ts` 与 `apps/worker/src/services/subscriptions.ts` 缺少专门测试，像 dedupe、submissionCount 聚合、订阅 upsert、软删除 404 等行为仍依赖人工验证。
- `apps/worker/src/services/auth.ts` 虽然是业务核心，但当前只间接通过哈希测试覆盖了很小一部分；登录、注册、登录码冷却、重置密码、修改密码基本都没有自动化回归。
- `apps/worker/src/index.ts` 的 `fetch` / `scheduled` 入口没有集成测试，`/api/jobs/check` 的 `CRON_SECRET` 校验和 `app.onError()` 的兜底响应都未锁定。
- `apps/web` 完全没有自动化测试，`apps/web/src/router.ts` 的鉴权跳转、`apps/web/src/views/home/HomeView.vue` 的错误提示、`apps/web/src/views/auth/AuthView.vue` 的多模式流程、`apps/web/src/views/profile/ProfileView.vue` 的表单逻辑都没有测试保护。
- 目前也没有跨包的端到端测试，前端 `VITE_API_BASE`、Worker `CORS_ORIGIN`、认证 token 存储与 API 响应之间的联动仍主要依赖手工联调。
- 仓库内未见 coverage 脚本或阈值配置；在这种状态下，补测试时更应该优先挑“高副作用 + 高状态复杂度”模块，例如 `apps/worker/src/lib/checker.ts`、`apps/worker/src/services/auth.ts`、`apps/web/src/views/auth/AuthView.vue`。

## 对后续补测最有参考价值的现成样板
- 需要 mock Drizzle 链式调用时，优先参考 `apps/worker/test/checker.price-change.test.ts` 的 `createDbMock()` 结构，不要在每个用例里重复搭假数据库。
- 需要验证时间、重试、节流时，优先参考 `apps/worker/test/scheduler.rate-limit.test.ts` 的依赖注入写法，把 `sleep`、`random` 等非确定性依赖显式传入。
- 需要验证兼容性算法时，优先参考 `apps/worker/test/auth.test.ts` 的做法：尽量调用真实实现，只把输入数据构造成历史格式。
- 如果后续要补前端测试，现有页面的状态组织最好先围绕 `apps/web/src/views/auth/composables/useAuthFeedback.ts`、`apps/web/src/lib/http.ts` 这类可拆分逻辑做单元测试，再补页面级集成测试。
