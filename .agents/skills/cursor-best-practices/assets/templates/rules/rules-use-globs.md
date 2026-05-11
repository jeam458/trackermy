---
title: Use globs for file-specific rules
impact: MEDIUM
impactDescription: Scoped rules apply only when relevant, keeping context lean and accurate.
tags: rules, globs, frontmatter, use-globs, glob-patterns, file-specific-rules, scoped-rules, globs-guide
description: "Use globs for file-specific rules: when practice applies only to certain files (e.g. *.test.ts, **/api/**, package.json), use globs in rule frontmatter, rule is included only when those files are in context (open @-mentioned or edited), reducing noise and improving relevance. How to use globs: use globs in rule frontmatter (globs: [\"**/*.test.ts\", \"**/*.test.tsx\", \"**/*.spec.ts\"]), rule applies only when test files are in scope, use Apply to Specific Files (globs) instead of Always Apply whenever rule is specific to subset of codebase. Why use globs: scoped rules apply only when relevant, keeping context lean and accurate, reduces token usage, improves relevance, essential for efficiency. Don't use Always Apply for file-specific: Always Apply rule that says In *.test.ts use describe/it and avoid implementation details (rule is loaded on every request even when you're only editing non-test files), always use globs for file-specific rules. Globs guide: use globs for file-specific rules, use useful glob patterns (**/*.test.ts, **/api/**, **/*.config.js, package.json, src/**/*.ts), use Apply to Specific Files instead of Always Apply. Globs best practices: use globs for file-specific rules, use appropriate patterns, don't use Always Apply for file-specific, keep context lean, improve relevance."
---

# Use globs for file-specific rules

When a practice applies only to certain files (e.g. `*.test.ts`, `**/api/**`, `package.json`), use **`globs`** in rule frontmatter. The rule is included only when those files are in context (open, @-mentioned, or edited), reducing noise and improving relevance.

## Incorrect

An **Always Apply** rule that says “In `*.test.ts` use `describe`/`it` and avoid implementation details.” The rule is loaded on **every** request, even when you’re only editing non-test files.

## Correct

```yaml
---
description: "Use describe/it in Jest; avoid implementation details. Test behavior, not internals."
globs: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts"]
---
# Jest testing conventions
...
```

Same guidance, but the rule applies **only** when test files are in scope.

## Useful glob patterns

| Pattern | Matches |
|---------|---------|
| `**/*.test.ts` | Any `*.test.ts` under the project |
| `**/api/**` | Any path containing `/api/` |
| `**/*.config.js` | Config files (Vite, Jest, etc.) |
| `package.json` | Root package.json only |
| `src/**/*.ts` | All TS under `src/` |

Use **Apply to Specific Files** (globs) instead of **Always Apply** whenever the rule is specific to a subset of the codebase.

## Related Queries

Users might ask:
- "How to use globs in rules?"
- "Use globs for file-specific rules"
- "Glob patterns"
- "How to scope rules with globs?"
- "Globs guide"
- "How to use glob patterns?"
- "Globs best practices"
- "How to create file-specific rules?"
- "Globs tips"
- "How to use globs effectively?"
- "Glob patterns examples"
- "What are globs in rules?"

**See:** [Rules — Apply to specific files](https://cursor.com/docs/rules).
