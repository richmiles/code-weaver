export enum ExportFormat {
  PLAIN_TEXT = 'plain_text',
  MARKDOWN = 'markdown',
  JSON = 'json',
  ZIP_ARCHIVE = 'zip_archive',
  MCP_DIRECT = 'mcp_direct',
  CLIPBOARD = 'clipboard',
  FILE_DOWNLOAD = 'file_download'
}

export interface ExportOptions {
  format: ExportFormat;
  includeMetadata?: boolean;
  includeTimestamps?: boolean;
  filenameSeparator?: string; // For multi-file exports
  compressionLevel?: number; // For ZIP exports
  prettifyJson?: boolean; // For JSON exports
  markdownStyle?: 'github' | 'commonmark' | 'custom';
}

export interface ExportResult {
  success: boolean;
  format: ExportFormat;
  content?: string | ArrayBuffer; // Text content or binary data
  filename?: string;
  mimeType?: string;
  size: number; // Size in bytes
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface ContextBundle {
  id: string;
  name: string;
  description?: string;
  sources: string[]; // Array of source IDs
  exportOptions: ExportOptions;
  createdAt: Date;
  size: {
    totalCharacters: number;
    totalTokens: number;
    totalBytes: number;
  };
}