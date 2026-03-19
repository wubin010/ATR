---
name: ask-to-remember
description: "Injects ATR trigger reminder and Phase B resolution rules during agent bootstrap"
metadata: {"openclaw":{"emoji":"🎯","events":["agent:bootstrap"]}}
---

# Ask-to-Remember Bootstrap Hook

Injects ATR prompt into every main-session agent run as a virtual bootstrap file.

## What It Does

- Fires on `agent:bootstrap`
- Pushes `ASK_TO_REMEMBER.md` virtual file containing:
  - Phase A trigger reminder (short, points to SKILL.md)
  - Phase B pending-question resolution rules (complete)
- ATR is main-session only (enforced by prompt, not code)

## Configuration

No configuration needed. Installed automatically with the ask-to-remember skill.
