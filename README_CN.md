<div align="center">

# ATR: Ask-to-Remember

**轻量地，让 Agent 更懂用户。**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-OpenClaw-orange)](https://openclaw.ai/)

[English](README.md) · [中文](README_CN.md) · [ClawHub](https://clawhub.ai/wubin010/preference-guide)

</div>

---

## 简介

ATR（Ask-to-Remember）是一个轻量的 Agent Skill，帮助 Agent 在完成任务后，自然地多问一句，逐步积累用户可复用的偏好与习惯。

不打断任务，不变成问卷，不试图强行记住一切，而是用一种足够轻的方式，让 Agent 有机会慢慢学会更懂用户。只在合适的时机补一个低打扰的小问题：

> 对了，以后这种情况，你更偏向 A、B，还是 C？

## 核心特点

- **轻量**：先完成任务，再在合适时机补一个小问题。足够小，才能真正融入日常交互。
- **主动**：识别到偏好缺口时主动提问，减少未来的猜测成本。
- **渐进**：不试图一次记住一切，而是逐步积累真正影响协作体验的细节。

## 实现原理

- **Skill**：判断当前对话是否存在值得长期复用的偏好缺口，在合适时机把追问自然接在正常回复后面。
- **AGENTS.md 注入**：在宿主侧处理下一轮回复的状态流转——回答了写入记忆，拒绝了不再问，模糊或忽略了也有明确收口规则。

## 平台支持

目前仅支持 [OpenClaw](https://openclaw.ai/)。

## 项目结构

```
ask-to-remember/
├── SKILL.md                        # Skill 执行手册
├── hooks/openclaw/
│   ├── HOOK.md                     # Hook 说明
│   └── handler.js                  # Bootstrap Hook（可选）
└── references/
    └── test-scenarios.md           # 测试场景与验证用例
```

## 安装

将 `ask-to-remember/` 目录放入你的 Skills 目录即可。

如果你的宿主支持 OpenClaw Hooks，还可以安装可选的 bootstrap hook 实现自动注入：

```bash
mkdir -p ~/.openclaw/hooks/ask-to-remember
cp ask-to-remember/hooks/openclaw/HOOK.md ask-to-remember/hooks/openclaw/handler.js ~/.openclaw/hooks/ask-to-remember/
```

详细的执行规则和状态管理说明，参见 [SKILL.md](ask-to-remember/SKILL.md)。

## License

[MIT](LICENSE)
