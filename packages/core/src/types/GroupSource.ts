import { ContextSource } from './ContextSource';
import { SourceType } from './SourceType';

export interface GroupSource extends ContextSource {
  type: SourceType.GROUP;
  name: string;
  description?: string;
  memberSourceIds: string[]; // References to other sources
}