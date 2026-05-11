Perform a security-focused review of the code I've @-mentioned (or the most relevant changes in this conversation).

## Checklist

1. **Injection**
   - SQL, NoSQL, command injection (user input → query or shell).
   - XSS (unescaped output, `innerHTML`, `eval`-like usage).

2. **Authentication & authorization**
   - Broken access control (missing checks, IDOR).
   - Insecure session handling, weak or default secrets.
   - Auth bypass or privilege escalation paths.

3. **Sensitive data**
   - Logging secrets, tokens, or PII.
   - Hardcoded credentials or keys.
   - Insecure storage or transmission of secrets.

4. **Dependencies**
   - Known vulnerable packages. Suggest running `npm audit`, `pip audit`, `cargo audit`, or the project's equivalent, and report findings.

## Output format

- **Critical** — Must fix before merge. Describe issue, location, and recommended fix.
- **High** — Should fix soon. Same structure.
- **Medium / Low** — Note briefly; optionally defer.

Prioritize **Critical** and **High**. Suggest **concrete** fixes (e.g. use parameterized queries, validate input, move secrets to env).

## Apply project rules

Use project rules in `.cursor/rules` or `AGENTS.md` when relevant (e.g. security requirements, approved libraries).
