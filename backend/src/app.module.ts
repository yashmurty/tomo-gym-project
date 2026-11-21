import { Module } from '@nestjs/common';

import { AccessTokenModule } from './access-token/access-token.module';
import { AgentModule } from './agent/agent.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ArticleModule } from './article/article.module';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { ExerciseModule } from './exercise/exercise.module';
import { McpModule } from './mcp/mcp.module';
import { SharedModule } from './shared/shared.module';
import { UsageModule } from './usage/usage.module';
import { UserModule } from './user/user.module';
import { WorkoutModule } from './workout/workout.module';

@Module({
  imports: [
    SharedModule,
    UserModule,
    AuthModule,
    ArticleModule,
    ExerciseModule,
    WorkoutModule,
    AccessTokenModule,
    ChatModule,
    McpModule,
    AgentModule,
    UsageModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
