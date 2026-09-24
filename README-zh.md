# FDE.AI

> AI as FDE —— 像 FDE 一样进入客户业务现场，理解客户工作，并持续发现流程优化、自动化和 AI 化机会的通用 Agent。

## 愿景

FDE.AI 本身就是一个**通用型 FDE**。

它进入客户的业务环境，持续观察实际工作方式，理解岗位、任务、流程、系统和问题，并逐步建立对客户业务的结构化认知。

这个过程大部分是**无感的**。只有当某些关键信息无法通过观察可靠获得，且确认结果会影响后续理解或优化判断时，Agent 才主动与客户交互。

## 核心闭环

```text
客户日常工作
    ↓
无感感知
    ↓
理解并写入 Memory
    ↓
Daily Review
    ↓
Daily Ask（必要时）
    ↓
长期积累
    ↓
发现模式 / 问题
    ↓
生成优化机会
    ↓
客户 Review
    ↓
实施 / 自动化 / AI 化
    ↓
继续感知
```

## 架构

```text
                         ┌────────────────────┐
                         │      FDE.AI        │
                         │     Core Agent     │
                         │  理解 / 规划 / 推理 │
                         │       / 编排       │
                         └─────────┬──────────┘
                                   │
                   ┌───────────────┼───────────────┐
                   ↓               ↓               ↓
                   感知           Memory           推理
                   │               │               │
                   └───────────────┼───────────────┘
                                   ↓
                                Plugins
       对话 · 文档 · 流程 · 知识 · 数据 · 系统 · 领域
```

**Core Agent** 是核心智能，其他能力以**可插拔模块（Plugin）**的形式存在，可根据客户和场景自由组合、增加或替换。

## 核心原则

- **插件化** —— 专项能力保持模块化、可替换，Memory模块、感知模块都是插件。
- **默认无感** —— 大部分感知和 Memory 构建不会打扰客户。
- **选择性提问** —— 只有澄清信息能够实质提升理解时才触发 Daily Ask。
- **Memory 优先** —— 优化判断建立在长期积累的证据之上。
- **长期发现** —— 通过持续观察发现重复工作、流程瓶颈、异常和低效环节。


## 当前状态

Phase 1 —— Runtime & Observability MVP。最小闭环已实现且可演示：

```text
Plugin -> Observation -> Agent Event（Mock）-> Memory -> Memory Revision/Diff -> Timeline
```

已实现：Plugin Runtime（Manifest / Registry / 生命周期）、Event Bus、Observation 运行时
（PostgreSQL + Drizzle）、Memory Core（Revision 与可读 Diff）、Timeline 查询 API、
Plugin Management API、Memory Viewer UI、Timeline UI、Console 壳。

### 目录结构

```text
apps/runtime      Fastify 运行时：插件注册表、Observation、Memory、Timeline、REST API
apps/console      Next.js Console：Plugins / Memory / Timeline 页面
packages/domain   框架无关的领域契约（Zod Schema + 类型）
packages/event-bus        进程内 EventBus（接口定义在 domain）
packages/database         Drizzle/PostgreSQL 实现 + 供演示与测试用的内存实现
packages/api-client       Console 使用的类型化 REST 客户端
plugins/examples/*        示例插件（demo-observer、test-observer）
tests/integration         Vitest 集成测试（完整闭环 + 硬化）
tests/e2e                 Playwright 演示流程
scripts/demo              一条命令跑完整闭环（无需数据库）
```

### 环境要求

- Node.js >= 20（开发使用 24）、pnpm >= 10
- PostgreSQL 16 —— 可选：`FDE_STORE_DRIVER=memory` 可在无数据库的情况下运行整个栈
  （docker compose 仅持久化驱动需要）

### 安装

```bash
pnpm install
pnpm build        # turbo 构建全部包（含 next build）
```

### 无需数据库的演示

```bash
pnpm demo         # 等价于 node scripts/demo/run-demo.mjs
```

脚本会打印 Phase 1 演示的全部 13 步：启用插件、产生 Observation、Mock Agent 处理、
创建/更新 Memory、Revision Diff、Timeline 证据链、停用插件后不再产生 Observation。

### 本地启动完整栈

```bash
pnpm build

# 运行时（Fastify，端口 3000）；去掉 FDE_STORE_DRIVER 即改用 PostgreSQL
FDE_STORE_DRIVER=memory \
FDE_PLUGIN_ENTRIES=./plugins/examples/test-observer/dist/index.js \
FDE_AGENT_MOCK_ENABLED=true \
FDE_DEMO_ENDPOINTS=true \
node apps/runtime/dist/server.js

# Console（Next.js，端口 3001，/api/* 反向代理到运行时）
pnpm --filter @fde-ai/console start     # 生产构建；开发时用 dev
```

使用 PostgreSQL 时：

```bash
docker compose up -d db
FDE_DATABASE_URL=postgres://fde:fde@localhost:5432/fde node apps/runtime/dist/server.js
```

若 5432 端口不可用（部分 Windows 环境将其划入保留区间，可用
`netsh interface ipv4 show excludedportrange protocol=tcp` 查看），可另选宿主端口：

```bash
FDE_DB_PORT=5544 docker compose up -d db
FDE_DATABASE_URL=postgres://fde:fde@localhost:5544/fde node apps/runtime/dist/server.js
```

打开 http://127.0.0.1:3001，在 Plugins 页启用插件后用 curl 触发一条 Observation：

```bash
curl -X POST http://127.0.0.1:3000/api/demo/observations \
  -H 'content-type: application/json' \
  -d '{"payload":{"customer":"Acme","stage":"lead"}}'
```

### 环境变量

环境变量到点分配置键的映射规则：去掉 `FDE_` 前缀后小写，并把 `_` 替换为 `.`
（例如 `FDE_PLUGIN_AUTOENABLE` → `plugin.autoenable`）。

| 变量 | 用途 | 默认值 |
|---|---|---|
| `FDE_STORE_DRIVER` | `postgres` 或 `memory` | `postgres` |
| `FDE_DATABASE_URL` | PostgreSQL 连接串 | `postgres` 驱动必填 |
| `FDE_SERVER_PORT` / `FDE_SERVER_HOST` | REST API 监听地址 | `3000` / `127.0.0.1` |
| `FDE_PLUGIN_ENTRIES` | 逗号分隔的插件模块路径（相对工作目录解析） | 空 |
| `FDE_PLUGIN_AUTOENABLE` | 启动时自动启用的插件 id（或 `*`） | 空 |
| `FDE_AGENT_MOCK_ENABLED` | 启动 Mock Agent Processor | `false` |
| `FDE_DEMO_ENDPOINTS` | 启用 `POST /api/demo/observations` | `false` |
| `RUNTIME_URL`（Console） | `/api` 代理目标 | `http://127.0.0.1:3000` |

### 测试

```bash
pnpm typecheck     # 全包类型检查（含测试）
pnpm lint          # eslint
pnpm test          # vitest：单元 + 集成 + PGlite 上的 Drizzle SQL 层

# 额外用真实 PostgreSQL 跑同一套 SQL 层测试
TEST_DATABASE_URL=postgres://fde:fde@localhost:5432/fde pnpm test

# 针对已启动栈的 E2E（首次需安装浏览器）
pnpm --filter @fde-ai/tests exec playwright install chromium
pnpm test:e2e
```

E2E 通过 Console 驱动已启动的运行时；**使用内存驱动时请在两次 E2E 之间重启运行时**，
因为该演示流程要求空的存储（否则会合并到已存在的 opportunity Memory 上）。

