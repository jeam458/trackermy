Generate or update documentation for the code I've @-mentioned (or the current feature/area we're working on).

## Steps

1. **Identify scope**
   - Use @-mentioned files, or the focus of our conversation (e.g. new API, refactored module).
   - Determine what kind of docs are needed: API reference, README section, inline JSDoc/docstrings, architecture overview, runbook, etc.

2. **Draft or update docs**
   - Follow existing project style (e.g. JSDoc, TSDoc, Sphinx, rustdoc).
   - Include: purpose, usage, parameters/returns, examples, and any caveats or migration notes.
   - If updating, preserve existing structure where it still applies; revise only what changed.

3. **Place docs appropriately**
   - Inline (comments, JSDoc) for implementation details.
   - README or `docs/` for user-facing or high-level guides.
   - Link between docs if relevant.

## Rules

- Match the project's existing doc format and tone.
- Apply project rules from `.cursor/rules` or `AGENTS.md` (e.g. doc conventions).
