import { LLMProvider, LLMConfig, LLMMessage, LLMResponse } from './LLMProvider.js';

interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ClaudeResponse {
  content: Array<{ text: string; type: 'text' }>;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
  model: string;
}

export class ClaudeProvider extends LLMProvider {
  private readonly baseUrl = 'https://api.anthropic.com/v1/messages';
  
  constructor(config: LLMConfig) {
    super(config);
    if (!config.apiKey) {
      throw new Error('Claude API key is required');
    }
  }

  async chat(messages: LLMMessage[]): Promise<LLMResponse> {
    const claudeMessages = this.convertMessages(messages);
    const systemMessage = messages.find(m => m.role === 'system')?.content;
    
    const requestBody = {
      model: this.config.model || 'claude-3-5-sonnet-20241022',
      max_tokens: this.config.maxTokens || 4096,
      temperature: this.config.temperature || 0.7,
      messages: claudeMessages,
      ...(systemMessage && { system: systemMessage })
    };

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Claude API error: ${response.status} ${error}`);
      }

      const data: ClaudeResponse = await response.json();
      
      return {
        content: data.content.map(c => c.text).join(''),
        usage: {
          promptTokens: data.usage.input_tokens,
          completionTokens: data.usage.output_tokens,
          totalTokens: data.usage.input_tokens + data.usage.output_tokens
        },
        model: data.model
      };
    } catch (error) {
      throw new Error(`Failed to call Claude API: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token for Claude
    return Math.ceil(text.length / 4);
  }

  getMaxContextTokens(): number {
    const model = this.config.model || 'claude-3-5-sonnet-20241022';
    
    // Context limits for different Claude models
    if (model.includes('claude-3-5-sonnet')) return 200000;
    if (model.includes('claude-3-sonnet')) return 200000;
    if (model.includes('claude-3-haiku')) return 200000;
    if (model.includes('claude-3-opus')) return 200000;
    
    return 200000; // Default to Sonnet's limit
  }

  private convertMessages(messages: LLMMessage[]): ClaudeMessage[] {
    return messages
      .filter(m => m.role !== 'system') // System messages handled separately
      .map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }));
  }
}