// packages/websocket-server/src/protocol.ts
import { Message } from './types.js';

// Define message types
export enum MessageType {
  // Connection events
  CONNECTION = 'connection',
  DISCONNECT = 'disconnect',
  
  // Basic messaging
  ECHO = 'echo',
  ERROR = 'error',
  
  // Context management
  CONTEXT_ADD = 'context:add',
  CONTEXT_REMOVE = 'context:remove',
  CONTEXT_LIST = 'context:list',
  CONTEXT_CLEAR = 'context:clear',
  
  // Extension communication
  EXT_MESSAGE = 'ext:message',
  IDE_MESSAGE = 'ide:message',
  
  // MCP integration
  MCP_REQUEST = 'mcp:request',
  MCP_RESPONSE = 'mcp:response',
  
  // System events
  PING = 'ping',
  PONG = 'pong',
  
  // Broadcast events
  BROADCAST = 'broadcast'
}

/**
 * Base interface for all protocol payloads
 */
export interface BasePayload {
  timestamp?: number;
  requestId?: string;
}

/**
 * Connection payload
 */
export interface ConnectionPayload extends BasePayload {
  clientId: string;
  message: string;
}

/**
 * Context item interface
 */
export interface ContextItem {
  id: string;
  type: 'file' | 'snippet' | 'folder' | 'custom';
  content: string;
  metadata?: Record<string, unknown>;
}

/**
 * Context management payloads
 */
export interface ContextAddPayload extends BasePayload {
  items: ContextItem[];
}

export interface ContextRemovePayload extends BasePayload {
  itemIds: string[];
}

export interface ContextListPayload extends BasePayload {
  items: ContextItem[];
}

/**
 * Extension/IDE communication payloads
 */
export interface ExtensionMessagePayload extends BasePayload {
  source: 'browser' | 'vscode';
  command: string;
  data: unknown;
}

/**
 * MCP integration payloads
 */
export interface McpRequestPayload extends BasePayload {
  method: string;
  params?: unknown;
}

export interface McpResponsePayload extends BasePayload {
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * Create a typed message with the correct structure
 */
export function createMessage<T extends BasePayload>(
  type: MessageType, 
  payload: T
): Message {
  return {
    type,
    payload: {
      ...payload,
      timestamp: payload.timestamp || Date.now()
    }
  };
}

/**
 * Parse an incoming message with type checking
 */
export function parseMessage(data: string): Message {
  try {
    const message = JSON.parse(data) as Message;
    
    if (typeof message !== 'object' || !message.type || message.payload === undefined) {
      throw new Error('Invalid message format');
    }
    
    return message;
  } catch (error) {
    throw new Error(`Failed to parse message: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Generate a unique request ID for tracking request/response pairs
 */
export function generateRequestId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}