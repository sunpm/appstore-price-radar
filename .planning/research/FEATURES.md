# Feature Research

**Domain:** App Store 价格监听与降价提醒平台（brownfield）
**Researched:** 2026-03-18
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| 邮箱账号体系 | 用户需要保存订阅与通知偏好 | MEDIUM | 当前已支持注册、密码登录、验证码登录、密码重置 |
| 订阅管理 | 监听产品的核心入口就是“我要关注哪些 App” | MEDIUM | 需要对 `(user, appId, country)` 做幂等管理 |
| 可信的价格历史 | 用户需要知道价格何时变化、是否真的降价 | HIGH | 不能把异常数据写成真实价格，历史链路必须可解释 |
| 降价提醒 | 没有提醒就失去“雷达”价值 | HIGH | 通知必须去重、可追踪，并与价格事件一致 |
| App 详情与公开降价流 | 用户需要浏览市场变化并验证单个 App 的趋势 | MEDIUM | 当前已有首页和详情页，但需要进一步提升性能与正确性 |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| 按国家或地区监听 | 支持跨区价格比较与精细关注 | MEDIUM | 已有能力，后续可继续强化多地区体验 |
| 订阅创建后即时刷新 | 用户无需等下一轮 cron 即可看到首个价格快照 | MEDIUM | 这是体验亮点，但要和巡检逻辑保持一致 |
| 公开降价流 + 关注人数展示 | 兼顾个人工具与公共发现入口 | MEDIUM | 后续需要解决聚合查询成本问题 |
| 历史趋势与跌幅展示 | 把“价格变化”转成可理解的产品体验 | MEDIUM | 需要控制 payload 与前端计算成本 |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| 分钟级实时抓价 | 用户直觉上觉得“越实时越好” | 成本、限流、调度复杂度都会显著上升 | 先把定时巡检和延迟可解释性做好 |
| 一次性扩展到多个商店 | 看起来能扩大覆盖面 | 数据模型、抓取策略和 UI 复杂度会成倍增加 | 先把 App Store 场景做深做稳 |
| 原生移动 App | 通知和随手查看更方便 | 当前核心问题不在载体，而在正确性与稳定性 | 先把 Web 端和邮件提醒体验做稳 |
| 社交推荐/排行榜社区化 | 似乎能提升增长 | 偏离价格监听主线，且会显著增加内容治理成本 | 保持工具产品定位 |

## Feature Dependencies

```text
账号体系
    └──requires──> 会话管理

订阅管理
    └──requires──> 账号体系
    └──requires──> App 价格抓取

降价提醒
    └──requires──> 可信价格快照
                       └──requires──> 一致的价格变化事件

公开降价流
    └──enhances──> 市场发现
    └──depends on──> 降价事件去重与聚合

历史趋势展示
    └──depends on──> 价格历史查询
    └──conflicts with──> 无边界的大 payload 拉取
```

### Dependency Notes

- **订阅管理 requires 账号体系：** 没有用户身份就无法保存个人监听规则与通知状态。
- **降价提醒 requires 可信价格快照：** 如果采集层会把异常值写成真实价格，通知能力就不可信。
- **公开降价流 depends on 去重与聚合：** feed 的可读性和性能都取决于事件模型是否稳定。
- **历史趋势 conflicts with 无边界 payload：** 如果持续一次性拉取超长历史，前端体验会随数据增长快速退化。

## MVP Definition

### Launch With (v1)

- [ ] 统一数据库初始化与部署文档，确保新环境能稳定上线
- [ ] 修正价格采集与事件落库的一致性，保证提醒可信
- [ ] 强化认证、验证码和手动巡检入口的安全防护
- [ ] 收敛前后端 API 契约与前端鉴权逻辑，减少页面级分叉
- [ ] 为公开 feed、核心 Worker 路由和前端关键路径补回归验证

### Add After Validation (v1.x)

- [ ] 更细粒度的巡检观测面板与任务历史 — 当线上任务量提升后再补
- [ ] 更灵活的历史时间窗口和分页查询 — 当用户明显遇到性能瓶颈时推进
- [ ] 更精细的通知策略（如汇总摘要） — 在基础提醒可靠后再扩展

### Future Consideration (v2+)

- [ ] 多商店价格监听 — 需重新设计采集和归一化模型
- [ ] 原生移动客户端 — 等 Web 体验和通知模型稳定后再评估
- [ ] 高级分析/个性化推荐 — 当前不属于核心验证目标

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| 统一迁移与部署链路 | HIGH | MEDIUM | P1 |
| 价格采集正确性与一致性 | HIGH | HIGH | P1 |
| 认证与手动任务安全防护 | HIGH | MEDIUM | P1 |
| 共享 API 契约与前端稳态 | HIGH | MEDIUM | P1 |
| 公开 feed 查询优化 | MEDIUM | MEDIUM | P2 |
| 前端自动化测试 | MEDIUM | MEDIUM | P2 |
| 多商店支持 | MEDIUM | HIGH | P3 |
| 原生移动客户端 | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: 当前里程碑必须完成
- P2: 当前里程碑应尽量覆盖
- P3: 明确延期到后续版本

## Competitor Feature Analysis

本轮初始化没有做外部竞品逐项拆解，路线图主要依据现有仓库能力、已暴露的风险与典型价格监听产品的基础预期来定义。若后续目标从“做稳现有产品”转向“寻找差异化增长”，再补专项竞品研究更合适。

## Sources

- `README.md` — 当前产品定位与已实现功能说明
- `.planning/codebase/ARCHITECTURE.md` — 现有数据流与用户路径
- `.planning/codebase/CONCERNS.md` — 当前能力缺口与高风险问题
- `.planning/codebase/INTEGRATIONS.md` — 外部依赖与约束

---
*Feature research for: App Store 价格监听与降价提醒平台*
*Researched: 2026-03-18*
