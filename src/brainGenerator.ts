import * as vscode from 'vscode';
import * as path from 'path';
import { ProjectConfig, BrainStatus } from './types';
import {
    generateClaudeMd,
    generateProductMd,
    generateArchitectureMd,
    generateStackMd,
    generateCodingStandardsMd,
    generateAgentRulesMd,
    generateDatabaseMd,
    generateApiMd,
    generateRoadmapMd,
    generateDocsOverviewMd,
    generateDocsDecisionsMd
} from './templates';

export class BrainGenerator {
    private workspaceRoot: string;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
    }

    async checkStatus(): Promise<BrainStatus> {
        const status: BrainStatus = {
            initialized: false,
            files: {
                claudeMd: false,
                productMd: false,
                architectureMd: false,
                stackMd: false,
                codingStandardsMd: false,
                agentRulesMd: false,
                databaseMd: false,
                apiMd: false,
                roadmapMd: false
            },
            lastUpdated: null
        };

        const fileChecks = [
            { key: 'claudeMd', path: 'CLAUDE.md' },
            { key: 'productMd', path: 'project-brain/product.md' },
            { key: 'architectureMd', path: 'project-brain/architecture.md' },
            { key: 'stackMd', path: 'project-brain/stack.md' },
            { key: 'codingStandardsMd', path: 'project-brain/coding-standards.md' },
            { key: 'agentRulesMd', path: 'project-brain/agent-rules.md' },
            { key: 'databaseMd', path: 'project-brain/database.md' },
            { key: 'apiMd', path: 'project-brain/api.md' },
            { key: 'roadmapMd', path: 'project-brain/roadmap.md' }
        ];

        let latestModified: Date | null = null;

        for (const check of fileChecks) {
            const filePath = path.join(this.workspaceRoot, check.path);
            try {
                const uri = vscode.Uri.file(filePath);
                const stat = await vscode.workspace.fs.stat(uri);
                status.files[check.key as keyof typeof status.files] = true;

                const modified = new Date(stat.mtime);
                if (!latestModified || modified > latestModified) {
                    latestModified = modified;
                }
            } catch {
                // File doesn't exist
            }
        }

        status.lastUpdated = latestModified;
        status.initialized = status.files.claudeMd &&
                            status.files.architectureMd &&
                            status.files.productMd;

        return status;
    }

    async generate(config: ProjectConfig): Promise<void> {
        // Create directories
        await this.ensureDirectory('project-brain');
        await this.ensureDirectory('docs');

        // Generate all files
        const files = [
            { path: 'CLAUDE.md', content: generateClaudeMd(config) },
            { path: 'project-brain/product.md', content: generateProductMd(config) },
            { path: 'project-brain/architecture.md', content: generateArchitectureMd(config) },
            { path: 'project-brain/stack.md', content: generateStackMd(config) },
            { path: 'project-brain/coding-standards.md', content: generateCodingStandardsMd(config) },
            { path: 'project-brain/agent-rules.md', content: generateAgentRulesMd(config) },
            { path: 'project-brain/database.md', content: generateDatabaseMd(config) },
            { path: 'project-brain/api.md', content: generateApiMd(config) },
            { path: 'project-brain/roadmap.md', content: generateRoadmapMd(config) },
            { path: 'docs/overview.md', content: generateDocsOverviewMd(config) },
            { path: 'docs/decisions.md', content: generateDocsDecisionsMd() }
        ];

        for (const file of files) {
            await this.writeFile(file.path, file.content);
        }

        vscode.window.showInformationMessage('Project Brain initialized successfully!');
    }

    async regenerateClaudeMd(config: ProjectConfig): Promise<void> {
        const content = generateClaudeMd(config);
        await this.writeFile('CLAUDE.md', content);
        vscode.window.showInformationMessage('CLAUDE.md regenerated successfully!');
    }

    async updateFile(relativePath: string, content: string): Promise<void> {
        await this.writeFile(relativePath, content);
    }

    async readConfig(): Promise<ProjectConfig | null> {
        try {
            const configPath = path.join(this.workspaceRoot, '.project-brain.json');
            const uri = vscode.Uri.file(configPath);
            const content = await vscode.workspace.fs.readFile(uri);
            return JSON.parse(content.toString());
        } catch {
            return null;
        }
    }

    async saveConfig(config: ProjectConfig): Promise<void> {
        const configPath = path.join(this.workspaceRoot, '.project-brain.json');
        const uri = vscode.Uri.file(configPath);
        const content = JSON.stringify(config, null, 2);
        await vscode.workspace.fs.writeFile(uri, Buffer.from(content));
    }

    private async ensureDirectory(relativePath: string): Promise<void> {
        const dirPath = path.join(this.workspaceRoot, relativePath);
        const uri = vscode.Uri.file(dirPath);
        try {
            await vscode.workspace.fs.createDirectory(uri);
        } catch {
            // Directory might already exist
        }
    }

    private async writeFile(relativePath: string, content: string): Promise<void> {
        const filePath = path.join(this.workspaceRoot, relativePath);
        const uri = vscode.Uri.file(filePath);
        await vscode.workspace.fs.writeFile(uri, Buffer.from(content));
    }

    async getExistingFileContent(relativePath: string): Promise<string | null> {
        try {
            const filePath = path.join(this.workspaceRoot, relativePath);
            const uri = vscode.Uri.file(filePath);
            const content = await vscode.workspace.fs.readFile(uri);
            return content.toString();
        } catch {
            return null;
        }
    }
}
