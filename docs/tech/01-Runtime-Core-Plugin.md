# 技术开发文档 01：Runtime Core 与 Plugin Runtime

## 1. 目标

建立 Phase 1 最小 Plugin Runtime，使 Plugin 可以：

- 被发现/注册。
- 读取 manifest。
- setup 初始化。
- start 启动。
- stop 停止。
- enable / disable。
- 被 Console 查询基础状态。

Plugin 是 Runtime Extension Unit，不等于 Tool 或 Skill。Plugin 可以提供 Service、Tool、Skill、Observation Source、Memory Handler 等能力。

## 2. 本次只做

### 2.1 Manifest

定义最小字段：

```ts
interface PluginManifest {
  id: string
  name: string
  version: string
  description?: string
  capabilities?: {
    services?: string[]
    tools?: string[]
    skills?: string[]
    observationSources?: string[]
    memoryHandlers?: string[]
  }
}
```

### 2.2 Plugin 接口

```ts
interface Plugin {
  manifest: PluginManifest
  setup?(ctx: PluginContext): Promise<void> | void
  start?(ctx: PluginContext): Promise<void> | void
  stop?(ctx: PluginContext): Promise<void> | void
}
```

### 2.3 Registry

提供：

```text
register(plugin)
get(id)
list()
enable(id)
disable(id)
getStatus(id)
```

状态最少支持：

```text
registered / starting / enabled / stopping / disabled / error
```

### 2.4 PluginContext

本任务只定义接口，不实现完整 Service：

```ts
interface PluginContext {
  logger: Logger
  config: ConfigService
}
```

后续任务再注入 EventBus、Memory 等能力。

## 3. 生命周期

```text
registered
  ↓ enable
starting
  ↓ start success
enabled

enabled
  ↓ disable
stopping
  ↓ stop success
 disabled
```

start/stop 抛错时进入 `error`，错误必须可记录；不要吞异常。

## 4. Plugin Discovery

优先复用现有项目的加载机制。

若当前没有 Plugin Loader，本任务增加最小静态 loader：从明确配置的 plugin entry 列表加载，不实现远程下载安装。

## 5. 文件边界

优先新增/修改：

```text
src/runtime/plugin/**
src/runtime/types/**
plugins/examples/**
tests/runtime/plugin/**
```

具体路径以仓库现有结构为准。

禁止：
- 修改前端页面。
- 实现 Observation 持久化。
- 实现 Memory 数据库。
- 引入复杂依赖注入框架。
- 实现远程 Plugin Marketplace。

## 6. 验收标准

1. 一个最小 TestPlugin 可以注册并启停。
2. 重复 register 相同 id 必须有明确错误。
3. disable 后 `status=disabled`。
4. start/stop 失败时状态为 error。
5. `list()` 能返回 manifest 和 runtime status。
6. 有生命周期单元测试。

## 7. 变更预算

目标：**≤ 700 行代码变更**。
