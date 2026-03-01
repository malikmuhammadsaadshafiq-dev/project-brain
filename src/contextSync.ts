import * as vscode from 'vscode';
import * as path from 'path';
import { FileChange } from './types';

export class ContextSync {
    private workspaceRoot: string;
    private fileWatcher: vscode.FileSystemWatcher | undefined;
    private debounceTimer: NodeJS.Timeout | undefined;
    private pendingChanges: FileChange[] = [];

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
    }

    startWatching(onSync: (changes: FileChange[]) => void): void {
        // Watch for file changes in the workspace
        const pattern = new vscode.RelativePattern(this.workspaceRoot, '**/*');
        this.fileWatcher = vscode.workspace.createFileSystemWatcher(
            pattern,
            false, // Don't ignore creates
            false, // Don't ignore changes
            false  // Don't ignore deletes
        );

        this.fileWatcher.onDidCreate(uri => {
            this.queueChange({ path: uri.fsPath, type: 'created' }, onSync);
        });

        this.fileWatcher.onDidChange(uri => {
            this.queueChange({ path: uri.fsPath, type: 'modified' }, onSync);
        });

        this.fileWatcher.onDidDelete(uri => {
            this.queueChange({ path: uri.fsPath, type: 'deleted' }, onSync);
        });
    }

    stopWatching(): void {
        if (this.fileWatcher) {
            this.fileWatcher.dispose();
            this.fileWatcher = undefined;
        }
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
    }

    private queueChange(change: FileChange, onSync: (changes: FileChange[]) => void): void {
        // Ignore node_modules, .git, and other common directories
        const ignoredPaths = ['node_modules', '.git', 'dist', 'out', '.next', '__pycache__', '.venv', 'venv'];
        const relativePath = path.relative(this.workspaceRoot, change.path);

        if (ignoredPaths.some(ignored => relativePath.startsWith(ignored))) {
            return;
        }

        this.pendingChanges.push(change);

        // Debounce to avoid too many syncs
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        this.debounceTimer = setTimeout(() => {
            const changes = [...this.pendingChanges];
            this.pendingChanges = [];
            onSync(changes);
        }, 1000);
    }

    async syncClaudeMdImports(): Promise<void> {
        const claudeMdPath = path.join(this.workspaceRoot, 'CLAUDE.md');

        try {
            const uri = vscode.Uri.file(claudeMdPath);
            const content = await vscode.workspace.fs.readFile(uri);
            const currentContent = content.toString();

            // Get all files in project-brain directory
            const brainFiles = await this.getBrainFiles();
            const newContent = this.updateImports(currentContent, brainFiles);

            if (newContent !== currentContent) {
                await vscode.workspace.fs.writeFile(uri, Buffer.from(newContent));
                vscode.window.showInformationMessage('CLAUDE.md imports updated');
            }
        } catch (error) {
            // CLAUDE.md doesn't exist yet
            console.log('CLAUDE.md not found, skipping import sync');
        }
    }

    private async getBrainFiles(): Promise<string[]> {
        const brainDir = path.join(this.workspaceRoot, 'project-brain');
        const files: string[] = [];

        try {
            const uri = vscode.Uri.file(brainDir);
            const entries = await vscode.workspace.fs.readDirectory(uri);

            for (const [name, type] of entries) {
                if (type === vscode.FileType.File && name.endsWith('.md')) {
                    files.push(name);
                }
            }
        } catch {
            // Directory doesn't exist
        }

        return files;
    }

    private updateImports(content: string, brainFiles: string[]): string {
        const lines = content.split('\n');
        const importSection: string[] = [];
        const otherLines: string[] = [];
        let inImportSection = false;

        for (const line of lines) {
            if (line.startsWith('@import ./project-brain/')) {
                inImportSection = true;
                // Skip existing import, we'll regenerate
            } else if (inImportSection && line.trim() === '') {
                // End of import section
                inImportSection = false;
                otherLines.push(line);
            } else {
                otherLines.push(line);
            }
        }

        // Generate new imports
        const expectedFiles = [
            'product.md',
            'architecture.md',
            'stack.md',
            'coding-standards.md',
            'agent-rules.md',
            'database.md',
            'api.md',
            'roadmap.md'
        ];

        for (const file of expectedFiles) {
            if (brainFiles.includes(file)) {
                importSection.push(`@import ./project-brain/${file}`);
            }
        }

        // Add any additional files not in the expected list
        for (const file of brainFiles) {
            if (!expectedFiles.includes(file)) {
                importSection.push(`@import ./project-brain/${file}`);
            }
        }

        // Find where to insert imports (after the header)
        const headerIndex = otherLines.findIndex(line =>
            line.startsWith('# Project Brain') || line.startsWith('# CLAUDE.md')
        );

        if (headerIndex >= 0) {
            // Insert imports after header
            const beforeHeader = otherLines.slice(0, headerIndex + 1);
            const afterHeader = otherLines.slice(headerIndex + 1);

            // Remove any existing empty lines at the start of afterHeader
            while (afterHeader.length > 0 && afterHeader[0].trim() === '') {
                afterHeader.shift();
            }

            return [
                ...beforeHeader,
                '',
                ...importSection,
                '',
                ...afterHeader
            ].join('\n');
        }

        // If no header found, just prepend imports
        return [...importSection, '', ...otherLines].join('\n');
    }

    async checkForNewFiles(): Promise<string[]> {
        const newFiles: string[] = [];
        const brainDir = path.join(this.workspaceRoot, 'project-brain');

        try {
            const uri = vscode.Uri.file(brainDir);
            const entries = await vscode.workspace.fs.readDirectory(uri);

            const expectedFiles = [
                'product.md',
                'architecture.md',
                'stack.md',
                'coding-standards.md',
                'agent-rules.md',
                'database.md',
                'api.md',
                'roadmap.md'
            ];

            for (const [name] of entries) {
                if (name.endsWith('.md') && !expectedFiles.includes(name)) {
                    newFiles.push(name);
                }
            }
        } catch {
            // Directory doesn't exist
        }

        return newFiles;
    }
}
