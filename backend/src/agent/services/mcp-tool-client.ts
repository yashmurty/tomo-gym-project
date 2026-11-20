import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Injectable } from '@nestjs/common';

import { McpEndpoint } from './mcp-endpoint';

export interface McpToolDefinition {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

export interface McpToolCallResult {
  text: string;
  isError: boolean;
}

export interface McpSession {
  listTools(): Promise<McpToolDefinition[]>;
  callTool(name: string, args: unknown): Promise<McpToolCallResult>;
  close(): Promise<void>;
}

// Our agent loop is an MCP client of tomo's own MCP server, over HTTP, like
// any external client (constitution rule 4). The turn token rides on every
// request; it's the only credential the agent holds for /mcp.
@Injectable()
export class McpToolClient {
  constructor(private readonly endpoint: McpEndpoint) {}

  async connect(turnToken: string): Promise<McpSession> {
    const client = new Client({ name: 'tomo-agent', version: '1.0.0' });
    const transport = new StreamableHTTPClientTransport(
      new URL(this.endpoint.url()),
      {
        requestInit: { headers: { Authorization: `Bearer ${turnToken}` } },
      },
    );
    await client.connect(transport);

    return {
      listTools: async () => {
        const { tools } = await client.listTools();
        return tools.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema as Record<string, unknown>,
        }));
      },
      callTool: async (name, args) => {
        const result = await client.callTool({
          name,
          arguments: (args ?? {}) as Record<string, unknown>,
        });
        const blocks = (result.content ?? []) as {
          type: string;
          text?: string;
        }[];
        return {
          text: blocks
            .filter((b) => b.type === 'text')
            .map((b) => b.text ?? '')
            .join('\n'),
          isError: result.isError === true,
        };
      },
      close: () => client.close(),
    };
  }
}
