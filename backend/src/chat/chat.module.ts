import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ChatMessage } from './entities/chat-message.entity';
import { LlmUsage } from './entities/llm-usage.entity';
import { ChatMessageService } from './services/chat-message.service';

@Module({
  imports: [TypeOrmModule.forFeature([ChatMessage, LlmUsage])],
  providers: [ChatMessageService],
  exports: [ChatMessageService],
})
export class ChatModule {}
