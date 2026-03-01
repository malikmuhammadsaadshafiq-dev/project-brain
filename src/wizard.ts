import * as vscode from 'vscode';
import { ProjectConfig, WizardStep, DetectedStack } from './types';
import { StackDetector } from './stackDetector';

export class SetupWizard {
    private context: vscode.ExtensionContext;
    private workspaceRoot: string;
    private panel: vscode.WebviewPanel | undefined;
    private onComplete: ((config: ProjectConfig) => void) | undefined;

    constructor(context: vscode.ExtensionContext, workspaceRoot: string) {
        this.context = context;
        this.workspaceRoot = workspaceRoot;
    }

    async launch(): Promise<ProjectConfig | undefined> {
        // Detect existing stack
        const detector = new StackDetector(this.workspaceRoot);
        const detectedStack = await detector.detect();

        return new Promise((resolve) => {
            this.onComplete = resolve;
            this.createWizardPanel(detectedStack);
        });
    }

    private createWizardPanel(detectedStack: DetectedStack): void {
        this.panel = vscode.window.createWebviewPanel(
            'projectBrainWizard',
            'Project Brain Setup',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        this.panel.webview.html = this.getWizardHtml(detectedStack);

        this.panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'complete':
                        if (this.onComplete) {
                            this.onComplete(message.config as ProjectConfig);
                        }
                        this.panel?.dispose();
                        break;
                    case 'cancel':
                        if (this.onComplete) {
                            this.onComplete(undefined as unknown as ProjectConfig);
                        }
                        this.panel?.dispose();
                        break;
                }
            },
            undefined,
            this.context.subscriptions
        );

        this.panel.onDidDispose(() => {
            this.panel = undefined;
        });
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

    private getWizardHtml(detectedStack: DetectedStack): string {
        const suggestions = StackDetector.getStackSuggestions(detectedStack);
        const frontendDetected = suggestions.frontend ? this.escapeHtml(suggestions.frontend) : '';
        const backendDetected = suggestions.backend ? this.escapeHtml(suggestions.backend) : '';
        const databaseDetected = suggestions.database ? this.escapeHtml(suggestions.database) : '';

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
    <title>Project Brain Setup</title>
    <style>
        :root {
            --bg-primary: var(--vscode-editor-background);
            --bg-secondary: var(--vscode-sideBar-background);
            --text-primary: var(--vscode-editor-foreground);
            --text-secondary: var(--vscode-descriptionForeground);
            --accent: var(--vscode-button-background);
            --accent-hover: var(--vscode-button-hoverBackground);
            --border: var(--vscode-panel-border);
            --input-bg: var(--vscode-input-background);
            --input-border: var(--vscode-input-border);
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: var(--vscode-font-family);
            background: var(--bg-primary);
            color: var(--text-primary);
            padding: 20px;
            min-height: 100vh;
        }

        .wizard-container {
            max-width: 700px;
            margin: 0 auto;
        }

        .wizard-header {
            text-align: center;
            margin-bottom: 30px;
        }

        .wizard-header h1 {
            font-size: 24px;
            margin-bottom: 8px;
        }

        .wizard-header p {
            color: var(--text-secondary);
        }

        .progress-bar {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
            position: relative;
        }

        .progress-bar::before {
            content: '';
            position: absolute;
            top: 15px;
            left: 0;
            right: 0;
            height: 2px;
            background: var(--border);
            z-index: 0;
        }

        .step-indicator {
            display: flex;
            flex-direction: column;
            align-items: center;
            position: relative;
            z-index: 1;
        }

        .step-number {
            width: 30px;
            height: 30px;
            border-radius: 50%;
            background: var(--bg-secondary);
            border: 2px solid var(--border);
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            margin-bottom: 8px;
        }

        .step-indicator.active .step-number {
            background: var(--accent);
            border-color: var(--accent);
        }

        .step-indicator.completed .step-number {
            background: #28a745;
            border-color: #28a745;
        }

        .step-label {
            font-size: 12px;
            color: var(--text-secondary);
        }

        .step-content {
            display: none;
            animation: fadeIn 0.3s ease;
        }

        .step-content.active {
            display: block;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .form-group {
            margin-bottom: 20px;
        }

        label {
            display: block;
            margin-bottom: 6px;
            font-weight: 500;
        }

        input, textarea, select {
            width: 100%;
            padding: 10px 12px;
            background: var(--input-bg);
            border: 1px solid var(--input-border);
            border-radius: 4px;
            color: var(--text-primary);
            font-family: inherit;
            font-size: 14px;
        }

        input:focus, textarea:focus, select:focus {
            outline: none;
            border-color: var(--accent);
        }

        textarea {
            min-height: 100px;
            resize: vertical;
        }

        .hint {
            font-size: 12px;
            color: var(--text-secondary);
            margin-top: 4px;
        }

        .detected-badge {
            display: inline-block;
            background: var(--accent);
            color: white;
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 11px;
            margin-left: 8px;
        }

        .button-group {
            display: flex;
            justify-content: space-between;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid var(--border);
        }

        button {
            padding: 10px 24px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 500;
            font-size: 14px;
            transition: background 0.2s;
        }

        .btn-primary {
            background: var(--accent);
            color: white;
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
            background: var(--bg-secondary);
        }

        .btn-cancel {
            background: transparent;
            color: var(--text-secondary);
        }

        .row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
        }

        .features-input {
            display: flex;
            gap: 8px;
            margin-bottom: 8px;
        }

        .features-input input {
            flex: 1;
        }

        .features-input button {
            padding: 8px 16px;
        }

        .features-list {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        }

        .feature-tag {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: var(--bg-secondary);
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 13px;
        }

        .feature-tag button {
            background: none;
            border: none;
            color: var(--text-secondary);
            cursor: pointer;
            padding: 0;
            font-size: 16px;
        }
    </style>
</head>
<body>
    <div class="wizard-container">
        <div class="wizard-header">
            <h1>Initialize Project Brain</h1>
            <p>Set up AI-native project memory for Claude Code</p>
        </div>

        <div class="progress-bar">
            <div class="step-indicator active" data-step="1">
                <div class="step-number">1</div>
                <span class="step-label">Overview</span>
            </div>
            <div class="step-indicator" data-step="2">
                <div class="step-number">2</div>
                <span class="step-label">Stack</span>
            </div>
            <div class="step-indicator" data-step="3">
                <div class="step-number">3</div>
                <span class="step-label">Architecture</span>
            </div>
            <div class="step-indicator" data-step="4">
                <div class="step-number">4</div>
                <span class="step-label">Rules</span>
            </div>
        </div>

        <!-- Step 1: Project Overview -->
        <div class="step-content active" data-step="1">
            <div class="form-group">
                <label for="projectName">Project Name *</label>
                <input type="text" id="projectName" placeholder="My Awesome Project" required>
            </div>
            <div class="form-group">
                <label for="projectDescription">Project Description *</label>
                <textarea id="projectDescription" placeholder="A brief description of what this project does..."></textarea>
            </div>
            <div class="form-group">
                <label for="problemSolved">What problem does this solve?</label>
                <textarea id="problemSolved" placeholder="The core problem this project addresses..."></textarea>
            </div>
            <div class="form-group">
                <label for="targetUsers">Target Users</label>
                <input type="text" id="targetUsers" placeholder="e.g., Developers, Small businesses, Students">
            </div>
            <div class="form-group">
                <label>MVP Features</label>
                <div class="features-input">
                    <input type="text" id="featureInput" placeholder="Add a feature">
                    <button type="button" class="btn-secondary" id="addFeatureBtn">Add</button>
                </div>
                <div class="features-list" id="featuresList"></div>
                <p class="hint">Press Enter to add each feature</p>
            </div>
        </div>

        <!-- Step 2: Technical Stack -->
        <div class="step-content" data-step="2">
            <div class="row">
                <div class="form-group">
                    <label for="frontend">
                        Frontend Framework
                        ${frontendDetected ? '<span class="detected-badge">Detected</span>' : ''}
                    </label>
                    <select id="frontend">
                        <option value="">Select...</option>
                        <option value="React" ${frontendDetected === 'React' ? 'selected' : ''}>React</option>
                        <option value="Next.js" ${frontendDetected === 'Next.js' ? 'selected' : ''}>Next.js</option>
                        <option value="Vue.js" ${frontendDetected === 'Vue.js' ? 'selected' : ''}>Vue.js</option>
                        <option value="Angular" ${frontendDetected === 'Angular' ? 'selected' : ''}>Angular</option>
                        <option value="Svelte">Svelte</option>
                        <option value="None">None (Backend only)</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="backend">
                        Backend Framework
                        ${backendDetected ? '<span class="detected-badge">Detected</span>' : ''}
                    </label>
                    <select id="backend">
                        <option value="">Select...</option>
                        <option value="Express.js" ${backendDetected === 'Express.js' ? 'selected' : ''}>Express.js</option>
                        <option value="NestJS" ${backendDetected === 'NestJS' ? 'selected' : ''}>NestJS</option>
                        <option value="FastAPI" ${backendDetected === 'FastAPI' ? 'selected' : ''}>FastAPI</option>
                        <option value="Django" ${backendDetected === 'Django' ? 'selected' : ''}>Django</option>
                        <option value="Flask" ${backendDetected === 'Flask' ? 'selected' : ''}>Flask</option>
                        <option value="Next.js API Routes">Next.js API Routes</option>
                        <option value="None">None</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
            </div>
            <div class="row">
                <div class="form-group">
                    <label for="database">
                        Database
                        ${databaseDetected ? '<span class="detected-badge">Detected</span>' : ''}
                    </label>
                    <select id="database">
                        <option value="">Select...</option>
                        <option value="PostgreSQL" ${databaseDetected === 'PostgreSQL' ? 'selected' : ''}>PostgreSQL</option>
                        <option value="MySQL">MySQL</option>
                        <option value="MongoDB" ${databaseDetected === 'MongoDB' ? 'selected' : ''}>MongoDB</option>
                        <option value="SQLite" ${databaseDetected === 'SQLite' ? 'selected' : ''}>SQLite</option>
                        <option value="Redis">Redis</option>
                        <option value="Supabase">Supabase</option>
                        <option value="Firebase">Firebase</option>
                        <option value="None">None</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="authSystem">Authentication System</label>
                    <select id="authSystem">
                        <option value="">Select...</option>
                        <option value="JWT">JWT</option>
                        <option value="OAuth2">OAuth2</option>
                        <option value="NextAuth.js">NextAuth.js</option>
                        <option value="Passport.js">Passport.js</option>
                        <option value="Clerk">Clerk</option>
                        <option value="Auth0">Auth0</option>
                        <option value="Supabase Auth">Supabase Auth</option>
                        <option value="Firebase Auth">Firebase Auth</option>
                        <option value="Custom">Custom</option>
                        <option value="None">None</option>
                    </select>
                </div>
            </div>
        </div>

        <!-- Step 3: Architecture -->
        <div class="step-content" data-step="3">
            <div class="row">
                <div class="form-group">
                    <label for="apiStyle">API Style</label>
                    <select id="apiStyle">
                        <option value="REST">REST</option>
                        <option value="GraphQL">GraphQL</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="hostingPlatform">Hosting Platform</label>
                    <select id="hostingPlatform">
                        <option value="">Select...</option>
                        <option value="Vercel">Vercel</option>
                        <option value="AWS">AWS</option>
                        <option value="Google Cloud">Google Cloud</option>
                        <option value="Azure">Azure</option>
                        <option value="DigitalOcean">DigitalOcean</option>
                        <option value="Heroku">Heroku</option>
                        <option value="Railway">Railway</option>
                        <option value="Render">Render</option>
                        <option value="Self-hosted">Self-hosted</option>
                        <option value="TBD">To be decided</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label for="infrastructureNotes">Infrastructure Notes</label>
                <textarea id="infrastructureNotes" placeholder="Any additional infrastructure considerations, CI/CD, monitoring, etc."></textarea>
            </div>
        </div>

        <!-- Step 4: Development Rules -->
        <div class="step-content" data-step="4">
            <div class="form-group">
                <label for="codingStyle">Coding Style Preferences</label>
                <textarea id="codingStyle" placeholder="e.g., Prefer functional components, use TypeScript strict mode, follow Airbnb style guide..."></textarea>
            </div>
            <div class="form-group">
                <label for="testingRequirements">Testing Requirements</label>
                <textarea id="testingRequirements" placeholder="e.g., Unit tests for all utilities, integration tests for API endpoints, 80% coverage..."></textarea>
            </div>
        </div>

        <div class="button-group">
            <button type="button" class="btn-cancel" id="cancelBtn">Cancel</button>
            <div>
                <button type="button" class="btn-secondary" id="prevBtn" style="display:none;">Previous</button>
                <button type="button" class="btn-primary" id="nextBtn">Next</button>
            </div>
        </div>
    </div>

    <script>
        (function() {
            const vscode = acquireVsCodeApi();
            let currentStep = 1;
            const totalSteps = 4;
            let features = [];

            const prevBtn = document.getElementById('prevBtn');
            const nextBtn = document.getElementById('nextBtn');
            const cancelBtn = document.getElementById('cancelBtn');
            const addFeatureBtn = document.getElementById('addFeatureBtn');
            const featureInput = document.getElementById('featureInput');
            const featuresList = document.getElementById('featuresList');

            function escapeText(text) {
                const div = document.createElement('div');
                div.textContent = text;
                return div.textContent;
            }

            function updateStepUI() {
                document.querySelectorAll('.step-indicator').forEach(function(el, index) {
                    const step = index + 1;
                    el.classList.remove('active', 'completed');
                    if (step === currentStep) {
                        el.classList.add('active');
                    } else if (step < currentStep) {
                        el.classList.add('completed');
                    }
                });

                document.querySelectorAll('.step-content').forEach(function(el) {
                    el.classList.remove('active');
                });
                document.querySelector('.step-content[data-step="' + currentStep + '"]').classList.add('active');

                prevBtn.style.display = currentStep > 1 ? 'inline-block' : 'none';
                nextBtn.textContent = currentStep === totalSteps ? 'Generate Brain' : 'Next';
            }

            function nextStep() {
                if (currentStep === 1) {
                    const name = document.getElementById('projectName').value;
                    const desc = document.getElementById('projectDescription').value;
                    if (!name || !desc) {
                        alert('Please fill in the required fields');
                        return;
                    }
                }

                if (currentStep < totalSteps) {
                    currentStep++;
                    updateStepUI();
                } else {
                    complete();
                }
            }

            function prevStep() {
                if (currentStep > 1) {
                    currentStep--;
                    updateStepUI();
                }
            }

            function addFeature() {
                const value = featureInput.value.trim();
                if (value && features.indexOf(value) === -1) {
                    features.push(value);
                    renderFeatures();
                    featureInput.value = '';
                }
            }

            function removeFeature(index) {
                features.splice(index, 1);
                renderFeatures();
            }

            function renderFeatures() {
                featuresList.replaceChildren();
                features.forEach(function(feature, index) {
                    const tag = document.createElement('span');
                    tag.className = 'feature-tag';

                    const text = document.createElement('span');
                    text.textContent = feature;
                    tag.appendChild(text);

                    const removeBtn = document.createElement('button');
                    removeBtn.textContent = '\u00D7';
                    removeBtn.addEventListener('click', function() {
                        removeFeature(index);
                    });
                    tag.appendChild(removeBtn);

                    featuresList.appendChild(tag);
                });
            }

            function complete() {
                const config = {
                    projectName: document.getElementById('projectName').value,
                    projectDescription: document.getElementById('projectDescription').value,
                    problemSolved: document.getElementById('problemSolved').value,
                    targetUsers: document.getElementById('targetUsers').value,
                    mvpFeatures: features,
                    frontend: document.getElementById('frontend').value,
                    backend: document.getElementById('backend').value,
                    database: document.getElementById('database').value,
                    authSystem: document.getElementById('authSystem').value,
                    hostingPlatform: document.getElementById('hostingPlatform').value,
                    apiStyle: document.getElementById('apiStyle').value,
                    codingStyle: document.getElementById('codingStyle').value,
                    testingRequirements: document.getElementById('testingRequirements').value,
                    infrastructureNotes: document.getElementById('infrastructureNotes').value
                };

                vscode.postMessage({ command: 'complete', config: config });
            }

            function cancel() {
                vscode.postMessage({ command: 'cancel' });
            }

            nextBtn.addEventListener('click', nextStep);
            prevBtn.addEventListener('click', prevStep);
            cancelBtn.addEventListener('click', cancel);
            addFeatureBtn.addEventListener('click', addFeature);
            featureInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    addFeature();
                }
            });
        })();
    </script>
</body>
</html>`;
    }

    static getWizardSteps(): WizardStep[] {
        return [
            {
                id: 'overview',
                title: 'Project Overview',
                fields: [
                    { id: 'projectName', label: 'Project Name', type: 'text', required: true },
                    { id: 'projectDescription', label: 'Description', type: 'textarea', required: true },
                    { id: 'problemSolved', label: 'Problem Solved', type: 'textarea' },
                    { id: 'targetUsers', label: 'Target Users', type: 'text' }
                ]
            },
            {
                id: 'stack',
                title: 'Technical Stack',
                fields: [
                    { id: 'frontend', label: 'Frontend', type: 'select', options: ['React', 'Next.js', 'Vue', 'Angular', 'Svelte', 'None'] },
                    { id: 'backend', label: 'Backend', type: 'select', options: ['Express', 'NestJS', 'FastAPI', 'Django', 'Flask', 'None'] },
                    { id: 'database', label: 'Database', type: 'select', options: ['PostgreSQL', 'MySQL', 'MongoDB', 'SQLite', 'None'] },
                    { id: 'authSystem', label: 'Auth System', type: 'select', options: ['JWT', 'OAuth2', 'NextAuth', 'Passport', 'None'] }
                ]
            },
            {
                id: 'architecture',
                title: 'Architecture',
                fields: [
                    { id: 'apiStyle', label: 'API Style', type: 'select', options: ['REST', 'GraphQL'] },
                    { id: 'hostingPlatform', label: 'Hosting', type: 'select', options: ['Vercel', 'AWS', 'GCP', 'Azure', 'Heroku'] },
                    { id: 'infrastructureNotes', label: 'Infrastructure Notes', type: 'textarea' }
                ]
            },
            {
                id: 'rules',
                title: 'Development Rules',
                fields: [
                    { id: 'codingStyle', label: 'Coding Style', type: 'textarea' },
                    { id: 'testingRequirements', label: 'Testing Requirements', type: 'textarea' }
                ]
            }
        ];
    }
}
