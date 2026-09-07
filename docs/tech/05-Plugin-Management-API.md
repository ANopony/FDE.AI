# 技术开发文档 05：Plugin Management API

## 1. 目标

为 Phase 1 Console 提供 Plugin 管理 API：列表、详情、能力信息、启用、停用和基础运行状态。

## 2. API

建议：

```text
GET    /api/plugins
GET    /api/plugins/:id
POST   /api/plugins/:id/enable
POST   /api/plugins/:id/disable
```

如果项目 API 风格不同，保持一致，不为本任务大规模改 Router。

## 3. List Response

至少包括：

```text
id
name
description
version
status
capabilities
lastActivity
errorCount
```

`capabilities` 从 Plugin Manifest / Registry 派生，不重复维护第二套配置。

## 4. Detail Response

增加：

```text
manifest
status
lifecycle timestamps
recent activity summary
```

第一阶段不要求完整日志正文。

## 5. Enable / Disable

调用 Runtime Registry，而不是在 API 层自行修改数据库状态。

```text
API
 ↓
PluginRegistry.enable/disable
 ↓
Lifecycle
 ↓
Runtime Status
```

成功后返回当前状态。

## 6. 并发与幂等

- enable 已 enabled：允许幂等返回 enabled。
- disable 已 disabled：允许幂等返回 disabled。
- 同一个 Plugin 不允许并发 start/stop。

## 7. 错误

至少区分：

```text
404 Plugin Not Found
409 Invalid Lifecycle Transition
500 Plugin Runtime Error
```

错误结构遵循项目现有 API 错误规范。

## 8. 文件边界

优先：

```text
src/api/plugins/**
src/runtime/plugin/**（仅为 API 适配必要修改）
tests/api/plugins/**
```

禁止：
- 修改 Plugin Manifest 规范。
- 新增 Plugin Marketplace。
- 做完整权限系统。
- 实现前端。

## 9. 验收

通过 API 可以：

```text
list → detail → disable → verify status → enable → verify status
```

并且实际 Runtime 生命周期发生变化。

## 10. 变更预算

目标：**≤ 700 行代码变更**。
