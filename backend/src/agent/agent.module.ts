import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { JwtAuthStrategy } from '../auth/strategies/jwt-auth.strategy';
import { ChatModule } from '../chat/chat.module';
import { McpModule } from '../mcp/mcp.module';
import { SharedModule } from '../shared/shared.module';
import { UserModule } from '../user/user.module';
import { WorkoutModule } from '../workout/workout.module';
import { ChatController } from './controllers/chat.controller';
import { LLM_CLIENT, LlmClient } from './llm/llm-client';
import { StubLlmClient } from './llm/stub-llm-client';
import { AgentService } from './services/agent.service';
import { McpEndpoint } from './services/mcp-endpoint';
import { McpToolClient } from './services/mcp-tool-client';

function llmClientFactory(config: ConfigService): LlmClient {
  const provider = config.get<string>('llm.provider');
  if (provider === 'stub') {
    if (config.get<string>('env') === 'production') {
      throw new Error('LLM_PROVIDER=stub is not allowed in production');
    }
    return new StubLlmClient();
  }
  // The Anthropic client lands once an API key is available (roadmap Step 4).
  throw new Error(
    `LLM_PROVIDER '${provider}' is not supported yet; use 'stub'`,
  );
}

@Module({
  imports: [SharedModule, ChatModule, McpModule, UserModule, WorkoutModule],
  providers: [
    AgentService,
    McpToolClient,
    McpEndpoint,
    JwtAuthStrategy,
    {
      provide: LLM_CLIENT,
      useFactory: llmClientFactory,
      inject: [ConfigService],
    },
  ],
  controllers: [ChatController],
})
export class AgentModule {}
