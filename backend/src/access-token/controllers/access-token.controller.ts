import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
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
  BaseApiResponse,
  SwaggerBaseApiResponse,
} from '../../shared/dtos/base-api-response.dto';
import { ReqContext } from '../../shared/request-context/req-context.decorator';
import { RequestContext } from '../../shared/request-context/request-context.dto';
import {
  AccessTokenOutput,
  CreateAccessTokenInput,
  CreatedAccessTokenOutput,
} from '../dtos/access-token.dto';
import { AccessTokenService } from '../services/access-token.service';

@ApiTags('personal-access-tokens')
@Controller('personal-access-tokens')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AccessTokenController {
  constructor(private readonly accessTokenService: AccessTokenService) {}

  @Post()
  @ApiOperation({ summary: 'Create a token for an external MCP client' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    type: SwaggerBaseApiResponse(CreatedAccessTokenOutput),
  })
  async create(
    @ReqContext() ctx: RequestContext,
    @Body() input: CreateAccessTokenInput,
  ): Promise<BaseApiResponse<CreatedAccessTokenOutput>> {
    return {
      data: await this.accessTokenService.create(ctx, input.name),
      meta: {},
    };
  }

  @Get()
  @ApiOperation({
    summary: 'Your active tokens (the token values are never shown again)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: SwaggerBaseApiResponse([AccessTokenOutput]),
  })
  async list(
    @ReqContext() ctx: RequestContext,
  ): Promise<BaseApiResponse<AccessTokenOutput[]>> {
    const tokens = await this.accessTokenService.list(ctx);
    return { data: tokens, meta: { count: tokens.length } };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke a token' })
  async revoke(
    @ReqContext() ctx: RequestContext,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    await this.accessTokenService.revoke(ctx, id);
  }
}
