Analyze the project's dependency tree, identify unused or duplicate dependencies, and suggest optimizations.

## Steps

1. **Analyze dependency tree**
   - Use appropriate tools (e.g. `npm ls`, `depcheck`, `pipdeptree`, `cargo tree`, `go mod graph`).
   - Build dependency graph showing all direct and transitive dependencies.

2. **Identify unused dependencies**
   - Check for dependencies listed in package files but not imported/used in code.
   - Use tools like `depcheck` (npm), `pip-autoremove` (Python), or manual analysis.
   - Verify false positives (some deps are used at build time or in configs).

3. **Find duplicate dependencies**
   - Identify multiple versions of the same package.
   - Check for conflicting versions that could cause issues.
   - Look for packages that provide similar functionality.

4. **Check bundle size impact** (if applicable)
   - For frontend projects, analyze bundle size contribution of each dependency.
   - Identify large dependencies that could be replaced or tree-shaken.
   - Check for duplicate code across dependencies.

5. **Suggest optimizations**
   - For each issue, provide:
     - **Dependency name** and version(s)
     - **Issue type** (unused, duplicate, large, etc.)
     - **Impact** (bundle size, security, maintenance)
     - **Suggested action** (remove, update, replace, consolidate)
   - Prioritize by impact:
     - **High** — Large unused deps, security vulnerabilities, major duplicates
     - **Medium** — Small unused deps, minor duplicates
     - **Low** — Optimization opportunities

6. **Report**
   - Summary of findings (unused, duplicates, large deps)
   - List of suggested removals/updates
   - Estimated impact (bundle size reduction, security improvements)
   - Warnings about potentially risky removals

## Rules

- Apply project rules from `.cursor/rules` or `AGENTS.md` when relevant.
- Be cautious with removals; verify dependencies aren't used indirectly or at build time.
- Consider security implications of outdated dependencies.
- For removals, suggest testing thoroughly after changes.
