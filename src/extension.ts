import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// Tree Data Provider for sidebar
class BrainTreeProvider implements vscode.TreeDataProvider<BrainItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<BrainItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(private workspaceRoot: string | undefined) {}

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: BrainItem): vscode.TreeItem {
        return element;
    }

    getChildren(): BrainItem[] {
        if (!this.workspaceRoot) {
            return [new BrainItem('Open a folder first', '', vscode.TreeItemCollapsibleState.None, 'info')];
        }

        const claudeMdPath = path.join(this.workspaceRoot, 'CLAUDE.md');
        const brainExists = fs.existsSync(claudeMdPath);

        if (!brainExists) {
            return [
                new BrainItem('No Brain Found', '', vscode.TreeItemCollapsibleState.None, 'warning'),
                new BrainItem('Click to Initialize', 'projectBrain.init', vscode.TreeItemCollapsibleState.None, 'add')
            ];
        }

        // Brain exists - show files
        const items: BrainItem[] = [
            new BrainItem('CLAUDE.md', 'CLAUDE.md', vscode.TreeItemCollapsibleState.None, 'file'),
        ];

        const brainDir = path.join(this.workspaceRoot, 'project-brain');
        if (fs.existsSync(brainDir)) {
            const files = ['product.md', 'architecture.md', 'stack.md', 'coding-standards.md', 'agent-rules.md', 'database.md', 'api.md', 'roadmap.md'];
            for (const file of files) {
                if (fs.existsSync(path.join(brainDir, file))) {
                    items.push(new BrainItem(file, `project-brain/${file}`, vscode.TreeItemCollapsibleState.None, 'file'));
                }
            }
        }

        return items;
    }
}

class BrainItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        private filePath: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        private itemType: 'file' | 'info' | 'warning' | 'add'
    ) {
        super(label, collapsibleState);

        if (itemType === 'file' && filePath) {
            this.command = {
                command: 'projectBrain.openFile',
                title: 'Open File',
                arguments: [filePath]
            };
            this.iconPath = new vscode.ThemeIcon('file');
        } else if (itemType === 'add') {
            this.command = {
                command: 'projectBrain.init',
                title: 'Initialize'
            };
            this.iconPath = new vscode.ThemeIcon('add');
        } else if (itemType === 'warning') {
            this.iconPath = new vscode.ThemeIcon('warning');
        } else {
            this.iconPath = new vscode.ThemeIcon('info');
        }
    }
}

// Templates
function getClaudeMdTemplate(config: ProjectConfig): string {
    return `# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**${config.name}** - ${config.description}

## Tech Stack

- Frontend: ${config.frontend || 'Not specified'}
- Backend: ${config.backend || 'Not specified'}
- Database: ${config.database || 'Not specified'}

## Build Commands

\`\`\`bash
# Add your build commands here
npm install
npm run dev
\`\`\`

## Architecture

See [architecture.md](./project-brain/architecture.md) for detailed system design.

## Coding Standards

See [coding-standards.md](./project-brain/coding-standards.md) for conventions.
`;
}

function getProductMdTemplate(config: ProjectConfig): string {
    return `# Product Overview

## Project Name
${config.name}

## Description
${config.description}

## Target Users
${config.targetUsers || 'Define your target users'}

## Key Features
- Feature 1
- Feature 2
- Feature 3
`;
}

function getArchitectureMdTemplate(config: ProjectConfig): string {
    return `# Architecture

## Overview

${config.name} follows a ${config.backend ? config.backend + ' backend' : 'standard'} architecture.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | ${config.frontend || 'TBD'} |
| Backend | ${config.backend || 'TBD'} |
| Database | ${config.database || 'TBD'} |

## Directory Structure

\`\`\`
src/
├── components/
├── services/
├── utils/
└── types/
\`\`\`
`;
}

function getStackMdTemplate(config: ProjectConfig): string {
    return `# Technology Stack

## Frontend
- Framework: ${config.frontend || 'Not specified'}

## Backend
- Framework: ${config.backend || 'Not specified'}

## Database
- Database: ${config.database || 'Not specified'}

## Development Tools
- Package Manager: npm/yarn
- Linting: ESLint
- Testing: Jest
`;
}

function getCodingStandardsMdTemplate(): string {
    return `# Coding Standards

## Naming Conventions

- Variables: camelCase
- Functions: camelCase
- Classes: PascalCase
- Constants: UPPER_SNAKE_CASE
- Files: kebab-case

## Code Style

- Use 2 space indentation
- Use single quotes for strings
- Add trailing commas
- Maximum line length: 100 characters

## Best Practices

- Write self-documenting code
- Keep functions small and focused
- Handle errors appropriately
- Write tests for critical paths
`;
}

function getAgentRulesMdTemplate(): string {
    return `# Agent Development Rules

## Workflow

1. **Understand** - Read existing code before modifying
2. **Plan** - Break down tasks into small steps
3. **Implement** - Write clean, focused code
4. **Test** - Verify changes work correctly
5. **Document** - Update docs if needed

## Do's

- Follow existing code patterns
- Keep changes minimal and focused
- Test your changes
- Ask for clarification when needed

## Don'ts

- Don't make sweeping changes
- Don't ignore existing patterns
- Don't skip testing
- Don't add unnecessary dependencies
`;
}

interface ProjectConfig {
    name: string;
    description: string;
    frontend?: string;
    backend?: string;
    database?: string;
    targetUsers?: string;
}

// Auto-detect project stack
async function detectStack(workspaceRoot: string): Promise<Partial<ProjectConfig>> {
    const config: Partial<ProjectConfig> = {};

    try {
        const packageJsonPath = path.join(workspaceRoot, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            const deps = { ...pkg.dependencies, ...pkg.devDependencies };

            config.name = pkg.name || path.basename(workspaceRoot);
            config.description = pkg.description || '';

            // Detect frontend
            if (deps['next']) { config.frontend = 'Next.js'; }
            else if (deps['react']) { config.frontend = 'React'; }
            else if (deps['vue']) { config.frontend = 'Vue.js'; }
            else if (deps['@angular/core']) { config.frontend = 'Angular'; }
            else if (deps['svelte']) { config.frontend = 'Svelte'; }

            // Detect backend
            if (deps['express']) { config.backend = 'Express.js'; }
            else if (deps['@nestjs/core']) { config.backend = 'NestJS'; }
            else if (deps['fastify']) { config.backend = 'Fastify'; }
            else if (deps['koa']) { config.backend = 'Koa'; }

            // Detect database
            if (deps['mongoose'] || deps['mongodb']) { config.database = 'MongoDB'; }
            else if (deps['pg'] || deps['postgres']) { config.database = 'PostgreSQL'; }
            else if (deps['mysql2'] || deps['mysql']) { config.database = 'MySQL'; }
            else if (deps['@prisma/client']) { config.database = 'Prisma'; }
            else if (deps['sqlite3']) { config.database = 'SQLite'; }
        }

        // Check for Python
        const requirementsPath = path.join(workspaceRoot, 'requirements.txt');
        if (fs.existsSync(requirementsPath)) {
            const content = fs.readFileSync(requirementsPath, 'utf8').toLowerCase();
            if (content.includes('fastapi')) { config.backend = 'FastAPI'; }
            else if (content.includes('django')) { config.backend = 'Django'; }
            else if (content.includes('flask')) { config.backend = 'Flask'; }
        }
    } catch (e) {
        // Ignore errors
    }

    return config;
}

// Generate brain files
async function generateBrain(workspaceRoot: string, config: ProjectConfig): Promise<void> {
    const brainDir = path.join(workspaceRoot, 'project-brain');
    const docsDir = path.join(workspaceRoot, 'docs');

    // Create directories
    if (!fs.existsSync(brainDir)) { fs.mkdirSync(brainDir, { recursive: true }); }
    if (!fs.existsSync(docsDir)) { fs.mkdirSync(docsDir, { recursive: true }); }

    // Generate files
    const files: [string, string][] = [
        [path.join(workspaceRoot, 'CLAUDE.md'), getClaudeMdTemplate(config)],
        [path.join(brainDir, 'product.md'), getProductMdTemplate(config)],
        [path.join(brainDir, 'architecture.md'), getArchitectureMdTemplate(config)],
        [path.join(brainDir, 'stack.md'), getStackMdTemplate(config)],
        [path.join(brainDir, 'coding-standards.md'), getCodingStandardsMdTemplate()],
        [path.join(brainDir, 'agent-rules.md'), getAgentRulesMdTemplate()],
    ];

    for (const [filePath, content] of files) {
        fs.writeFileSync(filePath, content, 'utf8');
    }
}

// Extension activation
export function activate(context: vscode.ExtensionContext) {
    console.log('Project Brain activating...');

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    // Create tree view
    const treeProvider = new BrainTreeProvider(workspaceRoot);
    vscode.window.createTreeView('projectBrainTree', { treeDataProvider: treeProvider });

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('projectBrain.init', async () => {
            const folder = vscode.workspace.workspaceFolders?.[0];
            if (!folder) {
                vscode.window.showWarningMessage('Please open a folder first.');
                return;
            }

            const name = await vscode.window.showInputBox({
                prompt: 'Project Name',
                value: path.basename(folder.uri.fsPath)
            });
            if (!name) { return; }

            const description = await vscode.window.showInputBox({
                prompt: 'Project Description',
                placeHolder: 'A brief description of your project'
            });

            const frontend = await vscode.window.showQuickPick(
                ['React', 'Next.js', 'Vue.js', 'Angular', 'Svelte', 'None/Other'],
                { placeHolder: 'Frontend Framework' }
            );

            const backend = await vscode.window.showQuickPick(
                ['Express.js', 'NestJS', 'FastAPI', 'Django', 'Flask', 'None/Other'],
                { placeHolder: 'Backend Framework' }
            );

            const database = await vscode.window.showQuickPick(
                ['PostgreSQL', 'MongoDB', 'MySQL', 'SQLite', 'None/Other'],
                { placeHolder: 'Database' }
            );

            const config: ProjectConfig = {
                name,
                description: description || '',
                frontend: frontend === 'None/Other' ? undefined : frontend,
                backend: backend === 'None/Other' ? undefined : backend,
                database: database === 'None/Other' ? undefined : database
            };

            await generateBrain(folder.uri.fsPath, config);
            treeProvider.refresh();
            vscode.window.showInformationMessage('Project Brain initialized!');

            // Open CLAUDE.md
            const claudeMd = vscode.Uri.file(path.join(folder.uri.fsPath, 'CLAUDE.md'));
            vscode.window.showTextDocument(claudeMd);
        }),

        vscode.commands.registerCommand('projectBrain.quickInit', async () => {
            const folder = vscode.workspace.workspaceFolders?.[0];
            if (!folder) {
                vscode.window.showWarningMessage('Please open a folder first.');
                return;
            }

            const detected = await detectStack(folder.uri.fsPath);
            const config: ProjectConfig = {
                name: detected.name || path.basename(folder.uri.fsPath),
                description: detected.description || 'Project description',
                frontend: detected.frontend,
                backend: detected.backend,
                database: detected.database
            };

            await generateBrain(folder.uri.fsPath, config);
            treeProvider.refresh();
            vscode.window.showInformationMessage('Project Brain initialized with auto-detected settings!');

            // Open CLAUDE.md
            const claudeMd = vscode.Uri.file(path.join(folder.uri.fsPath, 'CLAUDE.md'));
            vscode.window.showTextDocument(claudeMd);
        }),

        vscode.commands.registerCommand('projectBrain.openFile', (filePath: string) => {
            const folder = vscode.workspace.workspaceFolders?.[0];
            if (!folder) { return; }

            const fullPath = path.join(folder.uri.fsPath, filePath);
            if (fs.existsSync(fullPath)) {
                vscode.window.showTextDocument(vscode.Uri.file(fullPath));
            }
        })
    );

    // Watch for file changes
    const watcher = vscode.workspace.createFileSystemWatcher('**/CLAUDE.md');
    watcher.onDidCreate(() => treeProvider.refresh());
    watcher.onDidDelete(() => treeProvider.refresh());
    watcher.onDidChange(() => treeProvider.refresh());
    context.subscriptions.push(watcher);

    console.log('Project Brain activated!');
    vscode.window.showInformationMessage('Project Brain ready!');
}

export function deactivate() {}
