# Changelog

All notable changes to Project Brain will be documented in this file.

## [2.0.0] - 2026-03-03

### Added
- Sidebar panel with brain file tree view
- Quick Initialize with auto-detection of project stack
- Activity bar icon for instant access
- File watcher for real-time brain file updates

### Improved
- Optimized activation events for faster VS Code startup
- Better stack detection for Python (FastAPI, Django, Flask)
- Cleaner template generation

### Changed
- Updated engine compatibility to VS Code ^1.74.0
- Migrated to @vscode/vsce for packaging

## [1.0.0] - 2024

### Added
- Initial release
- Setup wizard with 4-step guided configuration
- Auto-detection for Node.js, Python, Next.js, FastAPI, Django, Flask, and more
- Generates complete project brain structure:
  - CLAUDE.md (main entry point)
  - product.md (product overview)
  - architecture.md (system design)
  - stack.md (technology stack)
  - coding-standards.md (code conventions)
  - agent-rules.md (AI behavior rules)
  - database.md (schema documentation)
  - api.md (API documentation)
  - roadmap.md (project milestones)
- Auto-sync feature for import updates
- Command palette integration
- Works with VS Code, Cursor, Windsurf, and all VS Code forks

### Security
- Content Security Policy enforced in all webviews
- No external network calls
- No telemetry or tracking
