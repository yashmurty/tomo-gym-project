import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AddressInfo } from 'net';
import request from 'supertest';
import { DataSource } from 'typeorm';

import {
  LLM_CLIENT,
  LlmClient,
  LlmRequest,
  LlmResponse,
} from '../../src/agent/llm/llm-client';
import { StubLlmClient } from '../../src/agent/llm/stub-llm-client';
import { McpEndpoint } from '../../src/agent/services/mcp-endpoint';
import { AppModule } from '../../src/app.module';
import { VALIDATION_PIPE_OPTIONS } from '../../src/shared/constants';
import { Clock } from '../../src/shared/time/clock';
import {
  closeDBAfterTest,
  createDBEntities,
  resetDBBeforeTest,
  seedAdminUser,
} from '../test-utils';

// Deliberately low limits. The clock is pinned to the moment the suite
// starts, so every request lands in the same rate-limit window and the test
// can't flake across a minute boundary.
const LIMITS = {
  CHAT_RATE_PER_MINUTE: '2',
  CHAT_RATE_PER_DAY: '100',
  MCP_RATE_PER_MINUTE: '2',
  MCP_RATE_PER_DAY: '100',
  LOGIN_RATE_PER_MINUTE: '5',
  SIGNUP_RATE_PER_HOUR: '3',
  USER_DAILY_BUDGET_USD: '0.05',
  USER_MONTHLY_BUDGET_USD: '1',
  GLOBAL_DAILY_BUDGET_USD: '5',
  SIGNUP_MODE: 'open',
};

class ScriptedLlm implements LlmClient {
  readonly queue: LlmResponse[] = [];
  private readonly stub = new StubLlmClient();
  async createMessage(req: LlmRequest): Promise<LlmResponse> {
    return this.queue.shift() ?? this.stub.createMessage(req);
  }
}

const parseSse = (body: string) =>
  body
    .split('\n\n')
    .map((c) => c.split('\n').find((l) => l.startsWith('data: ')))
    .filter((l): l is string => !!l)
    .map((l) => JSON.parse(l.slice(6)));

describe('Signup gate: limits and budgets (e2e)', () => {
  const saved: Record<string, string | undefined> = {};
  const fixedNow = new Date();
  let app: INestApplication;
  let llm: ScriptedLlm;
  const tokens: Record<string, string> = {};

  const build = async () => {
    let endpoint = '';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(LLM_CLIENT)
      .useValue(llm)
      .overrideProvider(McpEndpoint)
      .useValue({ url: () => endpoint })
      .overrideProvider(Clock)
      .useValue({ now: () => fixedNow })
      .compile();
    const instance = moduleRef.createNestApplication();
    instance.useGlobalPipes(new ValidationPipe(VALIDATION_PIPE_OPTIONS));
    await instance.listen(0, '127.0.0.1');
    const { port } = instance.getHttpServer().address() as AddressInfo;
    endpoint = `http://127.0.0.1:${port}/mcp`;
    return instance;
  };

  const http = () => request(app.getHttpServer());
  const chat = (who: string, text: string, key: string) =>
    http()
      .post('/chat')
      .set('Authorization', `Bearer ${tokens[who]}`)
      .send({ text, idempotencyKey: key });
  const userId = async (email: string) =>
    (
      await app
        .get(DataSource)
        .query('SELECT id FROM users WHERE email = $1', [email])
    )[0].id;
  // Pretend earlier model calls already cost money.
  const spend = async (email: string, outputTokens: number) =>
    app.get(DataSource).query(
      `INSERT INTO llm_usage ("userId", "turnId", model, "inputTokens", "outputTokens")
       VALUES ($1, 0, 'claude-opus-5-5', 0, $2)`,
      [await userId(email), outputTokens],
    );

  beforeAll(async () => {
    for (const [name, value] of Object.entries(LIMITS)) {
      saved[name] = process.env[name];
      process.env[name] = value;
    }
    await resetDBBeforeTest();
    await createDBEntities();
    llm = new ScriptedLlm();
    app = await build();

    // 3 signups (the limit) and 3 logins (of 5) from this IP.
    for (const name of ['alice', 'bob', 'carol']) {
      const credentials = {
        email: `${name}@example.com`,
        password: 'password-123',
      };
      await http()
        .post('/auth/register')
        .send({
          name,
          timezone: 'Asia/Tokyo',
          locale: 'en',
          ageConfirmed: true,
          ...credentials,
        })
        .expect(HttpStatus.CREATED);
      tokens[name] = (
        await http().post('/auth/login').send(credentials)
      ).body.data.accessToken;
    }
  });

  afterAll(async () => {
    await app.close();
    await closeDBAfterTest();
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  it('limits chat messages per minute, with a code and Retry-After', async () => {
    await chat('alice', '2x10 @ 47kg lat pulldown', 'alice-msg-1').expect(
      HttpStatus.OK,
    );
    await chat('alice', '2x10 @ 40kg seated row', 'alice-msg-2').expect(
      HttpStatus.OK,
    );

    const blocked = await chat(
      'alice',
      '3x5 @ 80kg squat',
      'alice-msg-3',
    ).expect(HttpStatus.TOO_MANY_REQUESTS);
    expect(blocked.body.error.details).toMatchObject({ code: 'rate_limited' });
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('never limits a retry of a stored message (a free replay)', async () => {
    const replay = await chat(
      'alice',
      '2x10 @ 47kg lat pulldown',
      'alice-msg-1',
    ).expect(HttpStatus.OK);
    expect(parseSse(replay.text)[0]).toMatchObject({
      type: 'turn',
      replayed: true,
    });
  });

  it("stops a user who has used today's budget, until their midnight", async () => {
    await spend('bob@example.com', 5_000); // $0.10 on Opus pricing > $0.05

    const blocked = await chat(
      'bob',
      '2x10 @ 47kg lat pulldown',
      'bob-msg-1',
    ).expect(HttpStatus.TOO_MANY_REQUESTS);
    expect(blocked.body.error.details.code).toBe('daily_budget');
    expect(blocked.body.error.details.message).toContain('resets at midnight');
  });

  it('checks the budget before every model call, stopping a turn midway', async () => {
    // The first call alone costs $0.20; the follow-up call must not happen.
    llm.queue.push({
      model: 'claude-opus-5-5',
      content: [
        {
          type: 'tool_use',
          id: 'toolu_budget',
          name: 'log_entry',
          input: {
            exercise: 'squat',
            unit: 'kg',
            sets: [{ reps: 5, weight: 100 }],
          },
        },
      ],
      stopReason: 'tool_use',
      usage: {
        inputTokens: 0,
        outputTokens: 10_000,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      },
    });

    const res = await chat('carol', 'squat 5 @ 100', 'carol-msg-1').expect(
      HttpStatus.OK,
    );
    const events = parseSse(res.text);
    expect(events.map((e) => e.type)).toEqual(['turn', 'tool', 'error']);
    expect(events[2]).toMatchObject({ code: 'daily_budget' });

    // What the first call saved stays (and is undoable).
    const day = await http()
      .get('/days/today')
      .set('Authorization', `Bearer ${tokens.carol}`);
    expect(day.body.data.entries).toHaveLength(1);
  });

  it('limits external MCP clients per access token', async () => {
    const pat = (
      await http()
        .post('/personal-access-tokens')
        .set('Authorization', `Bearer ${tokens.alice}`)
        .send({ name: 'limited client' })
    ).body.data.token;
    const list = () =>
      http()
        .post('/mcp')
        .set('Authorization', `Bearer ${pat}`)
        .set('Accept', 'application/json, text/event-stream')
        .send({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} });

    await list().expect(HttpStatus.OK);
    await list().expect(HttpStatus.OK);
    const blocked = await list().expect(HttpStatus.TOO_MANY_REQUESTS);
    expect(blocked.body.error.details.code).toBe('rate_limited');
    expect(blocked.headers['retry-after']).toBeDefined();
  });

  it('shows admins per-user usage and cost, and nobody else', async () => {
    const { authTokenForAdmin } = await seedAdminUser(app); // 4th login
    const res = await http()
      .get('/admin/usage')
      .set('Authorization', `Bearer ${authTokenForAdmin.accessToken}`)
      .expect(HttpStatus.OK);

    const byEmail = Object.fromEntries(
      res.body.data.users.map((u: { email: string }) => [u.email, u]),
    );
    expect(byEmail['bob@example.com'].costUsd).toBeCloseTo(0.1, 6);
    expect(byEmail['carol@example.com'].costUsd).toBeCloseTo(0.2, 6);
    expect(byEmail['alice@example.com'].costUsd).toBe(0); // stub model
    expect(res.body.data.users[0].email).toBe('carol@example.com'); // most expensive first

    await http()
      .get('/admin/usage')
      .set('Authorization', `Bearer ${tokens.alice}`)
      .expect(HttpStatus.UNAUTHORIZED);
  });

  it('limits login attempts per IP, before checking the password', async () => {
    await http()
      .post('/auth/login')
      .send({ email: 'alice@example.com', password: 'password-123' })
      .expect(HttpStatus.OK); // 5th
    const blocked = await http()
      .post('/auth/login')
      .send({ email: 'alice@example.com', password: 'wrong-password' })
      .expect(HttpStatus.TOO_MANY_REQUESTS);
    expect(blocked.body.error.details.code).toBe('rate_limited');
  });

  it('limits signups per IP', async () => {
    await http()
      .post('/auth/register')
      .send({
        name: 'dave',
        email: 'dave@example.com',
        password: 'password-123',
        timezone: 'Asia/Tokyo',
        locale: 'en',
        ageConfirmed: true,
      })
      .expect(HttpStatus.TOO_MANY_REQUESTS);
  });

  it('pauses chat for everyone once the global daily cap is spent', async () => {
    await spend('alice@example.com', 300_000); // $6 > $5 cap

    const blocked = await chat('carol', 'plank 2 min', 'carol-msg-2').expect(
      HttpStatus.TOO_MANY_REQUESTS,
    );
    expect(blocked.body.error.details.code).toBe('service_paused');
  });

  it('refuses signups while SIGNUP_MODE is closed', async () => {
    process.env.SIGNUP_MODE = 'closed';
    process.env.SIGNUP_RATE_PER_HOUR = '1000'; // so the IP limit isn't what answers
    const closed = await build();
    try {
      const res = await request(closed.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'erin',
          email: 'erin@example.com',
          password: 'password-123',
          timezone: 'Asia/Tokyo',
          locale: 'en',
          ageConfirmed: true,
        })
        .expect(HttpStatus.FORBIDDEN);
      expect(res.body.error.message).toBe('Signup is closed');
    } finally {
      await closed.close();
    }
  });
});
