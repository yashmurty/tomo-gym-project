import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Post,
  Query,
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
import { AppLogger } from '../../shared/logger/logger.service';
import { ReqContext } from '../../shared/request-context/req-context.decorator';
import { RequestContext } from '../../shared/request-context/request-context.dto';
import { CreateExerciseInput } from '../dtos/exercise-create-input.dto';
import { ExerciseListQuery } from '../dtos/exercise-list-query.dto';
import { ExerciseOutput } from '../dtos/exercise-output.dto';
import { ExerciseService } from '../services/exercise.service';

@ApiTags('exercises')
@Controller('exercises')
export class ExerciseController {
  constructor(
    private readonly exerciseService: ExerciseService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(ExerciseController.name);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List the shared catalog plus your own exercises' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: SwaggerBaseApiResponse([ExerciseOutput]),
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, type: BaseApiErrorResponse })
  async list(
    @ReqContext() ctx: RequestContext,
    @Query() query: ExerciseListQuery,
  ): Promise<BaseApiResponse<ExerciseOutput[]>> {
    const exercises = await this.exerciseService.list(ctx, query.search);
    return { data: exercises, meta: { count: exercises.length } };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a custom exercise' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    type: SwaggerBaseApiResponse(ExerciseOutput),
  })
  @ApiResponse({ status: HttpStatus.CONFLICT, type: BaseApiErrorResponse })
  async create(
    @ReqContext() ctx: RequestContext,
    @Body() input: CreateExerciseInput,
  ): Promise<BaseApiResponse<ExerciseOutput>> {
    const exercise = await this.exerciseService.create(ctx, input);
    return { data: exercise, meta: {} };
  }
}
