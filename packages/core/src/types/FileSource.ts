import { ContextSource } from './ContextSource';
import { SourceType } from './SourceType';

export interface FileSource extends ContextSource {
  type: SourceType.FILE;
  filePath: string;
  languageId?: string;
  content?: string; // Optional cached content
}