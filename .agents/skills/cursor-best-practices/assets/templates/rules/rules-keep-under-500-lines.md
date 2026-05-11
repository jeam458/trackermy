---
title: Keep rule files under ~500 lines
impact: HIGH
impactDescription: Long rules consume context and reduce relevance; concise rules apply more reliably.
tags: rules, best-practices, composition
---

# Keep rule files under ~500 lines

Rules are loaded into context. Oversized rule files consume tokens, dilute focus, and can cause the agent to miss important instructions. Split into composable rules; use `references/` or separate `.md` files for deep dives. Link to those instead of pasting long runbooks into rules.

## Incorrect

- A single **2000-line** `PROJECT-RULES.md` covering style, APIs, testing, deployment, and edge cases. The agent rarely uses the tail of the file.
- One **Always Apply** rule that includes your full style guide, all CLI commands, and every convention. Every request pays the token cost.

## Correct

- **`rules/typescript-style.md`** — formatting, naming, TS patterns (~100 lines). Use `globs: ["**/*.ts", "**/*.tsx"]` so it applies only when editing TS.
- **`rules/api-conventions.md`** — REST, errors, status codes (~80 lines). Use `globs: ["**/api/**", "**/routes/**"]`.
- **`rules/testing.md`** — test structure, coverage, mocking (~60 lines). Use `globs: ["**/*.test.*", "**/*.spec.*"]`.
- **`references/deployment.md`** — detailed runbooks, env vars, rollout steps. **Reference** it from a short rule (e.g. “See `references/deployment.md` for rollout”); do **not** copy the whole thing into a rule.

## How to split

1. **One concern per file** — e.g. testing, API, frontend, security.
2. **Use `globs`** so each rule loads only when relevant files are in context.
3. **Keep “Always Apply” minimal** — reserve for 1–3 truly universal rules (e.g. “No `any` in TypeScript,” “Run tests before considering done”).
4. **Link, don’t copy** — point to `references/` or external docs for long content.

## Related Queries

Users might ask:
- "How long should rules be?"
- "Keep rules under 500 lines"
- "Rule file length"
- "How to keep rules short?"
- "Rule length guide"
- "How to split large rules?"
- "Rule length best practices"
- "How to compose rules?"
- "Rule length tips"
- "How to avoid long rules?"
- "Rule length guidelines"
- "What is rule file length limit?"

**See:** [Rules](https://cursor.com/docs/rules).
