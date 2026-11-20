import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { AccessTokenModule } from '../access-token/access-token.module';
import { ChatModule } from '../chat/chat.module';
import { SharedModule } from '../shared/shared.module';
import { UserModule } from '../user/user.module';
import { WorkoutModule } from '../workout/workout.module';
import { McpController } from './controllers/mcp.controller';
import { McpAuthService } from './services/mcp-auth.service';
import { TurnTokenService } from './services/turn-token.service';
import { LogEntryTool } from './tools/log-entry.tool';
import { ToolRegistry } from './tools/tool-registry.service';

@Module({
  imports: [
    SharedModule,
    // Same RS256 keys as login tokens; the scope claim keeps them apart.
    JwtModule.registerAsync({
      imports: [SharedModule],
      useFactory: async (configService: ConfigService) => ({
        publicKey: configService.get<string>('jwt.publicKey'),
        privateKey: configService.get<string>('jwt.privateKey'),
        signOptions: { algorithm: 'RS256' },
        verifyOptions: { algorithms: ['RS256'] },
      }),
      inject: [ConfigService],
    }),
    AccessTokenModule,
    ChatModule,
    UserModule,
    WorkoutModule,
  ],
  providers: [McpAuthService, TurnTokenService, ToolRegistry, LogEntryTool],
  controllers: [McpController],
  exports: [TurnTokenService],
})
export class McpModule {}
