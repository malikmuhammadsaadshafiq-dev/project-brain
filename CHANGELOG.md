# Changelog

All notable changes to Project Brain will be documented in this file.

## [1.0.0] - 2024

### Added
- Initial release
- Setup wizard with 4-step guided configuration
- Sidebar panel with brain status and quick actions
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
