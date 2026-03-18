# App Store Price Radar

## What This Is

App Store Price Radar 是一个基于 Cloudflare Worker 的 Apple App Store 价格监听平台，面向希望持续跟踪某个 App 在不同国家或地区价格变化的用户。现有系统已经具备账号体系、订阅管理、定时巡检、价格变化事件落库、降价邮件提醒、公开降价流和前端详情页等核心能力；本次初始化会把这些既有能力沉淀为正式项目上下文，并把下一阶段重点放在正确性、安全性和可运维性上。

## Core Value

用户订阅的 App 必须能被持续、准确、可解释地监控，并在真实降价时收到可信且不重复的提醒。

## Requirements

### Validated

- ✓ 用户可以通过邮箱注册、密码登录和邮箱验证码登录进入系统
- ✓ 用户可以按 `appId + 国家/地区` 创建、查看和删除价格监听订阅
- ✓ 系统会定时抓取订阅中的 App 价格，并仅在价格变化时写入历史事件
- ✓ 系统会在真实降价且满足订阅条件时发送邮件提醒
- ✓ 前端已经提供公开降价流、个人工作台、账号安全页和 App 详情历史页

### Active

- [ ] 统一数据库初始化、迁移链路和部署文档，确保新环境可以一次性正确启动
- [ ] 提升价格抓取、快照更新、变化事件和通知状态的一致性，避免脏数据与误报
- [ ] 补齐认证入口、手动任务触发和会话处理的安全防护，降低爆破与误用风险
- [ ] 收敛前后端 API 契约、补齐详情页关键决策信息并补上关键测试，减少 DTO 漂移、页面抖动和回归风险
- [ ] 优化公开降价流与价格历史链路的性能、可观测性和发布验证体验

### Out of Scope

- 原生 iOS / Android 客户端 — 当前 Web SPA 已能覆盖核心使用流程，优先保证监控闭环可靠
- 覆盖 Google Play、Steam 等其他商店 — 当前产品价值聚焦 Apple App Store，跨商店会显著放大数据模型与采集复杂度
- 高频实时抓价或分钟级推送 — 当前更适合低运维、可控成本的定时巡检模式
- 社交化、评论、排行榜推荐等社区能力 — 不服务当前核心价值，会分散交付重心

## Context

- 这是一个 brownfield 项目：仓库已经包含 `apps/web` 与 `apps/worker` 两个应用，且现有功能闭环基本可用。
- Web 端使用 `Vue 3 + Vite + Vue Router + Tailwind CSS v4`；API 与定时任务运行在 `Cloudflare Worker + Hono + Drizzle ORM + Neon Postgres` 上。
- 现有业务主线是“订阅 App -> 定时抓价 -> 检测变化 -> 写入历史/降价事件 -> 满足条件时发邮件 -> 前端展示”。
- 已有 codebase map 明确指出多项高优先级风险：初始化 SQL 与运行时 schema 漂移、缺失价格被写成 `0`、巡检无互斥且单应用刷新非事务、认证入口缺少限流、`/api/jobs/check` 在漏配 `CRON_SECRET` 时可能裸奔、前后端 DTO 已出现漂移迹象。
- 现有自动化测试主要覆盖 Worker 的局部核心逻辑，前端尚无测试；如果不尽快补齐回归保护，后续迭代会放大线上不确定性。

## Constraints

- **Tech stack**: 继续使用 `pnpm workspace + Vue 3 SPA + Cloudflare Worker + Hono + Drizzle + Neon` — 现有代码、部署方式和团队上下文都围绕这套栈构建
- **Deployment**: 前端部署在 Netlify、后端部署在 Cloudflare Workers — 需要维持无服务器、低运维的交付模式
- **Correctness**: 价格快照、变化事件和降价提醒必须反映真实 App Store 状态 — 错误数据会直接伤害用户信任
- **Rate limits**: App Store 查询和 Worker 运行时长都受限 — 巡检必须控制频率、重试和并发
- **Security**: 系统包含登录、验证码、密码重置和手动任务入口 — 必须防止爆破、滥用与敏感 token 泄露面扩大
- **Testing**: 当前回归保护不足，新增或修复工作必须同步补关键测试 — 否则无法稳定迭代

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 保持 brownfield 演进，不推倒重写 | 现有产品能力已经形成闭环，重写只会延迟价值并放大迁移风险 | — Pending |
| 路线图优先处理正确性、安全性和可运维性，再考虑新增大功能 | 当前最主要风险来自线上信任与稳定性，而不是功能缺失 | — Pending |
| 继续采用 Web-first + Cloudflare Worker + Neon 的部署形态 | 现有边界清晰、成本可控，适合价格监听类产品 | ✓ Good |
| 将 codebase concern 中的高风险问题纳入正式需求，而不是仅作为技术债备注 | 这些问题已经直接影响产品核心价值和可发布性 | — Pending |
| 详情页优先展示影响购买或继续关注决策的 App 信息，而不是追求全量元数据首屏堆叠 | 决策相关信息能提升产品价值，但无差别堆字段会损伤可读性与页面稳定性 | — Pending |

---
*Last updated: 2026-03-18 after adding app detail metadata direction*
