export interface LLMConfig {
  provider: 'claude' | 'openai';
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
}

export abstract class LLMProvider {
  protected config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  abstract chat(messages: LLMMessage[]): Promise<LLMResponse>;
  abstract estimateTokens(text: string): number;
  abstract getMaxContextTokens(): number;
}