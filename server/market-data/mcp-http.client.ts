import { Logger } from '@nestjs/common';

export interface McpTool {
  name: string;
  description: string;
  inputSchema?: unknown;
}

interface McpResponse {
  jsonrpc: string;
  id?: number | string;
  result?: {
    tools?: McpTool[];
    content?: { type: string; text: string }[];
    isError?: boolean;
  };
  error?: {
    code: number;
    message: string;
  };
}

export interface McpHttpClientOptions {
  /** Display / source label (e.g. bitget-signal, bitget-mcp-server). */
  label: string;
  initTimeoutMs?: number;
  callTimeoutMs?: number;
  circuitFailures?: number;
  circuitCooldownMs?: number;
}

/**
 * Lightweight MCP Streamable-HTTP transport. Used for both handbook MCPs:
 * - bitget-signal  → https://datahub.noxiaohao.com/mcp
 * - bitget-mcp-server → https://agent.bitget.com/mcp
 */
export class McpHttpClient {
  private readonly logger: Logger;
  private sessionId: string | null = null;
  private sessionPromise: Promise<void> | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private circuitOpenUntil = 0;
  private consecutiveFailures = 0;
  private readonly initTimeout: number;
  private readonly callTimeout: number;
  private readonly circuitFailures: number;
  private readonly circuitCooldown: number;
  readonly label: string;
  readonly url: string;

  constructor(url: string, options: McpHttpClientOptions) {
    this.url = url;
    this.label = options.label;
    this.logger = new Logger(`McpHttp(${options.label})`);
    this.initTimeout = options.initTimeoutMs ?? 10_000;
    this.callTimeout = options.callTimeoutMs ?? 20_000;
    this.circuitFailures = options.circuitFailures ?? 2;
    this.circuitCooldown = options.circuitCooldownMs ?? 60_000;
  }

  isDown(): boolean {
    return Date.now() < this.circuitOpenUntil;
  }

  /** Open the circuit immediately (e.g. after listTools fails). */
  tripCircuit(reason?: string): void {
    this.circuitOpenUntil = Date.now() + this.circuitCooldown;
    this.logger.warn(
      `circuit tripped for ${this.circuitCooldown / 1000}s${
        reason ? `: ${reason}` : ''
      } (${this.url})`,
    );
  }

  listTools(): Promise<McpTool[]> {
    return this.enqueue(async () => {
      if (this.sessionId) {
        try {
          return await this.post({ method: 'tools/list', params: {} }).then(
            (r) => r.result?.tools ?? [],
          );
        } catch {
          /* fall through */
        }
      }
      await this.ensureSession();
      return this.post({ method: 'tools/list', params: {} }).then(
        (r) => r.result?.tools ?? [],
      );
    });
  }

  async callTool(
    name: string,
    arguments_: object,
    timeoutSeconds = this.callTimeout / 1000,
  ): Promise<string> {
    if (this.isDown()) {
      throw new Error(
        `${this.label} unavailable (circuit open); using fallback data`,
      );
    }
    const deadline = Date.now() + timeoutSeconds * 1000;
    return this.enqueue(async () => {
      if (Date.now() > deadline) {
        throw new Error(`${this.label} ${name}: budget exceeded before start`);
      }
      try {
        await this.ensureSession();
        const text = await this.callWithSession(name, arguments_, deadline);
        this.markSuccess();
        return text;
      } catch (error) {
        this.markFailure();
        throw error;
      }
    }, deadline);
  }

  private enqueue<T>(task: () => Promise<T>, deadline = 0): Promise<T> {
    const run = this.queue.then(() => {
      if (deadline > 0 && Date.now() > deadline) {
        return Promise.reject(
          new Error(
            `${this.label} budget exceeded while waiting in queue`,
          ),
        );
      }
      return task();
    });
    this.queue = run.catch(() => undefined);
    return run as Promise<T>;
  }

  private async callWithSession(
    name: string,
    arguments_: object,
    deadline: number,
  ): Promise<string> {
    if (!this.sessionId) await this.ensureSession();
    const response = await this.post(
      {
        method: 'tools/call',
        params: { name, arguments: arguments_ },
      },
      deadline,
    );
    if (response.error) {
      throw new Error(`${name}: ${response.error.message}`);
    }
    const content = response.result?.content?.[0]?.text;
    if (!content) {
      throw new Error(`${name}: empty response`);
    }
    return content;
  }

  private async ensureSession(): Promise<void> {
    if (this.sessionId) return;
    if (this.sessionPromise) {
      await this.sessionPromise;
      return;
    }
    this.sessionPromise = this.initSession().finally(() => {
      this.sessionPromise = null;
    });
    await this.sessionPromise;
  }

  private async initSession(): Promise<void> {
    const response = await fetch(this.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'tradepilot-backend', version: '0.1.0' },
        },
      }),
      signal: AbortSignal.timeout(this.initTimeout),
    });

    if (!response.ok) {
      throw new Error(`${this.label} init HTTP ${response.status}`);
    }
    const sessionId = response.headers.get('mcp-session-id');
    if (!sessionId) {
      throw new Error(`${this.label} did not return a session id`);
    }
    this.sessionId = sessionId;
    await response.text();
  }

  private markSuccess(): void {
    this.consecutiveFailures = 0;
  }

  private markFailure(): void {
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.circuitFailures) {
      this.circuitOpenUntil = Date.now() + this.circuitCooldown;
      this.logger.warn(
        `circuit opened for ${this.circuitCooldown / 1000}s after ${this.circuitFailures} failures (${this.url})`,
      );
    }
  }

  private async post(payload: object, deadline = 0): Promise<McpResponse> {
    if (!this.sessionId) await this.ensureSession();

    const remaining =
      deadline > 0
        ? Math.max(1_000, deadline - Date.now())
        : this.callTimeout;
    const response = await fetch(this.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'Mcp-Session-Id': this.sessionId!,
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), ...payload }),
      signal: AbortSignal.timeout(remaining),
    });

    if (!response.ok) {
      this.sessionId = null;
      throw new Error(`${this.label} HTTP ${response.status}`);
    }

    const raw = await response.text();
    const dataLine = raw
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.startsWith('data:'));
    if (!dataLine) {
      throw new Error(`${this.label} unexpected payload`);
    }
    const json = JSON.parse(dataLine.slice(5).trim()) as McpResponse;
    if (json.error) {
      throw new Error(
        `${this.label} jsonrpc error ${json.error.code}: ${json.error.message}`,
      );
    }
    return json;
  }
}
