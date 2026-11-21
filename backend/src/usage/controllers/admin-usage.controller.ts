import { Controller, Get, HttpStatus, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import {
  BaseApiResponse,
  SwaggerBaseApiResponse,
} from '../../shared/dtos/base-api-response.dto';
import { ReqContext } from '../../shared/request-context/req-context.decorator';
import { RequestContext } from '../../shared/request-context/request-context.dto';
import { UsageReportOutput, UsageReportQuery } from '../dtos/usage-report.dto';
import { UsageReportService } from '../services/usage-report.service';

@ApiTags('admin')
@Controller('admin/usage')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AdminUsageController {
  constructor(private readonly reports: UsageReportService) {}

  @Get()
  @ApiOperation({
    summary: 'Per-user model usage and estimated cost (admin only)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: SwaggerBaseApiResponse(UsageReportOutput),
  })
  async report(
    @ReqContext() ctx: RequestContext,
    @Query() query: UsageReportQuery,
  ): Promise<BaseApiResponse<UsageReportOutput>> {
    const data = await this.reports.report(ctx, query.from, query.to);
    return { data, meta: { count: data.users.length } };
  }
}
