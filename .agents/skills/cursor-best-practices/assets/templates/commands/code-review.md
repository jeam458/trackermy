Review the code changes in this conversation (or the files I've @-mentioned) systematically.

## Checklist

1. **Correctness**
   - Logic and control flow; edge cases and error paths.
   - Potential bugs, off-by-ones, null/undefined access.
   - Concurrency or async issues if relevant.

2. **Security**
   - Injection (SQL, NoSQL, command, XSS).
   - Auth/authz (broken access control, insecure session handling).
   - Sensitive data (logging secrets, hardcoded credentials, insecure storage).

3. **Quality**
   - Readability, naming, and structure.
   - Adherence to project conventions (see `.cursor/rules` or `AGENTS.md`).
   - Duplication, dead code, or unnecessary complexity.

4. **Tests**
   - Adequacy of coverage for the changes.
   - Test quality (behavior vs implementation, meaningful assertions).

## Output format

For each finding:

- **Critical** — Must fix before merge. Describe the issue, location, and suggested fix.
- **Suggestion** — Consider improving. Briefly explain why and how.
- **Nice to have** — Optional improvement.

Group by severity, then by file or area. If there are no issues in a category, say so (e.g. "No critical security issues found").

## Apply project rules

Use any project rules in `.cursor/rules` or `AGENTS.md` when relevant (e.g. testing style, API conventions, security requirements).
