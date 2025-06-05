import { GitProvider } from '../resolver/ContextResolver.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class NodeGitProvider implements GitProvider {
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  async getDiff(options?: { staged?: boolean; file?: string }): Promise<string> {
    try {
      let command = 'git diff';
      
      if (options?.staged) {
        command += ' --staged';
      }
      
      if (options?.file) {
        command += ` -- ${options.file}`;
      }
      
      const { stdout } = await execAsync(command, { cwd: this.workspaceRoot });
      return stdout;
    } catch (error) {
      throw new Error(`Failed to get git diff: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getChangedFiles(): Promise<Array<{ path: string; status: 'M' | 'A' | 'D' | 'R'; additions: number; deletions: number }>> {
    try {
      const { stdout } = await execAsync('git status --porcelain', { cwd: this.workspaceRoot });
      const files: Array<{ path: string; status: 'M' | 'A' | 'D' | 'R'; additions: number; deletions: number }> = [];
      
      const lines = stdout.trim().split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        const statusCode = line.substring(0, 2);
        const filePath = line.substring(3);
        
        let status: 'M' | 'A' | 'D' | 'R' = 'M';
        if (statusCode.includes('A')) status = 'A';
        else if (statusCode.includes('D')) status = 'D';
        else if (statusCode.includes('R')) status = 'R';
        
        // Get file diff stats
        let additions = 0;
        let deletions = 0;
        
        try {
          const { stdout: diffStat } = await execAsync(`git diff --numstat HEAD -- "${filePath}"`, { cwd: this.workspaceRoot });
          const [addStr, delStr] = diffStat.trim().split('\t');
          if (addStr !== '-') additions = parseInt(addStr) || 0;
          if (delStr !== '-') deletions = parseInt(delStr) || 0;
        } catch {
          // If we can't get stats, continue with 0s
        }
        
        files.push({
          path: filePath,
          status,
          additions,
          deletions
        });
      }
      
      return files;
    } catch (error) {
      throw new Error(`Failed to get changed files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getCurrentBranch(): Promise<string> {
    try {
      const { stdout } = await execAsync('git branch --show-current', { cwd: this.workspaceRoot });
      return stdout.trim();
    } catch (error) {
      throw new Error(`Failed to get current branch: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getCommitFiles(commit: string): Promise<string[]> {
    try {
      const { stdout } = await execAsync(`git diff-tree --no-commit-id --name-only -r ${commit}`, { cwd: this.workspaceRoot });
      return stdout.trim().split('\n').filter(line => line.trim());
    } catch (error) {
      throw new Error(`Failed to get commit files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}