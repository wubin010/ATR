<div align="center">

# ATR: Ask-to-Remember

**Lightweight skill that helps your Agent truly understand you.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-OpenClaw-orange)](https://openclaw.ai/)

[English](README.md) · [中文](README_CN.md) · [ClawHub](https://clawhub.ai/wubin010/preference-guide)

</div>

---

## What is ATR?

ATR (Ask-to-Remember) is a lightweight Agent Skill that helps your Agent naturally learn your preferences over time. After completing a task, it asks one small follow-up question at the right moment — gradually building up reusable knowledge about your habits and preferences.

No interruptions. No surveys. No forced memorization. Just a gentle nudge when it matters:

> *By the way, for situations like this in the future, do you prefer A, B, or C?*

## Key Features

- **Lightweight** — Completes the task first, then asks a small question at the right moment. Small enough to blend into everyday interactions.
- **Proactive** — Identifies preference gaps and asks questions proactively, reducing future guesswork.
- **Gradual** — Doesn't try to remember everything at once. Accumulates the details that truly impact collaboration over time.

## How It Works

- **Skill**: Determines whether the current conversation contains a preference gap worth retaining long-term, and naturally appends the follow-up question after the normal response.
- **AGENTS.md Injection**: Handles state transitions on the host side for the next round — answered preferences get written to memory; declined ones won't be asked again; ambiguous or ignored responses have clear fallback rules.

## Platform Support

Currently supports [OpenClaw](https://openclaw.ai/) only.

## Project Structure

```
ask-to-remember/
├── SKILL.md                        # Skill execution manual
├── hooks/openclaw/
│   ├── HOOK.md                     # Hook documentation
│   └── handler.js                  # Bootstrap Hook (optional)
└── references/
    └── test-scenarios.md           # Test scenarios & validation cases
```

## Installation

Drop the `ask-to-remember/` directory into your Skills directory.

If your host supports OpenClaw Hooks, you can also install the optional bootstrap hook for automatic injection:

```bash
mkdir -p ~/.openclaw/hooks/ask-to-remember
cp ask-to-remember/hooks/openclaw/HOOK.md ask-to-remember/hooks/openclaw/handler.js ~/.openclaw/hooks/ask-to-remember/
```

For detailed execution rules and state management, see [SKILL.md](ask-to-remember/SKILL.md).

## License

[MIT](LICENSE)
