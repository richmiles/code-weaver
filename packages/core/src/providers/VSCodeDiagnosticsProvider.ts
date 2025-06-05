import { DiagnosticsProvider } from '../resolver/ContextResolver.js';
import { DiagnosticContext } from '../types/ResolvedContext.js';

export class VSCodeDiagnosticsProvider implements DiagnosticsProvider {
  private webSocketClient: any;

  constructor(webSocketClient: any) {
    this.webSocketClient = webSocketClient;
  }

  async getDiagnostics(file?: string): Promise<DiagnosticContext[]> {
    try {
      const response = await this.webSocketClient.sendMessage({
        type: 'GET_DIAGNOSTICS',
        payload: { file }
      });

      if (response.success && response.data) {
        return response.data.diagnostics.map((diag: any) => ({
          file: diag.file,
          line: diag.line,
          column: diag.column,
          severity: this.mapSeverity(diag.severity),
          message: diag.message,
          code: diag.code,
          source: diag.source || 'vscode'
        }));
      } else {
        throw new Error(response.error || 'Failed to get diagnostics');
      }
    } catch (error) {
      throw new Error(`Failed to get diagnostics: ${error}`);
    }
  }

  /**
   * Get only error-level diagnostics
   */
  async getErrors(file?: string): Promise<DiagnosticContext[]> {
    const allDiagnostics = await this.getDiagnostics(file);
    return allDiagnostics.filter(diag => diag.severity === 'error');
  }

  /**
   * Get only warning-level diagnostics
   */
  async getWarnings(file?: string): Promise<DiagnosticContext[]> {
    const allDiagnostics = await this.getDiagnostics(file);
    return allDiagnostics.filter(diag => diag.severity === 'warning');
  }

  /**
   * Get diagnostic summary for quick context
   */
  async getDiagnosticSummary(): Promise<{
    errorCount: number;
    warningCount: number;
    infoCount: number;
    fileCount: number;
    topErrorFiles: string[];
  }> {
    try {
      const response = await this.webSocketClient.sendMessage({
        type: 'GET_DIAGNOSTIC_SUMMARY',
        payload: {}
      });

      if (response.success && response.data) {
        return response.data;
      } else {
        throw new Error(response.error || 'Failed to get diagnostic summary');
      }
    } catch (error) {
      throw new Error(`Failed to get diagnostic summary: ${error}`);
    }
  }

  private mapSeverity(vsSeverity: number): 'error' | 'warning' | 'info' | 'hint' {
    switch (vsSeverity) {
      case 0: return 'error';
      case 1: return 'warning';
      case 2: return 'info';
      case 3: return 'hint';
      default: return 'info';
    }
  }
}