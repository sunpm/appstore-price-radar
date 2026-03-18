# Pitfalls Research

**Domain:** App Store 价格监听与降价提醒平台（brownfield）
**Researched:** 2026-03-18
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: 初始化迁移与运行时 schema 漂移

**What goes wrong:**
新环境按文档初始化后可以启动数据库，但运行到价格历史或巡检链路时才发现缺表或表结构不匹配。

**Why it happens:**
文档、SQL 基线和当前 Drizzle schema 没有保持同步，fresh install 走的是旧路径。

**How to avoid:**
统一单一迁移入口，确保文档、SQL、Drizzle schema 和 smoke path 一起更新。

**Warning signs:**
首次部署成功但 `prices`/`checker` 相关接口在运行期才报 “relation does not exist”。

**Phase to address:**
Phase 1

---

### Pitfall 2: 缺失价格被当成真实 `0` 元

**What goes wrong:**
第三方返回缺失字段、地区不可售或 schema 变化时，被错误写成免费或降价。

**Why it happens:**
采集层把异常值当作业务默认值处理，而不是明确标记为无效结果。

**How to avoid:**
把“没有有效价格”视为异常分支；记录原因，拒绝写入快照和降价事件。

**Warning signs:**
出现异常大量的 `0` 价格、突然爆发的降价事件或邮件提醒与 App Store 实际页面不符。

**Phase to address:**
Phase 2

---

### Pitfall 3: 巡检并发与半完成写入导致重复提醒

**What goes wrong:**
手动巡检和 cron 重叠，或者单应用刷新在中途失败，导致重复事件、重复邮件、快照与历史不一致。

**Why it happens:**
当前链路缺少任务互斥与单刷新一致性边界。

**How to avoid:**
为巡检增加互斥/租约；为单应用刷新定义原子性与幂等边界，并补对应测试。

**Warning signs:**
同一时间窗口出现重复 drop event、重复邮件，或发现快照已更新但历史事件缺失。

**Phase to address:**
Phase 2 / Phase 3

---

### Pitfall 4: 认证入口可被爆破或滥用

**What goes wrong:**
密码登录、验证码发送、验证码验证和密码重置被持续试探，邮件通道被滥发。

**Why it happens:**
接口缺少 IP / 账号级限流、失败次数限制和令牌淘汰策略。

**How to avoid:**
为高风险认证入口增加速率限制、失败锁定和单用户单有效凭证策略。

**Warning signs:**
同账号短时间出现大量验证码尝试、邮件发送量异常、日志里出现持续的 401 / 400 尝试。

**Phase to address:**
Phase 3

---

### Pitfall 5: 手动巡检入口在漏配密钥时对公网开放

**What goes wrong:**
生产环境只要忘记设置 `CRON_SECRET`，任何人都可能触发全量巡检。

**Why it happens:**
安全配置被当成“可选”，而不是生产前置条件。

**How to avoid:**
把手动巡检鉴权改成强制前提；缺失关键配置时显式拒绝暴露入口或直接报错。

**Warning signs:**
生产环境存在未鉴权的 `/api/jobs/check` 可被成功调用。

**Phase to address:**
Phase 3

---

### Pitfall 6: 契约漂移和前端无测试让问题只在用户手里暴露

**What goes wrong:**
后端接口字段变化、页面依赖不存在字段、401 处理不一致，最终表现为 UI 空字段、状态抖动或误报错误。

**Why it happens:**
前后端 DTO 分离维护，前端又缺少自动化测试。

**How to avoid:**
共享契约来源，收敛通用请求逻辑，并补关键前端/Worker 回归测试。

**Warning signs:**
同一接口在不同页面表现不一致，或字段变更没有在编译期暴露。

**Phase to address:**
Phase 4 / Phase 5

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| 文档和迁移分开维护 | 短期改动快 | fresh install 漂移、排障成本高 | 不可接受 |
| 页面各自实现 `apiRequest` 与 401 处理 | 局部开发快 | 行为分叉、修一个漏多个 | 仅在原型期可接受 |
| 先把历史数据全量拉回前端再算 | 实现简单 | payload 和渲染成本持续放大 | 只在数据量极小时暂时接受 |
| 把通知发送耦合在高副作用刷新函数里 | 少写抽象 | 难测、难加幂等、异常恢复差 | 不可接受 |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Apple Lookup API | 把字段缺失视为 `0` 价格 | 区分真实免费与无效结果，必要时跳过写入 |
| Neon / Drizzle | 只更新 SQL 或只更新 schema | 把 schema、迁移和 smoke 验证视为一个整体 |
| Resend | 邮件失败后不处理凭证/通知状态 | 明确失败回滚或后续重试策略 |
| Cloudflare Cron / 手动触发 | 认为“偶尔重复执行无所谓” | 为任务运行增加互斥和明确统计 |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| 严格串行巡检 | 单轮任务越来越长，逼近下一次 cron | 加入租约、分片、批次恢复能力 | 监控 pair 达到数百后明显恶化 |
| 首页在线聚合去重与关注数 | 首页查询变慢、数据库热点升高 | 预聚合、缓存或更轻的统计模型 | 降价事件和订阅量持续增长后 |
| 详情页固定拉 `limit=3650` | 切换页面时卡顿、下载体积大 | 分页/时间窗口、请求取消与缓存 | 历史数据积累到长期后 |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| 长期 Bearer token 只存在 `localStorage` 且前端只检查“有没有字符串” | XSS 后果扩大，会话体验抖动 | 至少增加失效前置判断与统一 401 处理，后续再评估更安全的会话方案 |
| 验证码和重置令牌可并存多份有效记录 | 爆破窗口变大，排障困难 | 单用户单有效凭证，新发放即废弃旧记录 |
| `CRON_SECRET` 作为可选配置 | 巡检入口可能公开暴露 | 生产环境强制要求或直接禁用手动入口 |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| 误报降价 | 用户会快速失去对产品信任 | 先修正价格有效性判断，再发送通知 |
| 会话过期后页面先加载再报错 | 用户感知为系统不稳定 | 路由/请求层前置识别并统一引导登录 |
| 历史页面切换卡顿 | 用户不愿意继续查看详情 | 限制 payload、缓存结果、缩短首屏计算路径 |

## "Looks Done But Isn't" Checklist

- [ ] **数据库初始化:** 不仅能建库，还要能完成订阅创建、巡检和历史查询 smoke path
- [ ] **价格采集:** 不仅能抓到价格，还要验证异常返回不会写出脏事件
- [ ] **认证防护:** 不仅接口通了，还要验证速率限制、失败次数和凭证淘汰策略
- [ ] **公开 feed:** 不仅首页能显示，还要验证数据增长后的去重与订阅数统计正确
- [ ] **前端鉴权:** 不仅本地 token 可读，还要验证过期 / 401 场景的一致体验

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| 迁移漂移 | HIGH | 统一 schema 与迁移基线，补 fresh install 验证，修正文档 |
| 错误价格入库 | HIGH | 标记并清理异常快照/事件，修复解析规则，回放必要数据 |
| 重复巡检/重复提醒 | HIGH | 停止重复任务，加入互斥保护，清理重复事件并补幂等 |
| 认证滥用 | MEDIUM | 启用限流与锁定策略，清理无效凭证，审查日志 |
| 前端契约漂移 | MEDIUM | 统一 DTO 来源，修复受影响页面，补回归测试 |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 初始化迁移与运行时 schema 漂移 | Phase 1 | fresh install 可完成 smoke path |
| 缺失价格被当成真实 `0` 元 | Phase 2 | 异常 App Store 返回不会写事件/邮件 |
| 巡检并发与半完成写入 | Phase 2 / Phase 3 | 重复触发时无重复事件，写入保持一致 |
| 认证入口可被爆破 | Phase 3 | 高频失败请求被限流或锁定 |
| 手动巡检入口裸奔 | Phase 3 | 缺失 `CRON_SECRET` 时接口不可用 |
| 契约漂移和前端无测试 | Phase 4 / Phase 5 | DTO 共享后编译和测试能及时暴露问题 |

## Sources

- `.planning/codebase/CONCERNS.md` — 已识别的高风险问题
- `.planning/codebase/TESTING.md` — 当前测试缺口
- `.planning/codebase/INTEGRATIONS.md` — 第三方集成边界
- `.planning/codebase/ARCHITECTURE.md` — 高副作用链路与系统职责划分

---
*Pitfalls research for: App Store 价格监听与降价提醒平台*
*Researched: 2026-03-18*
