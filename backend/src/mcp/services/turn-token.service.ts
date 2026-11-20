import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export const TURN_TOKEN_SCOPE = 'mcp:turn';
export const TURN_TOKEN_TTL_SEC = 5 * 60;

export interface TurnTokenClaims {
  userId: number;
  turnId: number;
}

// Short-lived token our agent loop mints for one chat turn and sends on
// every /mcp call of that turn (roadmap Step 4). It names the user and the
// chat message, so /mcp attaches raw_input and the undo group itself and
// never trusts the caller for them. Its scope makes it useless anywhere but
// /mcp, and login tokens (no scope) are rejected there.
@Injectable()
export class TurnTokenService {
  constructor(private readonly jwtService: JwtService) {}

  mint(claims: TurnTokenClaims): string {
    return this.jwtService.sign(
      { sub: claims.userId, mid: claims.turnId, scope: TURN_TOKEN_SCOPE },
      { expiresIn: TURN_TOKEN_TTL_SEC },
    );
  }

  // Null for anything that isn't a valid, unexpired turn token.
  verify(token: string): TurnTokenClaims | null {
    try {
      const payload = this.jwtService.verify<{
        sub?: unknown;
        mid?: unknown;
        scope?: unknown;
      }>(token);
      if (
        payload.scope !== TURN_TOKEN_SCOPE ||
        typeof payload.sub !== 'number' ||
        typeof payload.mid !== 'number'
      ) {
        return null;
      }
      return { userId: payload.sub, turnId: payload.mid };
    } catch {
      return null;
    }
  }
}
