import * as vscode from 'vscode';
import * as path from 'path';
import { DetectedStack, StackType } from './types';

interface PackageJson {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    scripts?: Record<string, string>;
}

interface RequirementsTxt {
    packages: string[];
}

export class StackDetector {
    private workspaceRoot: string;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
    }

    async detect(): Promise<DetectedStack> {
        const result: DetectedStack = {
            type: 'unknown',
            confidence: 0
        };

        // Check for different project types
        const [packageJson, requirementsTxt, pyprojectToml] = await Promise.all([
            this.readPackageJson(),
            this.readRequirementsTxt(),
            this.fileExists('pyproject.toml')
        ]);

        if (packageJson) {
            return this.analyzeNodeProject(packageJson);
        }

        if (requirementsTxt || pyprojectToml) {
            return this.analyzePythonProject(requirementsTxt);
        }

        // Check for other indicators
        const files = await this.getWorkspaceFiles();
        return this.analyzeByFiles(files);
    }

    private async readPackageJson(): Promise<PackageJson | null> {
        try {
            const packagePath = path.join(this.workspaceRoot, 'package.json');
            const uri = vscode.Uri.file(packagePath);
            const content = await vscode.workspace.fs.readFile(uri);
            return JSON.parse(content.toString());
        } catch {
            return null;
        }
    }

    private async readRequirementsTxt(): Promise<RequirementsTxt | null> {
        try {
            const reqPath = path.join(this.workspaceRoot, 'requirements.txt');
            const uri = vscode.Uri.file(reqPath);
            const content = await vscode.workspace.fs.readFile(uri);
            const packages = content.toString()
                .split('\n')
                .filter(line => line.trim() && !line.startsWith('#'))
                .map(line => line.split('==')[0].split('>=')[0].trim().toLowerCase());
            return { packages };
        } catch {
            return null;
        }
    }

    private async fileExists(filename: string): Promise<boolean> {
        try {
            const filePath = path.join(this.workspaceRoot, filename);
            const uri = vscode.Uri.file(filePath);
            await vscode.workspace.fs.stat(uri);
            return true;
        } catch {
            return false;
        }
    }

    private async getWorkspaceFiles(): Promise<string[]> {
        try {
            const pattern = new vscode.RelativePattern(this.workspaceRoot, '**/*');
            const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**', 100);
            return files.map(f => path.basename(f.fsPath));
        } catch {
            return [];
        }
    }

    private analyzeNodeProject(pkg: PackageJson): DetectedStack {
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        const result: DetectedStack = {
            type: 'nodejs',
            confidence: 0.7,
            packageManager: this.detectPackageManager()
        };

        // Detect Next.js
        if (deps['next']) {
            result.type = 'nextjs';
            result.frontend = 'Next.js';
            result.backend = 'Next.js API Routes';
            result.confidence = 0.95;
        }
        // Detect React
        else if (deps['react'] || deps['react-dom']) {
            result.type = 'react';
            result.frontend = 'React';
            result.confidence = 0.9;
        }
        // Detect Vue
        else if (deps['vue']) {
            result.type = 'vue';
            result.frontend = 'Vue.js';
            result.confidence = 0.9;
        }
        // Detect Angular
        else if (deps['@angular/core']) {
            result.type = 'angular';
            result.frontend = 'Angular';
            result.confidence = 0.9;
        }

        // Detect backend frameworks
        if (deps['express']) {
            result.type = result.type === 'nodejs' ? 'express' : result.type;
            result.backend = 'Express.js';
            result.confidence = Math.max(result.confidence, 0.85);
        }
        if (deps['@nestjs/core']) {
            result.type = 'nestjs';
            result.backend = 'NestJS';
            result.confidence = 0.95;
        }
        if (deps['fastify']) {
            result.backend = 'Fastify';
            result.confidence = Math.max(result.confidence, 0.85);
        }

        // Detect databases
        if (deps['mongoose'] || deps['mongodb']) {
            result.database = 'MongoDB';
        } else if (deps['pg'] || deps['postgres']) {
            result.database = 'PostgreSQL';
        } else if (deps['mysql2'] || deps['mysql']) {
            result.database = 'MySQL';
        } else if (deps['prisma'] || deps['@prisma/client']) {
            result.database = 'Prisma (ORM)';
        } else if (deps['sequelize']) {
            result.database = 'Sequelize (ORM)';
        } else if (deps['better-sqlite3'] || deps['sqlite3']) {
            result.database = 'SQLite';
        }

        return result;
    }

    private analyzePythonProject(requirements: RequirementsTxt | null): DetectedStack {
        const result: DetectedStack = {
            type: 'python',
            confidence: 0.7
        };

        if (!requirements) {
            return result;
        }

        const packages = requirements.packages;

        // Detect FastAPI
        if (packages.includes('fastapi')) {
            result.type = 'fastapi';
            result.backend = 'FastAPI';
            result.confidence = 0.95;
        }
        // Detect Django
        else if (packages.includes('django')) {
            result.type = 'django';
            result.backend = 'Django';
            result.frontend = 'Django Templates';
            result.confidence = 0.95;
        }
        // Detect Flask
        else if (packages.includes('flask')) {
            result.type = 'flask';
            result.backend = 'Flask';
            result.confidence = 0.9;
        }

        // Detect databases
        if (packages.includes('psycopg2') || packages.includes('asyncpg')) {
            result.database = 'PostgreSQL';
        } else if (packages.includes('pymongo') || packages.includes('motor')) {
            result.database = 'MongoDB';
        } else if (packages.includes('mysql-connector-python') || packages.includes('pymysql')) {
            result.database = 'MySQL';
        } else if (packages.includes('sqlalchemy')) {
            result.database = 'SQLAlchemy (ORM)';
        }

        return result;
    }

    private analyzeByFiles(files: string[]): DetectedStack {
        const result: DetectedStack = {
            type: 'unknown',
            confidence: 0.3
        };

        // Check for common file patterns
        if (files.some(f => f.endsWith('.tsx') || f.endsWith('.jsx'))) {
            result.frontend = 'React';
            result.type = 'react';
            result.confidence = 0.5;
        }
        if (files.some(f => f.endsWith('.vue'))) {
            result.frontend = 'Vue.js';
            result.type = 'vue';
            result.confidence = 0.5;
        }
        if (files.some(f => f === 'next.config.js' || f === 'next.config.mjs')) {
            result.type = 'nextjs';
            result.frontend = 'Next.js';
            result.confidence = 0.8;
        }
        if (files.some(f => f === 'manage.py')) {
            result.type = 'django';
            result.backend = 'Django';
            result.confidence = 0.8;
        }

        return result;
    }

    private detectPackageManager(): string {
        // This is a simplified detection - in production you'd check for lock files
        return 'npm';
    }

    static getStackSuggestions(detected: DetectedStack): Partial<{
        frontend: string;
        backend: string;
        database: string;
    }> {
        return {
            frontend: detected.frontend,
            backend: detected.backend,
            database: detected.database
        };
    }
}
