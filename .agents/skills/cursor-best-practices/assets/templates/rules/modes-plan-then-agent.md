---
title: Plan with Ask/Plan, then implement with Agent
impact: HIGH
impactDescription: Reduces wasted implementation when scope is unclear or the plan is wrong.
tags: modes, Plan, Agent, workflow
---

# Plan with Ask/Plan, then implement with Agent

For **complex**, **multi-file**, or **unclear-scope** work: use **Ask** or **Plan** to research, clarify, and produce a **plan**. You review and edit the plan. When ready, switch to **Agent** and run “Build” (or “Implement this plan”). If the Agent builds the wrong thing, **revert**, refine the plan, and **re-run** rather than iterating endlessly in chat.

## Do

- Use **Plan** for complex features, refactors, or migrations. Use **Ask** for learning, Q&A, and exploration.
- **Review and adjust** the plan before implementation. Fix scope, assumptions, or steps.
- Use **Agent** for **execution** once the plan is approved. Keep the plan visible (e.g. in `.cursor/plans/` or pasted in chat) so the Agent can follow it.
- **Revert and replan** if the Agent consistently builds the wrong thing. Improve the plan (or add rules), then try again.

## Avoid

- **Jumping straight to Agent** for large, ambiguous tasks without a plan. You’ll often get incomplete or mis-scoped work.
- **Endlessly iterating** in Agent when the plan is wrong. “Try again” without a clearer plan usually repeats the same mistakes. Revert, fix the plan, then re-run.

## When to use Plan vs Agent directly

| Use **Plan** first | Use **Agent** directly |
|--------------------|------------------------|
| New feature touching many modules | Small, well-scoped fix (e.g. typo, single function) |
| Refactor across the codebase | “Add a test for X” (you know where) |
| Unfamiliar area; need to explore | Clear, bounded task (e.g. “update this endpoint”) |

## Related Queries

Users might ask:
- "How to plan then implement with Agent?"
- "Plan then Agent workflow"
- "Plan before Agent"
- "How to use Plan mode then Agent?"
- "Plan then implement guide"
- "When to use Plan vs Agent?"
- "Plan then Agent best practices"
- "How to plan complex features?"
- "Plan then Agent tips"
- "How to avoid wasted implementation?"
- "Plan then Agent workflow"
- "What is plan then Agent workflow?"

**See:** [Agent modes](https://cursor.com/docs/agent/modes), [Agent workflows](https://cursor.com/docs/cookbook/agent-workflows).
