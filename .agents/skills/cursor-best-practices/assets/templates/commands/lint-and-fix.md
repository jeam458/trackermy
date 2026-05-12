Run the project's linter, auto-fix what can be fixed, and report remaining issues.

## Steps

1. **Run linter**
   - Use the project's actual commands (e.g. `npm run lint`, `eslint .`, `ruff check`, `cargo clippy`, `golangci-lint run`).
   - If the project has multiple lint commands (e.g. `lint:js`, `lint:ts`), run the relevant one(s) for the current changes.

2. **Auto-fix issues**
   - Run the linter with auto-fix flag (e.g. `eslint --fix`, `ruff check --fix`, `cargo clippy --fix`).
   - Apply fixes that can be automatically resolved.
   - Re-run linter to verify fixes were applied.

3. **Report remaining issues**
   - For each remaining issue that couldn't be auto-fixed, provide:
     - **Location** (file, line, column)
     - **Rule/error code** (e.g. `no-unused-vars`, `E501`)
     - **Description** (what's wrong)
     - **Suggested fix** (how to resolve manually)
   - Categorize by severity:
     - **Error** — Must fix (blocks build/CI)
     - **Warning** — Should fix (code quality)
     - **Info** — Nice to have (style suggestions)

4. **Summarize**
   - How many issues were auto-fixed
   - How many issues remain (by severity)
   - List of files that need manual attention

## Rules

- Do **not** disable or ignore lint rules to make lint pass. Fix the code properly.
- Apply project rules from `.cursor/rules` or `AGENTS.md` when relevant (e.g. linting style, rule preferences).
- If the project doesn't have a linter configured, suggest setting one up rather than skipping.
