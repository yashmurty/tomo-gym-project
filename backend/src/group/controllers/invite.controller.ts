import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
import { GroupOutput, InvitePreviewOutput } from '../dtos/group-output.dto';
import { GroupService } from '../services/group.service';

// The join page's API. A link that's unknown, reset or turned off answers
// 404 without naming the group.
@ApiTags('invites')
@Controller('invites')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class InviteController {
  constructor(private readonly groupService: GroupService) {}

  @Get(':token')
  @ApiOperation({ summary: 'The group an invite link is for' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: SwaggerBaseApiResponse(InvitePreviewOutput),
  })
  async preview(
    @ReqContext() ctx: RequestContext,
    @Param('token') token: string,
  ): Promise<BaseApiResponse<InvitePreviewOutput>> {
    return {
      data: await this.groupService.previewInvite(ctx, token),
      meta: {},
    };
  }

  @Post(':token/join')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Join the group (if already a member, just returns it)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: SwaggerBaseApiResponse(GroupOutput),
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description:
      "code 'group_full': the group has the maximum number of members; 'group_limit': you're in the maximum number of groups",
  })
  async join(
    @ReqContext() ctx: RequestContext,
    @Param('token') token: string,
  ): Promise<BaseApiResponse<GroupOutput>> {
    return { data: await this.groupService.join(ctx, token), meta: {} };
  }
}
