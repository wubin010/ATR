# Ask-to-Remember (ATR)

**面向 LLM Agent 的主动记忆采集层**
*A Proactive Memory Acquisition Layer for LLM Agents*

> ATR 不是又一个 memory 系统——它是叠加在任何 memory 系统之上的 **acquisition layer**，
> 只回答一个问题：**什么时候该主动问、问什么、把答案写到底层 memory。**

---

## 1. 问题定义与动机

### 1.1 被动 vs 主动：两种记忆范式

当前主流的 LLM 记忆系统（memGPT、mem0、mem9）都遵循同一范式：

> **被动记忆**：从用户自然对话中自动提取信息，写入长期存储。

这种范式的隐含假设是：*用户会自然透露所有有用的信息*。但在真实场景中，这个假设经常不成立：

| 维度 | 被动记忆 | 主动记忆（ATR） |
|------|---------|----------------|
| 信息来源 | 用户碰巧提到 | Agent 判断后主动获取 |
| 触发时机 | 用户说了才记 | Agent 预判到未来需要，提前问 |
| 信息质量 | 噪声多，冗余多 | 针对性强，结构化程度高 |
| 打扰成本 | 零（不问） | 显式建模并优化 |
| 未来收益 | 偶然的 | 可量化、可优化 |

### 1.2 信息/时机/成本三维不对称

被动记忆的根本限制在于三维不对称：

1. **信息不对称**：用户不知道 Agent 缺什么信息。用户不会主动说"我喜欢靠过道座位"，除非你在帮他订机票——但你帮他订机票时，他的偏好早该在 memory 里了。

2. **时机不对称**：信息的最佳获取时机往往不是信息的使用时机。在闲聊时了解到的偏好，可能在两周后的任务中才用到。被动记忆只能在"碰巧提到"时捕获，错过了大量最佳采集窗口。

3. **成本不对称**：问一个问题的边际成本极低（一句话），但获得的信息可能在未来 N 次交互中反复使用。不问的隐性成本（持续的次优推荐、反复的澄清对话）远大于问一次的显性成本。

### 1.3 核心主张

> 主动提问应该被建模为一个**可优化的决策问题**：
> 在每轮交互中，Agent 评估"多问一句"的期望未来收益是否超过打扰成本，
> 并在肯定时生成一个高价值、低摩擦的问题。

这不是一个 prompt engineering 技巧，而是一个需要独立系统支持的能力——这就是 ATR。

---

## 2. 相关工作与定位

### 2.1 现有 Memory 系统对比

| 维度 | memGPT (Letta) | mem0 | mem9 | **ATR** |
|------|---------------|------|------|---------|
| **核心理念** | 分层记忆管理 | 自动提取 + 向量检索 | 云端 smart ingest | **主动采集决策** |
| **记忆来源** | 对话记录自动归档 | 对话自动提取 | 对话自动提取 + 调和 | **主动提问获取** |
| **采集方式** | 被动（自主管理上下文窗口） | 被动（后台提取） | 被动（smart pipeline） | **主动（ASK/PASS 决策）** |
| **打扰模型** | 无 | 无 | 无 | **显式 Annoyance Cost** |
| **存储层** | 自带（main/archival/recall） | 自带（向量 DB） | 自带（云端 + 向量） | **不自带，Backend 可插拔** |
| **与 Agent 关系** | 是 Agent 架构 | 是中间件 | 是插件 | **是叠加层** |
| **适用范围** | 独立 Agent | 多平台 | OpenClaw 专属 | **任何 Agent + 任何 Memory** |

### 2.2 ATR 的差异化定位

ATR 与上述系统**不是竞争关系，而是互补关系**：

```
              ┌─ memGPT ─┐
ATR Layer ──→ ├─ mem0    ─┤ ──→ Memory Storage & Retrieval
              ├─ mem9    ─┤
              └─ 原生 MD  ─┘
```

ATR 回答的问题是：**"底层 memory 系统缺少什么信息？获取它的收益是否大于打扰成本？"**
底层 memory 系统回答的问题是：**"信息怎么存、怎么检索、怎么过期。"**

这两个问题正交。你可以在 mem9 上叠加 ATR，也可以在原生 Markdown 上叠加 ATR，甚至可以在 memGPT 上叠加 ATR。

### 2.3 为什么不在现有系统内部做

- **memGPT** 的核心是上下文窗口管理，不是采集决策
- **mem0** 的 `add()` API 不支持"主动问用户"
- **mem9** 的 smart pipeline 是 ingest 后处理，不能在 ingest 前决策

主动采集需要独立的 Detector → Planner → Writer 流水线，它不属于任何一个 memory 系统的职责范围。

---

## 3. 系统架构总览

ATR 的架构分三个阶段演进，核心是**保持采集层的独立性**。

### 3.1 Phase 1 — MVP：纯采集层

```
┌──────────────────────────────────────────┐
│              ATR Layer                    │
│                                          │
│  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │ Module A  │→│ Module B  │→│Module C │ │
│  │ Detector  │  │ Planner   │  │ Writer  │ │
│  └──────────┘  └──────────┘  └────────┘ │
│       ↑               ↑            │     │
│       │  ContextEngine Hooks       ↓     │
└───────┼────────────────────────────┼─────┘
        │                            │
        │    MemoryBackend 抽象接口   │
        ↓                            ↓
┌──────────────────────────────────────────┐
│        底层 Memory 系统                   │
│   (MVP 默认: OpenClaw 原生 Markdown)     │
└──────────────────────────────────────────┘
```

**特点**：
- 纯采集层，只负责 ASK / PASS 决策
- 三个模块线性流水线：检测机会 → 规划问题 → 写入记忆
- Memory 后端可插拔，MVP 默认使用 OpenClaw 原生 Markdown 文件
- 通过 OpenClaw ContextEngine hooks 接入 Agent 生命周期
- LLM Detector + LLM Planner

### 3.2 Phase 2 路线 A — 独立 Layer 做强

```
┌───────────────────────────────────────────────┐
│            ATR Layer (增强版)                   │
│                                                │
│  ┌────────────────┐  ┌─────────────────────┐  │
│  │  ML Detector    │  │  Value Planner      │  │
│  │  (trained model)│  │  (utility estimator)│  │
│  └────────────────┘  └─────────────────────┘  │
│                                                │
│  ┌────────────────┐  ┌─────────────────────┐  │
│  │ Privacy Filter  │  │  Analytics Engine   │  │
│  └────────────────┘  └─────────────────────┘  │
│                                                │
│  ┌─────────────────────────────────────────┐  │
│  │  Multi-agent Coordination               │  │
│  └─────────────────────────────────────────┘  │
└───────────────────────┬───────────────────────┘
                        │ Adapter 接口
            ┌───────────┼───────────┐
            ↓           ↓           ↓
       ┌────────┐  ┌────────┐  ┌────────┐
       │  mem9   │  │  mem0   │  │ memGPT │
       └────────┘  └────────┘  └────────┘
```

**特点**：
- ATR 仍是独立层，但能力更强
- Detector 升级为 ML 模型（可 RL 训练）
- Planner 加入 utility estimator，量化每个候选问题的期望收益
- 加入隐私过滤器，防止采集敏感信息
- 加入分析引擎，跟踪采集效果
- 支持多 backend adapter，可同时对接 mem9 / mem0 / memGPT
- 支持多 agent 场景下的记忆采集协调

### 3.3 Phase 2 路线 B — 完整 Memory 系统

```
┌───────────────────────────────────────────────┐
│         ATR Memory System (完整版)             │
│                                                │
│  ┌─────────────────────────────────────────┐  │
│  │  Acquisition Layer (ATR 核心)            │  │
│  │  Detector / Planner / Writer            │  │
│  └─────────────────────────────────────────┘  │
│                                                │
│  ┌─────────────────────────────────────────┐  │
│  │  Memory Management Layer                │  │
│  │  Storage / Retrieval / Compaction       │  │
│  │  Indexing / Conflict Resolution         │  │
│  └─────────────────────────────────────────┘  │
│                                                │
│  ┌─────────────────────────────────────────┐  │
│  │  Context Lifecycle (ContextEngine)      │  │
│  │  bootstrap / assemble / compact / ...   │  │
│  └─────────────────────────────────────────┘  │
└───────────────────────────────────────────────┘
```

**特点**：
- ATR 向下扩展，自带存储 / 检索 / 压缩 / 上下文管理
- "主动采集 + 被动记忆"合体
- 类似 "mem9 + ATR" 一体化，但以主动采集为核心差异化
- 完整的记忆生命周期管理

### 3.4 三阶段选择策略

| 阶段 | 定位 | 适用场景 | 依赖 |
|------|------|---------|------|
| MVP | 纯采集插件 | 快速验证核心价值 | OpenClaw + 原生 MD |
| 路线 A | 增强采集层 | 已有 memory 系统的团队 | 任意 memory backend |
| 路线 B | 完整系统 | 需要一体化方案的场景 | 独立运行 |

**建议**：先走 MVP → 路线 A，根据社区反馈决定是否走 B。路线 A 和 B 不矛盾，A 是 B 的子集。

### 3.5 端到端 Pipeline 数据流

三个模块 + 7 个 hook 组合在一起时，一次完整的主动采集循环如下：

#### 时序图：一次主动采集的完整生命周期（3 轮）

```
Turn N: ATR 决定提问                Turn N+1: Agent 问出问题          Turn N+2: 用户回答，ATR 采集
─────────────────────               ─────────────────────             ─────────────────────
     │                                    │                                │
     ▼                                    ▼                                ▼
 ┌────────┐                          ┌────────┐                      ┌────────┐
 │ ingest │ ← 普通消息               │ ingest │ ← 普通消息            │ ingest │ ← 匹配 pending Q!
 └───┬────┘                          └───┬────┘  (用户还没回答)       └───┬────┘
     ▼                                   ▼                                │ 组装 Q+A 文本
 ┌──────────┐                        ┌──────────┐                        │ → backend.write()
 │ assemble │ ← 注入已有记忆          │ assemble │ ← 注入记忆             │ pendingQ 出队
 └───┬──────┘  (无 pending Q)        └───┬──────┘  + <atr-ask-intent>    ▼
     ▼                                   ▼                           ┌──────────┐
 [Agent 回复]                        [Agent 回复，自然地问出问题]      │ assemble │ ← 注入记忆
     │                                   │                           └───┬──────┘
     ▼                                   ▼                               ▼
 ┌───────────┐                       ┌───────────┐                  [Agent 回复]
 │ afterTurn │                       │ afterTurn │                       │
 │           │                       └───────────┘                       ▼
 │ Module A: │                            │                          ┌───────────┐
 │ 检测到机会 │                            │ (cooldown，不提问)        │ afterTurn │
 │     │     │                                                       └───────────┘
 │     ▼     │
 │ Module B: │
 │ 生成问题   │──→ pendingQ 入队
 │           │    annoyanceBudget--
 └───────────┘
```

#### 两条采集路径对比

ATR 有两条信息进入 memory 的路径，共享同一个 MemoryBackend：

```
路径 1: 主动采集 (核心路径)              路径 2: 被动提取 (辅助路径)
─────────────────────────               ─────────────────────────
afterTurn                               onSubagentEnded
  │                                       │
  ▼                                       ▼
Module A: 检测机会                       从子 agent 结果中
  │                                     识别有价值信息
  ▼                                       │
Module B: 规划问题                         │
  │                                       │
  ▼                                       │
assemble: 注入问题意图                     │
  │                                       │
  ▼                                       │
用户回答                                   │
  │                                       │
  ▼                                       ▼
组装 Q+A 文本                      组装摘要文本
  │                                       │
  ▼                                       ▼
backend.write(text)               backend.write(text)
```

> ATR 只负责把文本传给 backend。结构化存储、schema、冲突解决都是底层 memory 系统的职责。

#### 单轮 Hook 触发顺序

在一个对话轮次中，ContextEngine hook 的触发顺序和 ATR 的行为：

| 顺序 | Hook | 触发条件 | ATR 行为 | 涉及模块 | state 读/写 |
|------|------|---------|---------|---------|------------|
| 1 | `bootstrap` | Agent 首次启动 | 初始化 budget + 恢复 pendingQ | — | 写 state.annoyanceBudget, state.pendingQuestions |
| 2 | `ingest` | 每条用户消息 | 检测是否回答了 pendingQ → 组装文本 → backend.write() | C | 读 state.pendingQuestions |
| 3 | `assemble` | 构建 prompt | backend.search() 注入相关记忆 + pendingQ 意图 | C | 读 state.pendingQuestions |
| 4 | `afterTurn` | Agent 回复后 | Detector → Planner → 生成 pendingQ | A + B | 写 state.pendingQuestions, state.annoyanceBudget |
| 5 | `compact` | 上下文压缩 | 无特殊操作（记忆管理是底层系统的事） | — | — |
| — | `prepareSubagentSpawn` | 创建子 agent | backend.search() 传递相关记忆 | C | — |
| — | `onSubagentEnded` | 子 agent 结束 | 从结果组装文本 → backend.write() | C | — |

> **关键设计决策**：Module A/B 在 `afterTurn` 中运行，但生成的问题不会立刻呈现给用户，而是写入 `state.pendingQuestions`，等下一轮 `assemble` 时作为意图注入 prompt。这样做的好处是：**ATR 不直接控制 Agent 输出，只通过 prompt 引导**——Agent 可以选择在合适的时机自然地问出问题，也可以因为当前上下文不合适而推迟。

---

## 4. OpenClaw 插件设计

本章是 MVP 的核心实现设计。ATR 作为 OpenClaw 插件，通过 ContextEngine 的 hook 机制接入 Agent 生命周期。

### 4.1 插件 Manifest

```json
{
  "id": "ask-to-remember",
  "name": "Ask-to-Remember",
  "kind": "memory",
  "description": "Proactive memory acquisition layer – decides when to ask, what to ask, and writes answers to long-term memory.",
  "version": "0.1.0",
  "homepage": "https://github.com/anthropics/ask-to-remember",
  "configSchema": {
    "type": "object",
    "properties": {
      "annoyanceBudget": {
        "type": "number",
        "default": 3,
        "description": "Maximum number of proactive questions per session"
      },
      "annoyanceCooldown": {
        "type": "number",
        "default": 5,
        "description": "Minimum turns between proactive questions"
      },
      "memoryBackend": {
        "type": "string",
        "enum": ["native-markdown", "mem9", "custom"],
        "default": "native-markdown",
        "description": "Where to store acquired memories"
      },
      "memoryBackendConfig": {
        "type": "object",
        "description": "Backend-specific configuration (e.g. apiUrl, apiKey for mem9)"
      },
      "questionCategories": {
        "type": "array",
        "items": { "type": "string" },
        "default": ["preference", "constraint", "routine", "profile"],
        "description": "Enabled question categories"
      },
      "maxMemories": {
        "type": "number",
        "default": 200,
        "description": "Maximum number of stored memories before compaction"
      },
      "debug": {
        "type": "boolean",
        "default": false,
        "description": "Enable debug logging for detector/planner decisions"
      }
    }
  }
}
```

### 4.2 ContextEngine Hook 映射

ATR 利用 OpenClaw ContextEngine 的 7 个生命周期 hook 来驱动采集流水线：

| Hook | 触发时机 | ATR 行为 | 核心模块 |
|------|---------|---------|---------|
| `bootstrap` | Agent 启动 | 加载已有记忆 + 初始化 annoyance budget + 加载 pending questions | C (Reader) |
| `ingest` | 用户消息到达 | 检测用户回答是否是对 pending question 的回应 | C (Writer) |
| `assemble` | 构建 prompt | 注入相关记忆 + pending question 意图到系统 prompt | C (Reader) |
| `afterTurn` | Agent 回复后 | 运行 Module A 检测器 → Module B 规划器，决定是否在下一轮提问 | A + B |
| `compact` | 上下文压缩 | 无特殊操作（记忆管理是底层系统的事） | — |
| `prepareSubagentSpawn` | 子 agent 创建前 | 传递与子任务相关的记忆 | C (Reader) |
| `onSubagentEnded` | 子 agent 结束后 | 从子 agent 结果中提取新信息写入记忆 | C (Writer) |

### 4.3 Hook 实现伪代码

```typescript
// ==================== bootstrap ====================
api.on("bootstrap", async (event) => {
  state.annoyanceBudget = config.annoyanceBudget ?? 3;
  state.turnsSinceLastAsk = Infinity; // 允许首轮即可提问
  state.pendingQuestions = []; // TODO: 从持久化恢复

  logger.info(`[ATR] bootstrap: budget=${state.annoyanceBudget}`);
});

// ==================== ingest ====================
api.on("ingest", async (event) => {
  const userMessage = event.message;
  if (!userMessage || state.pendingQuestions.length === 0) return;

  for (const pq of state.pendingQuestions) {
    const isAnswer = await detectAnswer(userMessage, pq);
    if (isAnswer) {
      // ATR 的写入就是传文本，结构化处理是底层 memory 系统的事
      const text = `Q: ${pq.question}\nA: ${userMessage}`;
      await backend.write(text, { source: "proactive-ask" });

      state.pendingQuestions = state.pendingQuestions.filter(q => q.id !== pq.id);
      logger.info(`[ATR] captured answer for: "${pq.question}"`);
    }
  }

  // 过期清理：超过 N 轮未回答的问题，丢弃
  state.pendingQuestions = state.pendingQuestions.filter(
    pq => (state.currentTurn - pq.createdAtTurn) < (config.pendingExpiry ?? 10)
  );
});

// ==================== assemble ====================
api.on("assemble", async (event) => {
  const prompt = event.prompt;
  if (!prompt) return;

  // 从 backend 检索相关记忆（不缓存全量，按需查询）
  const relevant = await backend.search(prompt, { limit: 10 });
  const memoryBlock = formatMemoriesForContext(relevant);

  // 如果有 pending question，注入提问意图
  let askIntent = "";
  if (state.pendingQuestions.length > 0) {
    const pq = state.pendingQuestions[0];
    askIntent = `\n<atr-ask-intent>\n`
      + `If natural, ask the user: "${pq.question}"\n`
      + `Reason: ${pq.reason}\n`
      + `</atr-ask-intent>`;
  }

  return { prependContext: memoryBlock + askIntent };
});

// ==================== afterTurn ====================
api.on("afterTurn", async (event) => {
  state.turnsSinceLastAsk++;
  state.currentTurn++;

  // 硬约束
  if (state.annoyanceBudget <= 0) return;
  if (state.turnsSinceLastAsk < (config.annoyanceCooldown ?? 5)) return;
  if (state.pendingQuestions.length > 0) return; // 上一个问题还没回答

  // Module A: 检测记忆机会（用 search 取相关记忆，不拿全量）
  const recentContext = summarize(event.recentMessages);
  const relevantMemories = await backend.search(recentContext, { limit: 10 });

  const opportunity = await detector.detect({
    recentMessages: event.recentMessages,
    relevantMemories,
    taskContext: event.taskContext,
  });

  if (opportunity.decision !== "ASK") return;

  // Module B: 生成问题
  const question = await planner.plan({
    opportunity,
    recentMessages: event.recentMessages,
  });

  if (!question) return; // Planner 判断不值得问

  state.pendingQuestions.push(question);
  state.annoyanceBudget--;
  state.turnsSinceLastAsk = 0;

  logger.info(`[ATR] planned question: "${question.question}"`);
});

// ==================== prepareSubagentSpawn ====================
api.on("prepareSubagentSpawn", async (event) => {
  const relevant = await backend.search(event.subagentTask, { limit: 5 });
  return { additionalContext: formatMemoriesForContext(relevant) };
});

// ==================== onSubagentEnded ====================
api.on("onSubagentEnded", async (event) => {
  if (event.status !== "success") return;

  // 从子 agent 结果中提取信息，以文本形式写入
  const summary = summarizeSubagentResult(event.result);
  if (summary) {
    await backend.write(summary, { source: "subagent-extract" });
  }
});
```

### 4.4 ATR 状态机

ATR 在每轮对话中经历以下状态转换：

```
                    ┌─────────────┐
                    │   IDLE      │
                    └──────┬──────┘
                           │ afterTurn 触发
                           ↓
                    ┌─────────────┐
            ┌──────│  DETECTING   │──────┐
            │      └─────────────┘      │
            │ PASS                      │ ASK
            ↓                           ↓
     ┌─────────────┐            ┌─────────────┐
     │   IDLE      │            │  PLANNING    │
     └─────────────┘            └──────┬──────┘
                                       │ 生成问题
                                       ↓
                                ┌─────────────────┐
                         ┌──── │     PENDING       │
                         │     │ (等待用户回答)      │
                         │     └──────┬────────────┘
                         │            │
              超过 N 轮    │  ingest 匹配 │
              未回答       │            │
                         │            ▼
                         │     ┌─────────────┐
                         │     │  WRITING     │
                         │     │ (组装文本     │
                         │     │  → backend)  │
                         │     └──────┬──────┘
                         │            │
                         ▼            ▼
                    ┌─────────────┐
                    │   IDLE      │
                    └─────────────┘
```

状态定义：
- **IDLE**：无采集活动，正常对话
- **DETECTING**：Module A 正在判断是否有记忆机会
- **PLANNING**：Module B 正在规划最佳问题
- **PENDING**：问题已生成，等待用户回答（超过 N 轮未回答则过期回到 IDLE）
- **WRITING**：组装 Q+A 文本，调用 backend.write() 写入

### 4.5 MemoryBackend 抽象接口

ATR 不关心底层怎么存、怎么结构化，只需要两个能力：**写入文本** 和 **检索文本**。

```typescript
interface MemoryBackend {
  /** 写入一段记忆文本，底层系统自行决定如何存储/结构化 */
  write(text: string, options?: WriteOptions): Promise<void>;

  /** 按语义检索相关记忆，返回文本片段 */
  search(query: string, options?: SearchOptions): Promise<string[]>;
}

interface WriteOptions {
  source?: "proactive-ask" | "subagent-extract";
}

interface SearchOptions {
  limit?: number;  // 默认 10
}
```

这个接口刻意做得很薄：
- **没有 typed schema**——ATR 传文本，底层 memory 系统自己决定要不要结构化
- **没有 update/delete**——记忆管理（过期、合并、压缩）是底层系统的职责
- **search 返回 string[]**——ATR 只需要把文本注入 prompt，不需要知道底层的 ID/metadata

> 如果未来走路线 B（ATR 自建 memory 系统），才会扩展为完整的 CRUD + typed schema。

#### MVP 实现：NativeMarkdownBackend

MVP 阶段使用 OpenClaw 原生的 Markdown 文件作为 memory 后端：

```typescript
class NativeMarkdownBackend implements MemoryBackend {
  private filePath: string; // ~/.openclaw/memory/atr.md

  async write(text: string, options?: WriteOptions): Promise<void> {
    const entry = `\n- [${options?.source ?? "unknown"}] ${text}\n`;
    await fs.appendFile(this.filePath, entry);
  }

  async search(query: string, options?: SearchOptions): Promise<string[]> {
    // MVP 小规模权宜之计：文件小时全量加载 + 关键字匹配
    // 记忆条数增长后需要索引，或接入底层 memory 系统的语义检索
    const content = await fs.readFile(this.filePath, "utf-8");
    const entries = content.split("\n- ").filter(Boolean);
    return entries
      .filter(e => keywordMatch(e, query))
      .slice(0, options?.limit ?? 10);
  }
}
```

### 4.6 关于"提取"的设计决策

一个常见的设计冲动是在 ATR 层做"结构化提取"（从用户回答中抽取 type/slot/value）。**ATR 不做这件事。**

ATR 的写入就是组装 Q+A 文本然后传给 `backend.write()`：

```typescript
// ingest hook 中，检测到用户回答了 pending question
const text = `Q: ${pq.question}\nA: ${userMessage}`;
await backend.write(text, { source: "proactive-ask" });
```

结构化提取是底层 memory 系统的职责。比如 mem9 的 smart ingest pipeline 会自动做提取和调和，NativeMarkdownBackend 则直接存原文。ATR 不需要关心。

> 如果走路线 B（ATR 自建 memory 系统），提取逻辑会作为 Memory Management Layer 的一部分实现，而不是放在 ATR 采集层。

### 4.7 配置示例

在 `openclaw.json` 中启用 ATR：

```json
{
  "plugins": {
    "slots": {
      "memory": "ask-to-remember"
    },
    "entries": {
      "ask-to-remember": {
        "enabled": true,
        "config": {
          "annoyanceBudget": 3,
          "annoyanceCooldown": 5,
          "memoryBackend": "native-markdown",
          "questionCategories": [
            "preference",
            "constraint",
            "routine",
            "profile"
          ],
          "maxMemories": 200,
          "debug": false
        }
      }
    }
  }
}
```

---

## 5. Module A: 记忆机会检测器 (Memory Opportunity Detector)

### 5.1 输入与输出

**输入**：

```typescript
interface DetectorInput {
  recentMessages: Message[];    // 最近 N 轮对话
  relevantMemories: string[];   // backend.search() 返回的相关记忆（不是全量）
  taskContext?: string;         // 当前任务描述
}
```

> 注意：`relevantMemories` 来自 `backend.search()`，是按当前对话上下文检索的子集，不是全量记忆。
> 记忆量可能很大，ATR 不可能也不需要加载全部。

**输出**：

```typescript
interface DetectorOutput {
  decision: "ASK" | "PASS";
  reason: string;               // 决策原因（用于 debug 和 Planner）
  gap?: string;                 // 检测到的信息缺口描述
}
```

> 简化为 ASK / PASS 二选一。budget 和 cooldown 是 `afterTurn` hook 的硬约束，不需要 Detector 自己判断。

### 5.2 检测信号

Detector 基于以下信号判断是否值得提问：

| 信号 | 说明 | 倾向 |
|------|------|------|
| **对话中隐含了未知偏好** | 用户在做选择，但 Agent 不知道偏好 | → ASK |
| **Agent 在猜测或给出泛化回答** | 回复中有"一般来说"、"如果你喜欢" | → ASK |
| **已有记忆中没有覆盖当前话题** | search 返回的记忆和当前话题不相关 | → ASK |
| **用户看起来在赶时间** | 短消息、命令式语气 | → PASS |
| **当前是纯任务执行，不是讨论** | "帮我跑一下这个脚本" | → PASS |

### 5.3 实现方式

MVP 直接用 LLM 做检测——判断"要不要问"本身就需要理解对话语义和上下文关系，rule-based 很难覆盖。

```typescript
class LLMDetector implements Detector {
  async detect(input: DetectorInput): Promise<DetectorOutput> {
    const prompt = `Given this conversation and the user's existing memories,
is there something worth proactively asking about? The question should help
future interactions, not just the current one.

Recent conversation: ${summarize(input.recentMessages)}
Relevant memories: ${input.relevantMemories.join("\n")}

Respond: { "decision": "ASK" or "PASS", "reason": "...", "gap": "..." }`;

    return await callLLM(prompt);
  }
}
```

> 如果未来需要降低 LLM 调用成本，可以加一层轻量的 rule-based 前置过滤（如：纯命令式消息直接 PASS），但 MVP 阶段不需要。

---

## 6. Module B: 问题价值规划器 (Question Value Planner)

### 6.1 输入与输出

**输入**：Detector 的输出 + 相关记忆 + 对话上下文

```typescript
interface PlannerInput {
  detectorOutput: DetectorOutput;   // 检测结果
  relevantMemories: string[];       // backend.search() 返回的相关记忆（不是全量）
  recentMessages: Message[];        // 最近对话
  questionCategories: string[];     // 允许的问题类型
}
```

**输出**：一个待提问的问题

```typescript
interface PendingQuestion {
  id: string;
  question: string;                 // 自然语言问题
  category: QuestionCategory;       // 问题分类
  reason: string;                   // 为什么问这个
  createdAtTurn: number;            // 创建时的轮次（用于过期判断）
}
```

### 6.2 问题分类

ATR 将问题划分为 5 大类：

| 类别 | 说明 | 示例 |
|------|------|------|
| **preference** | 偏好类 | "你更喜欢简洁还是详细的回答？" |
| **constraint** | 约束类 | "你的月度预算大概在什么范围？" |
| **routine** | 习惯类 | "你一般什么时候处理邮件？" |
| **profile** | 身份类 | "你主要用什么编程语言？" |
| **disambiguation** | 消歧类 | "你说的 'Python' 是指编程还是那部电影？" |

### 6.3 Planner 的决策逻辑

Planner 不需要复杂的评分公式。它的判断标准很直觉：

**值得问的问题**：
- 答案能在**未来多次交互**中复用（"你喜欢什么风格的代码注释？" > "这次要不要加注释？"）
- 和当前话题**自然相关**，不会突兀（用户在讨论旅行时问座位偏好 ✓，讨论代码时问座位偏好 ✗）
- 问题本身**简单易答**（二选一 > 开放式）

**不值得问的问题**：
- 只帮当前这一轮（那是 disambiguation，不是 memory acquisition）
- 涉及敏感信息（财务、健康、隐私细节）
- 用户大概率已经在之前表达过（但 memory 没记住——这是底层系统的问题，不该靠 ATR 再问一遍）

MVP 阶段用 LLM 做判断（给上下文 + gap 描述，让 LLM 决定是否值得问 + 生成问题），不需要数值化评分。路线 A 阶段可以引入 learned scorer。

### 6.4 模板化问题生成

为保证问题质量，Planner 使用模板 + LLM 填充：

```typescript
const QUESTION_TEMPLATES: Record<QuestionCategory, string[]> = {
  preference: [
    "顺便问一下，{topic}方面你更倾向于{option_a}还是{option_b}？我记下来方便以后参考。",
    "我注意到你在{context}，你对{aspect}有什么偏好吗？",
  ],
  constraint: [
    "为了更好地帮你，{aspect}方面有什么限制我应该知道的吗？",
    "关于{topic}，你有{constraint_type}方面的要求吗？",
  ],
  routine: [
    "你通常{action}的时间/频率是？我记住后可以更好地配合你。",
  ],
  profile: [
    "你主要从事{domain}方面的工作吗？了解这些能帮我给出更相关的建议。",
  ],
  disambiguation: [
    "你提到的'{term}'是指{option_a}还是{option_b}？",
  ],
};
```

Planner 的完整流程：

1. 接收 Detector 的 `gap` 描述和对话上下文
2. LLM 基于模板 + 上下文生成候选问题
3. LLM 判断问题是否值得问（未来复用价值 > 打扰成本）
4. 值得问则返回 PendingQuestion，否则返回 null

---

## 7. Module C: 记忆读写器 (Memory Writer + Reader)

### 7.1 Module C 的职责边界

根据 4.5 和 4.6 的设计决策，Module C **不做结构化提取、不做冲突解决、不管记忆生命周期**——这些都是底层 memory 系统的职责。

Module C 只做两件事：

1. **写入**：把 Q+A 文本组装好，传给 `backend.write()`
2. **读取**：调用 `backend.search()` 获取相关记忆，格式化后注入 prompt

### 7.2 用户回复处理

这是 Module C 最核心的部分——用户收到 Agent 问出的问题后，回复可能有多种情况。Module C 需要判断回复是否包含有效信息，并据此决定是否写入记忆。

#### 回复场景分类

| 场景 | 用户回复示例 | 处理策略 |
|------|-----------|---------|
| **直接回答** | "我喜欢靠过道的座位" | 组装 Q+A → backend.write() |
| **回答 + 追问** | "靠过道。对了，帮我看看明天的航班" | 提取回答部分 → backend.write()，追问部分正常处理 |
| **部分/模糊回答** | "都行，看情况吧" | 信息量不足，不写入记忆，pendingQ 出队 |
| **忽略问题** | （完全没回应，聊别的去了） | pendingQ 保留，等超过 N 轮未回答后过期出队 |
| **明确拒绝** | "这个我不想说" / "别问了" | pendingQ 出队，annoyanceBudget 额外扣减 |
| **答非所问** | 回复了但和问题无关 | 视为忽略，pendingQ 保留 |

#### 答案有效性判断

判断用户回复是否有效回答了 pending question，用 LLM 做：

```typescript
async function detectAnswer(
  userMessage: string,
  pendingQuestion: PendingQuestion
): Promise<AnswerDetection> {
  const prompt = `用户之前被问了这个问题："${pendingQuestion.question}"

用户最新的消息是："${userMessage}"

请判断：
1. 用户是否回答了这个问题？(answered / ignored / refused / partial)
2. 如果回答了，有效的回答内容是什么？（提取核心信息，忽略无关部分）

Respond: { "status": "answered" | "ignored" | "refused" | "partial", "extractedAnswer": "..." }`;

  return await callLLM(prompt);
}

interface AnswerDetection {
  status: "answered" | "ignored" | "refused" | "partial";
  extractedAnswer?: string;  // 仅 answered 时有值
}
```

#### 各场景处理逻辑

```typescript
// ingest hook 中
const detection = await detectAnswer(userMessage, pq);

switch (detection.status) {
  case "answered":
    const text = `Q: ${pq.question}\nA: ${detection.extractedAnswer}`;
    await backend.write(text, { source: "proactive-ask" });
    removePendingQuestion(pq);
    break;

  case "partial":
    // 信息量不足，不写入，但也不再追问
    removePendingQuestion(pq);
    break;

  case "refused":
    removePendingQuestion(pq);
    state.annoyanceBudget--;  // 额外惩罚：用户不喜欢这类问题
    break;

  case "ignored":
    // 保留 pendingQ，等下一轮或过期
    break;
}
```

### 7.3 写入流程

写入流程很简单——ATR 只负责组装文本，底层系统负责存储和结构化。

#### 主动采集写入（ingest hook）

```
用户回答 → LLM 判断回复有效性 → 组装 Q+A 文本 → backend.write()
```

底层 memory 系统拿到文本后，自行决定：
- 是否做结构化提取（mem9 的 smart pipeline 会自动做）
- 是否做去重/合并（底层系统的冲突解决策略）
- 用什么 schema 存储（底层系统的选择）

#### 子 agent 结果写入（onSubagentEnded hook）

```typescript
const summary = summarizeSubagentResult(event.result);
if (summary) {
  await backend.write(summary, { source: "subagent-extract" });
}
```

同样是传文本，不做结构化。

### 7.4 读取流程

#### 上下文注入（assemble hook）

```typescript
const relevant = await backend.search(prompt, { limit: 10 });
const memoryBlock = formatMemoriesForContext(relevant);
return { prependContext: memoryBlock };
```

`backend.search()` 返回 `string[]`，ATR 不需要知道底层的 ID / metadata / schema。

注入格式：

```xml
<atr-memories>
{relevant.join("\n")}
</atr-memories>
```

具体的记忆文本格式由底层 backend 决定。NativeMarkdownBackend 返回原始 Q+A 文本；mem9 返回结构化摘要——ATR 不关心，直接注入。

#### 子 agent 上下文传递（prepareSubagentSpawn hook）

```typescript
const relevant = await backend.search(event.subagentTask, { limit: 5 });
return { additionalContext: formatMemoriesForContext(relevant) };
```

### 7.5 关于 Schema 和记忆生命周期

ATR **不定义记忆 schema，不管理记忆生命周期**。

- **Schema**：底层 memory 系统自行定义。NativeMarkdownBackend 存原文；mem9 用自己的 schema；mem0 用向量 + metadata。ATR 只传文本。
- **生命周期**（创建 / 衰减 / 过期 / 清理）：底层系统负责。ATR 只管写入，不管后续。
- **冲突解决**：底层系统负责。如果用户回答了和旧记忆矛盾的内容，底层系统自行处理。

> 如果未来走路线 B（ATR 自建 memory 系统），Typed Schema 和生命周期管理会作为 Memory Management Layer 的一部分实现，见 3.3 节架构图。

---

## 8. 分阶段路线图

### Phase 1: MVP（4-6 周）

**目标**：单用户、单 Agent，在 2 个场景中验证核心价值

```
Week 1-2: 基础框架
├── 插件骨架 + manifest + 配置系统
├── MemoryBackend 接口 + NativeMarkdownBackend
├── ContextEngine hook 注册
└── 基础状态管理

Week 3-4: 三模块实现
├── Module A: LLM Detector
├── Module B: LLM Planner (模板 + 生成)
├── Module C: 回复处理 + 文本组装 + backend 读写
└── 端到端联调

Week 5-6: 评估与打磨
├── 效果评估脚本
├── 4 个 baseline 对比 (never/always/heuristic/llm-judge)
├── 2 个场景 demo (shopping + travel)
└── README + 文档
```

**MVP Deliverables**：
- OpenClaw 插件，可通过 `openclaw.json` 一键启用
- LLM Detector + LLM Planner
- NativeMarkdownBackend
- 用户回复多场景处理
- 2 个 demo 场景
- 效果评估脚本 + 4 个 baseline 对比

### Phase 2: 工业级增强（路线 A + B 分叉，3-6 个月）

#### 路线 A: 独立 Layer 做强

```
Month 1-2: 核心增强
├── ML Detector (训练数据收集 + fine-tune)
├── Learned Value Estimator (数据驱动的价值判断)
├── Privacy Filter (敏感信息检测 + 过滤)
└── 多 Backend Adapter (mem9 / mem0 adapter)

Month 3-4: 高级特性
├── Multi-agent 记忆协调
├── Analytics Dashboard (采集效果可视化)
├── A/B 测试框架
└── DPO/RLHF 策略优化

Month 5-6: 生态整合
├── mem9 官方集成
├── mem0 adapter
├── 社区贡献的 backend adapter
└── 性能优化 + 生产部署文档
```

#### 路线 B: 完整 Memory 系统

```
Month 1-2: 存储层
├── 内置向量存储 (基于 SQLite + 向量扩展)
├── 语义检索引擎
├── 冲突解决 + 版本控制
└── 数据导入/导出

Month 3-4: 检索与上下文管理
├── 多策略检索 (语义 + 关键字 + 时间 + 类型)
├── 上下文窗口管理 (类 memGPT)
├── 自动压缩 + 整理
└── 跨 session 上下文延续

Month 5-6: 一体化
├── 主动采集 + 被动记忆融合
├── 完整 ContextEngine 生命周期管理
├── 多租户 + 多 agent
└── 云端/本地部署方案
```

### 路线选择决策树

```
MVP 完成后
  │
  ├─ 社区反馈："我已有 mem9/mem0，只想加 ATR"
  │  └→ 优先路线 A
  │
  ├─ 社区反馈："我想要一体化方案"
  │  └→ 优先路线 B
  │
  └─ 社区反馈：两者都有
     └→ A 先行，B 基于 A 扩展（A 是 B 的子集）
```

---

## 9. 项目目录结构

```
ask-to-remember/
├── package.json
├── tsconfig.json
├── openclaw.plugin.json          # 插件 manifest
├── README.md
├── LICENSE
│
├── src/
│   ├── index.ts                  # 插件入口，注册 hooks + tools
│   ├── types.ts                  # 核心类型定义
│   ├── state.ts                  # ATR 运行时状态管理
│   ├── config.ts                 # 配置加载与校验
│   │
│   ├── detector/                 # Module A: 记忆机会检测器
│   │   ├── interface.ts          # Detector 接口
│   │   └── llm.ts                # LLM 实现
│   │
│   ├── planner/                  # Module B: 问题规划器
│   │   ├── interface.ts          # Planner 接口
│   │   ├── templates.ts          # 问题模板
│   │   └── generator.ts          # 问题生成（模板 + LLM）
│   │
│   ├── writer/                   # Module C: 记忆读写器
│   │   ├── response-handler.ts   # 用户回复处理（多场景判断）
│   │   ├── assembler.ts          # Q+A 文本组装
│   │   └── formatter.ts          # 记忆格式化（上下文注入）
│   │
│   ├── backend/                  # MemoryBackend 实现
│   │   ├── interface.ts          # MemoryBackend 抽象接口
│   │   ├── native-markdown.ts    # 原生 Markdown 实现 (MVP)
│   │   ├── mem9-adapter.ts       # mem9 适配器 (Phase 2)
│   │   └── mem0-adapter.ts       # mem0 适配器 (Phase 2)
│   │
│   ├── hooks/                    # ContextEngine hook 实现
│   │   ├── bootstrap.ts
│   │   ├── ingest.ts
│   │   ├── assemble.ts
│   │   ├── after-turn.ts
│   │   ├── compact.ts
│   │   ├── subagent-spawn.ts
│   │   └── subagent-ended.ts
│   │
│
├── eval/                         # 评估框架
│   ├── baselines/
│   │   ├── never-ask.ts
│   │   ├── always-ask.ts
│   │   ├── heuristic-ask.ts
│   │   └── llm-judge-ask.ts
│   ├── metrics.ts
│   └── run-eval.ts
│
├── examples/                     # Demo 场景
│   ├── shopping-assistant/
│   └── travel-planner/
│
├── docs/
│   ├── design.md
│   ├── evaluation.md
│   └── configuration.md
│
└── tests/
    ├── detector/
    ├── planner/
    ├── writer/
    ├── backend/
    └── hooks/
```

---

## 10. 风险与应对

### 风险 1：做成"主动澄清"而不是"主动记忆"

| 问题 | 应对 |
|------|------|
| 提的问题只帮当前轮 disambiguation，不帮未来轮次 | **eval 脚本强制测量未来收益**：对比"有记忆 vs 无记忆"的后续轮次差异；如果记忆从未被后续轮次用到，说明问的问题没价值 |

### 风险 2：做成"多问问题的 chatbot"

| 问题 | 应对 |
|------|------|
| 问得太频繁、太泛，用户体验差 | **Annoyance Budget 硬约束**：每 session 最多问 N 次（默认 3），每次间隔至少 M 轮（默认 5）；用户拒绝回答时额外扣减 budget；提供反馈机制可动态调整 |

### 风险 3：记忆写入质量差

| 问题 | 应对 |
|------|------|
| 写入的记忆质量低，底层系统难以利用 | **问题质量 + 回复处理双重把关**：Planner 生成的问题有明确 category，高质量问题导向高质量回答；回复处理（7.2）用 LLM 判断答案有效性，信息量不足时不写入；底层 memory 系统负责结构化存储和去重 |

### 风险 4：OpenClaw 接口变更

| 问题 | 应对 |
|------|------|
| ContextEngine hook API 不稳定 | **薄适配层**：hooks/ 目录作为 OpenClaw 适配层，核心逻辑在 detector/planner/writer 中，不依赖具体 hook 签名；即使 hook API 变，只需改适配层 |

### 风险 5：场景泛化困难

| 问题 | 应对 |
|------|------|
| 在特定场景有效，泛化到其他场景时效果差 | **先在 2 个高密度场景打透**（shopping + travel），建立 baseline 后再扩展；Detector 和 Planner 的接口设计支持 per-scenario 配置；eval 框架支持 per-scenario 独立评估 |

---

## 11. 未来方向

### 11.1 记忆生命周期的全面主动化

ATR MVP 只覆盖了记忆生命周期的**采集**环节。完整的记忆生命周期包含更多可以主动化的阶段：

| 阶段 | 被动方式 | 主动方式（ATR 未来） |
|------|---------|-------------------|
| **采集** | 对话自动提取 | ✅ MVP：主动提问获取 |
| **检索** | query 时搜索 | 主动预取：预判下一轮需要什么记忆，提前加载 |
| **验证** | 无 | 主动确认：定期检查旧记忆是否过时，向用户确认 |
| **压缩** | 定期清理 | 主动整理：检测冲突/冗余记忆，合并或重写 |
| **遗忘** | TTL 过期 | 主动遗忘：判断哪些记忆已经没用了，主动删除释放空间 |
| **共享** | 手动配置 | 主动共享：判断哪些记忆应该同步给其他 agent |

### 11.2 奖励函数与 RL 策略优化

当数据和工程基础成熟后，可以引入形式化的奖励函数来优化 Detector 和 Planner 的决策：

```
R = α · Helpfulness + β · FutureUtility - γ · Annoyance - δ · Cost
```

| 维度 | 定义 | 挑战 |
|------|------|------|
| **Helpfulness** | 当前轮回答质量是否因提问而下降 | 可用 LLM-as-judge 近似 |
| **FutureUtility** | 获得的记忆在后续轮次带来的质量提升 | 需要 A/B 对比，数据获取成本高 |
| **Annoyance** | 提问带来的用户负担 | 需要用户反馈信号 |
| **Cost** | token 消耗、延迟 | 可直接测量 |

MVP 阶段不做在线优化——FutureUtility 等维度在实际中很难直接测量，需要足够的交互数据积累。当采集了足够多的 (state, action, reward) 三元组后，可以用以下方式训练策略模型：

- **DPO**：从人类反馈中学习"什么时候问、问什么"
- **PPO/GRPO**：在 simulated user 环境中在线优化
- **Offline RL**：从日志数据中学习策略

### 11.3 主动验证

```
Agent: "我记得你喜欢靠过道的座位，现在还是这样吗？"
User: "对的" / "不了，我现在更喜欢靠窗"
```

旧记忆会过时。主动验证机制定期检查 low-confidence 或 long-untouched 的记忆，在合适时机向用户确认。

### 11.4 主动预取

在 agent 收到任务描述后、开始执行前，预判需要什么记忆并提前加载到上下文中，减少"执行到一半才发现缺信息"的情况。

### 11.5 跨 Agent 记忆协调

在多 agent 场景下（主 agent + 子 agent），协调"谁来问、问了谁来记"，避免重复提问和记忆冲突。

---

## 12. 参考资料

1. **MemGPT / Letta** — Towards LLMs as Operating Systems
   - 论文：Packer et al., "MemGPT: Towards LLMs as Operating Systems", 2023
   - 项目：https://github.com/letta-ai/letta
   - 核心：分层记忆管理（main context / archival / recall），自主管理上下文窗口

2. **mem0** — The Memory Layer for AI
   - 项目：https://github.com/mem0ai/mem0
   - 核心：自动从对话提取记忆 + 向量检索，支持多平台

3. **mem9 / Mnemo** — Cloud Memory for OpenClaw
   - 项目：https://mem9.ai
   - 核心：OpenClaw 专属云端记忆，smart ingest pipeline（提取 + 调和）
   - 插件接口参考：`@mem9/openclaw` 插件实现

4. **OpenClaw** — ContextEngine 与插件系统
   - ContextEngine 生命周期 hooks：bootstrap, ingest, assemble, afterTurn, compact, prepareSubagentSpawn, onSubagentEnded
   - 插件 manifest 规范：`openclaw.plugin.json`
   - 插件类型：`kind: "memory"` 表示 memory slot 替换

5. **Active Learning & Proactive Agents**
   - Settles, "Active Learning Literature Survey", 2009
   - 主动信息获取（Active Information Acquisition）在推荐系统中的应用
   - 对话系统中的澄清问题生成（Clarification Question Generation）