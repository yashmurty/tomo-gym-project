import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { JwtAuthStrategy } from '../auth/strategies/jwt-auth.strategy';
import { SharedModule } from '../shared/shared.module';
import { AccessTokenController } from './controllers/access-token.controller';
import { PersonalAccessToken } from './entities/personal-access-token.entity';
import { AccessTokenService } from './services/access-token.service';
import { AccessTokenAclService } from './services/access-token-acl.service';

@Module({
  imports: [SharedModule, TypeOrmModule.forFeature([PersonalAccessToken])],
  providers: [AccessTokenService, AccessTokenAclService, JwtAuthStrategy],
  controllers: [AccessTokenController],
  exports: [AccessTokenService],
})
export class AccessTokenModule {}
