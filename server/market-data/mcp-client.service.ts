import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { McpHttpClient, McpTool } from './mcp-http.client';

export type { McpTool } from './mcp-http.client';

const DEFAULT_SIGNAL_MCP_URL = 'https://datahub.noxiaohao.com/mcp';

/**
 * Bitget Signal / datahub MCP (`MCP_URL`).
 * Handbook name: `bitget-signal` — crypto macro / sentiment / news / TA /
 * TradFi news bridge. Track 3 perception layer (crypto-side Skills).
 */
@Injectable()
export class McpClientService implements OnModuleInit {
  private readonly logger = new Logger(McpClientService.name);
  private readonly client: McpHttpClient;

  constructor() {
    const url = process.env.MCP_URL ?? DEFAULT_SIGNAL_MCP_URL;
    this.client = new McpHttpClient(url, {
      label: 'bitget-signal',
      initTimeoutMs: 10_000,
      callTimeoutMs: 20_000,
    });
  }

  onModuleInit(): void {
    this.logger.log(`bitget-signal MCP → ${this.client.url}`);
  }

  get url(): string {
    return this.client.url;
  }

  get label(): string {
    return this.client.label;
  }

  isDown(): boolean {
    return this.client.isDown();
  }

  listTools(): Promise<McpTool[]> {
    return this.client.listTools();
  }

  callTool(
    name: string,
    arguments_: object,
    timeoutSeconds?: number,
  ): Promise<string> {
    return this.client.callTool(name, arguments_, timeoutSeconds);
  }
}
