import { EventType } from './EventType';
import { SourceType } from './SourceType';

export interface ContextEvent {
  type: EventType;
  sourceId?: string;
  sourceType?: SourceType;
  timestamp: Date;
  data?: unknown;
}