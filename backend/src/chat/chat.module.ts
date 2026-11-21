import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ChatMessage } from './entities/chat-message.entity';
import { ChatMessageService } from './services/chat-message.service';

@Module({
  imports: [TypeOrmModule.forFeature([ChatMessage])],
  providers: [ChatMessageService],
  exports: [ChatMessageService],
})
export class ChatModule {}
