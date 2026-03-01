import * as vscode from 'vscode';
import { BrainGenerator } from './brainGenerator';
import { SetupWizard } from './wizard';
import { ContextSync } from './contextSync';
import { ProjectBrainPanelProvider } from './uiPanel';
import { StackDetector } from './stackDetector';
import { ProjectConfig } from './types';

let contextSync: ContextSync | undefined;
let panelProvider: ProjectBrainPanelProvider | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    console.log('Project Brain extension is activating...');

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        console.log('No workspace folder found');
        return;
    }

    const workspaceRoot = workspaceFolder.uri.fsPath;
    const generator = new BrainGenerator(workspaceRoot);

    // Register the sidebar panel
    panelProvider = new ProjectBrainPanelProvider(
        context.extensionUri,
        workspaceRoot
    );

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            ProjectBrainPanelProvider.viewType,
            panelProvider
        )
    );

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('projectBrain.initialize', async () => {
            await initializeProjectBrain(context, workspaceRoot, generator);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('projectBrain.openWizard', async () => {
            await initializeProjectBrain(context, workspaceRoot, generator);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('projectBrain.regenerate', async () => {
            await regenerateClaudeMd(workspaceRoot, generator);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('projectBrain.sync', async () => {
            await syncProjectBrain(workspaceRoot);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('projectBrain.updateArchitecture', async () => {
            await openFile(workspaceRoot, 'project-brain/architecture.md');
        })
    );

    // Setup context sync
    contextSync = new ContextSync(workspaceRoot);
    contextSync.startWatching(async (changes) => {
        // Check if any changes affect brain files
        const brainChanges = changes.filter(c =>
            c.path.includes('project-brain') || c.path.endsWith('CLAUDE.md')
        );

        if (brainChanges.length > 0) {
            await panelProvider?.updateView();
        }
    });

    // Check brain status on startup
    const status = await generator.checkStatus();

    if (!status.initialized) {
        // Check if the workspace has any files (not empty)
        const hasFiles = await workspaceHasFiles(workspaceRoot);

        if (!hasFiles) {
            // Empty workspace - prompt to initialize
            const action = await vscode.window.showInformationMessage(
                'No Project Brain detected. Would you like to initialize one for AI-friendly development?',
                'Initialize',
                'Later'
            );

            if (action === 'Initialize') {
                await initializeProjectBrain(context, workspaceRoot, generator);
            }
        } else {
            // Has files but no brain - offer to analyze and generate
            const action = await vscode.window.showInformationMessage(
                'Project detected without AI context. Would you like to generate a Project Brain?',
                'Generate',
                'Later'
            );

            if (action === 'Generate') {
                await initializeProjectBrain(context, workspaceRoot, generator);
            }
        }
    }

    console.log('Project Brain extension activated successfully');
}

async function initializeProjectBrain(
    context: vscode.ExtensionContext,
    workspaceRoot: string,
    generator: BrainGenerator
): Promise<void> {
    const wizard = new SetupWizard(context, workspaceRoot);
    const config = await wizard.launch();

    if (config) {
        await generator.generate(config);
        await generator.saveConfig(config);
        await panelProvider?.updateView();
    }
}

async function regenerateClaudeMd(
    workspaceRoot: string,
    generator: BrainGenerator
): Promise<void> {
    const config = await generator.readConfig();

    if (!config) {
        const action = await vscode.window.showWarningMessage(
            'No project configuration found. Would you like to run the setup wizard?',
            'Setup',
            'Cancel'
        );

        if (action === 'Setup') {
            await vscode.commands.executeCommand('projectBrain.initialize');
        }
        return;
    }

    await generator.regenerateClaudeMd(config);
    await panelProvider?.updateView();
}

async function syncProjectBrain(workspaceRoot: string): Promise<void> {
    if (!contextSync) {
        contextSync = new ContextSync(workspaceRoot);
    }

    await contextSync.syncClaudeMdImports();
    await panelProvider?.updateView();
}

async function openFile(workspaceRoot: string, relativePath: string): Promise<void> {
    const filePath = vscode.Uri.file(`${workspaceRoot}/${relativePath}`);

    try {
        const doc = await vscode.workspace.openTextDocument(filePath);
        await vscode.window.showTextDocument(doc);
    } catch {
        vscode.window.showErrorMessage(`Could not open file: ${relativePath}`);
    }
}

async function workspaceHasFiles(workspaceRoot: string): Promise<boolean> {
    try {
        const pattern = new vscode.RelativePattern(workspaceRoot, '*');
        const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**', 5);
        return files.length > 0;
    } catch {
        return false;
    }
}

export function deactivate(): void {
    if (contextSync) {
        contextSync.stopWatching();
    }
    console.log('Project Brain extension deactivated');
}
