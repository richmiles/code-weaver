import { SourceType } from './SourceType';
import { SizeMetrics } from './SizeMetrics';

export interface ContextSource {
    id: string;
    type: SourceType;
    label: string;
    metadata?: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
    size?: SizeMetrics; // Size information for the source
    tags?: string[]; // User-defined tags for organization
    description?: string; // User-provided description
  }