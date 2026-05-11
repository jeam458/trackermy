# Cursor Quick Reference

Quick reference guide for common Cursor workflows, shortcuts, commands, and subagents.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| **Ctrl+I** | Open Agent Mode |
| **Ctrl+K** | Inline Edit (single file) |
| **Ctrl+.** | Cycle through modes (Agent → Ask → Plan → Debug) |
| **Enter** | Queue message (review before sending) |
| **Ctrl+Enter** | Send message immediately |
| **Tab** | Accept Tab completion |
| **Esc** | Reject Tab completion |
| **Ctrl+Right** | Partial accept Tab completion |
| **Shift+Tab** | Switch between plans (in Plan mode) |

## Mode Selection Guide

| Mode | When to Use | Tools Available |
|------|-------------|----------------|
| **Agent** | Implement, refactor, multi-file work | Full (search, read, edit, terminal, MCP) |
| **Ask** | Learning, Q&A, exploration | Search + read only; no edits |
| **Plan** | Research → clarify → plan → review → "Build" | Search + read |
| **Debug** | Reproducible bugs; hypotheses → instrument → fix | Full |

**Best Practice**: Plan with Ask/Plan, implement with Agent. If Agent builds wrong thing, revert → refine plan → re-run.

## Commands Quick Reference

| Command | Purpose | Example |
|---------|---------|---------|
| `/code-review` | Review for correctness, security, quality, tests | `/code-review @src/components/Button.tsx` |
| `/pr` | Generate PR title, description, review checklist | `/pr` |
| `/run-tests-and-fix` | Run tests, fix failures, re-run until green | `/run-tests-and-fix` |
| `/security-audit` | Security-focused review | `/security-audit @src/auth/` |
| `/setup-new-feature` | Propose plan with files, modules, patterns | `/setup-new-feature "User auth"` |
| `/fix-issue` | Fix bug or feature from issue | `/fix-issue #123` |
| `/update-deps` | Update dependencies, run tests | `/update-deps` |
| `/docs` | Generate or update documentation | `/docs @src/utils/helpers.ts` |
| `/make-cursor-compatible` | Make codebase Cursor-compatible | `/make-cursor-compatible` |
| `/lint-and-fix` | Run linter, auto-fix issues | `/lint-and-fix` |
| `/format` | Format code according to standards | `/format @src/**/*.ts` |
| `/check-coverage` | Check test coverage, identify gaps | `/check-coverage` |
| `/analyze-deps` | Analyze dependencies, find unused/duplicates | `/analyze-deps` |
| `/generate-types` | Generate types from schemas/APIs | `/generate-types @openapi.yaml` |

## Subagents Quick Reference

### Read-Only Subagents (Review/Analysis)

| Subagent | Purpose | Invoke |
|----------|---------|--------|
| `verifier` | Runs tests and lint, reports pass/fail | `@verifier` |
| `reviewer` | Code review (correctness, security, quality) | `@reviewer` |
| `security-auditor` | Security-focused review | `@security-auditor` |
| `linter` | Linting and code style review | `@linter` |
| `architect` | Architectural pattern review | `@architect` |

### Editable Subagents (Can Modify Code)

| Subagent | Purpose | Invoke |
|----------|---------|--------|
| `documenter` | Generate/update documentation | `@documenter` |
| `tester` | Write and update tests | `@tester` |
| `refactorer` | Refactor code while maintaining functionality | `@refactorer` |
| `debugger` | Investigate and identify bugs | `@debugger` |
| `performance-analyzer` | Analyze performance issues | `@performance-analyzer` |
| `accessibility-checker` | Review code for a11y compliance | `@accessibility-checker` |
| `migrator` | Handle code migrations | `@migrator` |
| `dependency-manager` | Review and manage dependencies | `@dependency-manager` |
| `formatter` | Format code according to standards | `@formatter` |
| `type-generator` | Generate types from schemas/APIs | `@type-generator` |

## Common Workflows

### TDD (Test-Driven Development)

1. Write failing test
2. Run test (expect fail)
3. Commit failing test
4. Implement minimal code
5. Run test until pass
6. Refactor if needed
7. Commit implementation

**Command**: `/run-tests-and-fix` or use `@tester` subagent

### Code Review Workflow

1. Make changes
2. Run `/code-review` or use `@reviewer`
3. Address feedback
4. Run `/run-tests-and-fix`
5. Run `/lint-and-fix`
6. Format with `/format`
7. Create PR with `/pr`

### Feature Development Workflow

1. Plan with `/setup-new-feature` or Plan mode
2. Implement with Agent mode
3. Write tests with `@tester`
4. Review with `@reviewer`
5. Fix issues
6. Format with `/format`
7. Create PR with `/pr`

### Pre-Commit Checklist

- [ ] Run `/run-tests-and-fix`
- [ ] Run `/lint-and-fix`
- [ ] Run `/format`
- [ ] Run `/code-review` or `@reviewer`
- [ ] Check coverage with `/check-coverage` (if applicable)

## @Mentions Quick Reference

| Mention | Purpose | Example |
|---------|---------|---------|
| `@file` | Reference specific file | `@src/components/Button.tsx` |
| `@folder` | Reference entire folder | `@src/components/` |
| `@Code` | Reference specific code snippet | `@Code:function calculateTotal` |
| `@Docs` | Add documentation | `@Docs:https://example.com/api` |

**Best Practice**: Use `@Code` for most precise context, `@file` for file-level context, `@folder` for broader context.

## When to Use What

### Commands vs Subagents

- **Commands**: Sequential workflows, user-triggered actions, one-time tasks
- **Subagents**: Parallel work, context isolation, specialized focus, ongoing tasks

### Examples

- **Linting**: Use `/lint-and-fix` command for fixing, `@linter` subagent for review
- **Testing**: Use `/run-tests-and-fix` command for fixing, `@tester` subagent for writing tests
- **Review**: Use `/code-review` command for comprehensive review, `@reviewer` subagent for parallel review

## File Locations

- **Commands**: `.cursor/commands/` (copy from skill templates)
- **Subagents**: `.cursor/agents/` (copy from skill templates)
- **Rules**: `.cursor/rules/` (create project-specific rules)
- **AGENTS.md**: Project root (alternative to rules folder)

## Getting Help

- **Cursor Docs**: https://cursor.com/docs/
- **Skills**: https://skills.sh/
- **Rules & MCPs**: https://cursor.directory/
- **This Skill**: See `SKILL.md` for comprehensive guide

---

**Tip**: Bookmark this page or keep it open for quick reference while working with Cursor!
