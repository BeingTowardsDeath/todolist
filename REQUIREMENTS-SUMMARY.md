# GitTodo 需求与优化总结（REQUIREMENTS-SUMMARY）

> 文档性质：对 `REQUIREMENTS.md`（v2.0，需求规格 + 优化建议书，约 656 行）的**精炼摘要**，供快速通读与决策。
> 生成日期：2026-06-06
> 适用项目：`todolist`（产品代号 **GitTodo**）
> 详尽论证、代码示例与逐条审查请回看 `REQUIREMENTS.md`；本文件只保留结论与要点。

---

# 第一部分 · 核心内容总结

## 1. 产品定位（一句话）

**GitTodo 是面向开发者的任务看板（Sprint Board）**，把「待办管理」与「Git 分支多环境晋级矩阵（DEV → QA → UAT → PROD）」深度融合，并用一个**模拟开发者终端（Dev Console）**实时输出 git / 部署风格日志，营造贴近真实研发流程的沉浸式体验。

核心隐喻：**任务（Todo）↔ 分支（Branch）↔ 环境**三者联动。

- dev 任务可关联分支；
- 分支通过勾选环境复选框完成「晋级 / 回滚」，触发模拟流水线日志与状态机流转；
- 分支晋级到生产（PROD/Merged）时，**自动完成其下所有关联任务**；
- 所有关键操作写入带类型着色的控制台日志。

> 当前为**单用户、单数据集**（无登录、无多租户），用户身份在侧边栏硬编码为 `Senior Developer / @master-coder`。

## 2. 技术栈

| 层 | 技术 | 版本 / 说明 |
|---|---|---|
| 框架 | Next.js | 16.2.7，App Router + Route Handlers 即后端 |
| UI | React / React DOM | 19.2.4，全部客户端组件（`'use client'`） |
| 语言 | TypeScript | `strict: true`（`target` 为 ES2017） |
| ORM / 驱动 | Prisma 7 + `@prisma/adapter-pg` + `pg` | 适配器模式连接 PostgreSQL |
| 数据库 | PostgreSQL | 由 `DATABASE_URL` 指定 |
| 样式 | **CSS Modules + 全局 CSS 变量** | **非 Tailwind**（与团队规范冲突，见 §6） |
| 字体 | Geist Sans / Geist Mono | `next/font/google` 自托管 |
| Lint / 脚本 | ESLint 9 + eslint-config-next；tsx 跑 seed | 端口 **3001**（README/控制台仍写 3000） |

## 3. 系统架构（关键特征）

- **单页 + Tab 切换**：`page.tsx` 用 `activeTab` 在「任务板 / 分支矩阵 / 开发控制台」三视图间切换，无路由级拆分。
- **Route Handlers 即后端**：无独立服务层，部署模拟、状态机、字段级日志全部内联在 API 路由中。
- **快照驱动状态**：所有写操作执行后统一返回 `getSnapshot()`（todos + branches + logs 全量），前端 hook `useGitTodoState` 整体替换本地状态（`API-AUDIT.md` 记录的「有意简化」）。
- **应用层枚举**：DB 中 status/category/priority/type 均为 `String`，取值仅由 `src/types` 的 TS 联合类型在应用层约束。
- **日志缓冲（LogBuffer）**：内存中按业务顺序累积日志后一次性 `createMany` 落库，使自增 `seq`（终端展示顺序）严格匹配推入顺序——针对「同秒时间戳乱序」的合理设计。

## 4. 数据模型

```
Branch (1) ──< (N) BranchHistoryItem      [onDelete: Cascade]
Branch (1) ──< (N) Todo                    [onDelete: SetNull]
ConsoleLog                                 [独立，无外键]
```

| 实体 | 表 | 关键字段 |
|---|---|---|
| **Branch** | `branches` | `name` / `impact` / `base`(默认 master) / `dev,qa,uat,pro`(Boolean 环境标记) / `status`(Draft→PR Open→Testing→Approved→Merged/Stale) / `type`(Story/Task/Bug) |
| **BranchHistoryItem** | `branch_history` | `branchId`(FK) / `timestamp`(ISO) / `action` / `details` |
| **Todo** | `todos` | `title` / `category`(dev/personal/shopping/learning/workout) / `priority`(low→critical) / `status`(backlog→done) / `branchId`(FK, 仅 dev) / `dueDate`(YYYY-MM-DD) |
| **ConsoleLog** | `console_logs` | `timestamp`(HH:MM:SS) / `type`(info/success/command/error/warning) / `text` |

- 每表均有 `seq @default(autoincrement())` 作为稳定排序键；
- ID 在应用层生成（`Math.random().toString(36)`，约 9 位 base36）；
- 时间戳格式不统一（日志 `HH:MM:SS`、历史/`createdAt` 为 ISO、`dueDate` 为 `YYYY-MM-DD`），无时区。

## 5. 功能模块

| 模块 | 核心功能 |
|---|---|
| **任务管理（TodoSection）** | 增删改任务；**模态弹窗编辑**（非行内）；卡片内改状态、改期（Today/+1d）；dev 任务可关联或自动新建分支（`sprint36/story/<slug>`）；**三视图**（周列 / 时间线 / 网格）；详细/紧凑两种卡片密度；关键词 + 分类 + 状态 + 优先级筛选；周导航；逾期识别 |
| **分支矩阵（BranchSection）** | 创建分支；**表格行内编辑** name/impact/base（失焦且变化即写历史）；类型切换；**环境晋级矩阵**（勾选=晋级、取消=回滚，触发状态机与模拟日志）；历史时间线模态；删除（级联历史、解绑任务）；筛选；客户端分页 5/10/20/50 |
| **开发控制台（Console）** | 终端外观日志流，按类型着色；`command` 加 `$` 前缀；自动滚动到底；一键清空；每条带 `[HH:MM:SS]` |
| **侧边栏 / 仪表盘（Sidebar）** | 三 Tab 导航；实时统计（待办数 / 分支数 / 生产部署数，前端自算）；品牌 + 硬编码用户卡片 |

**关键业务规则**：仅 dev 任务可关联分支（切换分类即解绑）；新建分支在事务内创建 `Draft` 分支并产出 3 条 git 日志；任务置 `done` 且分支未到 PROD 时提示「可晋级」；环境晋级是一套状态机，**PROD 晋级会自动完成该分支下所有未完成任务**；每次晋级/回滚 + 行内编辑变更均写入分支历史。

## 6. 前后端契约现状（重要）

后端实现了远多于 UI 使用的能力——**约 18 个端点中近半数前端未接入**：

| 已实现但 UI 未接入 | 说明 |
|---|---|
| 资源级分页/搜索（todos / branches / logs 的 GET 列表） | 前端仍整库拉取后在客户端筛选/分页 |
| 单资源详情（`/todos/[id]`、`/branches/[id]` GET） | 未使用 |
| 分支历史独立查询、`GET /api/stats` 聚合统计 | 侧栏统计与 `/stats` **重复计算** |
| `PATCH /api/todos/batch` 批量改状态/删除 | 无入口 |
| `POST /api/data/reset` 重置演示数据 | 无入口 |
| `POST /api/logs` 追加单条日志 | **悬空接口**，前端无对应方法 |

此外 `src/data/db.json`（约 21KB）为切换 Prisma 前的遗留**孤儿文件**，无任何引用。

## 7. 团队规范符合度（治理矛盾）

`AGENTS.md` 强制要求每次前端任务遵守 `strict-frontend-standards` 与 `senior-frontend-engineering` 两项技能，但**代码系统性偏离自有规范**：

| 规范要求 | 当前实现 | 符合 |
|---|---|---|
| Tailwind + `cn()` 为默认样式 | CSS Modules + 大量内联 `style={{}}` | ❌ |
| 服务端状态用 TanStack Query | 手写 `useGitTodoState`（fetch + useState） | ❌ |
| 客户端状态用 Zustand | useState | ❌ |
| 优先命名导出 | 全部 `export default` | ❌ |
| 禁止 `any` | `catch (err: any)` ×14 | ❌ |
| 文件单一职责 / 函数 < 40 行 | `TodoSection.tsx` 1147 行 | ⚠️ |
| 可访问性（语义化 / 键盘） | 模态无焦点陷阱/ESC，图标按钮缺 aria | ❌ |
| 严格 TS / 路径别名 `@/` | 已启用 | ✅ |

> ⚠️ **这是一个治理层面的根本矛盾**：规范声明 Tailwind/TanStack/Zustand 为强制，代码却用 CSS Modules + 手写 hook。需先决策「规范向代码看齐」还是「代码向规范看齐」，否则强制技能形同虚设，任何重构都缺乏验收基线。

---

# 第二部分 · 优化建议

> 标注 🔴 高（阻断 / 风险）｜🟡 中（架构 / 维护）｜🟢 低（打磨 / 工程化）。

## 1. 正确性与健壮性

- 🔴 **「今天」被硬编码**：`TodoSection.tsx` 第 8 行 `TODAY_STR = '2026-06-02'` 写死，导致今天/明天/逾期判断、周视图高亮、改期快捷键全部冻结（与系统日期已偏差数天）。作为日程规划器属核心缺陷。→ 动态取当天 `new Date().toLocaleDateString('en-CA')`，进阶用可注入的 clock（便于测试、避免 hydration 不一致）。
- 🔴 **后端零输入校验**：所有路由 `body as {…}` 直接断言，枚举字段可写入任意字符串落库，引发脏数据与动态类名失配。→ 引入 **Zod**（或 valibot）在路由入口 `safeParse`，并让 `src/types` 与校验 Schema **同源**。
- 🔴 **行内编辑逐字符触发写 + 全量刷新**：分支 name/impact/base 的 `textarea onChange` 每次按键即 `PUT` 并回传整库快照，写放大严重、光标跳动。→ 本地受控 + **防抖 / 失焦提交**，写操作只回传被改实体。
- 🟡 **新建分支的 base 被忽略**：表单收集了 `newBranchBase`，但 `POST /api/todos` 内 `base` 固定 `'master'`，选项不生效。→ 透传并落库，或移除该选项。
- 🟡 **ID / 时间戳不规范**：`Math.random` 生成 ID 无唯一性保证；时间戳格式混乱无时区。→ 改 `crypto.randomUUID()`/cuid2/ULID；统一存 UTC `DateTime`、`dueDate` 用 `@db.Date`。
- 🟡 **并发写竞态（last-write-wins）**：多写各自回传全量快照按返回先后整体覆盖，叠加逐字符写易闪烁/回退。→ 乐观更新 + 失败回滚 + 请求串行化/取消。

## 2. 架构

- 🔴 **全量快照写模型不可扩展**：每次写都 3 个 `findMany` 回传全部数据，数据增长后带宽/查询线性恶化、前端整体重渲染、日志无限增长拖慢所有写。→ 写操作仅返回**受影响实体 / 变更集**，前端局部合并；日志改分页加载。已实现的 GET 列表/详情/统计端点正好支撑这一演进。
- 🟡 **已实现端点闲置**：接入服务端分页/搜索；侧栏统计改用 `/api/stats`；补齐批量操作与「重置演示数据」入口。
- 🟡 **业务逻辑内联于路由，难测试**：抽出 `src/server/services/*`（branchService/todoService）领域层，路由只做「校验→调服务→响应」。
- 🟡 **类型双源易漂移**：Prisma 模型与 `src/types` 各一套靠手写映射衔接。→ 以 Zod schema 为单一事实源派生 TS 类型与运行时校验。
- 🟢 **缺 `.env.example` 与运行说明**：补示例文件，README 写明 PostgreSQL 依赖、迁移与 seed 步骤。

## 3. 性能

| 项 | 优先级 | 建议 |
|---|---|---|
| 写后全量快照 | 🔴 | 仅回传变更实体 |
| 逐字符写 | 🔴 | 防抖 / 失焦提交 |
| 派生计算未记忆化（`filteredTodos`/`getGroupedTimeline` 每渲染重算） | 🟡 | `useMemo` + 稳定依赖 |
| 长列表无虚拟化 | 🟡 | `react-window` / 虚拟滚动；日志设上限或分页 |
| 三视图打进同一 client bundle | 🟢 | 按视图懒加载（`next/dynamic` + `Suspense`） |
| 统计在 JS 内聚合 | 🟢 | 用 Prisma `groupBy` 下推到 SQL |

## 4. 用户体验

- 🔴 **错误处理破坏性过强**：任一写失败即 `setError` → 整屏替换为错误页（单次改期失败不应清空整个应用）。→ 区分「首屏加载错误（可整屏）」与「操作错误（toast/inline，不阻断）」。
- 🔴 **高风险操作无确认/撤销**：删除任务/分支、清空日志、勾选 PROD（会自动完成全部关联任务）均无二次确认。→ 危险操作加确认弹窗 + 撤销窗口，PROD 晋级尤其需要显式确认。
- 🟡 **无操作级加载/禁用态**：提交期间按钮可重复点击。→ mutation pending 时禁用并显示 spinner。
- 🟡 **缺乏乐观更新**：每次操作都等往返 + 全量刷新，手感迟滞。
- 🟡 **中英混排无 i18n**：表头/历史模态中文、主体英文。→ 统一语言或引入 `next-intl`。
- 🟡 **响应式缺失**：固定 240px 侧栏 + 8 列周视图 + `overflow:hidden`，移动端不可用。→ 断点降级（折叠侧栏、周视图改单列/时间线）。
- 🟢 **文案/端口不一致**：README 与控制台欢迎语仍写 3000（实为 3001），需更新。

## 5. 安全

- 🔴 **无鉴权/授权**：任何访问者可读写、清空、（接入后）重置全部数据。→ 接入认证（Auth.js/NextAuth）并按用户隔离数据（增加 `userId` 维度）。
- 🔴 **无服务端输入校验**（同 §1）：信任客户端入参。
- 🟡 **错误信息直出**：底层异常 message 透传前端可能泄露内部细节。→ 生产返回通用文案，详细错误仅记服务端日志。
- 🟢 **依赖审计**：`.env*` 已 gitignore（良好）；建议加 `npm audit` / Dependabot。

## 6. 可访问性

- 🟡 **模态缺可访问性**：自定义 `div` 模态无 `role="dialog"`/`aria-modal`、无焦点陷阱、不支持 ESC。→ 用原生 `<dialog>` 或 Radix UI 等并管理焦点。
- 🟡 **图标按钮缺无障碍名**：补 `aria-label`，确保读屏可识别。
- 🟡 **纯色状态/优先级编码**：色觉障碍不友好，辅以文本/图标/图案。
- 🟢 **行内编辑 textarea 无关联 label**：补 `htmlFor`/`aria-label`。

## 7. 代码质量与工程化

- 🔴 **零测试**：无测试运行器与用例。→ Vitest + React Testing Library，对领域逻辑（状态机、日志生成）、工具函数（日期、分组）与 `useGitTodoState`（`renderHook`）做单测，关键 API 做集成测试。
- 🟡 **`TodoSection.tsx` 1147 行**：拆为 `views/WeekView|TimelineView|GridView`、`TaskModal`、`TaskCard*`、`hooks/useTaskFilters|useTaskForm`、`lib/date`。
- 🟡 **`catch (err: any)` ×14 / 全部 default export**：违反自有规范。→ 改 `catch (err: unknown)` + 收窄工具；组件改命名导出。
- 🟢 **魔法常量散落 + 内联样式**：集中到常量模块，内联样式迁移到 CSS Module/设计令牌。
- 🟢 **缺 CI/预提交**：加 GitHub Actions（lint + typecheck + test）与 Husky + lint-staged。

## 8. 与团队规范对齐（前置决策）

把「回归自有规范」作为重构验收基线，但**须先解决 §7 的治理矛盾**：

- 服务端状态 → TanStack Query（`useQuery`/`useMutation`，获得缓存、去重、乐观更新、失效刷新）；
- 客户端状态（activeTab、视图/卡片模式、筛选）→ Zustand store，减少 props 透传；
- 样式体系：**若遵循规范**则迁移到 Tailwind + `cn()`；**若团队确认保留 CSS Modules**，则应更新 `AGENTS.md`/技能说明以消除矛盾（二选一，避免长期漂移）；
- 命名导出 / 无 `any` / 函数 < 40 行 / 操作级三态齐全。

---

## 优先级行动清单（Roadmap）

### 🔴 P0 — 正确性与体验阻断项（立即）
1. 修复硬编码「今天」（计划类功能根本）。
2. 后端引入 Zod 输入校验，枚举与类型同源。
3. 行内编辑改防抖/失焦提交。
4. 错误处理分级：操作失败用 toast，不再整屏替换。
5. 危险操作（删除/清空/PROD 晋级）加确认 + 撤销。

### 🟡 P1 — 架构与可维护性（1–2 个迭代）
6. 写操作改为返回受影响实体；接入服务端分页/搜索。
7. 引入 TanStack Query + Zustand 替换手写状态层，落地乐观更新。
8. 抽离领域服务层并补关键单测/集成测试。
9. 拆分 `TodoSection.tsx`，清理 `any`、default export、内联样式。
10. 修复 base 未透传、统一 ID/时间戳、删除孤儿文件与悬空接口。

### 🟢 P2 — 安全、可访问性与工程化（持续）
11. 接入鉴权与按用户的数据隔离。
12. 可访问性达标（模态/aria/非纯色编码）。
13. 响应式适配与视图懒加载。
14. 补 `.env.example`、刷新 README、加 CI 与预提交钩子。
15. **决策并统一「规范 vs 代码」的技术选型矛盾**（其余规范类重构的前置项）。

---

> 约定：🔴 高优先级（阻断/风险）｜🟡 中优先级（架构/维护）｜🟢 低优先级（打磨/工程化）。完整论证与代码示例见 `REQUIREMENTS.md`。
