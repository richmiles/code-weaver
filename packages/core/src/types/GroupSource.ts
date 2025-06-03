import { ContextSource } from './ContextSource.js';
import { SourceType } from './SourceType.js';

export interface GroupSource extends ContextSource {
  type: SourceType.GROUP;
  name: string;
  description?: string;
  memberSourceIds: string[]; // References to other sources
}