import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { compare, hash } from 'bcrypt';
import { plainToClass } from 'class-transformer';
import { QueryFailedError } from 'typeorm';

import { ActionOrigin, recordAction } from '../../action-log/action-log';
import { snapshotProfile } from '../../action-log/snapshots';
import { Action } from '../../shared/acl/action.constant';
import { Actor } from '../../shared/acl/actor.constant';
import { AppLogger } from '../../shared/logger/logger.service';
import { RequestContext } from '../../shared/request-context/request-context.dto';
import { toBodyWeightKg } from '../../shared/units/weight';
import { CreateUserInput } from '../dtos/user-create-input.dto';
import { UserOutput } from '../dtos/user-output.dto';
import { UpdateUserInput } from '../dtos/user-update-input.dto';
import { User } from '../entities/user.entity';
import { UserRepository } from '../repositories/user.repository';
import { UserAclService } from './user-acl.service';

const PG_UNIQUE_VIOLATION = '23505';

@Injectable()
export class UserService {
  constructor(
    private repository: UserRepository,
    private aclService: UserAclService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(UserService.name);
  }
  async createUser(
    ctx: RequestContext,
    input: CreateUserInput,
  ): Promise<UserOutput> {
    this.logger.log(ctx, `${this.createUser.name} was called`);

    const user = plainToClass(User, input);

    user.password = await hash(input.password, 10);

    this.logger.log(ctx, `calling ${UserRepository.name}.saveUser`);
    try {
      await this.repository.save(user);
    } catch (err) {
      // The unique constraint on email: a 409 the sign-up screen can explain,
      // not a 500.
      if (
        err instanceof QueryFailedError &&
        (err as QueryFailedError & { code?: string }).code ===
          PG_UNIQUE_VIOLATION
      ) {
        throw new ConflictException('Email already registered');
      }
      throw err;
    }

    return plainToClass(UserOutput, user, {
      excludeExtraneousValues: true,
    });
  }

  async validateLoginCredentials(
    ctx: RequestContext,
    email: string,
    pass: string,
  ): Promise<UserOutput> {
    this.logger.log(ctx, `${this.validateLoginCredentials.name} was called`);

    this.logger.log(ctx, `calling ${UserRepository.name}.findOne`);
    const user = await this.repository.findOne({ where: { email } });
    if (!user) throw new UnauthorizedException();

    const match = await compare(pass, user.password);
    if (!match) throw new UnauthorizedException();

    return plainToClass(UserOutput, user, {
      excludeExtraneousValues: true,
    });
  }

  async getUsers(
    ctx: RequestContext,
    limit: number,
    offset: number,
  ): Promise<{ users: UserOutput[]; count: number }> {
    this.logger.log(ctx, `${this.getUsers.name} was called`);

    const actor: Actor = ctx.user!;

    const isAllowed = this.aclService.forActor(actor).canDoAction(Action.List);
    if (!isAllowed) {
      throw new UnauthorizedException();
    }

    this.logger.log(ctx, `calling ${UserRepository.name}.findAndCount`);
    const [users, count] = await this.repository.findAndCount({
      where: {},
      take: limit,
      skip: offset,
    });

    const usersOutput = plainToClass(UserOutput, users, {
      excludeExtraneousValues: true,
    });

    return { users: usersOutput, count };
  }

  async findById(ctx: RequestContext, id: number): Promise<UserOutput> {
    this.logger.log(ctx, `${this.findById.name} was called`);

    this.logger.log(ctx, `calling ${UserRepository.name}.findOne`);
    const user = await this.repository.findOne({ where: { id } });

    return plainToClass(UserOutput, user, {
      excludeExtraneousValues: true,
    });
  }

  // Profile of the authenticated user (GET /users/me). No ACL check needed:
  // the subject is always the caller.
  async getSelfProfile(ctx: RequestContext): Promise<UserOutput> {
    this.logger.log(ctx, `${this.getSelfProfile.name} was called`);

    this.logger.log(ctx, `calling ${UserRepository.name}.getById`);
    const user = await this.repository.getById(ctx.user!.id);

    return plainToClass(UserOutput, user, {
      excludeExtraneousValues: true,
    });
  }

  async getUserById(ctx: RequestContext, id: number): Promise<UserOutput> {
    this.logger.log(ctx, `${this.getUserById.name} was called`);

    const actor: Actor = ctx.user!;

    this.logger.log(ctx, `calling ${UserRepository.name}.getById`);
    const user = await this.repository.getById(id);

    const isAllowed = this.aclService
      .forActor(actor)
      .canDoAction(Action.Read, user);
    if (!isAllowed) {
      throw new UnauthorizedException();
    }

    return plainToClass(UserOutput, user, {
      excludeExtraneousValues: true,
    });
  }

  async findByEmail(ctx: RequestContext, email: string): Promise<UserOutput> {
    this.logger.log(ctx, `${this.findByEmail.name} was called`);

    this.logger.log(ctx, `calling ${UserRepository.name}.findOne`);
    const user = await this.repository.findOne({ where: { email } });

    return plainToClass(UserOutput, user, {
      excludeExtraneousValues: true,
    });
  }

  async updateUser(
    ctx: RequestContext,
    userId: number,
    input: UpdateUserInput,
    origin?: ActionOrigin,
  ): Promise<UserOutput> {
    this.logger.log(ctx, `${this.updateUser.name} was called`);

    this.logger.log(ctx, `calling ${UserRepository.name}.getById`);
    const user = await this.repository.getById(userId);

    const actor: Actor = ctx.user!;

    const isAllowed = this.aclService
      .forActor(actor)
      .canDoAction(Action.Update, user);
    if (!isAllowed) {
      throw new UnauthorizedException();
    }

    // Copy only the fields a user may change, one by one. Never spread
    // `input`: ValidationPipe doesn't strip unknown keys, so a spread would
    // let a client set `roles`, `email` or `isAccountDisabled`.
    const updatedUser: User = { ...user };

    if (input.name !== undefined) updatedUser.name = input.name;
    if (input.timezone !== undefined) updatedUser.timezone = input.timezone;
    if (input.locale !== undefined) updatedUser.locale = input.locale;
    if (input.weightUnit !== undefined) {
      updatedUser.weightUnit = input.weightUnit;
    }

    if (input.password) {
      updatedUser.password = await hash(input.password, 10);
    }

    // `weight` is in the unit sent alongside it, else the saved unit.
    if (input.weight !== undefined) {
      updatedUser.weightKg =
        input.weight === null
          ? null
          : toBodyWeightKg(input.weight, input.weightUnit ?? user.weightUnit);
    }

    this.logger.log(ctx, `calling ${UserRepository.name}.save`);
    if (origin?.actionGroup) {
      // Agent / MCP change: save and record it for undo in one transaction.
      await this.repository.manager.transaction(async (manager) => {
        const before = await snapshotProfile(manager, userId);
        await manager.save(User, updatedUser);
        await recordAction(manager, {
          userId,
          origin,
          entityType: 'user',
          entityId: userId,
          before,
          after: await snapshotProfile(manager, userId),
        });
      });
    } else {
      await this.repository.save(updatedUser);
    }

    return plainToClass(UserOutput, updatedUser, {
      excludeExtraneousValues: true,
    });
  }
}
