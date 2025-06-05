import { GitProvider } from '../resolver/ContextResolver.js';

export class VSCodeGitProvider implements GitProvider {
  private webSocketClient: any;

  constructor(webSocketClient: any) {
    this.webSocketClient = webSocketClient;
  }

  async getDiff(options?: { staged?: boolean; file?: string }): Promise<string> {
    try {
      const response = await this.webSocketClient.sendMessage({
        type: 'GET_GIT_DIFF',
        payload: options || {}
      });

      if (response.success && response.data) {
        return response.data.diff;
      } else {
        throw new Error(response.error || 'Failed to get git diff');
      }
    } catch (error) {
      throw new Error(`Failed to get git diff: ${error}`);
    }
  }

  async getChangedFiles(): Promise<Array<{ path: string; status: 'M' | 'A' | 'D' | 'R'; additions: number; deletions: number }>> {
    try {
      const response = await this.webSocketClient.sendMessage({
        type: 'GET_GIT_STATUS',
        payload: {}
      });

      if (response.success && response.data) {
        return response.data.files;
      } else {
        throw new Error(response.error || 'Failed to get git status');
      }
    } catch (error) {
      throw new Error(`Failed to get changed files: ${error}`);
    }
  }

  async getCurrentBranch(): Promise<string> {
    try {
      const response = await this.webSocketClient.sendMessage({
        type: 'GET_GIT_BRANCH',
        payload: {}
      });

      if (response.success && response.data) {
        return response.data.branch;
      } else {
        throw new Error(response.error || 'Failed to get current branch');
      }
    } catch (error) {
      throw new Error(`Failed to get current branch: ${error}`);
    }
  }

  async getCommitFiles(commit: string): Promise<string[]> {
    try {
      const response = await this.webSocketClient.sendMessage({
        type: 'GET_COMMIT_FILES',
        payload: { commit }
      });

      if (response.success && response.data) {
        return response.data.files;
      } else {
        throw new Error(response.error || 'Failed to get commit files');
      }
    } catch (error) {
      throw new Error(`Failed to get commit files for ${commit}: ${error}`);
    }
  }

  /**
   * Get files changed in a specific branch compared to main
   */
  async getBranchFiles(branch: string, baseBranch: string = 'main'): Promise<string[]> {
    try {
      const response = await this.webSocketClient.sendMessage({
        type: 'GET_BRANCH_FILES',
        payload: { branch, baseBranch }
      });

      if (response.success && response.data) {
        return response.data.files;
      } else {
        throw new Error(response.error || 'Failed to get branch files');
      }
    } catch (error) {
      throw new Error(`Failed to get branch files for ${branch}: ${error}`);
    }
  }

  /**
   * Get the last N commits with their metadata
   */
  async getCommitHistory(limit: number = 10): Promise<Array<{
    hash: string;
    message: string;
    author: string;
    date: Date;
    filesChanged: number;
  }>> {
    try {
      const response = await this.webSocketClient.sendMessage({
        type: 'GET_COMMIT_HISTORY',
        payload: { limit }
      });

      if (response.success && response.data) {
        return response.data.commits.map((commit: any) => ({
          ...commit,
          date: new Date(commit.date)
        }));
      } else {
        throw new Error(response.error || 'Failed to get commit history');
      }
    } catch (error) {
      throw new Error(`Failed to get commit history: ${error}`);
    }
  }
}