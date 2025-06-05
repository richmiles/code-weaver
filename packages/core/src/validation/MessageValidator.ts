import { MessageType } from '../types/MessageType.js';
import { Message } from '../types/Message.js';
import { MessageResponse } from '../types/MessageResponse.js';

export class ValidationError extends Error {
  constructor(
    message: string,
    public field?: string,
    public code?: string
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export interface ValidationResult<T> {
  isValid: boolean;
  data?: T;
  errors: ValidationError[];
}

export class MessageValidator {
  /**
   * Validates a raw message object
   */
  static validateMessage(data: unknown): ValidationResult<Message> {
    const errors: ValidationError[] = [];
    
    if (!data || typeof data !== 'object') {
      return {
        isValid: false,
        errors: [new ValidationError('Message must be an object', 'root')]
      };
    }
    
    const obj = data as Record<string, unknown>;
    
    // Validate type
    if (!obj.type || typeof obj.type !== 'string') {
      errors.push(new ValidationError('Message type is required and must be a string', 'type'));
    } else if (!Object.values(MessageType).includes(obj.type as MessageType)) {
      errors.push(new ValidationError(`Invalid message type: ${obj.type}`, 'type', 'INVALID_TYPE'));
    }
    
    // Validate id
    if (!obj.id || typeof obj.id !== 'string') {
      errors.push(new ValidationError('Message ID is required and must be a string', 'id'));
    } else if (obj.id.length < 1 || obj.id.length > 256) {
      errors.push(new ValidationError('Message ID must be between 1-256 characters', 'id', 'INVALID_LENGTH'));
    }
    
    // Validate timestamp
    if (!obj.timestamp) {
      errors.push(new ValidationError('Message timestamp is required', 'timestamp'));
    } else {
      const timestamp = new Date(obj.timestamp as string | number | Date);
      if (isNaN(timestamp.getTime())) {
        errors.push(new ValidationError('Invalid timestamp format', 'timestamp', 'INVALID_FORMAT'));
      } else {
        // Check if timestamp is reasonable (not too far in the past or future)
        const now = Date.now();
        const timestampMs = timestamp.getTime();
        const hourInMs = 60 * 60 * 1000;
        
        if (timestampMs < now - 24 * hourInMs) {
          errors.push(new ValidationError('Timestamp is too far in the past', 'timestamp', 'TIMESTAMP_TOO_OLD'));
        } else if (timestampMs > now + hourInMs) {
          errors.push(new ValidationError('Timestamp is too far in the future', 'timestamp', 'TIMESTAMP_TOO_NEW'));
        }
      }
    }
    
    // Validate payload if present
    if (obj.payload !== undefined) {
      const payloadValidation = this.validatePayload(obj.type as MessageType, obj.payload);
      errors.push(...payloadValidation.errors);
    }
    
    if (errors.length > 0) {
      return { isValid: false, errors };
    }
    
    return {
      isValid: true,
      data: {
        type: obj.type as MessageType,
        id: obj.id as string,
        timestamp: new Date(obj.timestamp as string | number | Date),
        payload: obj.payload
      },
      errors: []
    };
  }
  
  /**
   * Validates message payload based on message type
   */
  static validatePayload(type: MessageType, payload: unknown): ValidationResult<unknown> {
    const errors: ValidationError[] = [];
    
    switch (type) {
      case MessageType.ADD_SOURCE:
        return this.validateAddSourcePayload(payload);
        
      case MessageType.UPDATE_SOURCE:
        return this.validateUpdateSourcePayload(payload);
        
      case MessageType.DELETE_SOURCE:
        return this.validateDeleteSourcePayload(payload);
        
      case MessageType.SET_ACTIVE_CONTEXT:
        return this.validateSetActiveContextPayload(payload);
        
      case MessageType.UPDATE_SOURCE_CONTENT:
      case MessageType.CLEAR_SOURCE_CONTENT:
      case MessageType.GET_SOURCE_CONTENT:
        return this.validateSourceIdPayload(payload);
        
      case MessageType.BROWSE_DIRECTORY:
        return this.validateBrowseDirectoryPayload(payload);
        
      case MessageType.GET_WORKSPACE_TREE:
        return this.validateWorkspaceTreePayload(payload);
        
      case MessageType.SEARCH_FILES:
        return this.validateSearchFilesPayload(payload);
        
      case MessageType.READ_FILE:
        return this.validateReadFilePayload(payload);
        
      default:
        // For message types that don't require specific payload validation
        return { isValid: true, data: payload, errors: [] };
    }
  }
  
  /**
   * Validates ADD_SOURCE payload
   */
  private static validateAddSourcePayload(payload: unknown): ValidationResult<unknown> {
    const errors: ValidationError[] = [];
    
    if (!payload || typeof payload !== 'object') {
      return {
        isValid: false,
        errors: [new ValidationError('ADD_SOURCE payload must be an object', 'payload')]
      };
    }
    
    const source = payload as Record<string, unknown>;
    
    // Validate required fields
    if (!source.type || typeof source.type !== 'string') {
      errors.push(new ValidationError('Source type is required', 'payload.type'));
    }
    
    if (!source.name || typeof source.name !== 'string') {
      errors.push(new ValidationError('Source name is required', 'payload.name'));
    } else if (source.name.length < 1 || source.name.length > 256) {
      errors.push(new ValidationError('Source name must be between 1-256 characters', 'payload.name'));
    }
    
    return { isValid: errors.length === 0, data: payload, errors };
  }
  
  /**
   * Validates UPDATE_SOURCE payload
   */
  private static validateUpdateSourcePayload(payload: unknown): ValidationResult<unknown> {
    const errors: ValidationError[] = [];
    
    if (!payload || typeof payload !== 'object') {
      return {
        isValid: false,
        errors: [new ValidationError('UPDATE_SOURCE payload must be an object', 'payload')]
      };
    }
    
    const update = payload as Record<string, unknown>;
    
    if (!update.id || typeof update.id !== 'string') {
      errors.push(new ValidationError('Source ID is required for update', 'payload.id'));
    }
    
    if (!update.updates || typeof update.updates !== 'object') {
      errors.push(new ValidationError('Updates object is required', 'payload.updates'));
    }
    
    return { isValid: errors.length === 0, data: payload, errors };
  }
  
  /**
   * Validates DELETE_SOURCE payload
   */
  private static validateDeleteSourcePayload(payload: unknown): ValidationResult<unknown> {
    return this.validateSourceIdPayload(payload, 'sourceId');
  }
  
  /**
   * Validates SET_ACTIVE_CONTEXT payload
   */
  private static validateSetActiveContextPayload(payload: unknown): ValidationResult<unknown> {
    const errors: ValidationError[] = [];
    
    if (!payload || typeof payload !== 'object') {
      return {
        isValid: false,
        errors: [new ValidationError('SET_ACTIVE_CONTEXT payload must be an object', 'payload')]
      };
    }
    
    const context = payload as Record<string, unknown>;
    
    if (!Array.isArray(context.sourceIds)) {
      errors.push(new ValidationError('sourceIds must be an array', 'payload.sourceIds'));
    } else {
      context.sourceIds.forEach((id, index) => {
        if (typeof id !== 'string') {
          errors.push(new ValidationError(`sourceIds[${index}] must be a string`, `payload.sourceIds[${index}]`));
        }
      });
    }
    
    return { isValid: errors.length === 0, data: payload, errors };
  }
  
  /**
   * Validates payloads that require a sourceId
   */
  private static validateSourceIdPayload(payload: unknown, idField = 'sourceId'): ValidationResult<unknown> {
    const errors: ValidationError[] = [];
    
    if (!payload || typeof payload !== 'object') {
      return {
        isValid: false,
        errors: [new ValidationError('Payload must be an object', 'payload')]
      };
    }
    
    const obj = payload as Record<string, unknown>;
    
    if (!obj[idField] || typeof obj[idField] !== 'string') {
      errors.push(new ValidationError(`${idField} is required and must be a string`, `payload.${idField}`));
    }
    
    return { isValid: errors.length === 0, data: payload, errors };
  }
  
  /**
   * Validates BROWSE_DIRECTORY payload
   */
  private static validateBrowseDirectoryPayload(payload: unknown): ValidationResult<unknown> {
    const errors: ValidationError[] = [];
    
    if (!payload || typeof payload !== 'object') {
      // Browse directory can work without payload (uses current directory)
      return { isValid: true, data: payload, errors: [] };
    }
    
    const browse = payload as Record<string, unknown>;
    
    if (browse.directoryPath !== undefined && typeof browse.directoryPath !== 'string') {
      errors.push(new ValidationError('directoryPath must be a string', 'payload.directoryPath'));
    }
    
    if (browse.includeHidden !== undefined && typeof browse.includeHidden !== 'boolean') {
      errors.push(new ValidationError('includeHidden must be a boolean', 'payload.includeHidden'));
    }
    
    return { isValid: errors.length === 0, data: payload, errors };
  }
  
  /**
   * Validates GET_WORKSPACE_TREE payload
   */
  private static validateWorkspaceTreePayload(payload: unknown): ValidationResult<unknown> {
    const errors: ValidationError[] = [];
    
    if (payload === undefined || payload === null) {
      return { isValid: true, data: payload, errors: [] };
    }
    
    if (typeof payload !== 'object') {
      return {
        isValid: false,
        errors: [new ValidationError('Workspace tree payload must be an object', 'payload')]
      };
    }
    
    const tree = payload as Record<string, unknown>;
    
    if (tree.maxDepth !== undefined) {
      if (typeof tree.maxDepth !== 'number' || tree.maxDepth < 1 || tree.maxDepth > 10) {
        errors.push(new ValidationError('maxDepth must be a number between 1-10', 'payload.maxDepth'));
      }
    }
    
    if (tree.includeHidden !== undefined && typeof tree.includeHidden !== 'boolean') {
      errors.push(new ValidationError('includeHidden must be a boolean', 'payload.includeHidden'));
    }
    
    return { isValid: errors.length === 0, data: payload, errors };
  }
  
  /**
   * Validates SEARCH_FILES payload
   */
  private static validateSearchFilesPayload(payload: unknown): ValidationResult<unknown> {
    const errors: ValidationError[] = [];
    
    if (!payload || typeof payload !== 'object') {
      return {
        isValid: false,
        errors: [new ValidationError('SEARCH_FILES payload must be an object', 'payload')]
      };
    }
    
    const search = payload as Record<string, unknown>;
    
    if (!search.query || typeof search.query !== 'string') {
      errors.push(new ValidationError('Search query is required', 'payload.query'));
    } else if (search.query.length < 1 || search.query.length > 256) {
      errors.push(new ValidationError('Search query must be between 1-256 characters', 'payload.query'));
    }
    
    if (search.maxResults !== undefined) {
      if (typeof search.maxResults !== 'number' || search.maxResults < 1 || search.maxResults > 1000) {
        errors.push(new ValidationError('maxResults must be a number between 1-1000', 'payload.maxResults'));
      }
    }
    
    return { isValid: errors.length === 0, data: payload, errors };
  }
  
  /**
   * Validates READ_FILE payload
   */
  private static validateReadFilePayload(payload: unknown): ValidationResult<unknown> {
    const errors: ValidationError[] = [];
    
    if (!payload || typeof payload !== 'object') {
      return {
        isValid: false,
        errors: [new ValidationError('READ_FILE payload must be an object', 'payload')]
      };
    }
    
    const read = payload as Record<string, unknown>;
    
    if (!read.filePath || typeof read.filePath !== 'string') {
      errors.push(new ValidationError('File path is required', 'payload.filePath'));
    } else {
      // Basic path traversal protection
      if (read.filePath.includes('..') || read.filePath.includes('~')) {
        errors.push(new ValidationError('Invalid file path - path traversal detected', 'payload.filePath', 'PATH_TRAVERSAL'));
      }
    }
    
    return { isValid: errors.length === 0, data: payload, errors };
  }
  
  /**
   * Validates a response message
   */
  static validateResponse(data: unknown): ValidationResult<MessageResponse> {
    const errors: ValidationError[] = [];
    
    if (!data || typeof data !== 'object') {
      return {
        isValid: false,
        errors: [new ValidationError('Response must be an object', 'root')]
      };
    }
    
    const obj = data as Record<string, unknown>;
    
    // Validate requestId
    if (!obj.requestId || typeof obj.requestId !== 'string') {
      errors.push(new ValidationError('Response requestId is required', 'requestId'));
    }
    
    // Validate success flag
    if (typeof obj.success !== 'boolean') {
      errors.push(new ValidationError('Response success flag is required', 'success'));
    }
    
    // Validate timestamp
    if (!obj.timestamp) {
      errors.push(new ValidationError('Response timestamp is required', 'timestamp'));
    }
    
    // If not successful, validate error
    if (obj.success === false && !obj.error) {
      errors.push(new ValidationError('Error message is required when success is false', 'error'));
    }
    
    if (errors.length > 0) {
      return { isValid: false, errors };
    }
    
    return {
      isValid: true,
      data: obj as unknown as MessageResponse,
      errors: []
    };
  }
  
  /**
   * Type guard for Message
   */
  static isValidMessage(data: unknown): data is Message {
    return this.validateMessage(data).isValid;
  }
  
  /**
   * Type guard for MessageResponse
   */
  static isValidResponse(data: unknown): data is MessageResponse {
    return this.validateResponse(data).isValid;
  }
}