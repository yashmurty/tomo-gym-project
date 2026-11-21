import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
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
import { GroupNameInput, InviteSettingsInput } from '../dtos/group-input.dto';
import { GroupMemberOutput, GroupOutput } from '../dtos/group-output.dto';
import { GroupService } from '../services/group.service';

// Groups you're not in answer 404, whether or not they exist; owner-only
// actions by other members answer 403.
@ApiTags('groups')
@Controller('groups')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class GroupController {
  constructor(private readonly groupService: GroupService) {}

  @Post()
  @ApiOperation({ summary: 'Create a group; you become its owner' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    type: SwaggerBaseApiResponse(GroupOutput),
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: "code 'group_limit': you're in the maximum number of groups",
  })
  async create(
    @ReqContext() ctx: RequestContext,
    @Body() input: GroupNameInput,
  ): Promise<BaseApiResponse<GroupOutput>> {
    return { data: await this.groupService.create(ctx, input), meta: {} };
  }

  @Get()
  @ApiOperation({ summary: "The groups you're in, by name" })
  @ApiResponse({
    status: HttpStatus.OK,
    type: SwaggerBaseApiResponse([GroupOutput]),
  })
  async list(
    @ReqContext() ctx: RequestContext,
  ): Promise<BaseApiResponse<GroupOutput[]>> {
    const groups = await this.groupService.listMine(ctx);
    return { data: groups, meta: { count: groups.length } };
  }

  @Get(':id')
  @ApiOperation({ summary: 'One of your groups' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: SwaggerBaseApiResponse(GroupOutput),
  })
  async get(
    @ReqContext() ctx: RequestContext,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<BaseApiResponse<GroupOutput>> {
    return { data: await this.groupService.get(ctx, id), meta: {} };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename the group (owner only)' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: SwaggerBaseApiResponse(GroupOutput),
  })
  async rename(
    @ReqContext() ctx: RequestContext,
    @Param('id', ParseIntPipe) id: number,
    @Body() input: GroupNameInput,
  ): Promise<BaseApiResponse<GroupOutput>> {
    return { data: await this.groupService.rename(ctx, id, input), meta: {} };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete the group for everyone (owner only)' })
  async delete(
    @ReqContext() ctx: RequestContext,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    await this.groupService.delete(ctx, id);
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'Members: owner first, then by join date' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: SwaggerBaseApiResponse([GroupMemberOutput]),
  })
  async members(
    @ReqContext() ctx: RequestContext,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<BaseApiResponse<GroupMemberOutput[]>> {
    const members = await this.groupService.listMembers(ctx, id);
    return { data: members, meta: { count: members.length } };
  }

  @Post(':id/invite/reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Replace the invite link; the old one stops working (owner only)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: SwaggerBaseApiResponse(GroupOutput),
  })
  async resetInvite(
    @ReqContext() ctx: RequestContext,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<BaseApiResponse<GroupOutput>> {
    return { data: await this.groupService.resetInvite(ctx, id), meta: {} };
  }

  @Put(':id/invite')
  @ApiOperation({ summary: 'Turn the invite link off or on (owner only)' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: SwaggerBaseApiResponse(GroupOutput),
  })
  async setInvite(
    @ReqContext() ctx: RequestContext,
    @Param('id', ParseIntPipe) id: number,
    @Body() input: InviteSettingsInput,
  ): Promise<BaseApiResponse<GroupOutput>> {
    return {
      data: await this.groupService.setInviteEnabled(ctx, id, input.enabled),
      meta: {},
    };
  }
}
