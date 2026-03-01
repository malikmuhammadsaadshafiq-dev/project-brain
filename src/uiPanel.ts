import * as vscode from 'vscode';
import * as path from 'path';
import { BrainStatus } from './types';
import { BrainGenerator } from './brainGenerator';

export class ProjectBrainPanelProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'projectBrain.panel';
    private _view?: vscode.WebviewView;
    private _workspaceRoot: string;
    private _generator: BrainGenerator;
    private _extensionUri: vscode.Uri;

    constructor(
        extensionUri: vscode.Uri,
        workspaceRoot: string
    ) {
        this._extensionUri = extensionUri;
        this._workspaceRoot = workspaceRoot;
        this._generator = new BrainGenerator(workspaceRoot);
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        this.updateView();

        webviewView.webview.onDidReceiveMessage(async message => {
            switch (message.command) {
                case 'initialize':
                    await vscode.commands.executeCommand('projectBrain.initialize');
                    break;
                case 'regenerate':
                    await vscode.commands.executeCommand('projectBrain.regenerate');
                    break;
                case 'sync':
                    await vscode.commands.executeCommand('projectBrain.sync');
                    break;
                case 'openFile':
                    await this.openFile(message.file);
                    break;
                case 'refresh':
                    await this.updateView();
                    break;
            }
        });
    }

    public async updateView(): Promise<void> {
        if (!this._view) {
            return;
        }

        const status = await this._generator.checkStatus();
        this._view.webview.html = this.getHtml(status);
    }

    private async openFile(relativePath: string): Promise<void> {
        const filePath = path.join(this._workspaceRoot, relativePath);
        const uri = vscode.Uri.file(filePath);

        try {
            const doc = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(doc);
        } catch {
            vscode.window.showErrorMessage(`Could not open file: ${relativePath}`);
        }
    }

    private escapeHtml(text: string): string {
        const map: Record<string, string> = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    private getHtml(status: BrainStatus): string {
        const statusColor = status.initialized ? '#28a745' : '#dc3545';
        const statusIcon = status.initialized ? '\u{1F7E2}' : '\u{1F534}';
        const statusText = status.initialized ? 'Brain Initialized' : 'Brain Missing';

        const lastUpdated = status.lastUpdated
            ? this.escapeHtml(status.lastUpdated.toLocaleDateString())
            : 'Never';

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
    <title>Project Brain</title>
    <style>
        :root {
            --bg-primary: var(--vscode-sideBar-background);
            --text-primary: var(--vscode-sideBar-foreground);
            --text-secondary: var(--vscode-descriptionForeground);
            --accent: var(--vscode-button-background);
            --accent-hover: var(--vscode-button-hoverBackground);
            --border: var(--vscode-panel-border);
            --list-hover: var(--vscode-list-hoverBackground);
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            background: var(--bg-primary);
            color: var(--text-primary);
            padding: 12px;
        }

        .header {
            margin-bottom: 16px;
        }

        .status {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            background: var(--vscode-editor-background);
            border-radius: 4px;
            margin-bottom: 12px;
        }

        .status-indicator {
            font-size: 12px;
        }

        .status-text {
            font-weight: 500;
        }

        .last-updated {
            font-size: 11px;
            color: var(--text-secondary);
            margin-top: 4px;
        }

        .actions {
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin-bottom: 16px;
        }

        button {
            width: 100%;
            padding: 8px 12px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 500;
            font-size: 13px;
            transition: background 0.2s;
            text-align: left;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .btn-primary {
            background: var(--accent);
            color: var(--vscode-button-foreground);
        }

        .btn-primary:hover {
            background: var(--accent-hover);
        }

        .btn-secondary {
            background: transparent;
            color: var(--text-primary);
            border: 1px solid var(--border);
        }

        .btn-secondary:hover {
            background: var(--list-hover);
        }

        .section {
            margin-bottom: 16px;
        }

        .section-header {
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--text-secondary);
            margin-bottom: 8px;
            padding-left: 4px;
        }

        .file-list {
            list-style: none;
        }

        .file-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 6px 8px;
            border-radius: 4px;
            cursor: pointer;
            transition: background 0.1s;
        }

        .file-item:hover {
            background: var(--list-hover);
        }

        .file-icon {
            opacity: 0.7;
            font-size: 14px;
        }

        .file-name {
            flex: 1;
            font-size: 13px;
        }

        .file-status {
            width: 8px;
            height: 8px;
            border-radius: 50%;
        }

        .file-status.exists {
            background: #28a745;
        }

        .file-status.missing {
            background: #dc3545;
        }

        .init-prompt {
            text-align: center;
            padding: 20px;
        }

        .init-prompt p {
            margin-bottom: 16px;
            color: var(--text-secondary);
        }

        .init-prompt button {
            text-align: center;
            justify-content: center;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="status">
            <span class="status-indicator">${statusIcon}</span>
            <span class="status-text">${this.escapeHtml(statusText)}</span>
        </div>
        <div class="last-updated">Last updated: ${lastUpdated}</div>
    </div>

    ${!status.initialized ? `
    <div class="init-prompt">
        <p>No Project Brain detected.<br>Initialize to make your project AI-friendly.</p>
        <button class="btn-primary" id="initBtn">
            <span>\u{1F9E0}</span>
            Initialize Project Brain
        </button>
    </div>
    ` : `
    <div class="actions">
        <button class="btn-secondary" id="editBtn">
            <span>\u{270F}</span>
            Edit Brain
        </button>
        <button class="btn-secondary" id="regenBtn">
            <span>\u{1F504}</span>
            Regenerate Claude.md
        </button>
        <button class="btn-secondary" id="syncBtn">
            <span>\u{1F517}</span>
            Sync Brain
        </button>
    </div>

    <div class="section">
        <div class="section-header">Brain Files</div>
        <ul class="file-list">
            <li class="file-item" data-file="CLAUDE.md">
                <span class="file-icon">\u{1F4C4}</span>
                <span class="file-name">CLAUDE.md</span>
                <span class="file-status ${status.files.claudeMd ? 'exists' : 'missing'}"></span>
            </li>
            <li class="file-item" data-file="project-brain/product.md">
                <span class="file-icon">\u{1F4E6}</span>
                <span class="file-name">product.md</span>
                <span class="file-status ${status.files.productMd ? 'exists' : 'missing'}"></span>
            </li>
            <li class="file-item" data-file="project-brain/architecture.md">
                <span class="file-icon">\u{1F3DB}</span>
                <span class="file-name">architecture.md</span>
                <span class="file-status ${status.files.architectureMd ? 'exists' : 'missing'}"></span>
            </li>
            <li class="file-item" data-file="project-brain/stack.md">
                <span class="file-icon">\u{1F4DA}</span>
                <span class="file-name">stack.md</span>
                <span class="file-status ${status.files.stackMd ? 'exists' : 'missing'}"></span>
            </li>
            <li class="file-item" data-file="project-brain/coding-standards.md">
                <span class="file-icon">\u{1F4DD}</span>
                <span class="file-name">coding-standards.md</span>
                <span class="file-status ${status.files.codingStandardsMd ? 'exists' : 'missing'}"></span>
            </li>
            <li class="file-item" data-file="project-brain/agent-rules.md">
                <span class="file-icon">\u{1F916}</span>
                <span class="file-name">agent-rules.md</span>
                <span class="file-status ${status.files.agentRulesMd ? 'exists' : 'missing'}"></span>
            </li>
            <li class="file-item" data-file="project-brain/database.md">
                <span class="file-icon">\u{1F5C3}</span>
                <span class="file-name">database.md</span>
                <span class="file-status ${status.files.databaseMd ? 'exists' : 'missing'}"></span>
            </li>
            <li class="file-item" data-file="project-brain/api.md">
                <span class="file-icon">\u{1F310}</span>
                <span class="file-name">api.md</span>
                <span class="file-status ${status.files.apiMd ? 'exists' : 'missing'}"></span>
            </li>
            <li class="file-item" data-file="project-brain/roadmap.md">
                <span class="file-icon">\u{1F5FA}</span>
                <span class="file-name">roadmap.md</span>
                <span class="file-status ${status.files.roadmapMd ? 'exists' : 'missing'}"></span>
            </li>
        </ul>
    </div>
    `}

    <script>
        (function() {
            const vscode = acquireVsCodeApi();

            function setupListeners() {
                const initBtn = document.getElementById('initBtn');
                const editBtn = document.getElementById('editBtn');
                const regenBtn = document.getElementById('regenBtn');
                const syncBtn = document.getElementById('syncBtn');

                if (initBtn) {
                    initBtn.addEventListener('click', function() {
                        vscode.postMessage({ command: 'initialize' });
                    });
                }

                if (editBtn) {
                    editBtn.addEventListener('click', function() {
                        vscode.postMessage({ command: 'openFile', file: 'CLAUDE.md' });
                    });
                }

                if (regenBtn) {
                    regenBtn.addEventListener('click', function() {
                        vscode.postMessage({ command: 'regenerate' });
                    });
                }

                if (syncBtn) {
                    syncBtn.addEventListener('click', function() {
                        vscode.postMessage({ command: 'sync' });
                    });
                }

                document.querySelectorAll('.file-item').forEach(function(item) {
                    item.addEventListener('click', function() {
                        const file = this.getAttribute('data-file');
                        if (file) {
                            vscode.postMessage({ command: 'openFile', file: file });
                        }
                    });
                });
            }

            setupListeners();
        })();
    </script>
</body>
</html>`;
    }
}
