Run the project's test suite, fix any failures, and report what changed.

## Steps

1. **Run tests**
   - Use the project's actual commands (e.g. `npm test`, `pnpm test`, `pytest`, `cargo test`, `go test ./...`).
   - If the project has multiple test commands (unit vs e2e), run the relevant one(s) for the current changes.

2. **If any tests fail**
   - Analyze the failure (assertion, error message, stack trace).
   - Fix the **implementation** (or add missing tests for new behavior). Do **not** skip tests or change expectations solely to make them pass.
   - Re-run tests until they all pass.

3. **Summarize**
   - What was broken (which test(s), why).
   - What you changed (files, approach).
   - Confirm all tests now pass.

## Rules

- Do **not** delete or weaken tests to get green. Fix the code.
- Apply project rules from `.cursor/rules` or `AGENTS.md` when relevant (e.g. test style, coverage).
