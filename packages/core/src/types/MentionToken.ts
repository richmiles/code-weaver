export interface MentionToken {
  type: 'file' | 'function' | 'class' | 'method' | 'type' | 'interface' | 'variable' | 'error' | 'diff' | 'stack' | 'test' | 'deps' | 'imports' | 'exports' | 'folder' | 'directory' | 'recent' | 'open' | 'modified' | 'branch' | 'commit' | 'group' | 'recipe' | 'template';
  value: string;
  params?: Record<string, string>; // e.g., line ranges, filters, time periods
  position: [number, number]; // start/end position in text
  raw: string; // original mention text
}

export interface MentionSuggestion {
  type: MentionToken['type'];
  value: string;
  label: string;
  description?: string;
  icon?: string;
  metadata?: {
    fileCount?: number;
    errorCount?: number;
    usageCount?: number;
    lineCount?: number;
    tokenCount?: number;
    lastModified?: Date;
    size?: number;
    file?: string;
    signature?: string;
    [key: string]: any;
  };
  priority?: number; // for sorting suggestions
}

export interface MentionContext {
  currentFile?: string;
  cursorPosition?: { line: number; character: number };
  openFiles?: string[];
  recentFiles?: string[];
  recentMentions?: MentionToken[];
  currentWorkspace?: string;
  workspaceRoot?: string;
  hasErrors?: boolean;
  hasDiff?: boolean;
  hasFailingTests?: boolean;
}