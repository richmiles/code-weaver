import { ContextSource } from './ContextSource';
import { SourceType } from './SourceType';
import { GitStatus } from './FileSource';

export interface DirectoryEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  lastModified?: Date;
  gitStatus?: GitStatus;
}

export interface DirectoryMetadata {
  totalFiles: number;
  totalDirectories: number;
  totalSize: number; // Total size in bytes
  lastScanned: Date;
  gitRepository?: boolean; // Whether this directory is in a git repo
  packageFile?: string; // package.json, Cargo.toml, etc.
}

export interface DirectorySource extends ContextSource {
  type: SourceType.DIRECTORY;
  dirPath: string;
  recursive: boolean;
  respectGitignore: boolean;
  includePatterns?: string[];
  excludePatterns?: string[];
  listing?: DirectoryEntry[]; // Enhanced directory listing
  directoryMetadata?: DirectoryMetadata;
}