import { ContextSource } from './ContextSource';
import { SourceType } from './SourceType';

export interface OpenFileSource extends ContextSource {
  type: SourceType.OPEN_FILE;
  filePath: string;
  languageId?: string;
  isActive?: boolean; // Whether the file is currently focused/active
  tabIndex?: number; // Position in the tab order
  content?: string; // Optional cached content
  isDirty?: boolean; // Whether the file has unsaved changes
  editorUri?: string; // Editor-specific URI/identifier
}