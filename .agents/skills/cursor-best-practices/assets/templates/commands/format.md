Format code according to the project's formatting standards.

## Steps

1. **Identify formatter**
   - Check for project formatters (e.g. Prettier, Black, rustfmt, gofmt, prettier, dprint).
   - Look for configuration files (`.prettierrc`, `pyproject.toml`, `rustfmt.toml`, etc.).

2. **Format files**
   - If I @-mentioned specific files, format only those.
   - Otherwise, format all files in the current scope (changed files, or entire project if requested).
   - Use the appropriate command (e.g. `prettier --write`, `black .`, `cargo fmt`, `gofmt -w`).

3. **Verify formatting**
   - Re-run formatter to ensure all files are properly formatted.
   - Check that no formatting conflicts exist.

4. **Report**
   - List which files were formatted.
   - Note any files that couldn't be formatted (e.g. unsupported file types).
   - If formatting changed behavior or structure, note it.

## Rules

- Apply project rules from `.cursor/rules` or `AGENTS.md` when relevant (e.g. formatting style preferences).
- Preserve code functionality; formatting should only change whitespace and style, not logic.
- If the project doesn't have a formatter configured, suggest setting one up.
