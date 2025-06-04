import React, { useState, useEffect } from 'react';
import { WebSocketClient } from '@codeweaver/websocket-client';
import { ContextSource, FileSource, SourceType } from '@codeweaver/core';
import FileBrowser from './FileBrowser';
import '../styles/index.css';

const App = () => {
  const [client, setClient] = useState<WebSocketClient | null>(null);
  const [connected, setConnected] = useState(false);
  const [sources, setSources] = useState<ContextSource[]>([]);
  const [activeSources, setActiveSources] = useState<ContextSource[]>([]);
  const [previewSource, setPreviewSource] = useState<ContextSource | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Initialize WebSocket connection
  useEffect(() => {
    const wsClient = new WebSocketClient('ws://localhost:8180', {
      events: {
        onConnect: () => {
          console.log('Connected to WebSocket server');
          setConnected(true);
          // Load initial sources
          loadSources();
        },
        onDisconnect: () => {
          console.log('Disconnected from WebSocket server');
          setConnected(false);
        },
        onError: (error: Error) => {
          console.error('WebSocket error:', error);
        }
      }
    });
    setClient(wsClient);

    // Connect to the server
    wsClient.connect().catch(console.error);

    return () => {
      wsClient.disconnect();
    };
  }, []);

  const loadSources = async () => {
    if (!client) return;
    
    try {
      const response = await client.getSources();
      setSources(response);
      
      const activeSourceIds = await client.getActiveContext();
      const activeResponse = response.filter(source => activeSourceIds.includes(source.id));
      setActiveSources(activeResponse);
    } catch (error) {
      console.error('Failed to load sources:', error);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || !client) return;

    for (const file of Array.from(files)) {
      try {
        const fileSource: Omit<FileSource, 'id' | 'createdAt' | 'updatedAt'> = {
          type: SourceType.FILE,
          label: file.name,
          filePath: file.name, // In a real implementation, this would be the actual path
          description: `File: ${file.name}`,
          fileMetadata: {
            size: file.size,
            lastModified: new Date(file.lastModified)
          }
        };

        await client.addSource(fileSource);
        await loadSources(); // Refresh the sources list
      } catch (error) {
        console.error('Failed to add file:', error);
      }
    }
  };

  const toggleSourceActive = async (source: ContextSource) => {
    if (!client) return;

    try {
      const isActive = activeSources.some(s => s.id === source.id);
      let newActiveIds: string[];

      if (isActive) {
        // Remove from active context
        newActiveIds = activeSources.filter(s => s.id !== source.id).map(s => s.id);
      } else {
        // Add to active context
        newActiveIds = [...activeSources.map(s => s.id), source.id];
      }

      await client.setActiveContext(newActiveIds);
      await loadSources(); // Refresh to get updated active context
    } catch (error) {
      console.error('Failed to toggle source active state:', error);
    }
  };

  const deleteSource = async (sourceId: string) => {
    if (!client) return;

    try {
      await client.deleteSource(sourceId);
      await loadSources(); // Refresh the sources list
    } catch (error) {
      console.error('Failed to delete source:', error);
    }
  };

  const handleFileBrowserSelect = async (filePath: string) => {
    if (!client) return;

    try {
      const fileSource: Omit<FileSource, 'id' | 'createdAt' | 'updatedAt'> = {
        type: SourceType.FILE,
        label: filePath.split('/').pop() || filePath,
        filePath: filePath,
        description: `File: ${filePath}`,
        fileMetadata: {
          // These will be populated by the server when reading the file
          size: 0,
          lastModified: new Date()
        }
      };

      await client.addSource(fileSource);
      await loadSources(); // Refresh the sources list
    } catch (error) {
      console.error('Failed to add file from browser:', error);
    }
  };

  const previewSourceContent = async (source: ContextSource) => {
    if (!client || previewSource?.id === source.id) {
      setPreviewSource(null);
      setPreviewContent(null);
      return;
    }

    setPreviewLoading(true);
    setPreviewSource(source);
    setPreviewContent(null);

    try {
      const content = await client.getSourceContent(source.id);
      setPreviewContent(content);
    } catch (error) {
      console.error('Failed to get source content:', error);
      setPreviewContent('Error loading content: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setPreviewLoading(false);
    }
  };

  const exportActiveContext = async () => {
    if (!client || activeSources.length === 0) return;

    try {
      const contextData = [];
      
      for (const source of activeSources) {
        try {
          const content = await client.getSourceContent(source.id);
          contextData.push({
            source,
            content
          });
        } catch (error) {
          console.error(`Failed to get content for ${source.label}:`, error);
          contextData.push({
            source,
            content: `Error loading content: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
        }
      }

      // Format as markdown-style text
      const formattedContent = contextData.map(({ source, content }) => {
        const fileHeader = source.type === SourceType.FILE 
          ? `## File: ${(source as FileSource).filePath}\n`
          : `## ${source.type}: ${source.label}\n`;
        
        return `${fileHeader}\n\`\`\`\n${content}\n\`\`\`\n`;
      }).join('\n');

      // Copy to clipboard
      await navigator.clipboard.writeText(formattedContent);
      alert('Context copied to clipboard!');
    } catch (error) {
      console.error('Failed to export context:', error);
      alert('Failed to export context: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  return (
    <div className="app">
      <header className="header">
        <h1>Code Weaver</h1>
        <div className="connection-status">
          Status: <span className={connected ? 'connected' : 'disconnected'}>
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </header>

      <main className="main">
        <section className="file-input-section">
          <h2>Add Files to Context</h2>
          <input
            type="file"
            multiple
            onChange={handleFileSelect}
            disabled={!connected}
            className="file-input"
          />
          <p className="input-description">Or browse workspace files below:</p>
        </section>

        <section>
          <FileBrowser 
            client={client}
            connected={connected}
            onFileSelect={handleFileBrowserSelect}
          />
        </section>

        <section className="sources-section">
          <h2>Context Sources ({sources.length})</h2>
          <div className="sources-list">
            {sources.map(source => {
              const isActive = activeSources.some(s => s.id === source.id);
              return (
                <div key={source.id} className={`source-item ${isActive ? 'active' : ''}`}>
                  <div className="source-info">
                    <h3>{source.label}</h3>
                    <p>{source.description}</p>
                    <small>Type: {source.type} | Created: {source.createdAt.toLocaleString()}</small>
                  </div>
                  <div className="source-actions">
                    <button
                      onClick={() => toggleSourceActive(source)}
                      className={`toggle-btn ${isActive ? 'active' : ''}`}
                    >
                      {isActive ? 'Remove from Context' : 'Add to Context'}
                    </button>
                    <button
                      onClick={() => previewSourceContent(source)}
                      className={`preview-btn ${previewSource?.id === source.id ? 'active' : ''}`}
                    >
                      {previewSource?.id === source.id ? 'Hide Preview' : 'Preview'}
                    </button>
                    <button
                      onClick={() => deleteSource(source.id)}
                      className="delete-btn"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
            {sources.length === 0 && (
              <p className="empty-state">No sources added yet. Use the file input above to add files.</p>
            )}
          </div>
        </section>

        <section className="active-context-section">
          <h2>Active Context ({activeSources.length})</h2>
          <div className="active-sources">
            {activeSources.map(source => (
              <div key={source.id} className="active-source-item">
                {source.label} ({source.type})
              </div>
            ))}
            {activeSources.length === 0 && (
              <p className="empty-state">No sources in active context.</p>
            )}
          </div>
          {activeSources.length > 0 && (
            <div className="context-actions">
              <button onClick={exportActiveContext} className="export-btn">
                Copy Context to Clipboard
              </button>
            </div>
          )}
        </section>

        {previewSource && (
          <section className="preview-section">
            <h2>Preview: {previewSource.label}</h2>
            <div className="preview-content">
              {previewLoading ? (
                <p>Loading...</p>
              ) : (
                <pre className="code-preview">{previewContent}</pre>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default App;