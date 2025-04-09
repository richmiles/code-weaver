import { ContextSource } from './ContextSource';
import { SourceType } from './SourceType';

export interface DirectorySource extends ContextSource {
  type: SourceType.DIRECTORY;
  dirPath: string;
  recursive: boolean;
  respectGitignore: boolean;
  includePatterns?: string[];
  excludePatterns?: string[];
  listing?: string[]; // Optional cached directory listing
}