# GitTodo 需求文档与优化建议书

> 文档版本：v2.0
> 生成日期：2026-06-06
> 文档性质：基于现有代码逆向梳理的需求规格说明（SRS）+ 工程优化建议
> 适用项目：`todolist`（产品代号 **GitTodo**）
>
> 说明：本版本由对全量源码的深度分析重写而成，相较旧版补充了业务规则、用户故事验收标准、非功能需求量化、前后端契约核对、团队规范符合度审查与分级行动清单，并修正了旧版若干事实性描述（如主题实为浅色而非深色、任务为模态编辑而非行内编辑等）。

---

## 文档说明

本文档由对 `todolist` 项目**全量源码**（约 29 个源文件，含 10 个 API 路由、4 个 React 组件、Prisma 数据层、约 4500+ 行 CSS）的逆向分析整理而成，分为两大部分：

1. **第一部分 · 需求文档**：还原产品定位、技术栈、架构、数据模型、功能需求、用户故事与非功能需求。
2. **第二部分 · 优化建议**：从代码质量、架构、性能、用户体验、安全、可访问性、工程化等维度给出可落地的改进项，并附**优先级行动清单**。

> **关于强制技能的说明**：项目 `AGENTS.md` 规定每次前端任务须强制加载 `strict-frontend-standards` 与 `senior-frontend-engineering` 两项技能。本次分析中这两项技能未注册为可调用工具，无法以工具形式加载；本文档已直接读取 `skill/*/SKILL.md` 的全部条款，并据其原则完成分析与建议（详见 §2.9 规范符合度审查）。

---

# 第一部分 · 需求文档

## 1. 项目概述

### 1.1 产品定位

**GitTodo** 是一款**面向开发者的任务看板（Sprint Board）**，其核心特色是将「待办任务管理」与「Git 分支多环境晋级矩阵（DEV → QA → UAT → PROD）」深度融合，并通过一个**模拟开发者终端（Dev Console）**实时输出 git / 部署风格的操作日志，营造贴近真实研发流程的沉浸式体验。

它并非通用的「记事本式」待办应用，而是把软件交付流水线作为隐喻贯穿全产品：

- **任务（Todo）** 可关联到 **分支（Branch）**；
- **分支** 通过勾选环境复选框完成「晋级 / 回滚」，触发模拟流水线日志与状态机流转；
- 当分支**晋级到生产（PROD/Merged）** 时，自动完成其下所有关联任务；
- 所有关键操作都被记录为带类型着色的**控制台日志**。

### 1.2 目标用户

| 角色 | 描述 | 典型诉求 |
|---|---|---|
| 研发工程师（主） | 同时管理代码任务与分支交付状态 | 在一处看到「任务 ↔ 分支 ↔ 环境」全貌 |
| 个人效率使用者 | 也支持个人/购物/学习/健身等非研发任务 | 周计划、时间线视图、快速改期 |
| 技术负责人 | 关注交付进度与环境分布 | 仪表盘统计、分支历史审计 |

> 当前版本为**单用户、单数据集**（无登录、无多租户），用户身份在侧边栏硬编码为 `Senior Developer / @master-coder`。

### 1.3 核心价值主张

- 用熟悉的 **Git/CI 心智模型** 组织待办，降低研发人员的认知切换成本；
- **任务—分支—环境**三者联动，单屏掌握交付状态；
- 模拟终端提供**操作可追溯性**与「仪式感」，强化反馈闭环。

---

## 2. 技术栈

### 2.1 总览

| 层 | 技术 | 版本 | 说明 |
|---|---|---|---|
| 框架 | Next.js | 16.2.7 | App Router，Route Handlers 作为后端 |
| UI 库 | React / React DOM | 19.2.4 | 全部为客户端组件（`'use client'`） |
| 语言 | TypeScript | ^5 | `strict: true`，`target: ES2017` |
| ORM | Prisma | ^7.8.0 | Prisma 7 驱动适配器模式 |
| DB 驱动 | `@prisma/adapter-pg` + `pg` | ^7.8 / ^8.21 | PostgreSQL 连接 |
| 数据库 | PostgreSQL | — | 由 `DATABASE_URL` 指定 |
| 样式 | CSS Modules + 全局 CSS 变量 | — | **非 Tailwind**（见 §2.9） |
| 字体 | Geist Sans / Geist Mono | — | `next/font/google` 自托管 |
| 配置 | dotenv | ^17.4.2 | 加载 `.env` |
| Lint | ESLint + eslint-config-next | ^9 / 16.2.7 | core-web-vitals + typescript 规则 |
| 脚本运行 | tsx | ^4.22.4 | 运行 `prisma db seed` |

### 2.2 运行与脚本

| 脚本 | 命令 | 说明 |
|---|---|---|
| `dev` | `next dev -p 3001` | 开发服务器，端口 **3001** |
| `build` | `next build` | 生产构建 |
| `start` | `next start -p 3001` | 生产启动，端口 3001 |
| `lint` | `eslint` | 代码检查 |
| 数据库种子 | `tsx prisma/seed.ts`（经 `prisma.config.ts` 配置） | 重置并灌入初始数据 |

> 注：`README.md` 仍为 `create-next-app` 默认模板，提示端口为 3000，与实际 3001 不符（见 §2.8）。

### 2.3 目录结构

```
todolist/
├── prisma/
│   ├── schema.prisma            # 4 个模型：Branch / BranchHistoryItem / Todo / ConsoleLog
│   ├── seed.ts                  # 种子 CLI 入口
│   └── migrations/…/migration.sql
├── src/
│   ├── app/
│   │   ├── layout.tsx           # 根布局 + 元数据 + 字体
│   │   ├── page.tsx             # 单页应用（Tab 导航 + 加载/错误态）
│   │   ├── globals.css          # 设计令牌（CSS 变量）+ 全局样式
│   │   └── api/                 # 后端路由（见 §6）
│   │       ├── data/route.ts            # GET 全量快照
│   │       ├── data/reset/route.ts      # POST 重置
│   │       ├── todos/route.ts           # GET 列表 / POST 创建
│   │       ├── todos/[id]/route.ts      # GET / PUT / DELETE
│   │       ├── todos/batch/route.ts     # PATCH 批量
│   │       ├── branches/route.ts        # GET 列表 / POST 创建
│   │       ├── branches/[id]/route.ts   # GET / PUT / DELETE
│   │       ├── branches/[id]/history/route.ts  # GET 历史
│   │       ├── logs/route.ts            # GET / POST / DELETE
│   │       └── stats/route.ts           # GET 统计
│   ├── components/              # Sidebar / TodoSection / BranchSection / Console（各带 .module.css）
│   ├── hooks/useGitTodoState.ts # 全局客户端状态 + 所有写操作封装
│   ├── lib/
│   │   ├── prisma.ts            # Prisma 单例（热重载安全）
│   │   ├── db.ts               # 共享工具 + 行→类型映射 + getSnapshot
│   │   └── seed.ts             # 初始数据集 + seedDatabase()
│   ├── types/index.ts          # 领域类型与联合枚举（应用层校验源）
│   └── data/db.json            # ⚠️ 遗留孤儿文件，src 中无任何引用
└── skill/                      # 两个强制技能定义（团队规范）
```

### 2.4 架构风格

- **单页 + Tab 切换**：`page.tsx` 通过 `activeTab` 在「任务板 / 分支矩阵 / 开发控制台」三视图间切换，无路由级页面拆分。
- **Route Handlers 即后端**：无独立服务端，业务逻辑（部署模拟、状态机、日志）内联在 API 路由中。
- **快照驱动状态**：所有写操作执行后统一返回 `getSnapshot()`（todos + branches + logs 全量），前端 hook 整体替换本地状态。这是 `API-AUDIT.md` 中明确记录的「有意简化」。
- **应用层枚举**：DB 中 status/category/priority/type 均为 `String`，取值由 `src/types` 的联合类型在应用层约束。

### 2.5 数据持久化设计要点

- **`seq` 自增列**：每张表均有 `seq @default(autoincrement())`，作为稳定的插入顺序排序键 —— 因为同一次请求批量写入的日志可能共享同一秒级时间戳，单靠 `timestamp` 无法保证终端显示顺序。
- **应用层生成 ID**：`generateId = Math.random().toString(36).substring(2, 11)`（约 9 位 base36），非数据库生成。
- **时间戳为字符串**：日志用 `HH:MM:SS`（本地时间），历史/`createdAt` 用 ISO 字符串，`dueDate` 用 `YYYY-MM-DD`。
- **日志缓冲（LogBuffer）**：`createLogBuffer()` 在内存中按业务顺序累积日志，最后一次性 `createMany` 落库，使自增 `seq`（即终端展示顺序）严格匹配推入顺序 —— 这是对「同秒时间戳乱序」问题的针对性设计，值得肯定。

### 2.6 外键与级联策略

| 关系 | 级联行为 | 业务含义 |
|---|---|---|
| `BranchHistoryItem.branchId → Branch` | `onDelete: Cascade` | 删除分支时其历史一并删除 |
| `Todo.branchId → Branch` | `onDelete: SetNull` | 删除分支时关联任务解绑（保留任务） |

### 2.7 设计系统（视觉）

- 基于 CSS 变量的「皇家紫 / 薰衣草」**浅色主题**（`--bg-primary: #ffffff`，`--bg-outer: #e2e2fc`），定义于 `globals.css`。**注意**：仅 `page.tsx` 的加载/错误整屏使用深色（`#0d0e15`），主界面整体为浅色。
- **环境专属配色**：DEV=紫、QA=粉、UAT=琥珀、PROD=翡翠绿；优先级配色 low/medium/high/critical。
- 统一的圆角令牌（`--radius-sm…xxl/pill`）、阴影令牌、自定义环境复选框动效。
- 字体令牌区分 sans / mono。

### 2.8 已知文档/配置不一致

- `README.md` 为脚手架默认内容，端口与启动说明过时（写 3000，实为 3001）。
- `Console.tsx` 欢迎语写死 `Listening on port 3000`，与实际 3001 不符。
- `src/data/db.json`（约 21KB）为切换到 Prisma 前的 JSON 持久化遗留文件，已无引用。

### 2.9 与项目自有强制规范的符合度（重要）

项目通过 `AGENTS.md` 将 `strict-frontend-standards` 与 `senior-frontend-engineering` 列为**每次前端任务必须遵守**的规范。经逐条比对，当前代码与自有规范存在系统性偏差（详见第二部分 §8），此处先列总览：

| 规范条款 | 规范要求 | 当前实现 | 符合 |
|---|---|---|---|
| 样式系统 | Tailwind 为默认 | CSS Modules | ❌（技术选型冲突） |
| 内联样式 | 避免内联样式与魔法值 | 大量 `style={{…}}` 内联 | ❌ |
| 条件类名 | 用 `cn()`/`clsx` | 原始模板字符串拼接 | ❌ |
| 服务端状态 | TanStack Query | 手写 fetch + useState | ❌ |
| 客户端状态 | Zustand | useState | ❌ |
| 组件导出 | 优先命名导出 | 全部 `export default` | ❌ |
| `any` 使用 | 禁止（除非注释说明） | `catch (err: any)` ×14 | ❌ |
| 文件单一职责 / 函数 <40 行 | 鼓励 | `TodoSection.tsx` 1147 行 | ⚠️ |
| 可访问性（语义化/键盘） | 必须 | 模态无焦点陷阱/ESC，图标按钮缺 aria | ❌ |
| 三态（加载/错误/空） | 必须 | 应用级三态齐全，操作级缺失 | ⚠️ |
| 严格 TS / ES2022+ | 必须 | 已启用 strict（`target` 为 ES2017） | ✅ |
| 路径别名 `@/` | 必须 | 已使用 | ✅ |

> 该差距本身就是优化建议的重要输入：**让代码回归团队自定的规范**应作为重构主线之一。

---

## 3. 数据模型

### 3.1 实体关系

```
Branch (1) ──< (N) BranchHistoryItem      [Cascade delete]
Branch (1) ──< (N) Todo                    [SetNull on delete]
ConsoleLog                                 [独立，无外键]
```

### 3.2 字段定义

#### Branch（分支，表 `branches`）

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `id` | String(PK) | — | 应用生成 |
| `seq` | Int | autoincrement | 排序键 |
| `name` | String | — | 分支名（如 `sprint35/story/fedration`） |
| `impact` | String | `''` | 内容/影响描述 |
| `base` | String | `'master'` | 基线分支 |
| `dev/qa/uat/pro` | Boolean | `false` | 环境部署标记 |
| `status` | String | `'Draft'` | 状态机：Draft/PR Open/Testing/Approved/Merged/Stale |
| `type` | String? | null | Story/Task/Bug |
| `history` | 关系 | — | 变更历史 |
| `todos` | 关系 | — | 关联任务 |

#### BranchHistoryItem（分支历史，表 `branch_history`）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | String(PK) | — |
| `seq` | Int | 排序键 |
| `branchId` | String(FK, 索引) | 所属分支 |
| `timestamp` | String | ISO 时间 |
| `action` | String | 如 `Promoted to QA` |
| `details` | String? | 详情 |

#### Todo（任务，表 `todos`）

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `id` | String(PK) | — | — |
| `seq` | Int | autoincrement | 排序键（列表按 `seq desc`） |
| `title` | String | — | 标题 |
| `description` | String | `''` | 描述 |
| `category` | String | — | dev/personal/shopping/learning/workout |
| `priority` | String | — | low/medium/high/critical |
| `status` | String | — | backlog/todo/in-progress/review/done |
| `branchId` | String?(FK, 索引) | null | 仅 dev 任务可关联 |
| `dueDate` | String | `''` | `YYYY-MM-DD` |
| `createdAt` | String | — | ISO |

#### ConsoleLog（控制台日志，表 `console_logs`）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | String(PK) | — |
| `seq` | Int | 排序键 |
| `timestamp` | String | `HH:MM:SS` |
| `type` | String | info/success/command/error/warning |
| `text` | String | 日志正文 |

### 3.3 类型层（`src/types/index.ts`）

应用层用 TypeScript 联合类型约束枚举取值（`Branch.status`、`Todo.category/priority/status`、`ConsoleLog.type` 等）。`src/lib/db.ts` 提供 `toBranch / toTodo / toLog / toHistoryItem` 映射器，将 Prisma 行转换为对外类型（剥离 `seq` 等内部列，并将 `String` 收窄为联合类型）。

---

## 4. 功能需求（FR）

> 按三大功能模块 + 控制台 + 系统级组织。每条标注编号便于追溯。

### 4.1 任务管理模块（TodoSection）

| 编号 | 功能 | 描述 |
|---|---|---|
| FR-T-01 | 创建任务 | 标题、描述、分类、优先级、状态、截止日期；dev 分类可关联/新建分支 |
| FR-T-02 | 编辑任务 | 通过**模态弹窗**复用同一表单，预填字段；保存即更新 |
| FR-T-03 | 删除任务 | 卡片悬浮操作区一键删除 |
| FR-T-04 | 修改状态 | 卡片内下拉直接切换 backlog→…→done |
| FR-T-05 | 改期 | 日期选择器 + 快捷「Today」「+1d」 |
| FR-T-06 | 关联分支 | dev 任务可选择已有分支，或勾选「创建新分支」（按标题自动生成 `sprint36/story/<slug>` 名） |
| FR-T-07 | 三种视图 | ① 周列视图（Inbox/逾期 + 7 天列）② 垂直时间线（逾期/今天/明天/未来/未排期分组）③ 全部任务网格 |
| FR-T-08 | 两种卡片密度 | 详细模式 / 紧凑模式 |
| FR-T-09 | 搜索与筛选 | 关键词（标题+描述）+ 分类 + 状态 + 优先级 |
| FR-T-10 | 周导航 | 上一周/下一周/回到今天，显示日期区间 |
| FR-T-11 | 分类图标 | dev💻 / personal🏠 / shopping🛒 / learning📚 / workout💪 |
| FR-T-12 | 逾期识别 | `dueDate < 今天` 且未完成 → 归入逾期分组/Inbox |

### 4.2 分支矩阵模块（BranchSection）

| 编号 | 功能 | 描述 |
|---|---|---|
| FR-B-01 | 创建分支 | 名称、内容/影响、类型、基线分支、初始状态 |
| FR-B-02 | 行内编辑 | 表格内直接编辑分支名/影响/base（textarea 自适应行高） |
| FR-B-03 | 编辑历史记录 | 行内编辑失焦时，若值变化则写入分支历史 |
| FR-B-04 | 类型切换 | Story/Task/Bug 下拉，变更写入历史 |
| FR-B-05 | 环境晋级矩阵 | dev/qa/uat/pro 复选框，勾选=晋级、取消=回滚，触发模拟流水线日志与状态流转 |
| FR-B-06 | 查看历史 | 时间线模态，按时间倒序，按动作类型着色（创建/晋级/状态/编辑） |
| FR-B-07 | 删除分支 | 级联删除历史，解绑关联任务 |
| FR-B-08 | 搜索与筛选 | 关键词（名称+影响）+ 环境筛选 + 类型筛选 |
| FR-B-09 | 分页 | 客户端分页，每页 5/10/20/50 可选 |

### 4.3 开发控制台模块（Console）

| 编号 | 功能 | 描述 |
|---|---|---|
| FR-C-01 | 日志流展示 | 终端外观（窗口红黄绿点 + 欢迎语），按类型着色 |
| FR-C-02 | 命令前缀 | `command` 类型日志前缀 `$` |
| FR-C-03 | 自动滚动 | 日志更新平滑滚动到底部 |
| FR-C-04 | 清空日志 | 一键清空（DELETE /api/logs） |
| FR-C-05 | 时间戳 | 每条日志显示 `[HH:MM:SS]` |

### 4.4 仪表盘 / 侧边栏（Sidebar）

| 编号 | 功能 | 描述 |
|---|---|---|
| FR-S-01 | 导航 | 任务板 / 分支矩阵 / 开发控制台 三 Tab |
| FR-S-02 | 实时统计 | 待办任务数（总-完成）、分支总数、生产部署数（前端实时计算） |
| FR-S-03 | 品牌与用户 | Logo `GIT_TODO.sh` + 硬编码用户卡片 |

### 4.5 系统级能力（后端已实现）

| 编号 | 功能 | 状态 |
|---|---|---|
| FR-X-01 | 全量快照拉取 `GET /api/data` | ✅ 前端使用 |
| FR-X-02 | 资源级分页查询（todos/branches/logs） | ✅ 后端实现，⚠️ 前端未接入 |
| FR-X-03 | 单资源详情（todos/branches） | ✅ 后端实现，⚠️ 前端未接入 |
| FR-X-04 | 分支历史独立查询 | ✅ 后端实现，⚠️ 前端未接入 |
| FR-X-05 | 仪表盘统计 `GET /api/stats` | ✅ 后端实现，⚠️ 前端未接入（前端自算） |
| FR-X-06 | 批量改状态/删除 `PATCH /api/todos/batch` | ✅ 后端实现，⚠️ 前端未接入 |
| FR-X-07 | 重置为种子数据 `POST /api/data/reset` | ✅ 后端实现，⚠️ 前端无入口 |
| FR-X-08 | 追加单条日志 `POST /api/logs` | ⚠️ 悬空接口（前端无对应方法） |

---

## 5. 业务规则（BR）

| 编号 | 规则 |
|---|---|
| BR-01 | 仅 `category === 'dev'` 的任务可关联或新建分支；切换为非 dev 分类会清空分支关联。 |
| BR-02 | 创建/更新 dev 任务并勾选「新建分支」时，后端在事务内创建 `Draft` 状态分支（**base 固定 `master`**），写入「Created branch」历史，并产出 3 条模拟 git 日志。 |
| BR-03 | 任务更新逐字段对比并生成日志；当状态置为 `done` 且其关联分支尚未到 PROD 时，追加一条 `warning` 日志提示「可晋级到 PROD」。 |
| BR-04 | 环境晋级状态机：<br>• DEV 晋级：`Draft → Testing`<br>• QA 晋级：`Draft/PR Open → Testing`（含 Sonar 质量门日志）<br>• UAT 晋级：非 `Merged` → `Approved`<br>• PROD 晋级：→ `Merged`，并**自动完成该分支下所有未完成任务**<br>• PROD 回滚：→ `Approved` |
| BR-05 | 每次环境晋级/回滚均写入一条分支历史，并产出对应环境的模拟部署日志（checkout/merge/build/deploy 等）。 |
| BR-06 | 删除分支：先将其关联任务 `branchId` 置空（SetNull），再删除分支（历史 Cascade），并产出 `warning` 日志。 |
| BR-07 | 删除任务：删除后写入一条 `info` 日志。 |
| BR-08 | 分支行内编辑（name/impact/base）在失焦且值发生变化时写入历史。 |
| BR-09 | 列表排序：任务按 `seq desc`（最新在前）；分支/日志/历史按 `seq asc`（创建顺序）。 |

---

## 6. 接口清单（API）

> 共 **10 个路由文件 / 约 18 个端点**。「UI 使用」列标明前端 `useGitTodoState` 是否实际调用。

| 路由 | 方法 | 用途 | UI 使用 |
|---|---|---|---|
| `/api/data` | GET | 全量快照（todos+branches+logs） | ✅ |
| `/api/data/reset` | POST | 重置为种子数据 | ❌ |
| `/api/todos` | GET | 任务分页列表（status/category/priority/branchId/q/page/pageSize） | ❌ |
| `/api/todos` | POST | 创建任务（可联动建分支） | ✅ |
| `/api/todos/[id]` | GET | 单任务详情 | ❌ |
| `/api/todos/[id]` | PUT | 更新任务（字段级日志、可建分支、done 警告） | ✅ |
| `/api/todos/[id]` | DELETE | 删除任务 | ✅ |
| `/api/todos/batch` | PATCH | 批量改状态/删除 | ❌ |
| `/api/branches` | GET | 分支分页列表（q/env/type/status） | ❌ |
| `/api/branches` | POST | 创建分支 | ✅ |
| `/api/branches/[id]` | GET | 单分支（含历史） | ❌ |
| `/api/branches/[id]` | PUT | 4 种模式：envPromotion / statusUpdate / editField / updates | ✅ |
| `/api/branches/[id]` | DELETE | 删除分支（解绑任务、级联历史） | ✅ |
| `/api/branches/[id]/history` | GET | 分支历史时间线 | ❌ |
| `/api/logs` | GET | 日志分页列表（type 过滤） | ❌ |
| `/api/logs` | POST | 追加单条日志 | ❌（悬空） |
| `/api/logs` | DELETE | 清空日志 | ✅ |
| `/api/stats` | GET | 仪表盘聚合统计 | ❌ |

**统一约定**：写操作（POST/PUT/DELETE/PATCH/reset）均返回 `getSnapshot()` 全量快照；GET 列表类返回 `{ data, pagination }`；错误返回 `{ error }` + HTTP 4xx/5xx。

---

## 7. 用户故事（User Stories）

> 采用「作为 …，我希望 …，以便 …」格式；关键故事附验收标准（AC）。

### 7.1 任务管理

- **US-01**　作为研发工程师，我希望在创建 dev 任务时一键生成关联分支，以便任务与代码分支从一开始就绑定。
  - AC1：分类为 dev 且勾选「创建新分支」时，分支名按标题自动生成 `sprint36/story/<slug>`。
  - AC2：提交后后端在同一事务创建分支与任务，并在控制台输出 `git checkout -b …` 等日志。
  - AC3：非 dev 分类时，分支相关字段不可见且不提交。

- **US-02**　作为效率使用者，我希望以「周列 / 时间线 / 网格」三种视图查看任务，以便按不同节奏规划。
  - AC1：周视图含 Inbox/逾期列与 7 天列，可前后切周并回到今天。
  - AC2：时间线按 逾期/今天/明天/未来日期/未排期 分组。

- **US-03**　作为使用者，我希望直接在卡片上改状态、改期（Today/+1d）、删除，以便高频操作零跳转。

- **US-04**　作为使用者，我希望按关键词与分类/状态/优先级筛选任务，以便快速聚焦。

### 7.2 分支矩阵

- **US-05**　作为研发工程师，我希望通过勾选 DEV/QA/UAT/PROD 复选框推进分支晋级，以便用最少操作驱动交付流水线。
  - AC1：勾选触发对应环境的模拟部署日志与状态机流转（见 BR-04）。
  - AC2：晋级到 PROD 时其下未完成任务自动标记 done，并各产出一条成功日志。

- **US-06**　作为研发工程师，我希望在表格中直接编辑分支名/影响/base，以便就地维护元信息。
  - AC1：编辑失焦且值变化时，写入分支历史并产出日志。

- **US-07**　作为技术负责人，我希望查看任意分支的完整变更时间线，以便审计交付过程。

### 7.3 控制台与仪表盘

- **US-08**　作为研发工程师，我希望所有操作都在模拟终端留痕并自动滚动到最新，以便获得即时反馈与可追溯性。

- **US-09**　作为技术负责人，我希望侧边栏实时展示待办数、分支数、生产部署数，以便一眼掌握概况。

### 7.4 暂未在 UI 暴露但后端已具备（潜在故事）

- **US-10（待接入）**　作为使用者，我希望批量改状态/删除任务（后端 `PATCH /api/todos/batch` 已就绪）。
- **US-11（待接入）**　作为使用者，我希望一键将数据重置为演示初始集（`POST /api/data/reset` 已就绪）。
- **US-12（待接入）**　作为大数据量使用者，我希望服务端分页/搜索（多个 GET 列表端点已就绪）。

---

## 8. 非功能需求（NFR）

| 维度 | 现状 | 期望（建议目标） |
|---|---|---|
| **性能** | 写操作返回全量快照；行内编辑逐字符触发写 + 全量刷新 | 增量返回 / 乐观更新；输入防抖；首屏 < 1.5s |
| **可扩展性** | 全量快照模式，数据量大时退化 | 接入已实现的服务端分页/筛选端点 |
| **可用性/容错** | 任一写操作失败会整屏替换为错误页 | 操作级错误提示（toast），不阻断全局 |
| **可访问性** | 模态无焦点管理/ESC，图标按钮缺 aria，纯色状态编码 | 满足 WCAG 2.1 AA 关键项 |
| **安全** | 无鉴权、无输入校验、单一共享数据集 | 鉴权 + 服务端 Schema 校验 |
| **国际化** | 中英混排（表头/历史模态为中文，主体英文），无 i18n 框架 | 统一语言或引入 i18n |
| **响应式** | 固定 240px 侧栏 + 8 列周视图，`overflow:hidden` | 移动端适配/折叠侧栏/视图降级 |
| **可维护性** | `TodoSection.tsx` 1147 行；业务逻辑内联于路由 | 组件/领域逻辑拆分；< 40 行函数 |
| **可测试性** | **无任何测试**，无测试运行器 | 单测（领域逻辑/工具）+ 关键流程集成测试 |
| **可观测性** | 仅模拟控制台日志 | 真实服务端日志/错误上报 |
| **浏览器兼容** | 现代浏览器（CSS 变量、`type=date`、smooth scroll） | 明确支持矩阵 |

---

---

# 第二部分 · 优化建议

> 建议按「现状 → 风险/影响 → 改进方案」组织，并在文末给出**按优先级排序的行动清单**。标注 🔴 高 / 🟡 中 / 🟢 低 优先级。

## 1. 正确性与健壮性（Correctness）

### 🔴 1.1 「今天」被硬编码，计划类功能逻辑冻结
`TodoSection.tsx` 第 8 行 `const TODAY_STR = '2026-06-02';` 写死。导致「今天/明天/逾期」判断、周视图高亮、改期快捷键全部基于固定日期，永不前进（当前系统日期 2026-06-06 已与之偏差 4 天）。
- **影响**：作为一个日程规划器，这是核心功能性缺陷。
- **方案**：引入「当前日期」来源并统一提供，测试中可注入固定时钟；注意 SSR/客户端时区一致性（建议在客户端 effect 内取值，避免 hydration 不一致）。

```ts
// 简版：动态获取本地当天
const TODAY_STR = new Date().toLocaleDateString('en-CA'); // 'YYYY-MM-DD'
// 进阶：用 React Context/Zustand 注入可测试的 clock，供全组件复用
```

### 🔴 1.2 后端缺少输入校验，存在数据完整性风险
所有路由用 `body as {…}` 直接断言，未校验。枚举字段（status/category/priority/type）可写入任意字符串并落库；分页参数虽做了 `Math.min/max` 收敛，但业务字段无防护。
- **影响**：脏数据、前端渲染时 `styles[\`cat-${x}\`]` 等动态类名失配、潜在注入面。
- **方案**：引入 **Zod**（或 valibot）定义请求 Schema，在路由入口 `safeParse`，校验失败返回 400；并让 `src/types` 的联合类型与 Schema **同源**，消除应用层枚举与校验的漂移。

```ts
import { z } from 'zod';
export const CreateTodoSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).default(''),
  category: z.enum(['dev', 'personal', 'shopping', 'learning', 'workout']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  status: z.enum(['backlog', 'todo', 'in-progress', 'review', 'done']),
  branchId: z.string().nullable(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')),
  createBranchName: z.string().optional(),
});
// 路由入口：const parsed = CreateTodoSchema.safeParse(await req.json());
// if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });
// 并由 schema 反推类型：export type CreateTodoInput = z.infer<typeof CreateTodoSchema>;
```

### 🔴 1.3 行内编辑逐字符触发写请求 + 全量刷新
`BranchSection` 中 name/impact/base 的 `<textarea onChange>` 每次按键即调用 `onUpdateBranch` → `PUT` → 返回**整库快照**并整体替换状态。
- **影响**：①每敲一个字符一次网络往返与全表查询；②受控值来自服务端状态，回填延迟导致输入卡顿/光标跳动；③写放大严重。
- **方案**：本地受控 + **防抖（debounce 300–500ms）** 或**失焦提交**；写操作只回传被改实体（见 2.1）；配合乐观更新。

```tsx
// 本地态承接输入，失焦或防抖后再提交，避免每键一请求
const [draft, setDraft] = useState(branch.name);
<textarea value={draft}
  onChange={(e) => setDraft(e.target.value)}
  onBlur={() => draft !== branch.name && onUpdateBranch(branch.id, { name: draft })} />
```

### 🟡 1.4 新建分支时用户选择的 base 被忽略
`TodoSection` 表单收集了 `newBranchBase`（master/prod/develop），但提交时只透传分支名字符串，`POST /api/todos` 内 `base` 固定 `'master'`。
- **影响**：UI 提供了选项却不生效，属功能性 Bug 与用户预期不符。
- **方案**：将 `newBranchBase` 一并提交并落库；或移除该选项以免误导。

### 🟡 1.5 ID 生成存在碰撞与不可排序问题
`Math.random().toString(36).substring(2,11)` 约 9 位 base36，应用层生成，无唯一性保证与重试。
- **方案**：改用 `crypto.randomUUID()` / cuid2 / 数据库 `@default(cuid())`；若需有序可用 ULID。

### 🟡 1.6 时间戳格式不统一、无时区
日志 `HH:MM:SS`（本地）、历史/createdAt 为 ISO、dueDate 为 `YYYY-MM-DD`，靠 `seq` 兜底排序。`getTimestamp()` 用服务器本地时区，部署到 Serverless 后为容器时区。
- **方案**：统一存 UTC `DateTime`（Prisma 原生类型），展示层格式化；`dueDate` 用 `@db.Date`。可减少部分对 `seq` 兜底的依赖。

### 🟡 1.7 并发写竞态（last-write-wins）
多个写并发各自返回全量快照，前端按返回先后整体覆盖，叠加 1.3 的逐字符写易产生闪烁/回退。
- **方案**：乐观更新 + 失败回滚 + 请求串行化/取消（TanStack Query 的 mutation 队列）。

### 🟢 1.8 悬空接口与孤儿文件
`POST /api/logs` 无前端调用方；`src/data/db.json`（21KB）为 Prisma 迁移前遗留、无引用。
- **方案**：接入或删除 `POST /api/logs`（消除契约漂移）；删除 `src/data/db.json`。

## 2. 架构（Architecture）

### 🔴 2.1 全量快照写模型不可扩展
每次写都执行 3 个 `findMany` 并回传全部 todos+branches+logs。
- **影响**：数据增长后带宽/查询线性恶化；前端整体重渲染；日志无限增长后拖慢所有写操作。
- **方案**：写操作仅返回**受影响实体**（或变更集），前端做局部合并；日志改分页加载、不再随写操作整体回传。已实现的 GET 列表/详情/统计端点正好支撑这一演进。

```ts
// 现状：return NextResponse.json(await getSnapshot());
// 演进：return NextResponse.json({ action: 'update', entity: 'todo', data: updatedTodo });
```

### 🟡 2.2 已实现端点未被前端使用，能力闲置
GET 列表/详情、`/stats`、`/batch`、`/reset` 均已就绪但 UI 未接入，前端仍整库拉取并在客户端筛选/分页/统计（如侧栏统计与 `/api/stats` 重复计算）。
- **方案**：大列表接入服务端分页/搜索；侧栏统计改用 `/api/stats`；补齐批量操作与「重置演示数据」入口。

### 🟡 2.3 业务逻辑内联于路由，难以测试
部署模拟、状态机（BR-04）、字段级日志都写在 Route Handler 里。
- **方案**：抽出 `src/server/services/*`（branchService/todoService）领域层，路由只做「校验→调服务→响应」；领域逻辑可单测。

### 🟡 2.4 类型存在双源，易漂移
Prisma 模型与 `src/types` 各维护一套，靠手写映射器衔接，枚举仅在应用层约束。
- **方案**：以 Zod schema 为单一事实源派生 TS 类型与运行时校验；或采用 Prisma enum（若可接受迁移成本）。

### 🟢 2.5 缺少 `.env.example` 与环境约束文档
`DATABASE_URL` 必需但无示例文件。
- **方案**：补 `.env.example`，在 README 写明依赖 PostgreSQL、迁移与 seed 步骤。

## 3. 性能（Performance）

| 项 | 优先级 | 现状 | 建议 |
|---|---|---|---|
| 写后全量快照 | 🔴 | 每次写回传整库 | 仅回传变更（见 2.1） |
| 逐字符写 | 🔴 | 行内编辑每键一请求 | 防抖/失焦提交（见 1.3） |
| 派生计算未记忆化 | 🟡 | `filteredTodos`/`getGroupedTimeline` 每渲染重算 | `useMemo`，依赖稳定化 |
| 长列表无虚拟化 | 🟡 | 全量渲染任务/日志 | `react-window`/虚拟滚动；日志设上限或分页 |
| 单一客户端包 | 🟢 | 三视图打进同一 client bundle | 按视图懒加载（`next/dynamic` + `Suspense`） |
| 统计在 JS 内聚合 | 🟢 | `/api/stats` 取全表再 reduce | 用 Prisma `groupBy` 下推到 SQL |

```ts
// 统计聚合下推示例
const byStatus = await prisma.todo.groupBy({ by: ['status'], _count: { id: true } });
```

## 4. 用户体验（UX）

- 🔴 **错误处理破坏性过强**：`useGitTodoState` 的任一失败都 `setError`，`page.tsx` 据此整屏替换为错误页。**单次改期失败不应清空整个应用**。
  - 方案：区分「首屏加载错误（可整屏）」与「操作错误（toast/inline，不阻断）」；引入轻量通知组件与失败重试。
- 🔴 **高风险操作无确认/撤销**：删除任务/分支、清空日志、勾选 PROD（会自动完成全部关联任务并写「已合并生产」）均无二次确认。
  - 方案：危险操作加确认弹窗 + 「撤销」窗口；PROD 晋级尤其需要显式确认。
- 🟡 **无操作级加载/禁用态**：提交期间按钮可重复点击，易重复提交。
  - 方案：mutation pending 时禁用并显示 spinner。
- 🟡 **缺乏乐观更新**：每次操作都等往返 + 全量刷新，手感迟滞。
- 🟡 **中英混排**：表头/历史模态中文，主体英文，无 i18n。统一或引入 `next-intl`。
- 🟡 **响应式缺失**：固定 240px 侧栏 + 8 列周视图 + `overflow:hidden`，移动端不可用。
  - 方案：断点降级（移动端折叠侧栏、周视图改为时间线/单列）。
- 🟢 文案/端口不一致（README 3000、控制台欢迎语 3000）需更新。

## 5. 安全（Security）

- 🔴 **无鉴权/授权**：任何访问者可读写、清空、（接入后）重置全部数据，单一共享数据集。
  - 方案：接入认证（Auth.js/NextAuth 等）与按用户隔离数据（增加 `userId` 维度）。
- 🔴 **无服务端输入校验**（见 1.2）：信任客户端入参。
- 🟡 **错误信息直出**：`errorMessage` 将底层异常 message 透传前端，可能泄露内部细节。
  - 方案：生产环境返回通用文案，详细错误仅记服务端日志。
- 🟢 **依赖与机密**：`.env*` 已被 gitignore（良好）；建议加依赖审计（`npm audit` / Dependabot）。

## 6. 可访问性（Accessibility）

- 🟡 **模态可访问性缺失**：自定义 `div` 模态无 `role="dialog"`/`aria-modal`、无焦点陷阱、不支持 ESC 关闭、遮罩不可键盘关闭。
  - 方案：用原生 `<dialog>` 或可访问库（Radix UI 等）；管理焦点。
- 🟡 **图标按钮缺无障碍名**：多为 `title`，部分缺 `aria-label`；应确保 `<button>` 可被读屏识别。
- 🟡 **纯色状态/优先级编码**：仅靠颜色区分，色觉障碍不友好。
  - 方案：辅以文本/图标/图案。
- 🟢 **行内编辑 textarea 无关联 label**；表单控件应补 `htmlFor`/`aria-label`。

## 7. 代码质量与工程化（Quality & DX）

- 🔴 **零测试**：无测试运行器与用例。
  - 方案：Vitest + React Testing Library（组件/hook）；对领域逻辑（状态机、日志生成）与工具函数（日期、分组）做单测；关键 API 用集成测试；`useGitTodoState` 用 `renderHook` 测试。
- 🟡 **`TodoSection.tsx` 1147 行**，单文件承载视图 + 模态 + 卡片 + 表单 + 日期工具。
  - 方案：拆为 `views/WeekView|TimelineView|GridView`、`TaskModal`、`TaskCard*`、`hooks/useTaskFilters`、`useTaskForm`、`lib/date`。
- 🟡 **`catch (err: any)` ×14**：违反自有「禁止 any」规范。
  - 方案：`catch (err: unknown)` + 复用 `errorMessage` 同款收窄工具（前端版）。
- 🟡 **全部 default export**：违反「优先命名导出」。
  - 方案：组件改命名导出（利于重构与自动导入）。
- 🟢 **魔法常量散落**：`TODAY_STR`、`sprint36/story/` 前缀、各页 pageSize、内联尺寸/颜色。
  - 方案：集中到常量模块；内联样式迁移到 CSS Module/令牌。
- 🟢 **README 为脚手架默认**：补充真实运行/部署/数据库说明。
- 🟢 **缺 CI/预提交**：建议加 GitHub Actions（lint + typecheck + test）与 Husky + lint-staged。

## 8. 与团队自有规范的对齐（Skill Compliance）

项目自带的 `strict-frontend-standards` / `senior-frontend-engineering` 已给出明确目标，建议把「回归自有规范」作为重构验收基线：

| 规范要求 | 落地建议 |
|---|---|
| 服务端状态 → TanStack Query | 用 `useQuery`/`useMutation` 替换 `useGitTodoState`，获得缓存、去重、乐观更新、失效刷新 |
| 客户端状态 → Zustand | UI 态（activeTab、视图/卡片模式、筛选）下沉到 Zustand store，减少 props 透传 |
| Tailwind + `cn()` | 若决定遵循该条则迁移样式体系；**若团队确认保留 CSS Modules，应更新 AGENTS.md/技能说明以消除「规范与现实」矛盾**（二选一，避免长期漂移） |
| 禁止内联样式/魔法值 | 内联样式迁移至模块化样式与设计令牌 |
| 命名导出 / 无 any / 函数 <40 行 | 见 §7 |
| 三态齐全 | 操作级加载/错误/空态补齐（见 §4） |

> 这里存在一个**治理层面的根本矛盾**需要决策：规范声明 Tailwind/TanStack/Zustand 为强制，但代码采用 CSS Modules + 手写 hook。建议团队明确「规范向代码看齐」还是「代码向规范看齐」，并据此统一，否则强制技能形同虚设。

---

## 9. 优先级行动清单（Roadmap）

### 🔴 P0 — 正确性与体验阻断项（建议立即）
1. 修复硬编码「今天」（1.1）——计划类功能的根本。
2. 后端引入 Zod 输入校验，枚举与类型同源（1.2 / 2.4）。
3. 行内编辑改防抖/失焦提交（1.3）。
4. 错误处理分级：操作失败用 toast，不再整屏替换（§4）。
5. 危险操作（删除/清空/PROD 晋级）加确认 + 撤销（§4）。

### 🟡 P1 — 架构与可维护性（1–2 个迭代）
6. 写操作改为返回受影响实体；接入已实现的服务端分页/搜索（2.1 / 2.2）。
7. 引入 TanStack Query + Zustand，替换手写状态层，落地乐观更新（§8）。
8. 抽离领域服务层并补关键单测/集成测试（2.3 / §7）。
9. 拆分 `TodoSection.tsx`，清理 `any`、default export、内联样式（§7）。
10. 修复 base 未透传（1.4）、统一 ID/时间戳（1.5/1.6）、删除孤儿文件与悬空接口（1.8）。

### 🟢 P2 — 安全、可访问性与工程化（持续）
11. 接入鉴权与按用户的数据隔离（§5）。
12. 可访问性达标（模态/aria/非纯色编码，§6）。
13. 响应式适配与视图懒加载（§4 / §3）。
14. 补 `.env.example`、刷新 README、加 CI 与预提交钩子（§7 / 2.5）。
15. 决策并统一「规范 vs 代码」的技术选型矛盾（§8）。

---

## 附录 A · 关键文件索引

| 关注点 | 文件 |
|---|---|
| 领域类型 | `src/types/index.ts` |
| 数据模型 | `prisma/schema.prisma` |
| 共享后端工具/快照 | `src/lib/db.ts` |
| Prisma 单例 | `src/lib/prisma.ts` |
| 初始数据/重置 | `src/lib/seed.ts` |
| 全局客户端状态 | `src/hooks/useGitTodoState.ts` |
| 主页面/三态 | `src/app/page.tsx` |
| 任务模块（最大组件） | `src/components/TodoSection.tsx` |
| 分支矩阵 | `src/components/BranchSection.tsx` |
| 控制台 | `src/components/Console.tsx` |
| 设计令牌 | `src/app/globals.css` |
| 接口审计（既有） | `API-AUDIT.md` |
| 团队规范 | `skill/strict-frontend-standards/SKILL.md`、`skill/senior-frontend-engineering/SKILL.md` |

## 附录 B · 本文档分析方法

- 通读全部源码（API 路由、组件、hook、数据层、Prisma schema/migration/seed、配置与样式令牌）逆向归纳需求与规则。
- 通过追踪 `useGitTodoState` 的 `fetch` 调用，逐一核对前后端契约，确认「后端已实现但 UI 未接入」的端点集合。
- 对照项目自带强制技能逐条审查，标注符合/偏差。
- 优化建议均给出「现状 → 影响 → 方案」，并按 P0/P1/P2 排序，避免过度工程化。

> 全文约定：🔴 高优先级（阻断/风险）｜🟡 中优先级（架构/维护）｜🟢 低优先级（打磨/工程化）。
