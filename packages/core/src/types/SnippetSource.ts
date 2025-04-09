import { ContextSource } from './ContextSource';
import { SourceType } from './SourceType';

export interface SnippetSource extends ContextSource {
  type: SourceType.SNIPPET;
  sourceFileId: string; // Reference to parent FileSource
  startLine: number;
  endLine: number;
  content?: string; // Optional cached content
}