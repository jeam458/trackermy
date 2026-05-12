---
title: Write clear, keyword-rich rule descriptions
impact: MEDIUM
impactDescription: Good descriptions help the agent include the rule when relevant and skip it when not.
tags: rules, frontmatter, description, keyword-rich-descriptions, rule-descriptions, how-to-write-descriptions, rule-description-best-practices, description-keywords, rule-relevance, agent-relevance, cursor-rule-descriptions, effective-descriptions, write-good-descriptions
description: "Write clear, keyword-rich rule descriptions: good descriptions help the agent include the rule when relevant and skip it when not. How to write rule descriptions: include tech names (Jest, React, TypeScript), include specific practices (describe/it, functional components), include keywords (tests, API, validation). What makes good descriptions: specific keywords, tech names, concrete practices, relevant terms. Why keyword-rich descriptions matter: help Agent decide when to include rule, improve rule relevance, reduce false positives. Rule description examples: good (Jest tests: use describe/it, arrange-act-assert, meaningful names. No implementation details. Mock at boundaries.), bad (Testing guidelines). How to improve descriptions: add tech names, add specific practices, add relevant keywords, be specific not vague. Description best practices: keyword-rich, specific, include tech names, include practices, keep focused. Rule relevance: descriptions determine when Agent includes rules, keyword-rich descriptions improve accuracy. Include tech or domain (Jest, API, React hooks), include 1-3 concrete behaviors (use describe/it, validate input, no any), keep to 1-2 sentences."
---

# Write clear, keyword-rich rule descriptions

The **`description`** field in rule frontmatter is used for relevance: the agent decides when to include the rule based on it. Vague descriptions (“Project conventions”) reduce accuracy; specific, keyword-rich ones (“Jest: use describe/it, no implementation details in tests”) improve it.

## Incorrect

```yaml
---
description: "Testing."
globs: ["**/*.test.ts"]
---
```

Too vague. The agent may rarely include it or include it when irrelevant.

## Correct

```yaml
---
description: "Jest tests: use describe/it, arrange-act-assert, meaningful names. No implementation details. Mock at boundaries."
globs: ["**/*.test.ts", "**/*.spec.ts"]
---
```

Concrete scope (Jest), explicit practices (describe/it, arrange-act-assert, mocking), and keywords (tests, Jest, mock) help the agent apply the rule when editing tests.

## Tips

- **Include** the tech or domain (e.g. “Jest,” “API,” “React hooks”).
- **Include** 1–3 concrete behaviors (e.g. “use describe/it,” “validate input,” “no `any`”).
- **Keep** it to 1–2 sentences. Save detail for the rule body.

## Related Queries

Users might ask:
- "How to write rule descriptions?"
- "What makes good rule descriptions?"
- "Keyword-rich descriptions"
- "How to improve rule descriptions?"
- "Rule description best practices"
- "Why descriptions matter for rules?"
- "How to make rules more relevant?"
- "Rule description examples"
- "How to write effective descriptions?"
- "Description keywords for rules"
- "Rule relevance in Cursor"
- "How Agent decides rule relevance?"
- "Improving rule descriptions"
- "Write good rule descriptions"

## See Also

- [Rules](https://cursor.com/docs/rules)
- [Feature Index](../indexes/feature-index.md#context-rules)
