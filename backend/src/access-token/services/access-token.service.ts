import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { IsNull, Repository } from 'typeorm';

import { Action } from '../../shared/acl/action.constant';
import { RequestContext } from '../../shared/request-context/request-context.dto';
import {
  AccessTokenOutput,
  CreatedAccessTokenOutput,
  toAccessTokenOutput,
} from '../dtos/access-token.dto';
import { PersonalAccessToken } from '../entities/personal-access-token.entity';
import { AccessTokenAclService } from './access-token-acl.service';

export const PAT_PREFIX = 'tomo_pat_';
const PREFIX_DISPLAY_LENGTH = PAT_PREFIX.length + 4;
const MAX_ACTIVE_TOKENS = 10;

export interface VerifiedAccessToken {
  tokenId: number;
  userId: number;
  name: string;
}

export function hashAccessToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AccessTokenService {
  constructor(
    @InjectRepository(PersonalAccessToken)
    private readonly repository: Repository<PersonalAccessToken>,
    private readonly aclService: AccessTokenAclService,
  ) {}

  async create(
    ctx: RequestContext,
    name: string,
  ): Promise<CreatedAccessTokenOutput> {
    this.assertAllowed(ctx, Action.Create);
    const userId = ctx.user!.id;

    const active = await this.repository.count({
      where: { userId, revokedAt: IsNull() },
    });
    if (active >= MAX_ACTIVE_TOKENS) {
      throw new BadRequestException(
        `You can have at most ${MAX_ACTIVE_TOKENS} active tokens; revoke one first`,
      );
    }

    // 32 random bytes: unguessable, so a plain hash (no salt) is enough.
    const token = PAT_PREFIX + randomBytes(32).toString('base64url');
    const saved = await this.repository.save(
      this.repository.create({
        userId,
        name,
        tokenHash: hashAccessToken(token),
        tokenPrefix: token.slice(0, PREFIX_DISPLAY_LENGTH),
      }),
    );

    return { ...toAccessTokenOutput(saved), token };
  }

  async list(ctx: RequestContext): Promise<AccessTokenOutput[]> {
    this.assertAllowed(ctx, Action.List);
    const tokens = await this.repository.find({
      where: { userId: ctx.user!.id, revokedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
    return tokens.map(toAccessTokenOutput);
  }

  async revoke(ctx: RequestContext, id: number): Promise<void> {
    const token = await this.repository.findOneBy({ id, revokedAt: IsNull() });
    if (!token) throw new NotFoundException(`Token ${id} not found`);
    this.assertAllowed(ctx, Action.Delete, token);

    await this.repository.update(id, { revokedAt: new Date() });
  }

  // For the /mcp auth guard. Null for unknown, malformed or revoked tokens.
  async verify(token: string): Promise<VerifiedAccessToken | null> {
    if (!token.startsWith(PAT_PREFIX)) return null;

    const pat = await this.repository.findOneBy({
      tokenHash: hashAccessToken(token),
      revokedAt: IsNull(),
    });
    if (!pat) return null;

    await this.repository.update(pat.id, { lastUsedAt: new Date() });
    return { tokenId: pat.id, userId: pat.userId, name: pat.name };
  }

  private assertAllowed(
    ctx: RequestContext,
    action: Action,
    token?: PersonalAccessToken,
  ): void {
    if (!this.aclService.forActor(ctx.user!).canDoAction(action, token)) {
      throw new UnauthorizedException();
    }
  }
}
