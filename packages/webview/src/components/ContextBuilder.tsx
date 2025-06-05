import React, { useState, useEffect, useCallback } from 'react';
import { MentionToken, MentionParser, ContextResolver, ResolvedContext, ExportManager, ContextExportOptions } from '@codeweaver/core';
import { WebSocketClient } from '@codeweaver/websocket-client';
import MentionInput from './MentionInput';

interface ContextBuilderProps {
  client: WebSocketClient | null;
  connected: boolean;
}

interface ContextPreview {
  tokenCount: number;
  fileCount: number;
  errorCount: number;
  hasGitChanges: boolean;
  summary: string[];
}

export const ContextBuilder: React.FC<ContextBuilderProps> = ({ client, connected }) => {
  const [input, setInput] = useState('');
  const [tokens, setTokens] = useState<MentionToken[]>([]);
  const [resolvedContext, setResolvedContext] = useState<ResolvedContext | null>(null);
  const [preview, setPreview] = useState<ContextPreview | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [exportFormat, setExportFormat] = useState('markdown');
  const [exportOptions, setExportOptions] = useState<ContextExportOptions>({
    includeMetadata: true,
    includeLineNumbers: false,
    maxFileSize: 10000,
    aiTool: 'generic'
  });

  const parser = new MentionParser();
  const resolver = new ContextResolver();
  const exportManager = new ExportManager();

  // Resolve context when tokens change
  useEffect(() => {
    if (tokens.length === 0) {
      setResolvedContext(null);
      setPreview(null);
      return;
    }

    const resolveContext = async () => {
      setIsResolving(true);
      try {
        // In a real implementation, we'd set up proper providers
        // For now, we'll create a minimal context
        const context = await resolver.resolve(tokens);
        setResolvedContext(context);
        
        // Generate preview
        const preview: ContextPreview = {
          tokenCount: context.metadata.tokenCount,
          fileCount: context.metadata.fileCount,
          errorCount: context.diagnostics.length,
          hasGitChanges: !!context.git?.diff,
          summary: generateContextSummary(context, tokens)
        };
        setPreview(preview);
      } catch (error) {
        console.error('Failed to resolve context:', error);
      } finally {
        setIsResolving(false);
      }
    };

    // Debounce context resolution
    const timeoutId = setTimeout(resolveContext, 500);
    return () => clearTimeout(timeoutId);
  }, [tokens]);

  const generateContextSummary = (context: ResolvedContext, tokens: MentionToken[]): string[] => {
    const summary: string[] = [];
    
    tokens.forEach(token => {
      switch (token.type) {
        case 'file':
          summary.push(`📄 File: ${token.value}`);
          break;
        case 'function':
          summary.push(`⚡ Function: ${token.value}`);
          break;
        case 'class':
          summary.push(`🏛️ Class: ${token.value}`);
          break;
        case 'error':
          const errorCount = context.diagnostics.length;
          summary.push(`🔴 ${errorCount} error${errorCount !== 1 ? 's' : ''} from diagnostics`);
          break;
        case 'diff':
          if (context.git?.changedFiles) {
            const fileCount = context.git.changedFiles.length;
            summary.push(`📝 ${fileCount} changed file${fileCount !== 1 ? 's' : ''} in diff`);
          }
          break;
        case 'folder':
          const folderFiles = context.files.filter(f => f.path.startsWith(token.value));
          summary.push(`📁 ${folderFiles.length} files from ${token.value}`);
          break;
        default:
          summary.push(`${token.raw}`);
      }
    });

    return summary;
  };

  const handleExport = async () => {
    if (!resolvedContext) return;

    try {
      const result = await exportManager.export(resolvedContext, exportFormat, {
        ...exportOptions,
        problemDescription: input.split('\n')[0] // Use first line as problem description
      });

      // Copy to clipboard
      await navigator.clipboard.writeText(result.content);
      
      // Show success message
      alert(`Context exported to clipboard!\n\nFormat: ${exportFormat}\nCharacters: ${result.metadata.characterCount}\nEstimated tokens: ${result.metadata.estimatedTokens}`);
    } catch (error) {
      console.error('Failed to export context:', error);
      alert('Failed to export context: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleSendToClaudeCode = () => {
    if (!resolvedContext) return;
    
    // This would integrate with Claude Code via protocol handler
    alert('Claude Code integration not implemented yet - use Copy to Clipboard for now');
  };

  const handleSaveTemplate = () => {
    if (!input.trim()) return;
    
    // This would save the current input as a reusable template
    const templateName = prompt('Enter template name:');
    if (templateName) {
      localStorage.setItem(`context-template-${templateName}`, input);
      alert(`Template "${templateName}" saved!`);
    }
  };

  const loadTemplate = (templateName: string) => {
    const template = localStorage.getItem(`context-template-${templateName}`);
    if (template) {
      setInput(template);
    }
  };

  const getSavedTemplates = (): string[] => {
    const templates: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('context-template-')) {
        templates.push(key.replace('context-template-', ''));
      }
    }
    return templates;
  };

  const getTokenCountColor = (count: number): string => {
    if (count < 5000) return 'green';
    if (count < 15000) return 'orange';
    return 'red';
  };

  return (
    <div className="context-builder">
      <div className="builder-header">
        <h2>🎯 Smart Context Builder</h2>
        <div className="export-controls">
          <select 
            value={exportFormat} 
            onChange={(e) => setExportFormat(e.target.value)}
            className="format-select"
          >
            <option value="markdown">Markdown (Universal)</option>
            <option value="claude-code">Claude Code</option>
            <option value="cursor">Cursor</option>
            <option value="json">JSON (API)</option>
          </select>
        </div>
      </div>

      <div className="builder-content">
        <div className="input-section">
          <MentionInput
            value={input}
            onChange={setInput}
            onTokensChange={setTokens}
            placeholder="Describe what you need help with and use @ to mention relevant context..."
            className="context-input"
            disabled={!connected}
          />
          
          <div className="input-help">
            <div className="help-examples">
              <strong>Examples:</strong>
              <span className="example" onClick={() => setInput('Debug the login function that\'s failing: @error @function:login @test:login @diff')}>
                Debug login issue
              </span>
              <span className="example" onClick={() => setInput('Review my component changes: @file:src/components/App.tsx @diff @test')}>
                Review changes
              </span>
              <span className="example" onClick={() => setInput('Help implement a new feature: @folder:src/auth @interface:User @deps:express')}>
                New feature
              </span>
            </div>
          </div>
        </div>

        {preview && (
          <div className="context-preview">
            <div className="preview-header">
              <h3>Context Preview</h3>
              <div className="preview-stats">
                <span className={`token-count ${getTokenCountColor(preview.tokenCount)}`}>
                  ~{preview.tokenCount.toLocaleString()} tokens
                </span>
                <span className="file-count">{preview.fileCount} files</span>
                {preview.errorCount > 0 && (
                  <span className="error-count">{preview.errorCount} errors</span>
                )}
                {preview.hasGitChanges && (
                  <span className="git-changes">Git changes</span>
                )}
              </div>
            </div>
            
            <div className="preview-content">
              {isResolving ? (
                <div className="resolving">
                  <span className="spinner">⏳</span> Resolving context...
                </div>
              ) : (
                <ul className="context-summary">
                  {preview.summary.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        <div className="action-section">
          <div className="primary-actions">
            <button 
              onClick={handleExport}
              disabled={!resolvedContext || isResolving}
              className="export-btn primary"
            >
              📋 Copy to Clipboard
            </button>
            
            <button 
              onClick={handleSendToClaudeCode}
              disabled={!resolvedContext || isResolving}
              className="claude-btn"
            >
              🤖 Send to Claude Code
            </button>
          </div>
          
          <div className="secondary-actions">
            <button 
              onClick={handleSaveTemplate}
              disabled={!input.trim()}
              className="save-template-btn"
            >
              💾 Save Template
            </button>
            
            <div className="template-dropdown">
              <select 
                onChange={(e) => e.target.value && loadTemplate(e.target.value)}
                value=""
                className="template-select"
              >
                <option value="">Load Template...</option>
                {getSavedTemplates().map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="export-options">
          <h4>Export Options</h4>
          <div className="options-grid">
            <label>
              <input
                type="checkbox"
                checked={exportOptions.includeMetadata}
                onChange={(e) => setExportOptions(prev => ({ 
                  ...prev, 
                  includeMetadata: e.target.checked 
                }))}
              />
              Include metadata
            </label>
            
            <label>
              <input
                type="checkbox"
                checked={exportOptions.includeLineNumbers}
                onChange={(e) => setExportOptions(prev => ({ 
                  ...prev, 
                  includeLineNumbers: e.target.checked 
                }))}
              />
              Include line numbers
            </label>
            
            <label>
              Max file size:
              <input
                type="number"
                value={exportOptions.maxFileSize}
                onChange={(e) => setExportOptions(prev => ({ 
                  ...prev, 
                  maxFileSize: parseInt(e.target.value) || 10000 
                }))}
                min="1000"
                step="1000"
                className="size-input"
              />
              chars
            </label>
            
            <label>
              AI Tool:
              <select
                value={exportOptions.aiTool}
                onChange={(e) => setExportOptions(prev => ({ 
                  ...prev, 
                  aiTool: e.target.value as any 
                }))}
                className="tool-select"
              >
                <option value="generic">Generic</option>
                <option value="claude">Claude</option>
                <option value="cursor">Cursor</option>
                <option value="copilot">Copilot</option>
              </select>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContextBuilder;