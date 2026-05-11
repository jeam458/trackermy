---
description: "Make codebase cursor compatible, vibe codeable, cursor setup, index codebase, add cursor rules, setup cursor for project, make project cursor-friendly, cursor optimization, codebase indexing, cursor configuration. How to make your codebase cursor compatible: add .cursor folder, create .cursorignore, add rules and commands, create AGENTS.md, index codebase structure, add project-specific rules, create navigation indexes, document architecture. Why make codebase cursor compatible: helps AI understand codebase, improves code suggestions, better context awareness, faster development, better code navigation. Making codebase cursor compatible: setup .cursor folder structure, create .cursorignore file, add AGENTS.md codebase guide, create project-specific rules, add useful commands, create navigation indexes, document architecture."
tags: [get-started, setup, cursor-compatible, vibe-codeable, codebase-setup, indexing, rules, commands, agents, cursor-configuration, make-cursor-compatible, codebase-indexing, project-setup, cursor-optimization]
---

# Make Codebase Cursor Compatible

Making your codebase "Cursor compatible" or "vibe codeable" means setting it up so Cursor's AI can better understand, navigate, and work with your codebase.

## What Does "Cursor Compatible" Mean?

A Cursor-compatible codebase has:

- **`.cursor/` folder** with rules, commands, and agents
- **`.cursorignore`** to exclude unnecessary files from indexing
- **`AGENTS.md`** that explains the codebase structure to AI
- **Project-specific rules** that guide AI behavior
- **Navigation indexes** for large codebases
- **Architecture documentation** for context

## Do: Set Up Cursor Compatibility

### 1. Create `.cursor` Folder Structure

Create the standard structure:

```
.cursor/
├── rules/              # Project-specific rules
├── commands/           # Custom commands
├── agents/             # Subagents
├── skills/             # Project-specific skills (optional)
└── AGENTS.md          # Codebase guide for AI
```

**Why**: This structure helps Cursor discover and use your project-specific guidance.

### 2. Create `.cursorignore`

Exclude files that shouldn't be indexed:

```
# Dependencies
node_modules/
venv/
.venv/

# Build artifacts
dist/
build/
*.min.js
*.min.css

# Generated files
coverage/
*.generated.*

# Secrets
.env
.env.*
*.key
*.pem

# OS files
.DS_Store
Thumbs.db
```

**Why**: Reduces noise, improves performance, and protects secrets.

### 3. Create `AGENTS.md`

Document your codebase structure:

```markdown
# Codebase Guide

## Structure
- `src/` - Source code
- `tests/` - Test files
- `docs/` - Documentation

## Key Patterns
- Components in `src/components/`
- Utils in `src/utils/`
- Tests mirror source structure
```

**Why**: Helps AI understand your codebase organization and conventions.

### 4. Add Project-Specific Rules

Create rules in `.cursor/rules/`:

- **`codebase-structure.md`** - Repository layout
- **`coding-standards.md`** - Conventions
- **`testing-patterns.md`** - Testing approach
- **`architecture.md`** - Design decisions

**Why**: Guides AI to follow your project's patterns and conventions.

### 5. Create Navigation Indexes

For large codebases, create indexes:

- **`indexes/feature-index.md`** - Features by domain
- **`indexes/component-index.md`** - Components catalog
- **`indexes/api-index.md`** - API endpoints

**Why**: Helps AI quickly find relevant code.

### 6. Add Useful Commands

Create commands in `.cursor/commands/`:

- **`code-review.md`** - Review workflow
- **`run-tests.md`** - Test execution
- **`setup-dev.md`** - Development setup

**Why**: Provides reusable workflows for common tasks.

## Don't: Over-Configure

**Don't create rules for everything:**
- Start with essential rules
- Add more as patterns emerge
- Avoid duplicating obvious conventions

**Don't ignore existing patterns:**
- Document existing conventions
- Don't create conflicting rules
- Build on what already works

**Don't skip `.cursorignore`:**
- Always exclude dependencies and build artifacts
- Protect secrets and credentials
- Improve performance by excluding large files

## Related Queries

Users might ask:
- "How do I make my codebase cursor compatible?"
- "Set up cursor for this project"
- "Make this codebase vibe codeable"
- "Index my codebase for cursor"
- "Add cursor rules to my project"
- "How to configure cursor for this codebase?"

## See Also

- [Setup Cursor Folder](context-setup-cursor-folder.md)
- [Cursor Rules](https://cursor.com/docs/rules)
- [Cursor Skills](https://cursor.com/docs/skills)
- [references/templates-index.md](../../references/templates-index.md) (in this skill)
- [Agent Skills Specification](https://agentskills.io/specification)
