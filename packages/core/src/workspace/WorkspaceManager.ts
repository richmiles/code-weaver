import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Workspace, WorkspaceSettings, WorkspaceMetadata, WorkspaceConfig, ProjectType, ExportFormatType } from '../types/Workspace.js';
import { ContextSource } from '../types/ContextSource.js';

export class WorkspaceManager {
  private configPath: string;
  private workspacesDir: string;
  private config: WorkspaceConfig | null = null;

  constructor(configDir: string = path.join(process.env.HOME || process.cwd(), '.codeweaver')) {
    this.configPath = path.join(configDir, 'config.json');
    this.workspacesDir = path.join(configDir, 'workspaces');
  }

  async initialize(): Promise<void> {
    await this.ensureConfigDirectory();
    await this.loadConfig();
  }

  private async ensureConfigDirectory(): Promise<void> {
    const configDir = path.dirname(this.configPath);
    await fs.mkdir(configDir, { recursive: true });
    await fs.mkdir(this.workspacesDir, { recursive: true });
  }

  private async loadConfig(): Promise<void> {
    try {
      const configData = await fs.readFile(this.configPath, 'utf-8');
      this.config = JSON.parse(configData);
    } catch (error) {
      // Create default config if it doesn't exist
      this.config = {
        recentWorkspaces: [],
        maxRecentWorkspaces: 10,
        defaultSettings: {
          excludePatterns: ['node_modules', '.git', 'dist', 'build', 'coverage'],
          includePatterns: ['**/*.ts', '**/*.js', '**/*.jsx', '**/*.tsx', '**/*.py', '**/*.java'],
          autoSaveEnabled: true,
          defaultExportFormat: ExportFormatType.MARKDOWN,
          maxContextSize: 100000,
          gitIntegrationEnabled: true,
          languageServerEnabled: true
        }
      };
      await this.saveConfig();
    }
  }

  private async saveConfig(): Promise<void> {
    if (!this.config) return;
    await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
  }

  async createWorkspace(name: string, rootPath: string, settings?: Partial<WorkspaceSettings>): Promise<Workspace> {
    const id = uuidv4();
    const now = new Date();

    // Detect project type from root path
    const projectType = await this.detectProjectType(rootPath);

    const workspace: Workspace = {
      id,
      name,
      rootPath: path.resolve(rootPath),
      lastOpened: now,
      createdAt: now,
      settings: {
        ...this.config!.defaultSettings,
        projectType,
        ...settings
      } as WorkspaceSettings,
      contextSources: [],
      groups: [],
      templates: [],
      recentMentions: [],
      pinnedFiles: []
    };

    await this.saveWorkspace(workspace);
    await this.addToRecentWorkspaces(workspace);

    return workspace;
  }

  async loadWorkspace(id: string): Promise<Workspace | null> {
    try {
      const workspacePath = path.join(this.workspacesDir, `${id}.json`);
      const workspaceData = await fs.readFile(workspacePath, 'utf-8');
      const workspace: Workspace = JSON.parse(workspaceData);
      
      // Update last opened time
      workspace.lastOpened = new Date();
      await this.saveWorkspace(workspace);
      await this.addToRecentWorkspaces(workspace);

      return workspace;
    } catch (error) {
      console.error(`Failed to load workspace ${id}:`, error);
      return null;
    }
  }

  async saveWorkspace(workspace: Workspace): Promise<void> {
    const workspacePath = path.join(this.workspacesDir, `${workspace.id}.json`);
    await fs.writeFile(workspacePath, JSON.stringify(workspace, null, 2));
  }

  async deleteWorkspace(id: string): Promise<boolean> {
    try {
      const workspacePath = path.join(this.workspacesDir, `${id}.json`);
      await fs.unlink(workspacePath);
      
      // Remove from recent workspaces
      if (this.config) {
        this.config.recentWorkspaces = this.config.recentWorkspaces.filter(w => w.id !== id);
        await this.saveConfig();
      }
      
      return true;
    } catch (error) {
      console.error(`Failed to delete workspace ${id}:`, error);
      return false;
    }
  }

  async getRecentWorkspaces(): Promise<WorkspaceMetadata[]> {
    return this.config?.recentWorkspaces || [];
  }

  async findWorkspaceByPath(rootPath: string): Promise<Workspace | null> {
    const resolvedPath = path.resolve(rootPath);
    const recentWorkspaces = await this.getRecentWorkspaces();
    
    for (const metadata of recentWorkspaces) {
      if (metadata.rootPath === resolvedPath) {
        return await this.loadWorkspace(metadata.id);
      }
    }
    
    return null;
  }

  async addContextSource(workspaceId: string, contextSource: ContextSource): Promise<void> {
    const workspace = await this.loadWorkspace(workspaceId);
    if (!workspace) throw new Error(`Workspace ${workspaceId} not found`);

    // Avoid duplicates
    const exists = workspace.contextSources.some(cs => 
      cs.id === contextSource.id || 
      (cs.type === contextSource.type && cs.label === contextSource.label)
    );

    if (!exists) {
      workspace.contextSources.push(contextSource);
      await this.saveWorkspace(workspace);
    }
  }

  async removeContextSource(workspaceId: string, contextSourceId: string): Promise<void> {
    const workspace = await this.loadWorkspace(workspaceId);
    if (!workspace) throw new Error(`Workspace ${workspaceId} not found`);

    workspace.contextSources = workspace.contextSources.filter(cs => cs.id !== contextSourceId);
    await this.saveWorkspace(workspace);
  }

  async addRecentMention(workspaceId: string, mention: string): Promise<void> {
    const workspace = await this.loadWorkspace(workspaceId);
    if (!workspace) throw new Error(`Workspace ${workspaceId} not found`);

    // Add to front, remove duplicates, limit to 50
    workspace.recentMentions = [mention, ...workspace.recentMentions.filter(m => m !== mention)].slice(0, 50);
    await this.saveWorkspace(workspace);
  }

  private async addToRecentWorkspaces(workspace: Workspace): Promise<void> {
    if (!this.config) return;

    const metadata: WorkspaceMetadata = {
      id: workspace.id,
      name: workspace.name,
      rootPath: workspace.rootPath,
      lastOpened: workspace.lastOpened,
      projectType: workspace.settings.projectType,
      fileCount: 0, // TODO: Calculate actual file count
      contextSourceCount: workspace.contextSources.length
    };

    // Remove existing entry and add to front
    this.config.recentWorkspaces = this.config.recentWorkspaces.filter(w => w.id !== workspace.id);
    this.config.recentWorkspaces.unshift(metadata);

    // Limit to max recent workspaces
    if (this.config.recentWorkspaces.length > this.config.maxRecentWorkspaces) {
      this.config.recentWorkspaces = this.config.recentWorkspaces.slice(0, this.config.maxRecentWorkspaces);
    }

    await this.saveConfig();
  }

  private async detectProjectType(rootPath: string): Promise<ProjectType> {
    try {
      const files = await fs.readdir(rootPath);
      
      if (files.includes('package.json')) {
        const packageJsonPath = path.join(rootPath, 'package.json');
        try {
          const packageData = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
          const deps = { ...packageData.dependencies, ...packageData.devDependencies };
          
          if (deps.react || deps['@types/react']) return ProjectType.REACT;
          if (deps.vue || deps['@vue/cli']) return ProjectType.VUE;
          if (deps.typescript || files.includes('tsconfig.json')) return ProjectType.TYPESCRIPT;
          return ProjectType.JAVASCRIPT;
        } catch {
          return ProjectType.NODE;
        }
      }
      
      if (files.includes('requirements.txt') || files.includes('pyproject.toml')) return ProjectType.PYTHON;
      if (files.includes('pom.xml') || files.includes('build.gradle')) return ProjectType.JAVA;
      if (files.includes('go.mod')) return ProjectType.GO;
      if (files.includes('Cargo.toml')) return ProjectType.RUST;
      
      return ProjectType.OTHER;
    } catch {
      return ProjectType.OTHER;
    }
  }

  getConfig(): WorkspaceConfig | null {
    return this.config;
  }

  async updateWorkspaceSettings(workspaceId: string, settings: Partial<WorkspaceSettings>): Promise<void> {
    const workspace = await this.loadWorkspace(workspaceId);
    if (!workspace) throw new Error(`Workspace ${workspaceId} not found`);

    workspace.settings = { ...workspace.settings, ...settings };
    await this.saveWorkspace(workspace);
  }
}