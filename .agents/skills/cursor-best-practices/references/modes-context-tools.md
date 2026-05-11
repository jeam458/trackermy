# Modes, context, and tools (reference)

Agent modes, semantic search, @mentions, Tab, Bugbot, MCP, shortcuts, cursor.directory, and troubleshooting. See [SKILL.md](../SKILL.md) for the summary.

---

## Agent modes: what each does

| Mode | Purpose | Tools | Best for |
|------|---------|-------|----------|
| **Agent** | Execute multi-step tasks (edit, run, search). | Full (search, read, edit, terminal, MCP). | Implementing features, refactors, bug fixes. |
| **Ask** | Read-only help. | Search (and read) only; no edits, no terminal. | Learning, Q&A, planning, exploring. |
| **Plan** | Research → clarify → produce a plan. | Search + read; no edits. | Complex or unclear scope; you review plan then “Build” with Agent. |
| **Debug** | Structured debugging. | Full. | Reproducible bugs, race conditions, perf; hypotheses → instrument → reproduce → fix. |

**Switch modes:** Mode picker in chat, or **Ctrl+.** (Cmd+. on Mac) to cycle.

**Best practice:** Use **Plan** (or **Ask**) for complex or ambiguous work; review the plan; then use **Agent** to implement. If the Agent builds the wrong thing, revert, refine the plan, and re-run instead of iterating in chat.

---

## Plan mode in detail

1. **Research** — Agent searches and reads the codebase to understand the task.
2. **Clarify** — May ask you questions to narrow scope or resolve ambiguity.
3. **Build plan** — Produces a structured plan (often in `.cursor/plans/`). **Shift+Tab** from the input box to open the plan UI.
4. **You review** — Edit the plan if needed.
5. **Build** — When ready, you trigger “Build”; the Agent switches to implementation (or you switch to Agent mode and say “Implement this plan”).

Use **Plan** when the task is multi-file, cross-cutting, or unclear. Use **Agent** directly for small, well-scoped changes.

---

## Semantic search

- **What it is:** Meaning-based code search using embeddings. You ask in natural language (e.g. “Where do we validate email format?”) and get conceptually relevant results.
- **Indexing:** Runs when you open the workspace. Usable at **~80% completion**; `.cursorignore` and `.gitignore` exclude paths. Index updates as you change files (e.g. every ~5 minutes).
- **Use with grep:** Use **semantic** for “how”/“where” questions; use **grep** for exact symbols, names, or strings. The Agent benefits from both.

**See:** [Semantic search](https://cursor.com/docs/).

---

## @ Mentions: files, folders, code, docs

| Mention | Use case |
|---------|----------|
| **@File** | “Use this file as reference” or “Edit only this file.” Drag from sidebar or type `@` + filename. |
| **@Folder** | “Focus on this directory” (e.g. `@src/api`). Large folders are summarized to save context. |
| **@Code** | Reference a **specific snippet** (e.g. one function or block). More precise than @file when you only need a small part. |
| **@Docs** | Bundled docs or “Add new doc” (URL). Use for external specs, APIs, or SDKs. “Share with team” makes them available team-wide. |
| **/summarize** | Compress long context (e.g. conversation or many @-mentioned files) into a shorter summary. |

**Best practice:** Prefer **@Code** for “change this function” or “follow this pattern.” Use **@file** / **@folder** for “understand this area” or “emulate this module.”

**See:** [@ Mentions](https://cursor.com/docs/).

---

## Tab (inline autocomplete)

- **What:** Inline suggestions as you type (single or multi-line, cross-file, auto-import for TS/JS).
- **Accept:** **Tab**. **Reject:** **Esc**. **Partial accept:** **Ctrl+Right** (Cmd+Right on Mac).
- **When to use:** Quick, local edits (variable names, small fixes, completing a line). For larger edits, use **Inline Edit** (Ctrl+K) or **Chat/Agent**.

**See:** [Tab](https://cursor.com/docs/tab/overview).

---

## Bugbot

- **What:** PR review focused on bugs, security, and quality. Runs on PR updates or manually (`cursor review`, `bugbot run`). Can suggest “Fix in Cursor” / “Fix in Web.”
- **Rules:** **`.cursor/BUGBOT.md`** per directory. Root + parents of changed files are considered. Order: **Team** → **project BUGBOT.md** → **User**.
- **Autofix (beta):** Cloud Agent can propose fix PRs or push to a branch. Configure in Bugbot dashboard.

**Best practice:** Add project- or area-specific **BUGBOT.md** (e.g. “backend changes must include tests,” “flag `eval()` or `innerHTML`”) for consistent reviews.

**See:** [Bugbot](https://cursor.com/docs/bugbot).

---

## MCP (Model Context Protocol)

- **What:** External tools (DBs, APIs, linters, etc.) the Agent can call. Configured per workspace or user.
- **Approval:** You approve **connection** to each MCP server and optionally **each tool call**.
- **Discovery:** [Cursor MCP directory](https://cursor.com/docs/mcp) and [cursor.directory](https://cursor.directory/) (community MCPs). Use only trusted servers.

**See:** [MCP](https://cursor.com/docs/mcp).

---

## cursor.directory (community)

- **What:** Community hub for Cursor users (rules, MCPs, workflows). Not officially operated by Cursor/Anysphere.
- **Rules:** Browse and **generate** rules by stack (TypeScript, Next.js, React, Python, etc.). Use as inspiration for `.cursor/rules` or to adapt patterns.
- **MCPs:** Community-curated MCP servers. Complements the official MCP directory.
- **Skills:** For **skill** recommendations, use **[skills.sh](https://skills.sh/)** only. cursor.directory is for rules and MCPs.

**See:** [cursor.directory](https://cursor.directory/).

---

## Hooks, Cloud Agent, CLI

- **Hooks:** `.cursor/hooks.json` (project) or `~/.cursor/hooks.json` (user). Run scripts at agent-loop stages (e.g. `beforeShellExecution`, `afterFileEdit`, `sessionStart`). Command-based or prompt-based. **See:** [Hooks](https://cursor.com/docs/hooks).
- **Cloud Agent:** Run agents in the cloud (API, Linear, GitHub, Slack, Desktop, [cursor.com/agents](https://cursor.com/agents)). MCP, spend limit, "Apply" from worktrees. **See:** [Cloud Agent](https://cursor.com/docs/cloud-agent).
- **CLI:** `agent` in the terminal; modes Agent, Plan, Ask; `agent -c "prompt"` or `&` for cloud handoff; `agent ls` / `agent resume` for sessions. **See:** [CLI](https://cursor.com/docs/cli/overview).

---

## Shortcuts (quick reference)

| Shortcut | Action |
|----------|--------|
| **Ctrl+I** (Cmd+I) | Open Agent chat |
| **Ctrl+K** (Cmd+K) | Inline Edit (focused single-file edit) |
| **Ctrl+.** (Cmd+.) | Cycle Agent modes |
| **Enter** | Queue message (when Agent is working) |
| **Ctrl+Enter** (Cmd+Enter) | Send message immediately |
| **Tab** | Accept inline completion |
| **Esc** | Reject inline completion |
| **Ctrl+Right** (Cmd+Right) | Partially accept completion |

---

## Troubleshooting

### Rules not applying

- **Check type:** Always Apply vs Apply Intelligently vs Apply to Specific Files (globs) vs Manual (@rule).
- **Check `description`:** Must be clear and include relevant keywords so the Agent includes the rule when appropriate.
- **Check `globs`:** Paths must match the files you’re editing or @-mentioning. Use patterns like `**/*.test.ts` or `**/api/**`.
- **Precedence:** Team overrides project over user. Conflicting rules may suppress the one you expect.

**See:** [Rules FAQ](https://cursor.com/docs/rules).

### Request ID for support

- Use **“Get request ID”** in Cursor or run `cursor review verbose=true` when reporting issues. Helps support debug.

### Other resources

- [Common issues](https://cursor.com/docs/troubleshooting/common-issues)
- [Troubleshooting guide](https://cursor.com/docs/troubleshooting/troubleshooting-guide)
