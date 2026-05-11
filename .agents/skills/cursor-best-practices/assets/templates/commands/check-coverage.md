Check test coverage, identify gaps, and suggest which code needs tests.

## Steps

1. **Run coverage tool**
   - Use the project's coverage command (e.g. `npm run test:coverage`, `pytest --cov`, `cargo tarpaulin`, `go test -cover`).
   - Generate coverage report in a readable format (HTML, JSON, or text).

2. **Analyze coverage report**
   - Identify overall coverage percentage.
   - Find files/functions with low or zero coverage.
   - Check critical paths (e.g. authentication, payment, data validation).

3. **Identify gaps**
   - List files with coverage below threshold (default: <80%, but use project's threshold if defined).
   - Identify untested functions, branches, or edge cases.
   - Prioritize by importance (critical business logic first).

4. **Suggest improvements**
   - For each gap, suggest:
     - **File/function** that needs tests
     - **Why it's important** (critical path, user-facing, etc.)
     - **What to test** (happy path, edge cases, error conditions)
   - Categorize by priority:
     - **Critical** — Must have tests (security, payments, core features)
     - **High** — Should have tests (important features)
     - **Medium** — Nice to have tests (utility functions, helpers)

5. **Report**
   - Overall coverage percentage
   - Coverage by file (if available)
   - List of critical gaps
   - Suggested test priorities

## Rules

- Apply project rules from `.cursor/rules` or `AGENTS.md` when relevant (e.g. coverage thresholds, testing style).
- Focus on meaningful coverage (testing behavior, not just lines).
- If coverage tool isn't configured, suggest setting one up.
