Help me set up a new feature. If you typed text after the command (e.g. `/setup-new-feature auth` or `/setup-new-feature user notifications`), use that as the feature name or short description.

## Steps

1. **Propose a minimal plan**
   - **New files** — modules, components, routes, tests.
   - **Key functions/modules** — what each does and how they plug into the existing codebase.
   - **Integration points** — existing APIs, state, DB, or UI to extend or call.

2. **Identify relevant patterns**
   - Existing features (e.g. "follow the pattern in `auth/`"), `.cursor/rules`, or `AGENTS.md`.
   - Stack conventions (e.g. React hooks, REST endpoints, repository pattern).

3. **Suggest implementation steps**
   - Create structure (files, folders) → implement → add tests → update docs (if applicable).
   - Prefer **incremental, testable** steps rather than one big change.

## Context

- Use **@files** or **@folder** if I've pointed to reference implementations.
- Prefer **small, reviewable** chunks. Run tests between steps when possible.

## Apply project rules

Follow `.cursor/rules` or `AGENTS.md` (e.g. testing, structure, naming).
