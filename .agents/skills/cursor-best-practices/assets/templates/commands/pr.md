Help me create a pull request for the current branch.

## Steps

1. **Summarize changes**
   - Use `git diff`, `git log`, or recent commits to understand what changed.
   - If I've @-mentioned files or provided context, use that too.
   - Briefly list: what was added, changed, or removed, and why.

2. **Propose PR title and description**
   - **Title:** Short, imperative (e.g. "Add email validation to login" or "Fix null deref in user loader").
   - **Description:** Include:
     - **What** changed (high level).
     - **Why** (bug fix, feature, refactor).
     - **How to test** (steps or commands).
     - Any **breaking changes** or **migration notes** if relevant.

3. **Suggest a review checklist**
   - e.g. [ ] Tests run and pass  
   - [ ] Lint passes  
   - [ ] Migrations applied (if any)  
   - [ ] Docs updated (if relevant)  
   - [ ] No secrets or debug code committed  

Adapt to the project (e.g. "run `make test`", "apply `.cursor/rules`").

## Apply project rules

Follow any project rules in `.cursor/rules` or `AGENTS.md` (e.g. PR format, scope, conventions).
