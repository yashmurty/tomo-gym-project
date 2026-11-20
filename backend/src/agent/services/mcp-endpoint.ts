import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// The URL of tomo's own MCP server, as seen by the agent loop. A class so
// e2e tests can point it at the port their app actually listens on.
@Injectable()
export class McpEndpoint {
  constructor(private readonly config: ConfigService) {}

  url(): string {
    return this.config.get<string>('mcp.internalUrl')!;
  }
}
