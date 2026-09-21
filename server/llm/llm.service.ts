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
  /** Per-call timeout override (ms). Default 45s for desk responsiveness. */
  timeoutMs?: number;
  /** Max attempts override (default 2). */
  maxAttempts?: number;
}

export interface LlmProviderConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

const DEFAULT_TIMEOUT_MS = 45_000;

/**
 * LLM service - centralised interface to the language model provider.
 * Falls back to a deterministic placeholder so the app runs without keys.
 * When QWEN_API_KEY is set it calls the Bitget-hosted Qwen proxy
 * (https://hackathon.bitgetops.com/v1, OpenAI-compatible) with qwen3.8-max.
 */
@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  readonly baseUrl =
    process.env.QWEN_BASE_URL ?? 'https://hackathon.bitgetops.com/v1';
  readonly defaultModel = process.env.QWEN_MODEL ?? 'qwen3.8-max';

  constructor() {
    this.logger.log(`LLM provider: ${this.provider}`);
  }

  get provider(): string {
    if (process.env.LLM_PROVIDER && process.env.LLM_PROVIDER !== 'placeholder') {
      return process.env.LLM_PROVIDER;
    }
    return process.env.QWEN_API_KEY ? 'qwen' : 'placeholder';
  }

  get qwenConfig(): LlmProviderConfig | null {
    const apiKey = process.env.QWEN_API_KEY;
    if (!apiKey) return null;
    return { baseUrl: this.baseUrl, apiKey, model: this.defaultModel };
  }

  async complete(
    messages: LlmMessage[],
    options: LlmOptions = {},
  ): Promise<string> {
    if (this.provider === 'placeholder') {
      const last = messages[messages.length - 1]?.content ?? '';
      this.logger.debug(`Placeholder LLM reply to: ${last.slice(0, 80)}...`);
      return `[placeholder response] ${last.slice(0, 120)}`;
    }

    if (this.provider !== 'qwen') {
      throw new Error(
        `LLM_PROVIDER "${this.provider}" is configured but not yet implemented.`,
      );
    }

    const config = this.qwenConfig;
    if (!config) {
      throw new Error('QWEN_API_KEY is required for the qwen provider.');
    }

    const maxAttempts = options.maxAttempts ?? 2;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this.qwenChat(config, messages, options);
      } catch (error) {
        lastError = error;
        this.logger.warn(`Qwen attempt ${attempt}/${maxAttempts} failed: ${messageOf(error)}`);
        const retriable = isRetriable(error);
        if (attempt === maxAttempts || !retriable) {
          throw lastError;
        }
        await new Promise((r) => setTimeout(r, 800 * attempt));
      }
    }
    throw lastError;
  }

  private async qwenChat(
    config: LlmProviderConfig,
    messages: LlmMessage[],
    options: LlmOptions,
  ): Promise<string> {
    const controller = new AbortController();
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(
        `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`,
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: options.model ?? config.model,
            messages,
            temperature: options.temperature ?? 0.2,
            max_tokens: options.maxTokens ?? 2048,
            ...(options.jsonMode
              ? { response_format: { type: 'json_object' } }
              : {}),
          }),
        },
      );

      const text = await response.text();
      let body: unknown;
      try {
        body = JSON.parse(text);
      } catch {
        const error = new Error(
          `Qwen returned non-JSON (HTTP ${response.status}): ${text.slice(0, 200)}`,
        ) as Error & { status?: number };
        error.status = response.status;
        throw error;
      }

      if (!response.ok) {
        const message =
          (body as { error?: { message?: string } })?.error?.message ??
          text.slice(0, 200);
        const error = new Error(
          `Qwen API error ${response.status}: ${message}`,
        ) as Error & { status?: number };
        error.status = response.status;
        throw error;
      }

      const content = (
        body as {
          choices?: { message?: { role?: string; content?: string } }[];
        }
      )?.choices?.[0]?.message?.content;
      if (!content) {
        this.logger.warn(`Qwen empty content; body: ${text.slice(0, 300)}`);
        throw new Error('Qwen returned no content in response.');
      }
      return content;
    } finally {
      clearTimeout(timer);
    }
  }
}

function messageOf(error: unknown): string {
  if (error instanceof DOMException || error instanceof TypeError) {
    return error.message;
  }
  return error instanceof Error ? error.message : String(error);
}

function isRetriable(error: unknown): boolean {
  if (error instanceof DOMException || error instanceof TypeError) return true;
  const status = (error as Error & { status?: number })?.status;
  return status === undefined || status === 429 || status >= 500;
}
