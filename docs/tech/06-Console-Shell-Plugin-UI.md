# 技术开发文档 06：Console Shell 与 Plugin Management UI

## 1. 目标

建立最小 FDE.AI Console 前端壳，并完成 Plugin 管理 UI。

## 2. 页面结构

```text
Console
├── Overview（占位）
├── Plugins
├── Memory（占位）
└── Timeline（占位）
```

本任务只把 Plugins 做完整；其他页面只需能导航，不做业务实现。

## 3. Plugin List

展示：

```text
Name
Description
Type / Capabilities
Version
Status
Last Activity
```

提供：

```text
Enable / Disable
Open Detail
```

## 4. Plugin Detail

至少包含：

```text
Overview
Manifest
Capabilities
Runtime Status
Last Activity
Error Count
```

Capabilities 分类：

```text
Services
Tools
Skills
Observation Sources
Memory Handlers
```

## 5. UI 状态

启停按钮必须反映异步状态：

```text
Enabled
  → disabling...
  → Disabled
```

操作失败时展示错误，不要静默失败。

## 6. 数据来源

只能通过 Plugin Management API 获取数据；不要让前端直接读数据库或模拟第二套 Plugin 状态。

## 7. 文件边界

优先：

```text
src/ui/**
src/pages/plugins/**
src/components/plugins/**
```

遵守现有前端框架和设计系统。

禁止：
- 引入新的 UI 框架。
- 修改后端 Plugin Registry 设计。
- 实现 Memory / Timeline 页面。

## 8. 验收

1. 可打开 Plugins。
2. 能看到已注册 Plugin。
3. 可启用/停用。
4. 状态与后端一致。
5. Detail 能看到能力类型。
6. 页面无硬编码 Plugin 列表。

## 9. 变更预算

目标：**≤ 900 行代码变更**。
