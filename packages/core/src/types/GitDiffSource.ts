import { ContextSource } from './ContextSource';
import { SourceType } from './SourceType';

export enum GitDiffType {
  WORKING_TREE = 'working_tree',
  STAGED = 'staged',
  COMMIT_RANGE = 'commit_range',
  BRANCH_COMPARISON = 'branch_comparison'
}

export enum GitChangeType {
  ADDED = 'added',
  MODIFIED = 'modified',
  DELETED = 'deleted',
  RENAMED = 'renamed',
  COPIED = 'copied'
}

export interface GitFileChange {
  filePath: string;
  changeType: GitChangeType;
  oldPath?: string; // For renames/copies
  linesAdded: number;
  linesDeleted: number;
}

export interface GitDiffSource extends ContextSource {
  type: SourceType.GIT_DIFF;
  diffType: GitDiffType;
  baseRef?: string; // Base commit/branch for comparison
  targetRef?: string; // Target commit/branch for comparison
  diffContent: string; // Raw diff content
  affectedFiles: GitFileChange[];
  repository?: string; // Repository path or identifier
  branch?: string; // Current branch
}