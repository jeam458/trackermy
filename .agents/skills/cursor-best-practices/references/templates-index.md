# Templates index

This skill ships static templates in **assets/templates/** for use when setting up `.cursor/` or copying examples. Copy files into the user's project as needed (e.g. into `.cursor/commands/`, `.cursor/agents/`, or `.cursor/rules/`).

## What's in assets/templates/

| Directory | Contents | Use |
|-----------|----------|-----|
| **assets/templates/commands/** | 14 command templates (e.g. `code-review.md`, `pr.md`, `run-tests-and-fix.md`) | Copy into `.cursor/commands/` when the user wants slash commands. |
| **assets/templates/agents/** | 15 subagent templates (e.g. `verifier.md`, `reviewer.md`, `debugger.md`) | Copy into `.cursor/agents/` when the user wants custom subagents. |
| **assets/templates/rules/** | Curated rule templates (see below) | Copy into `.cursor/rules/` or use as examples; for full Cursor rules guidance see [Cursor docs](https://cursor.com/docs/rules). |

## Rule templates (curated subset)

The skill ships a small set of high-value rule templates in **assets/templates/rules/** rather than a full rule library. These cover:

- Rule structure: keep under 500 lines, use globs, write good descriptions.
- Context and setup: setup .cursor folder, @mentions, grep + semantic search, make codebase Cursor-compatible.
- Modes and workflows: Plan then Agent, run tests before done.
- Ignore: exclude secrets via .cursorignore.

For broader rule patterns and examples, point users to [Cursor docs — Rules](https://cursor.com/docs/rules) and the references in this skill (e.g. [references/rules-and-commands.md](rules-and-commands.md)).

## Other assets

- **assets/recommended-skills.md** — Curated skills from [skills.sh](https://skills.sh/) by use case. Reference when users ask for skill recommendations.
- **references/template-skill.md** — Minimal SKILL.md skeleton for creating new skills.
