Fix the issue described below.

**Context:** If I provided an issue number or URL after the command (e.g. `/fix-issue 123` or `/fix-issue https://github.com/org/repo/issues/456`), use that to fetch or reference the issue. Otherwise, use the rest of my message as the issue description.

## Steps

1. **Understand** the reported bug or feature request (repro steps, expected vs actual, acceptance criteria).
2. **Locate** the relevant code (search, @files, or project structure).
3. **Implement** the fix or feature. Add or update tests as appropriate.
4. **Run the test suite** and ensure nothing is broken. Fix any failures.
5. **Summarize** what you changed and how to verify it (e.g. run X, check Y).

## Rules

- Do not skip tests. Run them and fix failures before considering the task done.
- Apply project rules from `.cursor/rules` or `AGENTS.md`.
