# Workflows and large codebases (reference)

TDD, git-style commands, codebase understanding, hooks, design→code, and large-repo patterns. See [SKILL.md](../SKILL.md) for the overview.

---

## TDD (test-driven development) with Cursor

### Step-by-step

1. **Write a failing test** that describes the desired behavior (e.g. “login rejects invalid email”).
2. **Run the test suite.** The new test should **fail** (red) because the behavior isn’t implemented yet.
3. **Commit the failing test(s).** Keeps the “test first” step explicit and reviewable.
4. **Implement** the minimal code to make the test(s) pass.
5. **Run tests again.** Repeat until all relevant tests are green.
6. **Refactor** if needed (keep tests green).
7. **Commit the implementation.**

### Why use TDD with the Agent?

- The Agent can **write tests** and **implement** code. Making “tests first” explicit in your workflow (or in a `/run-tests-and-fix`-style command) reduces “implement first, skip tests” behavior.
- Add a **rule** or **AGENTS.md** line: “For new behavior, write a failing test first, then implement. Do not add implementation without corresponding tests.”

### Commands that help

- **`/run-tests-and-fix`** — Run tests, fix failures, re-run until green. Use when you want the Agent to ensure tests pass after changes.
- **Verifier subagent** — Dedicated “run tests and lint; report pass/fail” agent. Use when you want verification separated from implementation.

**See:** [Agent workflows](https://cursor.com/docs/cookbook/agent-workflows).

---

## Git-style commands

Store reusable prompts as **slash commands** in `.cursor/commands/`. The following are useful across many projects:

| Command | Purpose |
|---------|---------|
| **`/pr`** | Summarize branch changes, propose PR title and description, suggest a review checklist. |
| **`/fix-issue <number or description>`** | Fix a bug or implement a feature from an issue. |
| **`/review`** or **`/code-review`** | Review changed or @-mentioned code for correctness, security, quality, tests. |
| **`/update-deps`** | Update dependencies (npm/pip/cargo etc.), run tests, report breaking changes. |
| **`/docs`** | Generate or update docs for @-mentioned code or the current feature. |
| **`/onboard`** | Explain how to run, test, and contribute to the project (for new developers). |

**Parameters:** Text after the command is passed as context. E.g. `/fix-issue 123` → “Fix issue 123.” Design your command body to tell the Agent how to use that context (e.g. “Use the issue number to fetch or reference the issue”).

---

## Codebase understanding

### Effective questions

- **“How does X work?”** — e.g. “How does auth work?” or “How does the payment flow work?” The Agent can search and summarize; use **Ask** (read-only) first to avoid unnecessary edits.
- **“How do I add Y?”** — e.g. “How do I add a new API route?” or “How do I add a new UI page?” Ask for a short **plan** (files to touch, patterns to follow) before implementing.
- **“Show me the data flow for Z.”** — Request **Mermaid** diagrams (architecture, sequence, data flow) to clarify structure.

### Strategy: broad → narrow

1. **Broad:** Start with high-level questions (e.g. “Where is the API layer?” or “How is state managed?”).
2. **Narrow:** Once you know the relevant areas, @-mention specific files or folders and ask targeted questions (e.g. “Add validation here following the pattern in `auth.ts`”).

### Modes

- Use **Ask** or **Plan** for exploration and planning. Use **Agent** when you’re ready to implement and want the Agent to edit files and run commands.

---

## Hooks and long-running loops

**`.cursor/hooks.json`** and hook scripts let you define **long-running loops** (e.g. “run tests until they pass” or “retry deployment until healthy”). The Agent can trigger these instead of manually re-running the same command.

**Typical use:** CI-like checks (tests, lint, build) that the Agent runs as part of a workflow. See [Cursor docs](https://cursor.com/docs/) and any project-specific hook examples for configuration details.

---

## Design → code

- **Mockups / screenshots:** Paste images or Figma links and ask the Agent to implement the UI. Use the **Browser** subagent to preview the app while iterating.
- **Design specs:** Describe layout, components, and behavior in chat; @-mention your design system or component library so the Agent follows existing patterns.

**Cloud agents** can offload bug fixes, refactors, tests, and docs to Cursor’s cloud—useful for larger or async workflows.

---

## Large codebases: practical tips

### 1. Domain rules in `.cursor/rules/`

- Add **scoped rules** (e.g. `**/api/**`, `**/*.test.ts`) so the Agent knows project-specific patterns (naming, error handling, test style) without loading everything always.
- Keep each rule **under ~500 lines** and focused. Use `references/` for deep dives.

### 2. Plan before implementing

- Use **Ask** or **Plan** to understand the area and get a **plan**. Review and adjust the plan, then use **Agent** to implement. If the Agent builds the wrong thing, **revert**, refine the plan, and re-run.

### 3. Use the right interface

| Task | Best interface |
|------|----------------|
| Quick, local edits (e.g. rename, fix typo) | **Tab** (inline autocomplete) |
| Focused single-file change | **Inline Edit** (Ctrl+K) |
| Multi-file, context-heavy work | **Chat** or **Agent** |

### 4. Scope context with @files and @folder

- **@file** or **@folder** — “Use this as reference” or “Only change things here.”
- **@Code** — Reference a specific snippet instead of entire files. Reduces noise and keeps context focused.
- **New chats** — When a thread is long or off-topic, start a new chat and bring in only the relevant files.

### 5. Semantic search + grep

- **Semantic search:** “Where is user validation performed?” or “How do we handle API errors?”
- **Grep:** Exact symbols, filenames, or strings (e.g. `AuthContext`, `login`).
- Use **both** when the Agent needs to find and understand code.

**See:** [Agent workflows](https://cursor.com/docs/cookbook/agent-workflows), [Large codebases](https://cursor.com/docs/cookbook/large-codebases).
