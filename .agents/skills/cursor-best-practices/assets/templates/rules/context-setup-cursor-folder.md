---
title: Follow the "Setup my .cursor folder" workflow
impact: HIGH
impactDescription: Consistent structure lets teams share commands, agents, and rules via git.
tags: setup, .cursor, workflow, setup-cursor-folder, cursor-folder-setup, initialize-cursor-folder, cursor-folder-workflow, setup-cursor-guide
description: "Setup .cursor folder: create standard structure (.cursor/rules/, .cursor/commands/, .cursor/skills/, .cursor/agents/), optionally add minimal .cursorignore, offer to install templates from skill's commands/ and agents/, confirm what was created. How to setup: create folders (.cursor/rules/, .cursor/commands/, .cursor/skills/, .cursor/agents/), optionally add minimal .cursorignore (node_modules/, .env, .env.*, *.log, dist/, build/), offer templates (code-review.md, pr.md, run-tests-and-fix.md, security-audit.md, setup-new-feature.md, verifier.md), confirm what was created. Why setup .cursor folder: consistent structure lets teams share commands, agents, and rules via git, enables collaboration, maintains organization, essential for teams. Don't overwrite existing: don't overwrite existing .cursor content without asking, don't copy entire rules/ folder into .cursor/rules/ as Cursor rules, don't skip confirmation step. Setup workflow: user asks to setup → create folders → add .cursorignore → offer templates → confirm what was created → explain how to use. Setup best practices: create standard structure, add minimal .cursorignore, offer templates, confirm what was created, don't overwrite existing."
---

# Follow the "Setup my .cursor folder" workflow

When the user asks to **set up**, **initialize**, or **create** their `.cursor` folder, create the standard structure, optionally add a minimal `.cursorignore`, and offer to install templates from this skill's **assets/templates/commands/** and **assets/templates/agents/**. Confirm what was created and how to use it.

## Do

1. **Create folders:**  
   `.cursor/rules/`, `.cursor/commands/`, `.cursor/skills/`, `.cursor/agents/`.

2. **Optional `.cursorignore`:**  
   If the project has no `.cursorignore`, add a minimal one, e.g.:
   ```
   node_modules/
   .env
   .env.*
   *.log
   dist/
   build/
   ```
   Use standard `.gitignore` syntax. Adjust for the project (e.g. add `__pycache__/`, `*.pyc` for Python).

3. **Offer templates:**  
   Propose copying from this skill:
   - **Commands:** `code-review.md` → `.cursor/commands/code-review.md`, and optionally `pr.md`, `run-tests-and-fix.md`, `security-audit.md`, `setup-new-feature.md`.
   - **Agents:** `verifier.md` → `.cursor/agents/verifier.md`.  
   If the user agrees (or doesn't specify), copy them.

4. **Rules:**  
   **Rules:** Optionally copy from this skill's **assets/templates/rules/** or add **one** short rule (e.g. "Run tests before considering the task done") or a minimal **AGENTS.md** at project root.

5. **Confirm:**  
   List what was created and how to use it (e.g. "Use `/code-review` in chat," "Add project-specific rules to `.cursor/rules/`," "Configure `.cursorignore` for secrets").

## Don't

- **Overwrite** existing `.cursor` content without asking.
- **Copy** the entire skill templates folder into `.cursor/` without user confirmation.
- **Skip** the confirmation step—users should know what's now available.

## Related Queries

Users might ask:
- "How to setup .cursor folder?"
- "Setup .cursor folder"
- "Initialize .cursor folder"
- "Create .cursor folder"
- "How to setup cursor folder?"
- "Setup cursor folder guide"
- "How to initialize .cursor folder?"
- "Setup cursor folder best practices"
- "How to create .cursor structure?"
- "Setup cursor folder tips"
- "What is .cursor folder setup?"
- "How to setup cursor folder workflow?"

**See:** [Cursor docs](https://cursor.com/docs/), [SKILL.md](../SKILL.md) "Setup my .cursor folder".
