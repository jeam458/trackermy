---
title: Run tests before considering a task complete
impact: HIGH
impactDescription: Ensures changes don't break existing behavior and new behavior is verified.
tags: workflows, testing, TDD, verification
---

# Run tests before considering a task complete

When implementing a feature or fix, the agent should **run the project’s test suite** before treating the task as done. If tests fail, fix the code (or add missing tests), then re-run until all pass. Don’t skip tests or change expectations solely to get green.

## Do

- **Run tests** after making changes (e.g. `npm test`, `pytest`, `cargo test`—use the project’s actual commands).
- **Fix failures** by correcting the implementation or adding tests for new behavior. Re-run until green.
- **Summarize** what was broken and what was changed when reporting completion.
- Use **`/run-tests-and-fix`** or a **verifier** subagent to enforce this workflow.

## Avoid

- **Skipping** the test run “because it’s a small change.”
- **Deleting or weakening** tests just to make them pass. Fix the implementation instead.
- **Assuming** tests pass without running them.

## Rule / AGENTS.md suggestion

Add a short rule or AGENTS.md line: *“Before marking a task complete, run the test suite. If any tests fail, fix the code or add tests, then re-run until all pass.”*

## Related Queries

Users might ask:
- "How to run tests before task is done?"
- "Run tests before done"
- "Test before complete"
- "How to ensure tests pass?"
- "Test workflow guide"
- "How to run tests after changes?"
- "Test workflow best practices"
- "How to fix test failures?"
- "Test workflow tips"
- "How to verify changes with tests?"
- "Test workflow"
- "What is test before done workflow?"

**See:** [Agent workflows](https://cursor.com/docs/cookbook/agent-workflows), [references/workflows-and-codebases.md](../references/workflows-and-codebases.md).
