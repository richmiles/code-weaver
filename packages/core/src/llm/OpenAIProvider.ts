import { LLMProvider, LLMConfig, LLMMessage, LLMResponse } from './LLMProvider.js';

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
}

export class OpenAIProvider extends LLMProvider {
  private readonly baseUrl = 'https://api.openai.com/v1/chat/completions';
  
  constructor(config: LLMConfig) {
    super(config);
    if (!config.apiKey) {
      throw new Error('OpenAI API key is required');
    }
  }

  async chat(messages: LLMMessage[]): Promise<LLMResponse> {
    const requestBody = {
      model: this.config.model || 'gpt-4o',
      messages: messages.map(m => ({
        role: m.role,
        content: m.content
      })),
      max_tokens: this.config.maxTokens || 4096,
      temperature: this.config.temperature || 0.7
    };

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${response.status} ${error}`);
      }

      const data: OpenAIResponse = await response.json();
      
      if (!data.choices || data.choices.length === 0) {
        throw new Error('No response from OpenAI API');
      }

      return {
        content: data.choices[0].message.content,
        usage: {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens
        },
        model: data.model
      };
    } catch (error) {
      throw new Error(`Failed to call OpenAI API: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token for GPT models
    return Math.ceil(text.length / 4);
  }

  getMaxContextTokens(): number {
    const model = this.config.model || 'gpt-4o';
    
    // Context limits for different OpenAI models
    if (model.includes('gpt-4o')) return 128000;
    if (model.includes('gpt-4-turbo')) return 128000;
    if (model.includes('gpt-4')) return 8192;
    if (model.includes('gpt-3.5-turbo')) return 16385;
    
    return 128000; // Default to GPT-4o's limit
  }
}