import { ContextSource } from './ContextSource.js';
import { SourceType } from './SourceType.js';

export enum GitStatus {
  UNTRACKED = 'untracked',
  MODIFIED = 'modified',
  ADDED = 'added',
  DELETED = 'deleted',
  RENAMED = 'renamed',
  COPIED = 'copied',
  UNMODIFIED = 'unmodified',
  IGNORED = 'ignored'
}

export interface FileMetadata {
  size: number; // File size in bytes
  lastModified: Date; // Last modification date from filesystem
  encoding?: string; // File encoding (utf8, ascii, etc.)
  gitStatus?: GitStatus; // Git working tree status
  permissions?: string; // File permissions (unix-style)
  checksum?: string; // File content hash for change detection
}

export interface FileSource extends ContextSource {
  type: SourceType.FILE;
  filePath: string;
  languageId?: string;
  content?: string; // Optional cached content
  fileMetadata?: FileMetadata;
}