import { FileSystemProvider } from '../resolver/ContextResolver.js';

export class VSCodeFileSystemProvider implements FileSystemProvider {
  private webSocketClient: any;

  constructor(webSocketClient: any) {
    this.webSocketClient = webSocketClient;
  }

  async readFile(path: string): Promise<string> {
    try {
      const response = await this.webSocketClient.sendMessage({
        type: 'READ_FILE',
        payload: { path }
      });

      if (response.success && response.data) {
        return response.data.content;
      } else {
        throw new Error(response.error || 'Failed to read file');
      }
    } catch (error) {
      throw new Error(`Failed to read file ${path}: ${error}`);
    }
  }

  async listFiles(pattern: string): Promise<string[]> {
    try {
      const response = await this.webSocketClient.sendMessage({
        type: 'LIST_FILES',
        payload: { pattern }
      });

      if (response.success && response.data) {
        return response.data.files;
      } else {
        throw new Error(response.error || 'Failed to list files');
      }
    } catch (error) {
      throw new Error(`Failed to list files with pattern ${pattern}: ${error}`);
    }
  }

  async getFileMetadata(path: string): Promise<{ size: number; lastModified: Date }> {
    try {
      const response = await this.webSocketClient.sendMessage({
        type: 'GET_FILE_METADATA',
        payload: { path }
      });

      if (response.success && response.data) {
        return {
          size: response.data.size,
          lastModified: new Date(response.data.lastModified)
        };
      } else {
        throw new Error(response.error || 'Failed to get file metadata');
      }
    } catch (error) {
      throw new Error(`Failed to get metadata for file ${path}: ${error}`);
    }
  }

  /**
   * Get recently opened files from VS Code
   */
  async getRecentFiles(hoursBack: number = 2): Promise<string[]> {
    try {
      const response = await this.webSocketClient.sendMessage({
        type: 'GET_RECENT_FILES',
        payload: { hoursBack }
      });

      if (response.success && response.data) {
        return response.data.files;
      } else {
        throw new Error(response.error || 'Failed to get recent files');
      }
    } catch (error) {
      throw new Error(`Failed to get recent files: ${error}`);
    }
  }

  /**
   * Get currently open files in VS Code
   */
  async getOpenFiles(): Promise<string[]> {
    try {
      const response = await this.webSocketClient.sendMessage({
        type: 'GET_OPEN_FILES',
        payload: {}
      });

      if (response.success && response.data) {
        return response.data.files;
      } else {
        throw new Error(response.error || 'Failed to get open files');
      }
    } catch (error) {
      throw new Error(`Failed to get open files: ${error}`);
    }
  }
}