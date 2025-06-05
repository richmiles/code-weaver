import React, { useState, useEffect } from 'react';
import { WebSocketClient } from '@codeweaver/websocket-client';
import { 
  MessageType, 
  Workspace, 
  WorkspaceMetadata, 
  ProjectType, 
  ExportFormatType 
} from '@codeweaver/core';

interface WorkspaceSelectorProps {
  client: WebSocketClient | null;
  onWorkspaceSelected?: (workspace: Workspace) => void;
}

export const WorkspaceSelector: React.FC<WorkspaceSelectorProps> = ({ 
  client, 
  onWorkspaceSelected 
}) => {
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [recentWorkspaces, setRecentWorkspaces] = useState<WorkspaceMetadata[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  // Form state for creating new workspace
  const [newWorkspace, setNewWorkspace] = useState({
    name: '',
    rootPath: '',
    projectType: ProjectType.OTHER
  });

  useEffect(() => {
    if (client) {
      loadRecentWorkspaces();
    }
  }, [client]);

  const loadRecentWorkspaces = async () => {
    if (!client) {
      console.log('No client available');
      return;
    }

    console.log('Loading recent workspaces, client connected:', client.isActive());
    try {
      setLoading(true);
      const response = await client.sendAndWait({
        type: MessageType.GET_RECENT_WORKSPACES,
        id: 'get-recent-workspaces',
        timestamp: new Date(),
        payload: {}
      });

      if (response.success) {
        setRecentWorkspaces((response.data as WorkspaceMetadata[]) || []);
      } else {
        setError(response.error || 'Failed to load recent workspaces');
      }
    } catch (err) {
      console.error('Error loading recent workspaces:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const createWorkspace = async () => {
    if (!client || !newWorkspace.name || !newWorkspace.rootPath) {
      setError('Name and root path are required');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const response = await client.sendAndWait({
        type: MessageType.CREATE_WORKSPACE,
        id: 'create-workspace',
        timestamp: new Date(),
        payload: {
          name: newWorkspace.name,
          rootPath: newWorkspace.rootPath,
          settings: {
            projectType: newWorkspace.projectType,
            excludePatterns: ['node_modules', '.git', 'dist', 'build'],
            includePatterns: ['**/*.ts', '**/*.js', '**/*.jsx', '**/*.tsx'],
            autoSaveEnabled: true,
            defaultExportFormat: ExportFormatType.MARKDOWN,
            maxContextSize: 100000,
            gitIntegrationEnabled: true,
            languageServerEnabled: true
          }
        }
      });

      if (response.success) {
        const workspace = response.data as Workspace;
        setCurrentWorkspace(workspace);
        setShowCreateForm(false);
        setNewWorkspace({ name: '', rootPath: '', projectType: ProjectType.OTHER });
        onWorkspaceSelected?.(workspace);
        await loadRecentWorkspaces();
      } else {
        setError(response.error || 'Failed to create workspace');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const loadWorkspace = async (id: string) => {
    if (!client) return;

    try {
      setLoading(true);
      setError('');

      const response = await client.sendAndWait({
        type: MessageType.LOAD_WORKSPACE,
        id: 'load-workspace',
        timestamp: new Date(),
        payload: { id }
      });

      if (response.success) {
        const workspace = response.data as Workspace;
        setCurrentWorkspace(workspace);
        onWorkspaceSelected?.(workspace);
      } else {
        setError(response.error || 'Failed to load workspace');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const findWorkspaceByPath = async (rootPath: string) => {
    if (!client || !rootPath) return;

    try {
      setLoading(true);
      setError('');

      const response = await client.sendAndWait({
        type: MessageType.FIND_WORKSPACE_BY_PATH,
        id: 'find-workspace-by-path',
        timestamp: new Date(),
        payload: { rootPath }
      });

      if (response.success && response.data) {
        const workspace = response.data as Workspace;
        setCurrentWorkspace(workspace);
        onWorkspaceSelected?.(workspace);
      } else {
        // No existing workspace found, suggest creating one
        setNewWorkspace(prev => ({ 
          ...prev, 
          rootPath,
          name: rootPath.split('/').pop() || 'New Workspace'
        }));
        setShowCreateForm(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleRootPathChange = (path: string) => {
    setNewWorkspace(prev => ({ ...prev, rootPath: path }));
    
    // Auto-detect project type based on path
    if (path.includes('node_modules') || path.includes('package.json')) {
      // Check if we can auto-detect project type
      findWorkspaceByPath(path);
    }
  };

  return (
    <div className="workspace-selector">
      <div className="workspace-header">
        <h2>Workspace</h2>
        {currentWorkspace && (
          <div className="current-workspace">
            <strong>{currentWorkspace.name}</strong>
            <span className="workspace-path">{currentWorkspace.rootPath}</span>
          </div>
        )}
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {!currentWorkspace && !showCreateForm && (
        <div className="workspace-selection">
          <div className="recent-workspaces">
            <h3>Recent Workspaces</h3>
            {loading ? (
              <div>Loading...</div>
            ) : recentWorkspaces.length > 0 ? (
              <ul className="workspace-list">
                {recentWorkspaces.map(workspace => (
                  <li key={workspace.id} className="workspace-item">
                    <button 
                      onClick={() => loadWorkspace(workspace.id)}
                      className="workspace-button"
                    >
                      <div className="workspace-name">{workspace.name}</div>
                      <div className="workspace-details">
                        <span className="workspace-path">{workspace.rootPath}</span>
                        {workspace.projectType && (
                          <span className="project-type">{workspace.projectType}</span>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="no-workspaces">No recent workspaces found</div>
            )}
          </div>

          <div className="workspace-actions">
            <button 
              onClick={() => setShowCreateForm(true)}
              className="create-workspace-button"
              disabled={loading}
            >
              Create New Workspace
            </button>

            <div className="open-existing">
              <label htmlFor="workspace-path">Or open existing folder:</label>
              <input
                id="workspace-path"
                type="text"
                placeholder="/path/to/project"
                onBlur={(e) => {
                  const path = e.target.value.trim();
                  if (path) {
                    findWorkspaceByPath(path);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const path = (e.target as HTMLInputElement).value.trim();
                    if (path) {
                      findWorkspaceByPath(path);
                    }
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}

      {showCreateForm && (
        <div className="create-workspace-form">
          <h3>Create New Workspace</h3>
          
          <div className="form-field">
            <label htmlFor="workspace-name">Name:</label>
            <input
              id="workspace-name"
              type="text"
              value={newWorkspace.name}
              onChange={(e) => setNewWorkspace(prev => ({ ...prev, name: e.target.value }))}
              placeholder="My Project"
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="workspace-root-path">Root Path:</label>
            <input
              id="workspace-root-path"
              type="text"
              value={newWorkspace.rootPath}
              onChange={(e) => handleRootPathChange(e.target.value)}
              placeholder="/path/to/project"
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="project-type">Project Type:</label>
            <select
              id="project-type"
              value={newWorkspace.projectType}
              onChange={(e) => setNewWorkspace(prev => ({ 
                ...prev, 
                projectType: e.target.value as ProjectType 
              }))}
            >
              {Object.values(ProjectType).map(type => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="form-actions">
            <button 
              onClick={createWorkspace}
              disabled={loading || !newWorkspace.name || !newWorkspace.rootPath}
              className="create-button"
            >
              {loading ? 'Creating...' : 'Create Workspace'}
            </button>
            <button 
              onClick={() => {
                setShowCreateForm(false);
                setNewWorkspace({ name: '', rootPath: '', projectType: ProjectType.OTHER });
                setError('');
              }}
              disabled={loading}
              className="cancel-button"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};