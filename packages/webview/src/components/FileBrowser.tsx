import React, { useState, useEffect } from 'react';
import { WebSocketClient } from '@codeweaver/websocket-client';
import { FileSource, SourceType } from '@codeweaver/core';

interface DirectoryItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  lastModified?: Date;
}

interface FileBrowserProps {
  client: WebSocketClient | null;
  connected: boolean;
  onFileSelect: (filePath: string) => void;
}

const FileBrowser: React.FC<FileBrowserProps> = ({ client, connected, onFileSelect }) => {
  const [currentPath, setCurrentPath] = useState<string>('');
  const [items, setItems] = useState<DirectoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [pathHistory, setPathHistory] = useState<string[]>(['']);
  const [error, setError] = useState<string | null>(null);

  // Load directory contents
  const loadDirectory = async (path?: string) => {
    if (!client || !connected) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await client.browseDirectory(path);
      setItems(response.items);
      setCurrentPath(response.path);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to browse directory');
      console.error('Failed to browse directory:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load workspace root on mount
  useEffect(() => {
    if (connected && client) {
      loadDirectory();
    }
  }, [connected, client]);

  const handleItemClick = async (item: DirectoryItem) => {
    if (item.isDirectory) {
      // Navigate to directory
      const newPath = item.path;
      setPathHistory(prev => [...prev, newPath]);
      await loadDirectory(newPath);
    } else {
      // Select file
      onFileSelect(item.path);
    }
  };

  const handleGoBack = async () => {
    if (pathHistory.length > 1) {
      const newHistory = pathHistory.slice(0, -1);
      const previousPath = newHistory[newHistory.length - 1];
      setPathHistory(newHistory);
      await loadDirectory(previousPath || undefined);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString();
  };

  if (!connected) {
    return (
      <div className="file-browser">
        <div className="browser-header">
          <h3>File Browser</h3>
        </div>
        <div className="browser-content">
          <p className="empty-state">Connect to server to browse files</p>
        </div>
      </div>
    );
  }

  return (
    <div className="file-browser">
      <div className="browser-header">
        <h3>File Browser</h3>
        <div className="path-nav">
          <button 
            onClick={handleGoBack} 
            disabled={pathHistory.length <= 1}
            className="back-btn"
          >
            ← Back
          </button>
          <span className="current-path">/{currentPath}</span>
        </div>
      </div>

      <div className="browser-content">
        {loading && <p>Loading...</p>}
        {error && <p className="error">Error: {error}</p>}
        
        {!loading && !error && (
          <div className="file-list">
            {items.map((item, index) => (
              <div
                key={index}
                className={`file-item ${item.isDirectory ? 'directory' : 'file'}`}
                onClick={() => handleItemClick(item)}
              >
                <div className="file-icon">
                  {item.isDirectory ? '📁' : '📄'}
                </div>
                <div className="file-info">
                  <div className="file-name">{item.name}</div>
                  <div className="file-details">
                    {!item.isDirectory && item.size && (
                      <span className="file-size">{formatFileSize(item.size)}</span>
                    )}
                    {item.lastModified && (
                      <span className="file-date">{formatDate(item.lastModified)}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {items.length === 0 && (
              <p className="empty-state">No files or directories found</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FileBrowser;