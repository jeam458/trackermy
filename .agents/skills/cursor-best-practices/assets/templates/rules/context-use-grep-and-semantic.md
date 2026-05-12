---
title: Use both grep and semantic search when finding code
impact: MEDIUM
impactDescription: Grep finds exact matches; semantic finds conceptual matches. Together they cover more.
tags: context, semantic search, grep, search, use-grep-semantic, grep-and-semantic, combine-searches, search-strategies, grep-semantic-guide
description: "Use both grep and semantic search: grep matches exact strings symbols and filenames, semantic search matches meaning (where we validate email), use both when agent needs to find and understand code (grep for precise locations, semantic for how does X work or where do we do Y). How to use both searches: use grep for exact identifiers (function names, exports, config keys, error codes), use semantic search for concepts (where is user input validated, how do we handle API errors, where is payment flow), combine when implementing or refactoring. Why use both: grep finds exact matches, semantic finds conceptual matches, together they cover more ground, provides complete picture. Don't use only one: using only semantic search when you know exact symbol (grep is faster and precise), using only grep for how does X work (semantic often surfaces relevant files you wouldn't find by name alone). Search combination guide: use grep for exact identifiers, use semantic for concepts, combine when needed, use both together. Search combination best practices: use grep for exact matches, use semantic for concepts, combine when implementing, use both for comprehensive search."
---

# Use both grep and semantic search when finding code

**Grep** matches exact strings, symbols, and filenames. **Semantic search** matches meaning (e.g. “where we validate email”). Use **both** when the agent needs to find and understand code: grep for precise locations, semantic for “how does X work?” or “where do we do Y?”

## Do

- **Grep** for exact identifiers: function names, exports, config keys, error codes (e.g. `AuthContext`, `LOGIN_FAILED`, `validateEmail`).
- **Semantic search** for concepts: “Where is user input validated?”, “How do we handle API errors?”, “Where is the payment flow?”
- **Combine** when implementing or refactoring: e.g. semantic to find the validation layer, then grep to find all call sites of `validateEmail`.

## Avoid

- Using **only** semantic search when you know the exact symbol—grep is faster and precise.
- Using **only** grep for “how does X work?”—semantic often surfaces relevant files you wouldn’t find by name alone.

## Related Queries

Users might ask:
- "How to use grep and semantic search?"
- "Use both grep and semantic"
- "Grep vs semantic search"
- "How to combine searches?"
- "Search strategies"
- "Grep and semantic guide"
- "How to use grep effectively?"
- "How to use semantic search effectively?"
- "Search combination best practices"
- "Grep and semantic tips"
- "How to find code with grep and semantic?"
- "What is grep and semantic search?"

**See:** [Semantic search](https://cursor.com/docs/).
