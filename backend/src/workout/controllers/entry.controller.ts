import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import {
  BaseApiErrorResponse,
  BaseApiResponse,
  SwaggerBaseApiResponse,
} from '../../shared/dtos/base-api-response.dto';
import { ReqContext } from '../../shared/request-context/req-context.decorator';
import { RequestContext } from '../../shared/request-context/request-context.dto';
import {
  LogEntryInput,
  MoveEntriesInput,
  UpdateEntryInput,
} from '../dtos/entry-input.dto';
import { DayDetailOutput, EntryOutput } from '../dtos/workout-output.dto';
import { WorkoutService } from '../services/workout.service';

@ApiTags('entries')
@Controller('entries')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class EntryController {
  constructor(private readonly workoutService: WorkoutService) {}

  @Post()
  @ApiOperation({ summary: 'Log an exercise for a day (today by default)' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    type: SwaggerBaseApiResponse(EntryOutput),
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, type: BaseApiErrorResponse })
  @ApiResponse({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    description: 'Unknown exercise (with suggestions)',
    type: BaseApiErrorResponse,
  })
  async log(
    @ReqContext() ctx: RequestContext,
    @Body() input: LogEntryInput,
  ): Promise<BaseApiResponse<EntryOutput>> {
    return { data: await this.workoutService.logEntry(ctx, input), meta: {} };
  }

  // Declared before ':id' routes so 'move' isn't parsed as an id.
  @Post('move')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Move several entries to another day, atomically' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: SwaggerBaseApiResponse(DayDetailOutput),
  })
  async move(
    @ReqContext() ctx: RequestContext,
    @Body() input: MoveEntriesInput,
  ): Promise<BaseApiResponse<DayDetailOutput>> {
    return {
      data: await this.workoutService.moveEntries(ctx, input),
      meta: {},
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit an entry (sets replace; date moves it)' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: SwaggerBaseApiResponse(EntryOutput),
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, type: BaseApiErrorResponse })
  async update(
    @ReqContext() ctx: RequestContext,
    @Param('id', ParseIntPipe) id: number,
    @Body() input: UpdateEntryInput,
  ): Promise<BaseApiResponse<EntryOutput>> {
    return {
      data: await this.workoutService.updateEntry(ctx, id, input),
      meta: {},
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an entry (soft delete)' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  async remove(
    @ReqContext() ctx: RequestContext,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    await this.workoutService.deleteEntry(ctx, id);
  }
}
