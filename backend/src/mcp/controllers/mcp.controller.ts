import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import {
  Controller,
  Delete,
  Get,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExcludeEndpoint,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request, Response } from 'express';

import { McpAuthService, McpCaller } from '../services/mcp-auth.service';
import { ToolRegistry } from '../tools/tool-registry.service';

// tomo's MCP server (Streamable HTTP, stateless): the one tool surface for
// our own agent loop and for external MCP clients (constitution rule 4).
// Each POST gets a fresh server bound to the authenticated caller.
@ApiTags('mcp')
@Controller('mcp')
export class McpController {
  constructor(
    private readonly auth: McpAuthService,
    private readonly registry: ToolRegistry,
  ) {}

  @Post()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'MCP endpoint (JSON-RPC over Streamable HTTP)',
    description:
      'Accepts a personal access token or a turn token. Login tokens are rejected.',
  })
  async handle(@Req() req: Request, @Res() res: Response): Promise<void> {
    // Throws 401 before anything is written to the response.
    const caller = await this.auth.authenticate(req);

    const server = this.buildServer(caller);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless
      enableJsonResponse: true,
    });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  }

  // Stateless server: no server-initiated SSE stream and no sessions.
  @Get()
  @ApiExcludeEndpoint()
  methodNotAllowedGet(@Res() res: Response): void {
    res.status(HttpStatus.METHOD_NOT_ALLOWED).set('Allow', 'POST').end();
  }

  @Delete()
  @ApiExcludeEndpoint()
  methodNotAllowedDelete(@Res() res: Response): void {
    res.status(HttpStatus.METHOD_NOT_ALLOWED).set('Allow', 'POST').end();
  }

  private buildServer(caller: McpCaller): Server {
    const server = new Server(
      { name: 'tomo-gym', version: '1.0.0' },
      { capabilities: { tools: {} } },
    );

    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.registry.list(),
    }));

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const outcome = await this.registry.call(
        request.params.name,
        request.params.arguments,
        {
          ctx: caller.ctx,
          origin: caller.originForCall(),
          undoScope: caller.undoScope,
        },
      );
      if (!outcome.ok) {
        return {
          content: [{ type: 'text' as const, text: outcome.error }],
          isError: true,
        };
      }
      return {
        content: [
          { type: 'text' as const, text: JSON.stringify(outcome.result) },
        ],
        structuredContent: outcome.result as Record<string, unknown>,
      };
    });

    return server;
  }
}
