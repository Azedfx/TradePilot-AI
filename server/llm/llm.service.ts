import { Injectable, Logger } from '@nestjs/common';

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
  jsonMode?: boolean;
}

/**
 * LLM service - centralised interface to the language model provider.
 * Defaults to a deterministic placeholder so the app runs without keys;
 * swap the `complete()` body for a real provider (OpenAI, Anthropic, etc.).
 */
@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor() {
    this.logger.log(
      `LLM provider: ${process.env.LLM_PROVIDER ?? 'placeholder'}`,
    );
  }

  get provider(): string {
    return process.env.LLM_PROVIDER ?? 'placeholder';
  }

  async complete(
    messages: LlmMessage[],
    options: LlmOptions = {},
  ): Promise<string> {
    if (this.provider !== 'placeholder') {
      return this.callRealProvider(messages, options);
    }

    const last = messages[messages.length - 1]?.content ?? '';
    this.logger.debug(
      `Placeholder LLM reply to: ${last.slice(0, 80)}...`,
    );
    return `[placeholder response] ${last.slice(0, 120)}`;
  }

  private async callRealProvider(
    messages: LlmMessage[],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    options: LlmOptions = {},
  ): Promise<string> {
    // TODO: implement provider SDK call (OpenAI/Anthropic) here
    throw new Error(
      `LLM_PROVIDER "${this.provider}" is configured but not yet implemented.`,
    );
  }
}
