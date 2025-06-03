import { MessageType } from './MessageType.js';

export interface Message {
  type: MessageType;
  id: string; // Message ID for correlating requests and responses
  timestamp: Date;
  payload?: unknown;
}