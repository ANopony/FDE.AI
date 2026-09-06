# FDE.AI

> AI as FDE — an AI Agent that works like an FDE to understand customers' work and discover opportunities for optimization, automation, and AI enhancement.

## Vision

FDE.AI acts as a **general-purpose FDE**.

It enters a customer's business environment, continuously observes how people work, understands roles, tasks, processes, systems, and problems, and gradually builds a structured understanding of the business.

Most of this process is **unobtrusive**. The Agent only actively interacts when it needs clarification or confirmation that cannot be reliably obtained from observation.

## Core Loop

```text
Customer Work
    ↓
Silent Observation
    ↓
Understand & Store Memory
    ↓
Daily Review
    ↓
Daily Ask (when needed)
    ↓
Long-term Accumulation
    ↓
Discover Patterns / Problems
    ↓
Generate Optimization Opportunities
    ↓
Customer Review
    ↓
Implementation / Automation / AI
    ↓
Continue Observation
```

## Architecture

```text
                         ┌────────────────────┐
                         │      FDE.AI        │
                         │     Core Agent     │
                         │ Understand / Plan   │
                         │ Reason / Orchestrate│
                         └─────────┬──────────┘
                                   │
                   ┌───────────────┼───────────────┐
                   ↓               ↓               ↓
              Perception         Memory         Reasoning
                   │               │               │
                   └───────────────┼───────────────┘
                                   ↓
                              Plugins
       Chat · Document · Process · Knowledge · Data · System · Domain
```

The **Core Agent** is the central intelligence. Supporting capabilities are implemented as **pluggable modules** that can be added or replaced according to the customer and scenario.

## Key Principles
deeps
- **Silent by default** — most perception and memory building happens without interrupting the customer.
- **Ask selectively** — Daily Ask is used only when clarification materially improves understanding.
- **Memory first** — optimization decisions are based on accumulated evidence over time.
- **Long-term discovery** — opportunities emerge from repeated patterns, bottlenecks, exceptions, and inefficiencies.
- **Plugin-based** — specialized capabilities remain modular and replaceable.

## Status

Early-stage architecture and prototype.
