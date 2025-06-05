import { ContextSource } from './ContextSource.js';
import { GroupSource } from './GroupSource.js';

export interface Workspace {
  id: string;
  name: string;
  rootPath: string;
  lastOpened: Date;
  createdAt: Date;
  settings: WorkspaceSettings;
  contextSources: ContextSource[];
  groups: GroupSource[];
  templates: ContextTemplate[];
  recentMentions: string[];
  pinnedFiles: string[];
}

export interface WorkspaceSettings {
  projectType?: ProjectType;
  excludePatterns: string[];
  includePatterns: string[];
  autoSaveEnabled: boolean;
  defaultExportFormat: ExportFormatType;
  maxContextSize: number;
  gitIntegrationEnabled: boolean;
  typescriptConfigPath?: string;
  languageServerEnabled: boolean;
}

export interface ContextTemplate {
  id: string;
  name: string;
  description: string;
  mentions: string[];
  category: TemplateCategory;
  tags: string[];
  createdAt: Date;
  usageCount: number;
}

export enum ProjectType {
  TYPESCRIPT = 'typescript',
  JAVASCRIPT = 'javascript',
  REACT = 'react',
  VUE = 'vue',
  NODE = 'node',
  PYTHON = 'python',
  JAVA = 'java',
  GO = 'go',
  RUST = 'rust',
  OTHER = 'other'
}

export enum ExportFormatType {
  MARKDOWN = 'markdown',
  CLAUDE = 'claude',
  CURSOR = 'cursor',
  JSON = 'json'
}

export enum TemplateCategory {
  DEBUGGING = 'debugging',
  FEATURE_DEVELOPMENT = 'feature-development',
  CODE_REVIEW = 'code-review',
  REFACTORING = 'refactoring',
  TESTING = 'testing',
  DOCUMENTATION = 'documentation',
  CUSTOM = 'custom'
}

export interface WorkspaceMetadata {
  id: string;
  name: string;
  rootPath: string;
  lastOpened: Date;
  projectType?: ProjectType;
  fileCount: number;
  contextSourceCount: number;
}

export interface WorkspaceConfig {
  recentWorkspaces: WorkspaceMetadata[];
  defaultSettings: Partial<WorkspaceSettings>;
  maxRecentWorkspaces: number;
}