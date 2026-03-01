export interface ProjectConfig {
    projectName: string;
    projectDescription: string;
    problemSolved: string;
    targetUsers: string;
    mvpFeatures: string[];
    frontend: string;
    backend: string;
    database: string;
    authSystem: string;
    hostingPlatform: string;
    apiStyle: 'REST' | 'GraphQL';
    codingStyle: string;
    testingRequirements: string;
    infrastructureNotes: string;
}

export interface BrainStatus {
    initialized: boolean;
    files: {
        claudeMd: boolean;
        productMd: boolean;
        architectureMd: boolean;
        stackMd: boolean;
        codingStandardsMd: boolean;
        agentRulesMd: boolean;
        databaseMd: boolean;
        apiMd: boolean;
        roadmapMd: boolean;
    };
    lastUpdated: Date | null;
}

export interface DetectedStack {
    type: StackType;
    frontend?: string;
    backend?: string;
    database?: string;
    packageManager?: string;
    confidence: number;
}

export type StackType =
    | 'nodejs'
    | 'python'
    | 'nextjs'
    | 'react'
    | 'vue'
    | 'angular'
    | 'fastapi'
    | 'django'
    | 'flask'
    | 'express'
    | 'nestjs'
    | 'unknown';

export interface WizardStep {
    id: string;
    title: string;
    fields: WizardField[];
}

export interface WizardField {
    id: keyof ProjectConfig;
    label: string;
    type: 'text' | 'textarea' | 'select' | 'multiselect';
    placeholder?: string;
    options?: string[];
    required?: boolean;
}

export interface WebviewMessage {
    command: string;
    data?: unknown;
}

export interface FileChange {
    path: string;
    type: 'created' | 'modified' | 'deleted';
}
