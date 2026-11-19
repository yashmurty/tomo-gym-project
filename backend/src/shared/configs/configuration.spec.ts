import configuration from './configuration';

describe('configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      JWT_PUBLIC_KEY_BASE64: Buffer.from('test-public').toString('base64'),
      JWT_PRIVATE_KEY_BASE64: Buffer.from('test-private').toString('base64'),
      JWT_ACCESS_TOKEN_EXP_IN_SEC: '3600',
      JWT_REFRESH_TOKEN_EXP_IN_SEC: '7200',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('decodes the base64 JWT keys and parses token lifetimes', () => {
    const config = configuration();

    expect(config.jwt.publicKey).toBe('test-public');
    expect(config.jwt.privateKey).toBe('test-private');
    expect(config.jwt.accessTokenExpiresInSec).toBe(3600);
    expect(config.jwt.refreshTokenExpiresInSec).toBe(7200);
  });

  it('parses DB_PORT as a number and leaves it undefined when unset', () => {
    process.env.DB_PORT = '5433';
    expect(configuration().database.port).toBe(5433);

    delete process.env.DB_PORT;
    expect(configuration().database.port).toBeUndefined();
  });
});
