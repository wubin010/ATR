/**
 * Ask-to-Remember Bootstrap Hook (Optional)
 *
 * Injects ATR trigger reminder and Phase B (pending-question resolution) rules
 * during agent bootstrap as a virtual file. This is an optional alternative to
 * the default approach of writing the ATR prompt into AGENTS.md (see SKILL.md §0).
 */

const ATR_CONTENT = `## Ask-to-Remember

\`ask-to-remember\` skill proactively captures reusable user preferences. When the current interaction exposes a plausible, non-sensitive reusable preference gap, follow the execution steps in its \`SKILL.md\`. Only trigger in the human's direct main session.

### Pending Question Resolution

Check \`atr-state.json\` in your workspace root (if the file does not exist, skip — there is nothing to resolve). If \`pendingQuestion\` is not \`null\`, resolve it **before** doing anything else:

- **Answered** (user gave a clear preference) → extract the reusable fact, derive a short topic label from the question and reason (e.g. \`周末行程风格\`), append \`## [ATR] <topic>\` to MEMORY.md, clear \`pendingQuestion\`, append \`{ "question": "...", "askedAt": "...", "outcome": "answered" }\` to \`askedQuestions\`
- **Refused** (e.g. \`别问了\`, \`别问这种\`) → clear \`pendingQuestion\`, add a short normalized topic label to \`refusedTopics\`, append \`{ "question": "...", "askedAt": "...", "outcome": "refused" }\` to \`askedQuestions\`, do not write memory
- **Vague** (e.g. \`都行\`, \`看情况\`) → clear \`pendingQuestion\`; do not write memory; do not add to \`askedQuestions\`
- **Ignored** (completely unrelated to the question) → clear \`pendingQuestion\`; do not write memory; do not add to \`askedQuestions\`

Every resolution writes one line to \`atr-log.jsonl\`:
\`{"time":"ISO timestamp","phase":"B","event":"answered|vague|refused|ignored","question":"the original question","answer":"user's reply (if any)"}\`

**Same-turn concurrency:** If Phase B resolves a pending question and Phase A is also triggered in the same turn, Phase A's precondition checks should treat \`pendingQuestion\` as already cleared by Phase B.`.trim();

const handler = async (event) => {
  if (!event || typeof event !== 'object') return;
  if (event.type !== 'agent' || event.action !== 'bootstrap') return;
  if (!event.context || typeof event.context !== 'object') return;

  if (Array.isArray(event.context.bootstrapFiles)) {
    event.context.bootstrapFiles.push({
      path: 'ASK_TO_REMEMBER.md',
      content: ATR_CONTENT,
      virtual: true,
    });
  }
};

module.exports = handler;
module.exports.default = handler;
