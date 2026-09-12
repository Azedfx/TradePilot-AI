import { Injectable, Logger } from '@nestjs/common';

export interface McpTool {
  name: string;
  description: string;
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

const DEFAULT_MCP_URL = 'https://datahub.noxiaohao.com/mcp';
const INIT_TIMEOUT = 10_000;
const CALL_TIMEOUT = 20_000;
const CIRCUIT_FAILURES = 2;
const CIRCUIT_COOLDOWN = 60_000;

/**
 * Lightweight MCP (Streamable HTTP) client for the Bitget market-data MCP
 * server. Serialises tool calls to avoid cross-call response bleed, and uses
 * a circuit breaker so that when the hosted server is slow/down the skills
 * fail fast and fall back to direct APIs instead of hanging the research.
 */
@Injectable()
export class McpClientService {
  private readonly logger = new Logger(McpClientService.name);
  private sessionId: string | null = null;
  private sessionPromise: Promise<void> | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private circuitOpenUntil = 0;
  private consecutiveFailures = 0;
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = process.env.MCP_URL ?? DEFAULT_MCP_URL;
  }

  get url(): string {
    return this.baseUrl;
  }

  /** True when the circuit breaker has tripped and MCP is on cooldown. */
  isDown(): boolean {
    return Date.now() < this.circuitOpenUntil;
  }

  listTools(): Promise<McpTool[]> {
    return this.enqueue(async () => {
      if (this.sessionId) {
        try {
          return await this.post({ method: 'tools/list', params: {} }).then(
            (r) => r.result?.tools ?? [],
          );
        } catch {
          /* fall through to resolve-via-init */
        }
      }
      await this.ensureSession();
      return this.post({ method: 'tools/list', params: {} }).then(
        (r) => r.result?.tools ?? [],
      );
    });
  }

  /**
   * Call an MCP tool with a hard wall-clock budget (includes any time spent
   * waiting in the serial queue). Requests that cannot start before the budget
   * expires, or that trip the circuit breaker, fail fast so skills fall back
   * to direct APIs instead of hanging the research.
   */
  async callTool(
    name: string,
    arguments_: object,
    timeoutSeconds = CALL_TIMEOUT / 1000,
  ): Promise<string> {
    if (this.isDown()) {
      throw new Error('MCP unavailable (circuit open); using fallback data');
    }
    const deadline = Date.now() + timeoutSeconds * 1000;
    return this.enqueue(async () => {
      if (Date.now() > deadline) {
        throw new Error(`MCP ${name}: budget exceeded before start`);
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

  private enqueue<T>(
    task: () => Promise<T>,
    deadline = 0,
  ): Promise<T> {
    const run = this.queue.then((value) => {
      if (deadline > 0 && Date.now() > deadline) {
        return Promise.reject(
          new Error('MCP budget exceeded while waiting in queue'),
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
    const response = await fetch(this.baseUrl, {
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
      signal: AbortSignal.timeout(INIT_TIMEOUT),
    });

    if (!response.ok) {
      throw new Error(`MCP init HTTP ${response.status}`);
    }
    const sessionId = response.headers.get('mcp-session-id');
    if (!sessionId) {
      throw new Error('MCP did not return a session id');
    }
    this.sessionId = sessionId;
    await response.text(); // drain body
  }

  private markSuccess(): void {
    this.consecutiveFailures = 0;
  }

  private markFailure(): void {
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= CIRCUIT_FAILURES) {
      this.circuitOpenUntil = Date.now() + CIRCUIT_COOLDOWN;
      this.logger.warn(
        `MCP circuit opened for ${CIRCUIT_COOLDOWN / 1000}s after ${CIRCUIT_FAILURES} failures`,
      );
    }
  }

  private async post(payload: object, deadline = 0): Promise<McpResponse> {
    if (!this.sessionId) await this.ensureSession();

    const remaining =
      deadline > 0
        ? Math.max(1_000, deadline - Date.now())
        : CALL_TIMEOUT;
    const response = await fetch(this.baseUrl, {
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
      throw new Error(`MCP HTTP ${response.status}`);
    }

    const raw = await response.text();
    const dataLine = raw
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.startsWith('data:'));
    if (!dataLine) {
      throw new Error(`MCP unexpected payload`);
    }
    const json = JSON.parse(dataLine.slice(5).trim()) as McpResponse;
    if (json.error) {
      throw new Error(
        `MCP jsonrpc error ${json.error.code}: ${json.error.message}`,
      );
    }
    return json;
  }
}