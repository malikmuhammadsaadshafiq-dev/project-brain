import { ProjectConfig } from './types';

export function generateClaudeMd(config: ProjectConfig): string {
    return `# Project Brain

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@import ./project-brain/product.md
@import ./project-brain/architecture.md
@import ./project-brain/stack.md
@import ./project-brain/coding-standards.md
@import ./project-brain/agent-rules.md
@import ./project-brain/database.md
@import ./project-brain/api.md
@import ./project-brain/roadmap.md

## Quick Reference

- **Project**: ${config.projectName}
- **Stack**: ${config.frontend || 'N/A'} + ${config.backend || 'N/A'}
- **Database**: ${config.database || 'N/A'}
- **API Style**: ${config.apiStyle || 'REST'}
`;
}

export function generateProductMd(config: ProjectConfig): string {
    return `# Product Overview

## Project Name
${config.projectName}

## Description
${config.projectDescription}

## Problem Statement
${config.problemSolved}

## Target Users
${config.targetUsers}

## MVP Features
${config.mvpFeatures ? config.mvpFeatures.map(f => `- ${f}`).join('\n') : '- Define MVP features'}

## Success Metrics
- User adoption rate
- Feature completion rate
- Performance benchmarks
`;
}

export function generateArchitectureMd(config: ProjectConfig): string {
    return `# Architecture

## System Overview

\`\`\`
┌─────────────────────────────────────────────────────────┐
│                      Client Layer                        │
│                   ${config.frontend || 'Frontend'}                          │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│                      API Layer                           │
│              ${config.apiStyle || 'REST'} API (${config.backend || 'Backend'})                │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│                    Data Layer                            │
│                   ${config.database || 'Database'}                         │
└─────────────────────────────────────────────────────────┘
\`\`\`

## Key Components

### Frontend
- Framework: ${config.frontend || 'Not specified'}
- State Management: Define state management approach
- Routing: Define routing strategy

### Backend
- Framework: ${config.backend || 'Not specified'}
- Authentication: ${config.authSystem || 'Not specified'}
- API Style: ${config.apiStyle || 'REST'}

### Infrastructure
- Hosting: ${config.hostingPlatform || 'Not specified'}
${config.infrastructureNotes ? `- Notes: ${config.infrastructureNotes}` : ''}

## Data Flow
1. User interacts with frontend
2. Frontend sends request to API
3. API processes request with business logic
4. Data layer handles persistence
5. Response flows back to user

## Security Architecture
- Authentication: ${config.authSystem || 'Define auth system'}
- Authorization: Role-based access control
- Data encryption: TLS in transit, encryption at rest
`;
}

export function generateStackMd(config: ProjectConfig): string {
    return `# Technology Stack

## Frontend
- **Framework**: ${config.frontend || 'Not specified'}
- **Styling**: Define styling approach
- **Build Tool**: Define build tool

## Backend
- **Framework**: ${config.backend || 'Not specified'}
- **Runtime**: Define runtime environment
- **API Style**: ${config.apiStyle || 'REST'}

## Database
- **Primary**: ${config.database || 'Not specified'}
- **ORM/ODM**: Define ORM choice
- **Migrations**: Define migration strategy

## Authentication
- **System**: ${config.authSystem || 'Not specified'}
- **Session Management**: Define session approach
- **OAuth Providers**: Define if applicable

## Infrastructure
- **Hosting**: ${config.hostingPlatform || 'Not specified'}
- **CI/CD**: Define CI/CD pipeline
- **Monitoring**: Define monitoring tools

## Development Tools
- **Package Manager**: npm/yarn/pnpm
- **Linting**: ESLint/Prettier
- **Testing**: ${config.testingRequirements || 'Jest/Vitest'}
`;
}

export function generateCodingStandardsMd(config: ProjectConfig): string {
    return `# Coding Standards

## Style Guide
${config.codingStyle || 'Follow language-specific best practices'}

## Naming Conventions

### Files
- Components: PascalCase (UserProfile.tsx)
- Utilities: camelCase (formatDate.ts)
- Constants: SCREAMING_SNAKE_CASE
- Test files: *.test.ts or *.spec.ts

### Code
- Variables: camelCase
- Functions: camelCase
- Classes: PascalCase
- Constants: UPPER_SNAKE_CASE
- Private members: _prefixed or #private

## File Organization
\`\`\`
src/
├── components/     # UI components
├── hooks/          # Custom hooks
├── services/       # API/business logic
├── utils/          # Helper functions
├── types/          # TypeScript types
├── constants/      # App constants
└── tests/          # Test files
\`\`\`

## Code Quality Rules
- Maximum function length: 50 lines
- Maximum file length: 300 lines
- Maximum parameters: 4
- Prefer composition over inheritance
- Single responsibility principle

## Testing Requirements
${config.testingRequirements || '- Unit tests for utilities\n- Integration tests for API\n- E2E tests for critical flows'}

## Documentation
- Document public APIs
- Use JSDoc for complex functions
- Keep README updated
- Document architectural decisions
`;
}

export function generateAgentRulesMd(config: ProjectConfig): string {
    return `# Agent Development Rules

## Workflow

All AI agents working on this project must follow this workflow:

\`\`\`
1. UNDERSTAND CONTEXT
   └─ Read relevant documentation
   └─ Analyze existing code patterns
   └─ Identify dependencies

2. PLAN
   └─ Break down the task
   └─ Identify affected files
   └─ Consider edge cases

3. WRITE CODE
   └─ Follow coding standards
   └─ Match existing patterns
   └─ Keep changes minimal

4. TEST
   └─ Run existing tests
   └─ Add new tests if needed
   └─ Verify edge cases

5. VERIFY
   └─ Code review checklist
   └─ Performance check
   └─ Security review

6. DOCUMENT
   └─ Update relevant docs
   └─ Add inline comments if complex
   └─ Update changelog if applicable

7. COMMIT
   └─ Clear commit message
   └─ Reference issue/ticket
   └─ Small, focused commits
\`\`\`

## Code Modification Rules

### DO
- Read existing code before modifying
- Follow established patterns
- Keep changes focused and minimal
- Test changes thoroughly
- Document non-obvious logic

### DON'T
- Make sweeping changes without approval
- Ignore existing patterns
- Add unnecessary dependencies
- Skip testing
- Leave debugging code

## File Handling
- Prefer editing existing files over creating new ones
- Group related functionality together
- Keep imports organized
- Remove unused code

## Error Handling
- Use typed errors where possible
- Provide meaningful error messages
- Log errors appropriately
- Handle edge cases gracefully

## Performance Considerations
- Avoid premature optimization
- Profile before optimizing
- Consider memory usage
- Minimize network requests
`;
}

export function generateDatabaseMd(config: ProjectConfig): string {
    return `# Database Architecture

## Database System
- **Type**: ${config.database || 'Not specified'}
- **Version**: Specify version

## Schema Design

### Core Entities
Define your core database entities here:

\`\`\`
┌──────────────┐     ┌──────────────┐
│    Users     │────▶│   Sessions   │
└──────────────┘     └──────────────┘
       │
       ▼
┌──────────────┐
│   [Entity]   │
└──────────────┘
\`\`\`

## Tables/Collections

### users
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| email | VARCHAR | UNIQUE, NOT NULL |
| created_at | TIMESTAMP | DEFAULT NOW() |

## Indexes
- Define indexes for frequently queried columns
- Consider composite indexes for common query patterns

## Migrations
- Use versioned migrations
- Always include rollback scripts
- Test migrations on staging first

## Backup Strategy
- Regular automated backups
- Point-in-time recovery
- Backup retention policy

## Security
- Encrypt sensitive data
- Use parameterized queries
- Implement row-level security where needed
`;
}

export function generateApiMd(config: ProjectConfig): string {
    const isGraphQL = config.apiStyle?.toLowerCase() === 'graphql';

    if (isGraphQL) {
        return `# API Documentation

## API Style
GraphQL

## Endpoint
\`\`\`
POST /graphql
\`\`\`

## Schema

### Types
\`\`\`graphql
type User {
  id: ID!
  email: String!
  createdAt: DateTime!
}

type Query {
  user(id: ID!): User
  users: [User!]!
}

type Mutation {
  createUser(input: CreateUserInput!): User!
  updateUser(id: ID!, input: UpdateUserInput!): User!
  deleteUser(id: ID!): Boolean!
}
\`\`\`

## Authentication
- Include JWT token in Authorization header
- \`Authorization: Bearer <token>\`

## Error Handling
\`\`\`json
{
  "errors": [
    {
      "message": "Error description",
      "extensions": {
        "code": "ERROR_CODE"
      }
    }
  ]
}
\`\`\`
`;
    }

    return `# API Documentation

## API Style
REST

## Base URL
\`\`\`
${config.hostingPlatform ? `https://api.your-domain.com` : '/api'}
\`\`\`

## Authentication
- Include JWT token in Authorization header
- \`Authorization: Bearer <token>\`

## Endpoints

### Users

#### GET /api/users
Get all users

**Response**
\`\`\`json
{
  "data": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
\`\`\`

#### POST /api/users
Create a new user

**Request**
\`\`\`json
{
  "email": "user@example.com",
  "password": "secure_password"
}
\`\`\`

#### GET /api/users/:id
Get user by ID

#### PUT /api/users/:id
Update user

#### DELETE /api/users/:id
Delete user

## Error Responses
\`\`\`json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
\`\`\`

## Status Codes
- 200: Success
- 201: Created
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 500: Internal Server Error
`;
}

export function generateRoadmapMd(config: ProjectConfig): string {
    return `# Project Roadmap

## Current Phase
**MVP Development**

## Milestones

### Phase 1: Foundation
- [ ] Project setup and configuration
- [ ] Core architecture implementation
- [ ] Database schema design
- [ ] Authentication system
- [ ] Basic API endpoints

### Phase 2: MVP Features
${config.mvpFeatures ? config.mvpFeatures.map(f => `- [ ] ${f}`).join('\n') : '- [ ] Define MVP features'}

### Phase 3: Polish
- [ ] Error handling improvements
- [ ] Performance optimization
- [ ] Security audit
- [ ] Documentation completion
- [ ] Testing coverage

### Phase 4: Launch
- [ ] Staging deployment
- [ ] User acceptance testing
- [ ] Production deployment
- [ ] Monitoring setup

## Future Enhancements
- Feature expansion based on user feedback
- Performance optimizations
- Additional integrations

## Technical Debt
Track technical debt items here:
- [ ] None identified yet

## Decision Log
| Date | Decision | Rationale |
|------|----------|-----------|
| ${new Date().toISOString().split('T')[0]} | Project initialized | Starting fresh |
`;
}

export function generateDocsOverviewMd(config: ProjectConfig): string {
    return `# ${config.projectName} - Documentation

## Quick Start

### Prerequisites
- Node.js (v18+)
- ${config.database || 'Database'} setup
- Environment variables configured

### Installation
\`\`\`bash
# Clone the repository
git clone <repository-url>

# Install dependencies
npm install

# Setup environment
cp .env.example .env

# Run development server
npm run dev
\`\`\`

## Project Structure
\`\`\`
├── project-brain/      # AI context files
├── docs/               # Documentation
├── src/                # Source code
├── tests/              # Test files
└── README.md
\`\`\`

## Key Concepts
- ${config.projectDescription || 'Project description'}
- Target users: ${config.targetUsers || 'Define target users'}

## Contributing
1. Read the architecture docs
2. Follow coding standards
3. Write tests for new features
4. Submit PR with clear description
`;
}

export function generateDocsDecisionsMd(): string {
    return `# Architectural Decisions

This document records significant architectural decisions made during development.

## Template

### ADR-XXX: Title

**Date**: YYYY-MM-DD

**Status**: Proposed | Accepted | Deprecated | Superseded

**Context**: What is the issue that we're seeing that is motivating this decision?

**Decision**: What is the change that we're proposing and/or doing?

**Consequences**: What becomes easier or more difficult to do because of this change?

---

## Decisions

### ADR-001: Project Brain Architecture

**Date**: ${new Date().toISOString().split('T')[0]}

**Status**: Accepted

**Context**: Need a structured way to provide AI agents with project context.

**Decision**: Implement modular markdown files imported into a central CLAUDE.md.

**Consequences**:
- Easier to maintain individual sections
- Clear separation of concerns
- AI agents get comprehensive context
`;
}
