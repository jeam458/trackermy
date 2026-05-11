# Agent and security (reference)

More detail on the Agent, its tools, and security defaults. See [SKILL.md](../SKILL.md) for the summary.

---

## Agent: what it is and when to use it

The **Agent** is Cursor’s autonomous mode: it uses **rules** (instructions) + **tools** (search, read, edit, terminal, etc.) + **your messages** to plan and execute multi-step tasks. It can create and edit files, run commands, search the codebase, and call MCP tools (with your approval).

**Use Agent when:**

- Implementing a feature or refactor that touches multiple files.
- Fixing a bug that requires codebase search, edits, and running tests.
- Doing mechanical work (e.g. “add error handling to all API routes”) that benefits from tool use.

**Prefer Ask or Plan when:**

- You’re learning the codebase, exploring options, or drafting a plan. Use **Ask** (read-only) or **Plan** (research → plan → you review → Build). Use **Agent** for the actual implementation once the plan is approved.

---

## Agent: tools and behavior

| Tool | What it does |
|------|----------------|
| **Search** | Semantic (meaning-based) and grep-style (exact) search over the codebase. |
| **Read** | Open and read files. |
| **Edit** | Create, update, delete files (often via search_replace / write). |
| **Terminal** | Run shell commands. Requires approval by default (see Security). |
| **MCP** | Call external tools (e.g. databases, APIs). Requires connection + per-call approval. |

**Summarization:** The Agent can summarize long conversations or context. Use **/summarize** to compress history when the chat gets long.

**Checkpoints:** For long runs, Cursor can create checkpoints so you can revert or branch from a prior state.

**Queue vs send:** **Enter** queues your message; **Ctrl+Enter** (or Cmd+Enter) sends immediately. Use queue when the Agent is still working so you don’t interrupt.

---

## Agent: workflow tips

1. **Scope clearly.** “Add validation to the login form” is better than “fix the app.” If needed, @-mention the relevant files or folders.
2. **Use Plan first for big work.** Get a plan, review it, then switch to Agent and say “Build” (or “Implement this plan”). If the Agent builds the wrong thing, revert, refine the plan, and re-run instead of iterating endlessly in chat.
3. **Run tests often.** Use commands like `/run-tests-and-fix` or ask the Agent to run the test suite after changes. Add a **verifier** subagent or project rules that require “run tests before considering the task done.”
4. **Start new chats when context is noisy.** Long threads with many tangents dilute focus. Start a new chat for a new feature or bug, and use @files to bring in only what’s needed.

---

## Security: overview

Cursor is designed so that **you stay in control**. The Agent can edit files and run terminal commands, but security-sensitive actions typically require your approval.

---

## Security: file edits

- **Default:** The Agent **can** create and edit files without asking. It does **not** edit certain config or system files without approval.
- **Mitigation:** Use **version control** (git). Commit often, review diffs, and revert if the Agent makes unwanted changes. Optionally use a **verifier** subagent or rules that say “run tests / lint before considering the task complete.”

---

## Security: terminal

- **Default:** **Terminal use requires approval.** You’ll see proposed commands and can accept, reject, or edit them.
- **“Run everything” / auto-approve:** Avoid enabling this for untrusted prompts or unfamiliar codebases. Always review commands that touch production, secrets, or destructive operations (e.g. `rm -rf`, `DROP TABLE`).
- **Best practice:** Run only commands you understand. Use `.cursorignore` so that scripts in sensitive paths (e.g. `scripts/deploy.sh` that use secrets) are not inadvertently exposed in context.

---

## Security: MCP (Model Context Protocol)

- **Connection:** You must **approve** each MCP server before the Agent can use it.
- **Tool calls:** Each MCP tool call can require approval (depending on settings). Prefer approving only trusted servers (official or well-known community MCPs).
- **Data:** MCP tools may send data to external services. Ensure you’re comfortable with what each server does (e.g. Postman, databases, internal APIs).

---

## Security: network

- **Allowed:** GitHub (clone, fetch, PRs), link fetch (e.g. URLs you paste), and search. The Agent does not arbitrary outbound calls to unknown endpoints.
- **Secrets:** Never put API keys, passwords, or tokens in rules, commands, or chat. Use env vars and **exclude** `.env`, `*.pem`, `credentials.json`, etc. via **`.cursorignore`** so they are not indexed or sent to the model.

---

## Security: .cursorignore checklist

Ensure these (or equivalents) are in **`.cursorignore`** so they are not indexed or used in AI context:

```
.env
.env.*
.env.local
.env.*.local
*.key
*.pem
*.p12
credentials.json
**/secrets/
**/*-credentials*
**/config/local*
```

Add project-specific paths (e.g. `scripts/prod/`, `**/keys/`). Keep the list maintainable; overlarge ignore rules can make it harder to debug indexing issues.

---

## Quick reference

| Area | Default | What you should do |
|------|---------|--------------------|
| **File edits** | Allowed (except protected config) | Use VCS; review diffs; revert if needed. |
| **Terminal** | Approval required | Review commands; avoid “Run everything” for untrusted work. |
| **MCP** | Approve connection + optional per-call | Use only trusted servers; understand what data they access. |
| **Network** | Limited (GitHub, fetch, search) | No arbitrary outbound; keep secrets out of context. |
| **Secrets** | Not auto-ignored | Add `.env`, keys, credentials to `.cursorignore`. |

**See:** [Agent overview](https://cursor.com/docs/agent/overview), [Agent security](https://cursor.com/docs/agent/security).

---

## Safe skill authoring (for skill publishers)

When publishing skills (e.g. to skills.sh or as plugins), avoid content that security audits (e.g. Snyk) flag: **no prompt-injection patterns** (e.g. “ignore previous instructions” or obfuscated directives), **no hardcoded secrets or realistic-looking placeholders** (use obvious placeholders like `YOUR_API_KEY`), and **no unsafe download or execution examples** (e.g. piping untrusted URLs to `bash`). Keep examples minimal and use only trusted, documented sources. This helps keep skills safe and audit-friendly.
