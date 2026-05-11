# Make Codebase Cursor Compatible

When the user asks to "make this codebase cursor compatible", "make it vibe codeable", "set up cursor for this project", or similar requests, help them transform their codebase into a Cursor-optimized workspace.

## Overview

Making a codebase "Cursor compatible" or "vibe codeable" means:
- Adding `.cursor/` folder structure with rules, commands, agents
- Creating `.cursorignore` to exclude unnecessary files
- Adding project-specific rules that help Cursor understand the codebase
- Setting up indexes and documentation for better AI navigation
- Configuring skills if applicable

## Step-by-Step Process

### 1. Create `.cursor` Folder Structure

Create the following structure:

```
.cursor/
├── rules/              # Project-specific rules
├── commands/           # Custom commands
├── agents/             # Subagents
├── skills/             # Project-specific skills (optional)
└── AGENTS.md          # Codebase guide for AI
```

**Action**: Create these directories if they don't exist.

### 2. Create `.cursorignore`

Create `.cursorignore` at project root to exclude:
- Build artifacts (`dist/`, `build/`, `*.min.js`)
- Dependencies (`node_modules/`, `venv/`, `.venv/`)
- Generated files (`*.generated.*`, `coverage/`)
- Large data files
- Secrets and credentials (`.env`, `*.key`, `*.pem`)
- OS files (`.DS_Store`, `Thumbs.db`)
- Editor files (`.vscode/`, `.idea/`)

**Action**: Create `.cursorignore` with appropriate patterns for the project type.

### 3. Create `AGENTS.md`

Create `.cursor/AGENTS.md` with comprehensive codebase guide:
- Repository purpose and overview
- Deep dive into structure (all directories and files)
- File naming conventions
- Content patterns and conventions
- Architecture decisions and rationale
- Key principles and design patterns
- How to navigate the codebase
- Common tasks and workflows
- Standards compliance
- Maintenance workflow
- Dependencies and relationships

**Action**: Generate comprehensive `AGENTS.md` based on the current codebase structure. This should be detailed enough for Cursor to understand the codebase at the deepest level.

### 4. Add Project-Specific Rules

Create initial rules in `.cursor/rules/`:

- **`codebase-structure.md`** - Explains repository layout, file organization, skill structure
- **`architecture-and-design.md`** - Architecture decisions, design principles, structure rationale
- **`content-patterns.md`** - Content patterns, writing conventions, enhancement guidelines
- **`coding-standards.md`** - Project-specific coding conventions (if applicable)
- **`testing-patterns.md`** - Testing approach and patterns (if applicable)
- **`skill-maintenance.md`** - Maintenance guidelines, update workflow, quality checks

**Action**: Analyze codebase and create comprehensive rules that help Cursor understand the codebase deeply.

### 5. Create Navigation Indexes

Create indexes in `.cursor/indexes/` for deep understanding:

- **`codebase-index.md`** - Quick reference for navigating the codebase (core files, directories, common tasks)
- **`feature-index.md`** - Features organized by domain (if applicable)
- **`component-index.md`** - Components and their purposes (if applicable)
- **`api-index.md`** - API endpoints and routes (if applicable)

**Action**: Create indexes that help Cursor quickly find and understand codebase components.

### 6. Add Useful Commands

Create commands in `.cursor/commands/`:

- **`code-review.md`** - Review code before commit
- **`run-tests.md`** - Run test suite
- **`setup-dev.md`** - Setup development environment
- **`deploy.md`** - Deployment workflow

**Action**: Create commands based on project needs.

### 7. Document Architecture

Create comprehensive architecture documentation:

- **`CODEBASE.md`** at root - High-level overview, structure, key concepts
- **`.cursor/ARCHITECTURE.md`** - System architecture, content architecture, design patterns, standards compliance, performance considerations
- Explains high-level structure
- Key design decisions and rationale
- How different parts interact
- Extension points and customization

**Action**: Create architecture documentation that provides deep understanding of the codebase structure and design.

## Implementation Checklist

When implementing, check:

- [ ] `.cursor/` folder structure created
- [ ] `.cursorignore` created with appropriate patterns
- [ ] `.cursor/AGENTS.md` created with codebase guide
- [ ] Initial rules added to `.cursor/rules/`
- [ ] Useful commands added to `.cursor/commands/`
- [ ] Architecture documentation created
- [ ] Indexes created (if large codebase)
- [ ] All files follow project conventions

## Example Output

After setup, the codebase should have:

```
project-root/
├── .cursor/
│   ├── AGENTS.md                    # Comprehensive codebase guide
│   ├── ARCHITECTURE.md              # System and content architecture
│   ├── rules/
│   │   ├── codebase-structure.md    # Structure documentation
│   │   ├── architecture-and-design.md  # Design decisions
│   │   ├── content-patterns.md      # Writing conventions
│   │   ├── skill-maintenance.md     # Maintenance guidelines
│   │   ├── coding-standards.md      # Coding conventions (if applicable)
│   │   └── testing-patterns.md      # Testing patterns (if applicable)
│   ├── indexes/
│   │   └── codebase-index.md        # Quick navigation reference
│   ├── commands/
│   │   ├── code-review.md
│   │   └── run-tests.md
│   └── agents/ (optional)
├── .cursorignore
├── CODEBASE.md                      # High-level overview
└── [rest of project files]
```

## Best Practices

1. **Start Simple**: Begin with basic structure, add more as needed
2. **Be Specific**: Rules should be specific to this codebase
3. **Keep Updated**: Update rules as codebase evolves
4. **Link to Docs**: Reference external documentation when relevant
5. **Use Globs**: File-specific rules should use globs appropriately

## Apply Project Rules

When creating rules and commands, apply any existing project rules or conventions.

## See Also

- [Cursor Rules Documentation](https://cursor.com/docs/rules)
- [Cursor Commands Documentation](https://cursor.com/docs/rules)
- [Agent Skills Specification](https://agentskills.io/specification)
- [skills.sh Documentation](https://skills.sh/docs)
