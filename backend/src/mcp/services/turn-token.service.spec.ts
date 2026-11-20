import { JwtService } from '@nestjs/jwt';
import { generateKeyPairSync } from 'crypto';

import { TURN_TOKEN_SCOPE, TurnTokenService } from './turn-token.service';

describe('TurnTokenService', () => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const jwt = new JwtService({
    publicKey,
    privateKey,
    signOptions: { algorithm: 'RS256' },
    verifyOptions: { algorithms: ['RS256'] },
  });
  const service = new TurnTokenService(jwt);

  it('round-trips user and turn', () => {
    const token = service.mint({ userId: 7, turnId: 812 });
    expect(service.verify(token)).toEqual({ userId: 7, turnId: 812 });
    expect(jwt.decode(token)).toMatchObject({ scope: TURN_TOKEN_SCOPE });
  });

  it('rejects a login-style token without the turn scope', () => {
    const login = jwt.sign({ sub: 7, email: 'a@example.com', roles: ['USER'] });
    expect(service.verify(login)).toBeNull();
  });

  it('rejects expired, tampered and garbage tokens', () => {
    const expired = jwt.sign(
      { sub: 7, mid: 812, scope: TURN_TOKEN_SCOPE },
      { expiresIn: -1 },
    );
    expect(service.verify(expired)).toBeNull();

    const token = service.mint({ userId: 7, turnId: 812 });
    const [h, , s] = token.split('.');
    const forgedPayload = Buffer.from(
      JSON.stringify({ sub: 1, mid: 812, scope: TURN_TOKEN_SCOPE }),
    ).toString('base64url');
    expect(service.verify(`${h}.${forgedPayload}.${s}`)).toBeNull();
    expect(service.verify('not-a-jwt')).toBeNull();
  });
});
