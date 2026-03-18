# Codebase Concerns

## 重点结论
当前最值得优先处理的不是样式或命名问题，而是几类会直接影响线上正确性和可运维性的风险：初始化迁移说明与现状不一致、价格抓取对异常数据的兜底过于激进、定时检查缺少并发保护、认证链路缺少真正的限流、防护和共享契约。

## 高优先级风险

### 1. 初始化 SQL、README 与运行时代码已经漂移
涉及文件：`README.md`、`apps/worker/drizzle/0000_init.sql`、`apps/worker/drizzle/0001_price_change_events.sql`、`apps/worker/src/lib/checker.ts`、`apps/worker/src/services/prices.ts`
风险说明：`README.md` 仍把直接执行 `apps/worker/drizzle/0000_init.sql` 写成首次初始化建议，但 `0000_init.sql` 只创建了旧表 `app_price_history`，并不会创建当前代码实际读写的 `app_price_change_events`。新环境如果只按 README 执行 `0000_init.sql`，后续价格巡检写入和历史查询都可能直接报错。
影响：这是一个真实的 fresh install / 灾备恢复风险，且排查成本高，因为表面上数据库“初始化成功”，实际运行期才失败。
建议：尽快统一初始化路径，只保留 `drizzle` 当前 schema 或补齐单一基线 SQL，并把 `README.md` 改成完整迁移链路。

### 2. App Store 返回缺失价格时会被当成 `0` 元
涉及文件：`apps/worker/src/lib/appstore.ts`、`apps/worker/src/lib/checker.ts`
风险说明：`fetchAppStorePrice` 在 `item.price` 不是 number 时直接回落到 `0`。这会把“接口字段缺失”“某地区暂不可售”“苹果返回结构变化”与“真实免费”混为一谈。
影响：可能产生假降价事件、错误的 `app_snapshots` 快照、错误邮件提醒，且这些错误一旦写库就会污染公开降价流和历史详情。
建议：把“价格缺失”视为异常或无效结果，至少不要写入 `0`；同时记录原始 `formattedPrice` 或异常原因，避免把脏数据当真实价格。

### 3. 手动巡检与定时巡检没有互斥，且单次刷新不是事务性的
涉及文件：`apps/worker/src/index.ts`、`apps/worker/src/lib/checker.ts`
风险说明：`POST /api/jobs/check` 和 `scheduled` 都会直接调用 `runPriceCheck`，但没有分布式锁、租约表或 request 去重。`refreshSingleApp` 又把“读取旧快照、更新快照、写价格变化、写降价事件、发邮件、更新订阅状态”拆成多次独立写操作。
影响：一旦手动触发和 cron 重叠，或未来引入多实例并发执行，同一 `(appId, country)` 可能重复发邮件、重复写降价事件，甚至在中间失败后留下“快照已更新但事件丢失”的不可逆状态。
建议：给 `runPriceCheck` 增加全局锁/租约；给单个应用刷新增加事务边界，至少保证快照与事件落库的一致性。

### 4. 手动巡检接口在未配置 `CRON_SECRET` 时默认裸奔
涉及文件：`apps/worker/src/index.ts`、`README.md`
风险说明：`/api/jobs/check` 只有在 `CRON_SECRET` 存在时才校验请求头，当前 README 还把 `CRON_SECRET` 说明为“常用可选”。
影响：生产环境一旦漏配，任何人都能触发整库巡检，造成外部 API 压力、数据库压力和邮件侧副作用，也会让重叠执行风险被放大。
建议：把 `CRON_SECRET` 改为生产必填，或在生产环境直接禁用手动入口，仅保留 Cloudflare 原生 scheduled trigger。

### 5. 认证链路缺少真正的限流与爆破保护
涉及文件：`apps/worker/src/routes/auth.ts`、`apps/worker/src/services/auth.ts`
风险说明：密码登录、验证码登录、验证码发送、找回密码都没有 IP 级或账号级限流。`sendLoginCode` 只有“最近一次发送冷却”，`verifyLoginCode` 则没有错误次数限制，6 位 OTP 在有效期内可以被持续试探。
影响：存在凭证爆破、验证码撞库、邮件通道滥用和成本失控风险，尤其在公开 API 部署后会成为最先被打的入口。
建议：增加 Cloudflare 边缘限流、失败计数、验证码错误锁定和审计日志；至少先覆盖 `login`、`verify-login-code`、`send-login-code`、`forgot-password` 四个端点。

### 6. 验证码与重置令牌的生命周期管理不一致
涉及文件：`apps/worker/src/services/auth.ts`
风险说明：`sendLoginCode` 发送失败会尝试回滚数据库记录，但不会废弃同用户此前未过期的旧验证码；`requestPasswordReset` 则在邮件发送前先写 token，发送失败后也不回滚，因此一个用户可能同时保留多枚有效令牌。
影响：安全策略难以推理，支持排障时也难判断“哪个码/哪个链接还有效”；表内历史脏数据也会越积越多。
建议：改成“单用户单有效验证码/单有效重置令牌”，新发放时显式作废旧记录，并统一失败回滚策略。

## 可靠性与性能风险

### 7. 定时检查是严格串行的，订阅规模上来后会撞上执行时长上限
涉及文件：`apps/worker/src/lib/checker.ts`、`apps/worker/src/constants/routes.ts`、`apps/worker/wrangler.toml`
风险说明：`runPriceCheck` 按 `(appId, country)` 去重后逐个串行刷新，并且每次之间固定 sleep 节流。当前测试只验证了节流逻辑安全，并没有解决规模增长后的吞吐问题。
影响：当监控对数增长到数百甚至上千时，单轮任务会明显拉长，可能跨越下一个 cron 窗口，进一步制造重叠执行和数据延迟。
建议：后续考虑分片、队列化、批次 checkpoint，或至少把“全量巡检”拆成可恢复的分页任务。

### 8. `getDb` 每次调用都重新构造 Neon client，热点路径重复开销较大
涉及文件：`apps/worker/src/db/client.ts`、`apps/worker/src/lib/checker.ts`、`apps/worker/src/services/auth.ts`
风险说明：当前 `getDb` 每次都会调用 `neon(env.DATABASE_URL)` 再包一层 `drizzle`。在认证中间件、服务函数和巡检循环里，这个工厂会被高频触发。
影响：虽然不一定立刻出错，但它是明显的性能热点和可观测性盲区，后续一旦数据库延迟波动，问题会被放大。
建议：把 DB client 做成请求级或模块级复用，并为慢查询/失败次数补充日志或指标。

### 9. 公共降价流的查询策略会随着数据增长变得昂贵
涉及文件：`apps/worker/src/services/public.ts`、`apps/worker/src/routes/public.ts`、`apps/web/src/views/home/HomeView.vue`
风险说明：公开首页先从 `app_drop_events` 拉最多 2000 条记录做内存去重，再把结果拼成一个很长的 `OR` 条件去统计订阅人数；同时接口没有显式缓存头，首页每次打开都会直击数据库。
影响：当降价事件和订阅量增长后，首页会成为最早出现慢查询和热点放大的页面；数据库会同时承担 feed、聚合和订阅计数三种负担。
建议：把公开 feed 改成预聚合/物化视图/缓存层，或者至少把 `submissionCount` 做成异步统计字段，避免在线拼接大 `OR`。

### 10. 前端多个页面都会一次性拉取超长历史，且缺少取消与缓存
涉及文件：`apps/web/src/views/profile/ProfileView.vue`、`apps/web/src/views/app/AppDetailView.vue`、`apps/worker/src/services/prices.ts`
风险说明：详情页和工作台历史都直接请求 `limit=3650`。`AppDetailView.vue` 和 `ProfileView.vue` 都没有 `AbortController`、结果缓存或分页，只要用户频繁切换应用，就会反复下载大 payload 并重新做前端计算。
影响：在价格事件增多时，客户端渲染和网络往返都会明显变重，移动端体验更容易退化。
建议：把价格历史改成分页/时间窗口加载，并在前端加请求取消与结果缓存。

## 安全与前端脆弱点

### 11. Bearer token 放在 `localStorage`，路由守卫只检查“是否有字符串”
涉及文件：`apps/web/src/lib/auth-session.ts`、`apps/web/src/router.ts`、`apps/worker/src/middleware/auth.ts`
风险说明：前端把长期 session token 持久化到 `localStorage`，这天然扩大了 XSS 的后果面；同时路由守卫只看 token 是否存在，不看过期时间，也不预验证会话。
影响：一旦前端出现 XSS，token 很容易被直接窃取；另外过期 token 会先通过页面守卫，再在页面加载后因为 `401` 被动清理，造成体验抖动。
建议：中长期应迁移到 HttpOnly cookie 或更短寿命的 access token + refresh 方案；短期至少把过期时间一起存储并在路由层做前置判断。

### 12. 前后端 DTO 完全手写，已经出现契约漂移迹象
涉及文件：`apps/worker/src/routes/auth.ts`、`apps/worker/src/services/subscriptions.types.ts`、`apps/web/src/views/profile/ProfileView.vue`、`apps/web/src/views/security/SecurityView.vue`、`apps/web/src/types/prices.ts`
风险说明：`/api/auth/me` 只返回 `user`，但 `ProfileView.vue` 与 `SecurityView.vue` 都维护了 `sessionExpiresAt` 展示位，刷新后这个字段实际上拿不到。`POST /api/subscriptions` 后端返回的是 `Subscription`，而前端在 `ProfileView.vue` 中把返回值按 `SubscriptionItem` 使用，甚至读取并不存在的 `currency` 字段。
影响：这类问题不会第一时间在编译期暴露，却会持续制造 UI 空字段、默认值退化和未来接口升级时的隐性回归。
建议：把 API schema 抽成共享包或至少共享 Zod/TS DTO，避免 `apps/web` 和 `apps/worker` 各自维护一套近似但不一致的类型。

## 测试薄弱点

### 13. 现有测试覆盖很窄，前端为零测试
涉及文件：`apps/worker/test/auth.test.ts`、`apps/worker/test/checker.price-change.test.ts`、`apps/worker/test/scheduler.rate-limit.test.ts`、`apps/web/src`
风险说明：当前 worker 只有 3 个测试文件，主要覆盖密码哈希兼容、价格变化事件写入、定时任务节流与重试；`apps/web/src` 下没有任何测试文件。
缺口：缺少订阅创建/删除、公开 feed 去重、`/api/jobs/check` 鉴权、邮件发送失败回滚、CORS 规则、认证限流、前端路由守卫、鉴权状态恢复、价格详情图表渲染等回归测试。
建议：优先补服务层和路由层集成测试，再补最薄弱的前端登录/工作台 happy path。

## 后续重构热点

### 14. 前端鉴权与请求逻辑已经在多个页面复制
涉及文件：`apps/web/src/views/auth/AuthView.vue`、`apps/web/src/views/profile/ProfileView.vue`、`apps/web/src/views/security/SecurityView.vue`、`apps/web/src/lib/http.ts`
热点说明：`apiRequest`、session 恢复、`401` 清理、toast 错误处理在多个页面重复存在，行为稍有修改就需要多点同步。
建议：抽成统一的 `useApiClient` / `useAuthSession` 组合式函数，避免后续继续分叉。

### 15. 巡检模块职责过于集中，后续改动容易牵一发而动全身
涉及文件：`apps/worker/src/lib/checker.ts`
热点说明：同一个模块同时承担 App Store 请求编排、节流重试、快照落库、事件落库、邮件发送、legacy metric 采集和最终报表生成。
建议：至少拆成“抓取层”“持久化层”“通知层”“任务编排层”，这样后续无论接入队列、补事务还是加指标都更容易落地。

### 16. Worker 环境类型与真实配置项不完全同步
涉及文件：`apps/worker/src/types.ts`、`apps/worker/src/env.ts`
热点说明：`env.ts` 已支持 `PRICE_CHECK_MAX_CALLS_PER_MINUTE`、`PRICE_CHECK_RETRY_*`、`PRICE_CHECK_MAX_RETRIES` 等配置，但 `types.ts` 里的 `WorkerBindings` 没有同步这些字段。
建议：把 env schema 与 bindings 类型合并维护，减少“配置可用但类型系统看不见”的漂移。
