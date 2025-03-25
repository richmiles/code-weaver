// packages/websocket-server/src/handlers.ts
import { 
  ContextAddPayload,
  ContextRemovePayload,
  ExtensionMessagePayload,
  McpRequestPayload,
  MessageType 
  // Removed unused imports: McpResponsePayload, createMessage
} from './protocol';
import { CodeWeaverWebSocket } from './types.js';

/**
 * Interface for handler response
 */
export interface HandlerResponse {
  shouldBroadcast: boolean;
  excludeSender?: boolean;
}

/**
 * Context item interface to match the one in protocol.ts
 */
interface ContextItem {
  id: string;
  type: string;
  content: string;
  metadata?: Record<string, unknown>;
}

/**
 * Handler map type with proper type casting
 */
export type MessageHandlerMap = {
  [key in MessageType]?: (
    client: CodeWeaverWebSocket, 
    payload: unknown
  ) => Promise<HandlerResponse>;
};

/**
 * Context storage
 */
const contextItems = new Map<string, unknown>();

/**
 * Base handler for context addition
 */
export async function handleContextAdd(
  client: CodeWeaverWebSocket, 
  payload: ContextAddPayload
): Promise<HandlerResponse> {
  try {
    // Store context items
    payload.items.forEach((item: ContextItem) => {
      contextItems.set(item.id, item);
    });
    
    return { shouldBroadcast: true };
  } catch (error) {
    console.error('Error handling context add:', error);
    return { shouldBroadcast: false };
  }
}

/**
 * Base handler for context removal
 */
export async function handleContextRemove(
  client: CodeWeaverWebSocket, 
  payload: ContextRemovePayload
): Promise<HandlerResponse> {
  try {
    // Remove context items
    payload.itemIds.forEach((id: string) => {
      contextItems.delete(id);
    });
    
    return { shouldBroadcast: true };
  } catch (error) {
    console.error('Error handling context remove:', error);
    return { shouldBroadcast: false };
  }
}

/**
 * Base handler for MCP requests
 */
export async function handleMcpRequest(
  client: CodeWeaverWebSocket, 
  payload: McpRequestPayload
): Promise<HandlerResponse> {
  // Stub implementation - will be replaced with actual MCP integration
  // Use console.error for logging to comply with linting rules
  console.error(`MCP request received: ${payload.method}`);
  
  // Echo back a mock response - don't send directly since CodeWeaverWebSocket might not have send method
  // The return value will tell server to broadcast or not
  return { shouldBroadcast: false };
}

/**
 * Base handler for Extension/IDE messages
 */
export async function handleExtensionMessage(
  _client: CodeWeaverWebSocket, 
  _payload: ExtensionMessagePayload
): Promise<HandlerResponse> {
  // Simply forward extension messages
  return { 
    shouldBroadcast: true,
    excludeSender: true
  };
}

/**
 * Type guard to check if a payload is a ContextAddPayload
 */
function isContextAddPayload(payload: unknown): payload is ContextAddPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'items' in payload &&
    Array.isArray((payload as ContextAddPayload).items)
  );
}

/**
 * Type guard to check if a payload is a ContextRemovePayload
 */
function isContextRemovePayload(payload: unknown): payload is ContextRemovePayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'itemIds' in payload &&
    Array.isArray((payload as ContextRemovePayload).itemIds)
  );
}

/**
 * Type guard to check if a payload is a McpRequestPayload
 */
function isMcpRequestPayload(payload: unknown): payload is McpRequestPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'method' in payload &&
    typeof (payload as McpRequestPayload).method === 'string'
  );
}

/**
 * Type guard to check if a payload is an ExtensionMessagePayload
 */
function isExtensionMessagePayload(payload: unknown): payload is ExtensionMessagePayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'source' in payload &&
    'command' in payload &&
    typeof (payload as ExtensionMessagePayload).command === 'string'
  );
}

/**
 * Initialize and return the handler map
 */
export function createHandlerMap(): MessageHandlerMap {
  return {
    [MessageType.CONTEXT_ADD]: async (client, payload) => {
      if (isContextAddPayload(payload)) {
        return handleContextAdd(client, payload);
      }
      console.error('Invalid context add payload');
      return { shouldBroadcast: false };
    },
    [MessageType.CONTEXT_REMOVE]: async (client, payload) => {
      if (isContextRemovePayload(payload)) {
        return handleContextRemove(client, payload);
      }
      console.error('Invalid context remove payload');
      return { shouldBroadcast: false };
    },
    [MessageType.MCP_REQUEST]: async (client, payload) => {
      if (isMcpRequestPayload(payload)) {
        return handleMcpRequest(client, payload);
      }
      console.error('Invalid MCP request payload');
      return { shouldBroadcast: false };
    },
    [MessageType.EXT_MESSAGE]: async (client, payload) => {
      if (isExtensionMessagePayload(payload)) {
        return handleExtensionMessage(client, payload);
      }
      console.error('Invalid extension message payload');
      return { shouldBroadcast: false };
    },
    [MessageType.IDE_MESSAGE]: async (client, payload) => {
      if (isExtensionMessagePayload(payload)) {
        return handleExtensionMessage(client, payload);
      }
      console.error('Invalid IDE message payload');
      return { shouldBroadcast: false };
    },
  };
}