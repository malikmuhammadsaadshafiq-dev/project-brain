# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Project Brain - VS Code extension that generates AI-native project memory using modular Claude.md architecture. Works across VS Code, Cursor, Windsurf, and other VS Code-based IDEs.

## Build & Development Commands

```bash
npm install          # Install dependencies
npm run compile      # Compile TypeScript
npm run watch        # Watch mode for development
npm run lint         # Run ESLint
npm run package      # Package as VSIX using vsce
```

## Architecture

### Core Modules

```
src/
├── extension.ts      # Main entry point, command registration
├── types.ts          # TypeScript interfaces
├── brainGenerator.ts # File generation and status checking
├── templates.ts      # Markdown templates for brain files
├── wizard.ts         # Multi-step setup wizard (webview)
├── uiPanel.ts        # Sidebar panel provider (webview)
├── stackDetector.ts  # Auto-detect project tech stack
└── contextSync.ts    # File watcher and import sync
```

### Extension Flow

1. **Activation**: On workspace open, checks for existing brain files
2. **Detection**: If missing, prompts user to initialize
3. **Wizard**: Collects project info via multi-step webview
4. **Generation**: Creates CLAUDE.md + project-brain/ files
5. **Sync**: Watches for changes, updates imports automatically

### Generated Structure

```
CLAUDE.md                         # Main entry with @import directives
project-brain/
├── product.md                    # Product overview
├── architecture.md               # System design
├── stack.md                      # Tech stack
├── coding-standards.md           # Code conventions
├── agent-rules.md                # AI workflow rules
├── database.md                   # DB schema
├── api.md                        # API docs
└── roadmap.md                    # Milestones
docs/
├── overview.md                   # Quick start
└── decisions.md                  # ADRs
```

### Key Patterns

- Webviews use CSP with 'unsafe-inline' for styles/scripts
- DOM manipulation uses safe methods (textContent, replaceChildren)
- File operations use vscode.workspace.fs API
- Commands registered in extension.ts, logic in separate modules
