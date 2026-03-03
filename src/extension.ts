import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// 🔬 LIVE CODEBASE SCANNER - Analyzes actual code structure
// ============================================================

interface CodebaseAnalysis {
    totalFiles: number;
    totalLines: number;
    languages: Record<string, number>;
    directories: string[];
    exports: string[];
    imports: string[];
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
    scripts: Record<string, string>;
    entryPoints: string[];
    envVars: string[];
    apiRoutes: string[];
    components: string[];
    hasTests: boolean;
    testFramework: string;
    packageManager: string;
    gitBranch: string;
}

const IGNORE_DIRS = new Set([
    'node_modules', '.git', 'dist', 'build', 'out', '.next', '.nuxt',
    '__pycache__', '.vscode', '.idea', 'coverage', '.cache', 'vendor',
    '.turbo', '.vercel', '.netlify', 'project-brain', '.project-brain'
]);

const CODE_EXTENSIONS: Record<string, string> = {
    '.ts': 'TypeScript', '.tsx': 'TypeScript React', '.js': 'JavaScript',
    '.jsx': 'JavaScript React', '.py': 'Python', '.rs': 'Rust',
    '.go': 'Go', '.java': 'Java', '.rb': 'Ruby', '.php': 'PHP',
    '.cs': 'C#', '.cpp': 'C++', '.c': 'C', '.swift': 'Swift',
    '.kt': 'Kotlin', '.dart': 'Dart', '.vue': 'Vue', '.svelte': 'Svelte',
    '.html': 'HTML', '.css': 'CSS', '.scss': 'SCSS', '.less': 'LESS',
    '.sql': 'SQL', '.graphql': 'GraphQL', '.proto': 'Protocol Buffers',
    '.yaml': 'YAML', '.yml': 'YAML', '.json': 'JSON', '.md': 'Markdown',
    '.sh': 'Shell', '.bash': 'Bash', '.dockerfile': 'Docker',
};

function countLines(filePath: string): number {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        return content.split('\n').length;
    } catch { return 0; }
}

function walkDir(dir: string, maxDepth = 6, currentDepth = 0): string[] {
    if (currentDepth > maxDepth) { return []; }
    const results: string[] = [];
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (IGNORE_DIRS.has(entry.name) || entry.name.startsWith('.')) { continue; }
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                results.push(...walkDir(fullPath, maxDepth, currentDepth + 1));
            } else if (entry.isFile()) {
                results.push(fullPath);
            }
        }
    } catch { /* ignore permission errors */ }
    return results;
}

function extractEnvVars(workspaceRoot: string): string[] {
    const envVars: string[] = [];
    const envFiles = ['.env', '.env.example', '.env.local', '.env.development'];
    for (const envFile of envFiles) {
        const envPath = path.join(workspaceRoot, envFile);
        if (fs.existsSync(envPath)) {
            try {
                const content = fs.readFileSync(envPath, 'utf8');
                const matches = content.match(/^[A-Z_][A-Z0-9_]*(?==)/gm);
                if (matches) { envVars.push(...matches); }
            } catch { /* ignore */ }
        }
    }
    return [...new Set(envVars)];
}

function extractApiRoutes(files: string[], workspaceRoot: string): string[] {
    const routes: string[] = [];
    const routePatterns = [
        /(?:app|router)\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g,
        /@(Get|Post|Put|Patch|Delete)\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
        /path\s*\(\s*['"`]([^'"`]+)['"`]/g,
    ];
    const apiFiles = files.filter(f =>
        f.includes('route') || f.includes('controller') || f.includes('api') ||
        f.includes('endpoint') || f.includes('server')
    );
    for (const file of apiFiles.slice(0, 30)) {
        try {
            const content = fs.readFileSync(file, 'utf8');
            for (const pattern of routePatterns) {
                let match;
                const regex = new RegExp(pattern.source, pattern.flags);
                while ((match = regex.exec(content)) !== null) {
                    const method = match[1]?.toUpperCase() || '';
                    const routePath = match[2] || match[1];
                    routes.push(method ? `${method} ${routePath}` : routePath);
                }
            }
        } catch { /* ignore */ }
    }
    return [...new Set(routes)].slice(0, 50);
}

function extractComponents(files: string[], workspaceRoot: string): string[] {
    const components: string[] = [];
    const componentFiles = files.filter(f => {
        const ext = path.extname(f);
        return ['.tsx', '.jsx', '.vue', '.svelte'].includes(ext);
    });
    for (const file of componentFiles.slice(0, 100)) {
        const relativePath = path.relative(workspaceRoot, file);
        const name = path.basename(file, path.extname(file));
        if (name[0] === name[0]?.toUpperCase() && name !== 'index') {
            components.push(`${name} (${relativePath})`);
        }
    }
    return components.slice(0, 50);
}

function detectTestFramework(deps: Record<string, string>): string {
    if (deps['jest'] || deps['@jest/core']) { return 'Jest'; }
    if (deps['vitest']) { return 'Vitest'; }
    if (deps['mocha']) { return 'Mocha'; }
    if (deps['ava']) { return 'Ava'; }
    if (deps['cypress']) { return 'Cypress'; }
    if (deps['playwright'] || deps['@playwright/test']) { return 'Playwright'; }
    if (deps['pytest']) { return 'Pytest'; }
    return 'None detected';
}

function detectPackageManager(workspaceRoot: string): string {
    if (fs.existsSync(path.join(workspaceRoot, 'pnpm-lock.yaml'))) { return 'pnpm'; }
    if (fs.existsSync(path.join(workspaceRoot, 'yarn.lock'))) { return 'yarn'; }
    if (fs.existsSync(path.join(workspaceRoot, 'bun.lockb'))) { return 'bun'; }
    if (fs.existsSync(path.join(workspaceRoot, 'package-lock.json'))) { return 'npm'; }
    if (fs.existsSync(path.join(workspaceRoot, 'Pipfile.lock'))) { return 'pipenv'; }
    if (fs.existsSync(path.join(workspaceRoot, 'poetry.lock'))) { return 'poetry'; }
    return 'unknown';
}

function getGitBranch(workspaceRoot: string): string {
    try {
        const headPath = path.join(workspaceRoot, '.git', 'HEAD');
        if (fs.existsSync(headPath)) {
            const head = fs.readFileSync(headPath, 'utf8').trim();
            const match = head.match(/ref: refs\/heads\/(.+)/);
            return match ? match[1] : 'detached';
        }
    } catch { /* ignore */ }
    return 'unknown';
}

async function analyzeCodebase(workspaceRoot: string): Promise<CodebaseAnalysis> {
    const files = walkDir(workspaceRoot);
    const languages: Record<string, number> = {};
    let totalLines = 0;
    const directories = new Set<string>();

    for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        const lang = CODE_EXTENSIONS[ext];
        if (lang) {
            languages[lang] = (languages[lang] || 0) + 1;
            totalLines += countLines(file);
        }
        const relDir = path.relative(workspaceRoot, path.dirname(file));
        const topDir = relDir.split(path.sep)[0];
        if (topDir && !topDir.startsWith('.')) {
            directories.add(topDir);
        }
    }

    let dependencies: Record<string, string> = {};
    let devDependencies: Record<string, string> = {};
    let scripts: Record<string, string> = {};
    const pkgPath = path.join(workspaceRoot, 'package.json');
    if (fs.existsSync(pkgPath)) {
        try {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
            dependencies = pkg.dependencies || {};
            devDependencies = pkg.devDependencies || {};
            scripts = pkg.scripts || {};
        } catch { /* ignore parse errors */ }
    }

    const allDeps = { ...dependencies, ...devDependencies };
    const testDirs = files.filter(f =>
        f.includes('test') || f.includes('spec') || f.includes('__tests__')
    );

    return {
        totalFiles: files.length,
        totalLines,
        languages,
        directories: [...directories].sort(),
        exports: [],
        imports: [],
        dependencies,
        devDependencies,
        scripts,
        entryPoints: files.filter(f => {
            const name = path.basename(f);
            return ['index.ts', 'index.js', 'main.ts', 'main.js', 'app.ts', 'app.js',
                'server.ts', 'server.js', 'main.py', 'app.py', 'manage.py'].includes(name);
        }).map(f => path.relative(workspaceRoot, f)),
        envVars: extractEnvVars(workspaceRoot),
        apiRoutes: extractApiRoutes(files, workspaceRoot),
        components: extractComponents(files, workspaceRoot),
        hasTests: testDirs.length > 0,
        testFramework: detectTestFramework(allDeps),
        packageManager: detectPackageManager(workspaceRoot),
        gitBranch: getGitBranch(workspaceRoot),
    };
}


// ============================================================
// 📊 CONTEXT HEALTH SCORE
// ============================================================

interface HealthCheck {
    name: string;
    status: 'pass' | 'warn' | 'fail';
    message: string;
    weight: number;
}

function calculateContextHealth(workspaceRoot: string, analysis: CodebaseAnalysis): { score: number; checks: HealthCheck[] } {
    const checks: HealthCheck[] = [];

    // Check CLAUDE.md exists
    const claudeMdExists = fs.existsSync(path.join(workspaceRoot, 'CLAUDE.md'));
    checks.push({
        name: 'CLAUDE.md',
        status: claudeMdExists ? 'pass' : 'fail',
        message: claudeMdExists ? 'Main context file exists' : 'Missing CLAUDE.md — AI has no entry point',
        weight: 20
    });

    // Check brain directory
    const brainDir = path.join(workspaceRoot, 'project-brain');
    const brainExists = fs.existsSync(brainDir);
    checks.push({
        name: 'Brain Directory',
        status: brainExists ? 'pass' : 'fail',
        message: brainExists ? 'project-brain/ directory exists' : 'Missing project-brain/ directory',
        weight: 10
    });

    // Check individual brain files
    const brainFiles = [
        { file: 'product.md', name: 'Product Overview', weight: 10 },
        { file: 'architecture.md', name: 'Architecture', weight: 15 },
        { file: 'stack.md', name: 'Tech Stack', weight: 10 },
        { file: 'coding-standards.md', name: 'Coding Standards', weight: 10 },
        { file: 'agent-rules.md', name: 'Agent Rules', weight: 10 },
    ];

    for (const bf of brainFiles) {
        const filePath = path.join(brainDir, bf.file);
        const exists = fs.existsSync(filePath);
        let contentScore: 'pass' | 'warn' | 'fail' = 'fail';
        let message = `Missing ${bf.name}`;

        if (exists) {
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n').filter(l => l.trim().length > 0);
            if (lines.length > 10) {
                contentScore = 'pass';
                message = `${bf.name} is well-documented (${lines.length} lines)`;
            } else if (lines.length > 3) {
                contentScore = 'warn';
                message = `${bf.name} exists but is thin (${lines.length} lines) — add more detail`;
            } else {
                contentScore = 'warn';
                message = `${bf.name} is nearly empty — fill it in`;
            }
        }

        checks.push({ name: bf.name, status: contentScore, message, weight: bf.weight });
    }

    // Check if context matches actual code
    if (analysis.apiRoutes.length > 0) {
        const apiDocPath = path.join(brainDir, 'api.md');
        const hasApiDoc = fs.existsSync(apiDocPath);
        checks.push({
            name: 'API Documentation',
            status: hasApiDoc ? 'pass' : 'warn',
            message: hasApiDoc
                ? `API docs exist (${analysis.apiRoutes.length} routes detected in code)`
                : `${analysis.apiRoutes.length} API routes detected but no api.md — AI won't know your endpoints`,
            weight: 15
        });
    }

    // Calculate weighted score
    let totalWeight = 0;
    let earnedWeight = 0;
    for (const check of checks) {
        totalWeight += check.weight;
        if (check.status === 'pass') { earnedWeight += check.weight; }
        else if (check.status === 'warn') { earnedWeight += check.weight * 0.5; }
    }

    return {
        score: Math.round((earnedWeight / totalWeight) * 100),
        checks
    };
}


// ============================================================
// 📋 SMART CONTEXT COPIER
// ============================================================

function generateSmartContext(workspaceRoot: string, analysis: CodebaseAnalysis): string {
    const detected = detectStackSync(workspaceRoot);
    const topLangs = Object.entries(analysis.languages)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([lang, count]) => `${lang} (${count} files)`)
        .join(', ');

    let context = `# Project Context\n\n`;
    context += `## Overview\n`;
    context += `- **Name**: ${detected.name || path.basename(workspaceRoot)}\n`;
    context += `- **Description**: ${detected.description || 'N/A'}\n`;
    context += `- **Git Branch**: ${analysis.gitBranch}\n`;
    context += `- **Package Manager**: ${analysis.packageManager}\n\n`;

    context += `## Codebase Stats\n`;
    context += `- **Files**: ${analysis.totalFiles}\n`;
    context += `- **Lines of Code**: ${analysis.totalLines.toLocaleString()}\n`;
    context += `- **Languages**: ${topLangs}\n\n`;

    context += `## Tech Stack\n`;
    if (detected.frontend) { context += `- **Frontend**: ${detected.frontend}\n`; }
    if (detected.backend) { context += `- **Backend**: ${detected.backend}\n`; }
    if (detected.database) { context += `- **Database**: ${detected.database}\n`; }
    context += `- **Testing**: ${analysis.testFramework}\n\n`;

    context += `## Directory Structure\n\`\`\`\n`;
    for (const dir of analysis.directories.slice(0, 15)) {
        context += `├── ${dir}/\n`;
    }
    context += `\`\`\`\n\n`;

    if (analysis.entryPoints.length > 0) {
        context += `## Entry Points\n`;
        for (const ep of analysis.entryPoints) { context += `- ${ep}\n`; }
        context += `\n`;
    }

    if (analysis.components.length > 0) {
        context += `## Components (${analysis.components.length})\n`;
        for (const comp of analysis.components.slice(0, 20)) { context += `- ${comp}\n`; }
        context += `\n`;
    }

    if (analysis.apiRoutes.length > 0) {
        context += `## API Routes (${analysis.apiRoutes.length})\n`;
        for (const route of analysis.apiRoutes.slice(0, 20)) { context += `- \`${route}\`\n`; }
        context += `\n`;
    }

    if (analysis.envVars.length > 0) {
        context += `## Environment Variables\n`;
        for (const v of analysis.envVars) { context += `- \`${v}\`\n`; }
        context += `\n`;
    }

    const depList = Object.keys(analysis.dependencies);
    if (depList.length > 0) {
        context += `## Key Dependencies\n`;
        for (const dep of depList.slice(0, 20)) {
            context += `- ${dep}: ${analysis.dependencies[dep]}\n`;
        }
        context += `\n`;
    }

    if (Object.keys(analysis.scripts).length > 0) {
        context += `## Available Scripts\n`;
        for (const [name, cmd] of Object.entries(analysis.scripts)) {
            context += `- \`${name}\`: ${cmd}\n`;
        }
    }

    return context;
}


// ============================================================
// 📊 CONTEXT HEALTH DASHBOARD (Webview)
// ============================================================

function getHealthDashboardHtml(score: number, checks: HealthCheck[], analysis: CodebaseAnalysis): string {
    const scoreColor = score >= 80 ? '#00b894' : score >= 50 ? '#fdcb6e' : '#e17055';
    const scoreEmoji = score >= 80 ? '🟢' : score >= 50 ? '🟡' : '🔴';

    const topLangs = Object.entries(analysis.languages)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);

    const langBars = topLangs.map(([lang, count]) => {
        const maxCount = topLangs[0][1];
        const width = Math.max(10, (count / maxCount) * 100);
        return `<div class="lang-row">
            <span class="lang-name">${lang}</span>
            <div class="lang-bar-bg"><div class="lang-bar" style="width:${width}%"></div></div>
            <span class="lang-count">${count}</span>
        </div>`;
    }).join('');

    const checksHtml = checks.map(c => {
        const icon = c.status === 'pass' ? '✅' : c.status === 'warn' ? '⚠️' : '❌';
        const cls = c.status;
        return `<div class="check-row ${cls}">
            <span class="check-icon">${icon}</span>
            <div class="check-info">
                <span class="check-name">${c.name}</span>
                <span class="check-msg">${c.message}</span>
            </div>
        </div>`;
    }).join('');

    return `<!DOCTYPE html>
<html>
<head>
<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        background: #1a1a2e; color: #e0e0e0; padding: 24px;
    }
    .header { text-align: center; margin-bottom: 32px; }
    .header h1 { font-size: 24px; color: #fff; margin-bottom: 4px; }
    .header p { color: #888; font-size: 13px; }
    
    .score-ring {
        width: 160px; height: 160px; margin: 20px auto;
        border-radius: 50%; display: flex; align-items: center; justify-content: center;
        background: conic-gradient(${scoreColor} ${score * 3.6}deg, #2a2a4a ${score * 3.6}deg);
        position: relative;
    }
    .score-ring::before {
        content: ''; position: absolute; width: 130px; height: 130px;
        border-radius: 50%; background: #1a1a2e;
    }
    .score-value {
        position: relative; z-index: 1; font-size: 42px; font-weight: 700;
        color: ${scoreColor}; text-align: center;
    }
    .score-label { display: block; font-size: 11px; color: #888; margin-top: -4px; }

    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
    .card { background: #16213e; border-radius: 12px; padding: 20px; border: 1px solid #2a2a4a; }
    .card h2 { font-size: 14px; color: #6c5ce7; margin-bottom: 14px; text-transform: uppercase; letter-spacing: 1px; }
    .card.full { grid-column: 1 / -1; }

    .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .stat { text-align: center; padding: 12px; background: #1a1a2e; border-radius: 8px; }
    .stat-value { font-size: 24px; font-weight: 700; color: #fff; }
    .stat-label { font-size: 11px; color: #888; margin-top: 4px; }

    .check-row { display: flex; align-items: center; padding: 10px; border-radius: 8px; margin-bottom: 6px; }
    .check-row.pass { background: rgba(0, 184, 148, 0.1); }
    .check-row.warn { background: rgba(253, 203, 110, 0.1); }
    .check-row.fail { background: rgba(225, 112, 85, 0.1); }
    .check-icon { font-size: 18px; margin-right: 12px; }
    .check-info { flex: 1; }
    .check-name { font-weight: 600; font-size: 13px; display: block; color: #fff; }
    .check-msg { font-size: 11px; color: #888; }

    .lang-row { display: flex; align-items: center; margin-bottom: 8px; }
    .lang-name { width: 120px; font-size: 12px; color: #ccc; }
    .lang-bar-bg { flex: 1; height: 8px; background: #2a2a4a; border-radius: 4px; margin: 0 10px; }
    .lang-bar { height: 100%; background: linear-gradient(90deg, #6c5ce7, #a29bfe); border-radius: 4px; transition: width .3s; }
    .lang-count { font-size: 11px; color: #888; width: 30px; text-align: right; }

    .tag { display: inline-block; padding: 4px 10px; background: #2a2a4a; border-radius: 20px; font-size: 11px; margin: 3px; color: #a29bfe; }
</style>
</head>
<body>
    <div class="header">
        <h1>🧠 Project Brain Dashboard</h1>
        <p>Live codebase analysis & context health</p>
    </div>

    <div class="score-ring">
        <div class="score-value">${score}<span class="score-label">Health Score</span></div>
    </div>

    <div class="grid">
        <div class="card">
            <h2>📈 Codebase Stats</h2>
            <div class="stat-grid">
                <div class="stat"><div class="stat-value">${analysis.totalFiles}</div><div class="stat-label">Files</div></div>
                <div class="stat"><div class="stat-value">${analysis.totalLines.toLocaleString()}</div><div class="stat-label">Lines of Code</div></div>
                <div class="stat"><div class="stat-value">${Object.keys(analysis.languages).length}</div><div class="stat-label">Languages</div></div>
                <div class="stat"><div class="stat-value">${analysis.components.length}</div><div class="stat-label">Components</div></div>
            </div>
        </div>

        <div class="card">
            <h2>🔤 Languages</h2>
            ${langBars}
        </div>

        <div class="card full">
            <h2>🩺 Context Health Checks</h2>
            ${checksHtml}
        </div>

        ${analysis.apiRoutes.length > 0 ? `<div class="card">
            <h2>🔌 API Routes (${analysis.apiRoutes.length})</h2>
            <div>${analysis.apiRoutes.slice(0, 10).map(r => `<div class="tag">${r}</div>`).join('')}</div>
        </div>` : ''}

        ${analysis.envVars.length > 0 ? `<div class="card">
            <h2>🔑 Environment Variables</h2>
            <div>${analysis.envVars.map(v => `<div class="tag">${v}</div>`).join('')}</div>
        </div>` : ''}

        <div class="card full">
            <h2>📁 Project Structure</h2>
            <div>${analysis.directories.slice(0, 20).map(d => `<div class="tag">📂 ${d}</div>`).join('')}</div>
        </div>
    </div>
</body>
</html>`;
}


// ============================================================
// ENHANCED TREE PROVIDER - with stats
// ============================================================

class BrainTreeProvider implements vscode.TreeDataProvider<BrainItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<BrainItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(private workspaceRoot: string | undefined) { }

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
                new BrainItem('⚡ No Brain Found', '', vscode.TreeItemCollapsibleState.None, 'warning'),
                new BrainItem('🚀 Click to Initialize', 'projectBrain.init', vscode.TreeItemCollapsibleState.None, 'add'),
                new BrainItem('──────────────', '', vscode.TreeItemCollapsibleState.None, 'info'),
                new BrainItem('📊 Open Dashboard', 'projectBrain.dashboard', vscode.TreeItemCollapsibleState.None, 'add'),
                new BrainItem('📋 Copy Context', 'projectBrain.copyContext', vscode.TreeItemCollapsibleState.None, 'add'),
            ];
        }

        const items: BrainItem[] = [
            new BrainItem('📄 CLAUDE.md', 'CLAUDE.md', vscode.TreeItemCollapsibleState.None, 'file'),
        ];

        const brainDir = path.join(this.workspaceRoot, 'project-brain');
        if (fs.existsSync(brainDir)) {
            const fileIcons: Record<string, string> = {
                'product.md': '🎯', 'architecture.md': '🏗️', 'stack.md': '⚙️',
                'coding-standards.md': '📏', 'agent-rules.md': '🤖', 'database.md': '🗄️',
                'api.md': '🔌', 'roadmap.md': '🗺️'
            };
            const files = ['product.md', 'architecture.md', 'stack.md', 'coding-standards.md', 'agent-rules.md', 'database.md', 'api.md', 'roadmap.md'];
            for (const file of files) {
                if (fs.existsSync(path.join(brainDir, file))) {
                    items.push(new BrainItem(`${fileIcons[file] || '📄'} ${file}`, `project-brain/${file}`, vscode.TreeItemCollapsibleState.None, 'file'));
                }
            }
        }

        items.push(new BrainItem('──────────────', '', vscode.TreeItemCollapsibleState.None, 'info'));
        items.push(new BrainItem('📊 Open Dashboard', 'projectBrain.dashboard', vscode.TreeItemCollapsibleState.None, 'add'));
        items.push(new BrainItem('🔬 Deep Scan', 'projectBrain.deepScan', vscode.TreeItemCollapsibleState.None, 'add'));
        items.push(new BrainItem('📋 Copy Context', 'projectBrain.copyContext', vscode.TreeItemCollapsibleState.None, 'add'));

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
                command: filePath || 'projectBrain.init',
                title: 'Execute'
            };
            this.iconPath = new vscode.ThemeIcon('add');
        } else if (itemType === 'warning') {
            this.iconPath = new vscode.ThemeIcon('warning');
        } else {
            this.iconPath = new vscode.ThemeIcon('info');
        }
    }
}


// ============================================================
// TEMPLATES — Boris Cherny Best Practices (2026)
// Based on the official CLAUDE.md guide:
// - ~100 lines / ~2.5k tokens (concise, not bloated)
// - Verification = MOST important section
// - @import architecture for modularity
// - Agentic Loop: Gather → Plan → Act → Verify → Reflect → Improve
// - Mistake-driven self-improvement via lessons.md
// ============================================================

interface ProjectConfig {
    name: string;
    description: string;
    frontend?: string;
    backend?: string;
    database?: string;
    targetUsers?: string;
}

type Platform = 'claude' | 'cursor' | 'windsurf' | 'copilot' | 'gemini';

const PLATFORMS: { id: Platform, fileName: string }[] = [
    { id: 'claude', fileName: 'CLAUDE.md' },
    { id: 'cursor', fileName: '.cursorrules' },
    { id: 'windsurf', fileName: '.windsurfrules' },
    { id: 'copilot', fileName: '.github/copilot-instructions.md' },
    { id: 'gemini', fileName: 'GEMINI.md' }
];

function getPackageManagerCmd(workspaceRoot: string): { pm: string; run: string; install: string } {
    if (fs.existsSync(path.join(workspaceRoot, 'pnpm-lock.yaml'))) { return { pm: 'pnpm', run: 'pnpm', install: 'pnpm install' }; }
    if (fs.existsSync(path.join(workspaceRoot, 'bun.lockb'))) { return { pm: 'bun', run: 'bun', install: 'bun install' }; }
    if (fs.existsSync(path.join(workspaceRoot, 'yarn.lock'))) { return { pm: 'yarn', run: 'yarn', install: 'yarn install' }; }
    return { pm: 'npm', run: 'npm run', install: 'npm install' };
}

// ── CLAUDE.md — Master file (~80-100 lines, ~2.5k tokens) ──
function getMasterContextTemplate(config: ProjectConfig, workspaceRoot: string | undefined, platform: Platform): string {
    const pmCmd = workspaceRoot ? getPackageManagerCmd(workspaceRoot) : { pm: 'npm', run: 'npm run', install: 'npm install' };
    const importRef = (file: string) => platform === 'claude' ? '@import ' + file : 'Reference rules in: ' + file;
    const hdr = platform === 'claude' ? '# CLAUDE.md' : platform === 'cursor' ? '# .cursorrules' : platform === 'windsurf' ? '# .windsurfrules' : platform === 'copilot' ? '# GitHub Copilot Rules' : '# GEMINI.md';
    return `${hdr}
# ════════════════════════════════════════════════
# Auto-generated by Project Brain
# This file is read automatically at the start of every session.
# Keep it under ~100 lines. Reference detailed rules below.
# ════════════════════════════════════════════════

## 1. Project Context

**${config.name}** — ${config.description || 'A software project'}

- Frontend: ${config.frontend || 'Not specified'}
- Backend: ${config.backend || 'Not specified'}
- Database: ${config.database || 'Not specified'}
- Package Manager: ${pmCmd.pm}

## 2. Development Workflow

\`\`\`bash
# Install dependencies
${pmCmd.install}

# Development
${pmCmd.run} dev

# Build
${pmCmd.run} build

# Test
${pmCmd.run} test

# Lint
${pmCmd.run} lint
\`\`\`

## 3. Coding Rules & Conventions

- Never commit without running tests first
- Never use \`any\` type — always define proper types
- Never leave TODO comments without a linked task
- Always handle errors explicitly — no silent catches
- Always write self-documenting code — minimal comments
- Follow existing patterns in the codebase before introducing new ones

${importRef('./project-brain/coding-standards.md')}

## 4. Verification ← MOST IMPORTANT

Before marking ANY task as done, you MUST:
1. Run the test suite: \`${pmCmd.run} test\`
2. Run the linter: \`${pmCmd.run} lint\`
3. Build succeeds: \`${pmCmd.run} build\`
4. Verify the change works in browser/terminal with real execution
5. Check for regressions in related functionality

Never claim "done" without proof. Never skip verification.

${importRef('./project-brain/verification.md')}

## 5. Workflow Orchestration (10× Engineer)

1. **Plan Mode** — Enter plan mode for any non-trivial task (3+ steps)
2. **Subagents** — Use subagents liberally to keep main context clean
3. **Self-Improvement** — After ANY correction: update lessons.md with the pattern
4. **Verify Before Done** — Run tests, check logs, demonstrate correctness
5. **Demand Elegance** — For non-trivial changes: "Is there a more elegant way?"
6. **Autonomous Bug Fix** — When given a bug: just fix it. No hand-holding.

${importRef('./project-brain/agent-rules.md')}

## 6. Architecture & Imports

${importRef('./project-brain/architecture.md')}
${importRef('./project-brain/product.md')}
${importRef('./tasks/lessons.md')}
`;
}

// ── Product Overview ──
function getProductMdTemplate(config: ProjectConfig): string {
    return `# Product Overview

## Project: ${config.name}

${config.description || 'Describe your project here.'}

## Target Users
${config.targetUsers || '- Define your target users here'}

## Core Features
- [ ] Feature 1 — describe what it does
- [ ] Feature 2 — describe what it does
- [ ] Feature 3 — describe what it does

## Success Metrics
- Metric 1: target value
- Metric 2: target value
`;
}

// ── Architecture ──
function getArchitectureMdTemplate(config: ProjectConfig): string {
    return `# Architecture

## System Overview

${config.name} follows a ${config.backend ? config.backend + ' backend' : 'standard'} architecture.

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|--------|
| Frontend | ${config.frontend || 'TBD'} | latest |
| Backend | ${config.backend || 'TBD'} | latest |
| Database | ${config.database || 'TBD'} | latest |

## Directory Structure

\`\`\`
src/
├── components/     # UI components
├── services/       # Business logic
├── utils/          # Shared utilities
├── types/          # TypeScript types
└── config/         # Configuration
\`\`\`

## Key Design Decisions

1. **Decision**: reason and tradeoffs
2. **Decision**: reason and tradeoffs

## Data Flow

User → Frontend → API → Service → Database → Response
`;
}

// ── Coding Standards (.claude/rules format) ──
function getCodingStandardsMdTemplate(): string {
    return `# Coding Standards

## Naming
- Variables/functions: camelCase
- Classes/components: PascalCase
- Constants: UPPER_SNAKE_CASE
- Files: kebab-case
- Database columns: snake_case

## Style Rules
- 2 space indentation
- Single quotes for strings
- Trailing commas in multi-line
- Max line length: 100 characters
- Explicit return types on public functions

## Never → Always Patterns
- Never use \`var\` → always use \`const\` or \`let\`
- Never use \`==\` → always use \`===\`
- Never nest more than 3 levels → extract to functions
- Never ignore errors → always handle or rethrow
- Never use magic numbers → always use named constants
- Never mutate function parameters → always return new values

## Git Commits
- Use conventional commits: feat:, fix:, refactor:, docs:, test:
- Keep commits atomic — one logical change per commit
- Write descriptive commit messages
`;
}

// ── Verification Rules ──
function getVerificationMdTemplate(config: ProjectConfig, workspaceRoot?: string): string {
    const pmCmd = workspaceRoot ? getPackageManagerCmd(workspaceRoot) : { pm: 'npm', run: 'npm run', install: 'npm install' };
    return `# Verification Rules

## This is the MOST IMPORTANT section (Boris Cherny)

Never mark a task complete without proving it works.

## Pre-Commit Checklist

1. \`${pmCmd.run} test\` — all tests pass
2. \`${pmCmd.run} lint\` — zero warnings
3. \`${pmCmd.run} build\` — compiles cleanly
4. Manual verification — the feature actually works
5. No regressions — related features still work

## For Bug Fixes (TDD)

1. Write a failing test that reproduces the bug
2. Fix the bug
3. Confirm the test passes
4. Check no other tests broke

## For New Features

1. Write tests first (or alongside)
2. Verify in browser/terminal with real execution
3. Check edge cases
4. Verify error handling works

## Ask Yourself

"Would a staff engineer approve this PR?"
If not, keep iterating.
`;
}

// ── Agent Rules (Agentic Loop Protocol) ──
function getAgentRulesMdTemplate(): string {
    return `# Agent Rules — Agentic Loop Protocol

## The Loop: Gather → Plan → Act → Verify → Reflect → Improve

### 1. GATHER
Read CLAUDE.md, tasks/lessons.md, relevant files, errors, and all context
before touching any code.

### 2. PLAN
For any task > 30 min or 3+ steps: enter Plan Mode.
Write a verifiable plan before coding.
If something goes sideways, STOP and re-plan immediately.

### 3. ACT
Make minimal, elegant, high-impact changes.
One focused change at a time.
Use subagents for research and parallel work.

### 4. VERIFY RIGOROUSLY
Run tests, build, check logs. Use diffs when relevant.
Never claim "done" without proof of correctness.

### 5. REFLECT
What worked? What failed? Why?
Be honest about root cause before moving on.

### 6. IMPROVE & LOOP
Update CLAUDE.md and tasks/lessons.md with new rules.
Repeat until success criteria are 100% met.

## Behavioral Rules (NEVER break these)

- Always start with a written plan
- Break every task into < 30 min verifiable chunks
- For bugs: write failing test → fix → make test pass (TDD)
- After any correction: immediately add preventive rule to lessons.md
- Never assume — always verify with real execution
- One clarifying question maximum before starting work

## The Ultimate Prompt

"Fix this, then update your CLAUDE.md so you never make that mistake again."
`;
}

// ── Lessons (Self-Improvement Memory) ──
function getLessonsMdTemplate(): string {
    return `# Lessons Learned

This file is your self-improvement memory. After ANY correction or mistake,
add a lesson here so it never happens again.

## Format

Date | Category | Lesson

## Lessons

<!-- Add lessons below as you work. Example: -->
<!-- 2026-03-03 | testing | Always run integration tests before marking API changes done -->
<!-- 2026-03-03 | patterns | Use the repository pattern for data access, not direct DB calls -->
`;
}

// ── Todo (Active Work Planning) ──
function getTodoMdTemplate(): string {
    return `# Active Tasks

## In Progress
- [ ] Task description — estimated time

## Up Next
- [ ] Task description — estimated time

## Blocked
- [ ] Task description — reason blocked

## Completed
<!-- Move completed tasks here with date -->
`;
}


// ============================================================
// STACK DETECTION
// ============================================================

function detectStackSync(workspaceRoot: string): Partial<ProjectConfig> {
    const config: Partial<ProjectConfig> = {};
    try {
        const packageJsonPath = path.join(workspaceRoot, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            const deps = { ...pkg.dependencies, ...pkg.devDependencies };
            config.name = pkg.name || path.basename(workspaceRoot);
            config.description = pkg.description || '';

            if (deps['next']) { config.frontend = 'Next.js'; }
            else if (deps['react']) { config.frontend = 'React'; }
            else if (deps['vue']) { config.frontend = 'Vue.js'; }
            else if (deps['@angular/core']) { config.frontend = 'Angular'; }
            else if (deps['svelte']) { config.frontend = 'Svelte'; }

            if (deps['express']) { config.backend = 'Express.js'; }
            else if (deps['@nestjs/core']) { config.backend = 'NestJS'; }
            else if (deps['fastify']) { config.backend = 'Fastify'; }
            else if (deps['koa']) { config.backend = 'Koa'; }

            if (deps['mongoose'] || deps['mongodb']) { config.database = 'MongoDB'; }
            else if (deps['pg'] || deps['postgres']) { config.database = 'PostgreSQL'; }
            else if (deps['mysql2'] || deps['mysql']) { config.database = 'MySQL'; }
            else if (deps['@prisma/client']) { config.database = 'Prisma'; }
            else if (deps['sqlite3']) { config.database = 'SQLite'; }
        }

        const requirementsPath = path.join(workspaceRoot, 'requirements.txt');
        if (fs.existsSync(requirementsPath)) {
            const content = fs.readFileSync(requirementsPath, 'utf8').toLowerCase();
            if (content.includes('fastapi')) { config.backend = 'FastAPI'; }
            else if (content.includes('django')) { config.backend = 'Django'; }
            else if (content.includes('flask')) { config.backend = 'Flask'; }
        }
    } catch { /* ignore */ }
    return config;
}


// ============================================================
// BRAIN FILE GENERATION — Boris Cherny Structure
// Creates: CLAUDE.md, .cursorrules, .windsurfrules, GEMINI.md, project-brain/, tasks/
// ============================================================

async function generateBrain(workspaceRoot: string, config: ProjectConfig): Promise<void> {
    // Create directory structure per Boris Cherny guide
    const brainDir = path.join(workspaceRoot, 'project-brain');
    const tasksDir = path.join(workspaceRoot, 'tasks');
    const claudeRulesDir = path.join(workspaceRoot, '.claude', 'rules');
    const docsDir = path.join(workspaceRoot, 'docs');
    const githubDir = path.join(workspaceRoot, '.github');

    for (const dir of [brainDir, tasksDir, claudeRulesDir, docsDir, githubDir]) {
        if (!fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true }); }
    }

    // Generate all files
    const files: [string, string][] = [
        // Project brain detailed docs
        [path.join(brainDir, 'product.md'), getProductMdTemplate(config)],
        [path.join(brainDir, 'architecture.md'), getArchitectureMdTemplate(config)],
        [path.join(brainDir, 'coding-standards.md'), getCodingStandardsMdTemplate()],
        [path.join(brainDir, 'verification.md'), getVerificationMdTemplate(config, workspaceRoot)],
        [path.join(brainDir, 'agent-rules.md'), getAgentRulesMdTemplate()],

        // Tasks — self-improvement memory + active planning
        [path.join(tasksDir, 'lessons.md'), getLessonsMdTemplate()],
        [path.join(tasksDir, 'todo.md'), getTodoMdTemplate()],

        // .claude/rules — modular rule files (auto-loaded by Claude Code)
        [path.join(claudeRulesDir, 'coding-style.md'), getCodingStandardsMdTemplate()],
        [path.join(claudeRulesDir, 'verification.md'), getVerificationMdTemplate(config, workspaceRoot)],
    ];

    // Master files for each AI platform
    for (const p of PLATFORMS) {
        files.push([path.join(workspaceRoot, p.fileName), getMasterContextTemplate(config, workspaceRoot, p.id)]);
    }

        for (const [filePath, content] of files) {
        // Don't overwrite if file already exists and has content
        if (fs.existsSync(filePath)) {
            const existing = fs.readFileSync(filePath, 'utf8').trim();
            if (existing.length > 50) { continue; } // Skip — user has customized this file
        }
        fs.writeFileSync(filePath, content, 'utf8');
    }
}


// ============================================================
// 🔬 DEEP SCAN - Generate Master Contexts from real code analysis
// ============================================================

function generateMasterContextFromScan(analysis: CodebaseAnalysis, workspaceRoot: string, platform: Platform): string {
    const config = detectStackSync(workspaceRoot);
    const pmCmd = getPackageManagerCmd(workspaceRoot);
    const topLangs = Object.entries(analysis.languages)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([lang]) => lang)
        .join(', ');

    // Build scripts section from actual package.json
    const scriptEntries = Object.entries(analysis.scripts);
    const testCmd = analysis.scripts['test'] ? `${pmCmd.run} test` : '# no test script found — add one!';
    const lintCmd = analysis.scripts['lint'] ? `${pmCmd.run} lint` : '# no lint script found — add one!';
    const buildCmd = analysis.scripts['build'] ? `${pmCmd.run} build` : '# no build script found';
    const devCmd = analysis.scripts['dev'] || analysis.scripts['start'] ? `${pmCmd.run} ${analysis.scripts['dev'] ? 'dev' : 'start'}` : '# no dev script found';
    const importRef = (file: string) => platform === 'claude' ? '@import ' + file : 'Reference rules in: ' + file;
    const hdr = platform === 'claude' ? '# CLAUDE.md' : platform === 'cursor' ? '# .cursorrules' : platform === 'windsurf' ? '# .windsurfrules' : platform === 'copilot' ? '# GitHub Copilot Rules' : '# GEMINI.md';

    let md = `${hdr}
# ════════════════════════════════════════════════
# Auto-generated by Project Brain Deep Scan
# This file is read automatically by your AI assistant.
# ════════════════════════════════════════════════

## 1. Project Context

**${config.name || path.basename(workspaceRoot)}** — ${config.description || 'A software project'}

- Languages: ${topLangs}
- Frontend: ${config.frontend || 'N/A'}
- Backend: ${config.backend || 'N/A'}
- Database: ${config.database || 'N/A'}
- Testing: ${analysis.testFramework}
- Package Manager: ${pmCmd.pm}
- Git Branch: ${analysis.gitBranch}
- Codebase: ${analysis.totalFiles} files / ${analysis.totalLines.toLocaleString()} lines

## 2. Development Workflow

\`\`\`bash
${pmCmd.install}
${devCmd}
${buildCmd}
${testCmd}
${lintCmd}
\`\`\`

## 3. Coding Rules & Conventions

- Follow existing patterns in the codebase
- Never commit without running tests
- Never use \`any\` — define proper types
- Always handle errors explicitly
- Write self-documenting code

${importRef('./project-brain/coding-standards.md')}

## 4. Verification ← MOST IMPORTANT

Before marking ANY task as done:
1. \`${testCmd}\` — all tests pass
2. \`${lintCmd}\` — zero warnings
3. \`${buildCmd}\` — compiles cleanly
4. Manual verification — the feature actually works
5. No regressions — related features still work

Never claim "done" without proof. Ask: "Would a staff engineer approve this?"

## 5. Workflow Orchestration

1. Plan Mode for non-trivial tasks (3+ steps)
2. Subagents for research and parallel work
3. After ANY correction → update tasks/lessons.md
4. Verify before done — run tests, demonstrate correctness
5. Demand elegance — "Is there a more elegant way?"
6. Autonomous bug fixing — just fix it, no hand-holding

## 6. Architecture & Imports

${importRef('./project-brain/architecture.md')}
${importRef('./project-brain/agent-rules.md')}
${importRef('./tasks/lessons.md')}
`;

    if (analysis.apiRoutes.length > 0) {
        md += `\n## API Routes\n\n`;
        for (const route of analysis.apiRoutes.slice(0, 25)) {
            md += `- \`${route}\`\n`;
        }
    }

    if (analysis.components.length > 0) {
        md += `\n## Key Components\n\n`;
        for (const comp of analysis.components.slice(0, 20)) {
            md += `- ${comp}\n`;
        }
    }

    if (analysis.envVars.length > 0) {
        md += `\n## Environment Variables\n\n`;
        for (const v of analysis.envVars) {
            md += `- \`${v}\`\n`;
        }
    }

    if (Object.keys(analysis.scripts).length > 0) {
        md += `\n## Build / Run Commands\n\n\`\`\`bash\n`;
        for (const [name, cmd] of Object.entries(analysis.scripts)) {
            md += `# ${name}\n${analysis.packageManager === 'yarn' ? 'yarn' : 'npm run'} ${name}\n\n`;
        }
        md += `\`\`\`\n`;
    }

    md += `\n## Architecture\n\nSee [architecture.md](./project-brain/architecture.md) for detailed system design.\n\n`;
    md += `## Coding Standards\n\nSee [coding-standards.md](./project-brain/coding-standards.md) for conventions.\n`;

    return md;
}


// ============================================================
// EXTENSION ACTIVATION
// ============================================================

export function activate(context: vscode.ExtensionContext) {
    console.log('Project Brain activating...');

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const treeProvider = new BrainTreeProvider(workspaceRoot);
    vscode.window.createTreeView('projectBrainTree', { treeDataProvider: treeProvider });

    // Status bar item
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
    statusBarItem.command = 'projectBrain.dashboard';
    statusBarItem.text = '$(brain) Brain';
    statusBarItem.tooltip = 'Open Project Brain Dashboard';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    context.subscriptions.push(
        // Original init command
        vscode.commands.registerCommand('projectBrain.init', async () => {
            const folder = vscode.workspace.workspaceFolders?.[0];
            if (!folder) { vscode.window.showWarningMessage('Please open a folder first.'); return; }

            const name = await vscode.window.showInputBox({ prompt: 'Project Name', value: path.basename(folder.uri.fsPath) });
            if (!name) { return; }

            const description = await vscode.window.showInputBox({ prompt: 'Project Description', placeHolder: 'A brief description' });
            const frontend = await vscode.window.showQuickPick(['React', 'Next.js', 'Vue.js', 'Angular', 'Svelte', 'None/Other'], { placeHolder: 'Frontend Framework' });
            const backend = await vscode.window.showQuickPick(['Express.js', 'NestJS', 'FastAPI', 'Django', 'Flask', 'None/Other'], { placeHolder: 'Backend Framework' });
            const database = await vscode.window.showQuickPick(['PostgreSQL', 'MongoDB', 'MySQL', 'SQLite', 'None/Other'], { placeHolder: 'Database' });

            const config: ProjectConfig = {
                name,
                description: description || '',
                frontend: frontend === 'None/Other' ? undefined : frontend,
                backend: backend === 'None/Other' ? undefined : backend,
                database: database === 'None/Other' ? undefined : database
            };

            await generateBrain(folder.uri.fsPath, config);
            treeProvider.refresh();
            vscode.window.showInformationMessage('🧠 Project Brain initialized!');
            vscode.window.showTextDocument(vscode.Uri.file(path.join(folder.uri.fsPath, 'CLAUDE.md')));
        }),

        // Quick init
        vscode.commands.registerCommand('projectBrain.quickInit', async () => {
            const folder = vscode.workspace.workspaceFolders?.[0];
            if (!folder) { vscode.window.showWarningMessage('Please open a folder first.'); return; }

            const detected = detectStackSync(folder.uri.fsPath);
            const config: ProjectConfig = {
                name: detected.name || path.basename(folder.uri.fsPath),
                description: detected.description || 'Project description',
                frontend: detected.frontend,
                backend: detected.backend,
                database: detected.database
            };

            await generateBrain(folder.uri.fsPath, config);
            treeProvider.refresh();
            vscode.window.showInformationMessage('🧠 Project Brain initialized with auto-detected settings!');
            vscode.window.showTextDocument(vscode.Uri.file(path.join(folder.uri.fsPath, 'CLAUDE.md')));
        }),

        // 🔬 Deep Scan - analyze real code and update ALL platforms
        vscode.commands.registerCommand('projectBrain.deepScan', async () => {
            const folder = vscode.workspace.workspaceFolders?.[0];
            if (!folder) { vscode.window.showWarningMessage('Please open a folder first.'); return; }

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: '🔬 Deep scanning codebase...',
                cancellable: false
            }, async () => {
                const analysis = await analyzeCodebase(folder.uri.fsPath);
                

                // Write updated master context for ALL platforms
                for (const p of PLATFORMS) {
                    const mdContent = generateMasterContextFromScan(analysis, folder.uri.fsPath, p.id);
                    const mdPath = path.join(folder.uri.fsPath, p.fileName);
                    fs.mkdirSync(path.dirname(mdPath), { recursive: true });
                    fs.writeFileSync(mdPath, mdContent, 'utf8');
                }

                // Also ensure brain dir exists
                const brainDir = path.join(folder.uri.fsPath, 'project-brain');
                if (!fs.existsSync(brainDir)) { fs.mkdirSync(brainDir, { recursive: true }); }

                treeProvider.refresh();
                vscode.window.showInformationMessage(
                    `🔬 Deep Scan complete! Updated context for Claude, Cursor, Windsurf, Copilot & Gemini.`
                );
                vscode.window.showTextDocument(vscode.Uri.file(path.join(folder.uri.fsPath, 'CLAUDE.md')));
            });
        }),

        // 📊 Dashboard
        vscode.commands.registerCommand('projectBrain.dashboard', async () => {
            const folder = vscode.workspace.workspaceFolders?.[0];
            if (!folder) { vscode.window.showWarningMessage('Please open a folder first.'); return; }

            const panel = vscode.window.createWebviewPanel(
                'projectBrainDashboard',
                '🧠 Brain Dashboard',
                vscode.ViewColumn.One,
                { enableScripts: true }
            );

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: '📊 Analyzing project...',
                cancellable: false
            }, async () => {
                const analysis = await analyzeCodebase(folder.uri.fsPath);
                const { score, checks } = calculateContextHealth(folder.uri.fsPath, analysis);
                panel.webview.html = getHealthDashboardHtml(score, checks, analysis);

                // Update status bar
                const emoji = score >= 80 ? '🟢' : score >= 50 ? '🟡' : '🔴';
                statusBarItem.text = `$(brain) Brain ${emoji} ${score}%`;
            });
        }),

        // 📋 Copy Context to clipboard
        vscode.commands.registerCommand('projectBrain.copyContext', async () => {
            const folder = vscode.workspace.workspaceFolders?.[0];
            if (!folder) { vscode.window.showWarningMessage('Please open a folder first.'); return; }

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: '📋 Generating smart context...',
                cancellable: false
            }, async () => {
                const analysis = await analyzeCodebase(folder.uri.fsPath);
                const context = generateSmartContext(folder.uri.fsPath, analysis);
                await vscode.env.clipboard.writeText(context);
                vscode.window.showInformationMessage(
                    `📋 Smart context copied! (${context.length} chars) — Paste into any AI chat.`
                );
            });
        }),

        // Open file
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
}

export function deactivate() { }
