import { SourceType } from './SourceType';

export interface ContextSource {
    id: string;
    type: SourceType;
    label: string;
    metadata?: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
  }