import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { AccessTokenModule } from '../access-token/access-token.module';
import { ActionLogModule } from '../action-log/action-log.module';
import { ChatModule } from '../chat/chat.module';
import { ExerciseModule } from '../exercise/exercise.module';
import { SharedModule } from '../shared/shared.module';
import { UsageModule } from '../usage/usage.module';
import { UserModule } from '../user/user.module';
import { WorkoutModule } from '../workout/workout.module';
import { McpController } from './controllers/mcp.controller';
import { McpAuthService } from './services/mcp-auth.service';
import { TurnTokenService } from './services/turn-token.service';
import {
  DeleteEntryTool,
  GetDayTool,
  GetLastEntryTool,
  MoveEntriesTool,
  QueryHistoryTool,
  SetDayNoteTool,
  UpdateEntryTool,
} from './tools/entry.tools';
import {
  AddExerciseAliasTool,
  CreateExerciseTool,
} from './tools/exercise.tools';
import { LogEntryTool } from './tools/log-entry.tool';
import { GetProfileTool, UpdateProfileTool } from './tools/profile.tools';
import { ToolRegistry } from './tools/tool-registry.service';
import { UndoLastTool } from './tools/undo.tools';

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
    ActionLogModule,
    ChatModule,
    ExerciseModule,
    UsageModule,
    UserModule,
    WorkoutModule,
  ],
  providers: [
    McpAuthService,
    TurnTokenService,
    ToolRegistry,
    LogEntryTool,
    GetDayTool,
    GetLastEntryTool,
    QueryHistoryTool,
    UpdateEntryTool,
    DeleteEntryTool,
    MoveEntriesTool,
    SetDayNoteTool,
    CreateExerciseTool,
    AddExerciseAliasTool,
    GetProfileTool,
    UpdateProfileTool,
    UndoLastTool,
  ],
  controllers: [McpController],
  exports: [TurnTokenService],
})
export class McpModule {}
