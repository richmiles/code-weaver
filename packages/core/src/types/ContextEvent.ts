import { EventType } from './EventType.js';
import { SourceType } from './SourceType.js';

export interface ContextEvent {
  type: EventType;
  sourceId?: string;
  sourceType?: SourceType;
  timestamp: Date;
  data?: unknown;
}