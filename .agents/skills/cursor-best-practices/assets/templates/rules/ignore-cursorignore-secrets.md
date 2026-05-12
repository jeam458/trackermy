---
title: Exclude secrets and credentials via .cursorignore
impact: CRITICAL
impactDescription: Prevents sensitive data from being indexed or sent to AI context.
tags: .cursorignore, security, secrets
---

# Exclude secrets and credentials via .cursorignore

**`.cursorignore`** uses the same syntax as **`.gitignore`**. Excluded paths are **not** used for semantic search, Tab, Agent, or @mentions. **Always** exclude secrets, keys, credentials, and env files. Default Cursor ignores often cover some of these, but project-specific paths (e.g. `scripts/prod/`, `**/keys/`) may not.

## Incorrect

- **No `.cursorignore`**, or one that omits `.env`, `*.pem`, `credentials.json`, `**/secrets/**`. Those paths may be indexed and included in context.
- **Over-ignoring** (e.g. ignoring entire `src/`) so that useful code is excluded. Keep the list **targeted** so indexing stays accurate and you can still @-mention non-sensitive code.

## Correct

Use a **minimal but complete** set. Example:

```
node_modules/
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

Adjust for your stack (e.g. `__pycache__/`, `*.pyc`, `venv/` for Python; `*.jks` for Android). Add any path that contains **API keys**, **passwords**, **tokens**, or **certificates**.

## .cursorindexingignore

**`.cursorindexingignore`** affects **indexing only**; ignored files are still usable by the AI if you @-mention them. Use it for large assets or generated files you don’t want in semantic search, but **never** rely on it for secrets—use **`.cursorignore`** for those.

## Related Queries

Users might ask:
- "How to exclude secrets from Cursor?"
- "Exclude secrets .cursorignore"
- "Protect secrets in Cursor"
- "How to secure credentials?"
- ".cursorignore for secrets"
- "Security .cursorignore guide"
- "How to prevent secrets from being indexed?"
- "Security best practices"
- "How to protect API keys?"
- "Security tips"
- "How to exclude sensitive data?"
- "What is .cursorignore for secrets?"

**See:** [Ignore files](https://cursor.com/docs/reference/ignore-file).
