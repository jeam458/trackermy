# Rules and commands (reference)

Deeper context for Cursor rules and slash commands. See [SKILL.md](../SKILL.md) for the quick reference.

---

## Rules: types and when to use each

| Type | When to use | How it applies |
|------|-------------|----------------|
| **Always Apply** | Must affect every request (e.g. "Never use `any` in TypeScript", "Always run tests before committing"). Use sparingly—adds to every context. | Loaded on every chat message. |
| **Apply Intelligently** | General guidance the agent should follow when relevant (e.g. "Prefer functional components in React", "Use REST conventions"). | Agent includes when it deems the rule relevant to the request. |
| **Apply to Specific Files** | Practices that only apply to certain paths (e.g. `*.test.ts`, `**/api/**`, `package.json`). | Loaded only when those files are in context (open, @-mentioned, or edited). |
| **Apply Manually** | Niche or optional rules (e.g. "Release process", "Legacy API quirks"). | User invokes with `@rule-name` in chat when needed. |

**Precedence:** Team (dashboard) → Project (`.cursor/rules/`) → User (Cursor Settings → Rules). Later overrides earlier for conflicts.

---

## Rules: frontmatter and structure

### Frontmatter fields

```yaml
---
description: "One-line summary. Used for relevance; include keywords (e.g. 'tests', 'API', 'React')."
globs: ["**/*.test.ts", "**/*.spec.ts"]   # Optional. Use for file-specific rules.
alwaysApply: true                          # Optional. Default false. Use rarely.
---
```

- **`description`:** Helps the agent decide when to include the rule. Be specific: "Use `describe`/`it` in Jest; avoid implementation details" beats "Testing guidelines."
- **`globs`:** Array of glob patterns. Rule applies only when matching files are in context. Examples: `["**/api/**"]`, `["*.config.js"]`, `["src/**/*.ts"]`.
- **`alwaysApply`:** If `true`, the rule is always loaded. Prefer **Apply Intelligently** or **globs** unless the rule truly must apply to every request.

### File format

- Use **`.md`** or **`.mdc`**. Plain markdown body; no frontmatter beyond the YAML block.
- Keep each file **under ~500 lines**. Split by topic (e.g. `rules/testing.md`, `rules/api.md`). Use `references/` or separate docs for long runbooks; **reference, don't copy** into rules.

### Example rule (file-specific)

**`.cursor/rules/jest-tests.md`:**

```yaml
---
description: "Jest tests: use describe/it, arrange-act-assert, meaningful names. No implementation details in tests."
globs: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts"]
---
# Jest testing conventions

- Use `describe` for the unit under test, `it` for each behavior.
- Follow arrange–act–assert; one logical assertion per `it` when possible.
- Test behavior, not implementation (avoid testing private functions or internals).
- Mock at boundaries (API, DB); prefer real units for pure logic.
```

---

## Rules: AGENTS.md vs .cursor/rules

| | AGENTS.md | .cursor/rules/ |
|--|-----------|----------------|
| **Location** | Project root (or nested dirs) | `.cursor/rules/*.md` |
| **Format** | Plain markdown, no frontmatter | YAML frontmatter + markdown |
| **Scoping** | Single file; no globs or types | Per-file types, globs, alwaysApply |
| **Best for** | Small teams, simple projects, quick start | Larger teams, many rules, file-specific guidance |

Use **AGENTS.md** when you want one place for "how we work with the AI." Use **.cursor/rules/** when you need composable, scoped rules (e.g. different guidance for tests vs API vs frontend).

**Legacy:** If you have `.cursorrules`, migrate to Project Rules or AGENTS.md. Cursor supports it for backwards compatibility but rules in `.cursor/rules/` are more flexible.

---

## Commands: structure and locations

- **Project:** `.cursor/commands/` — committed to git, shared with the team.
- **User:** `~/.cursor/commands/` — personal commands, not repo-specific.
- **Team:** Dashboard (Team commands) — org-wide.

**Format:** One **plain Markdown** file per command. **Filename = command name.** Example: `code-review.md` → `/code-review`. No frontmatter; the entire file is the prompt body.

**Trigger:** Type `/` in chat, then the command name (or pick from the list). Any text **after** the command is passed as context. Examples:

- `/code-review` — reviews code in the current conversation or @-mentioned files.
- `/fix-issue 42` — the "42" is available to the command as context (e.g. "Fix issue #42").
- `/pr` — create a PR for the current branch; no extra context required.

---

## Commands: using parameters

Commands receive **everything after the command name** as raw text. Reference it explicitly in the command body.

**Example: `fix-issue.md`**

```markdown
Fix the issue described below. If an issue number or URL was provided after the command (e.g. `/fix-issue 123` or `/fix-issue https://...`), use that to fetch or reference the issue.

1. Understand the reported bug or feature request.
2. Locate the relevant code (search, @files).
3. Implement the fix or feature; add tests if appropriate.
4. Run the test suite and ensure nothing is broken.
5. Summarize what you changed and how to verify it.

Apply project rules from `.cursor/rules` or `AGENTS.md`.
```

Users can type `/fix-issue 456` or `/fix-issue We need to validate email format`; the command prompt tells the agent how to use that text.

---

## Commands: examples to add

| Command | Purpose |
|---------|---------|
| `code-review` | Review changed or @-mentioned code for correctness, security, quality, tests. |
| `pr` | Summarize branch changes, propose PR title/description, suggest review checklist. |
| `run-tests-and-fix` | Run tests, fix failures, re-run until green; summarize changes. |
| `security-audit` | Security-focused review (injection, auth, secrets, deps). |
| `setup-new-feature` | Propose plan (files, modules, patterns), suggest implementation steps. |
| `fix-issue` | Fix a bug or implement a feature from an issue (number or description). |
| `update-deps` | Update dependencies (npm/pip/cargo etc.), run tests, report breaking changes. |
| `docs` | Generate or update docs for @-mentioned code or the current feature. |
| `onboard` | Explain how to run, test, and contribute to the project (for new devs). |

Copy templates from this skill's `commands/` into `.cursor/commands/` and adapt to your project (e.g. specific test/lint commands, ticket system).

---

## Quick reference: rule vs command

| | Rules | Commands |
|--|-------|----------|
| **What** | Persistent instructions (how to code, test, structure). | One-off prompts (review, PR, fix, audit). |
| **When** | Applied automatically by type (always / intelligent / globs) or via `@rule`. | Triggered by user with `/command-name`. |
| **Where** | `.cursor/rules/*.md`, AGENTS.md, User/Team rules. | `.cursor/commands/*.md`, user/team commands. |
| **Parameters** | No; they're static. | Text after command name = context. |

**See:** [Rules](https://cursor.com/docs/rules), [Commands](https://cursor.com/docs/rules).
