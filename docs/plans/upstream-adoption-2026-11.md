# November 2026 upstream adoption

**Status:** Planned. [Tracking issue #13](https://github.com/infectiousstupidity/paseo/issues/13) owns the current checklist; task docs own scope and acceptance.

## Comparison baseline

Fork main: `6aa9210579a87e418ec9f7f2dd7179211be70294` (October 29, 2026). Upstream main: `daf26892d` (November 7, 2026). Upstream has 309 commits not in this fork, and the fork has 297 not upstream. Refresh both before starting a task; counts and references are historical.

## Integration rule

These are **selective adoption tasks**, not an authorization for the whole-upstream merge defined by [the existing policy](../upstream-sync-policy.md). For each issue, compare code/behavior with the latest fork, reuse the existing interface and tests, port the smallest required portion, and preserve fork changes. If the upstream feature requires a substantially larger prerequisite, record it and stop for scope review rather than absorbing unrelated code.

The fork already has guarded idle runtime suspension (15-minute default), and [issue #12](https://github.com/infectiousstupidity/paseo/issues/12) tracks it. Do not replace it with upstream's different implementation. Preserve the custom Pi subagent inspector/controls and Shiori's global cross-project task runner. **Do not implement `edxeth/pi-subagents` (#8176); it is not used.**

## Task docs

- **01 / P1:** [Pi compaction history, queued prompts and images](../tasks/upstream-adopt-01-pi-history-compaction.md)
- **02 / P1:** [Subagent launch markers and parent navigation](../tasks/upstream-adopt-02-subagent-timeline.md)
- **03 / P1:** [Show and stop provider background commands](../tasks/upstream-adopt-03-background-work-controls.md)
- **04 / P1:** [Hidden durable helpers created by plugins](../tasks/upstream-adopt-04-hidden-helper-agents.md)
- **05 / P1:** [Live plugin subscriptions and binary transport](../tasks/upstream-adopt-05-plugin-subscriptions.md)
- **06 / P1:** [Scoped plugin agent tools and session MCP servers](../tasks/upstream-adopt-06-plugin-agent-tools-mcp.md)
- **07 / P2:** [Awaited worktree hooks and selected ignored files](../tasks/upstream-adopt-07-plugin-worktree-hooks.md)
- **08 / P2:** [Retain plugin state on host reconnect](../tasks/upstream-adopt-08-plugin-reconnect.md)
- **09 / P2:** [Terminal continuity and opt-in agent recovery](../tasks/upstream-adopt-09-restart-recovery.md)
- **10 / P2:** [Codex histories, diffs, interrupts and actual model](../tasks/upstream-adopt-10-codex-model-integrity.md)
- **11 / P3:** [Workspace archive, attention and narrow-pane navigation](../tasks/upstream-adopt-11-workspace-navigation.md)
- **12 / P3:** [Alternate Send action for current-agent queue](../tasks/upstream-adopt-12-composer-queue-shortcut.md)

Work through tasks individually. Prefer P1 then P2 then P3, adjusting only for proven dependencies. Plugin subscription and MCP work can be independent. Worktree hook changes must reconcile the existing plugin lifecycle. Background-work controls and restart recovery must respect the fork's idle runtime guards.

Every task must refresh refs, establish the missing behavior with a regression or reproducible example, make one bounded change, run focused validation and required checks, and record proof on the exact delivered fork commit. A PR title or upstream CI alone is not verification in this fork. Do not interrupt the live daemon.
