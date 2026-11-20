// Runtime config, read from environment variables. Non-sensitive values that
// differ per environment (e.g. frontend URLs, SES sender) will live in
// per-APP_ENV tables here once a feature needs them — see denwa-alert's
// configuration.ts for that pattern (email verification lands in Step 6).
export default (): any => ({
  env: process.env.APP_ENV,
  port: process.env.APP_PORT,
  database: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : undefined,
    name: process.env.DB_NAME,
    user: process.env.DB_USER,
    pass: process.env.DB_PASS,
  },
  jwt: {
    publicKey: Buffer.from(
      process.env.JWT_PUBLIC_KEY_BASE64!,
      'base64',
    ).toString('utf8'),
    privateKey: Buffer.from(
      process.env.JWT_PRIVATE_KEY_BASE64!,
      'base64',
    ).toString('utf8'),
    accessTokenExpiresInSec: parseInt(
      process.env.JWT_ACCESS_TOKEN_EXP_IN_SEC!,
      10,
    ),
    refreshTokenExpiresInSec: parseInt(
      process.env.JWT_REFRESH_TOKEN_EXP_IN_SEC!,
      10,
    ),
  },
  defaultAdminUserPassword: process.env.DEFAULT_ADMIN_USER_PASSWORD,
  llm: {
    // 'stub' (deterministic stand-in, no API key) until the Anthropic client
    // is wired; production refuses to start on the stub.
    provider: process.env.LLM_PROVIDER ?? 'stub',
    model: process.env.LLM_MODEL ?? 'claude-haiku-5-5',
    maxTokens: process.env.LLM_MAX_TOKENS
      ? parseInt(process.env.LLM_MAX_TOKENS, 10)
      : 1024,
  },
  mcp: {
    // Where our agent loop reaches tomo's own MCP server (loopback).
    internalUrl:
      process.env.MCP_INTERNAL_URL ??
      `http://localhost:${process.env.APP_PORT ?? 3000}/api/v1/mcp`,
  },
});
