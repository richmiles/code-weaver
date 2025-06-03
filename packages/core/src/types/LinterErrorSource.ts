import { ContextSource } from './ContextSource';
import { SourceType } from './SourceType';

export enum LinterSeverity {
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info',
  HINT = 'hint'
}

export interface LinterLocation {
  filePath: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
}

export interface LinterDiagnostic {
  message: string;
  severity: LinterSeverity;
  code?: string | number; // Error code from linter
  source?: string; // Linter source (eslint, tslint, etc.)
  ruleId?: string; // Specific rule that was violated
  location: LinterLocation;
  relatedInformation?: {
    location: LinterLocation;
    message: string;
  }[];
}

export interface LinterErrorSource extends ContextSource {
  type: SourceType.LINTER_ERROR;
  linterName: string; // Name of the linter (eslint, typescript, etc.)
  diagnostics: LinterDiagnostic[];
  projectPath?: string; // Root path where linting was performed
  configFile?: string; // Path to linter config file used
  totalErrors: number;
  totalWarnings: number;
}