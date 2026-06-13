# 系统接口审计 · 缺失接口清单

> 生成日期：2026-06-04
> 项目：todolist（Next.js 16 + React 19 + TypeScript）
> 审计维度：① RESTful CRUD 完整性 ② 前后端契约一致性 ③ 业务域常见但未提供的能力

---

## 一、当前已实现接口（9 个端点 / 6 个路由文件）

| 路由文件 | 方法 | 用途 |
|---|---|---|
| `api/data` | GET | 全量拉取 todos + branches + logs |
| `api/todos` | POST | 创建任务（可联动创建分支） |
| `api/todos/[id]` | PUT / DELETE | 更新 / 删除任务 |
| `api/branches` | POST | 创建分支 |
| `api/branches/[id]` | PUT / DELETE | 更新（env 推进 / 状态 / 字段编辑 / 通用） / 删除分支 |
| `api/logs` | POST / DELETE | 追加单条日志 / 清空日志 |

**架构特征**：所有写操作都返回**整库快照**，前端仅靠 `GET /api/data` 一次性加载。这是有意的简化，下列"缺失"需结合该前提判断。

---

## 二、缺失接口清单

### 🔴 A 类：查询 / 读取接口（GET）缺失 —— 客观缺口

除 `/api/data` 外，**不存在任何资源级查询接口**。三个集合路由只导出 `POST`/`DELETE`，两个 `[id]` 路由只有 `PUT`/`DELETE`，全部缺 `GET`：

| 缺失接口 | 方法 | 用途 | 优先级 |
|---|---|---|---|
| `/api/todos` | GET | 任务列表（过滤 / 分页 / 排序） | 高 |
| `/api/todos/[id]` | GET | 单任务详情 | 中 |
| `/api/branches` | GET | 分支列表 | 高 |
| `/api/branches/[id]` | GET | 单分支详情（含 `history`） | 中 |
| `/api/logs` | GET | 日志列表（按 `type` 过滤 / 分页） | 中 |

### 🟡 B 类：前后端契约不一致 —— 悬空接口

| 接口 | 问题 |
|---|---|
| `POST /api/logs` | 后端已实现"追加单条日志"，但 `useGitTodoState.ts` **未暴露对应方法**，UI 无法调用。需补前端 `addLog`，或确认为冗余后删除。 |

> 反向核对：前端 `fetch` 的 13 处调用**全部**有后端实现，**不存在"前端调用了但后端缺失"的接口**。

### 🟢 C 类：业务能力建议补充（可选，非缺陷）

结合 Git 风格任务 / 分支管理域，按需取用：

- `PATCH /api/todos/batch` —— 看板批量改状态 / 批量删除
- `GET /api/branches/[id]/history` —— 分支历史独立查询（目前内嵌在 branch 内）
- `GET /api/stats` —— 仪表盘统计（各状态任务数、分支环境分布）
- `POST /api/data/reset` —— 重置为种子数据（`db.ts` 已有 `INITIAL_*` 常量，但无重置入口）
- 鉴权层（若要支持多用户）—— 当前完全无 auth

---

## 三、工程判断与建议

1. **优先补齐 A 类 GET 接口**：当前"全量返回"模式在数据量小时可用，但一旦需要列表分页、搜索过滤或单资源详情（如分支历史抽屉），就必须有独立查询端点，否则前端只能反复整库拉取，性能与可维护性都会恶化。
2. **B 类应立即消除**：悬空的 `POST /api/logs` 属于契约漂移，要么接入要么删除，避免后续误用。
3. **C 类按业务节奏推进**：不必一次补全，避免过度工程；待对应 UI 需求出现时再实现。

---

## 附：缺失接口汇总（速查）

| # | 接口 | 方法 | 类别 | 优先级 |
|---|---|---|---|---|
| 1 | `/api/todos` | GET | A | 高 |
| 2 | `/api/branches` | GET | A | 高 |
| 3 | `/api/todos/[id]` | GET | A | 中 |
| 4 | `/api/branches/[id]` | GET | A | 中 |
| 5 | `/api/logs` | GET | A | 中 |
| 6 | `POST /api/logs` 前端接入 | —— | B | 高 |
| 7 | `/api/todos/batch` | PATCH | C | 低 |
| 8 | `/api/branches/[id]/history` | GET | C | 低 |
| 9 | `/api/stats` | GET | C | 低 |
| 10 | `/api/data/reset` | POST | C | 低 |
