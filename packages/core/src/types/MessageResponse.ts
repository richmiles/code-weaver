export interface MessageResponse {
  requestId: string; // ID of the original request message
  success: boolean;
  data?: unknown;
  error?: string;
  timestamp: Date;
}