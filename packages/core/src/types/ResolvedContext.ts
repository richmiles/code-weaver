export interface FileContext {
  path: string;
  content: string;
  lineRange?: [number, number];
  language?: string;
  metadata?: {
    size: number;
    lastModified: Date;
    gitStatus?: 'M' | 'A' | 'D' | 'R' | '?';
  };
}

export interface DiagnosticContext {
  file: string;
  line: number;
  column: number;
  severity: 'error' | 'warning' | 'info' | 'hint';
  message: string;
  source?: string; // e.g., 'typescript', 'eslint'
  code?: string | number;
}

export interface SymbolContext {
  name: string;
  kind: 'function' | 'class' | 'method' | 'variable' | 'type' | 'interface' | 'enum' | 'constant';
  file: string;
  line: number;
  column: number;
  range?: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  content?: string;
  signature?: string;
  documentation?: string;
  dependencies?: string[];
  usages?: Array<{ file: string; line: number; column: number }>;
  containerName?: string;
}

export interface GitContext {
  diff: string;
  branch?: string;
  commit?: string;
  changedFiles: Array<{
    path: string;
    status: 'M' | 'A' | 'D' | 'R';
    additions: number;
    deletions: number;
  }>;
}

export interface ContextMetadata {
  tokenCount: number;
  fileCount: number;
  symbolCount: number;
  diagnosticCount: number;
  generatedAt: Date;
  projectType?: string; // e.g., 'typescript', 'react', 'node'
  estimatedReadingTime: number; // minutes
}

export interface ResolvedContext {
  files: FileContext[];
  diagnostics: DiagnosticContext[];
  symbols: SymbolContext[];
  git?: GitContext;
  metadata: ContextMetadata;
  rawText?: string; // for terminal output, stack traces etc.
}