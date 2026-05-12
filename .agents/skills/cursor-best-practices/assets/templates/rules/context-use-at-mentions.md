---
title: Use @files, @folder, and @Code for precise context
impact: HIGH
impactDescription: Targeted context improves accuracy and reduces irrelevant output.
tags: context, @mentions, @Code, use-at-mentions, at-mentions-guide, precise-context, at-file-at-folder-at-code, mentions-guide, context-mentions
description: "Use @ mentions: use @file or @folder when you want understand this area, emulate this pattern, or only change code here, use @Code when you need specific snippet (one function, one block) rather than whole file, scope down with @Code or single @file instead of @-mentioning entire monorepo for small local change. How to use @ mentions: prefer @file or @folder for understanding areas and emulating patterns, prefer @Code for specific snippets, scope down for small changes, avoid mentioning huge directories for small edits. Why use @ mentions: targeted context improves accuracy and reduces irrelevant output, provides precise scope, focuses agent, essential for accuracy. Don't rely only on semantic search: @-mentioning known files is faster and more reliable than semantic search, always use @ mentions when you know exact file, don't use vague requests without @ mentions. @ mentions guide: use @file for files, use @folder for folders, use @Code for snippets, scope down appropriately, be precise. @ mentions best practices: use @file or @folder for context, use @Code for snippets, scope down for small changes, don't mention huge directories, be precise."
---

# Use @files, @folder, and @Code for precise context

Reference specific **files**, **folders**, or **code snippets** with **@** so the agent knows exactly what to emulate, analyze, or modify. Large files/folders are condensed to save context; **@Code** gives the most precise scope.

## Prefer

- **@file** or **@folder** when you want “understand this area,” “emulate this pattern,” or “only change code here.”
- **@Code** when you need a **specific snippet** (e.g. one function, one block) rather than the whole file. Reduces noise and focuses the agent.
- **Scoping down:** Use @Code or a single @file instead of @-mentioning an entire monorepo for a small, local change.

## Avoid

- Relying **only** on semantic search when you already know the exact file or snippet. @-mentioning it is faster and more reliable.
- @-mentioning **huge directories** for small, targeted edits—prefer @file or @Code.
- Vague requests like “fix the app” without @-mentioning the relevant files. The agent may guess wrong or touch too much.

## Examples

- “Add validation similar to **@auth/login.ts**” — pattern to follow.
- “Fix the bug in **@utils/parse.ts** around line 42” — narrow scope.
- “Review **@src/api/** for security issues” — limit review to that folder.
- “Refactor **@Code** (the `fetchUser` function) to use async/await” — exact snippet.

## Related Queries

Users might ask:
- "How to use @ mentions?"
- "Use @ mentions"
- "@file @folder @Code"
- "How to use @file?"
- "How to use @Code?"
- "@ mentions guide"
- "How to use @ mentions effectively?"
- "@ mentions best practices"
- "How to scope down with @ mentions?"
- "@ mentions tips"
- "How to provide precise context?"
- "What are @ mentions?"

**See:** [@ Mentions](https://cursor.com/docs/).
