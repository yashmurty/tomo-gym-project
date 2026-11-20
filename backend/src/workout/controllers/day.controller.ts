import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
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
import { DayListQuery, DayNoteInput } from '../dtos/entry-input.dto';
import { DayDetailOutput } from '../dtos/workout-output.dto';
import { WorkoutService } from '../services/workout.service';

const DATE_PARAM = {
  name: 'date',
  example: 'today',
  description: "'today', 'yesterday' or 'YYYY-MM-DD' (in your timezone)",
};

@ApiTags('days')
@Controller('days')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DayController {
  constructor(private readonly workoutService: WorkoutService) {}

  @Get()
  @ApiOperation({ summary: 'Your training days, newest first' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: SwaggerBaseApiResponse([DayDetailOutput]),
  })
  async list(
    @ReqContext() ctx: RequestContext,
    @Query() query: DayListQuery,
  ): Promise<BaseApiResponse<DayDetailOutput[]>> {
    const days = await this.workoutService.listDays(ctx, query);
    return { data: days, meta: { count: days.length } };
  }

  @Get(':date')
  @ApiParam(DATE_PARAM)
  @ApiOperation({ summary: 'One day in full (empty if nothing was logged)' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: SwaggerBaseApiResponse(DayDetailOutput),
  })
  async get(
    @ReqContext() ctx: RequestContext,
    @Param('date') date: string,
  ): Promise<BaseApiResponse<DayDetailOutput>> {
    return { data: await this.workoutService.getDay(ctx, date), meta: {} };
  }

  @Put(':date/note')
  @ApiParam(DATE_PARAM)
  @ApiOperation({ summary: "Set or clear a day's note" })
  @ApiResponse({
    status: HttpStatus.OK,
    type: SwaggerBaseApiResponse(DayDetailOutput),
  })
  async setNote(
    @ReqContext() ctx: RequestContext,
    @Param('date') date: string,
    @Body() input: DayNoteInput,
  ): Promise<BaseApiResponse<DayDetailOutput>> {
    return {
      data: await this.workoutService.setDayNote(ctx, date, input.note),
      meta: {},
    };
  }
}
