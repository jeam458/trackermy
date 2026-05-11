Update the project's dependencies and ensure the project still works.

## Steps

1. **Identify package manager and lockfiles**
   - e.g. `package.json` + `package-lock.json` / `pnpm-lock.yaml` / `yarn.lock`, `requirements.txt` / `pyproject.toml`, `Cargo.toml`, etc.

2. **Update dependencies**
   - Use the appropriate command (e.g. `npm update`, `pnpm update`, `pip install -U -r requirements.txt`, `cargo update`). Prefer non-breaking updates unless I asked for major upgrades.
   - If I specified packages or scope (e.g. `/update-deps lodash react`), limit updates accordingly.

3. **Run tests and build**
   - Run the test suite and any build step. Fix breakages (e.g. API changes, deprecated usage).

4. **Report**
   - What was updated (packages, versions).
   - Any **breaking changes** or migration steps.
   - Test and build status.

## Rules

- Prefer **patch/minor** updates unless explicitly asked for major. Call out breaking changes clearly.
- Apply project rules from `.cursor/rules` or `AGENTS.md`.
