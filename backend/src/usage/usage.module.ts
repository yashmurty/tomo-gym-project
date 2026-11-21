import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { JwtAuthStrategy } from '../auth/strategies/jwt-auth.strategy';
import { SharedModule } from '../shared/shared.module';
import { AdminUsageController } from './controllers/admin-usage.controller';
import { LlmUsage } from './entities/llm-usage.entity';
import { RateLimitCounter } from './entities/rate-limit-counter.entity';
import { RateLimitGuard } from './rate-limit.guard';
import { BudgetService } from './services/budget.service';
import { LlmUsageService } from './services/llm-usage.service';
import { RateLimitService } from './services/rate-limit.service';
import { UsageAclService } from './services/usage-acl.service';
import { UsageReportService } from './services/usage-report.service';

@Module({
  imports: [
    SharedModule,
    TypeOrmModule.forFeature([LlmUsage, RateLimitCounter]),
  ],
  providers: [
    LlmUsageService,
    RateLimitService,
    BudgetService,
    RateLimitGuard,
    UsageAclService,
    UsageReportService,
    JwtAuthStrategy,
  ],
  controllers: [AdminUsageController],
  exports: [LlmUsageService, RateLimitService, BudgetService, RateLimitGuard],
})
export class UsageModule {}
