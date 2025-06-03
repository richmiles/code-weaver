import { ContextSource } from './ContextSource.js';
import { SourceType } from './SourceType.js';

export interface SnippetSource extends ContextSource {
  type: SourceType.SNIPPET;
  sourceFileId: string; // Reference to parent FileSource
  startLine: number;
  endLine: number;
  content?: string; // Optional cached content
}