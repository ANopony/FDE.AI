# 技术开发文档 09：Phase 1 E2E Demo 与 Hardening

## 1. 目标

不增加核心新能力，而是把前 8 个任务组成一个稳定、可演示、可回归的最小闭环。

## 2. Demo Scenario

使用 Test Observer / Mock Plugin 模拟：

```text
10:00 Test Observer
发现新商机
        ↓
Observation
        ↓
Agent Event（可由 Mock Processor 产生）
        ↓
Memory create
        ↓
Revision #1

10:05 Test Observer
商机阶段发生变化
        ↓
Observation
        ↓
Agent Event
        ↓
Memory update
        ↓
Revision #2
        ↓
Diff
```

## 3. E2E 验收链

```text
Plugin enabled
  ↓
Observation emit
  ↓
Timeline visible
  ↓
Memory created
  ↓
Memory revision visible
  ↓
Plugin disabled
  ↓
No new observation from that plugin
```

## 4. Hardening 内容

只处理 Phase 1 范围内的问题：

- lifecycle race condition
- 重复 event id
- 分页边界
- 失败状态展示
- 基础错误日志
- 测试数据清理
- README / local run instructions

## 5. 不做

- 性能压测平台。
- 分布式高可用。
- 完整 RBAC。
- 真实 CRM / ERP 集成。
- Agent 复杂推理优化。

## 6. 文件边界

优先：

```text
tests/e2e/**
tests/integration/**
scripts/demo/**
docs/**
```

若发现前序任务存在缺陷，只做最小修复，不进行结构重写。

## 7. 验收

新开发者能够按照 README 在本地启动，并运行一条完整 E2E：

```text
Plugin → Observation → Agent Event → Memory → Revision → Timeline
```

同时可从 Console：

```text
Plugins → disable/enable
Memory → 查看当前记忆与 Diff
Timeline → 查看完整证据链
```

## 8. 变更预算

目标：**≤ 900 行代码变更**。
