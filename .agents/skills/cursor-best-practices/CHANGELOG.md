# Changelog

## 1.2.0

- **Skill layout:** Restructured repo to match Agent Skills spec. Templates moved under **assets/templates/** (commands, agents, rules). **references/** kept for on-demand docs; added **references/templates-index.md** and **references/template-skill.md**. **assets/recommended-skills.md** replaces former skills/recommended.md.
- **Rules:** Kept a curated subset of rule templates in **assets/templates/rules/** (10 files + _sections.md); removed 250+ redundant rule files. Removed **indexes/** (pointed to deleted rules).
- **SKILL.md:** All internal links updated to **assets/templates/** and **references/**. Setup workflow now references assets/templates/commands/, assets/templates/agents/, assets/templates/rules/.
- **Root:** Removed duplicate CHANGELOG at repo root; single CHANGELOG at skill root. Updated **metadata.json** to current Cursor doc URLs and version 1.2.0.

## 1.1.0

- **Docs alignment:** Updated all Cursor documentation links from legacy `cursor.com/docs/context/*` paths to current official paths: [Rules](https://cursor.com/docs/rules), [Skills](https://cursor.com/docs/skills), [Subagents](https://cursor.com/docs/subagents), [MCP](https://cursor.com/docs/mcp), [reference/ignore-file](https://cursor.com/docs/reference/ignore-file).
- **SKILL.md:** Added sections for Plugins, Hooks, Cloud Agent, CLI, Worktrees, and Deeplinks with links to official docs. Expanded Skills (`.agents/skills/`, frontmatter options, `/migrate-to-skills`), Subagents (optional `model`, `readonly`, `background`), and Bugbot (nested BUGBOT.md, team rules, autofix). Agent modes now link to Plan Mode and Debug Mode docs.
- **References:** Updated [references/modes-context-tools.md](references/modes-context-tools.md) with Hooks, Cloud Agent, and CLI; added safe skill authoring note to [references/agent-and-security.md](references/agent-and-security.md).
- **Security:** Safe skill authoring guidance added (no prompt-injection patterns, no hardcoded secrets, no unsafe download/exec examples) to support Snyk and similar audits. Example placeholder in a rule file adjusted to avoid secret-like appearance.
- **Version:** Bumped from 1.0 to 1.1.0; `metadata.standards` now references `https://cursor.com/docs/skills`.
