import { FileSystemProvider } from '../resolver/ContextResolver.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';

export class NodeFileSystemProvider implements FileSystemProvider {
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = path.resolve(workspaceRoot);
  }

  async readFile(filePath: string): Promise<string> {
    const fullPath = this.resolvePath(filePath);
    try {
      return await fs.readFile(fullPath, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to read file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async listFiles(pattern: string): Promise<string[]> {
    try {
      // Convert pattern to be relative to workspace root
      const searchPattern = this.resolvePath(pattern);
      const files = await glob(searchPattern, {
        ignore: [
          '**/node_modules/**',
          '**/dist/**',
          '**/build/**',
          '**/.git/**',
          '**/coverage/**',
          '**/*.map',
          '**/package-lock.json',
          '**/yarn.lock'
        ],
        nodir: true
      });
      
      // Return paths relative to workspace root
      return files.map(file => path.relative(this.workspaceRoot, file));
    } catch (error) {
      throw new Error(`Failed to list files with pattern ${pattern}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getFileMetadata(filePath: string): Promise<{ size: number; lastModified: Date }> {
    const fullPath = this.resolvePath(filePath);
    try {
      const stats = await fs.stat(fullPath);
      return {
        size: stats.size,
        lastModified: stats.mtime
      };
    } catch (error) {
      throw new Error(`Failed to get metadata for ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private resolvePath(filePath: string): string {
    if (path.isAbsolute(filePath)) {
      return filePath;
    }
    return path.join(this.workspaceRoot, filePath);
  }
}